import { NextResponse } from 'next/server';
import { runQuery } from '../../../db/client';
import { authorizeRoleManagement, getRows } from '../../../lib/posAuth';

export async function GET(request: Request) {
  const auth = await authorizeRoleManagement(request);
  if (!auth.ok) return auth.response;
  try {
    const result = await runQuery(async (db) => db.sql('SELECT id, name, description FROM permissions ORDER BY name'));
    const permissions = getRows(result).map((p: any) => ({ id: String(p.id), name: String(p.name || ''), description: String(p.description || '') }));
    return NextResponse.json({ success: true, permissions });
  } catch (error) {
    console.error('Error en GET /api/permissions:', error);
    return NextResponse.json({ success: false, message: 'No se pudieron consultar los permisos.' }, { status: 500 });
  }
}
