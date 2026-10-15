'use client';

import React, { useEffect, useState } from 'react';

interface CashRegisterModuleProps {
  exchangeRate: number;
  currentUsername: string;
  userRole: string;
}

interface CashRegister {
  id: number;
  user_id: number;
  opening_date?: string;
  closing_date?: string | null;
  opening_usd: number;
  opening_ves: number;
  closing_usd?: number | null;
  closing_ves?: number | null;
  status: string;
}

export default function CashRegisterModule({
  exchangeRate,
  currentUsername,
  userRole,
}: CashRegisterModuleProps) {

  const [isOpened, setIsOpened] = useState<boolean | null>(null);

  const [openingUSD, setOpeningUSD] = useState('');
  const [openingBs, setOpeningBs] = useState('');

  const [closingModal, setClosingModal] = useState(false);

  const [openedBy, setOpenedBy] = useState('');
  const [registerId, setRegisterId] = useState<number | null>(null);

  const [countedUSD, setCountedUSD] = useState('');
  const [countedBs, setCountedBs] = useState('');

  const [userId, setUserId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // ==================================================
  // OBTENER USUARIO LOGUEADO
  // ==================================================

  useEffect(() => {

    try {

      const storedUser = localStorage.getItem('pos_user');

      console.log('USUARIO GUARDADO EN LOCALSTORAGE:', storedUser);

      if (!storedUser) {
        console.error(
          'No existe pos_user en localStorage.'
        );

        setUserId(null);
        return;
      }

      const user = JSON.parse(storedUser);

      console.log('USUARIO PARSEADO:', user);

      const id = Number(user.id);

      if (!id || !Number.isFinite(id)) {

        console.error(
          'El usuario no tiene un ID válido:',
          user
        );

        setUserId(null);
        return;
      }

      setUserId(id);

    } catch (error) {

      console.error(
        'Error leyendo pos_user:',
        error
      );

      setUserId(null);
    }

  }, []);

  // ==================================================
  // CONSULTAR ESTADO DE CAJA
  // ==================================================

  const checkCashStatus = async () => {

    try {

      setLoading(true);

      const res = await fetch(
        '/api/cash',
        {
          method: 'GET',
          cache: 'no-store',
        }
      );

      const data = await res.json();

      console.log(
        'RESPUESTA /api/cash:',
        data
      );

      if (
        res.ok &&
        data.isOpen &&
        data.register
      ) {

        setIsOpened(true);

        setRegisterId(
          Number(data.register.id)
        );

        setOpenedBy(
          currentUsername ||
          'Usuario'
        );

        setOpeningUSD(
          String(
            data.register.opening_usd ?? 0
          )
        );

        setOpeningBs(
          String(
            data.register.opening_ves ?? 0
          )
        );

      } else {

        setIsOpened(false);
        setRegisterId(null);
        setOpenedBy('');
        setOpeningUSD('');
        setOpeningBs('');
      }

    } catch (error) {

      console.error(
        'Error consultando caja:',
        error
      );

      setIsOpened(false);
      setRegisterId(null);

    } finally {

      setLoading(false);

    }
  };

  // ==================================================
  // CONSULTAR CUANDO TENEMOS EL USER ID
  // ==================================================

  useEffect(() => {

    if (userId !== null) {
      checkCashStatus();
    }

  }, [userId]);

  // ==================================================
  // ABRIR CAJA
  // ==================================================

  const handleOpenRegister = async (
    e: React.FormEvent
  ) => {

    e.preventDefault();

    if (processing) return;

    if (userId === null) {

      alert(
        'No se pudo identificar el usuario actual. Cierre sesión e ingrese nuevamente.'
      );

      return;
    }

    const usd = Number(openingUSD) || 0;
    const ves = Number(openingBs) || 0;

    if (usd < 0 || ves < 0) {

      alert(
        'El fondo inicial no puede ser negativo.'
      );

      return;
    }

    if (usd === 0 && ves === 0) {

      alert(
        'Debe ingresar un fondo inicial en USD o Bs.'
      );

      return;
    }

    try {

      setProcessing(true);

      console.log(
        'ABRIENDO CAJA:',
        {
          action: 'open',
          userId,
          openingUSD: usd,
          openingBs: ves,
        }
      );

      const res = await fetch(
        '/api/cash',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            action: 'open',

            openingUSD: usd,

            openingBs: ves,

            userId: userId,
          }),
        }
      );

      const data = await res.json();

      console.log(
        'RESPUESTA APERTURA:',
        data
      );

      if (!res.ok || !data.success) {

        alert(
          data.error ||
          'Error al abrir la caja.'
        );

        return;
      }

      alert(
        '¡Caja abierta exitosamente!\n\n' +
        'El turno permanecerá abierto aunque cambie de pantalla.'
      );

      // IMPORTANTE:
      // Consultamos nuevamente la base de datos
      await checkCashStatus();

    } catch (error) {

      console.error(
        'ERROR ABRIENDO CAJA:',
        error
      );

      alert(
        'Error de conexión al intentar abrir la caja.'
      );

    } finally {

      setProcessing(false);

    }
  };

  // ==================================================
  // CERRAR CAJA
  // ==================================================

  const handleCloseRegister = async () => {

    if (processing) return;

    if (!registerId) {

      alert(
        'No se encontró el ID de la caja abierta.'
      );

      return;
    }

    try {

      setProcessing(true);

      const usd = Number(countedUSD) || 0;
      const ves = Number(countedBs) || 0;

      const res = await fetch(
        '/api/cash',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            action: 'close',

            countedUSD: usd,

            countedBs: ves,

            registerId: registerId,

            userId: userId,
          }),
        }
      );

      const data = await res.json();

      console.log(
        'RESPUESTA CIERRE:',
        data
      );

      if (!res.ok || !data.success) {

        alert(
          data.error ||
          'Error al cerrar la caja.'
        );

        return;
      }

      alert(
        'Turno cerrado correctamente.'
      );

      setClosingModal(false);

      setCountedUSD('');
      setCountedBs('');

      await checkCashStatus();

    } catch (error) {

      console.error(
        'ERROR CERRANDO CAJA:',
        error
      );

      alert(
        'Error de conexión al cerrar la caja.'
      );

    } finally {

      setProcessing(false);

    }
  };

  // ==================================================
  // CARGANDO
  // ==================================================

  if (loading) {

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-xs text-slate-500">
        Verificando estado de caja...
      </div>
    );
  }

  // ==================================================
  // RENDER
  // ==================================================

  return (

    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">

      {/* HEADER */}

      <div className="flex justify-between items-center border-b border-slate-100 pb-3">

        <h3 className="text-lg font-bold text-slate-800">
          🔐 Módulo de Caja Chica
        </h3>

        <span
          className={`
            text-xs
            font-bold
            px-2.5
            py-1
            rounded-full
            ${
              isOpened
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
            }
          `}
        >
          Caja {isOpened ? 'Abierta' : 'Cerrada'}
        </span>

      </div>

      {/* ==================================================
          CAJA CERRADA
      ================================================== */}

      {!isOpened && (

        <form
          onSubmit={handleOpenRegister}
          className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200"
        >

          <div className="text-xs font-bold text-blue-600">
            Apertura de Turno
          </div>

          <div className="text-[11px] text-slate-500 mb-2">
            Usuario: {currentUsername || 'Usuario'}
          </div>

          <div className="text-[11px] text-slate-500 mb-3">
            Rol: {userRole || 'cajero'}
          </div>

          <div className="grid grid-cols-2 gap-3">

            <div>

              <label className="block text-[11px] text-slate-600 mb-1">
                Efectivo USD ($)
              </label>

              <input
                type="number"
                step="0.01"
                min="0"
                value={openingUSD}
                onChange={(e) =>
                  setOpeningUSD(e.target.value)
                }
                placeholder="0.00"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold"
              />

            </div>

            <div>

              <label className="block text-[11px] text-slate-600 mb-1">
                Efectivo Bs (Bs.)
              </label>

              <input
                type="number"
                step="0.01"
                min="0"
                value={openingBs}
                onChange={(e) =>
                  setOpeningBs(e.target.value)
                }
                placeholder="0.00"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold"
              />

            </div>

          </div>

          <button
            type="submit"
            disabled={
              processing ||
              userId === null
            }
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-sm"
          >

            {processing
              ? 'Abriendo caja...'
              : 'Iniciar Turno y Abrir Caja 🔓'}

          </button>

        </form>

      )}

      {/* ==================================================
          CAJA ABIERTA
      ================================================== */}

      {isOpened && (

        <div className="space-y-3">

          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs space-y-1 text-emerald-800">

            <div>
              Turno activo para:{' '}
              <strong>
                {openedBy}
              </strong>
            </div>

            <div>
              ID Registro:{' '}
              <strong>
                #{registerId}
              </strong>
            </div>

            <div>
              Fondo inicial:{' '}
              <strong>
                ${Number(openingUSD).toFixed(2)} USD
              </strong>
              {' / '}
              <strong>
                Bs. {Number(openingBs).toFixed(2)}
              </strong>
            </div>

          </div>

          <button
            onClick={() =>
              setClosingModal(true)
            }
            disabled={processing}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-sm"
          >
            Realizar Conteo Ciego y Cerrar Turno 🔒
          </button>

        </div>

      )}

      {/* ==================================================
          MODAL CIERRE
      ================================================== */}

      {closingModal && (

        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">

          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 shadow-xl space-y-4">

            <h3 className="text-lg font-bold text-slate-800">
              Cierre de Turno
            </h3>

            <p className="text-xs text-slate-500">
              Ingrese el efectivo físico contado en caja:
            </p>

            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Total USD contado ($)"
              value={countedUSD}
              onChange={(e) =>
                setCountedUSD(e.target.value)
              }
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold"
            />

            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Total Bs contado (Bs.)"
              value={countedBs}
              onChange={(e) =>
                setCountedBs(e.target.value)
              }
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold"
            />

            <div className="flex gap-2 pt-2">

              <button
                type="button"
                onClick={() =>
                  setClosingModal(false)
                }
                disabled={processing}
                className="flex-1 bg-slate-100 py-2.5 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleCloseRegister}
                disabled={processing}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold shadow-sm"
              >
                {processing
                  ? 'Cerrando...'
                  : 'Cerrar Turno ✓'}
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}
