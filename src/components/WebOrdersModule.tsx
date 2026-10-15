
'use client';

import { useCallback, useEffect, useState } from 'react';

interface WebOrderItem {
  product_id: number;
  name: string;
  quantity: number;
  price_at_sale: number;
  taxable: boolean;
  current_stock: number;
}

interface WebOrder {
  id: number;
  customer_id: number | null;
  customer_name: string;
  customer_document: string;
  customer_phone: string;
  total_usd: number;
  total_ves: number;
  payment_method: string;
  created_at: string | null;
  cash_register_id: number | null;
  exchange_rate: number;
  status: string;
  source: string;
  order_type: string;
  delivery_zone: string;
  delivery_address: string;
  items: WebOrderItem[];
}

interface WebOrdersModuleProps {
  onLoadOrder: (order: WebOrder) => void;
  loadedOrderId?: number | null;
}

export default function WebOrdersModule({
  onLoadOrder,
  loadedOrderId = null,
}: WebOrdersModuleProps) {
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<number[]>([]);

  const loadOrders = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);

    try {
      const responses = await Promise.all([
        fetch('/api/admin/orders?status=pendiente', {
          cache: 'no-store',
        }),
        fetch('/api/admin/orders?status=aprobado', {
          cache: 'no-store',
        }),
      ]);

      const pendingData = await responses[0].json();
      const approvedData = await responses[1].json();

      if (!responses[0].ok || !pendingData.success) {
        throw new Error(
          pendingData.message || 'No se pudieron consultar los pedidos pendientes.'
        );
      }

      if (!responses[1].ok || !approvedData.success) {
        throw new Error(
          approvedData.message || 'No se pudieron consultar los pedidos aprobados.'
        );
      }

      const pendingOrders: WebOrder[] = Array.isArray(pendingData.orders)
        ? pendingData.orders
        : [];

      const approvedOrders: WebOrder[] = Array.isArray(approvedData.orders)
        ? approvedData.orders
        : [];

      const ordersMap = new Map<number, WebOrder>();

      [...pendingOrders, ...approvedOrders].forEach((order) => {
        ordersMap.set(Number(order.id), order);
      });

      const sortedOrders = Array.from(ordersMap.values()).sort((a, b) => {
        const statusOrderA = a.status === 'pendiente' ? 0 : 1;
        const statusOrderB = b.status === 'pendiente' ? 0 : 1;

        return statusOrderA !== statusOrderB
          ? statusOrderA - statusOrderB
          : Number(b.id) - Number(a.id);
      });

      setOrders(sortedOrders);
      setError('');
    } catch (err) {
      console.error('Error cargando pedidos web:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los pedidos web.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();

    const interval = setInterval(() => {
      void loadOrders();
    }, 10000);

    return () => clearInterval(interval);
  }, [loadOrders]);

  const updateOrderStatus = async (
    order: WebOrder,
    status: 'aprobado' | 'cancelado'
  ) => {
    if (processingId !== null) return;

    if (status === 'cancelado') {
      const confirmed = window.confirm(
        '¿Deseas rechazar el pedido web #' +
          order.id +
          ' de ' +
          (order.customer_name || 'este cliente') +
          '?'
      );

      if (!confirmed) return;
    }

    setProcessingId(order.id);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/admin/orders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: order.id,
          status,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'No se pudo actualizar el pedido.');
      }

      setMessage(
        status === 'aprobado'
          ? 'Pedido #' + order.id + ' aceptado. Ya puedes cargarlo al POS.'
          : 'Pedido #' + order.id + ' rechazado correctamente.'
      );

      await loadOrders();
    } catch (err) {
      console.error('Error actualizando pedido:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar el pedido.'
      );
    } finally {
      setProcessingId(null);
    }
  };

  const toggleExpanded = (id: number) => {
    setExpandedOrders((previous) =>
      previous.includes(id)
        ? previous.filter((orderId) => orderId !== id)
        : [...previous, id]
    );
  };

  const formatUSD = (value: number) =>
    new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(Number(value) || 0);

  const formatVES = (value: number) =>
    new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'VES',
      minimumFractionDigits: 2,
    }).format(Number(value) || 0);

  const formatDate = (value: string | null) => {
    if (!value) return 'Fecha no disponible';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString('es-VE', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  const pendingOrders = orders.filter(
    (order) => order.status === 'pendiente'
  );

  const approvedOrders = orders.filter(
    (order) => order.status === 'aprobado'
  );

  if (loading) {
    return (
      <section className="mb-4 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-fuchsia-500" />
          Consultando pedidos web...
        </div>
      </section>
    );
  }

  return (
    <section className="mb-5 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800 shadow-sm sm:p-4">
      {/* Encabezado compacto */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-100 text-fuchsia-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L21 8H6" />
              <circle cx="10" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
            </svg>
          </div>

          <div className="min-w-0">
            <h2 className="text-base font-bold leading-tight text-gray-900 sm:text-lg">
              Pedidos web
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Gestión desde caja
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadOrders(true)}
          disabled={refreshing || processingId !== null}
          className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-fuchsia-300 hover:text-fuchsia-700 disabled:opacity-50 sm:text-sm"
        >
          {refreshing ? 'Actualizando...' : '↻ Actualizar'}
        </button>
      </div>

      {/* Resumen compacto */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <div>
            <p className="text-xs font-medium text-amber-800">
              Pendientes
            </p>
            <p className="text-xl font-bold leading-tight text-amber-900">
              {pendingOrders.length}
            </p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-amber-600">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </span>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
          <div>
            <p className="text-xs font-medium text-green-800">
              Aprobados
            </p>
            <p className="text-xl font-bold leading-tight text-green-900">
              {approvedOrders.length}
            </p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-green-600">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="m5 12 4 4L19 6" />
            </svg>
          </span>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
        >
          {message}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-3 py-6 text-center">
          <p className="text-sm font-semibold text-gray-700">
            No hay pedidos por gestionar
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Los nuevos pedidos aparecerán aquí automáticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {orders.map((order) => {
            const isPending = order.status === 'pendiente';
            const isApproved = order.status === 'aprobado';
            const isProcessing = processingId === order.id;
            const isLoaded =
              Number(loadedOrderId) === Number(order.id);
            const isExpanded = expandedOrders.includes(order.id);

            return (
              <article
                key={order.id}
                className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                {/* Resumen que siempre queda visible */}
                <div className="p-3 sm:p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900 sm:text-base">
                          Pedido #{order.id}
                        </h3>

                        <span
                          className={
                            'rounded-full px-2 py-0.5 text-[10px] font-bold sm:text-xs ' +
                            (isPending
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-green-100 text-green-800')
                          }
                        >
                          {isPending ? 'Pendiente' : 'Aprobado'}
                        </span>
                      </div>

                      <p className="mt-1 truncate text-sm font-semibold text-gray-800">
                        {order.customer_name || 'Cliente sin nombre'}
                      </p>

                      <p className="mt-0.5 text-xs text-gray-500">
                        {order.customer_phone || 'Sin teléfono'}
                        {' · '}
                        {formatDate(order.created_at)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-base font-bold text-gray-900 sm:text-lg">
                        {formatUSD(order.total_usd)}
                      </p>
                      <p className="text-[11px] text-gray-500 sm:text-xs">
                        {formatVES(order.total_ves)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2.5">
                    <span className="text-xs text-gray-500">
                      {order.items.length}{' '}
                      {order.items.length === 1 ? 'producto' : 'productos'}
                      {order.order_type ? ' · ' + order.order_type : ''}
                    </span>

                    <button
                      type="button"
                      onClick={() => toggleExpanded(order.id)}
                      aria-expanded={isExpanded}
                      className="rounded-md px-2 py-1 text-xs font-semibold text-fuchsia-700 transition hover:bg-fuchsia-50"
                    >
                      {isExpanded ? 'Ocultar detalles ↑' : 'Ver detalles ↓'}
                    </button>
                  </div>

                  {/* Acciones principales */}
                  {isPending && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void updateOrderStatus(order, 'aprobado')
                        }
                        disabled={
                          processingId !== null ||
                          order.items.length === 0
                        }
                        className="rounded-lg bg-green-600 px-2 py-2.5 text-xs font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                      >
                        {isProcessing ? 'Procesando...' : '✓ Aceptar'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void updateOrderStatus(order, 'cancelado')
                        }
                        disabled={processingId !== null}
                        className="rounded-lg border border-red-200 bg-white px-2 py-2.5 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                      >
                        {isProcessing ? 'Procesando...' : '✕ Rechazar'}
                      </button>
                    </div>
                  )}

                  {isApproved && (
                    <button
                      type="button"
                      onClick={() => onLoadOrder(order)}
                      disabled={
                        isLoaded ||
                        processingId !== null ||
                        order.items.length === 0
                      }
                      className="mt-2 w-full rounded-lg bg-fuchsia-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                    >
                      {isLoaded
                        ? '✓ Pedido cargado en el POS'
                        : 'Cargar al POS y facturar →'}
                    </button>
                  )}
                </div>

                {/* Detalles desplegables para ahorrar espacio */}
                {isExpanded && (
                  <div className="space-y-3 border-t border-gray-100 bg-gray-50 p-3">
                    <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                      {order.customer_document && (
                        <p className="break-words text-gray-600">
                          <span className="font-semibold text-gray-800">
                            CI/RIF:
                          </span>{' '}
                          {order.customer_document}
                        </p>
                      )}

                      <p className="break-words text-gray-600">
                        <span className="font-semibold text-gray-800">
                          Pago indicado:
                        </span>{' '}
                        {order.payment_method || 'No indicado'}
                      </p>

                      {order.delivery_zone && (
                        <p className="break-words text-gray-600">
                          <span className="font-semibold text-gray-800">
                            Zona:
                          </span>{' '}
                          {order.delivery_zone}
                        </p>
                      )}

                      {order.delivery_address && (
                        <p className="break-words text-gray-600 sm:col-span-2">
                          <span className="font-semibold text-gray-800">
                            Dirección:
                          </span>{' '}
                          {order.delivery_address}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                        Detalle de productos
                      </p>

                      {order.items.length === 0 ? (
                        <p className="text-xs text-amber-700">
                          Este pedido no tiene productos registrados.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {order.items.map((item, index) => (
                            <div
                              key={
                                String(order.id) +
                                '-' +
                                String(item.product_id) +
                                '-' +
                                String(index)
                              }
                              className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="break-words text-xs font-semibold text-gray-800">
                                  {item.name}
                                </p>
                                <p className="mt-0.5 text-[11px] text-gray-500">
                                  Cantidad: {item.quantity}
                                </p>
                              </div>

                              <p className="shrink-0 text-xs font-semibold text-gray-700">
                                {formatUSD(
                                  item.quantity * item.price_at_sale
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {isApproved && (
                      <p className="text-[11px] text-gray-500">
                        La venta se completa al confirmar el pago con una
                        caja abierta.
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <p className="text-center text-[10px] text-gray-400">
        Actualización automática cada 10 segundos.
      </p>
    </section>
  );
}
