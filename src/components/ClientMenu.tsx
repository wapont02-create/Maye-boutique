
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  description?: string;
  image?: string;
}

interface MenuCategory {
  category: string;
  items: MenuItem[];
}

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

const WHATSAPP_NUMBER = '584143065287';
const FALLBACK_RATE = 778.33;

const formatUSD = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);

export default function ClientMenu({
  initialCategories,
}: {
  initialCategories: MenuCategory[];
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerState, setCustomerState] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Pago Móvil (Bs)');

  const [exchangeRate, setExchangeRate] = useState(FALLBACK_RATE);
  const [isLoadingExchangeRate, setIsLoadingExchangeRate] =
    useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadExchangeRate = async () => {
      try {
        const response = await fetch('/api/exchange-rate', {
          cache: 'no-store',
        });

        const data = await response.json();

        if (
          isMounted &&
          response.ok &&
          data?.success &&
          Number(data.rate) > 0
        ) {
          setExchangeRate(Number(data.rate));
        }
      } catch (error) {
        console.error('Error al consultar la tasa:', error);
      } finally {
        if (isMounted) setIsLoadingExchangeRate(false);
      }
    };

    loadExchangeRate();
    const interval = setInterval(loadExchangeRate, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const categories = useMemo(
    () => [
      'Todos',
      ...initialCategories.map((item) => item.category),
    ],
    [initialCategories]
  );

  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return initialCategories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => {
          const matchesSearch =
            item.name.toLowerCase().includes(query) ||
            (item.description || '').toLowerCase().includes(query);

          return matchesSearch;
        }),
      }))
      .filter(
        (category) =>
          (selectedCategory === 'Todos' ||
            category.category === selectedCategory) &&
          category.items.length > 0
      );
  }, [initialCategories, searchQuery, selectedCategory]);

  const addToCart = (product: MenuItem) => {
    setCart((previous) => {
      const existing = previous.find(
        (item) => item.id === product.id
      );

      if (existing) {
        return previous.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...previous,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
        },
      ];
    });
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((previous) =>
      previous
        .map((item) =>
          item.id === id
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const getItemQuantity = (id: number) =>
    cart.find((item) => item.id === id)?.quantity || 0;

  const totalItems = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const totalBs = subtotal * exchangeRate;

  const checkoutWhatsApp = async () => {
    if (cart.length === 0) {
      alert('Agrega al menos un producto a tu bolsa.');
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      alert('Completa tu nombre y teléfono de contacto.');
      return;
    }

    if (
      !customerState.trim() ||
      !customerCity.trim() ||
      !deliveryAddress.trim()
    ) {
      alert('Completa el estado, la ciudad y la dirección de envío.');
      return;
    }

    if (isLoadingExchangeRate) {
      alert('Estamos actualizando la tasa de cambio. Intenta nuevamente.');
      return;
    }

    setIsSubmitting(true);

    try {
      const destination =
        `${customerState.trim()} - ${customerCity.trim()}`;

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerDocument: '',
          orderType: 'Delivery',
          deliveryZone: destination,
          deliveryAddress: deliveryAddress.trim(),
          items: cart,
          total: Number(subtotal.toFixed(2)),
          totalBs: Number(totalBs.toFixed(2)),
          exchangeRate,
          paymentMethod,
          created_at: new Date().toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message ||
            data?.error ||
            'No se pudo registrar el pedido.'
        );
      }

      let message = '✨ *NUEVO PEDIDO | MAYE BOUTIQUE* ✨\n\n';
      message += `👤 *Cliente:* ${customerName.trim()}\n`;
      message += `📱 *Teléfono:* ${customerPhone.trim()}\n`;
      message += `📍 *Estado:* ${customerState.trim()}\n`;
      message += `🏙️ *Ciudad:* ${customerCity.trim()}\n`;
      message += `🏠 *Dirección:* ${deliveryAddress.trim()}\n`;
      message += `💳 *Método de pago preferido:* ${paymentMethod}\n\n`;
      message += '*PRODUCTOS SELECCIONADOS*\n';

      cart.forEach((item) => {
        message += `• ${item.quantity} x ${item.name} — ${formatUSD(
          item.price * item.quantity
        )}\n`;
      });

      message += '\n--------------------------\n';
      message += `*Subtotal productos:* ${formatUSD(subtotal)}\n`;
      message += `*Referencia en bolívares:* Bs. ${totalBs.toFixed(2)}\n`;
      message += `*Tasa de referencia:* Bs. ${exchangeRate.toFixed(2)} por USD\n`;
      message += '*Envío nacional:* Por cotizar\n';
      message += '*Total final:* Pendiente de confirmar el envío\n\n';
      message += 'Por favor, confirmen disponibilidad, envío y total final.';

      const whatsappUrl =
        `https://wa.me/${WHATSAPP_NUMBER}?text=` +
        encodeURIComponent(message);

      window.location.assign(whatsappUrl);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error inesperado';

      alert(
        'No se pudo registrar el pedido: ' + errorMessage
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b090b] text-white">
      {/* Barra superior */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b090b]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
          <a href="#inicio" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#f00078]/60 text-2xl text-[#f00078]">
              M
            </div>
            <div>
              <p className="text-lg font-semibold tracking-[0.12em]">
                MAYE <span className="text-[#f00078]">BOUTIQUE</span>
              </p>
              <p className="text-[9px] uppercase tracking-[0.27em] text-white/50">
                Moda femenina exclusiva
              </p>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-xs text-white/70 md:flex">
            <a href="#inicio" className="transition hover:text-[#f00078]">
              Inicio
            </a>
            <a href="#coleccion" className="transition hover:text-[#f00078]">
              Colección
            </a>
            <a href="#nosotros" className="transition hover:text-[#f00078]">
              Nosotros
            </a>
            <a href="#contacto" className="transition hover:text-[#f00078]">
              Contacto
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-full border border-white/20 px-4 py-2 text-xs transition hover:border-[#f00078] sm:inline-flex"
            >
              Acceso POS
            </Link>
            <button
              onClick={() => setIsCartOpen(true)}
              className="rounded-full bg-[#f00078] px-4 py-2.5 text-xs font-bold transition hover:bg-[#cf0066]"
            >
              Bolsa ({totalItems})
            </button>
          </div>
        </div>
      </header>

      {/* Portada */}
      <section
        id="inicio"
        className="relative isolate overflow-hidden border-b border-white/10"
      >
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_20%,rgba(240,0,120,0.17),transparent_45%),linear-gradient(120deg,#0b090b,#171017_60%,#0b090b)]" />

        <div className="mx-auto grid min-h-[500px] max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 md:grid-cols-2 md:py-24">
          <div className="max-w-xl">
            <p className="mb-6 text-[10px] font-semibold uppercase tracking-[0.35em] text-[#ff55a9]">
              Estilo · Exclusividad · Personalidad
            </p>

            <h1 className="text-5xl font-light leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
              Viste como
              <span className="mt-2 block font-semibold italic text-[#f00078]">
                siempre soñaste.
              </span>
            </h1>

            <p className="mt-7 max-w-md text-sm leading-7 text-white/65">
              Descubre una selección de moda femenina importada,
              elegida para mujeres que aman destacar con elegancia,
              seguridad y personalidad.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <a
                href="#coleccion"
                className="rounded-full bg-[#f00078] px-7 py-3.5 text-xs font-bold transition hover:bg-[#cf0066]"
              >
                DESCUBRIR COLECCIÓN
              </a>
              <a
                href="#nosotros"
                className="rounded-full border border-white/25 px-7 py-3.5 text-xs transition hover:border-[#f00078]"
              >
                CONÓCENOS
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-[10px] uppercase tracking-[0.15em] text-white/50">
              <span>Moda importada</span>
              <span className="text-[#f00078]">✦</span>
              <span>Atención personalizada</span>
              <span className="text-[#f00078]">✦</span>
              <span>Envíos nacionales</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-4 rounded-[48%] border border-[#f00078]/20" />
            <div className="relative flex min-h-[340px] flex-col items-center justify-center overflow-hidden rounded-t-[48%] border border-white/10 bg-gradient-to-b from-[#3b172c] via-[#21131e] to-[#100d10] px-8 py-16 text-center sm:min-h-[420px]">
              <span className="text-xs uppercase tracking-[0.4em] text-[#ff8ac5]">
                New Collection
              </span>
              <span className="mt-6 font-serif text-7xl italic text-white sm:text-8xl">
                Maye
              </span>
              <span className="mt-5 text-[10px] uppercase tracking-[0.3em] text-white/55">
                Tu estilo, tu esencia
              </span>
              <div className="mt-8 h-px w-16 bg-[#f00078]" />
              <p className="mt-5 max-w-[220px] text-xs leading-6 text-white/60">
                Encuentra esas piezas que hacen especial cada ocasión.
              </p>
            </div>
            <div className="absolute -bottom-3 -right-2 rounded-full border border-[#f00078]/40 bg-[#171017] px-5 py-3 text-[10px] uppercase tracking-widest text-[#ff8ac5]">
              Moda exclusiva
            </div>
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section className="border-b border-white/10">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-7 text-center sm:grid-cols-3 sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest">
              Selección exclusiva
            </p>
            <p className="mt-2 text-xs text-white/45">
              Prendas elegidas para ti
            </p>
          </div>
          <div className="border-white/10 sm:border-x">
            <p className="text-xs font-semibold uppercase tracking-widest">
              Atención personalizada
            </p>
            <p className="mt-2 text-xs text-white/45">
              Te ayudamos con tu compra
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest">
              Envíos en Venezuela
            </p>
            <p className="mt-2 text-xs text-white/45">
              Consulta el costo según tu destino
            </p>
          </div>
        </div>
      </section>

      {/* Colección */}
      <section id="coleccion" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-[#ff55a9]">
              Encuentra tu próximo look
            </p>
            <h2 className="mt-3 text-3xl font-light sm:text-4xl">
              Nuestra <span className="font-semibold italic">colección</span>
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/50">
              Explora las piezas disponibles y elige tus favoritas.
            </p>
          </div>

          <p className="text-xs text-white/45">
            {initialCategories.reduce(
              (total, category) => total + category.items.length,
              0
            )}{' '}
            productos en catálogo
          </p>
        </div>

        {/* Buscador */}
        <div className="mt-9 flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar prendas, estilos..."
              className="w-full rounded-full border border-white/15 bg-white/[0.035] px-5 py-3.5 text-sm outline-none transition placeholder:text-white/35 focus:border-[#f00078]"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`whitespace-nowrap rounded-full border px-4 py-3 text-[11px] transition ${
                  selectedCategory === category
                    ? 'border-[#f00078] bg-[#f00078] text-white'
                    : 'border-white/15 text-white/65 hover:border-[#f00078]'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10">
          {filteredCategories.length === 0 ? (
            <div className="rounded-2xl border border-white/10 py-20 text-center">
              <p className="font-serif text-3xl italic">Sin resultados</p>
              <p className="mt-3 text-sm text-white/50">
                Prueba otra búsqueda o selecciona otra categoría.
              </p>
            </div>
          ) : (
            filteredCategories.map((category) => (
              <div key={category.category} className="mb-14">
                <div className="mb-6 flex items-center gap-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em]">
                    {category.category}
                  </h3>
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-xs text-white/40">
                    {category.items.length} artículos
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                  {category.items.map((product) => {
                    const imageUrl =
                      typeof product.image === 'string'
                        ? product.image.trim()
                        : '';

                    const quantity = getItemQuantity(product.id);

                    return (
                      <article
                        key={product.id}
                        className="group overflow-hidden rounded-2xl border border-white/10 bg-[#151115] transition duration-300 hover:-translate-y-1 hover:border-[#f00078]/50"
                      >
                        <div className="relative aspect-[3/4] overflow-hidden bg-[#211820]">
                          {imageUrl &&
                          imageUrl !== 'NULL' &&
                          imageUrl !== 'EMPTY_STRING' ? (
                            <img
                              src={imageUrl}
                              alt={product.name}
                              loading="lazy"
                              className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                              onError={(event) => {
                                event.currentTarget.style.visibility = 'hidden';
                              }}
                            />
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center text-[#ff8ac5]/60">
                              <span className="font-serif text-5xl italic">
                                M
                              </span>
                              <span className="mt-3 text-[9px] uppercase tracking-[0.25em]">
                                Maye Boutique
                              </span>
                            </div>
                          )}

                          <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/65 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                            {formatUSD(product.price)}
                          </div>
                        </div>

                        <div className="p-3.5 sm:p-5">
                          <h4 className="line-clamp-2 min-h-10 text-sm font-medium leading-5 transition group-hover:text-[#ff55a9] sm:text-base">
                            {product.name}
                          </h4>

                          <p className="mt-2 line-clamp-2 min-h-8 text-[11px] leading-4 text-white/45 sm:text-xs">
                            {product.description ||
                              'Una pieza seleccionada para complementar tu estilo.'}
                          </p>

                          <div className="mt-4 border-t border-white/10 pt-3">
                            {quantity === 0 ? (
                              <button
                                onClick={() => addToCart(product)}
                                className="w-full rounded-full bg-[#f00078] px-3 py-3 text-[10px] font-bold uppercase tracking-wider transition hover:bg-[#cf0066] sm:text-xs"
                              >
                                + Agregar a mi bolsa
                              </button>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  onClick={() =>
                                    updateQuantity(product.id, -1)
                                  }
                                  aria-label={`Quitar una unidad de ${product.name}`}
                                  className="h-9 w-9 rounded-full border border-white/20 hover:border-[#f00078]"
                                >
                                  −
                                </button>
                                <span className="text-sm font-semibold">
                                  {quantity}
                                </span>
                                <button
                                  onClick={() => addToCart(product)}
                                  aria-label={`Agregar una unidad de ${product.name}`}
                                  className="h-9 w-9 rounded-full bg-[#f00078] hover:bg-[#cf0066]"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Sobre la boutique */}
      <section
        id="nosotros"
        className="border-y border-white/10 bg-[#130e13]"
      >
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 md:grid-cols-2 md:items-center md:py-20">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-[#ff55a9]">
              Nuestra esencia
            </p>
            <h2 className="mt-4 text-3xl font-light leading-tight sm:text-4xl">
              La moda es más que vestir.
              <span className="block font-semibold italic text-[#f00078]">
                Es expresar quién eres.
              </span>
            </h2>
          </div>

          <div className="text-sm leading-7 text-white/60">
            <p>
              En Maye Boutique queremos ayudarte a encontrar prendas
              que reflejen tu personalidad. Nuestra propuesta reúne
              moda femenina importada y una experiencia de compra
              pensada para que elegir tus próximos looks sea sencillo.
            </p>
            <p className="mt-4">
              Selecciona tus productos, comparte tus datos de envío y
              contáctanos para confirmar disponibilidad, transporte
              y forma de pago.
            </p>
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section id="contacto" className="mx-auto max-w-7xl px-5 py-16 text-center sm:px-8 sm:py-20">
        <p className="text-[10px] uppercase tracking-[0.35em] text-[#ff55a9]">
          Estamos para ayudarte
        </p>
        <h2 className="mt-4 text-3xl font-light sm:text-4xl">
          Tu próxima prenda favorita
          <span className="block font-semibold italic">te está esperando.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-white/50">
          ¿Tienes dudas sobre una prenda o quieres consultar un envío?
          Escríbenos y te ayudaremos con tu compra.
        </p>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noreferrer"
          className="mt-7 inline-flex rounded-full bg-[#f00078] px-8 py-4 text-xs font-bold uppercase tracking-wider transition hover:bg-[#cf0066]"
        >
          Consultar por WhatsApp
        </a>
        <p className="mt-4 text-xs text-white/40">
          Instagram: @mayee_studio · @mayee_boutique
        </p>
      </section>

      {/* Barra de compra */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#100c10]/95 p-4 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/45">
                {totalItems} artículo(s) · Subtotal
              </p>
              <p className="mt-1 font-semibold text-[#ff55a9]">
                {formatUSD(subtotal)}
                <span className="ml-2 text-xs font-normal text-white/50">
                  Bs. {totalBs.toFixed(2)}
                </span>
              </p>
            </div>
            <button
              onClick={() => setIsCartOpen(true)}
              className="rounded-full bg-[#f00078] px-6 py-3.5 text-xs font-bold transition hover:bg-[#cf0066]"
            >
              Revisar mi bolsa →
            </button>
          </div>
        </div>
      )}

      {/* Bolsa y formulario de envío */}
      {isCartOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm"
          onClick={() => setIsCartOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Bolsa de compras"
            className="flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-white/10 bg-[#100c10] p-5 sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-[#ff55a9]">
                  Maye Boutique
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  Tu bolsa de compras
                </h2>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="rounded-full border border-white/20 px-4 py-2 text-xs"
              >
                Cerrar ✕
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <span className="font-serif text-6xl italic text-[#f00078]">
                  M
                </span>
                <p className="mt-4 text-sm text-white/60">
                  Tu bolsa está esperando tus favoritos.
                </p>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="mt-5 rounded-full bg-[#f00078] px-6 py-3 text-xs font-bold"
                >
                  Explorar colección
                </button>
              </div>
            ) : (
              <>
                <div className="my-5 space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="mt-1 text-xs text-[#ff55a9]">
                          {formatUSD(item.price)} por unidad
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="h-8 w-8 rounded-full border border-white/15"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-sm">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="h-8 w-8 rounded-full bg-[#f00078]"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-xs font-semibold">
                        {formatUSD(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="space-y-4 border-t border-white/10 pt-5">
                  <h3 className="text-sm font-semibold">
                    Datos para el envío
                  </h3>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Nombre y apellido"
                      autoComplete="name"
                      className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-[#f00078]"
                    />
                    <input
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      placeholder="Teléfono de contacto"
                      autoComplete="tel"
                      inputMode="tel"
                      className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-[#f00078]"
                    />
                    <input
                      value={customerState}
                      onChange={(event) => setCustomerState(event.target.value)}
                      placeholder="Estado"
                      autoComplete="address-level1"
                      className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-[#f00078]"
                    />
                    <input
                      value={customerCity}
                      onChange={(event) => setCustomerCity(event.target.value)}
                      placeholder="Ciudad o municipio"
                      autoComplete="address-level2"
                      className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-[#f00078]"
                    />
                  </div>

                  <textarea
                    value={deliveryAddress}
                    onChange={(event) => setDeliveryAddress(event.target.value)}
                    placeholder="Dirección detallada, urbanización, calle, edificio y referencias"
                    rows={3}
                    autoComplete="street-address"
                    className="w-full resize-y rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-[#f00078]"
                  />

                  <label className="block text-xs text-white/55">
                    Método de pago preferido
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-[#1b151b] px-4 py-3 text-sm outline-none focus:border-[#f00078]"
                  >
                    <option value="Pago Móvil (Bs)">Pago Móvil (Bs)</option>
                    <option value="Efectivo / Divisas">Efectivo / Divisas</option>
                    <option value="Transferencia bancaria">Transferencia bancaria</option>
                    <option value="Zelle / Binance">Zelle / Binance</option>
                  </select>

                  <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex justify-between text-sm text-white/55">
                      <span>Subtotal de productos</span>
                      <span>{formatUSD(subtotal)}</span>
                    </div>
                    <div className="mt-3 flex justify-between text-sm text-white/55">
                      <span>Envío nacional</span>
                      <span className="text-[#ff55a9]">Por cotizar</span>
                    </div>
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <div className="flex justify-between font-semibold">
                        <span>Total de productos</span>
                        <span>{formatUSD(subtotal)}</span>
                      </div>
                      <p className="mt-2 text-xs text-white/45">
                        Referencia: Bs. {totalBs.toFixed(2)}
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-white/45">
                        El costo del transporte y el total definitivo
                        se confirmarán por WhatsApp antes de completar
                        la compra.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={checkoutWhatsApp}
                    disabled={isSubmitting || isLoadingExchangeRate}
                    className="w-full rounded-full bg-[#f00078] px-5 py-4 text-xs font-bold uppercase tracking-wider transition hover:bg-[#cf0066] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting
                      ? 'Registrando pedido...'
                      : isLoadingExchangeRate
                        ? 'Actualizando tasa...'
                        : 'Confirmar pedido por WhatsApp'}
                  </button>
                  <p className="text-center text-[10px] leading-5 text-white/35">
                    Tu pedido se registra en el sistema antes de abrir
                    WhatsApp para coordinar los detalles.
                  </p>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* Pie de página */}
      <footer className="border-t border-white/10 bg-[#080708] px-5 py-8 text-center">
        <p className="text-sm font-semibold tracking-[0.2em]">
          MAYE <span className="text-[#f00078]">BOUTIQUE</span>
        </p>
        <p className="mt-2 text-[10px] text-white/40">
          Moda femenina importada · Envíos nacionales
        </p>
        <p className="mt-3 text-[10px] text-white/30">
          Instagram: @mayee_studio · @mayee_boutique
        </p>
        <p className="mt-5 text-[10px] text-white/25">
          © {new Date().getFullYear()} Maye Boutique. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
