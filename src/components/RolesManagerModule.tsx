
'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';

type ApiRole = {
  id: string;
  name: string;
  description?: string;
  permissions?: string[];
  is_active?: number | boolean;
};

type ApiUser = {
  id: number | string;
  name: string;
  email: string;
  role: string;
  is_active?: number | boolean;
};

const ALL_PERMISSIONS = [
  { key: 'view_pos', label: '🛒 Acceso a Caja POS' },
  { key: 'view_inventory', label: '📦 Ver Inventario' },
  { key: 'edit_inventory', label: '✏️ Modificar / Crear Inventario' },
  { key: 'view_credits', label: '📋 Ver Cuentas por Cobrar' },
  { key: 'view_payables', label: '📑 Ver Cuentas por Pagar' },
  { key: 'manage_payables', label: '💰 Gestionar Cuentas por Pagar' },
  { key: 'view_reports', label: '📊 Ver Reportes' },
  { key: 'manage_roles', label: '🛡️ Gestionar Roles y Personal' },
  { key: 'view_users', label: '👥 Ver Usuarios' },
  { key: 'view_dashboard', label: '🏠 Ver Dashboard' },
] as const;

async function readResponse(response: Response) {
  const text = await response.text();

  let data: any;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      response.ok
        ? 'El servidor devolvió una respuesta inválida.'
        : `Error del servidor (${response.status}). Verifica las rutas API y vuelve a intentarlo.`
    );
  }

  if (!response.ok || data.success === false) {
    throw new Error(
      data.error ||
      data.message ||
      `La operación falló (${response.status}).`
    );
  }

  return data;
}

function normalizeRole(value: any): ApiRole {
  return {
    id: String(value.id),
    name: String(value.name || value.id),
    description: value.description || '',
    permissions: Array.isArray(value.permissions)
      ? value.permissions.map((p: any) =>
          typeof p === 'string' ? p : String(p.id || p.name)
        )
      : [],
    is_active: value.is_active ?? 1,
  };
}

function normalizeUser(value: any): ApiUser {
  return {
    id: value.id,
    name: String(value.name || ''),
    email: String(value.email || ''),
    role: String(value.role || 'cajero'),
    is_active: value.is_active ?? 1,
  };
}

