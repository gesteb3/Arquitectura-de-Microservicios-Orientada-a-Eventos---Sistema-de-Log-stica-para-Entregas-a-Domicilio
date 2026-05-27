import express from "express";
import cors from "cors";
import { Pool } from "pg";
import { Queue } from "bullmq";
import { v4 as uuidv4 } from "uuid";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const db = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "logistics_user",
  password: process.env.DB_PASSWORD || "logistics_pass",
  database: process.env.DB_NAME || "logistics_orders"
});

const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379)
};

const pedidoCreadoQueue = new Queue("PedidoCreado", {
  connection: redisConnection
});

async function initializeDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY,
      customer_name VARCHAR(120) NOT NULL,
      customer_phone VARCHAR(30) NOT NULL,
      customer_address TEXT NOT NULL,
      status VARCHAR(50) NOT NULL,
      total_amount NUMERIC(10, 2) NOT NULL,
      items JSONB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  console.log("Base de datos inicializada correctamente");
}

app.get("/health", async (req, res) => {
  res.status(200).json({
    service: "order-service",
    status: "OK",
    timestamp: new Date().toISOString()
  });
});

app.post("/orders", async (req, res, next) => {
  try {
    const {
      customerName,
      customerPhone,
      customerAddress,
      items,
      totalAmount
    } = req.body;

    if (!customerName || !customerPhone || !customerAddress) {
      return res.status(400).json({
        message: "customerName, customerPhone y customerAddress son obligatorios"
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "items debe ser un arreglo con al menos un producto"
      });
    }

    if (!totalAmount || Number(totalAmount) <= 0) {
      return res.status(400).json({
        message: "totalAmount debe ser mayor a 0"
      });
    }

    const orderId = uuidv4();
    const correlationId = uuidv4();
    const status = "CREATED";

    const result = await db.query(
      `
      INSERT INTO orders (
        id,
        customer_name,
        customer_phone,
        customer_address,
        status,
        total_amount,
        items
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
      `,
      [
        orderId,
        customerName,
        customerPhone,
        customerAddress,
        status,
        totalAmount,
        JSON.stringify(items)
      ]
    );

    const event = {
      eventId: uuidv4(),
      eventType: "PedidoCreado",
      correlationId,
      occurredAt: new Date().toISOString(),
      source: "order-service",
      data: {
        orderId,
        customerName,
        customerPhone,
        customerAddress,
        items,
        totalAmount,
        status
      }
    };

    await pedidoCreadoQueue.add("pedido-creado", event, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 3000
      },
      removeOnComplete: true,
      removeOnFail: false
    });

    res.status(201).json({
      message: "Pedido creado correctamente",
      order: result.rows[0],
      eventPublished: "PedidoCreado",
      correlationId
    });
  } catch (error) {
    next(error);
  }
});

app.get("/orders", async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM orders
      ORDER BY created_at DESC;
    `);

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({
    message: "Ruta no encontrada"
  });
});

app.use((error, req, res, next) => {
  console.error("Error global:", error);

  res.status(500).json({
    message: "Error interno del order-service",
    detail: error.message
  });
});

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`order-service ejecutándose en puerto ${PORT}`);
    });
  } catch (error) {
    console.error("No se pudo iniciar order-service:", error);
    process.exit(1);
  }
}

startServer();