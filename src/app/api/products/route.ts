
import { NextResponse } from 'next/server';
import { runQuery } from '../../../db/client';

async function ensureActiveColumn(db: any) {
  const columns = await db.sql('PRAGMA table_info(products)');

  const hasActive =
    Array.isArray(columns) &&
    columns.some((column: any) => column.name === 'active');

  if (!hasActive) {
    await db.sql(`
      ALTER TABLE products
      ADD COLUMN active INTEGER NOT NULL DEFAULT 1
    `);
  }
}

export async function GET() {
  try {
    const products = await runQuery(async (db) => {
      await ensureActiveColumn(db);

      return await db.sql(`
        SELECT
          p.id,
          p.name,
          p.barcode,
          p.price_usd,
          p.stock,
          p.taxable,
          p.category,
          p.cost_price,
          p.image_url,
          p.description,
          p.active,
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM sale_items si
              WHERE si.product_id = p.id
            )
            THEN 1
            ELSE 0
          END AS has_sales
        FROM products p
        ORDER BY p.id DESC
      `);
    });

    const formattedProducts = Array.isArray(products)
      ? products.map((p: any) => ({
          id: Number(p.id),
          name: p.name,
          barcode: p.barcode || '',
          price: Number(p.price_usd || 0),
          stock: Number(p.stock || 0),
          taxable:
            p.taxable !== undefined
              ? Boolean(p.taxable)
              : true,
          category: p.category || 'General',
          costPrice: Number(p.cost_price || 0),
          description: p.description || '',
          image: p.image_url || '',
          active: Number(p.active ?? 1) === 1,
          hasSales: Number(p.has_sales || 0) === 1,
        }))
      : [];

    return NextResponse.json(formattedProducts);
  } catch (error: any) {
    console.error('Error en GET /api/products:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      name,
      price,
      stock,
      taxable,
      barcode,
      category,
      costPrice,
      description,
      image,
      image_url,
    } = body;

    if (!name || price === undefined || price === null) {
      return NextResponse.json(
        {
          success: false,
          error: 'Nombre y precio son obligatorios',
        },
        { status: 400 }
      );
    }

    const finalPrice = Number(price);
    const finalStock = stock !== undefined ? Number(stock) : 0;
    const finalCost = costPrice !== undefined ? Number(costPrice) : 0;

    if (
      !Number.isFinite(finalPrice) ||
      finalPrice < 0 ||
      !Number.isFinite(finalStock) ||
      finalStock < 0 ||
      !Number.isFinite(finalCost) ||
      finalCost < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Precio, costo o stock inválido',
        },
        { status: 400 }
      );
    }

    const generatedBarcode =
      barcode ||
      '759' +
        Math.floor(100000000 + Math.random() * 900000000);

    const finalTaxable = taxable ? 1 : 0;
    const finalCategory = String(category || 'General');
    const finalDescription = String(description || '').trim();
    const finalImageUrl = String(image_url || image || '').trim();

    const escapeSql = (value: string) =>
      value.replace(/'/g, "''");

    await runQuery(async (db) => {
      await ensureActiveColumn(db);

      return await db.sql(`
        INSERT INTO products (
          name,
          barcode,
          price_usd,
          stock,
          taxable,
          category,
          cost_price,
          image_url,
          description,
          active
        )
        VALUES (
          '${escapeSql(String(name).trim())}',
          '${escapeSql(String(generatedBarcode))}',
          ${finalPrice},
          ${finalStock},
          ${finalTaxable},
          '${escapeSql(finalCategory)}',
          ${finalCost},
          '${escapeSql(finalImageUrl)}',
          '${escapeSql(finalDescription)}',
          1
        )
      `);
    });

    return NextResponse.json({
      success: true,
      message: 'Producto registrado con éxito',
      image: finalImageUrl,
      image_url: finalImageUrl,
      description: finalDescription,
      active: true,
    });
  } catch (error: any) {
    console.error('Error en POST /api/products:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error al guardar el producto',
      },
      { status: 500 }
    );
  }
}
