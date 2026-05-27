import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";

const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: null
};

const pagoConfirmadoQueue = new Queue("PagoConfirmado", {
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

async function processPayment(event) {
  if (!event || event.eventType !== "PedidoCreado") {
    throw new Error("Evento inválido. payment-service solo procesa PedidoCreado");
  }

  if (processedEvents.has(event.eventId)) {
    console.log(`Evento duplicado ignorado: ${event.eventId}`);
    return null;
  }

  processedEvents.add(event.eventId);

  console.log("Evento PedidoCreado recibido:");
  console.log(JSON.stringify(event, null, 2));

  await sleep(1500);

  const paymentId = uuidv4();

  const pagoConfirmadoEvent = {
    eventId: uuidv4(),
    eventType: "PagoConfirmado",
    correlationId: event.correlationId,
    occurredAt: new Date().toISOString(),
    source: "payment-service",
    data: {
      paymentId,
      orderId: event.data.orderId,
      customerName: event.data.customerName,
      totalAmount: event.data.totalAmount,
      paymentStatus: "CONFIRMED",
      paymentMethod: "SIMULATED_CARD",
      message: "Pago confirmado correctamente"
    }
  };

  await pagoConfirmadoQueue.add("pago-confirmado", pagoConfirmadoEvent, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 3000
    },
    removeOnComplete: true,
    removeOnFail: false
  });

  await publishTrackingEvent(pagoConfirmadoEvent);

  console.log("Evento PagoConfirmado publicado:");
  console.log(JSON.stringify(pagoConfirmadoEvent, null, 2));

  return pagoConfirmadoEvent;
}

const worker = new Worker(
  "PedidoCreado",
  async (job) => {
    return processPayment(job.data);
  },
  {
    connection: redisConnection,
    concurrency: 3
  }
);

worker.on("completed", (job) => {
  console.log(`Pago procesado correctamente para job ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Falló el procesamiento del pago en job ${job?.id}:`, error.message);
});

worker.on("error", (error) => {
  console.error("Error interno del worker de pagos:", error);
});

console.log("payment-service escuchando eventos PedidoCreado...");