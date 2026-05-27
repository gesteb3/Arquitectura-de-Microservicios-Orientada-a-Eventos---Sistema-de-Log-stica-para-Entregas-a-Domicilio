import { Queue, Worker } from "bullmq";
import { v4 as uuidv4 } from "uuid";

const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379)
};

const entregaAsignadaQueue = new Queue("EntregaAsignada", {
  connection: redisConnection
});

const entregaCompletadaQueue = new Queue("EntregaCompletada", {
  connection: redisConnection
});

const processedEvents = new Set();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assignDriver() {
  const drivers = [
    {
      driverId: "DRV-001",
      driverName: "Carlos Méndez",
      vehicle: "Motocicleta"
    },
    {
      driverId: "DRV-002",
      driverName: "Luis Ramírez",
      vehicle: "Automóvil"
    },
    {
      driverId: "DRV-003",
      driverName: "María López",
      vehicle: "Motocicleta"
    }
  ];

  const randomIndex = Math.floor(Math.random() * drivers.length);
  return drivers[randomIndex];
}

async function processDelivery(event) {
  if (!event || event.eventType !== "InventarioActualizado") {
    throw new Error("Evento inválido. delivery-service solo procesa InventarioActualizado");
  }

  if (processedEvents.has(event.eventId)) {
    console.log(`Evento duplicado ignorado: ${event.eventId}`);
    return null;
  }

  processedEvents.add(event.eventId);

  console.log("Evento InventarioActualizado recibido:");
  console.log(JSON.stringify(event, null, 2));

  await sleep(1000);

  const deliveryId = uuidv4();
  const driver = assignDriver();

  const entregaAsignadaEvent = {
    eventId: uuidv4(),
    eventType: "EntregaAsignada",
    correlationId: event.correlationId,
    occurredAt: new Date().toISOString(),
    source: "delivery-service",
    data: {
      deliveryId,
      orderId: event.data.orderId,
      customerName: event.data.customerName,
      deliveryStatus: "ASSIGNED",
      driver,
      estimatedTimeMinutes: 35,
      message: "Entrega asignada correctamente"
    }
  };

  await entregaAsignadaQueue.add("entrega-asignada", entregaAsignadaEvent, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 3000
    },
    removeOnComplete: true,
    removeOnFail: false
  });

  console.log("Evento EntregaAsignada publicado:");
  console.log(JSON.stringify(entregaAsignadaEvent, null, 2));

  await sleep(2500);

  const entregaCompletadaEvent = {
    eventId: uuidv4(),
    eventType: "EntregaCompletada",
    correlationId: event.correlationId,
    occurredAt: new Date().toISOString(),
    source: "delivery-service",
    data: {
      deliveryId,
      orderId: event.data.orderId,
      customerName: event.data.customerName,
      deliveryStatus: "COMPLETED",
      deliveredBy: driver.driverName,
      message: "Entrega completada exitosamente"
    }
  };

  await entregaCompletadaQueue.add("entrega-completada", entregaCompletadaEvent, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 3000
    },
    removeOnComplete: true,
    removeOnFail: false
  });

  console.log("Evento EntregaCompletada publicado:");
  console.log(JSON.stringify(entregaCompletadaEvent, null, 2));

  return {
    assigned: entregaAsignadaEvent,
    completed: entregaCompletadaEvent
  };
}

const worker = new Worker(
  "InventarioActualizado",
  async (job) => {
    return processDelivery(job.data);
  },
  {
    connection: redisConnection,
    concurrency: 3
  }
);

worker.on("completed", (job) => {
  console.log(`Entrega procesada correctamente para job ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Falló el procesamiento de entrega en job ${job?.id}:`, error.message);
});

worker.on("error", (error) => {
  console.error("Error interno del worker de entregas:", error);
});

console.log("delivery-service escuchando eventos InventarioActualizado...");