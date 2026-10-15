'use client';

import { useState, useEffect } from 'react';
import RolesManagerModule from '../../components/RolesManagerModule';
import WebOrdersModule from '../../components/WebOrdersModule';
import { getRoles, getUsers } from '../../utils/rolesManager';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

type Product = {
  id: number;
  name: string;
  costPrice: number;
  price: number;
  category: string;
  description?: string;
  taxable: boolean;
  stock: number;
  image?: string;
  active?: boolean;
  hasSales?: boolean;
};

type CartItem = Product & {
  quantity: number;
};

type PaymentMethodType =
  | 'Efectivo USD'
  | 'Efectivo Bs'
  | 'Pago Móvil'
  | 'Zelle'
  | 'Binance Pay'
  | 'Crédito / Fiado'
  | 'Pago mixto';

type SaleRecord = {
  id: number;
  date: string;
  items: CartItem[];
  subtotalUSD: number;
  ivaUSD: number;
  totalUSD: number;
  totalBs: number;
  exchangeRate: number;
  paymentMethod: PaymentMethodType;
  changeUSD: number;
  clientName?: string;
  created_at?: string;
  cashRegisterId?: number;
};

type CreditAccount = {
  id: number;
  clientName: string;
  clientPhone: string;
  clientDocument: string;
  totalDebtUSD: number;
  totalDebtBs: number;
  date: string;
  status: 'Pendiente' | 'Pagado';
  saleId: number;
};

type PayableAccount = {
  id: number;
  providerName: string;
  providerDocument: string;
  description: string;
  totalDebtUSD: number;
  totalDebtBs: number;
  dueDate: string;
  date: string;
  status: 'Pendiente' | 'Pagado';
};

const IVA_RATE = 0.16;

