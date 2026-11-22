import React, { useEffect, useState } from 'react';
import { ImagePlus, Mail, MapPin, Phone, RotateCcw, Save, Store, Trash2 } from 'lucide-react';
import { StoreSettings } from '../types/pos';
import { compressImageToDataUrl, fitTopBannerToDataUrl } from '../utils/image';

interface StoreProfileEditorProps {
  store: StoreSettings;
  readOnly?: boolean;
  onSaveStore: (next: StoreSettings) => Promise<void>;
}

export const StoreProfileEditor: React.FC<StoreProfileEditorProps> = ({
  store,
  readOnly = false,
  onSaveStore,
}) => {
  const [draft, setDraft] = useState<StoreSettings>(store);
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(store);
  }, [store]);

  const isDirty =
    draft.storeName !== store.storeName ||
    draft.legalName !== store.legalName ||
    draft.taxId !== store.taxId ||
    draft.address !== store.address ||
    draft.phone !== store.phone ||
    (draft.email || '') !== (store.email || '') ||
    draft.receiptFooter !== store.receiptFooter ||
    draft.currencySymbol !== store.currencySymbol ||
    (draft.logoUrl || '') !== (store.logoUrl || '') ||
    (draft.bannerUrl || '') !== (store.bannerUrl || '') ||
    (draft.topBannerUrl || '') !== (store.topBannerUrl || '');

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'logoUrl' | 'bannerUrl' | 'topBannerUrl'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageError(null);
    try {
      const dataUrl =
        target === 'topBannerUrl'
          ? await fitTopBannerToDataUrl(file, 240000)
          : await compressImageToDataUrl(
              file,
              target === 'logoUrl'
                ? { maxWidth: 640, maxHeight: 640, maxChars: 240000 }
                : { maxWidth: 960, maxHeight: 420, maxChars: 420000 }
            );
      setDraft((prev) => ({ ...prev, [target]: dataUrl }));
    } catch (err) {
      setImageError(
        err instanceof Error ? err.message : 'No se pudo procesar la imagen seleccionada.'
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setFormError(null);

    const storeName = draft.storeName.trim();
    if (!storeName) {
      setFormError('El nombre comercial es obligatorio.');
      return;
    }

    setSaving(true);
    try {
      const nextPayload: StoreSettings = {
        storeName: storeName.slice(0, 120),
        legalName: draft.legalName.trim().slice(0, 160),
        taxId: draft.taxId.trim().slice(0, 40),
        address: draft.address.trim().slice(0, 200),
        phone: draft.phone.trim().slice(0, 60),
        receiptFooter: draft.receiptFooter.trim().slice(0, 300),
        currencySymbol: (draft.currencySymbol.trim() || 'Gs.').slice(0, 12),
      };
      if (draft.email?.trim()) {
        nextPayload.email = draft.email.trim().slice(0, 160);
      }
      if (draft.logoUrl?.trim()) {
        nextPayload.logoUrl = draft.logoUrl.trim().slice(0, 250000);
      }
      if (draft.bannerUrl?.trim()) {
        nextPayload.bannerUrl = draft.bannerUrl.trim().slice(0, 450000);
      }
      if (draft.topBannerUrl?.trim()) {
        nextPayload.topBannerUrl = draft.topBannerUrl.trim().slice(0, 250000);
      }

      await onSaveStore(nextPayload);
    } catch {
      setFormError('No se pudieron guardar los cambios. Verificá tu conexión y permisos.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Live Storefront Visual Preview */}
      <div className="overflow-hidden rounded-xl border border-amber-200/80 bg-white">
        <div className="relative h-36 w-full bg-emerald-950 sm:h-44">
          <img
            src={
              draft.bannerUrl ||
              '/src/assets/images/minimarket_store_backdrop_1795272439135.jpg'
            }
            alt={`Portada de ${draft.storeName || 'Mini Market'}`}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover opacity-90"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-emerald-950/55 via-transparent to-transparent"
            aria-hidden="true"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-4 min-w-0">
            {draft.logoUrl ? (
              <img
                src={draft.logoUrl}
                alt={`Logo de ${draft.storeName || 'comercio'}`}
                referrerPolicy="no-referrer"
                className="h-24 w-auto max-w-[250px] shrink-0 object-contain sm:h-28"
              />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50/70">
                <Store className="h-10 w-10 text-orange-500" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="truncate font-display text-2xl font-extrabold text-emerald-950">
                {draft.storeName || 'Nombre del comercio'}
              </h2>
              <p className="truncate text-xs text-stone-600">
                {draft.legalName || 'Razón social'} · RUC:{' '}
                <span className="font-mono">{draft.taxId || '-'}</span>
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
                {draft.address && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-orange-500" />
                    {draft.address}
                  </span>
                )}
                {draft.phone && (
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Phone className="h-3.5 w-3.5 text-emerald-700" />
                    {draft.phone}
                  </span>
                )}
                {draft.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-amber-600" />
                    {draft.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {readOnly ? (
              <span className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900">
                Modo Demo · Solo lectura
              </span>
            ) : (
              <>
                {isDirty && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setDraft(store);
                      setImageError(null);
                      setFormError(null);
                    }}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-amber-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-amber-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Descartar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Guardando...' : 'Guardar datos del comercio'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {(imageError || formError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
          {formError || imageError}
        </div>
      )}

      {/* Store Images Section */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-amber-200/80 bg-white p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-semibold text-emerald-950">
                Logo del comercio
              </h3>
              <p className="text-xs text-stone-500">
                Se muestra en el encabezado superior y en la cabecera de tickets y facturas impresas.
              </p>
            </div>
            {!readOnly && draft.logoUrl && (
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, logoUrl: '' }))}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Quitar
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            {draft.logoUrl ? (
              <img
                src={draft.logoUrl}
                alt="Vista previa logo"
                referrerPolicy="no-referrer"
                className="h-28 w-auto max-w-[260px] shrink-0 object-contain"
              />
            ) : (
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50/60">
                <Store className="h-10 w-10 text-amber-400" />
              </div>
            )}

            <div className="flex-1 space-y-2">
              {!readOnly && (
                <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100">
                  <ImagePlus className="h-4 w-4" />
                  Subir imagen desde archivo
                  <input
                    type="file"
                    accept="image/*"
                    disabled={readOnly}
                    onChange={(e) => handleImageUpload(e, 'logoUrl')}
                    className="hidden"
                  />
                </label>
              )}
              <div>
                <input
                  type="url"
                  disabled={readOnly}
                  value={draft.logoUrl?.startsWith('data:') ? '' : draft.logoUrl || ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, logoUrl: e.target.value }))}
                  placeholder="O pegá la URL de una imagen (https://...)"
                  className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-orange-500 focus:outline-none disabled:bg-stone-50 disabled:text-stone-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-white p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-semibold text-emerald-950">
                Imagen de fachada o portada
              </h3>
              <p className="text-xs text-stone-500">
                Fotografía del local o banner institucional para identificar tu sucursal.
              </p>
            </div>
            {!readOnly && draft.bannerUrl && (
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, bannerUrl: '' }))}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Quitar
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-amber-200 bg-amber-50/60">
              {draft.bannerUrl ? (
                <img
                  src={draft.bannerUrl}
                  alt="Vista previa fachada"
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImagePlus className="h-6 w-6 text-amber-400" />
              )}
            </div>

            <div className="flex-1 space-y-2">
              {!readOnly && (
                <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100">
                  <ImagePlus className="h-4 w-4" />
                  Subir foto del local
                  <input
                    type="file"
                    accept="image/*"
                    disabled={readOnly}
                    onChange={(e) => handleImageUpload(e, 'bannerUrl')}
                    className="hidden"
                  />
                </label>
              )}
              <div>
                <input
                  type="url"
                  disabled={readOnly}
                  value={draft.bannerUrl?.startsWith('data:') ? '' : draft.bannerUrl || ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, bannerUrl: e.target.value }))}
                  placeholder="O pegá la URL de una imagen (https://...)"
                  className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-orange-500 focus:outline-none disabled:bg-stone-50 disabled:text-stone-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Static Top Banner Uploader */}
        <div className="rounded-xl border border-amber-200/80 bg-white p-5 space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-semibold text-emerald-950">
                Banner superior estático
              </h3>
              <p className="text-xs text-stone-500">
                Se muestra fijo en el banner blanco superior de todas las pantallas del sistema sin
                recortar la imagen (espacio de hasta{' '}
                <span className="font-mono font-semibold text-emerald-900">820 × 160 px</span>).
              </p>
            </div>
            {!readOnly && draft.topBannerUrl && (
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, topBannerUrl: '' }))}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Quitar banner superior
              </button>
            )}
          </div>

          <div className="rounded-xl border border-amber-200 bg-white p-3">
            <div className="mx-auto flex h-[150px] w-full max-w-[820px] items-center justify-center overflow-hidden rounded-lg border border-dashed border-stone-300 bg-white sm:h-[160px]">
              {draft.topBannerUrl ? (
                <img
                  src={draft.topBannerUrl}
                  alt="Vista previa banner superior"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex items-center gap-2 px-4 text-center text-xs text-stone-500">
                  <ImagePlus className="h-4 w-4 shrink-0 text-orange-500" />
                  <span>Espacio para banner superior estático · hasta 820 × 160 px</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!readOnly && (
              <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-800 hover:bg-orange-100">
                <ImagePlus className="h-4 w-4" />
                Cargar imagen de banner
                <input
                  type="file"
                  accept="image/*"
                  disabled={readOnly}
                  onChange={(e) => handleImageUpload(e, 'topBannerUrl')}
                  className="hidden"
                />
              </label>
            )}
            <input
              type="url"
              disabled={readOnly}
              value={draft.topBannerUrl?.startsWith('data:') ? '' : draft.topBannerUrl || ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, topBannerUrl: e.target.value }))}
              placeholder="O pegá la URL de la imagen del banner (https://...)"
              className="min-w-[240px] flex-1 rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-orange-500 focus:outline-none disabled:bg-stone-50 disabled:text-stone-500"
            />
          </div>
        </div>
      </div>

      {/* Store General & Fiscal Info */}
      <fieldset disabled={readOnly} className="rounded-xl border border-amber-200/80 bg-white p-5 disabled:opacity-80">
        <h3 className="font-display text-sm font-semibold text-emerald-950">
          Información general, fiscal y de comprobantes
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block font-medium text-stone-700">Nombre comercial *</label>
            <input
              type="text"
              required
              maxLength={120}
              value={draft.storeName}
              onChange={(e) => setDraft({ ...draft, storeName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-medium text-stone-700">Razón social</label>
            <input
              type="text"
              maxLength={160}
              value={draft.legalName}
              onChange={(e) => setDraft({ ...draft, legalName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-medium text-stone-700">RUC del comercio</label>
            <input
              type="text"
              maxLength={40}
              value={draft.taxId}
              onChange={(e) => setDraft({ ...draft, taxId: e.target.value })}
              placeholder="Ej: 80045892-4"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-medium text-stone-700">Dirección</label>
            <input
              type="text"
              maxLength={200}
              value={draft.address}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-medium text-stone-700">Teléfono / WhatsApp</label>
            <input
              type="text"
              maxLength={60}
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-medium text-stone-700">Correo electrónico</label>
            <input
              type="email"
              maxLength={160}
              value={draft.email || ''}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              placeholder="contacto@minimarket.com"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-medium text-stone-700">Signo monetario</label>
            <input
              type="text"
              maxLength={12}
              value={draft.currencySymbol}
              onChange={(e) => setDraft({ ...draft, currencySymbol: e.target.value })}
              placeholder="Gs."
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-medium text-stone-700">Mensaje al pie del ticket</label>
            <input
              type="text"
              maxLength={300}
              value={draft.receiptFooter}
              onChange={(e) => setDraft({ ...draft, receiptFooter: e.target.value })}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>
      </fieldset>
    </form>
  );
};
