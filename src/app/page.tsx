
import ClientMenu from '@/components/ClientMenu';
import { Database } from '@sqlitecloud/drivers';

export const dynamic = 'force-dynamic';

async function getProducts() {
  try {
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.SQLITECLOUD_CONNECTION_STRING;

    if (!connectionString) {
      console.error(
        'Falta la cadena de conexión de SQLite Cloud en Vercel'
      );
      return [];
    }

    const db = new Database(connectionString);

    const result: any = await db.sql(
      'SELECT id, name, description, price_usd, category, image_url FROM products;'
    );

    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.rows)) return result.rows;

    if (result && typeof result === 'object') {
      const values = Object.values(result);
      if (Array.isArray(values[0])) return values[0];
      return values;
    }

    return [];
  } catch (error) {
    console.error('Error al consultar SQLite Cloud:', error);
    return [];
  }
}

export default async function MayeBoutiquePage() {
  const products = await getProducts();
  const categoriesMap: Record<string, any[]> = {};

  if (Array.isArray(products)) {
    products.forEach((prod: any) => {
      if (!prod || !prod.name) return;

      const category = prod.category || 'Colección';

      if (!categoriesMap[category]) {
        categoriesMap[category] = [];
      }

      categoriesMap[category].push({
        id: Number(prod.id),
        name: String(prod.name),
        description: prod.description || '',
        price: Number(prod.price_usd) || 0,
        image: prod.image_url || '',
      });
    });
  }

  const initialCategories = Object.entries(categoriesMap).map(
    ([category, items]) => ({
      category,
      items,
    })
  );

  return (
    <main className="min-h-screen bg-[#0b090b] text-white selection:bg-[#f00078] selection:text-white">
      <ClientMenu initialCategories={initialCategories} />
    </main>
  );
}
