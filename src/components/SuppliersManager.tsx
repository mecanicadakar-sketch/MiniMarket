import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  Edit3,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { Product, Supplier } from '../types/pos';

interface SuppliersManagerProps {
  suppliers: Supplier[];
  products: Product[];
  canManageSuppliers?: boolean;
  onSaveSupplier: (supplier: Supplier, isNew: boolean) => Promise<void> | void;
  onDeleteSupplier: (supplierId: string) => Promise<void> | void;
}

export const SuppliersManager: React.FC<SuppliersManagerProps> = ({
  suppliers,
  products,
  canManageSuppliers = true,
  onSaveSupplier,
  onDeleteSupplier,
}) => {
  const [search, setSearch] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isNewSupplier, setIsNewSupplier] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);

  const productCountBySupplier = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      if (p.supplierId) {
        map.set(p.supplierId, (map.get(p.supplierId) || 0) + 1);
      }
    }
    return map;
  }, [products]);

  const metrics = useMemo(() => {
    let linkedProducts = 0;
    const categories = new Set<string>();
    for (const p of products) {
      if (p.supplierId || p.supplierName) linkedProducts += 1;
    }
    for (const s of suppliers) {
      if (s.category?.trim()) categories.add(s.category.trim().toLowerCase());
    }
    return {
      totalSuppliers: suppliers.length,
      linkedProducts,
      categoriesCount: categories.size,
    };
  }, [suppliers, products]);

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.taxId || '').toLowerCase().includes(q) ||
        (s.contactName || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  const openCreateModal = () => {
    setIsNewSupplier(true);
    setEditingSupplier({
      id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: '',
      taxId: '',
      contactName: '',
      phone: '',
      email: '',
      address: '',
      category: '',
      notes: '',
    });
  };

  const openEditModal = (supplier: Supplier) => {
    setIsNewSupplier(false);
    setEditingSupplier({
      ...supplier,
      taxId: supplier.taxId || '',
      contactName: supplier.contactName || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      category: supplier.category || '',
      notes: supplier.notes || '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier || !editingSupplier.name.trim() || !canManageSuppliers) return;

    setSaving(true);
    try {
      await onSaveSupplier(
        {
          id: editingSupplier.id,
          name: editingSupplier.name.trim().slice(0, 120),
          taxId: editingSupplier.taxId?.trim().slice(0, 40) || undefined,
          contactName: editingSupplier.contactName?.trim().slice(0, 120) || undefined,
          phone: editingSupplier.phone?.trim().slice(0, 60) || undefined,
          email: editingSupplier.email?.trim().slice(0, 160) || undefined,
          address: editingSupplier.address?.trim().slice(0, 200) || undefined,
          category: editingSupplier.category?.trim().slice(0, 60) || undefined,
          notes: editingSupplier.notes?.trim().slice(0, 300) || undefined,
        },
        isNewSupplier
      );
      setEditingSupplier(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-amber-200/80 bg-white p-4">
          <p className="text-xs text-stone-500">Proveedores registrados</p>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-950 tabular-nums">
            {metrics.totalSuppliers}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">Directorio exclusivo del local</p>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-white p-4">
          <p className="text-xs text-stone-500">Productos con proveedor asignado</p>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {metrics.linkedProducts}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">
            De {products.length} artículos en inventario
          </p>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-white p-4">
          <p className="text-xs text-stone-500">Rubros de abastecimiento</p>
          <p className="mt-1 font-mono text-2xl font-bold text-orange-600 tabular-nums">
            {metrics.categoriesCount}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">Distribuidores y mayoristas</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-white p-3.5">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700/70" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proveedor por nombre, RUC, contacto o rubro..."
            className="w-full rounded-lg border border-stone-200 bg-amber-50/30 py-2 pl-9 pr-3 text-xs text-stone-900 focus:border-orange-500 focus:bg-white focus:outline-none"
          />
        </div>

        {canManageSuppliers ? (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Nuevo Proveedor
          </button>
        ) : (
          <span className="text-xs font-medium text-stone-500">
            Modo solo lectura
          </span>
        )}
      </div>

      {/* Suppliers Table */}
      <div className="overflow-hidden rounded-xl border border-amber-200/80 bg-white">
        {filteredSuppliers.length === 0 ? (
          <div className="p-10 text-center">
            <Building2 className="mx-auto h-9 w-9 text-amber-400" />
            {suppliers.length === 0 ? (
              <>
                <p className="mt-2 text-sm font-semibold text-emerald-950">
                  Todavía no cargaste proveedores para este local
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Registrá tus distribuidores y mayoristas para asociarlos al cargar productos en Inventario.
                </p>
                {canManageSuppliers && (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar primer proveedor
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="mt-2 text-sm font-medium text-emerald-950">
                  No se encontraron proveedores para &ldquo;{search}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-amber-100"
                >
                  Limpiar búsqueda
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-amber-200/70 bg-amber-50/50 text-stone-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Proveedor / RUC</th>
                  <th className="px-4 py-3 font-medium">Contacto y Teléfono</th>
                  <th className="px-4 py-3 font-medium">Rubro</th>
                  <th className="px-4 py-3 font-medium">Dirección y Notas</th>
                  <th className="px-4 py-3 font-medium text-right">Productos</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100/70">
                {filteredSuppliers.map((sup) => {
                  const linkedCount = productCountBySupplier.get(sup.id) || 0;
                  return (
                    <tr key={sup.id} className="hover:bg-amber-50/35">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-emerald-950">{sup.name}</div>
                        <div className="font-mono text-[11px] text-stone-500">
                          {sup.taxId ? `RUC: ${sup.taxId}` : 'Sin RUC cargado'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {sup.contactName && (
                          <div className="flex items-center gap-1.5 font-medium text-stone-800">
                            <User className="h-3.5 w-3.5 text-orange-500" />
                            <span>{sup.contactName}</span>
                          </div>
                        )}
                        {sup.phone && (
                          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-emerald-800">
                            <Phone className="h-3 w-3" />
                            <span>{sup.phone}</span>
                          </div>
                        )}
                        {sup.email && (
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-stone-500">
                            <Mail className="h-3 w-3" />
                            <span>{sup.email}</span>
                          </div>
                        )}
                        {!sup.contactName && !sup.phone && !sup.email && (
                          <span className="text-stone-400">Sin datos de contacto</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium text-stone-700">
                          {sup.category || 'General'}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {sup.address && (
                          <div className="flex items-start gap-1 text-stone-700">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                            <span>{sup.address}</span>
                          </div>
                        )}
                        {sup.notes && (
                          <p className="mt-0.5 text-[11px] text-stone-500">{sup.notes}</p>
                        )}
                        {!sup.address && !sup.notes && (
                          <span className="text-stone-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-950 tabular-nums">
                        {linkedCount}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {canManageSuppliers ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(sup)}
                              title="Editar proveedor"
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-amber-50"
                            >
                              <Edit3 className="h-3.5 w-3.5 text-orange-600" />
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => setSupplierToDelete(sup)}
                              title="Eliminar proveedor"
                              className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
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

      {/* Create / Edit Supplier Modal via Portal */}
      {editingSupplier &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-950/60 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label={isNewSupplier ? 'Nuevo proveedor' : 'Editar proveedor'}
          >
            <form
              onSubmit={handleSubmit}
              className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-amber-200 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50/40 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-orange-600" />
                  <h3 className="font-display text-base font-semibold text-emerald-950">
                    {isNewSupplier ? 'Alta de proveedor' : 'Editar proveedor'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingSupplier(null)}
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-amber-100/70 hover:text-stone-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto grid grid-cols-1 gap-3.5 p-5 text-xs sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block font-medium text-stone-700">
                    Nombre o Razón social *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={editingSupplier.name}
                    onChange={(e) =>
                      setEditingSupplier({ ...editingSupplier, name: e.target.value })
                    }
                    placeholder="Ej: Distribuidora Central S.A."
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-orange-500 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700">RUC / Documento</label>
                  <input
                    type="text"
                    maxLength={40}
                    value={editingSupplier.taxId || ''}
                    onChange={(e) =>
                      setEditingSupplier({ ...editingSupplier, taxId: e.target.value })
                    }
                    placeholder="Ej: 80019452-1"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700">Rubro principal</label>
                  <input
                    type="text"
                    maxLength={60}
                    value={editingSupplier.category || ''}
                    onChange={(e) =>
                      setEditingSupplier({ ...editingSupplier, category: e.target.value })
                    }
                    placeholder="Ej: Bebidas, Lácteos, Ferretería"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700">Persona de contacto</label>
                  <input
                    type="text"
                    maxLength={120}
                    value={editingSupplier.contactName || ''}
                    onChange={(e) =>
                      setEditingSupplier({ ...editingSupplier, contactName: e.target.value })
                    }
                    placeholder="Ej: Roberto Giménez"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    maxLength={60}
                    value={editingSupplier.phone || ''}
                    onChange={(e) =>
                      setEditingSupplier({ ...editingSupplier, phone: e.target.value })
                    }
                    placeholder="Ej: +595-981-442-110"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-medium text-stone-700">Correo electrónico</label>
                  <input
                    type="email"
                    maxLength={160}
                    value={editingSupplier.email || ''}
                    onChange={(e) =>
                      setEditingSupplier({ ...editingSupplier, email: e.target.value })
                    }
                    placeholder="pedidos@proveedor.com.py"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-medium text-stone-700">Dirección</label>
                  <input
                    type="text"
                    maxLength={200}
                    value={editingSupplier.address || ''}
                    onChange={(e) =>
                      setEditingSupplier({ ...editingSupplier, address: e.target.value })
                    }
                    placeholder="Dirección o depósito de retiro"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-medium text-stone-700">Notas / Días de entrega</label>
                  <input
                    type="text"
                    maxLength={300}
                    value={editingSupplier.notes || ''}
                    onChange={(e) =>
                      setEditingSupplier({ ...editingSupplier, notes: e.target.value })
                    }
                    placeholder="Ej: Reparto martes y viernes, pago contra entrega"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-amber-100 bg-amber-50/30 px-5 py-3.5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditingSupplier(null)}
                  className="rounded-lg border border-amber-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-amber-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : isNewSupplier ? 'Guardar Proveedor' : 'Actualizar Proveedor'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Delete Confirmation Modal via Portal */}
      {supplierToDelete &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-950/60 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar eliminación de proveedor"
          >
            <div className="w-full max-w-md rounded-xl border border-amber-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50/40 px-5 py-3.5">
                <h3 className="font-display text-sm font-semibold text-emerald-950">
                  Eliminar proveedor
                </h3>
                <button
                  type="button"
                  onClick={() => setSupplierToDelete(null)}
                  className="rounded-lg p-1 text-stone-400 hover:bg-amber-100/70 hover:text-stone-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5 text-xs text-stone-600 space-y-2">
                <p>
                  ¿Querés eliminar al proveedor{' '}
                  <strong className="text-emerald-950">{supplierToDelete.name}</strong> del directorio?
                </p>
                <p className="text-stone-500">
                  Los productos existentes conservarán su historial, pero dejarán de estar vinculados al catálogo activo de proveedores.
                </p>
              </div>
              <div className="flex justify-end gap-2.5 border-t border-amber-100 bg-amber-50/30 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setSupplierToDelete(null)}
                  className="rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-amber-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onDeleteSupplier(supplierToDelete.id);
                    setSupplierToDelete(null);
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Eliminar Proveedor
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
