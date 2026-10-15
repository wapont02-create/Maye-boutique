/**
 * src/utils/rolesManager.ts
 *
 * Sistema centralizado de Roles, Usuarios y Permisos.
 *
 * IMPORTANTE:
 * Todos los componentes deben utilizar estos tipos.
 */

export type Permission =
  | 'view_pos'
  | 'view_inventory'
  | 'edit_inventory'
  | 'view_reports'
  | 'view_payables'
  | 'manage_roles'
  | 'view_users'
  | 'view_credits'
  | 'manage_payables'
  | 'view_dashboard';

/**
 * Estructura de un rol.
 */
export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
}

/**
 * Estructura de un usuario.
 *
 * username es el identificador utilizado para
 * iniciar sesión y seleccionar al usuario.
 */
export interface User {
  id: string;
  name: string;
  username: string;
  email?: string;
  roleId?: string;
  role: string;
}

/**
 * Permisos disponibles para el sistema.
 */
export const ALL_PERMISSIONS: {
  key: Permission;
  label: string;
}[] = [
  {
    key: 'view_pos',
    label: '🛒 Acceso a Caja POS',
  },
  {
    key: 'view_inventory',
    label: '📦 Ver Inventario',
  },
  {
    key: 'edit_inventory',
    label: '✏️ Modificar / Crear Inventario',
  },
  {
    key: 'view_reports',
    label: '📊 Ver Reportes y Cierre Z',
  },
  {
    key: 'view_payables',
    label: '📋 Ver Cuentas por Pagar',
  },
  {
    key: 'view_credits',
    label: '💰 Ver Cuentas por Cobrar',
  },
  {
    key: 'manage_payables',
    label: '💳 Gestionar Cuentas por Pagar',
  },
  {
    key: 'view_users',
    label: '👥 Ver Usuarios',
  },
  {
    key: 'manage_roles',
    label: '🛡️ Gestionar Roles y Personal',
  },
  {
    key: 'view_dashboard',
    label: '📊 Ver Dashboard',
  },
];

/**
 * Roles predeterminados.
 */
const mockRoles: Role[] = [
  {
    id: 'admin',
    name: 'Administrador',
    description:
      'Acceso completo a todas las funciones del sistema.',
    permissions: [
      'view_pos',
      'view_inventory',
      'edit_inventory',
      'view_reports',
      'view_payables',
      'manage_roles',
      'view_users',
      'view_credits',
      'manage_payables',
      'view_dashboard',
    ],
  },

  {
    id: 'cajero',
    name: 'Cajero',
    description:
      'Puede operar la caja y consultar clientes.',
    permissions: [
      'view_pos',
      'view_dashboard',
    ],
  },

  {
    id: 'inventario',
    name: 'Encargado de Inventario',
    description:
      'Puede consultar y modificar el inventario.',
    permissions: [
      'view_inventory',
      'edit_inventory',
      'view_dashboard',
    ],
  },

  {
    id: 'contador',
    name: 'Contador',
    description:
      'Puede consultar reportes y cuentas financieras.',
    permissions: [
      'view_reports',
      'view_payables',
      'view_credits',
      'view_dashboard',
    ],
  },

  {
    id: 'viewer',
    name: 'Visualizador',
    description:
      'Puede consultar información sin administrar el sistema.',
    permissions: [
      'view_pos',
      'view_inventory',
      'view_reports',
      'view_payables',
      'view_credits',
      'view_dashboard',
    ],
  },
];

/**
 * Usuarios iniciales.
 */
const mockUsers: User[] = [
  {
    id: '1',
    name: 'Administrador General',
    username: 'admin',
    email: 'admin@example.com',
    roleId: 'admin',
    role: 'admin',
  },
];

/**
 * Claves utilizadas por localStorage.
 */
const ROLES_STORAGE_KEY = 'pos_roles';
const USERS_STORAGE_KEY = 'pos_users';

/**
 * Obtener roles.
 */
export function getRoles(): Role[] {
  if (typeof window === 'undefined') {
    return mockRoles;
  }

  try {
    const stored = localStorage.getItem(
      ROLES_STORAGE_KEY
    );

    if (!stored) {
      localStorage.setItem(
        ROLES_STORAGE_KEY,
        JSON.stringify(mockRoles)
      );

      return mockRoles;
    }

    const parsed = JSON.parse(stored);

    if (Array.isArray(parsed)) {
      return parsed as Role[];
    }

    return mockRoles;
  } catch (error) {
    console.error(
      'Error obteniendo roles:',
      error
    );

    return mockRoles;
  }
}

/**
 * Guardar roles.
 */
export function saveRoles(
  roles: Role[]
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(
      ROLES_STORAGE_KEY,
      JSON.stringify(roles)
    );
  } catch (error) {
    console.error(
      'Error guardando roles:',
      error
    );
  }
}

/**
 * Obtener usuarios.
 */
export function getUsers(): User[] {
  if (typeof window === 'undefined') {
    return mockUsers;
  }

  try {
    const stored = localStorage.getItem(
      USERS_STORAGE_KEY
    );

    if (!stored) {
      localStorage.setItem(
        USERS_STORAGE_KEY,
        JSON.stringify(mockUsers)
      );

      return mockUsers;
    }

    const parsed = JSON.parse(stored);

    if (Array.isArray(parsed)) {
      return parsed.map(
        (user: any): User => ({
          id: String(user.id),
          name: String(
            user.name ||
              user.nombre ||
              user.username ||
              'Usuario'
          ),
          username: String(
            user.username ||
              user.email ||
              'usuario'
          ),
          email: user.email
            ? String(user.email)
            : undefined,
          roleId: user.roleId
            ? String(user.roleId)
            : undefined,
          role: String(
            user.role ||
              user.roleId ||
              'cajero'
          ),
        })
      );
    }

    return mockUsers;
  } catch (error) {
    console.error(
      'Error obteniendo usuarios:',
      error
    );

    return mockUsers;
  }
}

/**
 * Guardar usuarios.
 */
export function saveUsers(
  users: User[]
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(
      USERS_STORAGE_KEY,
      JSON.stringify(users)
    );
  } catch (error) {
    console.error(
      'Error guardando usuarios:',
      error
    );
  }
}

/**
 * Buscar un usuario por username.
 */
export function getUserByUsername(
  username: string
): User | undefined {
  const users = getUsers();

  return users.find(
    (user) =>
      String(user.username)
        .toLowerCase() ===
      String(username)
        .toLowerCase()
  );
}

/**
 * Buscar un rol por ID.
 */
export function getRoleById(
  roleId: string
): Role | undefined {
  const roles = getRoles();

  return roles.find(
    (role) =>
      String(role.id).toLowerCase() ===
      String(roleId).toLowerCase()
  );
}

/**
 * Validar permiso.
 */
export function hasPermission(
  roleId: string,
  permission: Permission
): boolean {
  const role = getRoleById(roleId);

  if (!role) {
    return false;
  }

  return role.permissions.includes(
    permission
  );
}

/**
 * Obtener permisos de un usuario.
 */
export function getUserPermissions(
  user: User
): Permission[] {
  const roleId =
    user.roleId ||
    user.role ||
    '';

  const role = getRoleById(roleId);

  return role?.permissions || [];
}
