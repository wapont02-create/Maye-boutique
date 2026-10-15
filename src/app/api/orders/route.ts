import { NextResponse } from 'next/server';
import { runQuery } from '@/db/client';

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

  if (result?.rows && Array.isArray(result.rows)) {
    return result.rows;
  }

  return [];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      customerName,
      customerPhone,
      customerDocument,
      orderType,
      deliveryZone,
      deliveryAddress,
      items,
      total,
      totalBs,
      exchangeRate,
      paymentMethod,
      created_at
    } = body;

    if (!customerName || !String(customerName).trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'El nombre del cliente es obligatorio.'
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            'El pedido debe contener al menos un producto.'
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(Number(total)) || Number(total) < 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'El total del pedido no es válido.'
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(Number(totalBs)) || Number(totalBs) < 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'El total en Bs no es válido.'
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(Number(exchangeRate)) ||
      Number(exchangeRate) <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'La tasa de cambio no es válida.'
        },
        { status: 400 }
      );
    }

    const normalizedItems = items.map((item: any) => ({
      product_id: Number(
        item.id ?? item.product_id
      ),
      name: String(item.name ?? ''),
      quantity: Number(item.quantity),
      price: Number(item.price)
    }));

    const invalidItem = normalizedItems.find(
      item =>
        !Number.isInteger(item.product_id) ||
        item.product_id <= 0 ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.price) ||
        item.price < 0
    );

    if (invalidItem) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Uno o más productos del pedido no son válidos.'
        },
        { status: 400 }
      );
    }

    const result = await runQuery(async (db) => {
      let customerId: number | null = null;

      const phone = String(
        customerPhone ?? ''
      ).trim();

      const name = String(
        customerName ?? ''
      ).trim();

      const document = String(
        customerDocument ?? ''
      ).trim();

      // Buscar por teléfono
      if (phone) {
        const existingByPhone = extractRows(
          await sql(
            db,
            `
              SELECT id
              FROM customers
              WHERE phone = ?
              LIMIT 1
            `,
            [phone]
          )
        );

        if (existingByPhone.length > 0) {
          customerId = Number(
            existingByPhone[0].id
          );
        }
      }

      // Buscar por documento
      if (!customerId && document) {
        const existingByDocument = extractRows(
          await sql(
            db,
            `
              SELECT id
              FROM customers
              WHERE rif_ci = ?
              LIMIT 1
            `,
            [document]
          )
        );

        if (existingByDocument.length > 0) {
          customerId = Number(
            existingByDocument[0].id
          );
        }
      }

      // Buscar por nombre
      if (!customerId) {
        const existingByName = extractRows(
          await sql(
            db,
            `
              SELECT id
              FROM customers
              WHERE name = ?
              LIMIT 1
            `,
            [name]
          )
        );

        if (existingByName.length > 0) {
          customerId = Number(
            existingByName[0].id
          );
        }
      }

      // Crear cliente
      if (!customerId) {
        const customerResult = extractRows(
          await sql(
            db,
            `
              INSERT INTO customers (
                name,
                rif_ci,
                phone
              )
              VALUES (?, ?, ?)
              RETURNING id
            `,
            [
              name,
              document || null,
              phone || null
            ]
          )
        );

        if (customerResult.length === 0) {
          throw new Error(
            'No se pudo crear el cliente.'
          );
        }

        customerId = Number(
          customerResult[0].id
        );
      }

      // Crear pedido web
      const saleResult = extractRows(
        await sql(
          db,
          `
            INSERT INTO sales (
              customer_id,
              total_usd,
              payment_method,
              created_at,
              cash_register_id,
              total_ves,
              exchange_rate,
              status,
              source,
              order_type,
              delivery_zone,
              delivery_address
            )
            VALUES (
              ?,
              ?,
              ?,
              ?,
              NULL,
              ?,
              ?,
              'pendiente',
              'web',
              ?,
              ?,
              ?
            )
            RETURNING id
          `,
          [
            customerId,
            Number(total),
            String(paymentMethod ?? ''),
            created_at
              ? String(created_at)
              : new Date().toISOString(),
            Number(totalBs),
            Number(exchangeRate),
            String(
              orderType ??
                'Local / Mesa'
            ),
            String(
              deliveryZone ?? ''
            ),
            String(
              deliveryAddress ?? ''
            )
          ]
        )
      );

      if (saleResult.length === 0) {
        throw new Error(
          'No se pudo crear el pedido web.'
        );
      }

      const saleId = Number(
        saleResult[0].id
      );

      // Guardar productos del pedido
      for (const item of normalizedItems) {
        await sql(
          db,
          `
            INSERT INTO sale_items (
              sale_id,
              product_id,
              quantity,
              price_at_sale
            )
            VALUES (?, ?, ?, ?)
          `,
          [
            saleId,
            item.product_id,
            item.quantity,
            item.price
          ]
        );
      }

      return {
        saleId,
        customerId
      };
    });

    return NextResponse.json({
      success: true,
      orderId: result.saleId,
      saleId: result.saleId,
      customerId: result.customerId,
      status: 'pendiente',
      message:
        'Pedido recibido correctamente y enviado a revisión.'
    });
  } catch (error) {
    console.error(
      'POST /api/orders error:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Error interno al procesar el pedido.'
      },
      { status: 500 }
    );
  }
}
