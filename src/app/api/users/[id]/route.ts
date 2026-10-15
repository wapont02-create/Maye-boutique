import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { runQuery } from '../../../../db/client';
import { authorizeRoleManagement, escapeSql, getRows } from '../../../../lib/posAuth';
type Context = { params: { id: string } };
function parseId(id: string): number | null { const n = Number(id); return Number.isSafeInteger(n) && n > 0 ? n : null; }

export async function PATCH(request: Request, { params }: Context) {
  const auth = await authorizeRoleManagement(request);
  if (!auth.ok) return auth.response;
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ success: false, message: 'ID de usuario inválido.' }, { status: 400 });
  try {
    const body = await request.json();
    const updates: string[] = [];
    if (body?.name !== undefined) {
      const name = String(body.name || '').trim();
      if (name.length < 2) return NextResponse.json({ success: false, message: 'El nombre debe tener al menos 2 caracteres.' }, { status: 400 });
      updates.push(`name = '${escapeSql(name)}'`);
    }
    if (body?.email !== undefined) {
      const email = String(body.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ success: false, message: 'Introduce un correo electrónico válido.' }, { status: 400 });
      updates.push(`email = '${escapeSql(email)}'`);
    }
    if (body?.password !== undefined && String(body.password)) {
      const password = String(body.password);
      if (password.length < 8) return NextResponse.json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 });
      updates.push(`password_hash = '${escapeSql(await bcrypt.hash(password, 12))}'`);
    }
    const requestedRole = body?.roleId ?? body?.role;
    if (requestedRole !== undefined) {
      const roleId = String(requestedRole || '').trim();
      const roleResult = await runQuery(async (db) => db.sql(`SELECT id FROM roles WHERE id = '${escapeSql(roleId)}' AND is_active = 1 LIMIT 1`));
      const role = getRows(roleResult)[0];
      if (!role) return NextResponse.json({ success: false, message: 'El rol seleccionado no existe o está desactivado.' }, { status: 400 });
      updates.push(`role = '${escapeSql(String(role.id))}'`);
    }
    if (body?.is_active !== undefined) {
      const active = body.is_active === true || body.is_active === 1 || body.is_active === '1';
      if (Number(auth.user.id) === id && !active) return NextResponse.json({ success: false, message: 'No puedes desactivar tu propia cuenta.' }, { status: 400 });
      updates.push(`is_active = ${active ? 1 : 0}`);
    }
    if (!updates.length) return NextResponse.json({ success: false, message: 'No se recibieron campos válidos para actualizar.' }, { status: 400 });
    await runQuery(async (db) => db.sql(`UPDATE users SET ${updates.join(', ')} WHERE id = ${id}`));
    const result = await runQuery(async (db) => db.sql(`SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ${id} LIMIT 1`));
    const user = getRows(result)[0];
    if (!user) return NextResponse.json({ success: false, message: 'Usuario no encontrado.' }, { status: 404 });
    return NextResponse.json({ success: true, user: { id: Number(user.id), name: String(user.name || ''), email: String(user.email || ''), role: String(user.role || ''), roleId: String(user.role || ''), is_active: !(user.is_active === 0 || user.is_active === false || String(user.is_active) === '0'), created_at: user.created_at ?? null } });
  } catch (error: any) {
    const duplicate = /unique|constraint/i.test(String(error?.message || ''));
    console.error('Error en PATCH /api/users/[id]:', error);
    return NextResponse.json({ success: false, message: duplicate ? 'Ya existe un usuario con ese correo.' : 'No se pudo actualizar el usuario.' }, { status: duplicate ? 409 : 500 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await authorizeRoleManagement(request);
  if (!auth.ok) return auth.response;
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ success: false, message: 'ID de usuario inválido.' }, { status: 400 });
  if (Number(auth.user.id) === id) return NextResponse.json({ success: false, message: 'No puedes desactivar tu propia cuenta.' }, { status: 400 });
  try {
    await runQuery(async (db) => db.sql(`UPDATE users SET is_active = 0 WHERE id = ${id}`));
    return NextResponse.json({ success: true, message: 'Usuario desactivado.' });
  } catch (error) {
    console.error('Error en DELETE /api/users/[id]:', error);
    return NextResponse.json({ success: false, message: 'No se pudo desactivar el usuario.' }, { status: 500 });
  }
}
