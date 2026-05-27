# Sistema de Logística para Entregas a Domicilio

## Grupo 2 y Grupo 6
## Arquitectura de Microservicios Orientada a Eventos

## 1. Descripción del sistema

El proyecto consiste en un sistema de logística para entregas a domicilio basado en una arquitectura de microservicios orientada a eventos. El sistema permite registrar pedidos desde una interfaz web, almacenar la información en una base de datos PostgreSQL y ejecutar en segundo plano un flujo de negocio mediante eventos procesados con Redis y BullMQ.

La solución simula el comportamiento de una plataforma de última milla, donde distintos servicios independientes reaccionan ante eventos del negocio como la creación de un pedido, confirmación de pago, actualización de inventario, asignación de entrega y finalización de entrega.

El sistema fue diseñado para demostrar desacoplamiento entre servicios, procesamiento asíncrono, consistencia eventual, trazabilidad distribuida y separación de responsabilidades.

## 2. Problema que resuelve

En una plataforma de entregas, la creación de un pedido no debería depender directamente de que todos los procesos posteriores terminen de ejecutarse en el mismo instante. Si el pago, inventario, entrega o notificación fallan, el sistema no debería detener completamente la creación del pedido.

Un enfoque monolítico generaría alto acoplamiento, mayor dificultad de mantenimiento y menor tolerancia a fallos. Por ello, este proyecto utiliza una arquitectura orientada a eventos, donde cada servicio procesa una parte del flujo de forma independiente.

## 3. Alcance del MVP

El MVP implementado incluye:

- Creación de pedidos desde un frontend web.
- Persistencia de pedidos en PostgreSQL.
- Publicación del evento `PedidoCreado`.
- Procesamiento asíncrono del pago.
- Publicación del evento `PagoConfirmado`.
- Actualización simulada de inventario.
- Publicación del evento `InventarioActualizado`.
- Asignación simulada de entrega.
- Publicación de los eventos `EntregaAsignada` y `EntregaCompletada`.
- Notificaciones y tracking mediante logs.
- Consulta de pedidos desde API HTTP.
- Dashboard web con resumen de ventas y tabla de pedidos.
- Ejecución local completa mediante Docker Compose.

## 4. Requerimientos funcionales

### RF1. Crear pedidos

El sistema debe permitir registrar pedidos con nombre del cliente, teléfono, dirección, productos y monto total.

### RF2. Publicar eventos de negocio

Después de crear un pedido, el sistema debe publicar el evento `PedidoCreado` para iniciar el flujo asíncrono.

### RF3. Procesar eventos mediante workers

Los servicios de pagos, inventario, entregas y notificaciones deben reaccionar a eventos previos utilizando workers independientes.

### RF4. Consultar información operativa

El sistema debe permitir consultar pedidos registrados, filtrar por estado y visualizar un resumen general de pedidos y ventas.

## 5. Requerimientos no funcionales

### RNF1. Disponibilidad

Los servicios se ejecutan en contenedores independientes, permitiendo aislar fallos y reiniciar servicios sin detener toda la solución.

### RNF2. Consistencia eventual

El sistema acepta consistencia eventual, ya que el pedido se registra inmediatamente y los procesos posteriores se ejecutan en segundo plano.

### RNF3. Escalabilidad horizontal

Los workers pueden escalarse aumentando la cantidad de instancias de cada servicio consumidor para procesar más eventos en paralelo.

## 6. Stack tecnológico

| Tecnología | Uso |
|---|---|
| Node.js | Desarrollo de microservicios |
| Express | API HTTP del servicio de pedidos |
| React + Vite + TypeScript | Frontend web |
| PostgreSQL | Base de datos transaccional |
| Redis | Motor de colas |
| BullMQ | Productores y workers de eventos |
| Docker | Contenedores |
| Docker Compose | Orquestación local |

## 7. Servicios implementados

| Servicio | Responsabilidad |
|---|---|
| frontend | Interfaz web para crear y consultar pedidos |
| order-service | Crea pedidos, guarda en PostgreSQL y publica `PedidoCreado` |
| payment-service | Consume `PedidoCreado` y publica `PagoConfirmado` |
| inventory-service | Consume `PagoConfirmado` y publica `InventarioActualizado` |
| delivery-service | Consume `InventarioActualizado` y publica eventos de entrega |
| notification-service | Consume eventos de entrega y muestra tracking |
| redis | Infraestructura de colas |
| postgres | Persistencia de pedidos |

## 8. Justificación de la arquitectura

La arquitectura orientada a eventos es adecuada para un sistema de logística porque las operaciones del negocio ocurren como una cadena de reacciones. Cuando un pedido se crea, otros servicios deben responder a ese evento sin estar fuertemente acoplados entre sí.

El servicio de pedidos no llama directamente al servicio de pagos, inventario o entregas. En su lugar, publica un evento en Redis mediante BullMQ. Los workers consumen esos eventos y continúan el flujo de forma asíncrona.

Esto permite bajo acoplamiento, alta cohesión, desacoplamiento temporal y mejor tolerancia a fallos. Además, el uso de `correlationId` permite mantener trazabilidad distribuida entre los eventos de un mismo pedido.

## 9. Trade-offs

| Ventaja | Desafío aceptado |
|---|---|
| Bajo acoplamiento entre servicios | Mayor complejidad para depurar |
| Procesamiento asíncrono | Los datos no se actualizan de forma inmediata |
| Escalabilidad por servicio | Más configuración operativa |
| Reintentos automáticos | Se debe controlar idempotencia |
| Flujo distribuido | Se requiere trazabilidad mediante `correlationId` |

