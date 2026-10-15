import { NextResponse } from 'next/server';
import { runQuery } from '../../../db/client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q'); // Captura el parámetro de búsqueda

    const result = await runQuery(async (db) => {
      if (q) {
        // Búsqueda filtrada (más rápida y relevante para el POS)
        return await db.sql(`SELECT * FROM customers WHERE name LIKE '%${q}%' OR rif_ci LIKE '%${q}%' ORDER BY id DESC LIMIT 10`);
      }
      // Si no hay búsqueda, trae los últimos 20
      return await db.sql("SELECT * FROM customers ORDER BY id DESC LIMIT 20");
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error al obtener clientes:", error);
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, rif_ci, phone } = body;

    if (!name) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    // Escapamos un poco los valores simples para evitar errores de sintaxis SQL
    const safeName = name.replace(/'/g, "''");
    const safeRif = (rif_ci || '').replace(/'/g, "''");

    await runQuery(async (db) => {
      return await db.sql(`INSERT INTO customers (name, rif_ci, phone) VALUES ('${safeName}', '${safeRif}', '${phone || ''}')`);
    });

    return NextResponse.json({ success: true, message: 'Cliente registrado con éxito' });
  } catch (error) {
    console.error("Error al registrar cliente:", error);
    return NextResponse.json({ error: 'Error al registrar el cliente' }, { status: 500 });
  }
}
