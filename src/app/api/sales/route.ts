
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

async function findOrCreateCustomer(
  db: any,
  customerName: string,
  customerPhone: string,
  customerDocument: string
): Promise<number | null> {
  const name = String(
    customerName || ''
  ).trim();

  const phone = String(
    customerPhone || ''
  ).trim();

  const document = String(
    customerDocument || ''
  ).trim();

  if (!name) {
    return null;
  }

  if (phone) {
    const byPhone = extractRows(
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

    if (byPhone.length > 0) {
      return Number(byPhone[0].id);
    }
  }

  if (document) {
    const byDocument = extractRows(
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

    if (byDocument.length > 0) {
      return Number(byDocument[0].id);
    }
  }

  const byName = extractRows(
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

  if (byName.length > 0) {
    return Number(byName[0].id);
  }

  const created = extractRows(
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

  if (created.length === 0) {
    throw new Error(
      'No se pudo crear el cliente.'
    );
  }

  return Number(created[0].id);
}

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const {
      items,
      total,
      totalUSD,
      totalBs,
      exchangeRate,
      paymentMethod,
      payments,
      changeUSD,
      userId,
      cashRegisterId,
      cash_register_id,
      customerName,
      customerPhone,
      customerDocument,
      webOrderId
    } = body;

    // Aceptar ambos nombres para mantener
    // compatibilidad con los consumidores de la API.
    const normalizedTotalUSD = Number(
      totalUSD ?? total ?? 0
    );

    const normalizedTotalBs = Number(
      totalBs ?? 0
    );

    const normalizedExchangeRate = Number(
      exchangeRate ?? 0
    );
    const normalizedChangeUSD = Math.max(0, Number(changeUSD) || 0);
    if (normalizedChangeUSD > 0 && paymentMethod !== 'Efectivo USD') {
      throw new Error('El vuelto registrado corresponde únicamente a pagos en efectivo USD.');
    }

    const allowedPaymentMethods = new Set([
      'Efectivo USD',
      'Efectivo Bs',
      'Pago Móvil',
      'Zelle',
      'Binance Pay',
      'Crédito / Fiado'
    ]);

    let normalizedPayments: Array<{
      method: string;
      currency: 'USD' | 'VES';
      amount: number;
      amountUSD: number;
    }> = [];

    if (Array.isArray(payments) && payments.length > 0) {
      normalizedPayments = payments.map((payment: any) => {
        const method = String(payment?.method || '').trim();
        const currency = String(payment?.currency || '').toUpperCase();
        const amount = Number(payment?.amount);

        if (!allowedPaymentMethods.has(method)) {
          throw new Error(`Método de pago no permitido: ${method || 'vacío'}.`);
        }
        if (currency !== 'USD' && currency !== 'VES') {
          throw new Error(`Moneda inválida para el método ${method}.`);
        }
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error(`El monto de ${method} debe ser mayor que cero.`);
        }

        const expectsVES = method === 'Efectivo Bs' || method === 'Pago Móvil';
        if ((expectsVES && currency !== 'VES') || (!expectsVES && currency !== 'USD')) {
          throw new Error(`La moneda no corresponde al método ${method}.`);
        }
        if (currency === 'VES' && normalizedExchangeRate <= 0) {
          throw new Error('La tasa de cambio debe ser mayor que cero para pagos en bolívares.');
        }

        return {
          method,
          currency: currency as 'USD' | 'VES',
          amount,
          amountUSD: currency === 'USD' ? amount : amount / normalizedExchangeRate
        };
      });

      const paymentTotalUSD = normalizedPayments.reduce(
        (sum, payment) => sum + payment.amountUSD,
        0
      );

      const netPaymentUSD = paymentTotalUSD - normalizedChangeUSD;
      if (Math.abs(netPaymentUSD - normalizedTotalUSD) > 0.03) {
        throw new Error(
          `Los pagos netos suman $${netPaymentUSD.toFixed(2)} y la venta total es $${normalizedTotalUSD.toFixed(2)}.`
        );
      }
    } else {
      const method = String(paymentMethod || '').trim();
      if (method === 'Pago mixto') {
        throw new Error('El pago mixto necesita registrar sus componentes.');
      }
      if (method) {
        const isVES = method === 'Efectivo Bs' || method === 'Pago Móvil';
        const amount = isVES ? normalizedTotalBs : normalizedTotalUSD;
        normalizedPayments = [{
          method,
          currency: isVES ? 'VES' : 'USD',
          amount,
          amountUSD: normalizedTotalUSD
        }];
      }
    }

    if (
      !Number.isFinite(normalizedTotalUSD) ||
      normalizedTotalUSD < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'El total en dólares no es válido.'
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(normalizedTotalBs) ||
      normalizedTotalBs < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'El total en bolívares no es válido.'
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(normalizedExchangeRate) ||
      normalizedExchangeRate < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'La tasa de cambio no es válida.'
        },
        { status: 400 }
      );
    }

    const parsedUserId = Number(userId);

    const parsedCashRegisterId = Number(
      cashRegisterId ?? cash_register_id
    );

    if (
      !Number.isInteger(parsedUserId) ||
      parsedUserId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Usuario no válido.'
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(parsedCashRegisterId) ||
      parsedCashRegisterId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'No se recibió una caja válida.'
        },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            'La venta debe contener al menos un producto.'
        },
        { status: 400 }
      );
    }

    // Crear la tabla de detalle de pagos si todavía no existe.
    // No modifica ni elimina los registros de ventas existentes.
    await runQuery(async db => {
      await sql(
        db,
        `
          CREATE TABLE IF NOT EXISTS sale_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            method TEXT NOT NULL,
            currency TEXT NOT NULL,
            amount REAL NOT NULL DEFAULT 0,
            amount_usd REAL NOT NULL DEFAULT 0,
            exchange_rate REAL NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `
      );
      await sql(
        db,
        `
          CREATE TABLE IF NOT EXISTS sale_cash_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            currency TEXT NOT NULL,
            movement_type TEXT NOT NULL,
            amount REAL NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `
      );
    });

    const result = await runQuery(
      async db => {
        // ==========================================
        // VERIFICAR CAJA ABIERTA
        // ==========================================

        const cashRows = extractRows(
          await sql(
            db,
            `
              SELECT
                id,
                user_id,
                status,
                closing_date
              FROM cash_registers
              WHERE id = ?
              LIMIT 1
            `,
            [parsedCashRegisterId]
          )
        );

        if (cashRows.length === 0) {
          throw new Error(
            `La caja indicada no existe. ID recibido: ${parsedCashRegisterId}`
          );
        }

        const cashRegister = cashRows[0];

        if (
          String(cashRegister.status) !== 'open'
        ) {
          throw new Error(
            'La caja no está abierta.'
          );
        }

        if (
          cashRegister.closing_date !== null &&
          cashRegister.closing_date !== undefined
        ) {
          throw new Error(
            'La caja ya fue cerrada.'
          );
        }

        if (
          Number(cashRegister.user_id) !==
          parsedUserId
        ) {
          throw new Error(
            'La caja abierta no pertenece al usuario actual.'
          );
        }

        const savePayments = async (saleId: number) => {
          for (const payment of normalizedPayments) {
            await sql(
              db,
              `
                INSERT INTO sale_payments (
                  sale_id,
                  method,
                  currency,
                  amount,
                  amount_usd,
                  exchange_rate,
                  created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `,
              [
                saleId,
                payment.method,
                payment.currency,
                payment.amount,
                payment.amountUSD,
                normalizedExchangeRate,
                new Date().toISOString()
              ]
            );
          }
        };

        // ==========================================
        // PEDIDO WEB
        // ==========================================

        const parsedWebOrderId = Number(webOrderId);

        if (
          Number.isInteger(parsedWebOrderId) &&
          parsedWebOrderId > 0
        ) {
          const webOrderRows = extractRows(
            await sql(
              db,
              `
                SELECT
                  id,
                  customer_id,
                  total_usd,
                  total_ves,
                  exchange_rate,
                  status,
                  source,
                  cash_register_id,
                  payment_method
                FROM sales
                WHERE
                  id = ?
                  AND source = 'web'
                  AND status = 'aprobado'
                  AND cash_register_id IS NULL
                LIMIT 1
              `,
              [parsedWebOrderId]
            )
          );

          if (webOrderRows.length === 0) {
            throw new Error(
              'El pedido web no existe, no está aprobado o ya fue facturado.'
            );
          }

          const webOrder = webOrderRows[0];

          const webItems = extractRows(
            await sql(
              db,
              `
                SELECT
                  si.product_id,
                  si.quantity,
                  si.price_at_sale,
                  p.name,
                  p.stock
                FROM sale_items si
                INNER JOIN products p
                  ON p.id = si.product_id
                WHERE si.sale_id = ?
                ORDER BY si.id ASC
              `,
              [parsedWebOrderId]
            )
          );

          if (webItems.length === 0) {
            throw new Error(
              'El pedido web no tiene productos asociados.'
            );
          }

          for (const item of webItems) {
            const quantity = Number(item.quantity);
            const stock = Number(item.stock);

            if (
              !Number.isFinite(quantity) ||
              quantity <= 0
            ) {
              throw new Error(
                `Cantidad inválida para el producto "${item.name}".`
              );
            }

            if (stock < quantity) {
              throw new Error(
                `Stock insuficiente para "${item.name}". Disponible: ${stock}.`
              );
            }
          }

          await sql(
            db,
            `
              UPDATE sales
              SET
                payment_method = ?,
                cash_register_id = ?,
                status = 'completada'
              WHERE
                id = ?
                AND source = 'web'
                AND status = 'aprobado'
                AND cash_register_id IS NULL
            `,
            [
              String(
                paymentMethod ||
                webOrder.payment_method ||
                ''
              ),
              parsedCashRegisterId,
              parsedWebOrderId
            ]
          );

          await savePayments(parsedWebOrderId);

          for (const item of webItems) {
            await sql(
              db,
              `
                UPDATE products
                SET stock = stock - ?
                WHERE id = ?
              `,
              [
                Number(item.quantity),
                Number(item.product_id)
              ]
            );
          }

          return {
            saleId: parsedWebOrderId,
            webOrderId: parsedWebOrderId,
            source: 'web',
            status: 'completada',

            totalUSD:
              Number(webOrder.total_usd) || 0,

            totalBs:
              Number(webOrder.total_ves) || 0,

            exchangeRate:
              Number(webOrder.exchange_rate) || 0,

            paymentMethod: String(
              paymentMethod ||
              webOrder.payment_method ||
              ''
            )
          };
        }

        // ==========================================
        // VENTA NORMAL POS
        // ==========================================

        const normalizedItems = items.map(
          (item: any) => ({
            productId: Number(
              item.id ?? item.product_id
            ),
            quantity: Number(item.quantity),
            price: Number(item.price),
            taxable: Boolean(item.taxable)
          })
        );

        const invalidItem = normalizedItems.find(
          item =>
            !Number.isInteger(item.productId) ||
            item.productId <= 0 ||
            !Number.isFinite(item.quantity) ||
            item.quantity <= 0 ||
            !Number.isFinite(item.price) ||
            item.price < 0
        );

        if (invalidItem) {
          throw new Error(
            'Uno o más productos de la venta no son válidos.'
          );
        }

        for (const item of normalizedItems) {
          const productRows = extractRows(
            await sql(
              db,
              `
                SELECT
                  id,
                  name,
                  stock
                FROM products
                WHERE id = ?
                LIMIT 1
              `,
              [item.productId]
            )
          );

          if (productRows.length === 0) {
            throw new Error(
              `El producto con ID ${item.productId} no existe.`
            );
          }

          const product = productRows[0];
          const stock = Number(product.stock);

          if (stock < item.quantity) {
            throw new Error(
              `Stock insuficiente para "${product.name}". Disponible: ${stock}.`
            );
          }
        }

        let customerId: number | null = null;

        if (
          String(customerName || '').trim() !== ''
        ) {
          customerId = await findOrCreateCustomer(
            db,
            String(customerName || ''),
            String(customerPhone || ''),
            String(customerDocument || '')
          );
        }

        const saleRows = extractRows(
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
                source
              )
              VALUES (
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                'completada',
                'pos'
              )
              RETURNING id
            `,
            [
              customerId,

              // CORRECCIÓN:
              // guardar el importe enviado como totalUSD
              // o, por compatibilidad, como total.
              normalizedTotalUSD,

              String(paymentMethod || ''),
              new Date().toISOString(),
              parsedCashRegisterId,
              normalizedTotalBs,
              normalizedExchangeRate
            ]
          )
        );

        if (saleRows.length === 0) {
          throw new Error(
            'No se pudo crear la venta.'
          );
        }

        const directSaleId = Number(
          saleRows[0].id
        );

        await savePayments(directSaleId);

        // En ventas cobradas en USD, el vuelto actual se entrega en Bs.
        // Guardarlo como salida de caja para que el arqueo no lo cuente como efectivo disponible.
        if (normalizedChangeUSD > 0 && normalizedExchangeRate > 0 && paymentMethod === 'Efectivo USD') {
          await sql(
            db,
            `INSERT INTO sale_cash_movements (sale_id, currency, movement_type, amount, created_at)
             VALUES (?, 'VES', 'vuelto', ?, ?)`,
            [directSaleId, normalizedChangeUSD * normalizedExchangeRate, new Date().toISOString()]
          );
        }

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
              directSaleId,
              item.productId,
              item.quantity,
              item.price
            ]
          );
        }

        for (const item of normalizedItems) {
          await sql(
            db,
            `
              UPDATE products
              SET stock = stock - ?
              WHERE id = ?
            `,
            [
              item.quantity,
              item.productId
            ]
          );
        }

        return {
          saleId: directSaleId,
          webOrderId: null,
          source: 'pos',
          status: 'completada',

          totalUSD: normalizedTotalUSD,
          totalBs: normalizedTotalBs,
          exchangeRate: normalizedExchangeRate,

          paymentMethod: String(
            paymentMethod || ''
          )
        };
      }
    );

    return NextResponse.json({
      success: true,
      saleId: result.saleId,
      webOrderId: result.webOrderId,
      source: result.source,
      status: result.status,
      totalUSD: result.totalUSD,
      totalBs: result.totalBs,
      exchangeRate: result.exchangeRate,
      paymentMethod: result.paymentMethod,

      message:
        result.source === 'web'
          ? 'Pedido web facturado correctamente.'
          : 'Venta registrada correctamente.'
    });
  } catch (error) {
    console.error(
      'POST /api/sales error:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Error interno al procesar la venta.'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const result = await runQuery(
      async db => {
        await sql(
          db,
          `
            CREATE TABLE IF NOT EXISTS sale_payments (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              sale_id INTEGER NOT NULL,
              method TEXT NOT NULL,
              currency TEXT NOT NULL,
              amount REAL NOT NULL DEFAULT 0,
              amount_usd REAL NOT NULL DEFAULT 0,
              exchange_rate REAL NOT NULL DEFAULT 0,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `
        );
        await sql(
          db,
          `CREATE TABLE IF NOT EXISTS sale_cash_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            currency TEXT NOT NULL,
            movement_type TEXT NOT NULL,
            amount REAL NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )`
        );

        return await sql(
          db,
          `
            SELECT
              s.id,
              s.customer_id,
              s.total_usd,
              s.total_ves,
              s.exchange_rate,
              s.payment_method,
              s.created_at,
              s.cash_register_id,
              s.status,
              s.source,

              c.name AS customer_name,
              c.rif_ci AS customer_document,
              c.phone AS customer_phone

            FROM sales s

            LEFT JOIN customers c
              ON c.id = s.customer_id

            WHERE
              s.source = 'pos'
              OR (
                s.source = 'web'
                AND s.status = 'completada'
              )

            ORDER BY
              s.id DESC
          `
        );
      }
    );

    const sales = extractRows(result);

    const paymentResult = await runQuery(async db => {
      return await sql(
        db,
        `
          SELECT
            sale_id,
            method,
            currency,
            amount,
            amount_usd,
            exchange_rate
          FROM sale_payments
          ORDER BY id ASC
        `
      );
    });

    const paymentRows = extractRows(paymentResult);
    const paymentsBySale = new Map<number, any[]>();

    for (const payment of paymentRows) {
      const saleId = Number(payment.sale_id);
      const current = paymentsBySale.get(saleId) || [];
      current.push(payment);
      paymentsBySale.set(saleId, current);
    }

    return NextResponse.json({
      success: true,
      sales: sales.map((sale: any) => ({
        ...sale,
        payments: paymentsBySale.get(Number(sale.id)) || []
      }))
    });
  } catch (error) {
    console.error(
      'GET /api/sales error:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Error al obtener las ventas.',
        sales: []
      },
      { status: 500 }
    );
  }
}