El proyecto acepta estos trade-offs porque el dominio de logística se beneficia del procesamiento asíncrono y de la separación por responsabilidades.

## 10. Modelo de datos

Tabla principal: `orders`

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID | Identificador único del pedido |
| customer_name | VARCHAR(120) | Nombre del cliente |
| customer_phone | VARCHAR(30) | Teléfono del cliente |
| customer_address | TEXT | Dirección de entrega |
| status | VARCHAR(50) | Estado inicial del pedido |
| total_amount | NUMERIC(10,2) | Total del pedido |
| items | JSONB | Lista de productos del pedido |
| created_at | TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | Fecha de actualización |

## 11. Eventos del sistema

Los eventos implementados son:

| Evento | Publicador | Consumidor |
|---|---|---|
| PedidoCreado | order-service | payment-service |
| PagoConfirmado | payment-service | inventory-service |
| InventarioActualizado | inventory-service | delivery-service |
| EntregaAsignada | delivery-service | notification-service |
| EntregaCompletada | delivery-service | notification-service |

## 12. Esquema del evento PedidoCreado

```json
{
  "eventId": "uuid",
  "eventType": "PedidoCreado",
  "correlationId": "uuid",
  "occurredAt": "2026-05-27T16:00:00.000Z",
  "source": "order-service",
  "data": {
    "orderId": "uuid",
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
    "status": "CREATED"
  }
}

## 13. Diagrama de arquitectura general

```mermaid
flowchart LR
    Cliente[Cliente / Usuario] --> Frontend[Frontend React + Vite]

    Frontend -->|HTTP POST /orders| OrderService[order-service<br>Node.js + Express]
    Frontend -->|HTTP GET /orders| OrderService

    OrderService -->|Guarda pedido| Postgres[(PostgreSQL)]
    OrderService -->|Publica PedidoCreado| Redis[(Redis + BullMQ)]

    Redis --> PaymentService[payment-service<br>Worker]
    PaymentService -->|Publica PagoConfirmado| Redis

    Redis --> InventoryService[inventory-service<br>Worker]
    InventoryService -->|Publica InventarioActualizado| Redis

    Redis --> DeliveryService[delivery-service<br>Worker]
    DeliveryService -->|Publica EntregaAsignada<br>EntregaCompletada| Redis

    Redis --> NotificationService[notification-service<br>Worker]
    NotificationService -->|Muestra tracking| Logs[Logs / Consola]
```

## 14. Diagrama de secuencia del flujo asíncrono

```mermaid
sequenceDiagram
    actor Usuario
    participant Frontend
    participant Order as order-service
    participant DB as PostgreSQL
    participant Queue as Redis + BullMQ
    participant Payment as payment-service
    participant Inventory as inventory-service
    participant Delivery as delivery-service
    participant Notification as notification-service

    Usuario->>Frontend: Crea pedido
    Frontend->>Order: POST /orders
    Order->>DB: Inserta pedido
    Order->>Queue: Publica PedidoCreado
    Order-->>Frontend: HTTP 201 Pedido creado

    Queue-->>Payment: Consume PedidoCreado
    Payment->>Queue: Publica PagoConfirmado

    Queue-->>Inventory: Consume PagoConfirmado
    Inventory->>Queue: Publica InventarioActualizado

    Queue-->>Delivery: Consume InventarioActualizado
    Delivery->>Queue: Publica EntregaAsignada
    Delivery->>Queue: Publica EntregaCompletada

    Queue-->>Notification: Consume EntregaAsignada
    Queue-->>Notification: Consume EntregaCompletada
    Notification-->>Usuario: Tracking por logs
```

## 15. Flujo de ejecución del pedido

1. El usuario crea un pedido desde el frontend.
2. `order-service` recibe la solicitud HTTP.
3. `order-service` guarda el pedido en PostgreSQL.
4. `order-service` publica el evento `PedidoCreado`.
5. `payment-service` consume `PedidoCreado`.
6. `payment-service` publica `PagoConfirmado`.
7. `inventory-service` consume `PagoConfirmado`.
8. `inventory-service` publica `InventarioActualizado`.
9. `delivery-service` consume `InventarioActualizado`.
10. `delivery-service` publica `EntregaAsignada`.
11. `delivery-service` publica `EntregaCompletada`.
12. `notification-service` consume eventos de entrega y muestra tracking.

## 16. Endpoints implementados

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/health` | Verifica estado del servicio |
| POST | `/orders` | Crea un pedido |
| GET | `/orders` | Lista todos los pedidos |
| GET | `/orders/:id` | Consulta un pedido específico |
| GET | `/orders/status/:status` | Filtra pedidos por estado |
| GET | `/orders/stats/summary` | Muestra resumen de pedidos y ventas |

## 17. Ejecución local

Para levantar todo el sistema:

```bash
docker compose up --build
```

Frontend:

```txt
http://localhost:8080
```

API de pedidos:

```txt
http://localhost:3000/health
```

Lista de pedidos:

```txt
http://localhost:3000/orders
```

Resumen:

```txt
http://localhost:3000/orders/stats/summary
```

## 18. Comandos útiles para evidencia

Ver contenedores activos:

```bash
docker compose ps
```

Ver logs del servicio de pagos:

```bash
docker compose logs -f payment-service
```

Ver logs del servicio de inventario:

```bash
docker compose logs -f inventory-service
```

Ver logs del servicio de entregas:

```bash
docker compose logs -f delivery-service
```

Ver logs del servicio de notificaciones:

```bash
docker compose logs -f notification-service
```