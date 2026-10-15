import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

// Definición de la tabla de productos para el Punto de Venta
export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  barcode: text('barcode').unique(),
  priceUsd: real('price_usd').notNull(),
  stock: integer('stock').notNull().default(0),
});
