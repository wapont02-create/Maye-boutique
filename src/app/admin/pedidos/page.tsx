'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface OrderItem {
  product_id: number;
  name: string;
  quantity: number;
  price_at_sale: number;
  taxable: boolean;
  current_stock: number;
}

interface Order {
  id: number;

  customer_id?: number | null;
  customer_name?: string;
  customer_document?: string;
  customer_phone?: string;

  total_usd: number;
  total_ves: number;
  payment_method: string;
  created_at: string;

  cash_register_id?: number | null;
  exchange_rate?: number;

  status: string;
  source: string;

  order_type?: string;
  delivery_zone?: string;
  delivery_address?: string;

  items?: OrderItem[];
}

export default function AdminPedidosPage() {
  const [orders, setOrders] =
    useState<Order[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [processingId, setProcessingId] =
    useState<number | null>(null);

  // ============================================================
  // CARGAR PEDIDOS PENDIENTES
  // ============================================================

  const fetchOrders = async () => {
    try {
      setError('');

      const res = await fetch(
        '/api/admin/orders?status=pendiente',
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control':
              'no-cache'
          }
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.message ||
            'No se pudieron cargar los pedidos.'
        );
      }

      if (
        data?.success &&
        Array.isArray(data.orders)
      ) {
        setOrders(data.orders);
      } else {
        setOrders([]);
      }
    } catch (error: any) {
      console.error(
        'Error al cargar pedidos:',
        error
      );

      setOrders([]);

      setError(
        error?.message ||
          'Error al cargar los pedidos.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // CARGA AUTOMÁTICA
  // ============================================================

  useEffect(() => {
    fetchOrders();

    const interval =
      window.setInterval(
        fetchOrders,
        10000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, []);

  // ============================================================
  // ACTUALIZAR ESTADO
  // ============================================================

  const updateOrderStatus = async (
    id: number,
    newStatus:
      | 'aprobado'
      | 'cancelado'
  ) => {
    try {
      setProcessingId(id);

      const res = await fetch(
        '/api/admin/orders',
        {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/json',
            'Cache-Control':
              'no-cache'
          },
          body: JSON.stringify({
            id,
            status: newStatus
          })
        }
      );

      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(
          data?.message ||
            data?.error ||
            'Error al actualizar el pedido.'
        );
      }

      // El pedido ya no debe aparecer
      // en la lista de pendientes.
      setOrders(prev =>
        prev.filter(
          order => order.id !== id
        )
      );

      alert(
        newStatus === 'aprobado'
          ? `Pedido #${id} aprobado correctamente y enviado al POS.`
          : `Pedido #${id} cancelado correctamente.`
      );
    } catch (error: any) {
      console.error(
        'Error actualizando pedido:',
        error
      );

      alert(
        error?.message ||
          'Error al actualizar el pedido.'
      );
    } finally {
      setProcessingId(null);
    }
  };

  // ============================================================
  // FORMATO DE FECHA
  // ============================================================

  const formatDate = (
    value?: string
  ) => {
    if (!value) {
      return 'Fecha no disponible';
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return date.toLocaleString(
      'es-VE',
      {
        dateStyle: 'short',
        timeStyle: 'short'
      }
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="max-w-6xl mx-auto">

        {/* ====================================================
            HEADER
        ==================================================== */}

        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8 bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5">

          <div>
            <span className="bg-blue-50 text-blue-600 border border-blue-200 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              ⚡ Panel de Control
            </span>

            <h1 className="text-2xl font-bold text-slate-900 mt-2">
              Pedidos Web Pendientes
            </h1>

            <p className="text-xs text-slate-500 mt-1">
              Los pedidos realizados desde el menú web aparecen aquí para su revisión y aprobación.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">

            <button
              type="button"
              onClick={fetchOrders}
              disabled={loading}
              className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 border border-slate-200 px-4 py-2 rounded-xl text-xs font-semibold transition"
            >
              🔄 Actualizar
            </button>

            <Link
              href="/dashboard"
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition flex items-center"
            >
              📊 Ir al POS
            </Link>
          </div>
        </header>

        {/* ====================================================
            ERROR
        ==================================================== */}

        {error && (
          <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-4 text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        {/* ====================================================
            CONTADOR
        ==================================================== */}

        {!loading &&
          !error &&
          orders.length > 0 && (
            <div className="mb-5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex justify-between items-center">
              <span className="text-xs font-bold text-amber-800">
                🛎️ Pedidos pendientes
              </span>

              <span className="bg-amber-600 text-white px-3 py-1 rounded-full text-xs font-black">
                {orders.length}
              </span>
            </div>
          )}

        {/* ====================================================
            LOADING
        ==================================================== */}

        {loading ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-sm">
            <div className="text-3xl mb-3 animate-pulse">
              🛎️
            </div>

            <p className="text-sm font-semibold text-slate-500">
              Cargando pedidos en tiempo real...
            </p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-400 shadow-sm">
            <p className="text-4xl mb-3">
              ✨
            </p>

            <p className="text-sm font-semibold">
              No hay pedidos pendientes en este momento.
            </p>

            <p className="text-[11px] text-slate-400 mt-2">
              Esta pantalla se actualiza automáticamente cada 10 segundos.
            </p>
          </div>
        ) : (
          /* ==================================================
             LISTA DE PEDIDOS
          ================================================== */

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {orders.map(order => {

              const isProcessing =
                processingId ===
                order.id;

              return (
                <div
                  key={order.id}
                  className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm"
                >

                  {/* HEADER PEDIDO */}

                  <div className="flex justify-between items-start gap-3 mb-4">

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200 uppercase tracking-widest">
                          Pendiente
                        </span>

                        <span className="text-[10px] font-bold px-2 py-1 bg-blue-50 text-blue-700 rounded-lg">
                          WEB
                        </span>
                      </div>

                      <h2 className="text-lg font-black text-slate-900 mt-2">
                        Pedido #{order.id}
                      </h2>
                    </div>

                    <span className="text-[10px] font-medium text-slate-400 text-right">
                      {formatDate(
                        order.created_at
                      )}
                    </span>
                  </div>

                  {/* CLIENTE */}

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4">

                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                      Cliente
                    </div>

                    <div className="font-black text-slate-900 text-sm">
                      {order.customer_name ||
                        'Cliente sin nombre'}
                    </div>

                    {order.customer_phone && (
                      <div className="text-xs text-slate-600 mt-1">
                        📞{' '}
                        {
                          order.customer_phone
                        }
                      </div>
                    )}

                    {order.customer_document && (
                      <div className="text-xs text-slate-600 mt-1">
                        🪪{' '}
                        {
                          order.customer_document
                        }
                      </div>
                    )}
                  </div>

                  {/* TIPO DE PEDIDO */}

                  <div className="mb-4">

                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-2">
                      Servicio
                    </div>

                    <div className="flex flex-wrap gap-2">

                      <span className="bg-blue-50 text-blue-700 border border-blue-100 rounded-lg px-2.5 py-1 text-[11px] font-bold">
                        {order.order_type ||
                          'No especificado'}
                      </span>

                      {order.delivery_zone && (
                        <span className="bg-purple-50 text-purple-700 border border-purple-100 rounded-lg px-2.5 py-1 text-[11px] font-bold">
                          📍{' '}
                          {
                            order.delivery_zone
                          }
                        </span>
                      )}
                    </div>

                    {order.delivery_address && (
                      <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600">
                        🏠{' '}
                        {
                          order.delivery_address
                        }
                      </div>
                    )}
                  </div>

                  {/* PRODUCTOS */}

                  <div className="mb-4">

                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-2">
                      Productos
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden">

                      {order.items &&
                      order.items.length >
                        0 ? (
                        order.items.map(
                          (
                            item,
                            index
                          ) => (
                            <div
                              key={`${order.id}-${item.product_id}-${index}`}
                              className="flex justify-between items-center gap-3 px-3 py-2.5 border-b last:border-b-0 border-slate-100"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-800">
                                  {
                                    item.quantity
                                  }{' '}
                                  ×{' '}
                                  {
                                    item.name
                                  }
                                </div>

                                <div className="text-[10px] text-slate-400">
                                  $
                                  {Number(
                                    item.price_at_sale
                                  ).toFixed(
                                    2
                                  )}{' '}
                                  c/u
                                </div>
                              </div>

                              <div className="text-xs font-black text-slate-900 whitespace-nowrap">
                                $
                                {(
                                  Number(
                                    item.price_at_sale
                                  ) *
                                  Number(
                                    item.quantity
                                  )
                                ).toFixed(
                                  2
                                )}
                              </div>
                            </div>
                          )
                        )
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-400">
                          No hay productos asociados.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RESUMEN */}

                  <div className="border-t border-slate-100 pt-4 mb-4 space-y-2">

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">
                        Método de pago
                      </span>

                      <span className="text-xs font-bold text-slate-900">
                        {
                          order.payment_method
                        }
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">
                        Total USD
                      </span>

                      <span className="text-xl font-black text-slate-900">
                        $
                        {Number(
                          order.total_usd
                        ).toFixed(
                          2
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">
                        Total Bs.
                      </span>

                      <span className="text-sm font-bold text-blue-600">
                        Bs.{' '}
                        {Number(
                          order.total_ves
                        ).toFixed(
                          2
                        )}
                      </span>
                    </div>

                    {order.exchange_rate && (
                      <div className="text-right text-[10px] text-slate-400">
                        Tasa:{' '}
                        {Number(
                          order.exchange_rate
                        ).toFixed(
                          2
                        )}
                      </div>
                    )}
                  </div>

                  {/* ACCIONES */}

                  <div className="flex gap-2 pt-2">

                    <button
                      type="button"
                      disabled={
                        isProcessing
                      }
                      onClick={() =>
                        updateOrderStatus(
                          order.id,
                          'aprobado'
                        )
                      }
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-xs shadow-sm transition"
                    >
                      {isProcessing
                        ? 'Procesando...'
                        : '✓ Aprobar y enviar al POS'}
                    </button>

                    <button
                      type="button"
                      disabled={
                        isProcessing
                      }
                      onClick={() =>
                        updateOrderStatus(
                          order.id,
                          'cancelado'
                        )
                      }
                      className="flex-1 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed text-rose-700 border border-rose-200 py-3 rounded-xl font-bold text-xs transition"
                    >
                      ✕ Cancelar
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
