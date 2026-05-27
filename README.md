## Requisitos

Antes de ejecutar el proyecto se necesita tener instalado:

- Docker Desktop
- Git
- Navegador web

No es necesario instalar PostgreSQL, Redis ni Node.js de forma manual si se ejecuta con Docker Compose, porque todos los servicios se levantan en contenedores.

## Ejecutar el proyecto

Desde la raíz del proyecto:

```bash
docker compose up --build
```

Cuando todos los servicios estén activos, abrir el frontend en el navegador:

```txt
http://localhost:8080
```

También se puede verificar la API del servicio de pedidos en:

```txt
http://localhost:3000/health
```

## Endpoints principales

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/health` | Verifica el estado del servicio |
| POST | `/orders` | Crea un nuevo pedido |
| GET | `/orders` | Lista todos los pedidos registrados |
| GET | `/orders/:id` | Consulta un pedido específico |
| GET | `/orders/status/:status` | Filtra pedidos por estado |
| GET | `/orders/stats/summary` | Muestra resumen de pedidos y ventas |

## Crear pedido con curl

```bash
curl -X POST http://localhost:3000/orders \
-H "Content-Type: application/json" \
-d '{
  "customerName": "Gustavo Esteban",
  "customerPhone": "5555-5555",
  "customerAddress": "Jalapa, Guatemala",
  "totalAmount": 150.75,
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
  ]
}'
```

## Consultar pedidos

```bash
curl http://localhost:3000/orders
```

## Consultar resumen

```bash
curl http://localhost:3000/orders/stats/summary
```

## Ver contenedores activos

```bash
docker compose ps
```

## Ver logs del flujo de eventos

Logs del servicio de pagos:

```bash
docker compose logs -f payment-service
```

Logs del servicio de inventario:

```bash
docker compose logs -f inventory-service
```

Logs del servicio de entregas:

```bash
docker compose logs -f delivery-service
```

Logs del servicio de notificaciones:

```bash
docker compose logs -f notification-service
```

## Documentación técnica

La documentación formal del proyecto está ubicada en:

```txt
docs/DOCUMENTACION_TECNICA.md
```

Ese documento incluye:

- Descripción del sistema.
- Problema que resuelve.
- Alcance del MVP.
- Requerimientos funcionales y no funcionales.
- Justificación de la arquitectura.
- Trade-offs.
- Modelo de datos.
- Eventos del sistema.
- Diagramas Mermaid.
- Endpoints implementados.
- Evidencia recomendada.
- Conclusión técnica.