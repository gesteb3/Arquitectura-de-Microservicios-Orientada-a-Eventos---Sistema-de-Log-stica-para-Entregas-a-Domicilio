import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";

const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: null
};

const inventarioActualizadoQueue = new Queue("InventarioActualizado", {
  connection: redisConnection
});

const trackingPublisher = new Redis(redisConnection);

const processedEvents = new Set();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function publishTrackingEvent(event) {
  await trackingPublisher.publish("tracking-events", JSON.stringify(event));
}

async function updateInventory(event) {
  if (!event || event.eventType !== "PagoConfirmado") {
    throw new Error("Evento inválido. inventory-service solo procesa PagoConfirmado");
  }

  if (processedEvents.has(event.eventId)) {
    console.log(`Evento duplicado ignorado: ${event.eventId}`);
    return null;
  }

  processedEvents.add(event.eventId);

  console.log("Evento PagoConfirmado recibido:");
  console.log(JSON.stringify(event, null, 2));

  await sleep(1000);

  const inventarioActualizadoEvent = {
    eventId: uuidv4(),
    eventType: "InventarioActualizado",
    correlationId: event.correlationId,
    occurredAt: new Date().toISOString(),
    source: "inventory-service",
    data: {
      orderId: event.data.orderId,
      customerName: event.data.customerName,
      inventoryStatus: "UPDATED",
      reservedItems: true,
      message: "Inventario reservado y actualizado correctamente"
    }
  };

  await inventarioActualizadoQueue.add(
    "inventario-actualizado",
    inventarioActualizadoEvent,
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 3000
      },
      removeOnComplete: true,
      removeOnFail: false
    }
  );

  await publishTrackingEvent(inventarioActualizadoEvent);

  console.log("Evento InventarioActualizado publicado:");
  console.log(JSON.stringify(inventarioActualizadoEvent, null, 2));

  return inventarioActualizadoEvent;
}

const worker = new Worker(
  "PagoConfirmado",
  async (job) => {
    return updateInventory(job.data);
  },
  {
    connection: redisConnection,
    concurrency: 3
  }
);

worker.on("completed", (job) => {
  console.log(`Inventario actualizado correctamente para job ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Falló la actualización de inventario en job ${job?.id}:`, error.message);
});

worker.on("error", (error) => {
  console.error("Error interno del worker de inventario:", error);
});

console.log("inventory-service escuchando eventos PagoConfirmado...");