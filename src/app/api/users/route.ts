import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { runQuery } from '../../../db/client';
import { authorizeRoleManagement, escapeSql, getRows } from '../../../lib/posAuth';

export async function GET(request: Request) {
  const auth = await authorizeRoleManagement(request);
  if (!auth.ok) return auth.response;
  try {
    const result = await runQuery(async (db) => db.sql(`
      SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, r.name AS role_name
      FROM users u LEFT JOIN roles r ON lower(r.id) = lower(u.role) OR lower(r.name) = lower(u.role)
      ORDER BY u.id DESC
    `));
    const users = getRows(result).map((u: any) => ({
      id: Number(u.id), name: String(u.name || ''), email: String(u.email || ''),
      role: String(u.role || 'cajero'), roleId: String(u.role || 'cajero'),
      roleName: String(u.role_name || u.role || 'cajero'),
      is_active: !(u.is_active === 0 || u.is_active === false || String(u.is_active) === '0'),
      created_at: u.created_at ?? null,
    }));
    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('Error en GET /api/users:', error);
    return NextResponse.json({ success: false, message: 'No se pudieron consultar los usuarios.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRoleManagement(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const roleId = String(body?.roleId || body?.role || '').trim();
    if (name.length < 2) return NextResponse.json({ success: false, message: 'El nombre debe tener al menos 2 caracteres.' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ success: false, message: 'Introduce un correo electrónico válido.' }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 });
    if (!roleId) return NextResponse.json({ success: false, message: 'Debes seleccionar un rol.' }, { status: 400 });

    const roleResult = await runQuery(async (db) => db.sql(`SELECT id FROM roles WHERE id = '${escapeSql(roleId)}' AND is_active = 1 LIMIT 1`));
    const role = getRows(roleResult)[0];
    if (!role) return NextResponse.json({ success: false, message: 'El rol seleccionado no existe o está desactivado.' }, { status: 400 });
    const hash = await bcrypt.hash(password, 12);
    await runQuery(async (db) => db.sql(`INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('${escapeSql(name)}', '${escapeSql(email)}', '${escapeSql(hash)}', '${escapeSql(String(role.id))}', 1)`));
    const createdResult = await runQuery(async (db) => db.sql(`SELECT id, name, email, role, is_active, created_at FROM users WHERE lower(email) = '${escapeSql(email)}' LIMIT 1`));
    const user = getRows(createdResult)[0];
    return NextResponse.json({ success: true, user: user ? { id: Number(user.id), name: String(user.name || ''), email: String(user.email || ''), role: String(user.role || ''), roleId: String(user.role || ''), is_active: true, created_at: user.created_at ?? null } : null }, { status: 201 });
  } catch (error: any) {
    const duplicate = /unique|constraint/i.test(String(error?.message || ''));
    console.error('Error en POST /api/users:', error);
    return NextResponse.json({ success: false, message: duplicate ? 'Ya existe un usuario con ese correo.' : 'No se pudo registrar el usuario.' }, { status: duplicate ? 409 : 500 });
  }
}
