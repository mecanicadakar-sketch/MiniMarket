export type ProductCategory = string;

export type ProductUnit = 'u' | 'kg';

export interface Product {
  id: string;
  barcode: string;
  sku: string;
  name: string;
  category: ProductCategory;
  unit: ProductUnit;
  costPrice: number;
  salePrice: number;
  taxRate: number; // DNIT Paraguay: 10, 5, 0
  stock: number;
  minStock: number;
  expiryDate?: string; // YYYY-MM-DD
  batchCode?: string;
  supplierId?: string;
  supplierName?: string;
}

export interface Supplier {
  id: string;
  name: string;
  taxId?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  notes?: string;
}

export interface AppPricingConfig {
  paymentPhone: string;
  currencySymbol: string;
  monthlyPrice: number;
  monthlyNote: string;
  semiannualPrice: number;
  semiannualNote: string;
  annualPrice: number;
  annualNote: string;
}

export interface CartItem {
  productId: string;
  barcode: string;
  name: string;
  unit: ProductUnit;
  unitPrice: number;
  taxRate: number;
  quantity: number; // integer for 'u', decimal kg for 'kg'
  discountPct: number; // 0-100
}

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';

export interface PaymentBreakdown {
  method: PaymentMethod;
  cashAmount: number;
  cardAmount: number;
  transferAmount: number;
  cashTendered: number;
  changeGiven: number;
  reference?: string;
}

export type DocumentType = 'Ticket' | 'Factura B' | 'Factura A';

export interface CustomerInfo {
  name: string;
  taxId: string; // DNI / CUIT / RUT
  address?: string;
}

export interface Sale {
  id: string;
  ticketNumber: string;
  shiftId: string;
  timestamp: string;
  cashier: string;
  documentType: DocumentType;
  customer?: CustomerInfo;
  items: {
    productId: string;
    barcode: string;
    name: string;
    unit: ProductUnit;
    unitPrice: number;
    taxRate: number;
    quantity: number;
    discountPct: number;
    lineTotal: number;
  }[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  payment: PaymentBreakdown;
  status: 'completada' | 'anulada';
}

export interface CashMovement {
  id: string;
  shiftId: string;
  timestamp: string;
  type: 'ingreso' | 'retiro';
  reason: string;
  amount: number;
  operator: string;
}

export interface Shift {
  id: string;
  registerName: string;
  cashier: string;
  openedAt: string;
  closedAt?: string;
  openingFloat: number;
  expectedCash?: number;
  countedCash?: number;
  difference?: number;
  notes?: string;
  status: 'abierto' | 'cerrado';
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  timestamp: string;
  type: 'venta' | 'ingreso' | 'merma' | 'ajuste' | 'anulacion';
  delta: number;
  resultingStock: number;
  note: string;
}

export interface StoreSettings {
  storeName: string;
  legalName: string;
  taxId: string;
  address: string;
  phone: string;
  email?: string;
  receiptFooter: string;
  currencySymbol: string;
  logoUrl?: string;
  bannerUrl?: string;
  topBannerUrl?: string;
}

export interface HardwareConfig {
  scannerEnabled: boolean;
  scannerMode?: 'hid_keyboard' | 'serial_com';
  scannerBaudRate?: number;
  scannerBeep: boolean;
  scannerSuffix: 'Enter' | 'Tab';
  scannerWeighedPrefix: string; // e.g., "20"
  printerMode: 'browser_80mm' | 'escpos_serial';
  printerBaudRate: number;
  printerPaperWidth: '80mm' | '58mm';
  autoPrintOnSale: boolean;
  drawerTrigger: 'cash_only' | 'all_sales' | 'manual';
  scaleBaudRate: number;
  scaleUnit: 'kg';
}

export interface ScanLogEntry {
  id: string;
  timestamp: string;
  code: string;
  matchedProduct?: string;
  source: 'teclado_hid' | 'serial' | 'buscador' | 'balanza';
}

export type StaffRole = 'super_admin' | 'manager' | 'cashier' | 'warehouse';

export interface StaffPermissions {
  operatePos: boolean;
  applyDiscounts: boolean;
  voidSales: boolean;
  manageCash: boolean;
  viewInventory: boolean;
  manageInventory: boolean;
  manageHardware: boolean;
  manageCashiers: boolean;
  manageManagers: boolean;
}

export interface StaffProfile {
  uid: string;
  username: string;
  email: string;
  fullName: string;
  role: StaffRole;
  jobTitle?: string;
  active: boolean;
  permissions: StaffPermissions;
  createdByUid: string;
  createdByRole: 'super_admin' | 'manager';
  assignedManagerUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ActiveTab =
  | 'pos'
  | 'sales'
  | 'inventory'
  | 'suppliers'
  | 'cash'
  | 'hardware'
  | 'store'
  | 'admin'
  | 'pricing';
