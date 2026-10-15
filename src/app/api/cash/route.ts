import { NextResponse } from 'next/server';
import { runQuery } from '../../../db/client';

/**
 * ============================================================
 * UTILIDAD
 * ============================================================
 *
 * SQLite Cloud puede devolver directamente un array o un objeto
 * que contiene la propiedad rows.
 */
function getRows(result: any): any[] {
  if (Array.isArray(result)) {
    return result;
  }

  if (result?.rows && Array.isArray(result.rows)) {
    return result.rows;
  }

  return [];
}

/**
 * Construye el arqueo antes de cerrar la caja. Las ventas antiguas
 * que no tienen detalle en sale_payments se contabilizan usando payment_method.
 */
async function buildCashReport(db: any, register: any, countedUSD: number, countedBs: number) {
  await db.sql(`
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
  `);
  await db.sql(`
    CREATE TABLE IF NOT EXISTS sale_cash_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      currency TEXT NOT NULL,
      movement_type TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const salesResult = await db.sql(`
    SELECT id, total_usd, total_ves, exchange_rate, payment_method, created_at
    FROM sales
    WHERE cash_register_id = ?
      AND (status = 'completada' OR status IS NULL)
    ORDER BY id ASC
  `, Number(register.id));
  const sales = getRows(salesResult);
  const saleIds = sales.map((sale: any) => Number(sale.id)).filter((id: number) => id > 0);
  const paymentRows: any[] = [];

  if (saleIds.length > 0) {
    const paymentsResult = await db.sql(`
      SELECT sale_id, method, currency, amount, amount_usd, exchange_rate
      FROM sale_payments
      WHERE sale_id IN (${saleIds.map(() => '?').join(',')})
      ORDER BY id ASC
    `, ...saleIds);
    paymentRows.push(...getRows(paymentsResult));
  }

  const paymentsBySale = new Map<number, any[]>();
  for (const payment of paymentRows) {
    const id = Number(payment.sale_id);
    paymentsBySale.set(id, [...(paymentsBySale.get(id) || []), payment]);
  }

  let cashOutflowBs = 0;
  if (saleIds.length > 0) {
    const movementsResult = await db.sql(`
      SELECT currency, movement_type, amount
      FROM sale_cash_movements
      WHERE sale_id IN (${saleIds.map(() => '?').join(',')})
    `, ...saleIds);
    for (const movement of getRows(movementsResult)) {
      if (String(movement.currency).toUpperCase() === 'VES' && String(movement.movement_type) === 'vuelto') {
        cashOutflowBs += Number(movement.amount) || 0;
      }
    }
  }

  const methods = new Map<string, { method: string; amountUSD: number; amountVES: number; totalUSD: number; transactions: number }>();
  let cashSalesUSD = 0;
  let cashSalesVES = 0;
  let electronicTotalUSD = 0;
  let creditTotalUSD = 0;
  let totalSalesUSD = 0;
  let totalSalesVES = 0;

  const addPayment = (method: string, currency: string, amount: number, amountUSD: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const key = method || 'Sin método';
    const item = methods.get(key) || { method: key, amountUSD: 0, amountVES: 0, totalUSD: 0, transactions: 0 };
    if (currency === 'VES') item.amountVES += amount;
    else item.amountUSD += amount;
    item.totalUSD += amountUSD;
    item.transactions += 1;
    methods.set(key, item);

    if (method === 'Efectivo USD') cashSalesUSD += currency === 'USD' ? amount : 0;
    if (method === 'Efectivo Bs') cashSalesVES += currency === 'VES' ? amount : 0;
    if (['Pago Móvil', 'Zelle', 'Binance Pay'].includes(method)) electronicTotalUSD += amountUSD;
    if (method === 'Crédito / Fiado') creditTotalUSD += amountUSD;
  };

  for (const sale of sales) {
    const saleUSD = Number(sale.total_usd) || 0;
    const saleVES = Number(sale.total_ves) || 0;
    totalSalesUSD += saleUSD;
    totalSalesVES += saleVES;
    const details = paymentsBySale.get(Number(sale.id)) || [];

    if (details.length > 0) {
      for (const payment of details) {
        addPayment(
          String(payment.method || ''),
          String(payment.currency || 'USD').toUpperCase(),
          Number(payment.amount) || 0,
          Number(payment.amount_usd) || 0
        );
      }
      continue;
    }

    // Compatibilidad con ventas anteriores a los pagos mixtos.
    const method = String(sale.payment_method || '');
    const rate = Number(sale.exchange_rate) || 0;
    if (method === 'Efectivo Bs' || method === 'Pago Móvil') {
      const amount = saleVES || (rate > 0 ? saleUSD * rate : 0);
      addPayment(method, 'VES', amount, saleUSD || (rate > 0 ? amount / rate : 0));
    } else if (method === 'Efectivo USD' || method === 'Zelle' || method === 'Binance Pay' || method === 'Crédito / Fiado') {
      addPayment(method, 'USD', saleUSD, saleUSD);
    } else if (method) {
      addPayment(method, 'USD', saleUSD, saleUSD);
    }
  }

  const openingUSD = Number(register.opening_usd) || 0;
  const openingBs = Number(register.opening_ves) || 0;
  const expectedUSD = openingUSD + cashSalesUSD;
  const expectedBs = openingBs + cashSalesVES - cashOutflowBs;

  return {
    registerId: Number(register.id),
    userId: Number(register.user_id),
    userName: register.user_name || '',
    userEmail: register.user_email || '',
    openingDate: register.opening_date,
    closingDate: new Date().toISOString(),
    openingUSD,
    openingBs,
    salesCount: sales.length,
    totalSalesUSD,
    totalSalesVES,
    cashSalesUSD,
    cashSalesBs: cashSalesVES,
    cashOutflowBs,
    electronicTotalUSD,
    creditTotalUSD,
    expectedUSD,
    expectedBs,
    countedUSD,
    countedBs,
    differenceUSD: countedUSD - expectedUSD,
    differenceBs: countedBs - expectedBs,
    paymentBreakdown: Array.from(methods.values()).map(item => ({
      ...item,
      amountUSD: Number(item.amountUSD.toFixed(2)),
      amountVES: Number(item.amountVES.toFixed(2)),
      totalUSD: Number(item.totalUSD.toFixed(2))
    }))
  };
}

/**
 * ============================================================
 * GET /api/cash
 * ============================================================
 *
 * Consulta la caja abierta.
 *
 * Ejemplo:
 *
 * /api/cash?userId=2
 *
 * Si se proporciona userId:
 *   Busca la caja abierta de ese usuario.
 *
 * Si no se proporciona userId:
 *   Busca la última caja abierta del sistema.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const userIdParam = url.searchParams.get('userId');

    let userId: number | null = null;

    // ----------------------------------------------------------
    // VALIDAR userId
    // ----------------------------------------------------------

    if (userIdParam !== null) {
      const parsedUserId = Number(userIdParam);

      if (
        !Number.isInteger(parsedUserId) ||
        parsedUserId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error: 'userId inválido.',
          },
          { status: 400 }
        );
      }

      userId = parsedUserId;
    }

    // ----------------------------------------------------------
    // CONSULTAR CAJA
    // ----------------------------------------------------------

    const result = await runQuery(async (db) => {

      // --------------------------------------------------------
      // BUSCAR CAJA DEL USUARIO
      // --------------------------------------------------------

      if (userId !== null) {
        return await db.sql(
          `
          SELECT
            cr.id,
            cr.user_id,
            cr.opening_date,
            cr.closing_date,
            cr.opening_usd,
            cr.opening_ves,
            cr.closing_usd,
            cr.closing_ves,
            cr.status,
            u.name AS user_name,
            u.email AS user_email
          FROM cash_registers cr
          LEFT JOIN users u
            ON u.id = cr.user_id
          WHERE cr.user_id = ?
            AND cr.status = 'open'
            AND cr.closing_date IS NULL
          ORDER BY cr.id DESC
          LIMIT 1;
          `,
          userId
        );
      }

      // --------------------------------------------------------
      // BUSCAR CUALQUIER CAJA ABIERTA
      // --------------------------------------------------------

      return await db.sql(`
        SELECT
          cr.id,
          cr.user_id,
          cr.opening_date,
          cr.closing_date,
          cr.opening_usd,
          cr.opening_ves,
          cr.closing_usd,
          cr.closing_ves,
          cr.status,
          u.name AS user_name,
          u.email AS user_email
        FROM cash_registers cr
        LEFT JOIN users u
          ON u.id = cr.user_id
        WHERE cr.status = 'open'
          AND cr.closing_date IS NULL
        ORDER BY cr.id DESC
        LIMIT 1;
      `);
    });

    const rows = getRows(result);

    const openRegister =
      rows.length > 0
        ? rows[0]
        : null;

    return NextResponse.json({
      success: true,
      isOpen: !!openRegister,
      register: openRegister,
      rows,
    });

  } catch (error: any) {

    console.error('====================================');
    console.error('ERROR GET /api/cash');
    console.error(error);
    console.error('====================================');

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Error consultando las cajas.',
      },
      { status: 500 }
    );
  }
}


/**
 * ============================================================
 * POST /api/cash
 * ============================================================
 *
 * Acciones disponibles:
 *
 * action = "open"
 * action = "close"
 */
export async function POST(request: Request) {

  try {

    const body = await request.json();

    const {
      action,
      openingUSD,
      openingBs,
      countedUSD,
      countedBs,
      userId,
      registerId,
    } = body;

    // ========================================================
    // VALIDAR USER ID
    // ========================================================

    const cleanUserId = Number(userId);

    if (
      !Number.isInteger(cleanUserId) ||
      cleanUserId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'userId es obligatorio y debe ser válido.',
        },
        { status: 400 }
      );
    }

    // ========================================================
    // VERIFICAR QUE EL USUARIO EXISTE
    // ========================================================

    const userResult = await runQuery(async (db) => {
      return await db.sql(
        `
        SELECT
          id,
          name,
          email
        FROM users
        WHERE id = ?
        LIMIT 1;
        `,
        cleanUserId
      );
    });

    const userRows = getRows(userResult);

    if (userRows.length === 0) {

      return NextResponse.json(
        {
          success: false,
          error:
            'El usuario indicado no existe.',
        },
        { status: 404 }
      );
    }

    // ========================================================
    // ABRIR CAJA
    // ========================================================

    if (action === 'open') {

      const usd =
        Number(openingUSD) || 0;

      const ves =
        Number(openingBs) || 0;

      // ------------------------------------------------------
      // VALIDAR MONTOS
      // ------------------------------------------------------

      if (usd < 0 || ves < 0) {

        return NextResponse.json(
          {
            success: false,
            error:
              'Los montos de apertura no pueden ser negativos.',
          },
          { status: 400 }
        );
      }

      // ------------------------------------------------------
      // COMPROBAR SI EL USUARIO YA TIENE UNA CAJA ABIERTA
      // ------------------------------------------------------

      const existingResult = await runQuery(async (db) => {

        return await db.sql(
          `
          SELECT
            id,
            user_id,
            opening_date,
            opening_usd,
            opening_ves,
            status
          FROM cash_registers
          WHERE user_id = ?
            AND status = 'open'
            AND closing_date IS NULL
          ORDER BY id DESC
          LIMIT 1;
          `,
          cleanUserId
        );

      });

      const existingRows =
        getRows(existingResult);

      // ------------------------------------------------------
      // YA EXISTE UNA CAJA ABIERTA
      // ------------------------------------------------------

      if (existingRows.length > 0) {

        return NextResponse.json({
          success: true,
          alreadyOpen: true,
          message:
            'Este usuario ya tiene una caja abierta.',
          registerId:
            existingRows[0].id,
          register:
            existingRows[0],
        });
      }

      // ------------------------------------------------------
      // CREAR NUEVA CAJA
      // ------------------------------------------------------

      await runQuery(async (db) => {

        return await db.sql(
          `
          INSERT INTO cash_registers
          (
            user_id,
            opening_date,
            opening_usd,
            opening_ves,
            status
          )
          VALUES
          (
            ?,
            CURRENT_TIMESTAMP,
            ?,
            ?,
            'open'
          );
          `,
          cleanUserId,
          usd,
          ves
        );

      });

      // ------------------------------------------------------
      // RECUPERAR CAJA RECIÉN CREADA
      // ------------------------------------------------------

      const newRegisterResult =
        await runQuery(async (db) => {

          return await db.sql(
            `
            SELECT
              cr.id,
              cr.user_id,
              cr.opening_date,
              cr.closing_date,
              cr.opening_usd,
              cr.opening_ves,
              cr.closing_usd,
              cr.closing_ves,
              cr.status,
              u.name AS user_name,
              u.email AS user_email
            FROM cash_registers cr
            LEFT JOIN users u
              ON u.id = cr.user_id
            WHERE cr.user_id = ?
              AND cr.status = 'open'
              AND cr.closing_date IS NULL
            ORDER BY cr.id DESC
            LIMIT 1;
            `,
            cleanUserId
          );

        });

      const newRows =
        getRows(newRegisterResult);

      // ------------------------------------------------------
      // VERIFICAR INSERT
      // ------------------------------------------------------

      if (newRows.length === 0) {

        return NextResponse.json(
          {
            success: false,
            error:
              'La caja fue insertada, pero no pudo ser recuperada.',
          },
          { status: 500 }
        );
      }

      const register =
        newRows[0];

      // ------------------------------------------------------
      // RESPUESTA
      // ------------------------------------------------------

      return NextResponse.json({
        success: true,
        alreadyOpen: false,
        message:
          'Caja abierta exitosamente.',
        registerId:
          register.id,
        register,
      });
    }

    // ========================================================
    // CERRAR CAJA
    // ========================================================

    if (action === 'close') {

      const cleanRegisterId =
        Number(registerId);

      // ------------------------------------------------------
      // VALIDAR ID DE CAJA
      // ------------------------------------------------------

      if (
        !Number.isInteger(cleanRegisterId) ||
        cleanRegisterId <= 0
      ) {

        return NextResponse.json(
          {
            success: false,
            error:
              'ID de caja inválido.',
          },
          { status: 400 }
        );
      }

      const finalUSD =
        Number(countedUSD) || 0;

      const finalVES =
        Number(countedBs) || 0;

      // ------------------------------------------------------
      // VALIDAR MONTOS
      // ------------------------------------------------------

      if (
        finalUSD < 0 ||
        finalVES < 0
      ) {

        return NextResponse.json(
          {
            success: false,
            error:
              'Los montos de cierre no pueden ser negativos.',
          },
          { status: 400 }
        );
      }

      // ------------------------------------------------------
      // BUSCAR CAJA
      // ------------------------------------------------------

      const registerResult =
        await runQuery(async (db) => {

          return await db.sql(
            `
            SELECT
              id,
              user_id,
              opening_date,
              opening_usd,
              opening_ves,
              status
            FROM cash_registers
            WHERE id = ?
              AND user_id = ?
              AND status = 'open'
              AND closing_date IS NULL
            LIMIT 1;
            `,
            cleanRegisterId,
            cleanUserId
          );

        });

      const registerRows =
        getRows(registerResult);

      // ------------------------------------------------------
      // CAJA NO ENCONTRADA
      // ------------------------------------------------------

      if (registerRows.length === 0) {

        return NextResponse.json(
          {
            success: false,
            error:
              'La caja no existe, ya está cerrada o no pertenece al usuario.',
          },
          { status: 404 }
        );
      }

      // ------------------------------------------------------
      // CALCULAR ARQUEO ANTES DE CERRAR
      // ------------------------------------------------------

      const report = await runQuery(async (db) => {
        const fullRegisterResult = await db.sql(
          `SELECT cr.*, u.name AS user_name, u.email AS user_email
           FROM cash_registers cr
           LEFT JOIN users u ON u.id = cr.user_id
           WHERE cr.id = ? LIMIT 1`,
          cleanRegisterId
        );
        const fullRegisterRows = getRows(fullRegisterResult);
        if (fullRegisterRows.length === 0) {
          throw new Error('No se pudo recuperar la caja para generar el arqueo.');
        }
        return await buildCashReport(db, fullRegisterRows[0], finalUSD, finalVES);
      });

      // ------------------------------------------------------
      // CERRAR CAJA
      // ------------------------------------------------------

      await runQuery(async (db) => {

        return await db.sql(
          `
          UPDATE cash_registers
          SET
            closing_usd = ?,
            closing_ves = ?,
            closing_date = CURRENT_TIMESTAMP,
            status = 'closed'
          WHERE id = ?
            AND user_id = ?
            AND status = 'open'
            AND closing_date IS NULL;
          `,
          finalUSD,
          finalVES,
          cleanRegisterId,
          cleanUserId
        );

      });

      // ------------------------------------------------------
      // VERIFICAR CIERRE
      // ------------------------------------------------------

      const closedResult =
        await runQuery(async (db) => {

          return await db.sql(
            `
            SELECT
              cr.id,
              cr.user_id,
              cr.opening_date,
              cr.closing_date,
              cr.opening_usd,
              cr.opening_ves,
              cr.closing_usd,
              cr.closing_ves,
              cr.status,
              u.name AS user_name,
              u.email AS user_email
            FROM cash_registers cr
            LEFT JOIN users u
              ON u.id = cr.user_id
            WHERE cr.id = ?
            LIMIT 1;
            `,
            cleanRegisterId
          );

        });

      const closedRows =
        getRows(closedResult);

      // ------------------------------------------------------
      // RESPUESTA FINAL
      // ------------------------------------------------------

      return NextResponse.json({
        success: true,
        message:
          'Caja cerrada exitosamente.',
        register:
          closedRows.length > 0
            ? closedRows[0]
            : null,
        report,
      });
    }

    // ========================================================
    // ACCIÓN NO VÁLIDA
    // ========================================================

    return NextResponse.json(
      {
        success: false,
        error:
          'Acción no válida.',
      },
      { status: 400 }
    );

  } catch (error: any) {

    console.error(
      '===================================='
    );

    console.error(
      'ERROR POST /api/cash'
    );

    console.error(error);

    console.error(
      '===================================='
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Error procesando la caja.',
      },
      { status: 500 }
    );
  }
}