async function readJson<T = any>(
  response: Response
): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Respuesta inválida del servidor (${response.status}): ${text.slice(
        0,
        200
      )}`
    );
  }
}

/* ============================================================
   SELECTOR DE CLIENTES
============================================================ */

function POSCustomerSelector({
  onSelectCustomer
}: {
  onSelectCustomer: (client: {
    name: string;
    document: string;
    phone: string;
  }) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const [newName, setNewName] = useState('');
  const [newDoc, setNewDoc] = useState('');
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    if (query.length > 1) {
      fetch(
        `/api/customers?q=${encodeURIComponent(query)}`
      )
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setResults(data);
            setShowDropdown(true);
          }
        })
        .catch(err =>
          console.error(
            'Error buscando clientes:',
            err
          )
        );
    } else {
      setResults([]);
      setShowDropdown(false);
    }
  }, [query]);

  const handleRegisterQuickCustomer = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!newName.trim()) return;

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body: JSON.stringify({
          name: newName,
          rif_ci: newDoc,
          phone: newPhone
        })
      });

      const data = await readJson(res);

      if (data.success) {
        onSelectCustomer({
          name: newName,
          document:
            newDoc || 'V-00000000',
          phone: newPhone || 'N/A'
        });

        setIsAddingNew(false);
        setQuery(newName);
        setNewName('');
        setNewDoc('');
        setNewPhone('');

        alert(
          '¡Cliente registrado y seleccionado!'
        );
      } else {
        alert(
          'Error: ' +
            (data.error ||
              'No se pudo registrar el cliente.')
        );
      }
    } catch (err) {
      console.error(err);
      alert(
        'Error de red al registrar el cliente.'
      );
    }
  };

  return (
    <div className="relative space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="🔍 Buscar cliente (Nombre / Cédula)..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition shadow-2xs"
          />

          {showDropdown &&
            results.length > 0 && (
              <ul className="absolute z-20 w-full bg-white border border-slate-200 mt-1 shadow-xl max-h-40 overflow-y-auto rounded-xl text-xs">
                {results.map((c: any) => (
                  <li
                    key={c.id}
                    className="p-2.5 hover:bg-blue-50 cursor-pointer border-b border-slate-100 flex justify-between items-center transition"
                    onClick={() => {
                      onSelectCustomer({
                        name: c.name,
                        document:
                          c.rif_ci ||
                          'N/A',
                        phone:
                          c.phone ||
                          'N/A'
                      });

                      setQuery(c.name);
                      setShowDropdown(
                        false
                      );
                    }}
                  >
                    <span className="font-bold text-slate-800">
                      {c.name}
                    </span>

                    <span className="text-slate-500">
                      {c.rif_ci}
                    </span>
                  </li>
                ))}
              </ul>
            )}
        </div>

        <button
          type="button"
          onClick={() =>
            setIsAddingNew(
              !isAddingNew
            )
          }
          className="bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 px-3 py-2.5 rounded-xl text-xs font-bold transition shadow-2xs"
        >
          {isAddingNew
            ? 'Cancelar'
            : '+ Nuevo'}
        </button>
      </div>

      {isAddingNew && (
        <form
          onSubmit={
            handleRegisterQuickCustomer
          }
          className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200 space-y-2.5 animate-fadeIn"
        >
          <div className="text-[11px] font-extrabold text-blue-900">
            Registro Rápido de Cliente
          </div>

          <input
            type="text"
            placeholder="Nombre y Apellido *"
            required
            value={newName}
            onChange={e =>
              setNewName(
                e.target.value
              )
            }
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-2xs"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Cédula / RIF"
              value={newDoc}
              onChange={e =>
                setNewDoc(
                  e.target.value
                )
              }
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-2xs"
            />

            <input
              type="text"
              placeholder="Teléfono"
              value={newPhone}
              onChange={e =>
                setNewPhone(
                  e.target.value
                )
              }
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-2xs"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2 text-xs font-bold shadow-sm transition"
          >
            Guardar y Seleccionar ⚡
          </button>
        </form>
      )}
    </div>
  );
}

/* ============================================================
   DIRECTORIO DE CLIENTES
============================================================ */

function CustomersDirectoryModule() {
  const [customers, setCustomers] =
    useState<any[]>([]);
  const [name, setName] = useState('');
  const [rifCi, setRifCi] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    fetch('/api/customers')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCustomers(data);
        }
      })
      .catch(err =>
        console.error(err)
      );
  }, []);

  const handleSaveCustomer = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!name.trim()) return;

    try {
      const res = await fetch(
        '/api/customers',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            name,
            rif_ci: rifCi,
            phone,
            address
          })
        }
      );

      const data = await readJson(res);

      if (data.success) {
        alert(
          '¡Cliente guardado con éxito!'
        );

        setName('');
        setRifCi('');
        setPhone('');
        setAddress('');

        const updated = await fetch(
          '/api/customers'
        ).then(r => r.json());

        if (Array.isArray(updated)) {
          setCustomers(updated);
        }
      } else {
        alert(
          'Error: ' +
            (data.error ||
              'No se pudo guardar.')
        );
      }
    } catch (err) {
      console.error(err);
      alert('Error de red.');
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-lg font-extrabold text-slate-800">
            👥 Directorio de Clientes Frecuentes
          </h3>

          <p className="text-xs text-slate-500">
            Base de datos de compradores para
            créditos y facturación rápida.
          </p>
        </div>

        <span className="text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl border border-blue-200">
          Total: {customers.length}
        </span>
      </div>

      <form
        onSubmit={handleSaveCustomer}
        className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200"
      >
        <input
          type="text"
          placeholder="Nombre *"
          required
          value={name}
          onChange={e =>
            setName(e.target.value)
          }
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-2xs"
        />

        <input
          type="text"
          placeholder="Cédula / RIF"
          value={rifCi}
          onChange={e =>
            setRifCi(e.target.value)
          }
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-2xs"
        />

        <input
          type="text"
          placeholder="Teléfono"
          value={phone}
          onChange={e =>
            setPhone(e.target.value)
          }
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-2xs"
        />

        <input
          type="text"
          placeholder="Dirección"
          value={address}
          onChange={e =>
            setAddress(e.target.value)
          }
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-2xs"
        />

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl text-xs shadow-sm transition"
        >
          Registrar 💾
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 uppercase font-bold text-[10px]">
              <th className="p-3">
                Cliente
              </th>
              <th className="p-3">
                Cédula / RIF
              </th>
              <th className="p-3">
                Teléfono
              </th>
              <th className="p-3">
                Dirección
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {customers.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="text-center py-8 text-slate-400"
                >
                  No hay clientes registrados.
                </td>
              </tr>
            )}

            {customers.map(
              (c, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-slate-50/60 transition"
                >
                  <td className="p-3 font-bold text-slate-800">
                    {c.name}
                  </td>

                  <td className="p-3 text-slate-600">
                    {c.rif_ci || 'N/A'}
                  </td>

                  <td className="p-3 text-slate-600">
                    {c.phone || 'N/A'}
                  </td>

                  <td className="p-3 text-slate-600">
                    {c.address || 'N/A'}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================
   DASHBOARD POS
============================================================ */

export default function DashboardPOS() {
  const [isMounted, setIsMounted] =
    useState(false);

  const [activeTab, setActiveTab] =
    useState<
      | 'welcome'
      | 'pos'
      | 'inventory'
      | 'reports'
      | 'accounts'
      | 'customers'
      | 'roles'
    >('welcome');

  const [products, setProducts] =
    useState<Product[]>([]);

  const [categoriesList, setCategoriesList] =
    useState<string[]>([
      'Comida',
      'Bebidas',
      'COMBOS ESPECIALES',
      'ROLLS FAVORITOS'
    ]);

  const [newCategoryInput, setNewCategoryInput] =
    useState('');

  const [isAddingCategory, setIsAddingCategory] =
    useState(false);

  const [salesHistory, setSalesHistory] =
    useState<SaleRecord[]>([]);

  const [credits, setCredits] =
    useState<CreditAccount[]>([]);

  const [payables, setPayables] =
    useState<PayableAccount[]>([]);

  const [exchangeRate, setExchangeRate] =
    useState<number>(778.33);

  const [
    isSavingExchangeRate,
    setIsSavingExchangeRate
  ] = useState(false);

  const [
    exchangeRateMessage,
    setExchangeRateMessage
  ] = useState('');

  const [
    exchangeRateSource,
    setExchangeRateSource
  ] = useState<string | null>(null);

  const [currentUsername, setCurrentUsername] =
    useState<string>('');

  const [
    authenticatedUser,
    setAuthenticatedUser
  ] = useState<any>(null);

  const authenticatedUserId: number =
    Number(authenticatedUser?.id) || 0;

  const [rolesList, setRolesList] =
    useState(getRoles());

  const [usersList, setUsersList] =
    useState(getUsers());

  /* ============================================================
     CAJA
  ============================================================ */

  const [isCashOpen, setIsCashOpen] =
    useState(false);

  const [activeRegisterId, setActiveRegisterId] =
    useState<number | null>(null);

  const [showOpenCashModal, setShowOpenCashModal] =
    useState(false);

  const [showCloseCashModal, setShowCloseCashModal] =
    useState(false);

  const [openingUSD, setOpeningUSD] =
    useState('');

  const [openingBs, setOpeningBs] =
    useState('');

  const [countedUSD, setCountedUSD] =
    useState('');

  const [countedBs, setCountedBs] =
    useState('');

  const [cashClosingReport, setCashClosingReport] =
    useState<any | null>(null);

  const [showCashClosingReport, setShowCashClosingReport] =
    useState(false);

  /* ============================================================
     INVENTARIO
  ============================================================ */

  const [
    isRestockModalOpen,
    setIsRestockModalOpen
  ] = useState(false);

  const [
    selectedProductForRestock,
    setSelectedProductForRestock
  ] = useState<Product | null>(null);

  const [restockAmount, setRestockAmount] =
    useState('');

  const [isEditModalOpen, setIsEditModalOpen] =
    useState(false);

  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null);

  const [editName, setEditName] =
    useState('');

  const [editPrice, setEditPrice] =
    useState('');

  const [editCostPrice, setEditCostPrice] =
    useState('');

  const [editStock, setEditStock] =
    useState('');

  const [editCategory, setEditCategory] =
    useState('');

  const [editDescription, setEditDescription] =
    useState('');

  const [editImage, setEditImage] =
    useState('');

  const [
    inventoryFilterMode,
    setInventoryFilterMode
  ] = useState<'all' | 'low'>(
    'all'
  );

  const [
    reportFilterPeriod,
    setReportFilterPeriod
  ] = useState<
    'all' | 'today' | 'week' | 'month'
  >('all');

  /* ============================================================
     CUENTAS
  ============================================================ */

  const [newProviderName, setNewProviderName] =
    useState('');

  const [newProviderDoc, setNewProviderDoc] =
    useState('');

  const [newPayableDesc, setNewPayableDesc] =
    useState('');

  const [
    newPayableAmountUSD,
    setNewPayableAmountUSD
  ] = useState('');

  const [newDueDate, setNewDueDate] =
    useState('');

  /* ============================================================
     CARRITO / CHECKOUT
  ============================================================ */

  const [cart, setCart] =
    useState<CartItem[]>([]);

  const [
    isCheckoutModalOpen,
    setIsCheckoutModalOpen
  ] = useState(false);

  const [cashGivenUSD, setCashGivenUSD] =
    useState<string>('');

  const [isMixedPayment, setIsMixedPayment] =
    useState(false);

  const [mixedCashUSD, setMixedCashUSD] =
    useState('');

  const [mixedCashBs, setMixedCashBs] =
    useState('');

  const [mixedPagoMovilBs, setMixedPagoMovilBs] =
    useState('');

  const [mixedZelleUSD, setMixedZelleUSD] =
    useState('');

  const [mixedBinanceUSD, setMixedBinanceUSD] =
    useState('');

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodType>(
      'Efectivo USD'
    );

  const [clientName, setClientName] =
    useState('');

  const [clientPhone, setClientPhone] =
    useState('');

  const [clientDocument, setClientDocument] =
    useState('');

  const [searchTerm, setSearchTerm] =
    useState('');

  const [selectedCategory, setSelectedCategory] =
    useState('Todos');

  /* ============================================================
     PEDIDO WEB CARGADO EN POS
  ============================================================ */

  const [loadedWebOrder, setLoadedWebOrder] =
    useState<any | null>(null);

  /* ============================================================
     NUEVO PRODUCTO
  ============================================================ */

  const [newName, setNewName] =
    useState('');

  const [newCostPrice, setNewCostPrice] =
    useState('');

  const [newPrice, setNewPrice] =
    useState('');

  const [newCategory, setNewCategory] =
    useState('Comida');

  const [newDescription, setNewDescription] =
    useState('');

  const [newTaxable, setNewTaxable] =
    useState(true);

  const [newStock, setNewStock] =
    useState('');

  const [newImage, setNewImage] =
    useState('');

  const [selectedFileName, setSelectedFileName] =
    useState('');

  const [
    isUploadingImage,
    setIsUploadingImage
  ] = useState(false);

  /* ============================================================
     TICKET / ÉXITO
  ============================================================ */

  const [lastPrintedSale, setLastPrintedSale] =
    useState<any>(null);

  const [
    successModalData,
    setSuccessModalData
  ] = useState<{
    isOpen: boolean;
    changeUSD: number;
    changeBs: number;
    isCredit: boolean;
    clientName?: string;
  } | null>(null);

  /* ============================================================
     SUBIR IMAGEN
  ============================================================ */

  const handleImageUploadToImgBB = async (
    e: React.ChangeEvent<HTMLInputElement>,
    isEditMode = false
  ) => {
    const files = e.target.files;

    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];

    if (!isEditMode) {
      setSelectedFileName(
        file.name
      );
    }

    setIsUploadingImage(true);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(
        '/api/upload',
        {
          method: 'POST',
          body: formData
        }
      );

      const data = await response.json();

      if (data.success) {
        if (isEditMode) {
          setEditImage(data.url);
        } else {
          setNewImage(data.url);
        }
      } else {
        alert(
          'Error al subir la imagen: ' +
            (data.error ||
              'Desconocido')
        );
      }
    } catch (error) {
      console.error('Error:', error);

      alert(
        'Error de red al conectar con el servidor.'
      );
    } finally {
      setIsUploadingImage(false);
    }
  };

  /* ============================================================
     CATEGORÍAS
  ============================================================ */

  const handleCreateCategory = (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!newCategoryInput.trim()) {
      return;
    }

    const formattedCat =
      newCategoryInput
        .trim()
        .toUpperCase();

    if (
      !categoriesList.includes(
        formattedCat
      )
    ) {
      setCategoriesList(prev => [
        ...prev,
        formattedCat
      ]);
    }

    setNewCategory(formattedCat);
    setNewCategoryInput('');
    setIsAddingCategory(false);

    alert(
      `¡Categoría "${formattedCat}" creada y seleccionada!`
    );
  };

  /* ============================================================
     USUARIO ACTUAL
  ============================================================ */

  const currentUserObj =
    (authenticatedUserId
      ? usersList.find(
          (u: any) =>
            Number(u?.id) ===
            authenticatedUserId
        )
      : undefined) ||
    authenticatedUser ||
    usersList[0];

  const currentRoleObj =
    rolesList.find((r: any) => {
      const roleId = String(
        r.id ?? ''
      ).toLowerCase();

      const roleName = String(
        r.name ?? ''
      ).toLowerCase();

      const userRole = String(
        currentUserObj?.role ?? ''
      ).toLowerCase();

      return (
        roleId === userRole ||
        roleName === userRole
      );
    }) || rolesList[0];

  const userPermissions =
    currentRoleObj
      ? currentRoleObj.permissions
      : [];

  /* ============================================================
     VERIFICAR CAJA
  ============================================================ */

  const checkCashRegisterStatus =
    async (
      onOpenPOS = false
    ) => {
      try {
        const userId =
          authenticatedUserId;

        if (
          !Number.isInteger(
            userId
          ) ||
          userId <= 0
        ) {
          console.error(
            'Usuario actual inválido:',
            currentUserObj
          );
          return;
        }

        const res = await fetch(
          `/api/cash?userId=${userId}`,
          {
            method: 'GET',
            cache: 'no-store'
          }
        );

        const data =
          await readJson(res);

        if (
          data.success &&
          data.isOpen &&
          data.register
        ) {
          const registerId =
            Number(
              data.register.id
            );

          setIsCashOpen(true);
          setActiveRegisterId(
            registerId
          );

          if (onOpenPOS) {
            setActiveTab('pos');
          }
        } else {
          setIsCashOpen(false);
          setActiveRegisterId(
            null
          );

          if (onOpenPOS) {
            setShowOpenCashModal(
              true
            );
          }
        }
      } catch (error) {
        console.error(
          'Error verificando estatus de caja:',
          error
        );

        if (onOpenPOS) {
          setShowOpenCashModal(
            true
          );
        }
      }
    };

  /* ============================================================
     TASA DE CAMBIO
  ============================================================ */

  const loadExchangeRate = async () => {
    try {
      const res = await fetch(
        '/api/exchange-rate',
        {
          method: 'GET',
          cache: 'no-store'
        }
      );

      const data =
        await readJson(res);

      const parsedRate = Number(
        data.rate
      );

      if (
        data.success &&
        Number.isFinite(
          parsedRate
        ) &&
        parsedRate > 0
      ) {
        setExchangeRate(
          parsedRate
        );

        setExchangeRateSource(
          data.source || null
        );

        return;
      }

      setExchangeRateSource(
        data.source || null
      );
    } catch (error) {
      console.error(
        'Error cargando la tasa de cambio:',
        error
      );
    }
  };

  const handleSaveExchangeRate =
    async () => {
      const rate = Number(
        exchangeRate
      );

      if (
        !Number.isFinite(rate) ||
        rate <= 0
      ) {
        alert(
          'Ingresa una tasa de cambio válida.'
        );
        return;
      }

      if (!authenticatedUserId) {
        alert(
          'No se pudo identificar al usuario autenticado.'
        );
        return;
      }

      setIsSavingExchangeRate(
        true
      );

      setExchangeRateMessage('');

      try {
        const res = await fetch(
          '/api/exchange-rate',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify({
              rate,
              userId:
                authenticatedUserId
            })
          }
        );

        const data =
          await readJson(res);

        if (
          !res.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              data.message ||
              'No se pudo guardar la tasa.'
          );
        }

        const savedRate = Number(
          data.rate
        );

        if (
          Number.isFinite(
            savedRate
          ) &&
          savedRate > 0
        ) {
          setExchangeRate(
            savedRate
          );
        }

        setExchangeRateSource(
          data.source || 'manual'
        );

        setExchangeRateMessage(
          'Tasa guardada correctamente en SQLite Cloud.'
        );

        await loadExchangeRate();
      } catch (error: any) {
        console.error(
          'Error guardando tasa de cambio:',
          error
        );

        setExchangeRateMessage(
          error?.message ||
            'No se pudo guardar la tasa.'
        );
      } finally {
        setIsSavingExchangeRate(
          false
        );
      }
    };

  /* ============================================================
     CARGA INICIAL
  ============================================================ */

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (
      !isMounted ||
      typeof window === 'undefined'
    )
      return;

    try {
      const savedUser =
        localStorage.getItem(
          'pos_user'
        );

      if (!savedUser) return;

      const parsedUser =
        JSON.parse(savedUser);

      const userId = Number(
        parsedUser?.id
      );

      if (
        !Number.isInteger(
          userId
        ) ||
        userId <= 0
      ) {
        console.error(
          'pos_user no contiene un ID válido:',
          parsedUser
        );
        return;
      }

      setAuthenticatedUser({
        ...parsedUser,
        id: userId
      });

      setCurrentUsername(
        parsedUser?.name ||
          parsedUser?.email ||
          ''
      );
    } catch (error) {
      console.error(
        'Error leyendo pos_user:',
        error
      );
    }
  }, [isMounted]);

  useEffect(() => {
    if (
      !isMounted ||
      !authenticatedUserId
    )
      return;

    checkCashRegisterStatus(
      false
    );

    if (
      typeof window !==
      'undefined'
    ) {
      const savedCredits =
        localStorage.getItem(
          'pos_credits'
        );

      if (savedCredits) {
        try {
          setCredits(
            JSON.parse(
              savedCredits
            )
          );
        } catch (e) {
          console.error(e);
        }
      }

      const savedPayables =
        localStorage.getItem(
          'pos_payables'
        );

      if (savedPayables) {
        try {
          setPayables(
            JSON.parse(
              savedPayables
            )
          );
        } catch (e) {
          console.error(e);
        }
      }

      loadExchangeRate();
    }
  }, [
    isMounted,
    authenticatedUserId
  ]);

  /* ============================================================
     SINCRONIZAR DATOS CLOUD
  ============================================================ */

  useEffect(() => {
    if (!isMounted) return;

    async function loadCloudData() {
      try {
        const prodRes =
          await fetch(
            '/api/products',
            {
              cache: 'no-store'
            }
          );

        const prodData =
          await prodRes.json();

        if (
          Array.isArray(
            prodData
          )
        ) {
          setProducts(
            prodData
          );

          const extractedCats =
            Array.from(
              new Set(
                prodData
                  .map(
                    (p: any) =>
                      p.category
                  )
                  .filter(Boolean)
              )
            );

          if (
            extractedCats.length >
            0
          ) {
            setCategoriesList(
              prev =>
                Array.from(
                  new Set([
                    ...prev,
                    ...extractedCats
                  ])
                ) as string[]
            );
          }
        }

        const salesRes =
          await fetch(
            '/api/sales',
            {
              cache: 'no-store'
            }
          );

        const salesData =
          await salesRes.json();

        if (
          salesData?.success &&
          Array.isArray(salesData.sales)
        ) {
          const formattedSales =
            salesData.sales.map(
              (sale: any) => ({
                id: Number(
                  sale.id
                ),

                items:
                  sale.items ||
                  [],

                subtotalUSD:
                  Number(
                    sale.subtotal_usd ||
                      sale.subtotalUSD ||
                      0
                  ),

                ivaUSD:
                  Number(
                    sale.iva_usd ||
                      sale.ivaUSD ||
                      0
                  ),

                totalUSD: Number(
                  sale.total_usd ?? sale.totalUSD ?? 0
                ),

                exchangeRate: Number(
                  sale.exchange_rate ?? sale.exchangeRate ?? exchangeRate
                ),

                totalBs: Number(
                  sale.total_ves ??
                  sale.total_bs ??
                  sale.totalBs ??
                  (
                    Number(sale.total_usd ?? sale.totalUSD ?? 0) *
                    Number(sale.exchange_rate ?? sale.exchangeRate ?? exchangeRate)
                  )
                ),

                paymentMethod:
                  sale.payment_method ||
                    sale.paymentMethod ||
                    'Efectivo USD',

                changeUSD:
                  Number(
                    sale.change_usd ||
                      sale.changeUSD ||
                      0
                  ),

                clientName:
                  sale.client_name ||
                    sale.clientName ||
                    'Cliente Genérico',

                cashRegisterId:
                  Number(
                    sale.cash_register_id ||
                      sale.cashRegisterId ||
                      0
                  ),

                date:
                  sale.created_at ||
                    sale.date ||
                    new Date().toLocaleString()
              })
            );

          setSalesHistory(
            formattedSales as SaleRecord[]
          );
        }
      } catch (error) {
        console.error(
          'Error sincronizando datos:',
          error
        );
      }
    }

    loadCloudData();
  }, [
    exchangeRate,
    isMounted
  ]);

  /* ============================================================
     ACTUALIZAR ROLES
  ============================================================ */

  useEffect(() => {
    const interval =
      setInterval(() => {
        setRolesList(
          getRoles()
        );

        setUsersList(
          getUsers()
        );
      }, 1000);

    return () =>
      clearInterval(interval);
  }, []);

  /* ============================================================
     CAMBIO DE MÓDULO
  ============================================================ */

  const handleTabChange = async (
    tab:
      | 'welcome'
      | 'pos'
      | 'inventory'
      | 'reports'
      | 'accounts'
      | 'customers'
      | 'roles'
  ) => {
    if (tab === 'pos') {
      try {
        const userId =
          authenticatedUserId;

        if (
          !Number.isInteger(
            userId
          ) ||
          userId <= 0
        ) {
          alert(
            'No se pudo identificar al usuario actual.'
          );
          return;
        }

        const res = await fetch(
          `/api/cash?userId=${userId}`,
          {
            method: 'GET',
            cache: 'no-store'
          }
        );

        const data =
          await res.json();

        if (
          data.success &&
          data.isOpen &&
          data.register
        ) {
          setIsCashOpen(true);

          setActiveRegisterId(
            Number(
              data.register.id
            )
          );

          setActiveTab('pos');
        } else {
          setIsCashOpen(false);
          setActiveRegisterId(
            null
          );
          setShowOpenCashModal(
            true
          );
        }
      } catch (err) {
        console.error(
          'Error verificando caja:',
          err
        );

        setShowOpenCashModal(
          true
        );
      }
    } else {
      setActiveTab(tab);
    }
  };

  /* ============================================================
     ABRIR CAJA
  ============================================================ */

  const handleOpenCashSubmit =
    async (
      e: React.FormEvent
    ) => {
      e.preventDefault();

      const usd = Number(
        openingUSD || 0
      );

      const bs = Number(
        openingBs || 0
      );

      const userId =
        authenticatedUserId;

      if (
        !Number.isInteger(
          userId
        ) ||
        userId <= 0
      ) {
        alert(
          'No se pudo identificar correctamente al usuario.'
        );
        return;
      }

      try {
        const res =
          await fetch(
            '/api/cash',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json'
              },
              body: JSON.stringify({
                action: 'open',
                openingUSD: usd,
                openingBs: bs,
                userId
              })
            }
          );

        const data =
          await res.json();

        if (data.success) {
          alert(
            '¡Caja abierta exitosamente!'
          );

          setShowOpenCashModal(
            false
          );

          setOpeningUSD('');
          setOpeningBs('');

          setIsCashOpen(true);

          if (data.register) {
            setActiveRegisterId(
              Number(
                data.register.id
              )
            );
          }

          setActiveTab('pos');
        } else {
          alert(
            'Error: ' +
              (data.error ||
                'No se pudo abrir la caja.')
          );
        }
      } catch (err) {
        console.error(err);

        alert(
          'Error abriendo la caja.'
        );
      }
    };

  /* ============================================================
     CERRAR CAJA
  ============================================================ */

  const handleCloseCashSubmit =
    async () => {
      if (!activeRegisterId) {
        alert(
          'No se encontró el ID de la caja abierta actual.'
        );
        return;
      }

      const userId =
        authenticatedUserId;

      if (
        !Number.isInteger(
          userId
        ) ||
        userId <= 0
      ) {
        alert(
          'No se pudo identificar correctamente al usuario.'
        );
        return;
      }

      try {
        const res =
          await fetch(
            '/api/cash',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json'
              },
              body: JSON.stringify({
                action: 'close',
                registerId:
                  activeRegisterId,
                countedUSD: Number(
                  countedUSD || 0
                ),
                countedBs: Number(
                  countedBs || 0
                ),
                userId
              })
            }
          );

        const data =
          await res.json();

        if (data.success) {
          setCashClosingReport(data.report || null);
          setShowCashClosingReport(Boolean(data.report));

          setShowCloseCashModal(false);
          setCountedUSD('');
          setCountedBs('');
          setIsCashOpen(false);
          setActiveRegisterId(null);
          setActiveTab('welcome');
        } else {
          alert(
            'Error: ' +
              (data.error ||
                'No se pudo cerrar la caja.')
          );
        }
      } catch (err) {
        console.error(err);

        alert(
          'Error cerrando la caja.'
        );
      }
    };

  /* ============================================================
     CARGAR PEDIDO WEB EN POS
  ============================================================ */

  const handleLoadWebOrder = (
    order: any
  ) => {
    if (
      !isCashOpen ||
      !activeRegisterId
    ) {
      alert(
        'Abra una caja antes de cargar y facturar un pedido web.'
      );
      return;
    }

    const mappedItems: CartItem[] = (
      order.items || []
    )
      .map((item: any) => {
        const product =
          products.find(
            p =>
              p.id ===
              Number(
                item.product_id
              )
          );

        if (product) {
          return {
            ...product,
            id: Number(
              item.product_id
            ),
            name:
              item.name ||
              product.name,
            price: Number(
              item.price_at_sale
            ),
            taxable: Boolean(
              item.taxable
            ),
            quantity: Number(
              item.quantity
            )
          };
        }

        return {
          id: Number(
            item.product_id
          ),
          name:
            item.name ||
            'Producto',
          costPrice: 0,
          price: Number(
            item.price_at_sale
          ),
          category: 'Pedido Web',
          description:
            'Producto cargado desde pedido web.',
          taxable: Boolean(
            item.taxable
          ),
          stock:
            Number(
              item.current_stock
            ) || 0,
          quantity: Number(
            item.quantity
          )
        };
      })
      .filter(
        (
          item: CartItem
        ) =>
          Number.isInteger(
            item.id
          ) &&
          item.id > 0 &&
          item.quantity > 0
      );

    if (
      mappedItems.length === 0
    ) {
      alert(
        'No se pudieron cargar los productos de este pedido web.'
      );
      return;
    }

    const totalOrderUSD =
      Number(
        order.total_usd
      ) || 0;

    const webDeliveryCost =
      order.order_type ===
      'Delivery'
        ? order.delivery_zone ===
          'Guarenas'
          ? 2
          : 3
        : 0;

    const webSubtotal =
      Math.max(
        0,
        totalOrderUSD -
          webDeliveryCost
      );

    const webExchangeRate =
      Number(
        order.exchange_rate
      ) ||
      exchangeRate;

    const webTotalBs =
      Number(order.total_ves) ||
      totalOrderUSD *
        webExchangeRate;

    let preferredPayment:
      PaymentMethodType =
      'Efectivo USD';

    const webPayment =
      String(
        order.payment_method ||
          ''
      );

    if (
      webPayment ===
      'Pago Móvil (Bs)'
    ) {
      preferredPayment =
        'Pago Móvil';
    } else if (
      webPayment ===
      'Zelle / Binance'
    ) {
      preferredPayment =
        'Zelle';
    } else if (
      webPayment ===
      'Efectivo / Divisas'
    ) {
      preferredPayment =
        'Efectivo USD';
    } else if (
      [
        'Efectivo USD',
        'Efectivo Bs',
        'Pago Móvil',
        'Zelle',
        'Binance Pay',
        'Crédito / Fiado'
      ].includes(
        webPayment
      )
    ) {
      preferredPayment =
        webPayment as PaymentMethodType;
    }

    setCart(
      mappedItems
    );

    setLoadedWebOrder({
      id: Number(order.id),

      customer_name:
        order.customer_name ||
        '',

      customer_phone:
        order.customer_phone ||
        '',

      customer_document:
        order.customer_document ||
        '',

      subtotalUSD:
        webSubtotal,

      totalUSD:
        totalOrderUSD,

      totalBs:
        webTotalBs,

      exchangeRate:
        webExchangeRate,

      order_type:
        order.order_type ||
        '',

      delivery_zone:
        order.delivery_zone ||
        '',

      delivery_address:
        order.delivery_address ||
        ''
    });

    setClientName(
      order.customer_name ||
        ''
    );

    setClientPhone(
      order.customer_phone ||
        ''
    );

    setClientDocument(
      order.customer_document ||
        ''
    );

    setPaymentMethod(
      preferredPayment
    );

    setCashGivenUSD('');
    setIsMixedPayment(false);
    setMixedCashUSD('');
    setMixedCashBs('');
    setMixedPagoMovilBs('');
    setMixedZelleUSD('');
    setMixedBinanceUSD('');

    setIsCheckoutModalOpen(
      false
    );

    alert(
      `Pedido web #${order.id} cargado al POS. Ahora puede procesar el pago.`
    );
  };

  /* ============================================================
     CARRITO
  ============================================================ */

  const addToCart = (
    product: Product
  ) => {
    if (loadedWebOrder) {
      alert(
        'Este pedido web está bloqueado para evitar modificar sus productos.'
      );
      return;
    }

    if (product.active === false) {
      alert('Este producto está desactivado y no se puede vender.');
      return;
    }

    if (product.stock <= 0) {
      alert('Este producto no tiene existencias disponibles.');
      return;
    }

    setCart(prev => {
      const existing =
        prev.find(
          item =>
            item.id ===
            product.id
        );

      if (existing) {
        if (
          existing.quantity >=
          product.stock
        ) {
          alert(
            'Stock límite alcanzado.'
          );

          return prev;
        }

        return prev.map(
          item =>
            item.id ===
            product.id
              ? {
                  ...item,
                  quantity:
                    item.quantity +
                    1
                }
              : item
        );
      }

      return [
        ...prev,
        {
          ...product,
          quantity: 1
        }
      ];
    });
  };

  const updateCartQuantity = (
    id: number,
    delta: number
  ) => {
    if (loadedWebOrder) {
      alert(
        'Este pedido web está bloqueado para evitar modificar sus productos.'
      );
      return;
    }

    setCart(prev =>
      prev
        .map(item => {
          if (item.id === id) {
            const newQty =
              item.quantity +
              delta;

            if (newQty <= 0) {
              return null;
            }

            const prod =
              products.find(
                p =>
                  p.id === id
              );

            if (
              prod &&
              newQty >
                prod.stock
            ) {
              alert(
                'Stock insuficiente.'
              );

              return item;
            }

            return {
              ...item,
              quantity: newQty
            };
          }

          return item;
        })
        .filter(
          Boolean
        ) as CartItem[]
    );
  };

  const removeFromCart = (
    id: number
  ) => {
    if (loadedWebOrder) {
      alert(
        'Este pedido web está bloqueado para evitar modificar sus productos.'
      );
      return;
    }

    setCart(prev =>
      prev.filter(
        item =>
          item.id !== id
      )
    );
  };

  /* ============================================================
     TOTALES
  ============================================================ */

  const calculatedSubtotalUSD =
    cart.reduce(
      (acc, item) =>
        acc +
        item.price *
          item.quantity,
      0
    );

  const calculatedIvaUSD =
    cart.reduce(
      (acc, item) =>
        acc +
        (item.taxable
          ? item.price *
            item.quantity *
            IVA_RATE
          : 0),
      0
    );

  const subtotalUSD =
    loadedWebOrder
      ? Number(
          loadedWebOrder.subtotalUSD
        ) || 0
      : calculatedSubtotalUSD;

  const ivaUSD =
    loadedWebOrder
      ? 0
      : calculatedIvaUSD;

  const totalUSD =
    loadedWebOrder
      ? Number(
          loadedWebOrder.totalUSD
        ) || 0
      : subtotalUSD + ivaUSD;

  const totalBs =
    loadedWebOrder
      ? Number(
          loadedWebOrder.totalBs
        ) || 0
      : totalUSD * exchangeRate;

  const effectiveExchangeRate =
    loadedWebOrder
      ? Number(
          loadedWebOrder.exchangeRate
        ) ||
        exchangeRate
      : exchangeRate;

  const totalSalesTodayUSD =
    salesHistory.reduce(
      (acc, s) =>
        acc + s.totalUSD,
      0
    );

  const totalTransactionsCount =
    salesHistory.length;

  const lowStockCount =
    products.filter(
      p => p.stock <= 5
    ).length;

  /* ============================================================
     CHECKOUT
  ============================================================ */

  const handleCheckout =
    async (
      e: React.FormEvent
    ) => {
      e.preventDefault();

      if (cart.length === 0) {
        return;
      }

      const userId =
        authenticatedUserId;

      if (
        !Number.isInteger(
          userId
        ) ||
        userId <= 0
      ) {
        alert(
          'No se pudo identificar correctamente al usuario actual.'
        );
        return;
      }

      if (!activeRegisterId) {
        alert(
          'No hay una caja abierta. Abra una caja antes de registrar la venta.'
        );

        setIsCashOpen(false);
        setShowOpenCashModal(
          true
        );
        setIsCheckoutModalOpen(
          false
        );

        return;
      }

      try {
        const cashRes =
          await fetch(
            `/api/cash?userId=${userId}`,
            {
              method: 'GET',
              cache: 'no-store'
            }
          );

        const cashData =
          await readJson(
            cashRes
          );

        if (
          !cashRes.ok ||
          !cashData.success ||
          !cashData.isOpen ||
          !cashData.register
        ) {
          setIsCashOpen(false);
          setActiveRegisterId(
            null
          );

          setIsCheckoutModalOpen(
            false
          );

          setShowOpenCashModal(
            true
          );

          alert(
            'La caja ya no se encuentra abierta. Abra nuevamente una caja para continuar.'
          );

          return;
        }

        const databaseRegisterId =
          Number(
            cashData.register.id
          );

        if (
          !Number.isInteger(
            databaseRegisterId
          ) ||
          databaseRegisterId <= 0
        ) {
          alert(
            'La caja abierta no tiene un ID válido.'
          );

          return;
        }

        setActiveRegisterId(
          databaseRegisterId
        );

        /* ======================================================
           VALIDAR PAGO
        ====================================================== */

        const givenUSD =
          parseFloat(
            cashGivenUSD ||
              '0'
          );

        let changeUSD = 0;
        let changeBs = 0;
        let effectivePaymentMethod: PaymentMethodType = paymentMethod;

        const paymentParts: Array<{
          method: string;
          currency: 'USD' | 'VES';
          amount: number;
        }> = [];

        if (isMixedPayment) {
          const usdCash = Number(mixedCashUSD || 0);
          const bsCash = Number(mixedCashBs || 0);
          const pagoMovilBs = Number(mixedPagoMovilBs || 0);
          const zelleUSD = Number(mixedZelleUSD || 0);
          const binanceUSD = Number(mixedBinanceUSD || 0);

          const enteredAmounts = [
            usdCash, bsCash, pagoMovilBs, zelleUSD, binanceUSD
          ];

          if (
            enteredAmounts.some(
              amount => !Number.isFinite(amount) || amount < 0
            )
          ) {
            alert('Verifique los montos del pago mixto.');
            return;
          }

          if (effectiveExchangeRate <= 0) {
            alert('La tasa de cambio debe ser mayor que cero para usar bolívares.');
            return;
          }

          if (usdCash > 0) {
            paymentParts.push({
              method: 'Efectivo USD',
              currency: 'USD',
              amount: usdCash
            });
          }
          if (bsCash > 0) {
            paymentParts.push({
              method: 'Efectivo Bs',
              currency: 'VES',
              amount: bsCash
            });
          }
          if (pagoMovilBs > 0) {
            paymentParts.push({
              method: 'Pago Móvil',
              currency: 'VES',
              amount: pagoMovilBs
            });
          }
          if (zelleUSD > 0) {
            paymentParts.push({
              method: 'Zelle',
              currency: 'USD',
              amount: zelleUSD
            });
          }
          if (binanceUSD > 0) {
            paymentParts.push({
              method: 'Binance Pay',
              currency: 'USD',
              amount: binanceUSD
            });
          }

          const paidUSD = usdCash + zelleUSD + binanceUSD +
            (bsCash + pagoMovilBs) / effectiveExchangeRate;

          if (paymentParts.length < 2) {
            alert('Seleccione al menos dos formas de pago para un pago mixto.');
            return;
          }

          if (Math.abs(paidUSD - totalUSD) > 0.02) {
            alert(
              `El pago no cuadra con el total. Recibido: $${paidUSD.toFixed(2)}; total: $${totalUSD.toFixed(2)}. Ajuste los montos.`
            );
            return;
          }

          effectivePaymentMethod = 'Pago mixto';
        } else {
          if (paymentMethod === 'Efectivo USD') {
            if (givenUSD < totalUSD) {
              alert('El monto entregado es menor al total.');
              return;
            }

            changeUSD = givenUSD - totalUSD;
            changeBs = changeUSD * effectiveExchangeRate;
          }

          const legacyPaymentParts: Record<string, { currency: 'USD' | 'VES'; amount: number }> = {
            'Efectivo USD': { currency: 'USD', amount: givenUSD },
            'Efectivo Bs': { currency: 'VES', amount: totalBs },
            'Pago Móvil': { currency: 'VES', amount: totalBs },
            'Zelle': { currency: 'USD', amount: totalUSD },
            'Binance Pay': { currency: 'USD', amount: totalUSD },
            'Crédito / Fiado': { currency: 'USD', amount: totalUSD }
          };
          const part = legacyPaymentParts[paymentMethod];
          if (part) {
            paymentParts.push({
              method: paymentMethod,
              currency: part.currency,
              amount: part.amount
            });
          }
        }

        if (
          effectivePaymentMethod ===
            'Crédito / Fiado' &&
          !clientName.trim()
        ) {
          alert(
            'Especifique el nombre del cliente para ventas a crédito.'
          );

          return;
        }

        /* ======================================================
           PREPARAR VENTA
        ====================================================== */

        const salePayload = {
          items: cart,

          subtotalUSD,
          ivaUSD,
          totalUSD,
          totalBs,

          exchangeRate:
            effectiveExchangeRate,

          paymentMethod: effectivePaymentMethod,
          payments: paymentParts,
          changeUSD,

          clientName:
            clientName ||
            'Cliente Genérico',

          clientPhone:
            clientPhone || '',

          clientDocument:
            clientDocument || '',

          created_at:
            new Date().toISOString(),

          cashRegisterId:
            databaseRegisterId,

          cash_register_id:
            databaseRegisterId,

          userId,

          webOrderId:
            loadedWebOrder?.id ||
            null
        };

        /* ======================================================
           REGISTRAR VENTA
        ====================================================== */

        const res =
          await fetch(
            '/api/sales',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json'
              },
              body: JSON.stringify(
                salePayload
              )
            }
          );

        const data =
          await readJson(res);

        if (
          !res.ok ||
          !data.success
        ) {
          alert(
            'Error: ' +
              (data.error ||
                data.message ||
                'No se pudo registrar la venta.')
          );

          return;
        }

        /* ======================================================
           REGISTRO LOCAL
        ====================================================== */

        const newSaleRecord: SaleRecord =
          {
            id: Number(
              data.saleId
            ),

            date:
              new Date().toLocaleString(),

            items: [...cart],

            subtotalUSD,
            ivaUSD,
            totalUSD,
            totalBs,

            exchangeRate:
              effectiveExchangeRate,

            paymentMethod: effectivePaymentMethod,
            changeUSD,

            clientName:
              clientName ||
              'Cliente Genérico',

            created_at:
              new Date().toISOString(),

            cashRegisterId:
              databaseRegisterId
          };

        setSalesHistory(prev => [
          newSaleRecord,
          ...prev
        ]);

        setLastPrintedSale(
          newSaleRecord
        );

        /* ======================================================
           CRÉDITO
        ====================================================== */

        if (
          paymentMethod ===
          'Crédito / Fiado'
        ) {
          const newCredit:
            CreditAccount = {
              id: Date.now(),

              clientName:
                clientName ||
                'Cliente Genérico',

              clientPhone:
                clientPhone ||
                'N/A',

              clientDocument:
                clientDocument ||
                'N/A',

              totalDebtUSD:
                totalUSD,

              totalDebtBs:
                totalBs,

              date: new Date()
                .toLocaleDateString(),

              status:
                'Pendiente',

              saleId:
                newSaleRecord.id
            };

          setCredits(prev => [
            newCredit,
            ...prev
          ]);
        }

        /* ======================================================
           IMPORTANTE:
           /api/sales YA DESCUENTA EL STOCK.
        ====================================================== */

        const prodRes =
          await fetch(
            '/api/products',
            {
              cache: 'no-store'
            }
          );

        const prodData =
          await prodRes.json();

        if (
          Array.isArray(
            prodData
          )
        ) {
          setProducts(
            prodData
          );
        }

        /* ======================================================
           ÉXITO
        ====================================================== */

        setSuccessModalData({
          isOpen: true,

          changeUSD,

          changeBs,

          isCredit:
            effectivePaymentMethod ===
            'Crédito / Fiado',

          clientName:
            clientName ||
            undefined
        });

        setCart([]);

        setLoadedWebOrder(
          null
        );

        setIsCheckoutModalOpen(
          false
        );

        setCashGivenUSD('');
        setIsMixedPayment(false);
        setMixedCashUSD('');
        setMixedCashBs('');
        setMixedPagoMovilBs('');
        setMixedZelleUSD('');
        setMixedBinanceUSD('');
        setClientName('');
        setClientPhone('');
        setClientDocument('');
      } catch (err) {
        console.error(
          'Error procesando venta:',
          err
        );

        alert(
          'Error procesando la venta. Verifique que la caja siga abierta.'
        );
      }
    };

  /* ============================================================
     PRODUCTOS
  ============================================================ */

  const handleAddProduct = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (
      !newName ||
      !newPrice ||
      !newStock
    ) {
      return;
    }

    try {
      const res =
        await fetch(
          '/api/products',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify({
              name: newName,

              costPrice:
                parseFloat(
                  newCostPrice ||
                    '0'
                ),

              price:
                parseFloat(
                  newPrice
                ),

              category:
                newCategory,

              description:
                newDescription.trim(),

              taxable:
                newTaxable,

              stock:
                parseInt(
                  newStock
                ),

              image:
                newImage
            })
          }
        );

      const data =
        await res.json();

      if (
        data.success ||
        res.ok
      ) {
        alert(
          '¡Producto creado exitosamente!'
        );

        setNewName('');
        setNewCostPrice('');
        setNewPrice('');
        setNewStock('');
        setNewImage('');
        setNewDescription('');
        setSelectedFileName('');

        const prodRes =
          await fetch(
            '/api/products',
            {
              cache: 'no-store'
            }
          );

        const prodData =
          await prodRes.json();

        if (
          Array.isArray(
            prodData
          )
        ) {
          setProducts(
            prodData
          );
        }
      } else {
        alert(
          'Error: ' +
            (data.error ||
              'No se pudo crear el producto.')
        );
      }
    } catch (err) {
      console.error(err);

      alert(
        'Error de red al crear el producto.'
      );
    }
  };

  const handleRestock = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (
      !selectedProductForRestock ||
      !restockAmount
    ) {
      return;
    }

    const qty =
      parseInt(
        restockAmount
      );

    if (
      isNaN(qty) ||
      qty <= 0
    ) {
      return;
    }

    try {
      const res =
        await fetch(
          `/api/products/${selectedProductForRestock.id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify({
              ...selectedProductForRestock,

              stock:
                selectedProductForRestock.stock +
                qty
            })
          }
        );

      if (res.ok) {
        alert(
          '¡Inventario reabastecido!'
        );

        setIsRestockModalOpen(
          false
        );

        setSelectedProductForRestock(
          null
        );

        setRestockAmount('');

        const prodRes =
          await fetch(
            '/api/products',
            {
              cache: 'no-store'
            }
          );

        const prodData =
          await prodRes.json();

        if (
          Array.isArray(
            prodData
          )
        ) {
          setProducts(
            prodData
          );
        }
      } else {
        const data =
          await res
            .json()
            .catch(
              () => ({})
            );

        alert(
          'Error: ' +
            (data.error ||
              'No se pudo actualizar el inventario.')
        );
      }
    } catch (err) {
      console.error(err);

      alert(
        'Error de red al actualizar inventario.'
      );
    }
  };

  const openEditModal = (
    product: Product
  ) => {
    setEditingProduct(
      product
    );

    setEditName(
      product.name
    );

    setEditPrice(
      product.price.toString()
    );

    setEditCostPrice(
      product.costPrice
        ? product.costPrice.toString()
        : ''
    );

    setEditStock(
      product.stock.toString()
    );

    setEditCategory(
      product.category
    );

    setEditImage(
      product.image || ''
    );

    setEditDescription(
      product.description || ''
    );

    setIsEditModalOpen(
      true
    );
  };

  const handleUpdateProduct =
    async (
      e: React.FormEvent
    ) => {
      e.preventDefault();

      if (
        !editingProduct ||
        !editName ||
        !editPrice ||
        !editStock
      ) {
        return;
      }

      try {
        const res =
          await fetch(
            `/api/products/${editingProduct.id}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type':
                  'application/json'
              },
              body: JSON.stringify({
                ...editingProduct,

                name: editName,

                price:
                  parseFloat(
                    editPrice
                  ),

                costPrice:
                  parseFloat(
                    editCostPrice ||
                      '0'
                  ),

                stock:
                  parseInt(
                    editStock
                  ),

                category:
                  editCategory,

                image:
                  editImage,

                description:
                  editDescription.trim()
              })
            }
          );

        if (res.ok) {
          alert(
            '¡Producto actualizado con éxito!'
          );

          setIsEditModalOpen(
            false
          );

          setEditingProduct(
            null
          );

          const prodRes =
            await fetch(
              '/api/products',
              {
                cache: 'no-store'
              }
            );

          const prodData =
            await prodRes.json();

          if (
            Array.isArray(
              prodData
            )
          ) {
            setProducts(
              prodData
            );
          }
        } else {
          const data =
            await res
              .json()
              .catch(
                () => ({})
              );

          alert(
            'Error: ' +
              (data.error ||
                'No se pudo actualizar el producto.')
          );
        }
      } catch (err) {
        console.error(err);

        alert(
          'Error de red al actualizar.'
        );
      }
    };

  const handleDeleteProduct =
    async (
      productId: number,
      productName: string
    ) => {
      if (
        !confirm(
          `¿Estás seguro de que deseas eliminar el producto "${productName}"?`
        )
      ) {
        return;
      }

      try {
        const res =
          await fetch(
            `/api/products/${productId}`,
            {
              method: 'DELETE'
            }
          );

        if (res.ok) {
          alert(
            '¡Producto eliminado correctamente!'
          );

          const prodRes =
            await fetch(
              '/api/products',
              {
                cache: 'no-store'
              }
            );

          const prodData =
            await prodRes.json();

          if (
            Array.isArray(
              prodData
            )
          ) {
            setProducts(
              prodData
            );
          }
        } else {
          const data =
            await res
              .json()
              .catch(
                () => ({})
              );

          alert(
            data.error ||
              'No se pudo eliminar el producto.'
          );
        }
      } catch (err) {
        console.error(err);

        alert(
          'Error de red al eliminar.'
        );
      }
    };

  const handleToggleProductActive = async (product: Product) => {
    const currentlyActive = product.active !== false;
    const nextActive = !currentlyActive;

    const confirmed = confirm(
      nextActive
        ? `¿Deseas reactivar "${product.name}"?`
        : `¿Deseas desactivar "${product.name}"? Ya no estará disponible para nuevas ventas.`
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          active: nextActive,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || 'No se pudo cambiar el estado del producto.');
        return;
      }

      const prodRes = await fetch('/api/products', {
        cache: 'no-store',
      });

      const prodData = await prodRes.json();

      if (Array.isArray(prodData)) {
        setProducts(prodData);
      }

      alert(
        nextActive
          ? 'Producto reactivado correctamente.'
          : 'Producto desactivado correctamente.'
      );
    } catch (error) {
      console.error('Error cambiando estado del producto:', error);
      alert('Error de red al actualizar el estado del producto.');
    }
  };

  /* ============================================================
     CUENTAS POR PAGAR
  ============================================================ */

  const handleAddPayable = (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (
      !newProviderName ||
      !newPayableAmountUSD
    ) {
      return;
    }

    const amountUSD =
      parseFloat(
        newPayableAmountUSD
      );

    const newPayable:
      PayableAccount = {
        id: Date.now(),

        providerName:
          newProviderName,

        providerDocument:
          newProviderDoc ||
          'N/A',

        description:
          newPayableDesc ||
          'Compra mercancía',

        totalDebtUSD:
          amountUSD,

        totalDebtBs:
          amountUSD *
          exchangeRate,

        dueDate:
          newDueDate ||
          new Date()
            .toLocaleDateString(),

        date:
          new Date()
            .toLocaleDateString(),

        status:
          'Pendiente'
      };

    setPayables(prev => [
      newPayable,
      ...prev
    ]);

    setNewProviderName('');
    setNewProviderDoc('');
    setNewPayableDesc('');
    setNewPayableAmountUSD('');
    setNewDueDate('');

    alert(
      '¡Cuenta por pagar registrada!'
    );
  };

  /* ============================================================
     FILTROS
  ============================================================ */

  const filteredProducts =
    products.filter(p => {
      const isActive = p.active !== false;

      const matchesSearch =
        p.name
          .toLowerCase()
          .includes(
            searchTerm.toLowerCase()
          ) ||
        p.category
          .toLowerCase()
          .includes(
            searchTerm.toLowerCase()
          );

      const matchesCategory =
        selectedCategory ===
          'Todos' ||
        p.category ===
          selectedCategory;

      return (
        isActive &&
        matchesSearch &&
        matchesCategory
      );
    });

  const categories = [
    'Todos',
    ...categoriesList
  ];

  /* ============================================================
     MOUNT
  ============================================================ */

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-800 text-sm font-bold">
        Cargando POS Enterprise...
      </div>
    );
  }

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div className="min-h-screen bg-slate-100/60 text-slate-800 flex flex-col relative font-sans">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 px-6 py-3 flex flex-wrap justify-between items-center gap-4 shadow-xs">
        <div className="flex items-center gap-4">
          <div
            className="bg-blue-600 text-white p-2 rounded-2xl font-black text-sm shadow-sm cursor-pointer"
            onClick={() =>
              handleTabChange(
                'welcome'
              )
            }
          >
            ⚡ POS
          </div>

          <div>
            <h1 className="text-sm font-black text-slate-900 tracking-tight">
              Enterprise Suite
            </h1>

            <p className="text-[10px] text-slate-400 font-semibold">
              Sistema de Gestión Comercial
            </p>
          </div>

          <div className="hidden sm:flex items-center bg-blue-50/70 border border-blue-100 rounded-xl px-3 py-1 text-xs font-bold text-blue-700">
            BCV: Bs.{' '}
            {exchangeRate.toFixed(
              2
            )}{' '}
            / $1
          </div>
        </div>

        {/* NAVEGACIÓN */}

        <nav className="flex items-center gap-1 bg-slate-100/80 p-1.5 rounded-2xl text-xs font-bold border border-slate-200/50">
          <button
            onClick={() =>
              handleTabChange(
                'welcome'
              )
            }
            className={`px-3.5 py-1.5 rounded-xl transition ${
              activeTab ===
              'welcome'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🏠 Inicio
          </button>

          {userPermissions.includes(
            'view_pos'
          ) && (
            <button
              onClick={() =>
                handleTabChange(
                  'pos'
                )
              }
              className={`px-3.5 py-1.5 rounded-xl transition ${
                activeTab === 'pos'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🛒 POS Caja
            </button>
          )}

          {userPermissions.includes(
            'view_inventory'
          ) && (
            <button
              onClick={() =>
                handleTabChange(
                  'inventory'
                )
              }
              className={`px-3.5 py-1.5 rounded-xl transition ${
                activeTab ===
                'inventory'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📦 Inventario
            </button>
          )}

          {userPermissions.includes(
            'view_reports'
          ) && (
            <button
              onClick={() =>
                handleTabChange(
                  'reports'
                )
              }
              className={`px-3.5 py-1.5 rounded-xl transition ${
                activeTab ===
                'reports'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 Reportes
            </button>
          )}

          {(
            userPermissions.includes(
              'view_credits'
            ) ||
            userPermissions.includes(
              'view_payables'
            ) ||
            userPermissions.includes(
              'manage_roles'
            )
          ) && (
            <button
              onClick={() =>
                handleTabChange(
                  'accounts'
                )
              }
              className={`px-3.5 py-1.5 rounded-xl transition ${
                activeTab ===
                'accounts'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📑 Finanzas
            </button>
          )}

          {userPermissions.includes(
            'view_pos'
          ) && (
            <button
              onClick={() =>
                handleTabChange(
                  'customers'
                )
              }
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab ===
                'customers'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              👥 Clientes
            </button>
          )}

          {userPermissions.includes(
            'manage_roles'
          ) && (
            <button
              onClick={() =>
                handleTabChange(
                  'roles'
                )
              }
              className={`px-3.5 py-1.5 rounded-xl transition ${
                activeTab ===
                'roles'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🔐 Roles
            </button>
          )}
        </nav>

        {/* CAJA / USUARIO */}

        <div className="flex items-center gap-3">
          {isCashOpen && (
            <button
              onClick={() =>
                setShowCloseCashModal(
                  true
                )
              }
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-2 rounded-xl text-xs transition shadow-sm flex items-center gap-1.5"
            >
              🔒 Arqueo / Cerrar Caja
            </button>
          )}

          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/70 px-3 py-1.5 rounded-2xl">
            <div className="text-right">
              <div className="text-xs font-bold text-slate-800">
                {currentUserObj?.name ||
                  currentUsername}
              </div>

              <div className="text-[10px] text-blue-600 font-semibold">
                {currentRoleObj?.name ||
                  'Operador'}
              </div>
            </div>

            <select
              value={
                currentUsername
              }
              onChange={e =>
                setCurrentUsername(
                  e.target.value
                )
              }
              className="bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none"
            >
              {usersList.map(
                (u: any) => (
                  <option
                    key={
                      u.id ||
                      u.username
                    }
                    value={
                      u.username ||
                      u.name
                    }
                  >
                    {u.name ||
                      u.username}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </header>

      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">

        {/* ====================================================
            BIENVENIDA
        ==================================================== */}

        {activeTab ===
          'welcome' && (
          <div className="space-y-6 py-6 animate-fadeIn">
            <div className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-sm text-center space-y-4 max-w-2xl mx-auto">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center text-2xl mx-auto font-bold shadow-xs">
                ⚡
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-black text-slate-900">
                  ¡Bienvenido al Sistema Enterprise!
                </h2>

                <p className="text-xs text-slate-500">
                  Selecciona el módulo con el que deseas trabajar hoy o consulta tus accesos rápidos a continuación.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                {userPermissions.includes(
                  'view_pos'
                ) && (
                  <button
                    onClick={() =>
                      handleTabChange(
                        'pos'
                      )
                    }
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold p-4 rounded-2xl text-xs shadow-sm transition flex flex-col items-center justify-center gap-2"
                  >
                    <span className="text-lg">
                      🛒
                    </span>

                    <span>
                      POS / Caja
                    </span>
                  </button>
                )}

                {userPermissions.includes(
                  'view_inventory'
                ) && (
                  <button
                    onClick={() =>
                      handleTabChange(
                        'inventory'
                      )
                    }
                    className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold p-4 rounded-2xl text-xs transition flex flex-col items-center justify-center gap-2"
                  >
                    <span className="text-lg">
                      📦
                    </span>

                    <span>
                      Inventario
                    </span>
                  </button>
                )}

                {userPermissions.includes(
                  'view_reports'
                ) && (
                  <button
                    onClick={() =>
                      handleTabChange(
                        'reports'
                      )
                    }
                    className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold p-4 rounded-2xl text-xs transition flex flex-col items-center justify-center gap-2"
                  >
                    <span className="text-lg">
                      📊
                    </span>

                    <span>
                      Reportes
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Ventas Registradas
                  </p>

                  <h4 className="text-lg font-black text-slate-900 mt-0.5">
                    $
                    {totalSalesTodayUSD.toFixed(
                      2
                    )}
                  </h4>
                </div>

                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-sm">
                  📈
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Alertas de Stock
                  </p>

                  <h4 className="text-lg font-black text-amber-600 mt-0.5">
                    {lowStockCount}{' '}
                    items
                  </h4>
                </div>

                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-bold text-sm">
                  ⚠️
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Transacciones
                  </p>

                  <h4 className="text-lg font-black text-slate-900 mt-0.5">
                    {
                      totalTransactionsCount
                    }
                  </h4>
                </div>

                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold text-sm">
                  🧾
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm max-w-3xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      💱
                    </span>

                    <h3 className="text-sm font-black text-slate-900">
                      Tasa Oficial BCV
                    </h3>
                  </div>

                  <p className="text-[10px] font-bold text-blue-600 uppercase">
                    {exchangeRateSource ===
                    'manual'
                      ? 'Manual'
                      : exchangeRateSource
                      ? exchangeRateSource
                      : 'Sin registrar'}
                  </p>

                  <p className="text-xs text-slate-500">
                    Tasa utilizada para convertir los precios USD a Bs.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">
                      Bs.
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        exchangeRate
                      }
                      onChange={e =>
                        setExchangeRate(
                          Number(
                            e.target
                              .value
                          )
                        )
                      }
                      className="w-full sm:w-36 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-black text-slate-800 focus:outline-none focus:border-blue-500 transition"
                    />

                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                      / $1
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={
                      handleSaveExchangeRate
                    }
                    disabled={
                      isSavingExchangeRate
                    }
                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-sm whitespace-nowrap"
                  >
                    {isSavingExchangeRate
                      ? 'Guardando...'
                      : 'Actualizar tasa'}
                  </button>
                </div>
              </div>

              {exchangeRateMessage && (
                <div
                  className={`mt-3 text-xs font-semibold ${
                    exchangeRateMessage.includes(
                      'correctamente'
                    )
                      ? 'text-emerald-600'
                      : 'text-red-600'
                  }`}
                >
                  {
                    exchangeRateMessage
                  }
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====================================================
            POS
        ==================================================== */}

        {activeTab ===
          'pos' && (
          <div className="space-y-4">

            <WebOrdersModule
              onLoadOrder={
                handleLoadWebOrder
              }
              loadedOrderId={
                loadedWebOrder?.id ||
                null
              }
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">

                {loadedWebOrder && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-emerald-800">
                        🛍️ Pedido Web #
                        {
                          loadedWebOrder.id
                        }{' '}
                        cargado
                      </div>

                      <div className="text-[11px] text-emerald-700 mt-1">
                        Los productos están bloqueados para mantener el pedido original.
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-bold text-emerald-600 uppercase">
                        Cliente
                      </div>

                      <div className="text-xs font-black text-emerald-900">
                        {
                          loadedWebOrder.customer_name
                        }
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="🔍 Buscar producto por nombre o categoría..."
                    value={
                      searchTerm
                    }
                    onChange={e =>
                      setSearchTerm(
                        e.target.value
                      )
                    }
                    className="flex-1 bg-white border border-slate-200/80 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-blue-500 shadow-sm transition"
                  />

                  <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
                    {categories.map(
                      cat => (
                        <button
                          key={cat}
                          onClick={() =>
                            setSelectedCategory(
                              cat
                            )
                          }
                          className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition ${
                            selectedCategory ===
                            cat
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {cat}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {filteredProducts.map(
                    product => (
                      <div
                        key={
                          product.id
                        }
                        onClick={() =>
                          addToCart(
                            product
                          )
                        }
                        className={`bg-white border rounded-3xl p-4 flex flex-col justify-between cursor-pointer transition shadow-xs hover:shadow-md ${
                          product.stock <=
                          0
                            ? 'opacity-50 border-rose-200 bg-rose-50/20'
                            : loadedWebOrder
                            ? 'border-slate-200/80 hover:border-slate-300'
                            : 'border-slate-200/80 hover:border-blue-400 hover:-translate-y-0.5'
                        }`}
                      >
                        <div>
                          {product.image ? (
                            <div className="w-full h-24 mb-2.5 rounded-2xl overflow-hidden bg-slate-100 border border-slate-100">
                              <img
                                src={
                                  product.image
                                }
                                alt={
                                  product.name
                                }
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : null}

                          <div className="flex justify-between items-start gap-1">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg">
                              {
                                product.category
                              }
                            </span>

                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                                product.stock >
                                5
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : product.stock >
                                    0
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              Stock:{' '}
                              {
                                product.stock
                              }
                            </span>
                          </div>

                          <h4 className="font-bold text-slate-800 text-xs mt-2.5 line-clamp-2">
                            {
                              product.name
                            }
                          </h4>
                        </div>

                        <div className="mt-4 pt-2 border-t border-slate-100 flex justify-between items-end">
                          <div>
                            <div className="text-sm font-black text-slate-900">
                              $
                              {product.price.toFixed(
                                2
                              )}
                            </div>

                            <div className="text-[10px] text-slate-400">
                              Bs.{' '}
                              {(
                                product.price *
                                exchangeRate
                              ).toFixed(
                                2
                              )}
                            </div>
                          </div>

                          <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-xs shadow-2xs">
                            ＋
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* CARRITO */}

              <div className="space-y-4">
                <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col h-[calc(100vh-210px)] sticky top-20">

                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h3 className="font-extrabold text-slate-800 text-sm">
                      🛒 Carrito Actual
                    </h3>

                    <button
                      onClick={() => {
                        if (
                          loadedWebOrder
                        ) {
                          const confirmed =
                            confirm(
                              'Este pedido web se quitará del carrito local, pero seguirá aprobado en el sistema. ¿Desea continuar?'
                            );

                          if (
                            !confirmed
                          ) {
                            return;
                          }
                        }

                        setCart(
                          []
                        );

                        setLoadedWebOrder(
                          null
                        );

                        setClientName(
                          ''
                        );

                        setClientPhone(
                          ''
                        );

                        setClientDocument(
                          ''
                        );
                      }}
                      className="text-xs text-rose-500 font-bold hover:underline"
                    >
                      Vaciar
                    </button>
                  </div>

                  {loadedWebOrder ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
                      <div className="text-[10px] uppercase font-bold text-emerald-600">
                        Pedido Web
                      </div>

                      <div className="text-sm font-black text-emerald-900 mt-0.5">
                        #
                        {
                          loadedWebOrder.id
                        }
                      </div>

                      <div className="text-xs text-emerald-800 mt-1">
                        {
                          loadedWebOrder.customer_name
                        }
                      </div>

                      {loadedWebOrder.customer_phone && (
                        <div className="text-[10px] text-emerald-700 mt-1">
                          Tel:{' '}
                          {
                            loadedWebOrder.customer_phone
                          }
                        </div>
                      )}
                    </div>
                  ) : (
                    <POSCustomerSelector
                      onSelectCustomer={c => {
                        setClientName(
                          c.name
                        );

                        setClientDocument(
                          c.document
                        );

                        setClientPhone(
                          c.phone
                        );
                      }}
                    />
                  )}

                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {cart.length ===
                    0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs text-center p-6">
                        <span className="text-3xl mb-2">
                          🛍️
                        </span>

                        El carrito está vacío. Selecciona productos para facturar.
                      </div>
                    ) : (
                      cart.map(
                        item => (
                          <div
                            key={
                              item.id
                            }
                            className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-3 flex justify-between items-center gap-2"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-xs text-slate-800 truncate">
                                {
                                  item.name
                                }
                              </div>

                              <div className="text-[10px] text-slate-400">
                                $
                                {item.price.toFixed(
                                  2
                                )}{' '}
                                c/u
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                                <button
                                  onClick={() =>
                                    updateCartQuantity(
                                      item.id,
                                      -1
                                    )
                                  }
                                  className="px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100"
                                >
                                  -
                                </button>

                                <span className="px-2 text-xs font-bold">
                                  {
                                    item.quantity
                                  }
                                </span>

                                <button
                                  onClick={() =>
                                    updateCartQuantity(
                                      item.id,
                                      1
                                    )
                                  }
                                  className="px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100"
                                >
                                  +
                                </button>
                              </div>

                              <button
                                onClick={() =>
                                  removeFromCart(
                                    item.id
                                  )
                                }
                                className="text-rose-500 hover:text-rose-700 text-xs font-bold p-1"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        )
                      )
                    )}
                  </div>

                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>
                        Subtotal
                      </span>

                      <span>
                        $
                        {subtotalUSD.toFixed(
                          2
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs text-slate-500">
                      <span>
                        IVA (16%)
                      </span>

                      <span>
                        $
                        {ivaUSD.toFixed(
                          2
                        )}
                      </span>
                    </div>

                    {loadedWebOrder &&
                      loadedWebOrder.order_type ===
                        'Delivery' && (
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>
                            Delivery (
                            {
                              loadedWebOrder.delivery_zone
                            })
                          </span>

                          <span>
                            $
                            {(
                              Number(
                                loadedWebOrder.totalUSD
                              ) -
                              Number(
                                loadedWebOrder.subtotalUSD
                              )
                            ).toFixed(
                              2
                            )}
                          </span>
                        </div>
                      )}

                    <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-100">
                      <span>
                        Total USD
                      </span>

                      <span>
                        $
                        {totalUSD.toFixed(
                          2
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs font-bold text-blue-600">
                      <span>
                        Total Bs.
                      </span>

                      <span>
                        Bs.{' '}
                        {totalBs.toFixed(
                          2
                        )}
                      </span>
                    </div>

                    <button
                      disabled={
                        cart.length ===
                          0 ||
                        !isCashOpen ||
                        !activeRegisterId
                      }
                      onClick={() =>
                        setIsCheckoutModalOpen(
                          true
                        )
                      }
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-2xl text-xs transition shadow-md mt-2"
                    >
                      {!isCashOpen
                        ? 'Caja Cerrada 🔒'
                        : loadedWebOrder
                        ? 'Facturar Pedido Web 💳'
                        : 'Proceder al Pago 💳'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            INVENTARIO
        ==================================================== */}

        {activeTab ===
          'inventory' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* NUEVO PRODUCTO */}

              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                <h3 className="font-extrabold text-slate-800 text-base">
                  ➕ Nuevo Producto
                </h3>

                <form
                  onSubmit={
                    handleAddProduct
                  }
                  className="space-y-3"
                >
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Nombre *
                    </label>

                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={e =>
                        setNewName(
                          e.target
                            .value
                        )
                      }
                      placeholder="Ej. Hamburguesa Doble"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Descripción del plato
                    </label>

                    <textarea
                      value={
                        newDescription
                      }
                      onChange={e =>
                        setNewDescription(
                          e.target
                            .value
                        )
                      }
                      maxLength={500}
                      rows={3}
                      placeholder="Ej. Roll de salmón, aguacate y queso crema."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs resize-none"
                    />

                    <p className="text-[10px] text-slate-400 mt-1">
                      Describe brevemente los ingredientes o características del plato.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-600">
                      Imagen del Producto (ImgBB)
                    </label>

                    {newImage ? (
                      <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center group">
                        <img
                          src={
                            newImage
                          }
                          alt="Vista previa"
                          className="w-full h-full object-cover"
                        />

                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setNewImage(
                                ''
                              );
                              setSelectedFileName(
                                ''
                              );
                            }}
                            className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow"
                          >
                            Eliminar 🗑️
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-4 text-center bg-slate-50/50 transition cursor-pointer relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e =>
                            handleImageUploadToImgBB(
                              e,
                              false
                            )
                          }
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />

                        <div className="space-y-1">
                          <span className="text-xl">
                            📷
                          </span>

                          <p className="text-xs font-bold text-slate-700">
                            Haz clic para subir o arrastra una imagen
                          </p>

                          <p className="text-[10px] text-slate-400">
                            PNG, JPG o WEBP
                          </p>
                        </div>
                      </div>
                    )}

                    {isUploadingImage && (
                      <div className="flex items-center gap-2 text-blue-600 text-[11px] font-bold animate-pulse pt-1">
                        <span className="inline-block animate-spin">
                          ⏳
                        </span>

                        Subiendo imagen a ImgBB...
                      </div>
                    )}

                    {selectedFileName && (
                      <p className="text-[10px] text-slate-400 truncate">
                        {
                          selectedFileName
                        }
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Costo ($)
                      </label>

                      <input
                        type="number"
                        step="0.01"
                        value={
                          newCostPrice
                        }
                        onChange={e =>
                          setNewCostPrice(
                            e.target
                              .value
                          )
                        }
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Precio Venta ($) *
                      </label>

                      <input
                        type="number"
                        step="0.01"
                        required
                        value={
                          newPrice
                        }
                        onChange={e =>
                          setNewPrice(
                            e.target
                              .value
                          )
                        }
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="block text-[11px] font-bold text-slate-600">
                        Categoría
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          setIsAddingCategory(
                            !isAddingCategory
                          )
                        }
                        className="text-[10px] text-blue-600 font-bold hover:underline"
                      >
                        {isAddingCategory
                          ? 'Cancelar'
                          : '+ Crear Categoría'}
                      </button>
                    </div>

                    {isAddingCategory ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Nueva categoría..."
                          value={
                            newCategoryInput
                          }
                          onChange={e =>
                            setNewCategoryInput(
                              e.target
                                .value
                            )
                          }
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-2xs"
                        />

                        <button
                          type="button"
                          onClick={
                            handleCreateCategory
                          }
                          className="bg-blue-600 text-white px-3 py-2 rounded-xl text-xs font-bold"
                        >
                          Añadir
                        </button>
                      </div>
                    ) : (
                      <select
                        value={
                          newCategory
                        }
                        onChange={e =>
                          setNewCategory(
                            e.target
                              .value
                          )
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 shadow-2xs"
                      >
                        {categoriesList.map(
                          cat => (
                            <option
                              key={cat}
                              value={cat}
                            >
                              {cat}
                            </option>
                          )
                        )}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Stock Inicial *
                    </label>

                    <input
                      type="number"
                      required
                      value={
                        newStock
                      }
                      onChange={e =>
                        setNewStock(
                          e.target
                            .value
                        )
                      }
                      placeholder="0"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="taxableCheck"
                      checked={
                        newTaxable
                      }
                      onChange={e =>
                        setNewTaxable(
                          e.target
                            .checked
                        )
                      }
                      className="rounded text-blue-600"
                    />

                    <label
                      htmlFor="taxableCheck"
                      className="text-xs text-slate-700 font-semibold"
                    >
                      Aplica IVA (16%)
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-2xl text-xs shadow-sm mt-2 transition"
                  >
                    Guardar Producto 💾
                  </button>
                </form>
              </div>

              {/* LISTADO INVENTARIO */}

              <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-800 text-base">
                    📦 Listado de Inventario
                  </h3>

                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setInventoryFilterMode(
                          'all'
                        )
                      }
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                        inventoryFilterMode ===
                        'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Todos
                    </button>

                    <button
                      onClick={() =>
                        setInventoryFilterMode(
                          'low'
                        )
                      }
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                        inventoryFilterMode ===
                        'low'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Stock Bajo
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase font-bold text-[10px]">
                        <th className="p-3">
                          Producto
                        </th>

                        <th className="p-3">
                          Categoría
                        </th>

                        <th className="p-3">
                          Descripción
                        </th>

                        <th className="p-3">
                          Precio
                        </th>

                        <th className="p-3">
                          Stock
                        </th>

                        <th className="p-3 text-right">
                          Acciones
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {products
                        .filter(
                          p =>
                            inventoryFilterMode ===
                              'all' ||
                            p.stock <= 5
                        )
                        .map(
                          p => (
                            <tr
                              key={
                                p.id
                              }
                              className="hover:bg-slate-50/60 transition"
                            >
                              <td className="p-3 font-bold text-slate-800 flex items-center gap-2">
                                {p.image && (
                                  <img
                                    src={
                                      p.image
                                    }
                                    alt=""
                                    className="w-8 h-8 rounded-lg object-cover"
                                  />
                                )}

                                <span>
                                  {
                                    p.name
                                  }
                                </span>

                                <span
                                  className={`ml-2 inline-flex items-center rounded-lg px-2 py-1 text-[9px] font-bold ${
                                    p.active === false
                                      ? 'bg-rose-50 text-rose-700'
                                      : 'bg-emerald-50 text-emerald-700'
                                  }`}>
                                  {p.active === false ? 'Desactivado' : 'Activo'}
                                </span>
                              </td>

                              <td className="p-3 text-slate-500">
                                {
                                  p.category
                                }
                              </td>

                              <td
                                className="p-3 text-slate-500 max-w-xs truncate"
                                title={
                                  p.description ||
                                  ''
                                }
                              >
                                {p.description ||
                                  'Sin descripción'}
                              </td>

                              <td className="p-3 font-bold text-slate-800">
                                $
                                {p.price.toFixed(
                                  2
                                )}
                              </td>

                              <td
                                className={`p-3 font-bold ${
                                  p.stock <=
                                  5
                                    ? 'text-amber-600'
                                    : 'text-emerald-600'
                                }`}
                              >
                                {
                                  p.stock
                                }
                              </td>

                              <td className="p-3 text-right">
                                <div className="flex justify-end gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedProductForRestock(
                                        p
                                      );

                                      setRestockAmount(
                                        ''
                                      );

                                      setIsRestockModalOpen(
                                        true
                                      );
                                    }}
                                    className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-bold hover:bg-emerald-100"
                                  >
                                    + Stock
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditModal(
                                        p
                                      )
                                    }
                                    className="px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-bold hover:bg-blue-100"
                                  >
                                    Editar
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleProductActive(p)
                                    }
                                    className={`px-2.5 py-1.5 rounded-lg font-bold ${
                                      p.active === false
                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                    }`}>
                                    {p.active === false ? 'Reactivar' : 'Desactivar'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteProduct(
                                        p.id,
                                        p.name
                                      )
                                    }
                                    className="px-2.5 py-1.5 bg-rose-50 text-rose-700 rounded-lg font-bold hover:bg-rose-100"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        )}

                      {products.filter(
                        p =>
                          inventoryFilterMode ===
                            'all' ||
                          p.stock <= 5
                      ).length ===
                        0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="p-10 text-center text-slate-400"
                          >
                            No hay productos para mostrar.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            REPORTES
        ==================================================== */}

        {activeTab ===
          'reports' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-800">
                    📊 Reportes de Ventas
                  </h3>

                  <p className="text-xs text-slate-500">
                    Seguimiento de ventas registradas en la base de datos.
                  </p>
                </div>

                <select
                  value={
                    reportFilterPeriod
                  }
                  onChange={e =>
                    setReportFilterPeriod(
                      e.target
                        .value as
                        | 'all'
                        | 'today'
                        | 'week'
                        | 'month'
                    )
                  }
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                >
                  <option value="all">
                    Todo
                  </option>

                  <option value="today">
                    Hoy
                  </option>

                  <option value="week">
                    Últimos 7 días
                  </option>

                  <option value="month">
                    Últimos 30 días
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                  <div className="text-[10px] uppercase font-bold text-blue-600">
                    Ventas
                  </div>

                  <div className="text-xl font-black text-slate-900 mt-1">
                    $
                    {salesHistory
                      .reduce(
                        (a, s) =>
                          a +
                          s.totalUSD,
                        0
                      )
                      .toFixed(2)}
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                  <div className="text-[10px] uppercase font-bold text-emerald-600">
                    Transacciones
                  </div>

                  <div className="text-xl font-black text-slate-900 mt-1">
                    {
                      salesHistory.length
                    }
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <div className="text-[10px] uppercase font-bold text-amber-700">
                    Ticket promedio
                  </div>

                  <div className="text-xl font-black text-slate-900 mt-1">
                    $
                    {salesHistory.length
                      ? (
                          salesHistory.reduce(
                            (a, s) =>
                              a +
                              s.totalUSD,
                            0
                          ) /
                          salesHistory.length
                        ).toFixed(
                          2
                        )
                      : '0.00'}
                  </div>
                </div>
              </div>

              <div className="h-80 mt-6">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={(() => {
                      const map: Record<
                        string,
                        number
                      > = {};

                      salesHistory.forEach(
                        s => {
                          const d =
                            new Date(
                              s.created_at ||
                                s.date
                            );

                          const key = `${d.getDate()}/${d.getMonth() + 1}`;

                          map[key] =
                            (map[key] ||
                              0) +
                            s.totalUSD;
                        }
                      );

                      return Object.entries(
                        map
                      )
                        .slice(-14)
                        .map(
                          ([
                            date,
                            total
                          ]) => ({
                            date,
                            total:
                              Number(
                                total.toFixed(
                                  2
                                )
                              )
                          })
                        );
                    })()}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar
                      dataKey="total"
                      name="Ventas USD"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase text-[10px] font-bold">
                    <th className="p-3">
                      ID
                    </th>

                    <th className="p-3">
                      Fecha
                    </th>

                    <th className="p-3">
                      Cliente
                    </th>

                    <th className="p-3">
                      Método
                    </th>

                    <th className="p-3">
                      Total USD
                    </th>

                    <th className="p-3">
                      Total Bs.
                    </th>

                    <th className="p-3">
                      Caja
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {salesHistory
                    .filter(s => {
                      if (
                        reportFilterPeriod ===
                        'all'
                      )
                        return true;

                      const date =
                        new Date(
                          s.created_at ||
                            s.date
                        );

                      const now =
                        new Date();

                      const diff =
                        now.getTime() -
                        date.getTime();

                      if (
                        reportFilterPeriod ===
                        'today'
                      ) {
                        return (
                          date.toDateString() ===
                          now.toDateString()
                        );
                      }

                      if (
                        reportFilterPeriod ===
                        'week'
                      ) {
                        return (
                          diff <=
                          7 *
                            86400000
                        );
                      }

                      return (
                        diff <=
                        30 *
                          86400000
                      );
                    })
                    .map(
                      s => (
                        <tr
                          key={
                            s.id
                          }
                          className="hover:bg-slate-50/70"
                        >
                          <td className="p-3 font-bold">
                            #
                            {s.id}
                          </td>

                          <td className="p-3 text-slate-500">
                            {new Date(
                              s.created_at ||
                                s.date
                            ).toLocaleString()}
                          </td>

                          <td className="p-3 font-semibold">
                            {s.clientName ||
                              'Cliente Genérico'}
                          </td>

                          <td className="p-3">
                            {
                              s.paymentMethod
                            }
                          </td>

                          <td className="p-3 font-black">
                            $
                            {s.totalUSD.toFixed(
                              2
                            )}
                          </td>

                          <td className="p-3">
                            Bs.{' '}
                            {s.totalBs.toFixed(
                              2
                            )}
                          </td>

                          <td className="p-3">
                            #
                            {s.cashRegisterId ||
                              '—'}
                          </td>
                        </tr>
                      )
                    )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ====================================================
            CUENTAS / FINANZAS
        ==================================================== */}

        {activeTab ===
          'accounts' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {userPermissions.includes(
              'view_credits'
            ) && (
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-lg font-extrabold">
                      💳 Cuentas por Cobrar
                    </h3>

                    <p className="text-xs text-slate-500">
                      Ventas a crédito /
                      fiado.
                    </p>
                  </div>

                  <span className="bg-amber-50 text-amber-700 border border-amber-100 rounded-xl px-3 py-1 text-xs font-bold">
                    {
                      credits.filter(
                        c =>
                          c.status ===
                          'Pendiente'
                      ).length
                    }{' '}
                    pendientes
                  </span>
                </div>

                <div className="mt-4 space-y-2 max-h-[520px] overflow-y-auto">
                  {credits.length ===
                  0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      No hay cuentas por cobrar.
                    </div>
                  ) : (
                    credits.map(
                      c => (
                        <div
                          key={c.id}
                          className="border border-slate-200 rounded-2xl p-4 flex justify-between gap-3"
                        >
                          <div>
                            <div className="font-bold text-sm">
                              {
                                c.clientName
                              }
                            </div>

                            <div className="text-[10px] text-slate-500 mt-1">
                              {
                                c.clientDocument
                              }{' '}
                              ·{' '}
                              {
                                c.clientPhone
                              }
                            </div>

                            <div className="text-[10px] text-slate-400 mt-1">
                              Venta #
                              {
                                c.saleId
                              }{' '}
                              ·{' '}
                              {c.date}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-black">
                              $
                              {c.totalDebtUSD.toFixed(
                                2
                              )}
                            </div>

                            <div className="text-[10px] text-slate-500">
                              Bs.{' '}
                              {c.totalDebtBs.toFixed(
                                2
                              )}
                            </div>

                            <span
                              className={`inline-block mt-1 px-2 py-1 rounded-lg text-[9px] font-bold ${
                                c.status ===
                                'Pagado'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {
                                c.status
                              }
                            </span>
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>
              </div>
            )}

            {userPermissions.includes(
              'view_payables'
            ) ||
            userPermissions.includes(
              'manage_payables'
            ) ? (
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-lg font-extrabold">
                    📑 Cuentas por Pagar
                  </h3>

                  <p className="text-xs text-slate-500">
                    Proveedores y obligaciones pendientes.
                  </p>
                </div>

                <form
                  onSubmit={
                    handleAddPayable
                  }
                  className="mt-4 bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-2.5"
                >
                  <input
                    value={
                      newProviderName
                    }
                    onChange={e =>
                      setNewProviderName(
                        e.target
                          .value
                      )
                    }
                    placeholder="Proveedor *"
                    required
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={
                        newProviderDoc
                      }
                      onChange={e =>
                        setNewProviderDoc(
                          e.target
                            .value
                        )
                      }
                      placeholder="RIF / Documento"
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs"
                    />

                    <input
                      value={
                        newPayableAmountUSD
                      }
                      onChange={e =>
                        setNewPayableAmountUSD(
                          e.target
                            .value
                        )
                      }
                      placeholder="Monto USD *"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs"
                    />
                  </div>

                  <input
                    value={
                      newPayableDesc
                    }
                    onChange={e =>
                      setNewPayableDesc(
                        e.target
                          .value
                      )
                    }
                    placeholder="Descripción"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs"
                  />

                  <input
                    value={
                      newDueDate
                    }
                    onChange={e =>
                      setNewDueDate(
                        e.target
                          .value
                      )
                    }
                    type="date"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs"
                  />

                  <button className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2.5 text-xs font-bold">
                    Registrar Cuenta
                  </button>
                </form>

                <div className="mt-4 space-y-2 max-h-[350px] overflow-y-auto">
                  {payables.map(
                    p => (
                      <div
                        key={p.id}
                        className="border border-slate-200 rounded-2xl p-4 flex justify-between gap-3"
                      >
                        <div>
                          <div className="font-bold text-sm">
                            {
                              p.providerName
                            }
                          </div>

                          <div className="text-[10px] text-slate-500">
                            {
                              p.providerDocument
                            }{' '}
                            ·{' '}
                            {
                              p.description
                            }
                          </div>

                          <div className="text-[10px] text-slate-400 mt-1">
                            Vence:{' '}
                            {
                              p.dueDate
                            }
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-black">
                            $
                            {p.totalDebtUSD.toFixed(
                              2
                            )}
                          </div>

                          <div className="text-[10px] text-slate-500">
                            Bs.{' '}
                            {p.totalDebtBs.toFixed(
                              2
                            )}
                          </div>

                          <span className="inline-block mt-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-lg text-[9px] font-bold">
                            {
                              p.status
                            }
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ====================================================
            CLIENTES
        ==================================================== */}

        {activeTab ===
          'customers' && (
          <CustomersDirectoryModule />
        )}

        {/* ====================================================
            ROLES
        ==================================================== */}

        {activeTab === 'roles' &&
          userPermissions.includes(
            'manage_roles'
          ) && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
              <RolesManagerModule />
            </div>
          )}
      </main>

      {/* ======================================================
          MODAL ABRIR CAJA
      ====================================================== */}

      {showOpenCashModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  🔓 Abrir Caja
                </h3>

                <p className="text-[10px] text-slate-500 mt-1">
                  Usuario:{' '}
                  {currentUserObj?.name ||
                    authenticatedUser?.email ||
                    '—'}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowOpenCashModal(
                    false
                  )
                }
                className="text-slate-400 hover:text-slate-700 text-2xl"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                handleOpenCashSubmit
              }
              className="space-y-4 pt-5"
            >
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Monto inicial USD
                </label>

                <input
                  value={
                    openingUSD
                  }
                  onChange={e =>
                    setOpeningUSD(
                      e.target
                        .value
                    )
                  }
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Monto inicial Bs.
                </label>

                <input
                  value={
                    openingBs
                  }
                  onChange={e =>
                    setOpeningBs(
                      e.target
                        .value
                    )
                  }
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm"
                  placeholder="0.00"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-2xl"
              >
                Abrir Caja
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================
          MODAL CERRAR CAJA
      ====================================================== */}

      {showCloseCashModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  🔒 Arqueo / Cerrar Caja
                </h3>

                <p className="text-[10px] text-slate-500 mt-1">
                  Caja #
                  {activeRegisterId ||
                    '—'}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowCloseCashModal(
                    false
                  )
                }
                className="text-slate-400 hover:text-slate-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="pt-5 space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-900">
                El cierre se realizará sobre la caja abierta en la base de datos para este usuario.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Efectivo contado USD
                </label>

                <input
                  value={
                    countedUSD
                  }
                  onChange={e =>
                    setCountedUSD(
                      e.target
                        .value
                    )
                  }
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Efectivo contado Bs.
                </label>

                <input
                  value={
                    countedBs
                  }
                  onChange={e =>
                    setCountedBs(
                      e.target
                        .value
                    )
                  }
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm"
                  placeholder="0.00"
                />
              </div>

              <button
                type="button"
                onClick={
                  handleCloseCashSubmit
                }
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-2xl"
              >
                Cerrar y Arquear Caja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          INFORME IMPRIMIBLE DE ARQUEO DE CAJA
      ====================================================== */}
      {showCashClosingReport && cashClosingReport && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 flex items-center justify-center p-3 overflow-y-auto">
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              #cash-closing-print, #cash-closing-print * { visibility: visible !important; }
              #cash-closing-print { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; max-width: none !important; margin: 0 !important; padding: 18mm !important; box-shadow: none !important; border: 0 !important; border-radius: 0 !important; }
              .cash-report-actions { display: none !important; }
              @page { size: auto; margin: 8mm; }
            }
          `}</style>
          <div className="w-full max-w-3xl max-h-[95vh] overflow-y-auto rounded-2xl bg-slate-100 p-3 sm:p-5">
            <div className="cash-report-actions flex flex-wrap justify-end gap-2 mb-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500"
              >
                🖨️ Imprimir / Guardar PDF
              </button>
              <button
                type="button"
                onClick={() => setShowCashClosingReport(false)}
                className="rounded-xl bg-slate-700 px-5 py-3 text-sm font-bold text-white hover:bg-slate-600"
              >
                Cerrar informe
              </button>
            </div>

            <div id="cash-closing-print" className="mx-auto max-w-2xl rounded-xl bg-white p-6 sm:p-9 text-slate-900 shadow-lg text-sm">
              <header className="border-b-2 border-slate-900 pb-4 text-center">
                <h1 className="text-2xl font-black tracking-wide">TAKOSUSHI</h1>
                <h2 className="mt-1 text-lg font-bold uppercase">Informe de arqueo de caja</h2>
                <p className="mt-2 text-xs text-slate-600">Caja #{cashClosingReport.registerId}</p>
              </header>

              <section className="grid grid-cols-2 gap-3 border-b border-slate-300 py-4 text-xs">
                <div><span className="text-slate-500">Cajero</span><p className="font-bold">{cashClosingReport.userName || cashClosingReport.userEmail || `Usuario ${cashClosingReport.userId}`}</p></div>
                <div><span className="text-slate-500">Ventas registradas</span><p className="font-bold">{cashClosingReport.salesCount}</p></div>
                <div><span className="text-slate-500">Apertura</span><p className="font-semibold">{cashClosingReport.openingDate ? new Date(cashClosingReport.openingDate).toLocaleString('es-VE') : '—'}</p></div>
                <div><span className="text-slate-500">Cierre</span><p className="font-semibold">{cashClosingReport.closingDate ? new Date(cashClosingReport.closingDate).toLocaleString('es-VE') : '—'}</p></div>
              </section>

              <section className="py-4">
                <h3 className="mb-2 font-black uppercase text-xs tracking-wide">Resumen de ventas</h3>
                <div className="space-y-2">
                  <div className="flex justify-between gap-4"><span>Ventas totales (USD equivalente)</span><b>${Number(cashClosingReport.totalSalesUSD || 0).toFixed(2)}</b></div>
                  <div className="flex justify-between gap-4"><span>Ventas totales registradas en Bs</span><b>Bs. {Number(cashClosingReport.totalSalesVES || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
                  <div className="flex justify-between gap-4"><span>Efectivo USD recibido (antes de vuelto)</span><b>${Number(cashClosingReport.cashSalesUSD || 0).toFixed(2)}</b></div>
                  <div className="flex justify-between gap-4"><span>Efectivo Bs recibido</span><b>Bs. {Number(cashClosingReport.cashSalesBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
                  <div className="flex justify-between gap-4"><span>Pagos electrónicos (equiv. USD)</span><b>${Number(cashClosingReport.electronicTotalUSD || 0).toFixed(2)}</b></div>
                  <div className="flex justify-between gap-4"><span>Ventas a crédito / fiado</span><b>${Number(cashClosingReport.creditTotalUSD || 0).toFixed(2)}</b></div>
                </div>
              </section>

              <section className="border-t border-slate-300 py-4">
                <h3 className="mb-2 font-black uppercase text-xs tracking-wide">Detalle por método de pago</h3>
                <table className="w-full border-collapse text-xs">
                  <thead><tr className="border-b border-slate-400 text-left"><th className="py-2 pr-2">Método</th><th className="py-2 pr-2 text-right">Monto USD</th><th className="py-2 pr-2 text-right">Monto Bs</th><th className="py-2 text-right">Equiv. USD</th></tr></thead>
                  <tbody>
                    {(cashClosingReport.paymentBreakdown || []).map((item: any, index: number) => (
                      <tr key={`${item.method}-${index}`} className="border-b border-slate-200">
                        <td className="py-2 pr-2">{item.method}</td>
                        <td className="py-2 pr-2 text-right">${Number(item.amountUSD || 0).toFixed(2)}</td>
                        <td className="py-2 pr-2 text-right">Bs. {Number(item.amountVES || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="py-2 text-right">${Number(item.totalUSD || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                    {(!cashClosingReport.paymentBreakdown || cashClosingReport.paymentBreakdown.length === 0) && <tr><td colSpan={4} className="py-3 text-center text-slate-500">No hay ventas registradas en esta caja.</td></tr>}
                  </tbody>
                </table>
              </section>

              <section className="border-y-2 border-slate-900 py-4">
                <h3 className="mb-3 font-black uppercase text-xs tracking-wide">Conciliación de efectivo físico</h3>
                <div className="grid grid-cols-3 gap-2 text-xs font-bold"><div></div><div className="text-right">USD</div><div className="text-right">Bolívares</div></div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs"><span>Saldo inicial</span><span className="text-right">${Number(cashClosingReport.openingUSD || 0).toFixed(2)}</span><span className="text-right">Bs. {Number(cashClosingReport.openingBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs"><span>+ Efectivo recibido</span><span className="text-right">${Number(cashClosingReport.cashSalesUSD || 0).toFixed(2)}</span><span className="text-right">Bs. {Number(cashClosingReport.cashSalesBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs"><span>− Vuelto entregado en Bs</span><span className="text-right">—</span><span className="text-right">− Bs. {Number(cashClosingReport.cashOutflowBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-300 pt-2 text-xs font-black"><span>Esperado en caja</span><span className="text-right">${Number(cashClosingReport.expectedUSD || 0).toFixed(2)}</span><span className="text-right">Bs. {Number(cashClosingReport.expectedBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs"><span>Contado por cajero</span><span className="text-right">${Number(cashClosingReport.countedUSD || 0).toFixed(2)}</span><span className="text-right">Bs. {Number(cashClosingReport.countedBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-300 pt-2 text-sm font-black"><span>Diferencia</span><span className={`text-right ${Number(cashClosingReport.differenceUSD) < -0.009 ? 'text-red-700' : Number(cashClosingReport.differenceUSD) > 0.009 ? 'text-emerald-700' : ''}`}>{Number(cashClosingReport.differenceUSD) > 0 ? '+' : ''}${Number(cashClosingReport.differenceUSD || 0).toFixed(2)}</span><span className={`text-right ${Number(cashClosingReport.differenceBs) < -0.009 ? 'text-red-700' : Number(cashClosingReport.differenceBs) > 0.009 ? 'text-emerald-700' : ''}`}>{Number(cashClosingReport.differenceBs) > 0 ? '+' : ''}Bs. {Number(cashClosingReport.differenceBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <p className="mt-3 text-center text-xs font-bold">{Math.abs(Number(cashClosingReport.differenceUSD || 0)) < 0.01 && Math.abs(Number(cashClosingReport.differenceBs || 0)) < 0.01 ? 'CAJA CUADRADA' : 'REVISAR DIFERENCIA DE CAJA'}</p>
              </section>

              <footer className="pt-8 text-xs text-slate-600">
                <div className="grid grid-cols-2 gap-8 text-center"><div className="border-t border-slate-500 pt-2">Firma del cajero</div><div className="border-t border-slate-500 pt-2">Revisión / supervisor</div></div>
                <p className="mt-6 text-center">Informe generado por el sistema POS TAKOSUSHI.</p>
              </footer>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          MODAL CHECKOUT
      ====================================================== */}

      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-6 my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black">
                  💳{' '}
                  {loadedWebOrder
                    ? 'Facturar Pedido Web'
                    : 'Confirmar Venta'}
                </h3>

                <p className="text-[10px] text-slate-500">
                  Caja #
                  {activeRegisterId ||
                    '—'}{' '}
                  ·{' '}
                  {
                    currentUserObj?.name ||
                    'Usuario'
                  }
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setIsCheckoutModalOpen(
                    false
                  )
                }
                className="text-slate-400 text-2xl"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                handleCheckout
              }
              className="space-y-4 pt-5"
            >
              {loadedWebOrder ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase">
                    Pedido Web
                  </div>

                  <div className="text-lg font-black text-emerald-900">
                    #
                    {
                      loadedWebOrder.id
                    }
                  </div>

                  <div className="text-xs text-emerald-800 mt-1">
                    {
                      loadedWebOrder.customer_name
                    }
                  </div>

                  {loadedWebOrder.customer_phone && (
                    <div className="text-[10px] text-emerald-700 mt-1">
                      Tel:{' '}
                      {
                        loadedWebOrder.customer_phone
                      }
                    </div>
                  )}

                  {loadedWebOrder.order_type && (
                    <div className="text-[10px] text-emerald-700 mt-1">
                      Servicio:{' '}
                      {
                        loadedWebOrder.order_type
                      }
                      {loadedWebOrder.delivery_zone
                        ? ` · ${loadedWebOrder.delivery_zone}`
                        : ''}
                    </div>
                  )}
                </div>
              ) : (
                <POSCustomerSelector
                  onSelectCustomer={c => {
                    setClientName(
                      c.name
                    );

                    setClientDocument(
                      c.document
                    );

                    setClientPhone(
                      c.phone
                    );
                  }}
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Método de pago (modo individual)
                  </label>

                  <select
                    disabled={isMixedPayment}
                    value={
                      paymentMethod
                    }
                    onChange={e =>
                      setPaymentMethod(
                        e.target
                          .value as PaymentMethodType
                      )
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-3 text-xs font-bold"
                  >
                    <option>
                      Efectivo USD
                    </option>

                    <option>
                      Efectivo Bs
                    </option>

                    <option>
                      Pago Móvil
                    </option>

                    <option>
                      Zelle
                    </option>

                    <option>
                      Binance Pay
                    </option>

                    <option>
                      Crédito / Fiado
                    </option>
                  </select>
                </div>

                {!isMixedPayment && paymentMethod ===
                  'Efectivo USD' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Efectivo recibido USD
                    </label>

                    <input
                      value={
                        cashGivenUSD
                      }
                      onChange={e =>
                        setCashGivenUSD(
                          e.target
                            .value
                        )
                      }
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-3 text-xs"
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-3">
                <label className="flex items-center gap-2 text-xs font-extrabold text-blue-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMixedPayment}
                    onChange={e => {
                      setIsMixedPayment(e.target.checked);
                      if (e.target.checked && paymentMethod === 'Crédito / Fiado') {
                        setPaymentMethod('Efectivo USD');
                      }
                      setCashGivenUSD('');
                      setMixedCashUSD('');
                      setMixedCashBs('');
                      setMixedPagoMovilBs('');
                      setMixedZelleUSD('');
                      setMixedBinanceUSD('');
                    }}
                    className="h-4 w-4 accent-blue-600"
                  />
                  Permitir pago mixto (varios métodos)
                </label>
                <p className="mt-1 text-[10px] text-blue-800">
                  Introduzca cuánto aporta cada método. Los bolívares se convierten con la tasa vigente.
                </p>
              </div>

              {isMixedPayment ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-slate-200 p-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Efectivo USD aplicado</label>
                    <input type="number" min="0" step="0.01" value={mixedCashUSD} onChange={e => setMixedCashUSD(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Efectivo Bs aplicado</label>
                    <input type="number" min="0" step="0.01" value={mixedCashBs} onChange={e => setMixedCashBs(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Pago Móvil (Bs)</label>
                    <input type="number" min="0" step="0.01" value={mixedPagoMovilBs} onChange={e => setMixedPagoMovilBs(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Zelle (USD)</label>
                    <input type="number" min="0" step="0.01" value={mixedZelleUSD} onChange={e => setMixedZelleUSD(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Binance Pay (USD)</label>
                    <input type="number" min="0" step="0.01" value={mixedBinanceUSD} onChange={e => setMixedBinanceUSD(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs" placeholder="0.00" />
                  </div>
                  <div className="sm:col-span-2 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Equivalente ingresado</span>
                      <b>${(Number(mixedCashUSD || 0) + Number(mixedZelleUSD || 0) + Number(mixedBinanceUSD || 0) + (Number(mixedCashBs || 0) + Number(mixedPagoMovilBs || 0)) / Math.max(effectiveExchangeRate, 1)).toFixed(2)}</b>
                    </div>
                    <div className="flex justify-between">
                      <span>Total de la venta</span>
                      <b>${totalUSD.toFixed(2)}</b>
                    </div>
                    <p className="text-[10px] text-slate-500">La suma debe coincidir con el total antes de confirmar.</p>
                  </div>
                </div>
              ) : null}

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                {loadedWebOrder && (
                  <div className="flex justify-between text-xs text-emerald-700 font-bold">
                    <span>
                      Pedido Web
                    </span>

                    <span>
                      #
                      {
                        loadedWebOrder.id
                      }
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-xs">
                  <span>
                    Subtotal
                  </span>

                  <b>
                    $
                    {subtotalUSD.toFixed(
                      2
                    )}
                  </b>
                </div>

                <div className="flex justify-between text-xs">
                  <span>
                    IVA
                  </span>

                  <b>
                    $
                    {ivaUSD.toFixed(
                      2
                    )}
                  </b>
                </div>

                {loadedWebOrder &&
                  loadedWebOrder.order_type ===
                    'Delivery' && (
                    <div className="flex justify-between text-xs">
                      <span>
                        Delivery (
                        {
                          loadedWebOrder.delivery_zone
                        })
                      </span>

                      <b>
                        $
                        {(
                          totalUSD -
                          subtotalUSD
                        ).toFixed(
                          2
                        )}
                      </b>
                    </div>
                  )}

                <div className="flex justify-between text-base font-black border-t pt-2">
                  <span>
                    Total USD
                  </span>

                  <b>
                    $
                    {totalUSD.toFixed(
                      2
                    )}
                  </b>
                </div>

                <div className="flex justify-between text-xs font-bold text-blue-600">
                  <span>
                    Total Bs.
                  </span>

                  <b>
                    Bs.{' '}
                    {totalBs.toFixed(
                      2
                    )}
                  </b>
                </div>

                {paymentMethod ===
                  'Efectivo USD' &&
                  Number(
                    cashGivenUSD ||
                      0
                  ) >=
                    totalUSD && (
                    <div className="flex justify-between text-xs text-emerald-700 font-bold border-t pt-2">
                      <span>
                        Cambio
                      </span>

                      <b>
                        $
                        {(
                          Number(
                            cashGivenUSD ||
                              0
                          ) -
                          totalUSD
                        ).toFixed(
                          2
                        )}
                      </b>
                    </div>
                  )}
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-2xl shadow-md"
              >
                {loadedWebOrder
                  ? 'Confirmar y Facturar Pedido Web'
                  : 'Confirmar y Registrar Venta'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================
          MODAL REPOSICIÓN
      ====================================================== */}

      {isRestockModalOpen &&
        selectedProductForRestock && (
          <div className="fixed inset-0 z-[100] bg-slate-950/60 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <h3 className="font-black">
                  📦 Reabastecer Producto
                </h3>

                <button
                  type="button"
                  onClick={() =>
                    setIsRestockModalOpen(
                      false
                    )
                  }
                  className="text-slate-400 text-2xl"
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={
                  handleRestock
                }
                className="pt-5 space-y-4"
              >
                <div className="bg-slate-50 rounded-2xl p-4">
                  <div className="font-bold text-sm">
                    {
                      selectedProductForRestock.name
                    }
                  </div>

                  <div className="text-xs text-slate-500 mt-1">
                    Stock actual:{' '}
                    {
                      selectedProductForRestock.stock
                    }
                  </div>
                </div>

                <input
                  autoFocus
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={
                    restockAmount
                  }
                  onChange={e =>
                    setRestockAmount(
                      e.target
                        .value
                    )
                  }
                  placeholder="Cantidad a agregar"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm"
                />

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl py-3 font-bold"
                >
                  Reabastecer
                </button>
              </form>
            </div>
          </div>
        )}

      {/* ======================================================
          MODAL EDITAR PRODUCTO
      ====================================================== */}

      {isEditModalOpen &&
        editingProduct && (
          <div className="fixed inset-0 z-[100] bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 my-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <h3 className="font-black">
                  ✏️ Editar Producto
                </h3>

                <button
                  type="button"
                  onClick={() =>
                    setIsEditModalOpen(
                      false
                    )
                  }
                  className="text-slate-400 text-2xl"
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={
                  handleUpdateProduct
                }
                className="pt-5 space-y-3"
              >
                <input
                  required
                  value={
                    editName
                  }
                  onChange={e =>
                    setEditName(
                      e.target
                        .value
                    )
                  }
                  placeholder="Nombre"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs"
                />

                <div className="grid grid-cols-2 gap-2">
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={
                      editPrice
                    }
                    onChange={e =>
                      setEditPrice(
                        e.target
                          .value
                      )
                    }
                    placeholder="Precio venta"
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs"
                  />

                  <input
                    type="number"
                    step="0.01"
                    value={
                      editCostPrice
                    }
                    onChange={e =>
                      setEditCostPrice(
                        e.target
                          .value
                      )
                    }
                    placeholder="Costo"
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs"
                  />
                </div>

                <input
                  required
                  type="number"
                  min="0"
                  value={
                    editStock
                  }
                  onChange={e =>
                    setEditStock(
                      e.target
                        .value
                    )
                  }
                  placeholder="Stock"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs"
                />

                <select
                  value={
                    editCategory
                  }
                  onChange={e =>
                    setEditCategory(
                      e.target
                        .value
                    )
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold"
                >
                  {categoriesList.map(
                    cat => (
                      <option
                        key={cat}
                        value={cat}
                      >
                        {cat}
                      </option>
                    )
                  )}
                </select>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Descripción del plato
                  </label>

                  <textarea
                    value={
                      editDescription
                    }
                    onChange={e =>
                      setEditDescription(
                        e.target
                          .value
                      )
                    }
                    maxLength={500}
                    rows={3}
                    placeholder="Describe brevemente el plato..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Imagen
                  </label>

                  {editImage ? (
                    <img
                      src={
                        editImage
                      }
                      alt="Vista previa"
                      className="w-full h-32 object-cover rounded-2xl border"
                    />
                  ) : null}

                  <input
                    type="file"
                    accept="image/*"
                    onChange={e =>
                      handleImageUploadToImgBB(
                        e,
                        true
                      )
                    }
                    className="w-full mt-2 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-2xl py-3 font-bold"
                >
                  Guardar Cambios
                </button>
              </form>
            </div>
          </div>
        )}

      {/* ======================================================
          MODAL VENTA EXITOSA / TICKET
      ====================================================== */}

      {successModalData?.isOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-950/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 my-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl mx-auto">
                ✓
              </div>

              <h3 className="text-xl font-black mt-4">
                {lastPrintedSale &&
                !loadedWebOrder
                  ? '¡Venta registrada!'
                  : '¡Venta registrada!'}
              </h3>

              <p className="text-xs text-slate-500 mt-1">
                {successModalData.clientName ||
                  'Cliente Genérico'}
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 mt-5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span>
                  Total
                </span>

                <b>
                  $
                  {lastPrintedSale?.totalUSD?.toFixed(
                    2
                  ) ||
                    totalUSD.toFixed(
                      2
                    )}
                </b>
              </div>

              {successModalData.changeUSD >
                0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>
                    Cambio USD
                  </span>

                  <b>
                    $
                    {successModalData.changeUSD.toFixed(
                      2
                    )}
                  </b>
                </div>
              )}

              {successModalData.changeBs >
                0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>
                    Cambio Bs.
                  </span>

                  <b>
                    Bs.{' '}
                    {successModalData.changeBs.toFixed(
                      2
                    )}
                  </b>
                </div>
              )}

              <div className="flex justify-between">
                <span>
                  Método
                </span>

                <b>
                  {lastPrintedSale?.paymentMethod ||
                    paymentMethod}
                </b>
              </div>

              <div className="flex justify-between">
                <span>
                  Caja
                </span>

                <b>
                  #
                  {lastPrintedSale?.cashRegisterId ||
                    activeRegisterId ||
                    '—'}
                </b>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={() =>
                  window.print()
                }
                className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl py-3 font-bold"
              >
                🖨️ Imprimir Ticket
              </button>

              <button
                type="button"
                onClick={() => {
                  setSuccessModalData(
                    null
                  );

                  setLastPrintedSale(
                    null
                  );
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-2xl py-3 font-bold"
              >
                Listo
              </button>
            </div>

            {lastPrintedSale && (
              <div className="hidden print:block print-ticket mt-4 text-black text-xs">
                <div className="text-center font-black text-base">
                  POS ENTERPRISE
                </div>

                <div className="text-center">
                  Comprobante de Venta
                </div>

                <div className="border-b border-dashed border-black my-2" />

                <div>
                  Venta: #
                  {
                    lastPrintedSale.id
                  }
                </div>

                <div>
                  Fecha:{' '}
                  {
                    lastPrintedSale.date
                  }
                </div>

                <div>
                  Cliente:{' '}
                  {lastPrintedSale.clientName ||
                    'Cliente Genérico'}
                </div>

                <div>
                  Caja: #
                  {lastPrintedSale.cashRegisterId ||
                    '—'}
                </div>

                <div className="border-b border-dashed border-black my-2" />

                {lastPrintedSale.items.map(
                  (
                    item: CartItem
                  ) => (
                    <div
                      key={
                        item.id
                      }
                      className="flex justify-between gap-2"
                    >
                      <span>
                        {item.quantity}{' '}
                        x{' '}
                        {
                          item.name
                        }
                      </span>

                      <span>
                        $
                        {(
                          item.quantity *
                          item.price
                        ).toFixed(
                          2
                        )}
                      </span>
                    </div>
                  )
                )}

                <div className="border-b border-dashed border-black my-2" />

                <div className="flex justify-between">
                  <span>
                    Subtotal
                  </span>

                  <b>
                    $
                    {lastPrintedSale.subtotalUSD.toFixed(
                      2
                    )}
                  </b>
                </div>

                <div className="flex justify-between">
                  <span>
                    IVA
                  </span>

                  <b>
                    $
                    {lastPrintedSale.ivaUSD.toFixed(
                      2
                    )}
                  </b>
                </div>

                <div className="flex justify-between text-sm">
                  <span>
                    Total
                  </span>

                  <b>
                    $
                    {lastPrintedSale.totalUSD.toFixed(
                      2
                    )}
                  </b>
                </div>

                <div className="flex justify-between">
                  <span>
                    Bs.
                  </span>

                  <b>
                    {lastPrintedSale.totalBs.toFixed(
                      2
                    )}
                  </b>
                </div>

                <div className="mt-3 text-center">
                  ¡Gracias por su compra!
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
