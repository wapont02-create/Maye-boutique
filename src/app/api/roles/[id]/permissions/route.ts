
import { NextResponse } from 'next/server';
import { runQuery } from '../../../../../db/client';
import {
  authorizeRoleManagement,
  escapeSql,
  getRows,
} from '../../../../../lib/posAuth';

type Context = {
  params: {
    id: string;
  };
};

/**
 * GET: consultar los permisos asignados a un rol.
 */
export async function GET(request: Request, { params }: Context) {
  const auth = await authorizeRoleManagement(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const roleId = escapeSql(params.id);

    const result = await runQuery(async (db) =>
      db.sql(`
        SELECT
          p.id,
          p.name,
          p.description
        FROM role_permissions rp
        INNER JOIN permissions p
          ON p.id = rp.permission_id
        WHERE rp.role_id = '${roleId}'
        ORDER BY p.name
      `)
    );

    return NextResponse.json({
      success: true,
      permissions: getRows(result),
    });
  } catch (error) {
    console.error('Error consultando permisos del rol:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'No se pudieron consultar los permisos del rol.',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT: reemplazar los permisos asignados a un rol.
 */
export async function PUT(request: Request, { params }: Context) {
  const auth = await authorizeRoleManagement(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();

    // Validar que permissionIds sea una lista de textos.
    if (
      !Array.isArray(body?.permissionIds) ||
      body.permissionIds.some(
        (id: unknown) => typeof id !== 'string' || id.trim() === ''
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Envía permissionIds como una lista de identificadores válidos.',
        },
        { status: 400 }
      );
    }

    const roleId = escapeSql(params.id);

    // Comprobar que el rol exista.
    const roleResult = await runQuery(async (db) =>
      db.sql(`
        SELECT id
        FROM roles
        WHERE id = '${roleId}'
        LIMIT 1
      `)
    );

    if (!getRows(roleResult).length) {
      return NextResponse.json(
        {
          success: false,
          message: 'Rol no encontrado.',
        },
        { status: 404 }
      );
    }

    // Eliminar identificadores duplicados sin usar el operador spread.
    const ids: string[] = Array.from(
      new Set<string>(body.permissionIds as string[])
    );

    // Consultar los permisos existentes.
    const allResult = await runQuery(async (db) =>
      db.sql('SELECT id FROM permissions')
    );

    const validIds = new Set<string>(
      getRows(allResult).map((permission: { id: string | number }) =>
        String(permission.id)
      )
    );

    // Rechazar identificadores de permisos que no existan.
    if (ids.some((id) => !validIds.has(id))) {
      return NextResponse.json(
        {
          success: false,
          message:
            'La lista contiene permisos inexistentes en la base de datos.',
        },
        { status: 400 }
      );
    }

    // Reemplazar las asignaciones del rol.
    await runQuery(async (db) => {
      await db.sql(`
        DELETE FROM role_permissions
        WHERE role_id = '${roleId}'
      `);

      if (ids.length > 0) {
        const values = ids
          .map(
            (permissionId) =>
              `('${roleId}', '${escapeSql(permissionId)}')`
          )
          .join(', ');

        await db.sql(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ${values}
        `);
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Permisos del rol actualizados correctamente.',
      permissionIds: ids,
    });
  } catch (error) {
    console.error('Error actualizando permisos del rol:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'No se pudieron actualizar los permisos del rol.',
      },
      { status: 500 }
    );
  }
}
