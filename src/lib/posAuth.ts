import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runQuery } from '../db/client';

const COOKIE_NAME = 'pos_session';
const SESSION_SECONDS = 60 * 60 * 8;

export function escapeSql(value: unknown): string {
  return String(value ?? '').replace(/'/g, "''");
}

export function getRows(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  if (result && Array.isArray(result.data)) return result.data;
  return [];
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET debe estar configurada y tener al menos 32 caracteres.');
  }
  return secret;
}

export function createSessionToken(userId: number): string {
  const payload = Buffer.from(JSON.stringify({
    userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  })).toString('base64url');
  const signature = createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function readSessionToken(request: Request): number | null {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookie = cookieHeader.split(';').map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE_NAME}=`));
    if (!cookie) return null;

    const token = decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1));
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    const expected = createHmac('sha256', getSessionSecret()).update(payload).digest();
    const received = Buffer.from(signature, 'base64url');
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isInteger(data.userId) || data.userId <= 0) return null;
    if (!Number.isInteger(data.exp) || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data.userId as number;
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser(request: Request): Promise<any | null> {
  const userId = readSessionToken(request);
  if (!userId) return null;
  return runQuery(async (db) => {
    const result = await db.sql(`SELECT id, name, email, role, is_active FROM users WHERE id = ${userId} LIMIT 1`);
    const user = getRows(result)[0];
    if (!user || user.is_active === 0 || user.is_active === false || String(user.is_active) === '0') return null;
    return user;
  });
}

export async function canManageRoles(user: any): Promise<boolean> {
  const roleValue = String(user?.role || '').trim();
  if (!roleValue) return false;
  return runQuery(async (db) => {
    const roleResult = await db.sql(`
      SELECT id, name, is_active FROM roles
      WHERE lower(id) = lower('${escapeSql(roleValue)}')
         OR lower(name) = lower('${escapeSql(roleValue)}')
      LIMIT 1
    `);
    const role = getRows(roleResult)[0];
    if (!role || role.is_active === 0 || role.is_active === false || String(role.is_active) === '0') return false;
    // Acceso inicial para el rol administrador, aunque aún no tenga role_permissions.
    if (String(role.id).toLowerCase() === 'admin' || String(role.name).toLowerCase() === 'administrador') return true;
    const permissionResult = await db.sql(`
      SELECT p.id FROM role_permissions rp
      INNER JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = '${escapeSql(role.id)}' AND p.id = 'manage_roles' LIMIT 1
    `);
    return getRows(permissionResult).length > 0;
  });
}

export async function authorizeRoleManagement(request: Request): Promise<
  | { ok: true; user: any }
  | { ok: false; response: NextResponse }
> {
  let user: any | null;
  try {
    user = await getAuthenticatedUser(request);
  } catch (error) {
    console.error('Error validando sesión:', error);
    return { ok: false, response: NextResponse.json({ success: false, message: 'No se pudo validar la sesión.' }, { status: 500 }) };
  }
  if (!user) {
    return { ok: false, response: NextResponse.json({ success: false, message: 'Debes iniciar sesión para continuar.' }, { status: 401 }) };
  }
  try {
    if (!(await canManageRoles(user))) {
      return { ok: false, response: NextResponse.json({ success: false, message: 'No tienes permiso para administrar usuarios, roles y permisos.' }, { status: 403 }) };
    }
  } catch (error) {
    console.error('Error verificando permisos administrativos:', error);
    return { ok: false, response: NextResponse.json({ success: false, message: 'No se pudieron verificar los permisos.' }, { status: 500 }) };
  }
  return { ok: true, user };
}

export const sessionCookie = {
  name: COOKIE_NAME,
  maxAge: SESSION_SECONDS,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

