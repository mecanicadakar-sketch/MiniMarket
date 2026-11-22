import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  FileText,
  Printer,
  Receipt,
  Search,
  X,
} from 'lucide-react';
import { DocumentType, Sale, Shift, StoreSettings } from '../types/pos';
import { downloadCsv, formatCurrency, formatDateTime, formatQuantity } from '../utils/format';

interface SalesHistoryProps {
  sales: Sale[];
  shifts: Shift[];
  activeShift: Shift | null;
  store: StoreSettings;
  canVoidSales: boolean;
  onViewReceipt: (sale: Sale) => void;
  onVoidSale: (saleId: string) => Promise<void> | void;
  onOpenCashTab: () => void;
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({
  sales,
  shifts,
  activeShift,
  store,
  canVoidSales,
  onViewReceipt,
  onVoidSale,
  onOpenCashTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState<'all' | DocumentType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completada' | 'anulada'>('all');
  const [shiftFilter, setShiftFilter] = useState<string>('all');
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [saleToVoid, setSaleToVoid] = useState<Sale | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);

  const shiftMap = useMemo(() => {
    const map = new Map<string, Shift>();
    for (const sh of shifts) {
      map.set(sh.id, sh);
    }
    return map;
  }, [shifts]);

  const filteredSales = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sales.filter((s) => {
      if (docTypeFilter !== 'all' && s.documentType !== docTypeFilter) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (shiftFilter === 'active') {
        if (!activeShift || s.shiftId !== activeShift.id) return false;
      } else if (shiftFilter !== 'all' && s.shiftId !== shiftFilter) {
        return false;
      }

      if (!q) return true;
      const inTicket = s.ticketNumber.toLowerCase().includes(q);
      const inCashier = s.cashier.toLowerCase().includes(q);
      const inCustomerName = (s.customer?.name || '').toLowerCase().includes(q);
      const inCustomerRuc = (s.customer?.taxId || '').toLowerCase().includes(q);
      const inRef = (s.payment.reference || '').toLowerCase().includes(q);
      const inItems = s.items.some((item) => item.name.toLowerCase().includes(q));
      return inTicket || inCashier || inCustomerName || inCustomerRuc || inRef || inItems;
    });
  }, [sales, searchQuery, docTypeFilter, statusFilter, shiftFilter, activeShift]);

  const metrics = useMemo(() => {
    const valid = filteredSales.filter((s) => s.status === 'completada');
    const voided = filteredSales.filter((s) => s.status === 'anulada');
    const netTotal = valid.reduce((sum, s) => sum + s.total, 0);
    const voidedTotal = voided.reduce((sum, s) => sum + s.total, 0);
    const avgTicket = valid.length > 0 ? netTotal / valid.length : 0;

    return {
      validCount: valid.length,
      voidedCount: voided.length,
      netTotal,
      voidedTotal,
      avgTicket,
    };
  }, [filteredSales]);

  const handleExportCsv = () => {
    const headers = [
      'Comprobante',
      'Tipo',
      'Fecha y Hora',
      'Turno / Caja',
      'Cajero',
      'Cliente',
      'RUC',
      'Medio de Pago',
      'Subtotal',
      'Descuento',
      'Total',
      'Estado',
    ];
    const rows = filteredSales.map((s) => {
      const sh = shiftMap.get(s.shiftId);
      return [
        s.ticketNumber,
        s.documentType,
        formatDateTime(s.timestamp),
        sh ? `${sh.registerName} (${sh.status})` : s.shiftId,
        s.cashier,
        s.customer?.name || 'Consumidor Final',
        s.customer?.taxId || '-',
        s.payment.method,
        s.subtotal,
        s.discountTotal,
        s.total,
        s.status === 'anulada' ? 'Anulada' : 'Emitida',
      ];
    });
    downloadCsv(`ventas-tickets-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const handleConfirmVoid = async () => {
    if (!saleToVoid) return;
    setIsVoiding(true);
    try {
      await onVoidSale(saleToVoid.id);
      setSaleToVoid(null);
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Storage & Control Info Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-amber-200/80 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-100 p-2 text-orange-600">
            <Database className="h-4 w-4" />
          </div>
          <div className="text-xs">
            <p className="font-semibold text-emerald-950">
              Archivo general de tickets, facturas y control de anulaciones
            </p>
            <p className="mt-0.5 text-stone-500">
              Cada venta emitida se guarda automáticamente en la base de datos del comercio (colección{' '}
              <span className="font-mono text-emerald-800">sales</span>) con su turno asociado. Desde aquí podés consultar todos los comprobantes históricos, reimprimir o anular con reintegro automático de stock.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenCashTab}
            className="whitespace-nowrap shrink-0 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-amber-100/70"
          >
            Ir a Caja y Turnos
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredSales.length === 0}
            className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-amber-200/80 bg-white p-4">
          <p className="text-xs text-stone-500">Facturado neto (emitidas)</p>
          <p className="mt-1 font-mono text-xl font-bold text-emerald-950 tabular-nums">
            {formatCurrency(metrics.netTotal, store.currencySymbol)}
          </p>
          <p className="mt-0.5 text-[11px] text-stone-500">
            Según filtros aplicados
          </p>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-white p-4">
          <p className="text-xs text-stone-500">Comprobantes emitidos</p>
          <p className="mt-1 font-mono text-xl font-bold text-emerald-700 tabular-nums">
            {metrics.validCount}
          </p>
          <p className="mt-0.5 text-[11px] text-stone-500">
            Tickets y facturas válidas
          </p>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-white p-4">
          <p className="text-xs text-stone-500">Ticket promedio</p>
          <p className="mt-1 font-mono text-xl font-bold text-orange-600 tabular-nums">
            {formatCurrency(metrics.avgTicket, store.currencySymbol)}
          </p>
          <p className="mt-0.5 text-[11px] text-stone-500">
            Promedio por operación válida
          </p>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-white p-4">
          <p className="text-xs text-stone-500">Comprobantes anulados</p>
          <p className="mt-1 font-mono text-xl font-bold text-red-600 tabular-nums">
            {metrics.voidedCount}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-stone-500 tabular-nums">
            Total anulado: {formatCurrency(metrics.voidedTotal, store.currencySymbol)}
          </p>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="rounded-xl border border-amber-200/80 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700/70" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por Nro. ticket, cliente, RUC, cajero o producto..."
              className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-8 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="md:col-span-2">
            <select
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value as 'all' | DocumentType)}
              aria-label="Filtrar por tipo de comprobante"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
            >
              <option value="all">Todos los tipos</option>
              <option value="Ticket">Ticket</option>
              <option value="Factura B">Factura B</option>
              <option value="Factura A">Factura A</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | 'completada' | 'anulada')
              }
              aria-label="Filtrar por estado"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
            >
              <option value="all">Todos los estados</option>
              <option value="completada">Emitidas</option>
              <option value="anulada">Anuladas</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              aria-label="Filtrar por turno"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
            >
              <option value="all">Todos los turnos ({sales.length})</option>
              {activeShift && (
                <option value="active">
                  Turno actual · {activeShift.registerName}
                </option>
              )}
              {shifts
                .filter((sh) => !activeShift || sh.id !== activeShift.id)
                .map((sh) => (
                  <option key={sh.id} value={sh.id}>
                    {sh.registerName} · {formatDateTime(sh.openedAt)}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="overflow-hidden rounded-xl border border-amber-200/80 bg-white">
        <div className="flex items-center justify-between border-b border-amber-200/70 bg-amber-50/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-orange-600" />
            <h3 className="font-display text-sm font-semibold text-emerald-950">
              Registro de comprobantes ({filteredSales.length})
            </h3>
          </div>
          {!canVoidSales && (
            <span className="text-[11px] text-stone-500">
              Solo usuarios con permiso de anulación pueden anular ventas.
            </span>
          )}
        </div>

        {filteredSales.length === 0 ? (
          <div className="p-10 text-center text-xs text-stone-500">
            <FileText className="mx-auto mb-2 h-8 w-8 text-amber-400" />
            <p className="font-medium text-emerald-950">
              No se encontraron comprobantes con los filtros actuales.
            </p>
            <p className="mt-1 text-[11px] text-stone-500">
              Probá limpiando la búsqueda o seleccionando &ldquo;Todos los turnos&rdquo;.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-amber-200/70 bg-amber-50/50 text-stone-600">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Comprobante</th>
                  <th className="px-4 py-2.5 font-medium">Fecha y Turno</th>
                  <th className="px-4 py-2.5 font-medium">Cliente / RUC</th>
                  <th className="px-4 py-2.5 font-medium">Ítems</th>
                  <th className="px-4 py-2.5 font-medium">Medio de pago</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100/70">
                {filteredSales.map((s) => {
                  const sh = shiftMap.get(s.shiftId);
                  const isExpanded = expandedSaleId === s.id;
                  const itemUnitsCount = s.items.reduce(
                    (sum, item) => sum + (item.unit === 'kg' ? 1 : item.quantity),
                    0
                  );
                  return (
                    <React.Fragment key={s.id}>
                      <tr
                        className={`hover:bg-amber-50/40 ${
                          s.status === 'anulada' ? 'bg-red-50/25' : ''
                        }`}
                      >
                        <td className="px-4 py-3 font-mono tabular-nums">
                          <div className="font-semibold text-emerald-950">{s.ticketNumber}</div>
                          <div className="font-sans text-[11px] text-stone-500">
                            {s.documentType}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-stone-700 tabular-nums">
                            {formatDateTime(s.timestamp)}
                          </div>
                          <div className="text-[11px] text-stone-500">
                            {sh ? sh.registerName : 'Turno cerrado'} · {s.cashier}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {s.customer?.name || s.customer?.taxId ? (
                            <div>
                              <div className="font-medium text-stone-900">
                                {s.customer.name || 'Cliente sin razón social'}
                              </div>
                              {s.customer.taxId && (
                                <div className="font-mono text-[11px] text-stone-500 tabular-nums">
                                  RUC {s.customer.taxId}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-stone-400">Consumidor Final</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSaleId(isExpanded ? null : s.id)
                            }
                            className="inline-flex items-center gap-1 font-medium text-stone-700 hover:text-orange-700"
                          >
                            <span className="font-mono tabular-nums">
                              {s.items.length} líne{s.items.length === 1 ? 'a' : 'as'} (
                              {Math.round(itemUnitsCount * 100) / 100})
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5 text-orange-500" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 capitalize text-stone-700">
                          <div>{s.payment.method}</div>
                          {s.payment.reference && (
                            <div className="font-mono text-[11px] text-stone-400">
                              Ref: {s.payment.reference}
                            </div>
                          )}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono font-semibold tabular-nums ${
                            s.status === 'anulada'
                              ? 'text-stone-400 line-through'
                              : 'text-emerald-950'
                          }`}
                        >
                          {formatCurrency(s.total, store.currencySymbol)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              s.status === 'anulada'
                                ? 'font-semibold text-red-600'
                                : 'font-semibold text-emerald-700'
                            }
                          >
                            {s.status === 'anulada' ? 'Anulada' : 'Emitida'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onViewReceipt(s)}
                            className="mr-1.5 inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-amber-50"
                            title="Ver o reimprimir comprobante"
                          >
                            <Printer className="h-4 w-4 text-orange-600" />
                            Ver / Imprimir
                          </button>
                          {s.status === 'completada' && canVoidSales && (
                            <button
                              type="button"
                              onClick={() => setSaleToVoid(s)}
                              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                              title="Anular comprobante y reintegrar stock"
                            >
                              <Ban className="h-4 w-4" />
                              Anular
                            </button>
                          )}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-amber-50/45">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                              <div className="lg:col-span-8">
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-orange-700">
                                  Detalle de productos ({s.ticketNumber})
                                </p>
                                <div className="overflow-hidden rounded-lg border border-amber-200/80 bg-white">
                                  <table className="w-full text-left text-xs">
                                    <thead className="border-b border-amber-200/70 bg-amber-50/50 text-[11px] text-stone-600">
                                      <tr>
                                        <th className="px-3 py-2 font-medium">Producto</th>
                                        <th className="px-3 py-2 font-medium text-right">Cant.</th>
                                        <th className="px-3 py-2 font-medium text-right">Precio Unit.</th>
                                        <th className="px-3 py-2 font-medium text-right">Dto.</th>
                                        <th className="px-3 py-2 font-medium text-right">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-amber-100/70">
                                      {s.items.map((item, idx) => (
                                        <tr key={`${item.productId}-${idx}`}>
                                          <td className="px-3 py-2">
                                            <div className="font-medium text-stone-900">
                                              {item.name}
                                            </div>
                                            <div className="font-mono text-[10px] text-stone-400">
                                              {item.barcode}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono tabular-nums text-stone-700">
                                            {formatQuantity(item.quantity, item.unit)}
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono tabular-nums text-stone-700">
                                            {formatCurrency(item.unitPrice, store.currencySymbol)}
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono tabular-nums text-stone-500">
                                            {item.discountPct > 0 ? `${item.discountPct}%` : '-'}
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-emerald-950">
                                            {formatCurrency(item.lineTotal, store.currencySymbol)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              <div className="space-y-2 rounded-lg border border-amber-200/80 bg-white p-3.5 text-xs lg:col-span-4">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-700">
                                  Resumen de cobro
                                </p>
                                <div className="space-y-1 font-mono tabular-nums">
                                  <div className="flex justify-between text-stone-600">
                                    <span>Subtotal bruto</span>
                                    <span>{formatCurrency(s.subtotal, store.currencySymbol)}</span>
                                  </div>
                                  {s.discountTotal > 0 && (
                                    <div className="flex justify-between text-emerald-700">
                                      <span>Descuentos</span>
                                      <span>
                                        -{formatCurrency(s.discountTotal, store.currencySymbol)}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex justify-between text-stone-500">
                                    <span>IVA incluido</span>
                                    <span>{formatCurrency(s.taxTotal, store.currencySymbol)}</span>
                                  </div>
                                  <div className="flex justify-between border-t border-amber-200/70 pt-1.5 font-bold text-emerald-950">
                                    <span>Total</span>
                                    <span>{formatCurrency(s.total, store.currencySymbol)}</span>
                                  </div>
                                </div>

                                <div className="border-t border-amber-100 pt-2 text-[11px] text-stone-600 space-y-0.5 font-mono tabular-nums">
                                  {s.payment.cashAmount > 0 && (
                                    <div className="flex justify-between">
                                      <span>Efectivo</span>
                                      <span>
                                        {formatCurrency(s.payment.cashAmount, store.currencySymbol)}
                                      </span>
                                    </div>
                                  )}
                                  {s.payment.cardAmount > 0 && (
                                    <div className="flex justify-between">
                                      <span>Tarjeta</span>
                                      <span>
                                        {formatCurrency(s.payment.cardAmount, store.currencySymbol)}
                                      </span>
                                    </div>
                                  )}
                                  {s.payment.transferAmount > 0 && (
                                    <div className="flex justify-between">
                                      <span>Transferencia</span>
                                      <span>
                                        {formatCurrency(
                                          s.payment.transferAmount,
                                          store.currencySymbol
                                        )}
                                      </span>
                                    </div>
                                  )}
                                  {s.payment.changeGiven > 0 && (
                                    <div className="flex justify-between text-stone-500">
                                      <span>Vuelto entregado</span>
                                      <span>
                                        {formatCurrency(s.payment.changeGiven, store.currencySymbol)}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {s.customer?.address && (
                                  <div className="border-t border-amber-100 pt-2 text-[11px] text-stone-500">
                                    Dirección: {s.customer.address}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

              {saleToVoid.customer?.taxId && (
                <p className="text-stone-500">
                  Cliente: {saleToVoid.customer.name || 'Sin nombre'} · RUC{' '}
                  <span className="font-mono">{saleToVoid.customer.taxId}</span>
                </p>
              )}

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

              <p className="text-[11px] text-stone-500">
                El ticket permanecerá guardado como <span className="font-semibold text-red-600">Anulada</span> para auditoría y control de caja.
              </p>
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
                onClick={handleConfirmVoid}
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
