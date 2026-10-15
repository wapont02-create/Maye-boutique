import ClientMenu from '@/components/ClientMenu';
import { Database } from '@sqlitecloud/drivers';

// Forzar que esta página sea dinámica y consulte la base de datos en tiempo real
export const dynamic = 'force-dynamic';

async function getProducts() {
  try {
    const connectionString = process.env.DATABASE_URL || process.env.SQLITECLOUD_CONNECTION_STRING;
    
    if (!connectionString) {
      console.error('Falta la cadena de conexión en las variables de entorno de Vercel');
      return [];
    }

    const db = new Database(connectionString);
    // Incluimos image_url en la consulta SQL
    const result: any = await db.sql('SELECT id, name, description, price_usd, category, image_url FROM products;');
    
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.rows)) return result.rows;
    if (result && typeof result === 'object') {
      const values = Object.values(result);
      if (Array.isArray(values[0])) return values[0];
      return values;
    }

    return [];
  } catch (error) {
    console.error('Error al conectar con SQLite Cloud:', error);
    return [];
  }
}

export default async function TakosushiMenuPage() {
  const products = await getProducts();

  const categoriesMap: { [key: string]: any[] } = {};
  
  if (Array.isArray(products) && products.length > 0) {
    products.forEach((prod: any) => {
      if (!prod || !prod.name) return;
      
      const cat = prod.category || 'COMBOS Y ROLLS';
      if (!categoriesMap[cat]) {
        categoriesMap[cat] = [];
      }
      categoriesMap[cat].push({
        id: prod.id || Math.random(),
        name: prod.name,
        description: prod.description || '',
        price: prod.price_usd ? Number(prod.price_usd) : 0,
        image: prod.image_url || '' // Pasamos la URL limpia de la imagen
      });
    });
  }

  const menuCategories = Object.keys(categoriesMap).map(cat => ({
    category: cat,
    items: categoriesMap[cat]
  }));

  return (
    <main className="min-h-screen bg-[#140005] text-white flex flex-col justify-between selection:bg-[#ff007f] selection:text-white pb-24">
      <ClientMenu initialCategories={menuCategories} />
    </main>
  );
}
