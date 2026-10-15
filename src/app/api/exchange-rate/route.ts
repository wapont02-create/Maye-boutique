import { NextResponse } from 'next/server';
import { runQuery } from '../../../db/client';

export const dynamic = 'force-dynamic';

/**
 * GET
 * Obtiene la última tasa registrada en SQLite Cloud.
 */
export async function GET() {
  try {
    const result = await runQuery(async (db) => {
      return await db.sql(`
        SELECT
          id,
          rate,
          source,
          effective_date,
          updated_at,
          updated_by
        FROM exchange_rates
        ORDER BY id DESC
        LIMIT 1
      `);
    });

    const rows = Array.isArray(result) ? result : [];

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        rate: null,
        source: null,
        message: 'No hay una tasa registrada todavía.'
      });
    }

    const row = rows[0];

    return NextResponse.json({
      success: true,
      rate: Number(row.rate),
      source: String(row.source || 'manual'),
      effectiveDate: row.effective_date || null,
      updatedAt: row.updated_at || null,
      updatedBy: row.updated_by
        ? Number(row.updated_by)
        : null
    });
  } catch (error) {
    console.error(
      'Error obteniendo tasa de cambio:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: 'No se pudo obtener la tasa de cambio.'
      },
      { status: 500 }
    );
  }
}

/**
 * POST
 * Actualiza manualmente la tasa.
 */
export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const rate = Number(body?.rate);
    const userId = body?.userId
      ? Number(body.userId)
      : null;

    if (
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'La tasa indicada no es válida.'
        },
        { status: 400 }
      );
    }

    const effectiveDate =
      body?.effectiveDate ||
      new Date().toISOString();

    const result = await runQuery(async (db) => {
      return await db.sql(`
        INSERT INTO exchange_rates (
          rate,
          source,
          effective_date,
          updated_at,
          updated_by
        )
        VALUES (
          ${rate},
          'manual',
          '${String(effectiveDate).replace(/'/g, "''")}',
          CURRENT_TIMESTAMP,
          ${userId && Number.isInteger(userId) && userId > 0
            ? userId
            : 'NULL'}
        )
      `);
    });

    return NextResponse.json({
      success: true,
      message: 'Tasa actualizada correctamente.',
      rate,
      source: 'manual',
      effectiveDate,
      result
    });
  } catch (error) {
    console.error(
      'Error actualizando tasa de cambio:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: 'No se pudo actualizar la tasa de cambio.'
      },
      { status: 500 }
    );
  }
}
