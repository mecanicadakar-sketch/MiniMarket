import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Barcode,
  CheckCircle2,
  DollarSign,
  Printer,
  Scale,
  Settings2,
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
  scannerConnected: boolean;
  printerConnected: boolean;
  scaleConnected: boolean;
  scaleWeight: number;
  scanLogs: ScanLogEntry[];
  onUpdateConfig: (next: HardwareConfig) => void;
  onOpenStoreSettings: () => void;
  onConnectScanner: () => Promise<void>;
  onDisconnectScanner: () => Promise<void>;
  onVerifyHidScanner: (detectedSuffix?: 'Enter' | 'Tab', sampleCode?: string) => void;
  onConnectPrinter: () => Promise<void>;
  onDisconnectPrinter: () => Promise<void>;
  onConnectScale: () => Promise<void>;
  onDisconnectScale: () => Promise<void>;
  onSetScaleWeight: (kg: number) => void;
  onTestScan: (code: string) => void;
  onTestPrint: () => void;
  onTestDrawer: () => Promise<void>;
  readOnly?: boolean;
}

export const HardwareCenter: React.FC<HardwareCenterProps> = ({
  config,
  store,
  scannerConnected,
  printerConnected,
  scaleConnected,
  scaleWeight,
  scanLogs,
  onUpdateConfig,
  onOpenStoreSettings,
  onConnectScanner,
  onDisconnectScanner,
  onVerifyHidScanner,
  onConnectPrinter,
  onDisconnectPrinter,
  onConnectScale,
  onDisconnectScale,
  onSetScaleWeight,
  onTestScan,
  onTestPrint,
  onTestDrawer,
  readOnly = false,
}) => {
  const [testBarcode, setTestBarcode] = useState('7790895000430');
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [captureInput, setCaptureInput] = useState('');
  const [capturedSample, setCapturedSample] = useState<{
    code: string;
    suffix: 'Enter' | 'Tab';
  } | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const serialSupported = isWebSerialSupported();
  const scannerMode = config.scannerMode ?? 'hid_keyboard';
  const scannerBaudRate = config.scannerBaudRate ?? 9600;

  useEffect(() => {
    if (scannerModalOpen && scannerMode === 'hid_keyboard') {
      const timer = window.setTimeout(() => {
        captureInputRef.current?.focus();
      }, 60);
      return () => window.clearTimeout(timer);
    }
  }, [scannerModalOpen, scannerMode]);

  const handleOpenScannerModal = () => {
    setCaptureInput('');
    setCapturedSample(null);
    setScannerModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {readOnly && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-950">
          Modo Demo (solo lectura): podés visualizar la configuración de equipos TPV, pero no modificar ni conectar periféricos.
        </div>
      )}
      {!serialSupported && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          Este navegador no expone la API Web Serial. Podés seguir usando el lector USB HID
          (modo teclado), la impresión térmica de 80mm por navegador y la balanza integrada, o
          abrir la app en Chrome/Edge para enlace serie directo ESC/POS y RS-232.
        </div>
      )}

      <fieldset disabled={readOnly} className="grid grid-cols-1 gap-5 lg:grid-cols-2 disabled:opacity-85">
        {/* 1. Barcode Scanner */}
        <div className="rounded-xl border border-amber-200/80 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-orange-600">
                <Barcode className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Lector de Código de Barras (USB HID / Serial)
                </h3>
                <p className="text-xs text-slate-500">
                  {scannerConnected
                    ? scannerMode === 'serial_com'
                      ? 'Puerto serie conectado (lectura continua activa)'
                      : 'Lector USB HID conectado y calibrado'
                    : config.scannerEnabled
                      ? scannerMode === 'serial_com'
                        ? 'Modo USB-Serial / RS-232 · Listo para conectar puerto'
                        : 'Escucha global activa · Modo teclado USB HID'
                      : 'Detección global pausada'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenScannerModal}
                className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Settings2 className="h-4 w-4" />
                Configurar
              </button>
              {scannerConnected ? (
                <button
                  type="button"
                  onClick={onDisconnectScanner}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  <X className="h-4 w-4" />
                  Desconectar
                </button>
              ) : scannerMode === 'serial_com' ? (
                <button
                  type="button"
                  disabled={!serialSupported}
                  onClick={onConnectScanner}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Usb className="h-4 w-4" />
                  Conectar USB/Serial
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenScannerModal}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Usb className="h-4 w-4" />
                  Conectar Lector
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
            <div>
              <label className="block font-medium text-slate-700">Modo de conexión</label>
              <select
                value={scannerMode}
                onChange={(e) => {
                  const nextMode = e.target.value as 'hid_keyboard' | 'serial_com';
                  if (scannerConnected) {
                    void onDisconnectScanner();
                  }
                  onUpdateConfig({
                    ...config,
                    scannerMode: nextMode,
                  });
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                <option value="hid_keyboard">USB HID (Teclado)</option>
                <option value="serial_com">USB-Serial / RS-232</option>
              </select>
            </div>
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
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                <option value="Enter">Enter (CR/LF)</option>
                <option value="Tab">Tabulador (TAB)</option>
              </select>
            </div>
            {scannerMode === 'serial_com' ? (
              <div>
                <label className="block font-medium text-slate-700">Baudios (Serial)</label>
                <select
                  value={scannerBaudRate}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      scannerBaudRate: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                >
                  <option value={9600}>9600</option>
                  <option value={19200}>19200</option>
                  <option value={38400}>38400</option>
                  <option value={115200}>115200</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block font-medium text-slate-700">
                  Prefijo balanza (EAN-13)
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
            )}
          </div>

          {scannerMode === 'serial_com' && (
            <div className="mt-3 text-xs">
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
                className="mt-1 w-32 rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={config.scannerEnabled}
                  onChange={(e) =>
                    onUpdateConfig({ ...config, scannerEnabled: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                />
                Lector activo
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-slate-700">
                <input
                  type="checkbox"
                  checked={config.scannerBeep}
                  onChange={(e) =>
                    onUpdateConfig({ ...config, scannerBeep: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                />
                Sonido al escanear
              </label>
            </div>
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
      </fieldset>

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

      {/* Scanner Connection & Calibration Modal */}
      {scannerModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-200 bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-orange-600">
                    <Barcode className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-display text-base font-bold text-slate-900">
                      Conectar y Configurar Lector de Barras
                    </h4>
                    <p className="text-xs text-slate-500">
                      Elegí el tipo de conexión o escaneá un producto para calibrar el lector.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setScannerModalOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Cerrar configuración de lector"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Tipo de conexión del lector
                  </label>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (scannerConnected && scannerMode === 'serial_com') {
                          void onDisconnectScanner();
                        }
                        onUpdateConfig({ ...config, scannerMode: 'hid_keyboard' });
                      }}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        scannerMode === 'hid_keyboard'
                          ? 'border-orange-400 bg-amber-50/70'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-900">USB HID (Teclado)</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Plug & Play estándar (USB o Bluetooth)
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateConfig({ ...config, scannerMode: 'serial_com' });
                      }}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        scannerMode === 'serial_com'
                          ? 'border-orange-400 bg-amber-50/70'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-900">USB-Serial / RS-232</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Puerto COM virtual por Web Serial
                      </p>
                    </button>
                  </div>
                </div>

                {scannerMode === 'hid_keyboard' ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                    <label className="block text-xs font-semibold text-emerald-950">
                      Calibración en vivo (escaneá cualquier código ahora)
                    </label>
                    <p className="mt-0.5 text-[11px] text-emerald-800">
                      Hacé clic en el recuadro y dispará el lector sobre un producto. Detectamos
                      automáticamente si termina en Enter o Tabulador.
                    </p>
                    <input
                      ref={captureInputRef}
                      type="text"
                      value={captureInput}
                      onChange={(e) => setCaptureInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Tab') {
                          e.preventDefault();
                          const code = captureInput.trim();
                          if (code.length >= 3) {
                            const detectedSuffix = e.key as 'Enter' | 'Tab';
                            setCapturedSample({ code, suffix: detectedSuffix });
                            onVerifyHidScanner(detectedSuffix, code);
                            setCaptureInput('');
                          }
                        }
                      }}
                      placeholder="Esperando lectura del lector USB..."
                      className="mt-2.5 w-full rounded-lg border border-emerald-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />

                    {capturedSample && (
                      <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-2 text-xs font-medium text-emerald-900">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                        <span>
                          Lectura capturada: <strong className="font-mono">{capturedSample.code}</strong>{' '}
                          (fin: {capturedSample.suffix})
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Velocidad del puerto serie (Baudios)
                      </label>
                      <select
                        value={scannerBaudRate}
                        onChange={(e) =>
                          onUpdateConfig({ ...config, scannerBaudRate: Number(e.target.value) })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                      >
                        <option value={9600}>9600 bps (Estándar)</option>
                        <option value={19200}>19200 bps</option>
                        <option value={38400}>38400 bps</option>
                        <option value={115200}>115200 bps</option>
                      </select>
                    </div>
                    {!serialSupported && (
                      <p className="text-[11px] text-amber-800">
                        Web Serial requiere Chrome o Edge en escritorio.
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
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
                      Prefijo balanza (EAN-13)
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
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setScannerModalOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cerrar
                </button>
                {scannerMode === 'serial_com' ? (
                  scannerConnected ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await onDisconnectScanner();
                        setScannerModalOpen(false);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                    >
                      <X className="h-4 w-4" />
                      Desconectar Puerto
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!serialSupported}
                      onClick={async () => {
                        await onConnectScanner();
                        setScannerModalOpen(false);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Usb className="h-4 w-4" />
                      Conectar Puerto USB/Serial
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onVerifyHidScanner(config.scannerSuffix, captureInput.trim() || undefined);
                      setScannerModalOpen(false);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmar y Activar Lector
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
