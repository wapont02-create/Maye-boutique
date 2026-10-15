import { NextResponse } from 'next/server';
import { runQuery } from '../../../../db/client';
import { createSessionToken, escapeSql, getRows, sessionCookie } from '../../../../lib/posAuth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Correo y contraseña son obligatorios.' }, { status: 400 });
    }

    const user = await runQuery(async (db) => {
      const result = await db.sql(`
        SELECT id, name, email, password_hash, role, is_active FROM users
        WHERE lower(trim(email)) = '${escapeSql(email)}' LIMIT 1
      `);
      return getRows(result)[0] || null;
    });

    if (!user) return NextResponse.json({ success: false, message: 'Correo o contraseña incorrectos.' }, { status: 401 });
    if (user.is_active === 0 || user.is_active === false || String(user.is_active) === '0') {
      return NextResponse.json({ success: false, message: 'Esta cuenta está desactivada.' }, { status: 403 });
    }
    const hash = String(user.password_hash || '').trim();
    if (!hash) return NextResponse.json({ success: false, message: 'La cuenta no tiene una contraseña configurada.' }, { status: 500 });
    if (!(await bcrypt.compare(password, hash))) {
      return NextResponse.json({ success: false, message: 'Correo o contraseña incorrectos.' }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      message: 'Acceso autorizado',
      user: { id: Number(user.id), name: String(user.name || ''), email: String(user.email || ''), role: String(user.role || 'cajero') },
    });
    response.cookies.set({ ...sessionCookie, value: createSessionToken(Number(user.id)) });
    return response;
  } catch (error: any) {
    console.error('Error en POST /api/auth/login:', error);
    const message = String(error?.message || '').includes('SESSION_SECRET')
      ? 'Falta configurar SESSION_SECRET en las variables de entorno del servidor.'
      : 'Error interno al iniciar sesión.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
