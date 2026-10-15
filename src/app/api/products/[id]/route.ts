
import { NextResponse } from 'next/server';
import { runQuery } from '../../../../db/client';

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

function isValidId(id: string) {
  return /^\d+$/.test(id) && Number(id) > 0;
}

async function ensureActiveColumn(db: any) {
  const columns = await db.sql('PRAGMA table_info(products);');

  const hasActiveColumn = Array.isArray(columns)
    ? columns.some((column: any) => column.name === 'active')
    : false;

  if (!hasActiveColumn) {
    await db.sql(`
      ALTER TABLE products
      ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
    `);
  }
}

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}

export async function PUT(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    if (!isValidId(id)) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID de producto inválido',
        },
        { status: 400 }
      );
    }

    const productId = Number(id);
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
      active,
    } = body;

    // Activar o desactivar sin modificar los demás datos.
    if (
      Object.prototype.hasOwnProperty.call(body, 'active') &&
      name === undefined &&
      price === undefined &&
      stock === undefined &&
      taxable === undefined &&
      barcode === undefined &&
      category === undefined &&
      costPrice === undefined &&
      description === undefined &&
      image === undefined &&
      image_url === undefined
    ) {
      if (typeof active !== 'boolean') {
        return NextResponse.json(
          {
            success: false,
            error: 'El estado del producto debe ser verdadero o falso',
          },
          { status: 400 }
        );
      }

      const result = await runQuery(async (db) => {
        await ensureActiveColumn(db);

        return await db.sql(`
          UPDATE products
          SET active = ${active ? 1 : 0}
          WHERE id = ${productId};
        `);
      });

      return NextResponse.json({
        success: true,
        active,
        message: active
          ? 'Producto reactivado correctamente'
          : 'Producto desactivado correctamente',
      });
    }

    // Actualización exclusiva del stock.
    const hasOnlyStock =
      stock !== undefined &&
      name === undefined &&
      price === undefined &&
      taxable === undefined &&
      barcode === undefined &&
      category === undefined &&
      costPrice === undefined &&
      description === undefined &&
      image === undefined &&
      image_url === undefined &&
      active === undefined;

    if (hasOnlyStock) {
      const finalStock = Number(stock);

      if (
        !Number.isFinite(finalStock) ||
        finalStock < 0
      ) {
        return NextResponse.json(
          { success: false, error: 'Stock inválido' },
          { status: 400 }
        );
      }

      await runQuery(async (db) => {
        await ensureActiveColumn(db);

        return await db.sql(`
          UPDATE products
          SET stock = ${finalStock}
          WHERE id = ${productId};
        `);
      });

      return NextResponse.json({
        success: true,
        message: 'Stock actualizado correctamente',
      });
    }

    // Edición completa del producto.
    if (
      name === undefined ||
      price === undefined ||
      stock === undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Faltan datos obligatorios del producto',
        },
        { status: 400 }
      );
    }

    const finalName = String(name).trim();
    const finalPrice = Number(price);
    const finalStock = Number(stock);
    const finalTaxable = taxable ? 1 : 0;
    const finalCategory = String(category || 'General').trim();
    const finalCost =
      costPrice !== undefined ? Number(costPrice) : 0;
    const finalDescription = String(description || '').trim();
    const finalImageUrl = String(image_url || image || '').trim();
    const finalBarcode = String(barcode || '').trim();

    if (
      !finalName ||
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
          error: 'Nombre, precio, costo o stock inválido',
        },
        { status: 400 }
      );
    }

    const cleanName = escapeSql(finalName);
    const cleanCategory = escapeSql(finalCategory);
    const cleanDescription = escapeSql(finalDescription);
    const cleanImageUrl = escapeSql(finalImageUrl);
    const cleanBarcode = escapeSql(finalBarcode);

    await runQuery(async (db) => {
      await ensureActiveColumn(db);

      return await db.sql(`
        UPDATE products
        SET
          name = '${cleanName}',
          price_usd = ${finalPrice},
          stock = ${finalStock},
          taxable = ${finalTaxable},
          category = '${cleanCategory}',
          cost_price = ${finalCost},
          image_url = '${cleanImageUrl}',
          description = '${cleanDescription}'
          ${finalBarcode ? `, barcode = '${cleanBarcode}'` : ''}
        WHERE id = ${productId};
      `);
    });

    return NextResponse.json({
      success: true,
      message: 'Producto actualizado correctamente',
      description: finalDescription,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Error interno al actualizar';

    console.error('Error al actualizar el producto:', error);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    if (!isValidId(id)) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID de producto inválido',
        },
        { status: 400 }
      );
    }

    const productId = Number(id);

    // Garantiza que la columna exista antes de usarla.
    await runQuery(async (db) => {
      await ensureActiveColumn(db);
    });

    // Comprobar ventas asociadas antes de intentar borrar.
    const salesResult = await runQuery(async (db) => {
      return await db.sql(`
        SELECT COUNT(*) AS total
        FROM sale_items
        WHERE product_id = ${productId};
      `);
    });

    const salesCount =
      Array.isArray(salesResult) && salesResult.length > 0
        ? Number(salesResult[0].total || 0)
        : 0;

    if (salesCount > 0) {
      await runQuery(async (db) => {
        return await db.sql(`
          UPDATE products
          SET active = 0
          WHERE id = ${productId};
        `);
      });

      return NextResponse.json({
        success: true,
        deactivated: true,
        message:
          'El producto tiene ventas asociadas. Se desactivó para proteger el historial.',
      });
    }

    // Si no tiene ventas, intentar eliminarlo definitivamente.
    try {
      await runQuery(async (db) => {
        return await db.sql(`
          DELETE FROM products
          WHERE id = ${productId};
        `);
      });

      return NextResponse.json({
        success: true,
        deactivated: false,
        message: 'Producto eliminado definitivamente',
      });
    } catch (deleteError: unknown) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : '';

      if (/foreign key|constraint failed/i.test(message)) {
        // Otra tabla lo referencia: conservarlo y desactivarlo.
        await runQuery(async (db) => {
          return await db.sql(`
            UPDATE products
            SET active = 0
            WHERE id = ${productId};
          `);
        });

        return NextResponse.json({
          success: true,
          deactivated: true,
          message:
            'El producto está relacionado con otros registros. Se desactivó para proteger los datos.',
        });
      }

      throw deleteError;
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Error interno al eliminar';

    console.error('Error al eliminar el producto:', error);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
