import { Database } from '@sqlitecloud/drivers';

export const connectionString =
  process.env.DATABASE_URL || '';

if (!connectionString) {
  console.error(
    'ADVERTENCIA: DATABASE_URL no está configurada.'
  );
}

export const db = new Database(connectionString);

export async function runQuery(
  queryCallback: (
    database: InstanceType<typeof Database>
  ) => Promise<any>
) {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL no está configurada.'
    );
  }

  const client = new Database(connectionString);

  try {
    return await queryCallback(client);
  } finally {
    try {
      client.close();
    } catch (error) {
      console.error(
        'Error cerrando SQLite Cloud:',
        error
      );
    }
  }
}
