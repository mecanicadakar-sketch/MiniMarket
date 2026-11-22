import { Product } from '../types/pos';

export function formatCurrency(value: number, symbol = 'Gs.'): string {
  const safe = Number.isFinite(value) ? value : 0;
  const isGuarani = symbol.toLowerCase().includes('gs') || symbol.toUpperCase() === 'PYG';
  const formatted = safe.toLocaleString(isGuarani ? 'es-PY' : 'es-AR', {
    minimumFractionDigits: isGuarani ? 0 : 2,
    maximumFractionDigits: isGuarani ? 0 : 2,
  });
  return `${symbol} ${formatted}`;
}

export function formatQuantity(qty: number, unit: 'u' | 'kg'): string {
  if (unit === 'kg') {
    return `${qty.toFixed(3)} kg`;
  }
  return `${Math.round(qty)} u`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeOnly(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function getDaysUntilExpiry(expiryDate?: string): number | null {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(`${expiryDate}T00:00:00`);
  if (Number.isNaN(exp.getTime())) return null;
  const diffMs = exp.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getExpiryStatus(expiryDate?: string): 'ok' | 'soon' | 'expired' | 'none' {
  const days = getDaysUntilExpiry(expiryDate);
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= 15) return 'soon';
  return 'ok';
}

export function getStockStatus(product: Product): 'ok' | 'low' | 'out' {
  if (product.stock <= 0) return 'out';
  if (product.stock <= product.minStock) return 'low';
  return 'ok';
}

export function generateEan13(): string {
  const prefix = '779'; // Argentina / regional EAN-13 prefix
  let base = prefix;
  for (let i = 0; i < 9; i++) {
    base += Math.floor(Math.random() * 10).toString();
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(base[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${base}${checkDigit}`;
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
