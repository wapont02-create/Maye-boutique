
import { NextResponse } from 'next/server';
import { runQuery } from '../../../../db/client';
import { escapeSql, getRows } from '../../../../lib/posAuth';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

function htmlPage(message = '') {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Recuperar acceso</title>
<style>
body{font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:24px}
main{max-width:420px;margin:40px auto;background:white;padding:24px;border-radius:14px}
input,button{box-sizing:border-box;width:100%;padding:12px;margin:8px 0;border:1px solid #ccc;border-radius:8px}
button{background:#111827;color:white;cursor:pointer}
.notice{overflow-wrap:anywhere;color:#333}
</style>
</head>
<body><main>
<h2>Restablecer contraseña del POS</h2>
<p>Usa esta página solo para recuperar el acceso autorizado.</p>
<form method="POST">
<label>Token de recuperación</label>
<input name="token" type="password" required autocomplete="off">
<label>Correo del usuario</label>
<input name="email" type="email" value="demo@posenterprise.ve" required>
<label>Nueva contraseña</label>
<input name="password" type="password" minlength="12" required autocomplete="new-password">
<button type="submit">Guardar nueva contraseña</button>
</form>
${message ? `<p class="notice">${message}</p>` : ''}
</main></body></html>`;
}

export async function GET() {
  if (!process.env.PASSWORD_RESET_TOKEN) {
    return new NextResponse('Recuperación no configurada.', { status: 503 });
  }

  return new NextResponse(htmlPage(), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function POST(request: Request) {
  try {
    const expectedToken = process.env.PASSWORD_RESET_TOKEN;

    if (!expectedToken) {
      return new NextResponse('Recuperación no configurada.', { status: 503 });
    }

    const form = await request.formData();
    const token = String(form.get('token') || '');
    const email = String(form.get('email') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');

    if (token.length !== expectedToken.length || token !== expectedToken) {
      return new NextResponse('Token incorrecto.', { status: 403 });
    }

    if (
      !email ||
      password.length < 12 ||
      password.length > 128
    ) {
      return new NextResponse(
        'Correo inválido o contraseña fuera del rango permitido.',
        { status: 400 }
      );
    }

    const result = await runQuery(async (db) => {
      const found = await db.sql(`
        SELECT id FROM users
        WHERE lower(trim(email)) = '${escapeSql(email)}'
        LIMIT 1
      `);

      const user = getRows(found)[0];

      if (!user) {
        return { success: false, message: 'No existe un usuario con ese correo.' };
      }

      const id = Number(user.id);

      if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error('ID de usuario inválido.');
      }

      const hash = await bcrypt.hash(password, 12);

      await db.sql(`
        UPDATE users
        SET password_hash = '${escapeSql(hash)}'
        WHERE id = ${id}
      `);

      const check = await db.sql(`
        SELECT password_hash FROM users
        WHERE id = ${id}
        LIMIT 1
      `);

      const savedHash = String(
        getRows(check)[0]?.password_hash || ''
      );

      const verified = savedHash
        ? await bcrypt.compare(password, savedHash)
        : false;

      if (!verified) {
        throw new Error('No se pudo verificar la contraseña guardada.');
      }

      return { success: true, message: 'Contraseña actualizada y verificada.' };
    });

    return new NextResponse(
      htmlPage(result.message),
      {
        status: result.success ? 200 : 404,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  } catch (error) {
    console.error('Error al restablecer contraseña:', error);

    return new NextResponse(
      htmlPage('No se pudo completar la operación. Revisa los registros de Vercel.'),
      {
        status: 500,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}

