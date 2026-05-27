# Documentación de Eventos

## Sistema de Logística para Entregas a Domicilio

Este documento describe los eventos principales utilizados por la arquitectura de microservicios orientada a eventos del sistema.

Los eventos son enviados y consumidos mediante Redis y BullMQ. Cada evento contiene un `eventId`, un `eventType`, un `correlationId`, una fecha de ocurrencia, el servicio de origen y la información del negocio dentro del campo `data`.

Además del flujo principal de colas con BullMQ, el sistema implementa un canal de tracking en tiempo real llamado `tracking-events`, utilizado para mostrar los eventos en el frontend mediante Server-Sent Events.

## Estructura general de un evento

Todos los eventos siguen una estructura común:

```json
{
  "eventId": "uuid",
  "eventType": "NombreDelEvento",
  "correlationId": "uuid",
  "occurredAt": "2026-05-27T16:00:00.000Z",
  "source": "nombre-del-servicio",
  "data": {}
}
```

## Campos generales

| Campo | Descripción |
|---|---|
| eventId | Identificador único del evento |
| eventType | Nombre del evento de negocio |
| correlationId | Identificador usado para rastrear todo el flujo de un pedido |
| occurredAt | Fecha y hora en la que ocurrió el evento |
| source | Servicio que publicó el evento |
| data | Información específica del evento |

## Canal de tracking en tiempo real

Además de las colas principales utilizadas para el procesamiento de negocio, el sistema utiliza un canal Redis Pub/Sub para observabilidad en tiempo real.

El canal utilizado es:

```txt
tracking-events
```

Cada servicio publica una copia del evento procesado en este canal:

| Servicio | Evento publicado al tracking |
|---|---|
| order-service | PedidoCreado |
| payment-service | PagoConfirmado |
| inventory-service | InventarioActualizado |
| delivery-service | EntregaAsignada y EntregaCompletada |

El `order-service` se suscribe al canal `tracking-events` y reenvía los eventos al frontend mediante el endpoint:

```txt
GET /events/stream
```

El frontend consume este endpoint usando `EventSource`, permitiendo mostrar una línea de tiempo en vivo con los eventos del pedido.

Este mecanismo no procesa lógica de negocio. Su función es únicamente mostrar trazabilidad y observabilidad del flujo asíncrono.

## 1. Evento PedidoCreado

### Descripción

Se publica cuando un usuario crea un pedido desde el frontend y el `order-service` lo guarda correctamente en PostgreSQL.

Este evento inicia el flujo asíncrono del sistema.

### Publicador

```txt
order-service
```

### Consumidor

```txt
payment-service
```

### Cola BullMQ

```txt
PedidoCreado
```

### Canal de tracking

También se publica una copia en:

```txt
tracking-events
```

### Ejemplo

```json
{
  "eventId": "b1f4d9f6-8b4c-4f5d-a9c2-1f2a3b4c5d6e",
  "eventType": "PedidoCreado",
  "correlationId": "c8a0e2a3-5e1f-44e8-a4b2-8df13201a222",
  "occurredAt": "2026-05-27T16:00:00.000Z",
  "source": "order-service",
  "data": {
    "orderId": "a2f1e9c7-3a0f-4f9d-b1e3-ff004221abcd",
    "customerName": "Gustavo Esteban",
    "customerPhone": "5555-5555",
    "customerAddress": "Jalapa, Guatemala",
    "items": [
      {
        "productId": "PROD-001",
        "name": "Pizza grande",
        "quantity": 1,
        "price": 120.75
      },
      {
        "productId": "PROD-002",
        "name": "Bebida",
        "quantity": 2,
        "price": 15
      }
    ],
    "totalAmount": 150.75,
    "status": "CREATED",
    "message": "Pedido creado correctamente"
  }
}
```

## 2. Evento PagoConfirmado

### Descripción

Se publica cuando el `payment-service` consume un evento `PedidoCreado` y simula correctamente la confirmación del pago.

### Publicador

```txt
payment-service
```

### Consumidor

```txt
inventory-service
```

### Cola BullMQ

```txt
PagoConfirmado
```

### Canal de tracking

También se publica una copia en:

```txt
tracking-events
```

### Ejemplo

```json
{
  "eventId": "f2b8d7a1-25a2-4f9a-93f7-2b0c8db1aa10",
  "eventType": "PagoConfirmado",
  "correlationId": "c8a0e2a3-5e1f-44e8-a4b2-8df13201a222",
  "occurredAt": "2026-05-27T16:00:02.000Z",
  "source": "payment-service",
  "data": {
    "paymentId": "pmt-001",
    "orderId": "a2f1e9c7-3a0f-4f9d-b1e3-ff004221abcd",
    "customerName": "Gustavo Esteban",
    "totalAmount": 150.75,
    "paymentStatus": "CONFIRMED",
    "paymentMethod": "SIMULATED_CARD",
    "message": "Pago confirmado correctamente"
  }
}
```

## 3. Evento InventarioActualizado

### Descripción

Se publica cuando el `inventory-service` consume un evento `PagoConfirmado` y simula la reserva o actualización del inventario.

### Publicador

```txt
inventory-service
```

### Consumidor

```txt
delivery-service
```

### Cola BullMQ

```txt
InventarioActualizado
```

### Canal de tracking

También se publica una copia en:

```txt
tracking-events
```

### Ejemplo

