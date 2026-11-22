import React, { useState } from 'react';
import {
  Barcode,
  DollarSign,
  Printer,
  Scale,
  Usb,
  Volume2,
  X,
} from 'lucide-react';
import { HardwareConfig, ScanLogEntry, StoreSettings } from '../types/pos';
import { formatTimeOnly } from '../utils/format';
import { isWebSerialSupported, playScannerBeep } from '../utils/hardware';

interface HardwareCenterProps {
  config: HardwareConfig;
  store: StoreSettings;
  printerConnected: boolean;
  scaleConnected: boolean;
  scaleWeight: number;
  scanLogs: ScanLogEntry[];
  onUpdateConfig: (next: HardwareConfig) => void;
  onOpenStoreSettings: () => void;
  onConnectPrinter: () => Promise<void>;
  onDisconnectPrinter: () => Promise<void>;
  onConnectScale: () => Promise<void>;
  onDisconnectScale: () => Promise<void>;
  onSetScaleWeight: (kg: number) => void;
  onTestScan: (code: string) => void;
  onTestPrint: () => void;
  onTestDrawer: () => Promise<void>;
}

export const HardwareCenter: React.FC<HardwareCenterProps> = ({
  config,
  store,
  printerConnected,
  scaleConnected,
  scaleWeight,
  scanLogs,
  onUpdateConfig,
  onOpenStoreSettings,
  onConnectPrinter,
  onDisconnectPrinter,
  onConnectScale,
  onDisconnectScale,
  onSetScaleWeight,
  onTestScan,
  onTestPrint,
  onTestDrawer,
}) => {
  const [testBarcode, setTestBarcode] = useState('7790895000430');
  const serialSupported = isWebSerialSupported();

  return (
    <div className="space-y-6">
      {!serialSupported && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          Este navegador no expone la API Web Serial. Podés seguir usando el lector USB HID
          (modo teclado), la impresión térmica de 80mm por navegador y la balanza integrada, o
          abrir la app en Chrome/Edge para enlace serie directo ESC/POS y RS-232.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 1. Barcode Scanner */}
        <div className="rounded-xl border border-amber-200/80 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-orange-600">
                <Barcode className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Lector de Código de Barras (USB HID)
                </h3>
                <p className="text-xs text-slate-500">
                  {config.scannerEnabled
                    ? 'Escucha global activa · Modo teclado'
                    : 'Detección global pausada'}
                </p>
              </div>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={config.scannerEnabled}
                onChange={(e) =>
                  onUpdateConfig({ ...config, scannerEnabled: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
              />
              Activo
            </label>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700">Tecla de terminación</label>
              <select
                value={config.scannerSuffix}
                onChange={(e) =>
                  onUpdateConfig({
                    ...config,
                    scannerSuffix: e.target.value as 'Enter' | 'Tab',
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                <option value="Enter">Enter (CR/LF)</option>
                <option value="Tab">Tabulador (TAB)</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">
                Prefijo etiqueta balanza (EAN-13)
              </label>
              <input
                type="text"
                maxLength={2}
                value={config.scannerWeighedPrefix}
                onChange={(e) =>
                  onUpdateConfig({ ...config, scannerWeighedPrefix: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
            <label className="inline-flex cursor-pointer items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                checked={config.scannerBeep}
                onChange={(e) =>
                  onUpdateConfig({ ...config, scannerBeep: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-emerald-600"
              />
              Sonido de confirmación al escanear
            </label>
            <button
              type="button"
              onClick={playScannerBeep}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Volume2 className="h-4 w-4" />
              Probar pitido
            </button>
          </div>

          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={testBarcode}
              onChange={(e) => setTestBarcode(e.target.value)}
              placeholder="Código EAN de prueba"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => onTestScan(testBarcode)}
              className="whitespace-nowrap shrink-0 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Simular lectura
            </button>
          </div>

          {scanLogs.length > 0 && (
            <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
              <p className="text-[11px] font-medium text-slate-500">Últimas lecturas</p>
              <div className="mt-1.5 space-y-1 max-h-24 overflow-y-auto">
                {scanLogs.slice(0, 4).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between text-[11px] font-mono tabular-nums"
                  >
                    <span className="text-slate-800">{log.code}</span>
                    <span className="truncate max-w-[180px] text-slate-500">
                      {log.matchedProduct || 'Sin coincidencia'} · {formatTimeOnly(log.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2. Thermal Printer */}
        <div className="rounded-xl border border-amber-200/80 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Printer className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Impresora Térmica (ESC/POS · 80mm / 58mm)
                </h3>
                <p className="text-xs text-slate-500">
                  {printerConnected
                    ? 'Puerto serie conectado (ESC/POS directo)'
                    : 'Modo impresión térmica por navegador (80mm)'}
                </p>
              </div>
            </div>

            {printerConnected ? (
              <button
                type="button"
                onClick={onDisconnectPrinter}
                className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                <X className="h-4 w-4" />
                Desconectar
              </button>
            ) : (
              <button
                type="button"
                disabled={!serialSupported}
                onClick={onConnectPrinter}
                className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                <Usb className="h-4 w-4" />
                Conectar USB/Serial
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700">Modo de salida</label>
              <select
                value={config.printerMode}
                onChange={(e) =>
                  onUpdateConfig({
                    ...config,
                    printerMode: e.target.value as 'browser_80mm' | 'escpos_serial',
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                <option value="browser_80mm">Diálogo 80mm</option>
                <option value="escpos_serial">ESC/POS Directo</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Ancho papel</label>
              <select
                value={config.printerPaperWidth}
                onChange={(e) =>
                  onUpdateConfig({
                    ...config,
                    printerPaperWidth: e.target.value as '80mm' | '58mm',
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                <option value="80mm">80 mm (42 col)</option>
                <option value="58mm">58 mm (32 col)</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Baudios (Serial)</label>
              <select
                value={config.printerBaudRate}
                onChange={(e) =>
                  onUpdateConfig({ ...config, printerBaudRate: Number(e.target.value) })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                <option value={9600}>9600</option>
                <option value={38400}>38400</option>
                <option value={115200}>115200</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
            <label className="inline-flex cursor-pointer items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                checked={config.autoPrintOnSale}
                onChange={(e) =>
                  onUpdateConfig({ ...config, autoPrintOnSale: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-emerald-600"
              />
              Abrir ticket automáticamente al cobrar
            </label>
            <button
              type="button"
              onClick={onTestPrint}
              className="whitespace-nowrap shrink-0 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Imprimir Ticket de Prueba
            </button>
          </div>
        </div>

        {/* 3. Cash Drawer */}
        <div className="rounded-xl border border-amber-200/80 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Cajón de Dinero (RJ11 / Pulso ESC-POS)
                </h3>
                <p className="text-xs text-slate-500">
                  Señal ESC p 0 25 250 enviada a la impresora térmica conectada
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onTestDrawer}
              className="whitespace-nowrap shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Abrir Cajón Ahora
            </button>
          </div>

          <div className="mt-4 text-xs">
            <label className="block font-medium text-slate-700">
              Regla de apertura automática
            </label>
            <select
              value={config.drawerTrigger}
              onChange={(e) =>
                onUpdateConfig({
                  ...config,
                  drawerTrigger: e.target.value as 'cash_only' | 'all_sales' | 'manual',
                })
              }
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
            >
              <option value="cash_only">Solo en cobros con Efectivo o Mixto</option>
              <option value="all_sales">En todas las ventas completadas</option>
              <option value="manual">Apertura únicamente manual</option>
            </select>
          </div>
        </div>

        {/* 4. Electronic Scale */}
        <div className="rounded-xl border border-amber-200/80 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-sm font-semibold text-emerald-950">
                  Balanza Electrónica (RS-232 / USB-Serial)
                </h3>
                <p className="text-xs text-stone-500">
                  {scaleConnected
                    ? 'Lectura continua serie activa'
                    : 'Modo simulador local · Compatible Kretz / Systel / Toledo'}
                </p>
              </div>
            </div>

            {scaleConnected ? (
              <button
                type="button"
                onClick={onDisconnectScale}
                className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                <X className="h-4 w-4" />
                Desconectar
              </button>
            ) : (
              <button
                type="button"
                disabled={!serialSupported}
                onClick={onConnectScale}
                className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-amber-200 bg-white px-3.5 py-2 text-sm font-semibold text-stone-800 hover:bg-amber-50 disabled:opacity-50"
              >
                <Usb className="h-4 w-4" />
                Conectar Balanza
              </button>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-950 px-4 py-3 text-white">
            <div>
              <p className="text-[11px] text-emerald-200">Peso actual en visor</p>
              <p className="font-mono text-2xl font-bold text-amber-300 tabular-nums">
                {scaleWeight.toFixed(3)} kg
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[0, 0.35, 0.85, 1.5].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => onSetScaleWeight(w)}
                  className="rounded-md bg-emerald-900 px-3 py-1.5 font-mono text-sm font-semibold text-emerald-100 hover:bg-orange-500 hover:text-white"
                >
                  {w === 0 ? 'Cero' : `${w} kg`}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 text-xs">
            <label className="block font-medium text-stone-700">Velocidad puerto serie (bps)</label>
            <select
              value={config.scaleBaudRate}
              onChange={(e) =>
                onUpdateConfig({ ...config, scaleBaudRate: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 font-mono text-xs text-stone-900 focus:border-emerald-600 focus:outline-none"
            >
              <option value={9600}>9600 bps (Estándar)</option>
              <option value={4800}>4800 bps</option>
              <option value={19200}>19200 bps</option>
            </select>
          </div>
        </div>
      </div>

      {/* Store Profile Shortcut */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200/80 bg-white p-5">
        <div>
          <h3 className="font-display text-sm font-semibold text-emerald-950">
            Datos e imágenes del comercio
          </h3>
          <p className="mt-0.5 text-xs text-stone-500">
            {store.storeName} · RUC {store.taxId} · {store.address} · Moneda {store.currencySymbol}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenStoreSettings}
          className="whitespace-nowrap shrink-0 rounded-lg border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-800 hover:bg-orange-100"
        >
          Editar datos e imágenes del comercio
        </button>
      </div>
    </div>
  );
};
