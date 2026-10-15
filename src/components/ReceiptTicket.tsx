import React from 'react';

type CartItem = {
  id?: number;
  product_id?: number;
  name?: string;
  price: number;
  quantity: number;
  taxable?: boolean | number;
};

type SaleData = {
  id?: number | string;
  created_at?: string;
  clientName?: string;
  items: CartItem[];
  subtotalUSD?: number;
  ivaUSD?: number;
  total_usd: number;
  total_ves: number;
  exchange_rate: number;
  payment_method: string;
  changeUSD?: number;
};

type ReceiptProps = {
  sale: SaleData;
};

export default function ReceiptTicket({ sale }: ReceiptProps) {
  if (!sale) return null;

  // Extracción segura de propiedades con valores por defecto
  const saleId = sale.id ?? 'TEMP';
  const date = sale.created_at ?? new Date().toLocaleString();
  const clientName = sale.clientName ?? 'Cliente General';
  const items = sale.items ?? [];
  
  const exchangeRate = sale.exchange_rate ?? 0;
  const totalUSD = sale.total_usd ?? 0;
  const totalBs = sale.total_ves ?? 0;
  const paymentMethod = sale.payment_method ?? 'Efectivo';
  const changeUSD = sale.changeUSD ?? 0;

  // Cálculo de subtotales por si no vienen explícitos en el objeto
  const subtotalUSD = sale.subtotalUSD ?? items.reduce((acc, item) => acc + ((item.price || 0) * item.quantity), 0);
  const ivaUSD = sale.ivaUSD ?? 0;

  return (
    <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:text-black print:p-4 font-mono text-xs leading-tight">
      {/* Encabezado del Ticket */}
      <div className="text-center space-y-1 mb-3">
        <h1 className="font-bold text-sm">POS ENTERPRISE VENEZUELA</h1>
        <p>RIF: J-50000000-0</p>
        <p>Av. Principal, Local Comercial</p>
        <p>Tel: 0414-0000000</p>
      </div>

      <div className="border-t border-b border-dashed border-black py-1 mb-2 space-y-0.5">
        <p><strong>Nro Ticket:</strong> #{saleId}</p>
        <p><strong>Fecha:</strong> {date}</p>
        <p><strong>Cliente:</strong> {clientName}</p>
        <p><strong>Tasa BCV:</strong> Bs. {exchangeRate.toFixed(2)}</p>
      </div>

      {/* Tabla de Productos */}
      <div className="mb-2">
        <div className="flex justify-between border-b border-black font-bold pb-0.5 mb-1">
          <span>DESCRIPCIÓN</span>
          <span>CAN x PRECIO</span>
        </div>
        {items.map((item, index) => (
          <div key={index} className="mb-1">
            <div>{item.name || `Producto #${item.product_id || item.id}`} {item.taxable ? '*' : ''}</div>
            <div className="flex justify-between pl-2">
              <span>{item.quantity} un. x ${(item.price || 0).toFixed(2)}</span>
              <span>${((item.price || 0) * item.quantity).toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Totales */}
      <div className="border-t border-dashed border-black pt-1 space-y-1">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>${subtotalUSD.toFixed(2)}</span>
        </div>
        {ivaUSD > 0 && (
          <div className="flex justify-between">
            <span>IVA:</span>
            <span>${ivaUSD.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm pt-1 border-t border-black">
          <span>TOTAL USD:</span>
          <span>${totalUSD.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-sm text-emerald-700">
          <span>TOTAL Bs.:</span>
          <span>Bs. {totalBs.toFixed(2)}</span>
        </div>
      </div>

      {/* Método de pago y vuelto */}
      <div className="border-t border-dashed border-black pt-1 mt-2 space-y-0.5">
        <p><strong>Método de Pago:</strong> {paymentMethod}</p>
        {paymentMethod !== 'Crédito / Fiado' && changeUSD > 0 && (
          <p><strong>Vuelto Entregado:</strong> ${changeUSD.toFixed(2)} (Bs. {(changeUSD * exchangeRate).toFixed(2)})</p>
        )}
      </div>

      {/* Pie de página */}
      <div className="text-center mt-4 pt-2 border-t border-dashed border-black space-y-1">
        <p>¡Gracias por su compra!</p>
        <p className="text-[10px]">(*) Artículos gravados con IVA</p>
      </div>
    </div>
  );
}