```json
{
  "eventId": "a9c0e7d4-3b21-4db7-90e1-37f3a9b7c882",
  "eventType": "InventarioActualizado",
  "correlationId": "c8a0e2a3-5e1f-44e8-a4b2-8df13201a222",
  "occurredAt": "2026-05-27T16:00:04.000Z",
  "source": "inventory-service",
  "data": {
    "orderId": "a2f1e9c7-3a0f-4f9d-b1e3-ff004221abcd",
    "customerName": "Gustavo Esteban",
    "inventoryStatus": "UPDATED",
    "reservedItems": true,
    "message": "Inventario reservado y actualizado correctamente"
  }
}
```

## 4. Evento EntregaAsignada

### Descripción

Se publica cuando el `delivery-service` consume `InventarioActualizado` y asigna un repartidor al pedido.

### Publicador

```txt
delivery-service
```

### Consumidor

```txt
notification-service
```

### Cola BullMQ

```txt
EntregaAsignada
```

### Canal de tracking

También se publica una copia en:

```txt
tracking-events
```

### Ejemplo

```json
{
  "eventId": "e5d3f2c1-6b9a-44d8-8e7c-32fdcb990110",
  "eventType": "EntregaAsignada",
  "correlationId": "c8a0e2a3-5e1f-44e8-a4b2-8df13201a222",
  "occurredAt": "2026-05-27T16:00:06.000Z",
  "source": "delivery-service",
  "data": {
    "deliveryId": "del-001",
    "orderId": "a2f1e9c7-3a0f-4f9d-b1e3-ff004221abcd",
    "customerName": "Gustavo Esteban",
    "deliveryStatus": "ASSIGNED",
    "driver": {
      "driverId": "DRV-001",
      "driverName": "Carlos Méndez",
      "vehicle": "Motocicleta"
    },
    "estimatedTimeMinutes": 35,
    "message": "Entrega asignada correctamente"
  }
}
```

## 5. Evento EntregaCompletada

### Descripción

Se publica cuando el `delivery-service` simula la finalización exitosa de la entrega.

### Publicador

```txt
delivery-service
```

### Consumidor

```txt
notification-service
```

### Cola BullMQ

```txt
EntregaCompletada
```

### Canal de tracking

También se publica una copia en:

```txt
tracking-events
```

### Ejemplo

```json
{
  "eventId": "d7f1b3a2-99a8-4e2b-b8f1-1a2b3c4d5e6f",
  "eventType": "EntregaCompletada",
  "correlationId": "c8a0e2a3-5e1f-44e8-a4b2-8df13201a222",
  "occurredAt": "2026-05-27T16:00:09.000Z",
  "source": "delivery-service",
  "data": {
    "deliveryId": "del-001",
    "orderId": "a2f1e9c7-3a0f-4f9d-b1e3-ff004221abcd",
    "customerName": "Gustavo Esteban",
    "deliveryStatus": "COMPLETED",
    "deliveredBy": "Carlos Méndez",
    "message": "Entrega completada exitosamente"
  }
}
```

## Flujo completo de eventos

```txt
PedidoCreado
     ↓
PagoConfirmado
     ↓
InventarioActualizado
     ↓
EntregaAsignada
     ↓
EntregaCompletada
```

## Flujo de tracking en tiempo real

```txt
Microservicio procesa evento
        ↓
Publica evento principal en BullMQ
        ↓
Publica copia en tracking-events
        ↓
order-service recibe la copia por Redis Pub/Sub
        ↓
order-service reenvía el evento por /events/stream
        ↓
frontend muestra el evento en tiempo real
```

## Trazabilidad distribuida

Todos los eventos relacionados con un mismo pedido comparten el mismo `correlationId`.

Esto permite seguir el recorrido completo de un pedido desde su creación hasta su entrega final, incluso cuando el flujo se ejecuta de forma asíncrona en distintos microservicios.

En el frontend, el `correlationId` se muestra junto a los eventos en tiempo real para evidenciar que todos pertenecen al mismo flujo de pedido.

## Idempotencia

Cada worker valida el `eventId` recibido para evitar procesar dos veces el mismo evento dentro de la misma ejecución del servicio.

Esto reduce el riesgo de duplicar acciones como pagos, actualizaciones de inventario o notificaciones.

## Reintentos

Los eventos publicados en BullMQ utilizan reintentos automáticos con backoff exponencial. Esto permite que si un worker falla temporalmente, BullMQ pueda intentar procesar el evento nuevamente.

## Observabilidad

La observabilidad del flujo se logra con dos mecanismos:

1. Logs de los workers en Docker.
2. Visualización de eventos en tiempo real desde el frontend.

La visualización en tiempo real no reemplaza las colas principales de BullMQ. Solo permite observar el flujo de eventos de manera más clara durante la demostración del sistema.

## Resumen de eventos

| Evento | Publicador | Consumidor | Propósito | Tracking |
|---|---|---|---|---|
| PedidoCreado | order-service | payment-service | Iniciar flujo después de crear pedido | Sí |
| PagoConfirmado | payment-service | inventory-service | Confirmar pago del pedido | Sí |
| InventarioActualizado | inventory-service | delivery-service | Reservar o actualizar inventario | Sí |
| EntregaAsignada | delivery-service | notification-service | Notificar asignación de repartidor | Sí |
| EntregaCompletada | delivery-service | notification-service | Notificar entrega finalizada | Sí |