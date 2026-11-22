import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Ban,
  CheckCircle2,
  Lock,
  Printer,
  Receipt,
  Unlock,
  X,
} from 'lucide-react';
import { CashMovement, Sale, Shift, StoreSettings } from '../types/pos';
import { formatCurrency, formatDateTime, formatQuantity } from '../utils/format';

interface CashRegisterProps {
  activeShift: Shift | null;
  closedShifts: Shift[];
  sales: Sale[];
  cashMovements: CashMovement[];
  store: StoreSettings;
  defaultCashierName?: string;
  canManageCash?: boolean;
  canVoidSales?: boolean;
  onOpenShift: (payload: { registerName: string; cashier: string; openingFloat: number }) => void;
  onCloseShift: (payload: { countedCash: number; notes: string }) => void;
  onAddCashMovement: (payload: { type: 'ingreso' | 'retiro'; amount: number; reason: string }) => void;
  onViewReceipt: (sale: Sale) => void;
  onVoidSale: (saleId: string) => Promise<void> | void;
  onOpenDrawerTest: () => void;
  onViewAllSales?: () => void;
}

const DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500];

export const CashRegister: React.FC<CashRegisterProps> = ({
  activeShift,
  closedShifts,
  sales,
  cashMovements,
  store,
  defaultCashierName = 'Cajero Turno',
  canManageCash = true,
  canVoidSales = true,
  onOpenShift,
  onCloseShift,
  onAddCashMovement,
  onViewReceipt,
  onVoidSale,
  onOpenDrawerTest,
  onViewAllSales,
}) => {
  // Open shift form
  const [cashierName, setCashierName] = useState(defaultCashierName);
  const [registerName, setRegisterName] = useState('Caja 01');
  const [openingFloatStr, setOpeningFloatStr] = useState('25000');

  // Cash movement modal
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movType, setMovType] = useState<'ingreso' | 'retiro'>('retiro');
  const [movAmountStr, setMovAmountStr] = useState('');
  const [movReason, setMovReason] = useState('');

  // Close shift modal (Arqueo)
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [coinsStr, setCoinsStr] = useState('0');
  const [closeNotes, setCloseNotes] = useState('');

  // Void sale confirmation
  const [saleToVoid, setSaleToVoid] = useState<Sale | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);

  const shiftMetrics = useMemo(() => {
    if (!activeShift) {
      return {
        shiftSales: [],
        shiftMovements: [],
        cashSales: 0,
        cardSales: 0,
        transferSales: 0,
        totalSales: 0,
        cashIn: 0,
        cashOut: 0,
        expectedCash: 0,
      };
    }

    const shiftSales = sales.filter((s) => s.shiftId === activeShift.id);
    const validSales = shiftSales.filter((s) => s.status === 'completada');
    const shiftMovements = cashMovements.filter((m) => m.shiftId === activeShift.id);

    let cashSales = 0;
    let cardSales = 0;
    let transferSales = 0;

    for (const s of validSales) {
      cashSales += s.payment.cashAmount;
      cardSales += s.payment.cardAmount;
      transferSales += s.payment.transferAmount;
    }

    let cashIn = 0;
    let cashOut = 0;
    for (const m of shiftMovements) {
      if (m.type === 'ingreso') cashIn += m.amount;
      else cashOut += m.amount;
    }

    const expectedCash = activeShift.openingFloat + cashSales + cashIn - cashOut;

    return {
      shiftSales,
      shiftMovements,
      cashSales,
      cardSales,
      transferSales,
      totalSales: cashSales + cardSales + transferSales,
      cashIn,
      cashOut,
      expectedCash,
    };
  }, [activeShift, sales, cashMovements]);

  const countedCashTotal = useMemo(() => {
    let sum = parseFloat(coinsStr.replace(',', '.')) || 0;
    for (const denom of DENOMINATIONS) {
      sum += denom * (counts[denom] || 0);
    }
    return Number(sum.toFixed(2));
  }, [counts, coinsStr]);

  const handleOpenShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onOpenShift({
      registerName: registerName.trim() || 'Caja 01',
      cashier: cashierName.trim() || 'Cajero Turno',
      openingFloat: Math.max(0, parseFloat(openingFloatStr.replace(',', '.')) || 0),
    });
  };

  const handleMovementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(movAmountStr.replace(',', '.')) || 0;
    if (amount <= 0) return;
    onAddCashMovement({
      type: movType,
      amount,
      reason: movReason.trim() || (movType === 'ingreso' ? 'Ingreso manual' : 'Retiro de caja'),
    });
    setMovementModalOpen(false);
    setMovAmountStr('');
    setMovReason('');
  };

  const handleConfirmCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    onCloseShift({
      countedCash: countedCashTotal,
      notes: closeNotes.trim(),
    });
    setCloseModalOpen(false);
    setCounts({});
    setCoinsStr('0');
    setCloseNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Active Shift Card OR Open Shift Prompt */}
      {!activeShift ? (
        <div className="mx-auto max-w-xl rounded-xl border border-amber-200/90 bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-orange-600">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-emerald-950">
                Apertura de Turno de Caja
              </h2>
              <p className="text-xs text-stone-500">
                Ingresá el fondo inicial de efectivo para habilitar el cobro rápido.
              </p>
            </div>
          </div>

          <form onSubmit={handleOpenShiftSubmit} className="mt-5 space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-stone-700">Terminal / Caja</label>
                <input
                  type="text"
                  required
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-stone-700">Cajero responsable</label>
                <input
                  type="text"
                  required
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-stone-700">
                Fondo inicial en efectivo (cambio)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={openingFloatStr}
                onChange={(e) => setOpeningFloatStr(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2.5 font-mono text-lg font-bold text-stone-900 tabular-nums focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white hover:bg-emerald-700"
            >
              <Unlock className="h-4 w-4" />
              Abrir Turno de Caja
            </button>
          </form>

          {onViewAllSales && (
            <div className="mt-4 border-t border-amber-100 pt-3 text-center">
              <button
                type="button"
                onClick={onViewAllSales}
                className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700"
              >
                <Receipt className="h-4 w-4" />
                Ver historial completo de tickets y ventas ({sales.length})
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Shift Header & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200/90 bg-white p-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span className="font-semibold text-emerald-700">Turno abierto</span>
                <span aria-hidden="true">·</span>
                <span>{activeShift.registerName}</span>
                <span aria-hidden="true">·</span>
                <span>Cajero: {activeShift.cashier}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Apertura {formatDateTime(activeShift.openedAt)}
                </span>
              </div>
              <p className="mt-1 font-display text-lg font-bold text-emerald-950 tabular-nums">
                Esperado en cajón: {formatCurrency(shiftMetrics.expectedCash, store.currencySymbol)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onOpenDrawerTest}
                className="whitespace-nowrap shrink-0 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-amber-100"
              >
                Abrir Cajón
              </button>
              {canManageCash && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMovType('retiro');
                      setMovementModalOpen(true);
                    }}
                    className="whitespace-nowrap shrink-0 rounded-lg border border-orange-200 bg-orange-50/70 px-4 py-2.5 text-sm font-semibold text-orange-800 hover:bg-orange-100"
                  >
                    Ingreso / Retiro
                  </button>
                  <button
                    type="button"
                    onClick={() => setCloseModalOpen(true)}
                    className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900"
                  >
                    <Lock className="h-4 w-4 text-amber-300" />
                    Cerrar Turno (Arqueo)
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Payment Method Breakdown KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="rounded-xl border border-amber-200/80 bg-white p-4">
              <p className="text-xs text-stone-500">Fondo inicial</p>
              <p className="mt-1 font-mono text-xl font-bold text-emerald-950 tabular-nums">
                {formatCurrency(activeShift.openingFloat, store.currencySymbol)}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200/80 bg-white p-4">
              <p className="text-xs text-stone-500">Ventas Efectivo</p>
              <p className="mt-1 font-mono text-xl font-bold text-emerald-700 tabular-nums">
                {formatCurrency(shiftMetrics.cashSales, store.currencySymbol)}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200/80 bg-white p-4">
              <p className="text-xs text-stone-500">Ventas Tarjeta</p>
              <p className="mt-1 font-mono text-xl font-bold text-orange-600 tabular-nums">
                {formatCurrency(shiftMetrics.cardSales, store.currencySymbol)}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200/80 bg-white p-4">
              <p className="text-xs text-stone-500">Transferencias / QR</p>
              <p className="mt-1 font-mono text-xl font-bold text-amber-600 tabular-nums">
                {formatCurrency(shiftMetrics.transferSales, store.currencySymbol)}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200/80 bg-white p-4">
              <p className="text-xs text-stone-500">Ingresos / Retiros</p>
              <p className="mt-1 font-mono text-sm font-bold text-emerald-950 tabular-nums">
                +{formatCurrency(shiftMetrics.cashIn, store.currencySymbol)} / -
                {formatCurrency(shiftMetrics.cashOut, store.currencySymbol)}
              </p>
              <p className="mt-0.5 text-[11px] text-stone-500">
                Total ventas: {formatCurrency(shiftMetrics.totalSales, store.currencySymbol)}
              </p>
            </div>
          </div>

          {/* Two-column: Sales in Shift & Cash Movements */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="overflow-hidden rounded-xl border border-amber-200/80 bg-white lg:col-span-8">
              <div className="flex items-center justify-between border-b border-amber-200/70 bg-amber-50/40 px-4 py-3">
                <h3 className="font-display text-sm font-semibold text-emerald-950">
                  Comprobantes del turno ({shiftMetrics.shiftSales.length})
                </h3>
                {onViewAllSales && (
                  <button
                    type="button"
                    onClick={onViewAllSales}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700"
                  >
                    <Receipt className="h-4 w-4" />
                    Ver todos ({sales.length})
                  </button>
                )}
              </div>
              {shiftMetrics.shiftSales.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Aún no se emitieron ventas en este turno.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Comprobante</th>
                        <th className="px-4 py-2.5 font-medium">Hora</th>
                        <th className="px-4 py-2.5 font-medium">Medio de pago</th>
                        <th className="px-4 py-2.5 font-medium text-right">Total</th>
                        <th className="px-4 py-2.5 font-medium">Estado</th>
                        <th className="px-4 py-2.5 font-medium text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shiftMetrics.shiftSales.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5 font-mono text-slate-900 tabular-nums">
                            <div className="font-semibold">{s.ticketNumber}</div>
                            <div className="text-[11px] text-slate-500">
                              {s.documentType}
                              {s.customer?.taxId
                                ? ` · RUC ${s.customer.taxId}`
                                : s.customer?.name
                                  ? ` · ${s.customer.name}`
                                  : ''}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-slate-500 tabular-nums">
                            {formatDateTime(s.timestamp)}
                          </td>
                          <td className="px-4 py-2.5 capitalize text-slate-700">
                            {s.payment.method}
                            {s.payment.reference && (
                              <div className="text-[11px] text-slate-400">{s.payment.reference}</div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                            {formatCurrency(s.total, store.currencySymbol)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={
                                s.status === 'anulada'
                                  ? 'font-medium text-red-600'
                                  : 'font-medium text-emerald-700'
                              }
                            >
                              {s.status === 'anulada' ? 'Anulada' : 'Emitida'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onViewReceipt(s)}
                              className="mr-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              title="Ver / Reimprimir ticket"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                            {s.status === 'completada' && canVoidSales && (
                              <button
                                type="button"
                                onClick={() => setSaleToVoid(s)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                title="Anular venta y reintegrar stock"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-4">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Movimientos de efectivo
                </h3>
              </div>
              {shiftMetrics.shiftMovements.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Sin ingresos ni retiros manuales en este turno.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {shiftMetrics.shiftMovements.map((m) => (
                    <div key={m.id} className="flex items-start justify-between gap-3 px-4 py-3 text-xs">
                      <div className="flex items-start gap-2.5">
                        {m.type === 'ingreso' ? (
                          <ArrowDownCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <ArrowUpCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        )}
                        <div>
                          <p className="font-medium text-slate-900">{m.reason}</p>
                          <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                            {formatDateTime(m.timestamp)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`font-mono font-semibold tabular-nums ${
                          m.type === 'ingreso' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {m.type === 'ingreso' ? '+' : '-'}
                        {formatCurrency(m.amount, store.currencySymbol)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Closed Shifts History (Cierres Z) */}
      <div className="overflow-hidden rounded-xl border border-amber-200/80 bg-white">
        <div className="border-b border-amber-200/70 bg-amber-50/40 px-4 py-3">
          <h3 className="font-display text-sm font-semibold text-emerald-950">
            Historial de cierres de caja (Cierres Z)
          </h3>
        </div>
        {closedShifts.length === 0 ? (
          <div className="p-6 text-center text-xs text-stone-500">
            Los turnos cerrados aparecerán aquí con su arqueo y diferencia.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-amber-200/70 bg-amber-50/50 text-stone-600">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Caja / Cajero</th>
                  <th className="px-4 py-2.5 font-medium">Apertura</th>
                  <th className="px-4 py-2.5 font-medium">Cierre</th>
                  <th className="px-4 py-2.5 font-medium text-right">Esperado</th>
                  <th className="px-4 py-2.5 font-medium text-right">Contado</th>
                  <th className="px-4 py-2.5 font-medium text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100/70">
                {closedShifts.map((sh) => (
                  <tr key={sh.id} className="hover:bg-amber-50/40">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-stone-900">{sh.registerName}</div>
                      <div className="text-[11px] text-stone-500">{sh.cashier}</div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-stone-600 tabular-nums">
                      {formatDateTime(sh.openedAt)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-stone-600 tabular-nums">
                      {sh.closedAt ? formatDateTime(sh.closedAt) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-stone-700 tabular-nums">
                      {formatCurrency(sh.expectedCash || 0, store.currencySymbol)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-950 tabular-nums">
                      {formatCurrency(sh.countedCash || 0, store.currencySymbol)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono font-semibold tabular-nums ${
                        Math.abs(sh.difference || 0) < 0.01
                          ? 'text-emerald-700'
                          : (sh.difference || 0) < 0
                            ? 'text-red-600'
                            : 'text-orange-600'
                      }`}
                    >
                      {(sh.difference || 0) >= 0 ? '+' : ''}
                      {formatCurrency(sh.difference || 0, store.currencySymbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cash Movement Modal */}
      {movementModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Registrar movimiento de caja"
        >
          <form
            onSubmit={handleMovementSubmit}
            className="w-full max-w-md rounded-xl border border-amber-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50/40 px-5 py-3.5">
              <h3 className="font-display text-base font-semibold text-emerald-950">
                Movimiento de efectivo en caja
              </h3>
              <button
                type="button"
                onClick={() => setMovementModalOpen(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-amber-100/70 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3.5 p-5 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMovType('retiro')}
                  className={`rounded-lg border py-2.5 text-sm font-semibold transition-colors ${
                    movType === 'retiro'
                      ? 'border-orange-500 bg-orange-500 text-white'
                      : 'border-amber-200 bg-white text-stone-700 hover:bg-amber-50'
                  }`}
                >
                  Retiro / Pago (-)
                </button>
                <button
                  type="button"
                  onClick={() => setMovType('ingreso')}
                  className={`rounded-lg border py-2.5 text-sm font-semibold transition-colors ${
                    movType === 'ingreso'
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-amber-200 bg-white text-stone-700 hover:bg-amber-50'
                  }`}
                >
                  Ingreso de cambio (+)
                </button>
              </div>
              <div>
                <label className="block font-medium text-stone-700">Monto</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={movAmountStr}
                  onChange={(e) => setMovAmountStr(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-base font-semibold text-stone-900 tabular-nums focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-stone-700">Concepto / Motivo</label>
                <input
                  type="text"
                  required
                  value={movReason}
                  onChange={(e) => setMovReason(e.target.value)}
                  placeholder="Ej: Pago proveedor panadería / Retiro a tesorería"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2.5 border-t border-amber-100 bg-amber-50/30 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setMovementModalOpen(false)}
                className="rounded-lg border border-amber-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-amber-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Guardar Movimiento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Close Shift / Arqueo Modal */}
      {closeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Arqueo y cierre de turno"
        >
          <form
            onSubmit={handleConfirmCloseShift}
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-amber-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50/40 px-5 py-3.5">
              <div>
                <h3 className="font-display text-base font-semibold text-emerald-950">
                  Arqueo y Cierre de Caja
                </h3>
                <p className="text-xs text-stone-500">
                  Contá los billetes y monedas del cajón para cerrar el turno.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCloseModalOpen(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-amber-100/70 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                {DENOMINATIONS.map((denom) => (
                  <div
                    key={denom}
                    className="flex items-center justify-between gap-2 rounded-lg border border-amber-200/80 px-3 py-1.5"
                  >
                    <span className="font-mono font-medium text-stone-700 tabular-nums">
                      {formatCurrency(denom, store.currencySymbol)}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={counts[denom] ?? ''}
                      placeholder="0"
                      onChange={(e) =>
                        setCounts({
                          ...counts,
                          [denom]: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-16 rounded border border-amber-200 bg-amber-50/40 px-2 py-1 text-right font-mono font-semibold text-stone-900 tabular-nums focus:border-orange-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-medium text-stone-700">
                  Monedas / Billetes chicos (total)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={coinsStr}
                  onChange={(e) => setCoinsStr(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900 tabular-nums focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="rounded-xl bg-emerald-950 p-4 text-white space-y-1.5 font-mono tabular-nums">
                <div className="flex justify-between text-xs text-emerald-300/80">
                  <span>Efectivo esperado en sistema</span>
                  <span>{formatCurrency(shiftMetrics.expectedCash, store.currencySymbol)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span>Efectivo contado</span>
                  <span className="text-amber-300">
                    {formatCurrency(countedCashTotal, store.currencySymbol)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-emerald-900 pt-1.5 text-xs">
                  <span className="text-emerald-300/80">Diferencia</span>
                  <span
                    className={
                      Math.abs(countedCashTotal - shiftMetrics.expectedCash) < 0.01
                        ? 'text-emerald-400'
                        : countedCashTotal < shiftMetrics.expectedCash
                          ? 'text-red-400'
                          : 'text-amber-300'
                    }
                  >
                    {countedCashTotal - shiftMetrics.expectedCash >= 0 ? '+' : ''}
                    {formatCurrency(
                      countedCashTotal - shiftMetrics.expectedCash,
                      store.currencySymbol
                    )}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700">
                  Observaciones de cierre (opcional)
                </label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Ej: Turno mañana sin novedades"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-amber-100 bg-amber-50/30 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setCloseModalOpen(false)}
                className="rounded-lg border border-amber-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-amber-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirmar Cierre Z
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Void Sale Confirmation Modal */}
      {saleToVoid && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar anulación de comprobante"
        >
          <div className="w-full max-w-md rounded-xl border border-amber-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50/40 px-5 py-3.5">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <h3 className="font-display text-sm font-semibold text-emerald-950">
                  Confirmar anulación de venta
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !isVoiding && setSaleToVoid(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-amber-100/70 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 p-5 text-xs">
              <p className="text-stone-600">
                Vas a anular el comprobante{' '}
                <span className="font-mono font-semibold text-emerald-950">
                  {saleToVoid.documentType} {saleToVoid.ticketNumber}
                </span>{' '}
                por un total de{' '}
                <span className="font-mono font-semibold text-emerald-950">
                  {formatCurrency(saleToVoid.total, store.currencySymbol)}
                </span>
                .
              </p>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="font-semibold text-amber-900">
                  Se reintegrará automáticamente al inventario:
                </p>
                <ul className="mt-1.5 space-y-1 text-amber-800">
                  {saleToVoid.items.map((item, idx) => (
                    <li
                      key={`${item.productId}-${idx}`}
                      className="flex items-center justify-between font-mono tabular-nums"
                    >
                      <span className="font-sans truncate pr-2">{item.name}</span>
                      <span className="shrink-0 font-semibold">
                        +{formatQuantity(item.quantity, item.unit)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-amber-100 bg-amber-50/30 px-5 py-3.5">
              <button
                type="button"
                disabled={isVoiding}
                onClick={() => setSaleToVoid(null)}
                className="rounded-lg border border-amber-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-amber-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isVoiding}
                onClick={async () => {
                  setIsVoiding(true);
                  try {
                    await onVoidSale(saleToVoid.id);
                    setSaleToVoid(null);
                  } finally {
                    setIsVoiding(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                <Ban className="h-4 w-4" />
                {isVoiding ? 'Anulando...' : 'Anular y reintegrar stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
