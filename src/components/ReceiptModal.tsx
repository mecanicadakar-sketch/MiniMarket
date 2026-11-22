import React from 'react';
import { Printer, Usb, X } from 'lucide-react';
import { Sale, StoreSettings } from '../types/pos';
import { formatCurrency, formatDateTime, formatQuantity } from '../utils/format';

interface ReceiptModalProps {
  sale: Sale | null;
  store: StoreSettings;
  printerConnected: boolean;
  onPrintSerial: (sale: Sale) => Promise<void>;
  onClose: () => void;
}

function BarcodeGraphic({ value }: { value: string }) {
  const digits = value.replace(/\D/g, '') || '000100000142';
  const bars: { x: number; w: number }[] = [];
  let cursor = 4;
  for (let i = 0; i < digits.length; i++) {
    const code = digits.charCodeAt(i) % 4;
    const width = code === 0 ? 1.5 : code === 1 ? 2.5 : code === 2 ? 1 : 3;
    const gap = (i % 3) + 1.2;
    bars.push({ x: cursor, w: width });
    cursor += width + gap;
  }

  return (
    <div className="flex flex-col items-center pt-2">
      <svg
        width={Math.max(160, cursor + 4)}
        height="34"
        viewBox={`0 0 ${Math.max(160, cursor + 4)} 34`}
        className="text-slate-900"
        aria-label={`Código de comprobante ${value}`}
      >
        {bars.map((b, idx) => (
          <rect key={idx} x={b.x} y={0} width={b.w} height={32} fill="currentColor" />
        ))}
      </svg>
      <span className="mt-1 font-mono text-[10px] tracking-widest text-slate-600">
        {value}
      </span>
    </div>
  );
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  store,
  printerConnected,
  onPrintSerial,
  onClose,
}) => {
  if (!sale) return null;

  const handleBrowserPrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Vista previa de comprobante"
    >
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-amber-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50/40 px-5 py-3.5">
          <div>
            <h3 className="font-display text-base font-semibold text-emerald-950">
              {sale.documentType} emitido
            </h3>
            <p className="text-xs text-stone-500 font-mono tabular-nums">
              Nro. {sale.ticketNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-amber-100/70 hover:text-emerald-950"
            aria-label="Cerrar vista previa"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-amber-50/60 p-5">
          <div
            id="printable-receipt"
            className="mx-auto w-full max-w-[320px] border border-stone-200 bg-white p-5 font-mono text-xs text-stone-900 shadow-sm"
          >
            <div className="border-b border-dashed border-stone-300 pb-3 text-center">
              {store.logoUrl && (
                <img
                  src={store.logoUrl}
                  alt={store.storeName}
                  referrerPolicy="no-referrer"
                  className="mx-auto mb-2 max-h-20 max-w-[210px] object-contain grayscale contrast-125"
                />
              )}
              <p className="font-display text-base font-bold tracking-tight text-stone-900">
                {store.storeName}
              </p>
              <p className="text-[11px] text-stone-700">{store.legalName}</p>
              <p className="text-[11px] text-stone-600">RUC: {store.taxId}</p>
              <p className="text-[11px] text-stone-600">{store.address}</p>
              <p className="text-[11px] text-stone-600">Tel: {store.phone}</p>
              {store.email && (
                <p className="text-[11px] text-stone-600">{store.email}</p>
              )}
            </div>

            <div className="border-b border-dashed border-stone-300 py-2.5 text-[11px]">
              <div className="flex justify-between">
                <span className="font-semibold uppercase">{sale.documentType}</span>
                <span className="tabular-nums">{sale.ticketNumber}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Fecha</span>
                <span className="tabular-nums">{formatDateTime(sale.timestamp)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Cajero</span>
                <span>{sale.cashier}</span>
              </div>
              {(sale.customer?.name || sale.customer?.taxId) && (
                <div className="mt-1 border-t border-dotted border-stone-200 pt-1 text-stone-700">
                  <div className="flex justify-between gap-2">
                    <span>Cliente</span>
                    <span className="text-right font-medium">
                      {sale.customer.name || 'Consumidor Final'}
                    </span>
                  </div>
                  {sale.customer.taxId && (
                    <div className="flex justify-between gap-2">
                      <span>RUC / Doc.</span>
                      <span className="tabular-nums font-medium">{sale.customer.taxId}</span>
                    </div>
                  )}
                  {sale.customer.address && (
                    <div className="flex justify-between gap-2">
                      <span>Dirección</span>
                      <span className="text-right">{sale.customer.address}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-b border-dashed border-stone-300 py-2.5">
              <div className="mb-1.5 flex justify-between text-[10px] font-semibold uppercase text-stone-500">
                <span>Descripción</span>
                <span>Importe</span>
              </div>
              <div className="space-y-2">
                {sale.items.map((item, idx) => (
                  <div key={`${item.productId}-${idx}`}>
                    <p className="truncate font-medium text-stone-900">{item.name}</p>
                    <div className="flex justify-between text-[11px] text-stone-600 tabular-nums">
                      <span>
                        {formatQuantity(item.quantity, item.unit)} ×{' '}
                        {formatCurrency(item.unitPrice, store.currencySymbol)}
                        {item.discountPct > 0 ? ` (-${item.discountPct}%)` : ''}
                      </span>
                      <span className="font-medium text-stone-900">
                        {formatCurrency(item.lineTotal, store.currencySymbol)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-b border-dashed border-stone-300 py-2.5 space-y-1 text-[11px] tabular-nums">
              {sale.discountTotal > 0 && (
                <div className="flex justify-between text-stone-600">
                  <span>Descuentos</span>
                  <span>-{formatCurrency(sale.discountTotal, store.currencySymbol)}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-600">
                <span>IVA contenido</span>
                <span>{formatCurrency(sale.taxTotal, store.currencySymbol)}</span>
              </div>
              <div className="flex justify-between pt-1 text-sm font-bold text-stone-900">
                <span>TOTAL</span>
                <span>{formatCurrency(sale.total, store.currencySymbol)}</span>
              </div>
            </div>

            <div className="border-b border-dashed border-stone-300 py-2.5 space-y-1 text-[11px] tabular-nums">
              <div className="flex justify-between">
                <span className="text-stone-600">Medio de pago</span>
                <span className="font-medium uppercase">{sale.payment.method}</span>
              </div>
              {sale.payment.cashAmount > 0 && (
                <div className="flex justify-between text-stone-600">
                  <span>Efectivo aplicado</span>
                  <span>{formatCurrency(sale.payment.cashAmount, store.currencySymbol)}</span>
                </div>
              )}
              {sale.payment.cardAmount > 0 && (
                <div className="flex justify-between text-stone-600">
                  <span>Tarjeta</span>
                  <span>{formatCurrency(sale.payment.cardAmount, store.currencySymbol)}</span>
                </div>
              )}
              {sale.payment.transferAmount > 0 && (
                <div className="flex justify-between text-stone-600">
                  <span>Transferencia</span>
                  <span>{formatCurrency(sale.payment.transferAmount, store.currencySymbol)}</span>
                </div>
              )}
              {sale.payment.cashTendered > 0 && (
                <>
                  <div className="flex justify-between text-stone-600">
                    <span>Recibido</span>
                    <span>{formatCurrency(sale.payment.cashTendered, store.currencySymbol)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-stone-900">
                    <span>Su vuelto</span>
                    <span>{formatCurrency(sale.payment.changeGiven, store.currencySymbol)}</span>
                  </div>
                </>
              )}
              {sale.payment.reference && (
                <div className="flex justify-between text-stone-500">
                  <span>Referencia</span>
                  <span>{sale.payment.reference}</span>
                </div>
              )}
            </div>

            <div className="pt-3 text-center">
              <p className="text-[11px] text-stone-600">{store.receiptFooter}</p>
              <BarcodeGraphic value={sale.ticketNumber} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-amber-100 bg-amber-50/30 px-5 py-3.5">
          {printerConnected && (
            <button
              type="button"
              onClick={() => onPrintSerial(sale)}
              className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-amber-50"
            >
              <Usb className="h-4 w-4 text-emerald-700" />
              Imprimir ESC/POS
            </button>
          )}
          <button
            type="button"
            onClick={handleBrowserPrint}
            className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-800 transition-colors hover:bg-orange-100"
          >
            <Printer className="h-4 w-4" />
            Imprimir 80mm
          </button>
          <button
            type="button"
            onClick={onClose}
            className="whitespace-nowrap shrink-0 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
