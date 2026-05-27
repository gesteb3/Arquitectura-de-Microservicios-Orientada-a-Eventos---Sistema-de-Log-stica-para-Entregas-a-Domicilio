import { Worker } from "bullmq";

const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379)
};

const processedEvents = new Set();

function printNotification(title, event) {
  console.log("");
  console.log("===============================================");
  console.log(title);
  console.log("===============================================");
  console.log(`Evento: ${event.eventType}`);
  console.log(`Correlation ID: ${event.correlationId}`);
  console.log(`Orden: ${event.data.orderId}`);
  console.log(`Cliente: ${event.data.customerName}`);
  console.log(`Fecha: ${event.occurredAt}`);
  console.log(`Mensaje: ${event.data.message}`);

  if (event.eventType === "EntregaAsignada") {
    console.log(`Repartidor: ${event.data.driver.driverName}`);
    console.log(`Vehículo: ${event.data.driver.vehicle}`);
    console.log(`Tiempo estimado: ${event.data.estimatedTimeMinutes} minutos`);
  }

  if (event.eventType === "EntregaCompletada") {
    console.log(`Entregado por: ${event.data.deliveredBy}`);
    console.log("Estado final: PEDIDO ENTREGADO");
  }

  console.log("===============================================");
  console.log("");
}

async function handleDeliveryAssigned(event) {
  if (!event || event.eventType !== "EntregaAsignada") {
    throw new Error("Evento inválido para EntregaAsignada");
  }

  if (processedEvents.has(event.eventId)) {
    console.log(`Notificación duplicada ignorada: ${event.eventId}`);
    return null;
  }

  processedEvents.add(event.eventId);

  printNotification("NOTIFICACIÓN: ENTREGA ASIGNADA", event);

  return {
    notificationType: "DELIVERY_ASSIGNED",
    orderId: event.data.orderId,
    sent: true
  };
}

async function handleDeliveryCompleted(event) {
  if (!event || event.eventType !== "EntregaCompletada") {
    throw new Error("Evento inválido para EntregaCompletada");
  }

  if (processedEvents.has(event.eventId)) {
    console.log(`Notificación duplicada ignorada: ${event.eventId}`);
    return null;
  }

  processedEvents.add(event.eventId);

  printNotification("NOTIFICACIÓN: ENTREGA COMPLETADA", event);

  return {
    notificationType: "DELIVERY_COMPLETED",
    orderId: event.data.orderId,
    sent: true
  };
}

const assignedWorker = new Worker(
  "EntregaAsignada",
  async (job) => {
    return handleDeliveryAssigned(job.data);
  },
  {
    connection: redisConnection,
    concurrency: 5
  }
);

const completedWorker = new Worker(
  "EntregaCompletada",
  async (job) => {
    return handleDeliveryCompleted(job.data);
  },
  {
    connection: redisConnection,
    concurrency: 5
  }
);

assignedWorker.on("completed", (job) => {
  console.log(`Notificación de entrega asignada procesada. Job ${job.id}`);
});

assignedWorker.on("failed", (job, error) => {
  console.error(`Falló notificación de entrega asignada. Job ${job?.id}:`, error.message);
});

completedWorker.on("completed", (job) => {
  console.log(`Notificación de entrega completada procesada. Job ${job.id}`);
});

completedWorker.on("failed", (job, error) => {
  console.error(`Falló notificación de entrega completada. Job ${job?.id}:`, error.message);
});

assignedWorker.on("error", (error) => {
  console.error("Error interno en worker EntregaAsignada:", error);
});

completedWorker.on("error", (error) => {
  console.error("Error interno en worker EntregaCompletada:", error);
});

console.log("notification-service escuchando eventos EntregaAsignada y EntregaCompletada...");