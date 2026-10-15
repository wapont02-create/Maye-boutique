'use client';

import {
  ChangeEvent,
  useEffect,
  useState,
} from 'react';

import {
  User,
  getUsers,
} from '../utils/rolesManager';

interface RoleSelectorProps {
  /**
   * ID del usuario seleccionado.
   *
   * Todos los IDs del sistema son string.
   */
  selectedId?: string;

  /**
   * Se ejecuta cuando se selecciona un usuario.
   */
  onSelect?: (user: User | null) => void;

  /**
   * Valor alternativo para componentes
   * que utilizan una API tipo select.
   */
  value?: string;

  /**
   * Se ejecuta cuando cambia el usuario.
   */
  onChange?: (user: User | null) => void;

  /**
   * Texto mostrado encima del selector.
   */
  label?: string;

  /**
   * Deshabilita el selector.
   */
  disabled?: boolean;

  /**
   * Clases adicionales.
   */
  className?: string;
}

export default function RoleSelector({
  selectedId,
  onSelect,
  value,
  onChange,
  label = 'Usuario',
  disabled = false,
  className = '',
}: RoleSelectorProps) {
  const [users, setUsers] = useState<User[]>([]);

  /**
   * Cargar usuarios desde el administrador
   * centralizado de roles.
   */
  useEffect(() => {
    const loadUsers = () => {
      try {
        const loadedUsers = getUsers();

        setUsers(
          Array.isArray(loadedUsers)
            ? loadedUsers
            : []
        );
      } catch (error) {
        console.error(
          'Error cargando usuarios:',
          error
        );

        setUsers([]);
      }
    };

    loadUsers();

    /**
     * Mantenemos sincronizado el selector
     * con los usuarios guardados en localStorage.
     */
    const interval = setInterval(
      loadUsers,
      1000
    );

    return () => {
      clearInterval(interval);
    };
  }, []);

  /**
   * Valor actualmente seleccionado.
   */
  const currentValue =
    value !== undefined
      ? value
      : selectedId !== undefined
      ? selectedId
      : '';

  /**
   * Manejar selección de usuario.
   */
  const handleChange = (
    e: ChangeEvent<HTMLSelectElement>
  ) => {
    const newId = e.target.value;

    /**
     * Si no seleccionó ningún usuario.
     */
    if (!newId) {
      onSelect?.(null);
      onChange?.(null);
      return;
    }

    /**
     * User.id es string.
     * El valor del <select> también es string.
     */
    const found = users.find(
      (user) => user.id === newId
    );

    /**
     * Notificar al componente padre.
     */
    onSelect?.(found || null);
    onChange?.(found || null);
  };

  return (
    <div
      className={`space-y-1 ${className}`}
    >
      <label className="block text-xs font-bold text-slate-600">
        {label}
      </label>

      <select
        value={currentValue}
        onChange={handleChange}
        disabled={disabled}
        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 disabled:opacity-50"
      >
        <option value="">
          Seleccionar usuario
        </option>

        {users.map((user) => (
          <option
            key={user.id}
            value={user.id}
          >
            {user.name} (@{user.username})
          </option>
        ))}
      </select>
    </div>
  );
}
