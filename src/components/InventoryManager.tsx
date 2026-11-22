import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowUpDown,
  Download,
  Edit3,
  History,
  PackagePlus,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  Product,
  ProductCategory,
  ProductUnit,
  StockMovement,
  StoreSettings,
} from '../types/pos';
import {
  downloadCsv,
  formatCurrency,
  formatDateTime,
  generateEan13,
  getDaysUntilExpiry,
  getExpiryStatus,
  getStockStatus,
} from '../utils/format';

interface InventoryManagerProps {
  products: Product[];
  categories: string[];
  stockMovements: StockMovement[];
  store: StoreSettings;
  canManageInventory?: boolean;
  onSaveProduct: (product: Product, isNew: boolean) => void;
  onDeleteProduct: (productId: string) => void;
  onAdjustStock: (payload: {
    productId: string;
    type: 'ingreso' | 'merma' | 'ajuste';
    quantityDelta: number;
    note: string;
    newExpiryDate?: string;
    newBatchCode?: string;
  }) => void;
  onSaveCategories: (nextCategories: string[]) => Promise<void> | void;
}

type InventoryFilter = 'all' | 'low_stock' | 'expiring' | 'weighed';

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  products,
  categories,
  stockMovements,
  store,
  canManageInventory = true,
  onSaveProduct,
  onDeleteProduct,
  onAdjustStock,
  onSaveCategories,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const [showMovements, setShowMovements] = useState(false);

  // Create / Edit modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [addingInlineCategory, setAddingInlineCategory] = useState(false);
  const [inlineCategoryName, setInlineCategoryName] = useState('');

  // Categories manager modal state
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Stock adjustment modal state
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjType, setAdjType] = useState<'ingreso' | 'merma' | 'ajuste'>('ingreso');
  const [adjQtyStr, setAdjQtyStr] = useState('10');
  const [adjNote, setAdjNote] = useState('');
  const [adjExpiry, setAdjExpiry] = useState('');
  const [adjBatch, setAdjBatch] = useState('');

  const metrics = useMemo(() => {
    let lowOrOutCount = 0;
    let expiringOrExpiredCount = 0;
    let totalCostValue = 0;
    let totalSaleValue = 0;

    for (const p of products) {
      const s = getStockStatus(p);
      if (s === 'low' || s === 'out') lowOrOutCount += 1;
      const e = getExpiryStatus(p.expiryDate);
      if (e === 'soon' || e === 'expired') expiringOrExpiredCount += 1;
      totalCostValue += Math.max(0, p.stock) * p.costPrice;
      totalSaleValue += Math.max(0, p.stock) * p.salePrice;
    }

    return {
      totalSkus: products.length,
      lowOrOutCount,
      expiringOrExpiredCount,
      totalCostValue,
      totalSaleValue,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (filter === 'low_stock') {
        const s = getStockStatus(p);
        if (s !== 'low' && s !== 'out') return false;
      } else if (filter === 'expiring') {
        const e = getExpiryStatus(p.expiryDate);
        if (e !== 'soon' && e !== 'expired') return false;
      } else if (filter === 'weighed') {
        if (p.unit !== 'kg') return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, filter, search]);

  const addCategoryItem = (rawName: string): string | null => {
    const clean = rawName.trim().slice(0, 40);
    if (!clean) return null;
    const existing = categories.find((c) => c.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;
    void onSaveCategories([...categories, clean]);
    return clean;
  };

  const openNewModal = () => {
    setIsNewProduct(true);
    setAddingInlineCategory(false);
    setInlineCategoryName('');
    setEditingProduct({
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      barcode: generateEan13(),
      sku: `ART-${String(products.length + 1).padStart(3, '0')}`,
      name: '',
      category: categories[0] || 'Almacén',
      unit: 'u',
      costPrice: 0,
      salePrice: 0,
      taxRate: 10,
      stock: 0,
      minStock: 5,
      expiryDate: '',
      batchCode: '',
    });
  };

  const openEditModal = (product: Product) => {
    setIsNewProduct(false);
    setAddingInlineCategory(false);
    setInlineCategoryName('');
    setEditingProduct({
      ...product,
      taxRate:
        product.taxRate === 0
          ? 0
          : product.taxRate === 5 || product.taxRate === 10.5
            ? 5
            : 10,
    });
  };

  const openAdjustModal = (product: Product) => {
    setAdjustingProduct(product);
    setAdjType('ingreso');
    setAdjQtyStr(product.unit === 'kg' ? '5.0' : '12');
    setAdjNote('Reposición de mercadería');
    setAdjExpiry(product.expiryDate || '');
    setAdjBatch(product.batchCode || '');
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.name.trim()) return;
    onSaveProduct(
      {
        ...editingProduct,
        name: editingProduct.name.trim(),
        barcode: editingProduct.barcode.trim() || generateEan13(),
        sku: editingProduct.sku.trim() || 'SKU-000',
        expiryDate: editingProduct.expiryDate || undefined,
        batchCode: editingProduct.batchCode?.trim() || undefined,
      },
      isNewProduct
    );
    setEditingProduct(null);
  };

  const handleConfirmAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    const rawQty = parseFloat(adjQtyStr.replace(',', '.')) || 0;
    if (rawQty === 0) return;

    const signedDelta =
      adjType === 'ingreso'
        ? Math.abs(rawQty)
        : adjType === 'merma'
          ? -Math.abs(rawQty)
          : rawQty - adjustingProduct.stock;

    onAdjustStock({
      productId: adjustingProduct.id,
      type: adjType,
      quantityDelta: Number(signedDelta.toFixed(3)),
      note: adjNote.trim() || (adjType === 'ingreso' ? 'Ingreso' : adjType === 'merma' ? 'Merma' : 'Ajuste'),
      newExpiryDate: adjExpiry || undefined,
      newBatchCode: adjBatch.trim() || undefined,
    });
    setAdjustingProduct(null);
  };

  const handleExportCsv = () => {
    downloadCsv(
      `inventario-minimarket-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'SKU',
        'Código de Barras',
        'Producto',
        'Categoría',
        'Unidad',
        'Costo',
        'Precio Venta',
        'Stock Actual',
        'Stock Mínimo',
        'Vencimiento',
        'Lote',
      ],
      filteredProducts.map((p) => [
        p.sku,
        p.barcode,
        p.name,
        p.category,
        p.unit,
        p.costPrice,
        p.salePrice,
        p.stock,
        p.minStock,
        p.expiryDate || '',
        p.batchCode || '',
      ])
    );
  };

  return (
    <div className="space-y-5">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-amber-200/80 bg-white p-4">
          <p className="text-xs text-stone-500">Artículos activos</p>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-950 tabular-nums">
            {metrics.totalSkus}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">Catálogo registrado</p>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-white p-4">
          <p className="text-xs text-stone-500">Alertas de reposición</p>
          <p
            className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
              metrics.lowOrOutCount > 0 ? 'text-orange-600' : 'text-emerald-950'
            }`}
          >
            {metrics.lowOrOutCount}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">Stock bajo o agotado</p>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-white p-4">
          <p className="text-xs text-stone-500">Control de vencimientos</p>
          <p
            className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
              metrics.expiringOrExpiredCount > 0 ? 'text-red-600' : 'text-emerald-950'
            }`}
          >
            {metrics.expiringOrExpiredCount}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">Vencidos o ≤ 15 días</p>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-white p-4">
          <p className="text-xs text-stone-500">Valorización stock (venta)</p>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {formatCurrency(metrics.totalSaleValue, store.currencySymbol)}
          </p>
          <p className="mt-0.5 text-xs text-stone-500 font-mono tabular-nums">
            Costo: {formatCurrency(metrics.totalCostValue, store.currencySymbol)}
          </p>
        </div>
      </div>

      {/* Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-white p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64 sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700/70" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, EAN o SKU..."
              className="w-full rounded-lg border border-stone-200 bg-amber-50/30 py-1.5 pl-9 pr-3 text-xs text-stone-900 focus:border-orange-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-amber-200/70 bg-amber-50/70 p-1">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'low_stock', label: `Reposición (${metrics.lowOrOutCount})` },
                { id: 'expiring', label: `Vencimientos (${metrics.expiringOrExpiredCount})` },
                { id: 'weighed', label: 'Por Peso (kg)' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`whitespace-nowrap shrink-0 rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  filter === tab.id
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-stone-600 hover:text-emerald-950'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMovements((v) => !v)}
            className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-amber-100/70"
          >
            <History className="h-4 w-4" />
            {showMovements ? 'Ver Catálogo' : 'Historial Stock'}
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-amber-50"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
          {canManageInventory && (
            <>
              <button
                type="button"
                onClick={() => {
                  setNewCategoryName('');
                  setCategoriesModalOpen(true);
                }}
                className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-amber-50"
              >
                <Tag className="h-4 w-4 text-orange-600" />
                Categorías
              </button>
              <button
                type="button"
                onClick={openNewModal}
                className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                Nuevo Producto
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content: Either Movements History or Products Table */}
      {showMovements ? (
        <div className="overflow-hidden rounded-xl border border-amber-200/80 bg-white">
          <div className="border-b border-amber-200/70 bg-amber-50/40 px-4 py-3">
            <h3 className="font-display text-sm font-semibold text-emerald-950">
              Últimos movimientos de inventario
            </h3>
          </div>
          {stockMovements.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No hay movimientos registrados todavía.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Fecha y hora</th>
                    <th className="px-4 py-2.5 font-medium">Producto</th>
                    <th className="px-4 py-2.5 font-medium">Tipo</th>
                    <th className="px-4 py-2.5 font-medium text-right">Variación</th>
                    <th className="px-4 py-2.5 font-medium text-right">Stock resultante</th>
                    <th className="px-4 py-2.5 font-medium">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockMovements.slice(0, 50).map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                        {formatDateTime(m.timestamp)}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {m.productName}
                      </td>
                      <td className="px-4 py-2.5 capitalize text-slate-700">{m.type}</td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono font-semibold tabular-nums ${
                          m.delta >= 0 ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {m.delta >= 0 ? `+${m.delta}` : m.delta}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-800 tabular-nums">
                        {m.resultingStock}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{m.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-amber-200/80 bg-white">
          {filteredProducts.length === 0 ? (
            <div className="p-10 text-center">
              {products.length === 0 ? (
                <>
                  <p className="text-sm font-semibold text-emerald-950">
                    Tu inventario está vacío
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    Este local administra su propio catálogo de forma independiente. Cargá tu primer producto para empezar.
                  </p>
                  {canManageInventory && (
                    <button
                      type="button"
                      onClick={openNewModal}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar primer producto
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-emerald-950">
                    No hay productos que coincidan con este filtro
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setFilter('all');
                    }}
                    className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-amber-100"
                  >
                    Restablecer filtros
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-amber-200/70 bg-amber-50/50 text-stone-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Código / SKU</th>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium text-right">Costo</th>
                    <th className="px-4 py-3 font-medium text-right">Precio Venta</th>
                    <th className="px-4 py-3 font-medium text-right">Margen</th>
                    <th className="px-4 py-3 font-medium text-right">Stock</th>
                    <th className="px-4 py-3 font-medium">Vencimiento</th>
                    <th className="px-4 py-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100/70">
                  {filteredProducts.map((p) => {
                    const stockState = getStockStatus(p);
                    const expState = getExpiryStatus(p.expiryDate);
                    const daysLeft = getDaysUntilExpiry(p.expiryDate);
                    const margin =
                      p.costPrice > 0
                        ? ((p.salePrice - p.costPrice) / p.costPrice) * 100
                        : 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-2.5 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                          <div className="font-medium text-slate-900">{p.barcode}</div>
                          <div className="text-[11px] text-slate-400">{p.sku}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {p.category} · IVA {p.taxRate}% ·{' '}
                            {p.unit === 'kg' ? 'Venta por peso' : 'Por unidad'}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-600 tabular-nums">
                          {formatCurrency(p.costPrice, store.currencySymbol)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(p.salePrice, store.currencySymbol)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-600 tabular-nums">
                          {margin.toFixed(0)}%
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                          <div
                            className={`font-semibold ${
                              stockState === 'out'
                                ? 'text-red-600'
                                : stockState === 'low'
                                  ? 'text-amber-700'
                                  : 'text-slate-900'
                            }`}
                          >
                            {p.unit === 'kg' ? `${p.stock.toFixed(2)} kg` : `${p.stock} u`}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {stockState === 'out'
                              ? 'Sin stock'
                              : stockState === 'low'
                                ? `Reponer (mín ${p.minStock})`
                                : `Mín ${p.minStock}`}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {p.expiryDate ? (
                            <div>
                              <span
                                className={`inline-flex items-center gap-1 font-mono tabular-nums ${
                                  expState === 'expired'
                                    ? 'font-semibold text-red-600'
                                    : expState === 'soon'
                                      ? 'font-semibold text-amber-700'
                                      : 'text-slate-600'
                                }`}
                              >
                                {(expState === 'expired' || expState === 'soon') && (
                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                )}
                                {p.expiryDate}
                              </span>
                              <div className="text-[11px] text-slate-500">
                                {expState === 'expired'
                                  ? `Vencido hace ${Math.abs(daysLeft || 0)}d`
                                  : expState === 'soon'
                                    ? `Vence en ${daysLeft}d`
                                    : p.batchCode || 'Vigente'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">No perecedero</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          {canManageInventory ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openAdjustModal(p)}
                                title="Ajustar / Reponer stock"
                                className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                              >
                                <ArrowUpDown className="h-3.5 w-3.5" />
                                Stock
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(p)}
                                title="Editar producto"
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteProduct(p.id)}
                                title="Eliminar producto"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-stone-400">Solo lectura</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Product Modal */}
      {editingProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label={isNewProduct ? 'Nuevo producto' : 'Editar producto'}
        >
          <form
            onSubmit={handleSaveForm}
            className="w-full max-w-lg rounded-xl border border-amber-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50/40 px-5 py-3.5">
              <h3 className="font-display text-base font-semibold text-emerald-950">
                {isNewProduct ? 'Alta de producto' : 'Editar producto'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-amber-100/70 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3.5 p-5 text-xs">
              <div className="col-span-2">
                <label className="block font-medium text-stone-700">Nombre del producto</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, name: e.target.value })
                  }
                  placeholder="Ej: Aceite Oliva Extra Virgen 500 ml"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700">Código de barras (EAN)</label>
                <div className="mt-1 flex gap-1">
                  <input
                    type="text"
                    required
                    value={editingProduct.barcode}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, barcode: e.target.value })
                    }
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEditingProduct({ ...editingProduct, barcode: generateEan13() })
                    }
                    className="whitespace-nowrap shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-amber-100"
                  >
                    Generar
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700">SKU interno</label>
                <input
                  type="text"
                  value={editingProduct.sku}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, sku: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <label className="block font-medium text-stone-700">Categoría</label>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingInlineCategory((v) => !v);
                      setInlineCategoryName('');
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600 hover:text-orange-700"
                  >
                    <Plus className="h-3 w-3" />
                    {addingInlineCategory ? 'Cancelar' : 'Nueva categoría'}
                  </button>
                </div>
                {addingInlineCategory ? (
                  <div className="mt-1 flex gap-1.5">
                    <input
                      type="text"
                      maxLength={40}
                      value={inlineCategoryName}
                      onChange={(e) => setInlineCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const added = addCategoryItem(inlineCategoryName);
                          if (added) {
                            setEditingProduct({ ...editingProduct, category: added });
                            setAddingInlineCategory(false);
                            setInlineCategoryName('');
                          }
                        }
                      }}
                      placeholder="Ej: Ferretería, Tienda, Electrónica"
                      className="flex-1 rounded-lg border border-orange-300 px-2.5 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const added = addCategoryItem(inlineCategoryName);
                        if (added) {
                          setEditingProduct({ ...editingProduct, category: added });
                          setAddingInlineCategory(false);
                          setInlineCategoryName('');
                        }
                      }}
                      className="whitespace-nowrap shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Agregar
                    </button>
                  </div>
                ) : (
                  <select
                    value={editingProduct.category}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        category: e.target.value as ProductCategory,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                  >
                    {Array.from(new Set([...categories, editingProduct.category].filter(Boolean))).map(
                      (c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      )
                    )}
                  </select>
                )}
              </div>

              <div>
                <label className="block font-medium text-stone-700">Unidad de venta</label>
                <select
                  value={editingProduct.unit}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      unit: e.target.value as ProductUnit,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                >
                  <option value="u">Unidad (código barras)</option>
                  <option value="kg">Kilogramo (balanza)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-stone-700">Precio de costo</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingProduct.costPrice}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      costPrice: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900 tabular-nums focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700">Precio de venta</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={editingProduct.salePrice}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      salePrice: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs font-semibold text-emerald-950 tabular-nums focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700">Stock actual</label>
                <input
                  type="number"
                  step={editingProduct.unit === 'kg' ? '0.01' : '1'}
                  value={editingProduct.stock}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      stock: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900 tabular-nums focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700">Stock mínimo (alerta)</label>
                <input
                  type="number"
                  step={editingProduct.unit === 'kg' ? '0.1' : '1'}
                  min="0"
                  value={editingProduct.minStock}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      minStock: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900 tabular-nums focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700">Fecha de vencimiento</label>
                <input
                  type="date"
                  value={editingProduct.expiryDate || ''}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, expiryDate: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700">Alícuota IVA (%)</label>
                <select
                  value={editingProduct.taxRate}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      taxRate: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                >
                  <option value={10}>10% (Tasa general)</option>
                  <option value={5}>5% (Tasa reducida · Canasta familiar)</option>
                  <option value={0}>0% (Exenta)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-amber-100 bg-amber-50/30 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="rounded-lg border border-amber-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-amber-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                {isNewProduct ? 'Guardar Producto' : 'Actualizar Producto'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stock Adjustment / Restock Modal */}
      {adjustingProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Ajustar stock"
        >
          <form
            onSubmit={handleConfirmAdjustment}
            className="w-full max-w-md rounded-xl border border-amber-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50/40 px-5 py-3.5">
              <div>
                <h3 className="font-display text-base font-semibold text-emerald-950">
                  Movimiento de stock
                </h3>
                <p className="text-xs text-stone-500 truncate max-w-[300px]">
                  {adjustingProduct.name} · Actual: {adjustingProduct.stock} {adjustingProduct.unit}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingProduct(null)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-amber-100/70 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 p-5 text-xs">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'ingreso', label: 'Ingreso (+)' },
                    { id: 'merma', label: 'Merma (-)' },
                    { id: 'ajuste', label: 'Fijar exacto' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAdjType(item.id)}
                    className={`rounded-lg border py-2.5 text-sm font-semibold transition-colors ${
                      adjType === item.id
                        ? 'border-orange-500 bg-orange-500 text-white'
                        : 'border-amber-200 bg-white text-stone-700 hover:bg-amber-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block font-medium text-stone-700">
                  {adjType === 'ajuste'
                    ? `Nuevo stock real (${adjustingProduct.unit})`
                    : `Cantidad (${adjustingProduct.unit})`}
                </label>
                <input
                  type="number"
                  step={adjustingProduct.unit === 'kg' ? '0.01' : '1'}
                  min="0"
                  required
                  value={adjQtyStr}
                  onChange={(e) => setAdjQtyStr(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm font-semibold text-emerald-950 tabular-nums focus:border-orange-500 focus:outline-none"
                />
              </div>

              {adjType === 'ingreso' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-stone-700">
                      Nuevo vencimiento
                    </label>
                    <input
                      type="date"
                      value={adjExpiry}
                      onChange={(e) => setAdjExpiry(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-1.5 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-stone-700">Lote</label>
                    <input
                      type="text"
                      value={adjBatch}
                      onChange={(e) => setAdjBatch(e.target.value)}
                      placeholder="L-2611"
                      className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-1.5 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-medium text-stone-700">Motivo / Nota</label>
                <input
                  type="text"
                  value={adjNote}
                  onChange={(e) => setAdjNote(e.target.value)}
                  placeholder="Ej: Factura proveedor #412 / Envase dañado"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-amber-100 bg-amber-50/30 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setAdjustingProduct(null)}
                className="rounded-lg border border-amber-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-amber-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <PackagePlus className="h-4 w-4" />
                Registrar Movimiento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Categories Management Modal */}
      {categoriesModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-amber-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50/40 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <Tag className="h-5 w-5 text-orange-600" />
                  <h3 className="font-display text-sm font-bold text-emerald-950">
                    Categorías de Productos
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCategoriesModalOpen(false)}
                  className="rounded-lg p-1 text-stone-400 hover:bg-amber-50 hover:text-stone-700"
                  aria-label="Cerrar categorías"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 p-5 text-xs">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const added = addCategoryItem(newCategoryName);
                    if (added) setNewCategoryName('');
                  }}
                  className="space-y-2"
                >
                  <label className="block font-medium text-stone-700">
                    Agregar nueva categoría
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={40}
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Ej: Ferretería, Tienda, Electrónica..."
                      className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!newCategoryName.trim()}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar
                    </button>
                  </div>
                </form>

                <div>
                  <p className="mb-2 text-[11px] font-medium text-stone-500">
                    Sugerencias rápidas
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {['Ferretería', 'Tienda', 'Electrónica', 'Bazar', 'Perfumería', 'Librería']
                      .filter((s) => !categories.some((c) => c.toLowerCase() === s.toLowerCase()))
                      .map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => addCategoryItem(suggestion)}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50/60 px-2.5 py-1 text-xs font-medium text-emerald-950 hover:bg-amber-100"
                        >
                          <Plus className="h-3 w-3 text-orange-600" />
                          {suggestion}
                        </button>
                      ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 font-medium text-stone-700">
                    Categorías activas ({categories.length})
                  </p>
                  <div className="max-h-60 divide-y divide-amber-100 overflow-y-auto rounded-xl border border-amber-200/80">
                    {categories.map((cat) => {
                      const count = products.filter((p) => p.category === cat).length;
                      return (
                        <div
                          key={cat}
                          className="flex items-center justify-between px-3.5 py-2.5"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate font-medium text-emerald-950">{cat}</span>
                            <span className="font-mono text-[11px] text-stone-500 tabular-nums">
                              ({count} prod.)
                            </span>
                          </div>
                          {categories.length > 1 && count === 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                onSaveCategories(categories.filter((c) => c !== cat))
                              }
                              title={`Quitar categoría ${cat}`}
                              className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-amber-100 bg-amber-50/30 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setCategoriesModalOpen(false)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
