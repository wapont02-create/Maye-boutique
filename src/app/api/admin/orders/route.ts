import { NextResponse } from 'next/server';
import { runQuery } from '@/db/client';

export const dynamic = 'force-dynamic';

async function sql(
  db: any,
  query: string,
  params: any[] = []
) {
  return params.length > 0
    ? await db.sql(query, ...params)
    : await db.sql(query);
}

function extractRows(result: any): any[] {
  if (Array.isArray(result)) {
    return result;
  }

  if (
    result?.rows &&
    Array.isArray(result.rows)
  ) {
    return result.rows;
  }

  return [];
}

// ============================================================
// GET PEDIDOS WEB
// ============================================================

export async function GET(
  request: Request
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const requestedStatus =
      searchParams.get('status') ||
      'pendiente';

    const status =
      requestedStatus === 'aprobado'
        ? 'aprobado'
        : 'pendiente';

    const result =
      await runQuery(
        async db => {
          /*
           * IMPORTANTE:
           * Buscamos por source y status.
           * No dependemos de IS NULL para encontrar
           * los pedidos web.
           */

          return await sql(
            db,
            `
              SELECT
                s.id,
                s.customer_id,
                s.total_usd,
                s.total_ves,
                s.payment_method,
                s.created_at,
                s.cash_register_id,
                s.exchange_rate,
                s.status,
                s.source,
                s.order_type,
                s.delivery_zone,
                s.delivery_address,

                c.name AS customer_name,
                c.rif_ci AS customer_document,
                c.phone AS customer_phone,

                si.product_id,
                si.quantity,
                si.price_at_sale,

                p.name AS product_name,
                p.taxable,
                p.stock AS current_stock

              FROM sales s

              LEFT JOIN customers c
                ON c.id = s.customer_id

              LEFT JOIN sale_items si
                ON si.sale_id = s.id

              LEFT JOIN products p
                ON p.id = si.product_id

              WHERE
                s.source = 'web'
                AND s.status = ?

              ORDER BY
                s.id DESC,
                si.id ASC
            `,
            [status]
          );
        }
      );

    const rows =
      extractRows(result);

    const ordersMap =
      new Map<number, any>();

    for (const row of rows) {
      const orderId =
        Number(row.id);

      /*
       * Para pedidos pendientes:
       * deben seguir sin caja.
       *
       * Si por alguna razón existe un registro
       * web ya asociado a una caja, no lo mostramos
       * como pendiente.
       */

      const cashRegisterId =
        row.cash_register_id !== null &&
        row.cash_register_id !==
          undefined
          ? Number(
              row.cash_register_id
            )
          : null;

      if (
        status === 'pendiente' &&
        cashRegisterId !==
          null &&
        cashRegisterId > 0
      ) {
        continue;
      }

      if (
        status === 'aprobado' &&
        cashRegisterId !==
          null &&
        cashRegisterId > 0
      ) {
        continue;
      }

      if (
        !ordersMap.has(
          orderId
        )
      ) {
        ordersMap.set(
          orderId,
          {
            id: orderId,

            customer_id:
              row.customer_id !==
              null
                ? Number(
                    row.customer_id
                  )
                : null,

            customer_name:
              row.customer_name ||
              '',

            customer_document:
              row.customer_document ||
              '',

            customer_phone:
              row.customer_phone ||
              '',

            total_usd:
              Number(
                row.total_usd
              ) || 0,

            total_ves:
              Number(
                row.total_ves
              ) || 0,

            payment_method:
              row.payment_method ||
              '',

            created_at:
              row.created_at ||
              null,

            cash_register_id:
              cashRegisterId,

            exchange_rate:
              Number(
                row.exchange_rate
              ) || 0,

            status:
              String(
                row.status || ''
              ),

            source:
              String(
                row.source || ''
              ),

            order_type:
              row.order_type ||
              '',

            delivery_zone:
              row.delivery_zone ||
              '',

            delivery_address:
              row.delivery_address ||
              '',

            items: []
          }
        );
      }

      if (
        row.product_id !==
          null &&
        row.product_id !==
          undefined
      ) {
        ordersMap
          .get(orderId)
          .items.push({
            product_id:
              Number(
                row.product_id
              ),

            name:
              row.product_name ||
              'Producto',

            quantity:
              Number(
                row.quantity
              ) || 0,

            price_at_sale:
              Number(
                row.price_at_sale
              ) || 0,

            taxable:
              Boolean(
                row.taxable
              ),

            current_stock:
              Number(
                row.current_stock
              ) || 0
          });
      }
    }

    const orders =
      Array.from(
        ordersMap.values()
      );

    console.log(
      `[ADMIN ORDERS] status=${status} rows=${rows.length} orders=${orders.length}`
    );

    return NextResponse.json(
      {
        success: true,
        orders,
        status
      },
      {
        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache'
        }
      }
    );
  } catch (error) {
    console.error(
      'GET /api/admin/orders error:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Error al obtener los pedidos.',
        orders: []
      },
      { status: 500 }
    );
  }
}

// ============================================================
// ACTUALIZAR ESTADO
// ============================================================

export async function PUT(
  request: Request
) {
  try {
    const body =
      await request.json();

    const id =
      Number(body.id);

    const status =
      String(
        body.status || ''
      ).trim();

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            'El ID del pedido no es válido.'
        },
        { status: 400 }
      );
    }

    if (
      ![
        'aprobado',
        'cancelado'
      ].includes(status)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            'El estado debe ser aprobado o cancelado.'
        },
        { status: 400 }
      );
    }

    const result =
      await runQuery(
        async db => {
          const existing =
            extractRows(
              await sql(
                db,
                `
                  SELECT
                    id,
                    status,
                    source,
                    cash_register_id
                  FROM sales
                  WHERE id = ?
                  LIMIT 1
                `,
                [id]
              )
            );

          if (
            existing.length ===
            0
          ) {
            throw new Error(
              'Pedido no encontrado.'
            );
          }

          const order =
            existing[0];

          if (
            String(
              order.source || ''
            ) !== 'web'
          ) {
            throw new Error(
              'El registro indicado no corresponde a un pedido web.'
            );
          }

          const currentStatus =
            String(
              order.status || ''
            );

          if (
            currentStatus !==
              'pendiente' &&
            currentStatus !==
              'aprobado'
          ) {
            throw new Error(
              `El pedido no puede cambiarse desde el estado "${currentStatus}".`
            );
          }

          await sql(
            db,
            `
              UPDATE sales
              SET status = ?
              WHERE id = ?
            `,
            [
              status,
              id
            ]
          );

          return {
            id,
            status
          };
        }
      );

    return NextResponse.json({
      success: true,
      id: result.id,
      status: result.status,
      message:
        result.status ===
        'aprobado'
          ? 'Pedido aprobado y enviado al POS.'
          : 'Pedido cancelado correctamente.'
    });
  } catch (error) {
    console.error(
      'PUT /api/admin/orders error:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Error al actualizar el pedido.'
      },
      { status: 500 }
    );
  }
}
