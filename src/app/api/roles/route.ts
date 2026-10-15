import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { runQuery } from '../../../db/client';
import { authorizeRoleManagement, escapeSql, getRows } from '../../../lib/posAuth';

export async function GET(request: Request) {
  const auth = await authorizeRoleManagement(request);
  if (!auth.ok) return auth.response;
  try {
    const roles = await runQuery(async (db) => {
      const rolesResult = await db.sql('SELECT id, name, description, is_active, created_at FROM roles ORDER BY name');
      const permissionsResult = await db.sql('SELECT rp.role_id, p.id AS permission_id FROM role_permissions rp INNER JOIN permissions p ON p.id = rp.permission_id ORDER BY p.name');
      const permissionRows = getRows(permissionsResult);
      return getRows(rolesResult).map((role: any) => ({
        id: String(role.id), name: String(role.name || ''), description: String(role.description || ''),
        is_active: !(role.is_active === 0 || role.is_active === false || String(role.is_active) === '0'),
        created_at: role.created_at ?? null,
        permissions: permissionRows.filter((p: any) => String(p.role_id) === String(role.id)).map((p: any) => String(p.permission_id)),
      }));
    });
    return NextResponse.json({ success: true, roles });
  } catch (error) {
    console.error('Error en GET /api/roles:', error);
    return NextResponse.json({ success: false, message: 'No se pudieron consultar los roles.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRoleManagement(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const name = String(body?.name || '').trim();
    const description = String(body?.description || '').trim();
    if (name.length < 2 || name.length > 80) return NextResponse.json({ success: false, message: 'El nombre del rol debe tener entre 2 y 80 caracteres.' }, { status: 400 });
    const id = randomUUID();
    await runQuery(async (db) => db.sql(`INSERT INTO roles (id, name, description, is_active) VALUES ('${id}', '${escapeSql(name)}', '${escapeSql(description)}', 1)`));
    return NextResponse.json({ success: true, role: { id, name, description, is_active: true, permissions: [] } }, { status: 201 });
  } catch (error: any) {
    const duplicate = /unique|constraint/i.test(String(error?.message || ''));
    console.error('Error en POST /api/roles:', error);
    return NextResponse.json({ success: false, message: duplicate ? 'Ya existe un rol con ese nombre.' : 'No se pudo crear el rol.' }, { status: duplicate ? 409 : 500 });
  }
}
