import React, { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Calendar,
  Check,
  Copy,
  CreditCard,
  Edit3,
  MessageCircle,
  Phone,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import { AppPricingConfig } from '../types/pos';
import { formatCurrency } from '../utils/format';

interface PricingPanelProps {
  pricing: AppPricingConfig;
  canEditPricing?: boolean;
  isDemoMode?: boolean;
  onSavePricing: (next: AppPricingConfig) => Promise<void>;
}

export const PricingPanel: React.FC<PricingPanelProps> = ({
  pricing,
  canEditPricing = false,
  isDemoMode = false,
  onSavePricing,
}) => {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<AppPricingConfig>(pricing);

  useEffect(() => {
    setDraft(pricing);
  }, [pricing]);

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(pricing.paymentPhone);
      setCopiedPhone(true);
      window.setTimeout(() => setCopiedPhone(false), 1800);
    } catch {
      // Ignore clipboard restriction
    }
  };

  const whatsappDigits = pricing.paymentPhone.replace(/\D/g, '');
  const whatsappUrl = whatsappDigits ? `https://wa.me/${whatsappDigits}` : undefined;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditPricing) return;
    setSaving(true);
    try {
      await onSavePricing({
        paymentPhone: draft.paymentPhone.trim().slice(0, 60) || '+595-975635770',
        currencySymbol: draft.currencySymbol.trim().slice(0, 12) || 'Gs.',
        monthlyPrice: Math.max(0, Number(draft.monthlyPrice) || 0),
        monthlyNote: draft.monthlyNote.trim().slice(0, 160),
        semiannualPrice: Math.max(0, Number(draft.semiannualPrice) || 0),
        semiannualNote: draft.semiannualNote.trim().slice(0, 160),
        annualPrice: Math.max(0, Number(draft.annualPrice) || 0),
        annualNote: draft.annualNote.trim().slice(0, 160),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const plans = [
    {
      id: 'monthly',
      title: 'Pago Mensual',
      periodLabel: 'por mes',
      price: pricing.monthlyPrice,
      highlight: 'Flexible sin permanencia',
      note: pricing.monthlyNote,
      featured: false,
      icon: Calendar,
    },
    {
      id: 'semiannual',
      title: 'Pago Semestral',
      periodLabel: 'por 6 meses',
      price: pricing.semiannualPrice,
      highlight: '1 mes gratis',
      note: pricing.semiannualNote,
      featured: true,
      icon: Sparkles,
    },
    {
      id: 'annual',
      title: 'Pago Anual',
      periodLabel: 'por 12 meses',
      price: pricing.annualPrice,
      highlight: '2 meses gratis',
      note: pricing.annualNote,
      featured: false,
      icon: BadgeCheck,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Payment Contact Hero Card */}
      <div className="rounded-xl border border-amber-200/90 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-amber-300">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-emerald-950">
                Planes y Suscripción de la App
              </h2>
              <p className="mt-0.5 text-xs text-stone-600">
                Activá o renová tu licencia para tu minimercado con soporte técnico y respaldo en la nube.
              </p>
            </div>
          </div>

          {canEditPricing && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100"
            >
              <Edit3 className="h-4 w-4" />
              Modificar precios
            </button>
          )}
        </div>

        {/* Payment Number Highlight Strip */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-800 bg-emerald-950 p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-900 text-amber-300">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-emerald-200">Número oficial para pagos y comprobantes</p>
              <p className="font-mono text-xl font-bold tracking-tight text-amber-300 sm:text-2xl">
                {pricing.paymentPhone}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyPhone}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-emerald-700 bg-emerald-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              {copiedPhone ? (
                <>
                  <Check className="h-4 w-4 text-amber-300" />
                  Número copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-amber-300" />
                  Copiar número
                </>
              )}
            </button>

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600"
              >
                <MessageCircle className="h-4 w-4" />
                Enviar comprobante por WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Inline Editor for Super Admin */}
      {canEditPricing && editing && (
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-orange-300 bg-white p-5 shadow-sm space-y-4 text-xs"
        >
          <div className="flex items-center justify-between border-b border-amber-100 pb-3">
            <h3 className="font-display text-sm font-bold text-emerald-950">
              Editar tarifas y número para pagos
            </h3>
            <button
              type="button"
              onClick={() => {
                setDraft(pricing);
                setEditing(false);
              }}
              className="rounded-lg p-1 text-stone-400 hover:bg-amber-50 hover:text-stone-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-stone-700">Número para pagos *</label>
              <input
                type="text"
                required
                maxLength={60}
                value={draft.paymentPhone}
                onChange={(e) => setDraft({ ...draft, paymentPhone: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-stone-700">Moneda *</label>
              <input
                type="text"
                required
                maxLength={12}
                value={draft.currencySymbol}
                onChange={(e) => setDraft({ ...draft, currencySymbol: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-stone-700">Precio Mensual</label>
              <input
                type="number"
                min="0"
                step="1000"
                required
                value={draft.monthlyPrice}
                onChange={(e) =>
                  setDraft({ ...draft, monthlyPrice: Math.max(0, Number(e.target.value) || 0) })
                }
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-stone-700">Detalle plan mensual</label>
              <input
                type="text"
                maxLength={160}
                value={draft.monthlyNote}
                onChange={(e) => setDraft({ ...draft, monthlyNote: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-stone-700">Precio Semestral</label>
              <input
                type="number"
                min="0"
                step="1000"
                required
                value={draft.semiannualPrice}
                onChange={(e) =>
                  setDraft({ ...draft, semiannualPrice: Math.max(0, Number(e.target.value) || 0) })
                }
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-stone-700">Detalle plan semestral</label>
              <input
                type="text"
                maxLength={160}
                value={draft.semiannualNote}
                onChange={(e) => setDraft({ ...draft, semiannualNote: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-stone-700">Precio Anual</label>
              <input
                type="number"
                min="0"
                step="1000"
                required
                value={draft.annualPrice}
                onChange={(e) =>
                  setDraft({ ...draft, annualPrice: Math.max(0, Number(e.target.value) || 0) })
                }
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-stone-700">Detalle plan anual</label>
              <input
                type="text"
                maxLength={160}
                value={draft.annualNote}
                onChange={(e) => setDraft({ ...draft, annualNote: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-amber-100 pt-3">
            <button
              type="button"
              onClick={() => {
                setDraft(pricing);
                setEditing(false);
              }}
              className="rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-amber-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar tarifas'}
            </button>
          </div>
        </form>
      )}

      {/* 3 Plan Cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {plans.map((plan) => {
          const Icon = plan.icon;
          return (
            <div
              key={plan.id}
              className={`flex flex-col justify-between rounded-xl border bg-white p-6 ${
                plan.featured
                  ? 'border-orange-400 ring-2 ring-orange-500/20'
                  : 'border-amber-200/80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      plan.featured
                        ? 'bg-orange-500 text-white'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      plan.featured ? 'text-orange-600' : 'text-emerald-700'
                    }`}
                  >
                    {plan.highlight}
                  </span>
                </div>

                <h3 className="mt-4 font-display text-lg font-bold text-emerald-950">
                  {plan.title}
                </h3>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-mono text-3xl font-extrabold text-emerald-950 tabular-nums">
                    {formatCurrency(plan.price, pricing.currencySymbol)}
                  </span>
                  <span className="text-xs font-medium text-stone-500">{plan.periodLabel}</span>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-stone-600">
                  {plan.note || 'Incluye todas las funciones de punto de venta, inventario, caja y soporte.'}
                </p>
              </div>

              <div className="mt-6 border-t border-amber-100 pt-4 text-xs text-stone-600 space-y-1.5">
                <p>✓ Cobro rápido, ticket y factura</p>
                <p>✓ Control de stock, vencimientos y proveedores</p>
                <p>✓ Arqueo de caja y usuarios por sucursal</p>
              </div>
            </div>
          );
        })}
      </div>

      {!canEditPricing && (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-xs text-stone-600">
          {isDemoMode
            ? 'Estás viendo los planes vigentes en Modo Demo. Para contratar o activar tu local escribinos al '
            : 'Los precios de suscripción solo pueden ser modificados desde la cuenta del Administrador General. Para pagos o renovaciones comunicate al '}
          <span className="font-mono font-semibold text-emerald-950">{pricing.paymentPhone}</span>.
        </div>
      )}
    </div>
  );
};
