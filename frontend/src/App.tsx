import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  status: string;
  total_amount: string;
  created_at: string;
};

type Summary = {
  totalOrders: number;
  totalSales: string;
  ordersByStatus: {
    status: string;
    total: number;
  }[];
  generatedAt: string;
};

type TrackingEvent = {
  eventId?: string;
  eventType: string;
  correlationId?: string;
  occurredAt: string;
  source: string;
  data: {
    orderId?: string;
    customerName?: string;
    message?: string;
    paymentStatus?: string;
    inventoryStatus?: string;
    deliveryStatus?: string;
    deliveredBy?: string;
    driver?: {
      driverName: string;
      vehicle: string;
    };
  };
};

function getEventDescription(event: TrackingEvent) {
  if (event.eventType === "PedidoCreado") {
    return "Pedido creado y registrado en PostgreSQL";
  }

  if (event.eventType === "PagoConfirmado") {
    return "Pago confirmado por el servicio de pagos";
  }

  if (event.eventType === "InventarioActualizado") {
    return "Inventario actualizado y reservado";
  }

  if (event.eventType === "EntregaAsignada") {
    return `Entrega asignada a ${event.data.driver?.driverName || "repartidor"}`;
  }

  if (event.eventType === "EntregaCompletada") {
    return "Entrega completada exitosamente";
  }

  if (event.eventType === "CONNECTED") {
    return "Conexión en tiempo real activa";
  }

  return event.data.message || "Evento recibido";
}

function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [totalAmount, setTotalAmount] = useState("");

  async function loadData() {
    setLoading(true);

    const ordersResponse = await fetch(`${API_URL}/orders`);
    const ordersData = await ordersResponse.json();

    const summaryResponse = await fetch(`${API_URL}/orders/stats/summary`);
    const summaryData = await summaryResponse.json();

    setOrders(ordersData.orders || []);
    setSummary(summaryData);
    setLoading(false);
  }

  async function createOrder(event: React.FormEvent) {
    event.preventDefault();

    const response = await fetch(`${API_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        customerName,
        customerPhone,
        customerAddress,
        totalAmount: Number(totalAmount),
        items: [
          {
            productId: "PROD-001",
            name: "Pizza grande",
            quantity: 1,
            price: 120.75
          },
          {
            productId: "PROD-002",
            name: "Bebida",
            quantity: 2,
            price: 15
          }
        ]
      })
    });

    if (!response.ok) {
      alert("No se pudo crear el pedido");
      return;
    }

    await loadData();
    alert("Pedido creado correctamente");
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const eventSource = new EventSource(`${API_URL}/events/stream`);

    eventSource.onmessage = (message) => {
      const eventData = JSON.parse(message.data) as TrackingEvent;

      setTrackingEvents((currentEvents) => {
        const nextEvents = [eventData, ...currentEvents];
        return nextEvents.slice(0, 10);
      });
    };

    eventSource.onerror = () => {
      console.error("Error en conexión SSE de eventos");
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <main className="container-fluid p-4 bg-light min-vh-100">
      <div className="mb-4">
        <h1 className="fw-bold">Sistema de Logística</h1>
        <p className="text-muted">
          Dashboard de microservicios orientados a eventos con Redis, BullMQ y PostgreSQL.
        </p>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <p className="text-muted mb-1">Pedidos registrados</p>
              <h2>{summary?.totalOrders ?? 0}</h2>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <p className="text-muted mb-1">Total vendido</p>
              <h2>Q {summary?.totalSales ?? "0.00"}</h2>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <p className="text-muted mb-1">Arquitectura</p>
              <h2>Event-Driven</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-4">
          <div className="card shadow-sm border-0">
            <div className="card-header bg-white">
              <h5 className="mb-0">Crear pedido</h5>
            </div>

            <div className="card-body">
              <form onSubmit={createOrder}>
                <div className="mb-3">
                  <label className="form-label">Cliente</label>
                  <input
                    className="form-control"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Teléfono</label>
                  <input
                    className="form-control"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Dirección</label>
                  <input
                    className="form-control"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Total</label>
                  <input
                    className="form-control"
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                  />
                </div>

                <button className="btn btn-primary w-100" type="submit">
                  Crear pedido
                </button>
              </form>
            </div>
          </div>

          <div className="card shadow-sm border-0 mt-4">
            <div className="card-header bg-white">
              <h5 className="mb-0">Estados de pedidos</h5>
            </div>

            <div className="card-body">
              {summary?.ordersByStatus?.map((item) => (
                <div key={item.status} className="d-flex justify-content-between border-bottom py-2">
                  <span>{item.status}</span>
                  <strong>{item.total}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card shadow-sm border-0">
            <div className="card-header bg-white d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Pedidos recientes</h5>
              <button className="btn btn-outline-primary btn-sm" onClick={loadData}>
                {loading ? "Actualizando..." : "Actualizar"}
              </button>
            </div>

            <div className="card-body table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Teléfono</th>
                    <th>Dirección</th>
                    <th>Estado</th>
                    <th>Total</th>
                    <th>Fecha</th>
                  </tr>
                </thead>

                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.customer_name}</td>
                      <td>{order.customer_phone}</td>
                      <td>{order.customer_address}</td>
                      <td>
                        <span className="badge bg-success">{order.status}</span>
                      </td>
                      <td>Q {order.total_amount}</td>
                      <td>{new Date(order.created_at).toLocaleString()}</td>
                    </tr>
                  ))}

                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted">
                        No hay pedidos registrados todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card shadow-sm border-0 mt-4">
            <div className="card-header bg-white d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Eventos en tiempo real</h5>
              <span className="badge bg-primary">SSE activo</span>
            </div>

            <div className="card-body">
              {trackingEvents.length === 0 && (
                <p className="text-muted mb-0">
                  Aún no hay eventos. Crea un pedido para ver el flujo en tiempo real.
                </p>
              )}

              <div className="list-group">
                {trackingEvents.map((event, index) => (
                  <div
                    className="list-group-item border-0 border-bottom"
                    key={`${event.eventId || event.eventType}-${index}`}
                  >
                    <div className="d-flex justify-content-between">
                      <strong>{event.eventType}</strong>
                      <small className="text-muted">
                        {new Date(event.occurredAt).toLocaleTimeString()}
                      </small>
                    </div>

                    <p className="mb-1">{getEventDescription(event)}</p>

                    <small className="text-muted">
                      Servicio: {event.source}
                      {event.correlationId ? ` | Correlation ID: ${event.correlationId}` : ""}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;