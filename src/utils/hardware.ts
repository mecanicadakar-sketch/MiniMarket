import { Sale, StoreSettings } from '../types/pos';
import { formatCurrency, formatDateTime, formatQuantity } from './format';

// Web Audio API feedback tones (no external sound files required)
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playScannerBeep(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(2400, ctx.currentTime);
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.085);
}

export function playErrorBeep(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(280, ctx.currentTime);
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.19);
}

export function playDrawerChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(920, ctx.currentTime);
  osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.06);
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.17);
}

// Web Serial types for browser USB-Serial POS peripherals
export interface SerialPortLike {
  open(options: { baudRate: number; dataBits?: number; stopBits?: number; parity?: string }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export async function requestAndOpenSerialPort(baudRate: number): Promise<SerialPortLike> {
  if (!isWebSerialSupported()) {
    throw new Error('Tu navegador no soporta Web Serial API. Usa Chrome o Edge en escritorio.');
  }
  const navSerial = (navigator as unknown as { serial: { requestPort: () => Promise<SerialPortLike> } }).serial;
  const port = await navSerial.requestPort();
  await port.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none' });
  return port;
}

export async function writeBytesToSerialPort(port: SerialPortLike, bytes: Uint8Array): Promise<void> {
  if (!port.writable) {
    throw new Error('El puerto serie no admite escritura.');
  }
  const writer = port.writable.getWriter();
  try {
    await writer.write(bytes);
  } finally {
    writer.releaseLock();
  }
}

// Standard ESC/POS cash drawer kick pulse: ESC p 0 25 250
export function buildDrawerKickCommand(): Uint8Array {
  return new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);
}

// Standard ESC/POS receipt byte encoder (CP437 / ASCII safe)
export function buildEscPosReceipt(sale: Sale, store: StoreSettings, openDrawer = false): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: number[] = [];

  const pushBytes = (...b: number[]) => chunks.push(...b);
  const pushText = (text: string) => {
    const clean = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E\n]/g, '');
    const encoded = encoder.encode(clean);
    encoded.forEach((v) => chunks.push(v));
  };

  // ESC @ (Initialize printer)
  pushBytes(0x1b, 0x40);
  // Center align + Bold
  pushBytes(0x1b, 0x61, 0x01, 0x1b, 0x45, 0x01);
  pushText(`${store.storeName}\n`);
  pushBytes(0x1b, 0x45, 0x00);
  pushText(`${store.legalName}\n`);
  pushText(`RUC: ${store.taxId}\n`);
  pushText(`${store.address}\n`);
  pushText(`Tel: ${store.phone}\n`);
  pushText('------------------------------------------\n');

  // Left align
  pushBytes(0x1b, 0x61, 0x00);
  pushText(`${sale.documentType.toUpperCase()} Nro: ${sale.ticketNumber}\n`);
  pushText(`Fecha: ${formatDateTime(sale.timestamp)}\n`);
  pushText(`Cajero: ${sale.cashier}\n`);
  if (sale.customer?.name) {
    pushText(`Cliente: ${sale.customer.name}\n`);
    if (sale.customer.taxId) pushText(`RUC: ${sale.customer.taxId}\n`);
    if (sale.customer.address) pushText(`Dir: ${sale.customer.address}\n`);
  }
  pushText('------------------------------------------\n');

  for (const item of sale.items) {
    pushText(`${item.name.slice(0, 42)}\n`);
    const qtyLabel = formatQuantity(item.quantity, item.unit);
    const unitLabel = formatCurrency(item.unitPrice, store.currencySymbol);
    const lineLabel = formatCurrency(item.lineTotal, store.currencySymbol);
    const left = `  ${qtyLabel} x ${unitLabel}`;
    const spaces = Math.max(1, 42 - left.length - lineLabel.length);
    pushText(`${left}${' '.repeat(spaces)}${lineLabel}\n`);
  }

  pushText('------------------------------------------\n');
  if (sale.discountTotal > 0) {
    pushText(`Descuentos: -${formatCurrency(sale.discountTotal, store.currencySymbol)}\n`);
  }
  pushText(`IVA incluido: ${formatCurrency(sale.taxTotal, store.currencySymbol)}\n`);
  pushBytes(0x1b, 0x45, 0x01);
  pushText(`TOTAL: ${formatCurrency(sale.total, store.currencySymbol)}\n`);
  pushBytes(0x1b, 0x45, 0x00);
  pushText(`Medio de pago: ${sale.payment.method.toUpperCase()}\n`);
  if (sale.payment.cashTendered > 0) {
    pushText(`Recibido: ${formatCurrency(sale.payment.cashTendered, store.currencySymbol)}  Vuelto: ${formatCurrency(sale.payment.changeGiven, store.currencySymbol)}\n`);
  }
  pushText('------------------------------------------\n');
  pushBytes(0x1b, 0x61, 0x01);
  pushText(`${store.receiptFooter}\n\n\n\n`);

  // GS V 0 (Full cut)
  pushBytes(0x1d, 0x56, 0x00);

  if (openDrawer) {
    pushBytes(0x1b, 0x70, 0x00, 0x19, 0xfa);
  }

  return new Uint8Array(chunks);
}

// Parse standard electronic scale ASCII frame (e.g. "ST,GS,+  0.450kg", "0.450", "W: 1.250 kg")
export function parseScaleWeightFrame(raw: string): number | null {
  const match = raw.match(/([0-9]+(?:[.,][0-9]{1,3})?)/);
  if (!match) return null;
  const normalized = match[1].replace(',', '.');
  const val = parseFloat(normalized);
  if (!Number.isFinite(val) || val < 0 || val > 500) return null;
  return Number(val.toFixed(3));
}
