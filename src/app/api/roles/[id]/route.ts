import { NextResponse } from 'next/server';
import { runQuery } from '../../../../db/client';
import { authorizeRoleManagement, escapeSql, getRows } from '../../../../lib/posAuth';
type Context = { params: { id: string } };

export async function GET(request: Request, { params }: Context) {
  const auth = await authorizeRoleManagement(request);
  if (!auth.ok) return auth.response;
  try {
    const role = await runQuery(async (db) => {
      const result = await db.sql(`SELECT id, name, description, is_active, created_at FROM roles WHERE id = '${escapeSql(params.id)}' LIMIT 1`);
      const row = getRows(result)[0];
      if (!row) return null;
      const permissionResult = await db.sql(`SELECT permission_id FROM role_permissions WHERE role_id = '${escapeSql(params.id)}'`);
      return { id: String(row.id), name: String(row.name || ''), description: String(row.description || ''), is_active: !(row.is_active === 0 || row.is_active === false || String(row.is_active) === '0'), created_at: row.created_at ?? null, permissions: getRows(permissionResult).map((p: any) => String(p.permission_id)) };
    });
    if (!role) return NextResponse.json({ success: false, message: 'Rol no encontrado.' }, { status: 404 });
    return NextResponse.json({ success: true, role });
  } catch (error) {
    console.error('Error en GET /api/roles/[id]:', error);
    return NextResponse.json({ success: false, message: 'No se pudo consultar el rol.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const auth = await authorizeRoleManagement(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const updates: string[] = [];
    if (body?.name !== undefined) {
      const name = String(body.name || '').trim();
      if (name.length < 2 || name.length > 80) return NextResponse.json({ success: false, message: 'El nombre debe tener entre 2 y 80 caracteres.' }, { status: 400 });
      updates.push(`name = '${escapeSql(name)}'`);
    }
    if (body?.description !== undefined) updates.push(`description = '${escapeSql(String(body.description || '').trim())}'`);
    if (body?.is_active !== undefined) {
      if (String(params.id).toLowerCase() === 'admin' && !body.is_active) return NextResponse.json({ success: false, message: 'No se puede desactivar el rol administrador principal.' }, { status: 400 });
      updates.push(`is_active = ${body.is_active ? 1 : 0}`);
    }
    if (!updates.length) return NextResponse.json({ success: false, message: 'No se recibieron campos para actualizar.' }, { status: 400 });
    await runQuery(async (db) => db.sql(`UPDATE roles SET ${updates.join(', ')} WHERE id = '${escapeSql(params.id)}'`));
    const result = await runQuery(async (db) => db.sql(`SELECT id FROM roles WHERE id = '${escapeSql(params.id)}' LIMIT 1`));
    if (!getRows(result).length) return NextResponse.json({ success: false, message: 'Rol no encontrado.' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Rol actualizado.' });
  } catch (error: any) {
    const duplicate = /unique|constraint/i.test(String(error?.message || ''));
    console.error('Error en PATCH /api/roles/[id]:', error);
    return NextResponse.json({ success: false, message: duplicate ? 'Ya existe un rol con ese nombre.' : 'No se pudo actualizar el rol.' }, { status: duplicate ? 409 : 500 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await authorizeRoleManagement(request);
  if (!auth.ok) return auth.response;
  if (String(params.id).toLowerCase() === 'admin') return NextResponse.json({ success: false, message: 'No se puede desactivar el rol administrador principal.' }, { status: 400 });
  try {
    await runQuery(async (db) => db.sql(`UPDATE roles SET is_active = 0 WHERE id = '${escapeSql(params.id)}'`));
    return NextResponse.json({ success: true, message: 'Rol desactivado.' });
  } catch (error) {
    console.error('Error en DELETE /api/roles/[id]:', error);
    return NextResponse.json({ success: false, message: 'No se pudo desactivar el rol.' }, { status: 500 });
  }
}