export default function RolesManagerModule() {
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);

  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('cajero');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const [rolesResponse, usersResponse] = await Promise.all([
        fetch('/api/roles', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        }),
        fetch('/api/users', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        }),
      ]);

      const [rolesData, usersData] = await Promise.all([
        readResponse(rolesResponse),
        readResponse(usersResponse),
      ]);

      const receivedRoles = (
        Array.isArray(rolesData)
          ? rolesData
          : rolesData.roles || []
      )
        .map(normalizeRole)
        .filter((role: ApiRole) => role.is_active !== 0 && role.is_active !== false);

      const receivedUsers = (
        Array.isArray(usersData)
          ? usersData
          : usersData.users || []
      )
        .map(normalizeUser)
        .filter((user: ApiUser) => user.is_active !== 0 && user.is_active !== false);

      setRoles(receivedRoles);
      setUsers(receivedUsers);

      if (
        receivedRoles.length > 0 &&
        !receivedRoles.some((role: ApiRole) => role.id === newUserRole)
      ) {
        const cashier = receivedRoles.find(
          (role: ApiRole) =>
            role.id.toLowerCase() === 'cajero'
        );

        setNewUserRole(cashier?.id || receivedRoles[0].id);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No se pudieron cargar los usuarios y roles.'
      );
    } finally {
      setLoading(false);
    }
  }, [newUserRole]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAddUser = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanName = newUserName.trim();
    const cleanEmail = newUserEmail.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !newUserPassword || !confirmPassword) {
      setErrorMessage('Completa todos los campos.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Introduce un correo electrónico válido.');
      return;
    }

    if (newUserPassword.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (newUserPassword !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    if (users.some((user) => user.email.toLowerCase() === cleanEmail)) {
      setErrorMessage('Ya existe un usuario con ese correo electrónico.');
      return;
    }

    if (!roles.some((role) => role.id === newUserRole)) {
      setErrorMessage('Selecciona un rol válido.');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          password: newUserPassword,
          role: newUserRole,
        }),
      });

      await readResponse(response);

      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setConfirmPassword('');

      setSuccessMessage(
        'Usuario registrado en la base de datos. Ya puede iniciar sesión con su correo y contraseña.'
      );

      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo registrar el usuario.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (user: ApiUser) => {
    if (
      user.email.trim().toLowerCase() === 'admin@takosushi.com'
    ) {
      setErrorMessage(
        'El administrador principal no puede eliminarse desde este módulo.'
      );
      return;
    }

    const confirmed = window.confirm(
      `¿Deseas desactivar el acceso de ${user.name} (${user.email})?`
    );

    if (!confirmed) return;

    setErrorMessage('');
    setSuccessMessage('');
    setDeletingId(String(user.id));

    try {
      const response = await fetch(
        `/api/users/${encodeURIComponent(String(user.id))}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
        }
      );

      await readResponse(response);

      setSuccessMessage(
        'El acceso del usuario fue desactivado.'
      );

      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo desactivar el usuario.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const getRoleName = (roleId: string) => {
    return roles.find((role) => role.id === roleId)?.name || roleId;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-1 text-xl font-bold text-white">
            Configuración de Roles y Personal
          </h2>
          <p className="text-sm text-slate-400">
            Administra las cuentas de acceso y los permisos del personal.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:border-cyan-500 disabled:opacity-50"
        >
          {loading ? 'Actualizando...' : '↻ Actualizar'}
        </button>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300"
        >
          {successMessage}
        </div>
      )}

      <section>
        <h3 className="mb-3 text-lg font-bold text-white">
          Roles y permisos
        </h3>

        {loading && roles.length === 0 ? (
          <p className="text-sm text-slate-400">Cargando roles...</p>
        ) : roles.length === 0 ? (
          <p className="rounded-xl border border-slate-800 p-4 text-sm text-slate-400">
            No hay roles disponibles. Verifica la API de roles y la base de datos.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {roles.map((role) => (
              <div
                key={role.id}
                className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-base font-bold text-white">
                    {role.name}
                  </h4>
                  <span className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 font-mono text-xs uppercase text-cyan-400">
                    {role.id}
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  {role.description || 'Sin descripción.'}
                </p>

                <div className="space-y-1 border-t border-slate-800 pt-2">
                  <p className="text-xs font-semibold text-slate-300">
                    Permisos asignados:
                  </p>

                  {role.permissions && role.permissions.length > 0 ? (
                    <ul className="space-y-1 text-xs text-slate-400">
                      {role.permissions.map((permission) => {
                        const item = ALL_PERMISSIONS.find(
                          (entry) => entry.key === permission
                        );

                        return (
                          <li key={permission}>
                            • {item?.label || permission}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">
                      No se han devuelto permisos para este rol.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 border-t border-slate-800 pt-6">
        <h3 className="mb-1 text-lg font-bold text-white">
          Registrar empleado / usuario
        </h3>
        <p className="mb-4 text-sm text-slate-400">
          La cuenta se guardará en la base de datos y podrá utilizarse en el inicio de sesión.
        </p>

        <form
          onSubmit={handleAddUser}
          className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 md:grid-cols-2"
        >
          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Nombre completo
            </label>
            <input
              type="text"
              autoComplete="name"
              placeholder="Ej. María Gómez"
              value={newUserName}
              onChange={(event) => setNewUserName(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              required
              maxLength={120}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Correo electrónico para iniciar sesión
            </label>
            <input
              type="email"
              autoComplete="email"
              placeholder="Ej. maria@empresa.com"
              value={newUserEmail}
              onChange={(event) => setNewUserEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              required
              maxLength={254}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Contraseña
            </label>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              value={newUserPassword}
              onChange={(event) => setNewUserPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              required
              minLength={8}
              maxLength={128}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Confirmar contraseña
            </label>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Repite la contraseña"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              required
              minLength={8}
              maxLength={128}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Rol asignado
            </label>
            <select
              value={newUserRole}
              onChange={(event) => setNewUserRole(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              required
              disabled={roles.length === 0}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving || loading || roles.length === 0}
              className="w-full rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Registrando...' : '+ Registrar usuario'}
            </button>
          </div>
        </form>
      </section>

      <section className="border-t border-slate-800 pt-6">
        <h3 className="mb-3 text-lg font-bold text-white">
          Personal registrado en la base de datos
        </h3>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950 text-xs uppercase text-slate-400">
              <tr>
                <th className="p-3">Nombre</th>
                <th className="p-3">Correo / Login</th>
                <th className="p-3">Rol</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {users.map((user) => (
                <tr key={String(user.id)} className="hover:bg-slate-800/40">
                  <td className="p-3 font-medium text-white">
                    {user.name}
                  </td>

                  <td className="p-3 font-mono text-cyan-400">
                    {user.email || 'Sin correo'}
                  </td>

                  <td className="p-3 text-xs font-semibold uppercase">
                    <span className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-200">
                      {getRoleName(user.role)}
                    </span>
                  </td>

                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDeleteUser(user)}
                      disabled={deletingId === String(user.id)}
                      className="rounded border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      {deletingId === String(user.id)
                        ? 'Procesando...'
                        : 'Desactivar'}
                    </button>
                  </td>
                </tr>
              ))}

              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-500">
                    No hay usuarios activos registrados.
                  </td>
                </tr>
              )}

              {loading && users.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-500">
                    Cargando usuarios...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          Desactivar un usuario retira su acceso sin borrar físicamente su registro.
        </p>
      </section>
    </div>
  );
}
