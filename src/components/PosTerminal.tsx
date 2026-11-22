import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Barcode,
  Banknote,
  CreditCard,
  Minus,
  Plus,
  QrCode,
  Scale,
  Search,
  Split,
  Trash2,
  X,
} from 'lucide-react';
import {
  CartItem,
  CustomerInfo,
  DocumentType,
  PaymentBreakdown,
  PaymentMethod,
  Product,
  ProductCategory,
  Shift,
  StoreSettings,
} from '../types/pos';
import {
  formatCurrency,
  formatQuantity,
  getExpiryStatus,
  getStockStatus,
} from '../utils/format';

interface PosTerminalProps {
  products: Product[];
  categories: string[];
  cart: CartItem[];
  activeShift: Shift | null;
  store: StoreSettings;
  scaleWeight: number;
  scaleConnected: boolean;
  canApplyDiscounts?: boolean;
  readOnly?: boolean;
  onSetScaleWeight: (kg: number) => void;
  onAddProduct: (product: Product, quantity: number) => void;
  onUpdateQuantity: (productId: string, newQty: number) => void;
  onUpdateDiscount: (productId: string, discountPct: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onBarcodeSubmit: (code: string) => void;
  onCompleteSale: (payload: {
    documentType: DocumentType;
    customer?: CustomerInfo;
    payment: PaymentBreakdown;
  }) => Promise<void>;
  onRequestOpenShift: () => void;
}

export const PosTerminal: React.FC<PosTerminalProps> = ({
  products,
  categories,
  cart,
  activeShift,
  store,
  scaleWeight,
  scaleConnected,
  canApplyDiscounts = true,
  readOnly = false,
  onSetScaleWeight,
  onAddProduct,
  onUpdateQuantity,
  onUpdateDiscount,
  onRemoveItem,
  onClearCart,
  onBarcodeSubmit,
  onCompleteSale,
  onRequestOpenShift,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Todos' | ProductCategory>('Todos');
  const [documentType, setDocumentType] = useState<DocumentType>('Ticket');
  const [customerName, setCustomerName] = useState('');
  const [customerTaxId, setCustomerTaxId] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [weighingProduct, setWeighingProduct] = useState<Product | null>(null);
  const [manualKgInput, setManualKgInput] = useState('0.500');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Payment modal state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [cashTenderedStr, setCashTenderedStr] = useState('');
  const [cardAmountStr, setCardAmountStr] = useState('');
  const [transferAmountStr, setTransferAmountStr] = useState('');
  const [paymentRef, setPaymentRef] = useState('');

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const filterCategories = useMemo<('Todos' | ProductCategory)[]>(
    () => ['Todos', ...categories],
    [categories]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery, selectedCategory]);

  const totals = useMemo(() => {
    let grossSubtotal = 0;
    let discountTotal = 0;
    let netTotal = 0;
    let taxTotal = 0;

    for (const item of cart) {
      const raw = item.unitPrice * item.quantity;
      const discount = raw * (item.discountPct / 100);
      const lineNet = raw - discount;
      const includedTax = lineNet - lineNet / (1 + item.taxRate / 100);
      grossSubtotal += raw;
      discountTotal += discount;
      netTotal += lineNet;
      taxTotal += includedTax;
    }

    return {
      subtotal: Number(grossSubtotal.toFixed(2)),
      discountTotal: Number(discountTotal.toFixed(2)),
      taxTotal: Number(taxTotal.toFixed(2)),
      total: Number(netTotal.toFixed(2)),
    };
  }, [cart]);

  // Global keyboard shortcuts: F2 focuses barcode input, F9 opens checkout
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0 && activeShift) {
          openCheckoutModal();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      const trimmed = searchQuery.trim();
      const exactMatch = products.find(
        (p) => p.barcode === trimmed || p.sku.toLowerCase() === trimmed.toLowerCase()
      );
      if (exactMatch) {
        handleProductTileClick(exactMatch);
        setSearchQuery('');
      } else {
        onBarcodeSubmit(trimmed);
        setSearchQuery('');
      }
    }
  };

  const handleProductTileClick = (product: Product) => {
    if (product.stock <= 0) return;
    if (product.unit === 'kg') {
      if (scaleWeight > 0) {
        onAddProduct(product, scaleWeight);
      } else {
        setManualKgInput('0.500');
        setWeighingProduct(product);
      }
    } else {
      onAddProduct(product, 1);
    }
  };

  const isGuarani =
    store.currencySymbol.toLowerCase().includes('gs') ||
    store.currencySymbol.toUpperCase() === 'PYG';

  const openCheckoutModal = () => {
    if (readOnly) return;
    if (!activeShift) {
      onRequestOpenShift();
      return;
    }
    if (cart.length === 0) return;
    setPaymentMethod('efectivo');
    setCashTenderedStr(
      isGuarani ? String(Math.round(totals.total)) : totals.total.toFixed(2)
    );
    setCardAmountStr('0');
    setTransferAmountStr('0');
    setPaymentRef('');
    setCheckoutError(null);
    setCheckoutOpen(true);
  };

  const parsedCash = parseFloat(cashTenderedStr.replace(',', '.')) || 0;
  const parsedCard = parseFloat(cardAmountStr.replace(',', '.')) || 0;
  const parsedTransfer = parseFloat(transferAmountStr.replace(',', '.')) || 0;

  const checkoutValidation = useMemo(() => {
    const total = totals.total;
    if (paymentMethod === 'efectivo') {
      const change = Math.max(0, Number((parsedCash - total).toFixed(2)));
      return {
        valid: parsedCash >= total - 0.01,
        change,
        cashApplied: total,
        cardApplied: 0,
        transferApplied: 0,
        cashTendered: parsedCash,
      };
    }
    if (paymentMethod === 'tarjeta') {
      return {
        valid: true,
        change: 0,
        cashApplied: 0,
        cardApplied: total,
        transferApplied: 0,
        cashTendered: 0,
      };
    }
    if (paymentMethod === 'transferencia') {
      return {
        valid: true,
        change: 0,
        cashApplied: 0,
        cardApplied: 0,
        transferApplied: total,
        cashTendered: 0,
      };
    }
    // mixto
    const sum = parsedCash + parsedCard + parsedTransfer;
    const nonCash = parsedCard + parsedTransfer;
    const cashNeeded = Math.max(0, Number((total - nonCash).toFixed(2)));
    const change = parsedCash > cashNeeded ? Number((parsedCash - cashNeeded).toFixed(2)) : 0;
    return {
      valid: sum >= total - 0.01 && nonCash <= total + 0.01,
      change,
      cashApplied: cashNeeded,
      cardApplied: parsedCard,
      transferApplied: parsedTransfer,
      cashTendered: parsedCash,
    };
  }, [paymentMethod, parsedCash, parsedCard, parsedTransfer, totals.total]);

  const handleConfirmPayment = async () => {
    if (readOnly || !checkoutValidation.valid || isSubmitting) return;
    setCheckoutError(null);
    setIsSubmitting(true);

    const trimmedRef = paymentRef.trim();
    const paymentPayload: PaymentBreakdown = {
      method: paymentMethod,
      cashAmount: checkoutValidation.cashApplied,
      cardAmount: checkoutValidation.cardApplied,
      transferAmount: checkoutValidation.transferApplied,
      cashTendered: checkoutValidation.cashTendered,
      changeGiven: checkoutValidation.change,
    };
    if (trimmedRef) {
      paymentPayload.reference = trimmedRef;
    }

    try {
      const hasCustomerInput =
        documentType !== 'Ticket' ||
        Boolean(customerName.trim()) ||
        Boolean(customerTaxId.trim()) ||
        Boolean(customerAddress.trim());

      await onCompleteSale({
        documentType,
        customer: hasCustomerInput
          ? {
              name: customerName.trim() || 'Consumidor Final',
              taxId: customerTaxId.trim(),
              ...(customerAddress.trim() ? { address: customerAddress.trim() } : {}),
            }
          : undefined,
        payment: paymentPayload,
      });
      setCheckoutOpen(false);
      setDocumentType('Ticket');
      setCustomerName('');
      setCustomerTaxId('');
      setCustomerAddress('');
    } catch {
      setCheckoutError('No se pudo registrar el cobro. Verificá tu conexión y permisos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Left Column: Scanner, Scale, Categories & Scrollable Product Catalog */}
      <div className="flex flex-col gap-4 lg:col-span-7 lg:h-full lg:min-h-0 xl:col-span-8">
        {readOnly && (
          <div className="shrink-0 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-950">
            Modo Demo · Solo lectura: podés explorar los productos y simular un ticket, sin registrar ventas ni descontar stock.
          </div>
        )}
        {!activeShift && !readOnly && (
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span>La caja se encuentra cerrada. Abrí un turno para registrar ventas.</span>
            <button
              type="button"
              onClick={onRequestOpenShift}
              className="whitespace-nowrap shrink-0 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            >
              Abrir Turno
            </button>
          </div>
        )}

        {/* Barcode Search + Electronic Scale Strip */}
        <div className="shrink-0 grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="relative xl:col-span-7">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700/70" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Escanear código de barras, SKU o buscar producto (F2)..."
              className="w-full rounded-xl border border-amber-200/90 bg-white py-2.5 pl-10 pr-24 text-sm text-stone-900 placeholder:text-stone-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-xs font-mono font-medium text-orange-600">
              <Barcode className="h-3.5 w-3.5" />
              HID
            </span>
          </div>

          {/* Electronic Scale Live Readout */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-900 bg-emerald-950 px-3.5 py-2 text-white xl:col-span-5">
            <div className="flex items-center gap-2.5">
              <Scale className="h-4 w-4 text-amber-300 shrink-0" />
              <div>
                <p className="text-[11px] text-emerald-200/80 leading-tight">
                  Balanza {scaleConnected ? 'USB conectada' : 'Simulada'}
                </p>
                <p className="font-mono text-base font-bold tracking-tight text-amber-300 tabular-nums">
                  {scaleWeight.toFixed(3)} kg
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {[0, 0.25, 0.5, 1.0].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onSetScaleWeight(preset)}
                  className={`whitespace-nowrap shrink-0 rounded-md px-2.5 py-1.5 font-mono text-xs font-semibold transition-colors ${
                    Math.abs(scaleWeight - preset) < 0.001
                      ? 'bg-orange-500 text-white'
                      : 'bg-emerald-900 text-emerald-100 hover:bg-emerald-800'
                  }`}
                >
                  {preset === 0 ? 'Tara' : `${preset}k`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Category Segmented Buttons */}
        <div className="shrink-0 flex items-center gap-2 overflow-x-auto pb-1">
          {filterCategories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'border border-amber-200/80 bg-white text-stone-700 hover:border-orange-300 hover:bg-amber-50/70 hover:text-orange-800'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Scrollable Product Grid */}
        <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-amber-300 bg-white p-10 text-center">
              {products.length === 0 ? (
                <>
                  <p className="font-display text-sm font-semibold text-emerald-950">
                    Aún no hay productos cargados en este local
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    Cargá artículos desde la pestaña Inventario para habilitar el cobro rápido.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display text-sm font-semibold text-emerald-950">
                    No se encontraron productos
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    Probá otro término, limpiá el filtro de categoría o escaneá otro código.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('Todos');
                    }}
                    className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-amber-100"
                  >
                    Ver todo el catálogo
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-2 sm:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => {
              const stockState = getStockStatus(product);
              const expState = getExpiryStatus(product.expiryDate);
              const disabled = product.stock <= 0;

              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleProductTileClick(product)}
                  className={`group flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all duration-150 ${
                    disabled
                      ? 'cursor-not-allowed border-stone-200 bg-stone-100 opacity-60'
                      : 'border-amber-200/80 bg-white hover:border-orange-500 hover:bg-amber-50/30 hover:shadow-sm active:scale-[0.99]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-stone-500">
                      <span className="truncate font-medium text-emerald-800/80">{product.category}</span>
                      <span className="font-mono shrink-0">{product.sku}</span>
                    </div>
                    <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-stone-900 group-hover:text-emerald-800">
                      {product.name}
                    </h3>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-amber-100">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-base font-bold text-emerald-950 tabular-nums">
                        {formatCurrency(product.salePrice, store.currencySymbol)}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        {product.unit === 'kg' ? 'por kg' : 'c/u'}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-1 text-[11px] tabular-nums">
                      <span
                        className={
                          stockState === 'out'
                            ? 'font-medium text-red-600'
                            : stockState === 'low'
                              ? 'font-medium text-orange-600'
                              : 'text-stone-500'
                        }
                      >
                        {stockState === 'out'
                          ? 'Agotado'
                          : `Stock: ${product.unit === 'kg' ? product.stock.toFixed(1) : product.stock}`}
                      </span>
                      {expState === 'expired' && (
                        <span className="font-medium text-red-600">Vencido</span>
                      )}
                      {expState === 'soon' && (
                        <span className="font-medium text-orange-600">Próx. vencer</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Static Visible Active Ticket / Cashbox */}
      <div className="flex flex-col rounded-xl border border-amber-200/90 bg-white lg:col-span-5 lg:h-full lg:min-h-0 xl:col-span-4">
        <div className="shrink-0 flex items-center justify-between border-b border-amber-200/70 bg-amber-50/45 px-4 py-3 rounded-t-xl">
          <div>
            <h2 className="font-display text-sm font-semibold text-emerald-950">
              Ticket en curso
            </h2>
            <p className="text-xs text-stone-500 tabular-nums">
              {cart.length} {cart.length === 1 ? 'ítem' : 'ítems'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Tipo de comprobante"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              className="rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-800 focus:border-orange-500 focus:outline-none"
            >
              <option value="Ticket">Ticket Final</option>
              <option value="Factura B">Factura B</option>
              <option value="Factura A">Factura A</option>
            </select>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={onClearCart}
                className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Vaciar ticket"
                aria-label="Vaciar ticket"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {documentType !== 'Ticket' && (
          <div className="shrink-0 border-b border-amber-200/70 bg-amber-50/55 px-4 py-3">
            <div className="rounded-lg border border-amber-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-orange-700">
                  Datos del cliente · Facturación
                </span>
                {(customerTaxId || customerName || customerAddress) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerTaxId('');
                      setCustomerName('');
                      setCustomerAddress('');
                    }}
                    className="rounded px-2 py-0.5 text-xs font-semibold text-stone-600 hover:bg-amber-50 hover:text-orange-700"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-medium text-stone-600">
                    Nro. de RUC
                  </label>
                  <input
                    type="text"
                    value={customerTaxId}
                    onChange={(e) => setCustomerTaxId(e.target.value)}
                    placeholder="Ej: 80012345-6"
                    className="mt-0.5 w-full rounded-lg border border-stone-200 bg-amber-50/30 px-2.5 py-1.5 font-mono text-xs text-stone-900 focus:border-orange-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-stone-600">
                    Razón social / Nombre
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nombre o empresa"
                    className="mt-0.5 w-full rounded-lg border border-stone-200 bg-amber-50/30 px-2.5 py-1.5 text-xs text-stone-900 focus:border-orange-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-600">
                  Dirección (opcional)
                </label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Av. / Calle y localidad"
                  className="mt-0.5 w-full rounded-lg border border-stone-200 bg-amber-50/30 px-2.5 py-1.5 text-xs text-stone-900 focus:border-orange-500 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Cart Items */}
        <div className="flex-1 min-h-[200px] overflow-y-auto divide-y divide-amber-100 px-4">
          {cart.length === 0 ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
              <Barcode className="h-8 w-8 text-amber-400" />
              <p className="mt-2 text-sm font-medium text-emerald-950">
                Esperando productos
              </p>
              <p className="mt-1 max-w-[230px] text-xs text-stone-500">
                Escaneá un código de barras con el lector o seleccioná artículos del panel.
              </p>
            </div>
          ) : (
            cart.map((item) => {
              const lineRaw = item.unitPrice * item.quantity;
              const lineTotal = lineRaw * (1 - item.discountPct / 100);
              return (
                <div key={item.productId} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-900">
                        {item.name}
                      </p>
                      <p className="text-xs text-stone-500 font-mono tabular-nums">
                        {formatCurrency(item.unitPrice, store.currencySymbol)}/{item.unit}
                        {item.discountPct > 0 && (
                          <span className="ml-2 text-orange-600 font-semibold">
                            · -{item.discountPct}% dto
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.productId)}
                      className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Quitar ${item.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {item.unit === 'u' ? (
                        <div className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50/50">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                            className="p-1.5 text-stone-600 hover:text-emerald-900"
                            aria-label="Restar unidad"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-[28px] text-center font-mono text-xs font-semibold tabular-nums text-stone-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                            className="p-1.5 text-stone-600 hover:text-emerald-900"
                            aria-label="Sumar unidad"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50/50 px-2 py-1">
                          <input
                            type="number"
                            step="0.05"
                            min="0.01"
                            value={item.quantity}
                            onChange={(e) =>
                              onUpdateQuantity(
                                item.productId,
                                Math.max(0.01, parseFloat(e.target.value) || 0.01)
                              )
                            }
                            className="w-16 bg-transparent font-mono text-xs font-semibold text-stone-900 tabular-nums focus:outline-none"
                          />
                          <span className="text-[11px] text-stone-500">kg</span>
                        </div>
                      )}

                      {canApplyDiscounts && (
                        <select
                          aria-label="Descuento"
                          value={item.discountPct}
                          onChange={(e) =>
                            onUpdateDiscount(item.productId, Number(e.target.value))
                          }
                          className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-[11px] text-stone-700 focus:border-orange-500 focus:outline-none"
                        >
                          <option value={0}>0% dto</option>
                          <option value={5}>-5%</option>
                          <option value={10}>-10%</option>
                          <option value={15}>-15%</option>
                          <option value={20}>-20%</option>
                        </select>
                      )}
                    </div>

                    <span className="font-mono text-sm font-semibold text-emerald-950 tabular-nums">
                      {formatCurrency(lineTotal, store.currencySymbol)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Footer Summary & Checkout Button */}
        <div className="shrink-0 border-t border-amber-200/80 bg-amber-50/50 p-4 rounded-b-xl">
          <div className="space-y-1.5 text-xs text-stone-600 tabular-nums">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrency(totals.subtotal, store.currencySymbol)}</span>
            </div>
            {totals.discountTotal > 0 && (
              <div className="flex justify-between text-orange-600 font-medium">
                <span>Descuentos aplicados</span>
                <span className="font-mono">
                  -{formatCurrency(totals.discountTotal, store.currencySymbol)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>IVA incluido</span>
              <span className="font-mono">{formatCurrency(totals.taxTotal, store.currencySymbol)}</span>
            </div>
            <div className="flex items-baseline justify-between border-t border-amber-200/80 pt-2.5 text-emerald-950">
              <span className="font-display text-sm font-semibold">Total a pagar</span>
              <span className="font-mono text-2xl font-bold tracking-tight">
                {formatCurrency(totals.total, store.currencySymbol)}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={cart.length === 0 || readOnly}
            onClick={openCheckoutModal}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-base font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600"
          >
            {readOnly
              ? 'Modo Demo · Solo lectura (cobro deshabilitado)'
              : `Cobrar ${cart.length > 0 ? formatCurrency(totals.total, store.currencySymbol) : ''} (F9)`}
          </button>
        </div>
      </div>

      {/* Weighing Modal for kg items when scaleWeight is 0 */}
      {weighingProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Pesar producto en balanza"
        >
          <div className="w-full max-w-sm rounded-xl border border-amber-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-base font-semibold text-emerald-950">
                  {weighingProduct.name}
                </h3>
                <p className="text-xs text-stone-500 font-mono tabular-nums">
                  {formatCurrency(weighingProduct.salePrice, store.currencySymbol)} / kg · Stock:{' '}
                  {weighingProduct.stock.toFixed(2)} kg
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWeighingProduct(null)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-amber-50 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-emerald-950 p-4 text-center">
              <p className="text-xs text-emerald-200">Peso detectado (kg)</p>
              <input
                type="number"
                step="0.005"
                min="0.010"
                value={manualKgInput}
                onChange={(e) => setManualKgInput(e.target.value)}
                className="mt-1 w-full bg-transparent text-center font-mono text-3xl font-bold text-amber-300 tabular-nums focus:outline-none"
              />
              <p className="mt-1 font-mono text-xs text-emerald-100 tabular-nums">
                Importe:{' '}
                {formatCurrency(
                  (parseFloat(manualKgInput) || 0) * weighingProduct.salePrice,
                  store.currencySymbol
                )}
              </p>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {[0.25, 0.5, 0.75, 1.0].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setManualKgInput(preset.toFixed(3))}
                  className="rounded-lg border border-amber-200 py-2 font-mono text-sm font-semibold text-stone-700 hover:bg-amber-50"
                >
                  {preset} kg
                </button>
              ))}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setWeighingProduct(null)}
                className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const kg = Math.max(0.01, parseFloat(manualKgInput) || 0);
                  onSetScaleWeight(kg);
                  onAddProduct(weighingProduct, kg);
                  setWeighingProduct(null);
                }}
                className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Agregar al ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {checkoutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Finalizar cobro"
        >
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-amber-200 bg-white shadow-xl">
            <div className="shrink-0 flex items-center justify-between border-b border-amber-100 bg-amber-50/40 px-5 py-4">
              <div>
                <h3 className="font-display text-base font-semibold text-emerald-950">
                  Cobrar {documentType}
                </h3>
                <p className="text-xs text-stone-600">
                  Total a cancelar:{' '}
                  <span className="font-mono font-semibold text-emerald-950 tabular-nums">
                    {formatCurrency(totals.total, store.currencySymbol)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-amber-100/70 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Document type selector & Customer RUC billing box */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-stone-700">Tipo de comprobante</span>
                  <div className="inline-flex rounded-lg border border-amber-200 bg-amber-50/60 p-0.5">
                    {(['Ticket', 'Factura B', 'Factura A'] as const).map((docOpt) => (
                      <button
                        key={docOpt}
                        type="button"
                        onClick={() => setDocumentType(docOpt)}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                          documentType === docOpt
                            ? 'bg-orange-500 text-white'
                            : 'text-stone-600 hover:text-emerald-950'
                        }`}
                      >
                        {docOpt === 'Ticket' ? 'Ticket Final' : docOpt}
                      </button>
                    ))}
                  </div>
                </div>

                {documentType !== 'Ticket' && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-orange-700">
                        Datos del cliente para facturación
                      </span>
                      {(customerTaxId || customerName || customerAddress) && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerTaxId('');
                            setCustomerName('');
                            setCustomerAddress('');
                          }}
                          className="rounded px-2 py-0.5 text-xs font-semibold text-stone-600 hover:bg-amber-100 hover:text-orange-700"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] font-medium text-stone-700">
                          Número de RUC
                        </label>
                        <input
                          type="text"
                          value={customerTaxId}
                          onChange={(e) => setCustomerTaxId(e.target.value)}
                          placeholder="Ej: 80012345-6"
                          className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-700">
                          Nombre o Razón social
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Consumidor Final / Empresa"
                          className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-stone-700">
                        Dirección (opcional)
                      </label>
                      <input
                        type="text"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="Dirección del cliente"
                        className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Payment method selector */}
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    { id: 'efectivo', label: 'Efectivo', icon: Banknote },
                    { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
                    { id: 'transferencia', label: 'QR / Transf.', icon: QrCode },
                    { id: 'mixto', label: 'Mixto', icon: Split },
                  ] as const
                ).map(({ id, label, icon: Icon }) => {
                  const active = paymentMethod === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPaymentMethod(id)}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2.5 py-3.5 text-sm font-semibold transition-colors ${
                        active
                          ? 'border-orange-500 bg-orange-50 text-orange-800'
                          : 'border-amber-200/80 bg-white text-stone-600 hover:bg-amber-50/60'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="whitespace-nowrap">{label}</span>
                    </button>
                  );
                })}
              </div>

              {paymentMethod === 'efectivo' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700">
                      Efectivo recibido del cliente
                    </label>
                    <input
                      type="number"
                      step={isGuarani ? '1' : '0.01'}
                      value={cashTenderedStr}
                      onChange={(e) => setCashTenderedStr(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 font-mono text-xl font-bold text-stone-900 tabular-nums focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCashTenderedStr(
                          isGuarani ? String(Math.round(totals.total)) : totals.total.toFixed(2)
                        )
                      }
                      className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 font-mono text-sm font-semibold text-amber-900 hover:bg-amber-100"
                    >
                      Exacto
                    </button>
                    {[5000, 10000, 20000, 50000, 100000].map((bill) => (
                      <button
                        key={bill}
                        type="button"
                        onClick={() => setCashTenderedStr(String(bill))}
                        className="rounded-lg border border-amber-200 bg-white px-3.5 py-2 font-mono text-sm font-medium text-stone-700 hover:bg-amber-50"
                      >
                        {formatCurrency(bill, store.currencySymbol)}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-emerald-950 px-4 py-3 text-white">
                    <span className="text-xs text-emerald-200">Vuelto a entregar</span>
                    <span className="font-mono text-xl font-bold text-amber-300 tabular-nums">
                      {formatCurrency(checkoutValidation.change, store.currencySymbol)}
                    </span>
                  </div>
                </div>
              )}

              {(paymentMethod === 'tarjeta' || paymentMethod === 'transferencia') && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700">
                      {paymentMethod === 'tarjeta'
                        ? 'Últimos 4 dígitos / Código de autorización (opcional)'
                        : 'Nro. de operación o referencia QR (opcional)'}
                    </label>
                    <input
                      type="text"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      placeholder={
                        paymentMethod === 'tarjeta' ? 'Ej: VISA DÉBITO · 4821' : 'Ej: QR #902184'
                      }
                      className="mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'mixto' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-stone-700">
                        Efectivo
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={cashTenderedStr}
                        onChange={(e) => setCashTenderedStr(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-2 font-mono text-sm text-stone-900 tabular-nums focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700">
                        Tarjeta
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={cardAmountStr}
                        onChange={(e) => setCardAmountStr(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-2 font-mono text-sm text-stone-900 tabular-nums focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700">
                        Transferencia
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={transferAmountStr}
                        onChange={(e) => setTransferAmountStr(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-2 font-mono text-sm text-stone-900 tabular-nums focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2 text-xs text-emerald-950 font-mono tabular-nums">
                    <span>
                      Cubierto:{' '}
                      {formatCurrency(parsedCash + parsedCard + parsedTransfer, store.currencySymbol)}
                    </span>
                    <span>
                      Vuelto: {formatCurrency(checkoutValidation.change, store.currencySymbol)}
                    </span>
                  </div>
                </div>
              )}

              {!checkoutValidation.valid && (
                <p className="text-xs font-medium text-red-600">
                  El monto ingresado no cubre el total de la venta.
                </p>
              )}
              {checkoutError && (
                <p className="text-xs font-medium text-red-600">{checkoutError}</p>
              )}
            </div>

            <div className="shrink-0 flex items-center justify-end gap-2.5 border-t border-amber-100 px-5 py-3.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setCheckoutOpen(false)}
                className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!checkoutValidation.valid || isSubmitting}
                onClick={handleConfirmPayment}
                className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                {isSubmitting
                  ? 'Procesando cobro...'
                  : `Confirmar Cobro y Emitir ${documentType}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
