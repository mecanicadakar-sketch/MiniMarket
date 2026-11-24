import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  Cpu,
  CreditCard,
  LogOut,
  Package,
  Receipt,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Vault,
} from 'lucide-react';
import { AdminPanel } from './components/AdminPanel';
import { CashRegister } from './components/CashRegister';
import { HardwareCenter } from './components/HardwareCenter';
import { InventoryManager } from './components/InventoryManager';
import { LoginScreen } from './components/LoginScreen';
import { PosTerminal } from './components/PosTerminal';
import { PricingPanel } from './components/PricingPanel';
import { ReceiptModal } from './components/ReceiptModal';
import { SalesHistory } from './components/SalesHistory';
import { StoreProfileEditor } from './components/StoreProfileEditor';
import { SuppliersManager } from './components/SuppliersManager';
import {
  DEFAULT_PRODUCT_CATEGORIES,
  INITIAL_CASH_MOVEMENTS,
  INITIAL_HARDWARE_CONFIG,
  INITIAL_PRICING_CONFIG,
  INITIAL_PRODUCTS,
  INITIAL_SALES,
  INITIAL_SHIFT,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_STORE_SETTINGS,
  INITIAL_SUPPLIERS,
} from './data/initialData';
import {
  OperationType,
  STORE_ID,
  SUPER_ADMIN_EMAIL,
  auth,
  createStaffAuthAccount,
  db,
  deleteStaffAuthAccount,
  getStoreIdForStaff,
  getStoreSettingDocId,
  handleFirestoreError,
  normalizeStaffEmail,
  sanitizeStaffUsername,
  testConnection,
  updateStaffAuthPassword,
} from './firebase';
import { useBarcodeScanner } from './hooks/useBarcodeScanner';
import {
  ActiveTab,
  AppPricingConfig,
  CartItem,
  CashMovement,
  CustomerInfo,
  DocumentType,
  HardwareConfig,
  PaymentBreakdown,
  Product,
  Sale,
  ScanLogEntry,
  Shift,
  StaffPermissions,
  StaffProfile,
  StockMovement,
  StoreSettings,
  Supplier,
} from './types/pos';
import { formatCurrency, getExpiryStatus, getStockStatus } from './utils/format';
import {
  SerialPortLike,
  buildDrawerKickCommand,
  buildEscPosReceipt,
  parseScaleWeightFrame,
  playDrawerChime,
  playErrorBeep,
  playScannerBeep,
  requestAndOpenSerialPort,
  writeBytesToSerialPort,
} from './utils/hardware';

const SUPER_ADMIN_PERMS: StaffPermissions = {
  operatePos: true,
  applyDiscounts: true,
  voidSales: true,
  manageCash: true,
  viewInventory: true,
  manageInventory: true,
  manageHardware: true,
  manageCashiers: true,
  manageManagers: true,
};

const DEMO_USER_PROFILE: StaffProfile = {
  uid: 'demo-user',
  username: 'demo',
  email: 'demo@minimarket.local',
  fullName: 'Usuario Demo',
  role: 'manager',
  jobTitle: 'Visitante Demo (Solo lectura)',
  active: true,
  permissions: {
    operatePos: true,
    applyDiscounts: false,
    voidSales: false,
    manageCash: false,
    viewInventory: true,
    manageInventory: false,
    manageHardware: true,
    manageCashiers: true,
    manageManagers: false,
  },
  createdByUid: 'demo',
  createdByRole: 'super_admin',
};

const DEMO_STAFF_PREVIEW: StaffProfile[] = [
  {
    uid: 'demo-admin',
    username: 'admin.general',
    email: 'admin@ejemplo.local',
    fullName: 'Administrador General (Ejemplo)',
    role: 'super_admin',
    jobTitle: 'Administrador General',
    active: true,
    permissions: SUPER_ADMIN_PERMS,
    createdByUid: 'demo-admin',
    createdByRole: 'super_admin',
  },
  {
    uid: 'demo-user',
    username: 'demo',
    email: 'demo@minimarket.local',
    fullName: 'Carlos Méndez (Ejemplo)',
    role: 'manager',
    jobTitle: 'Gerente de Sucursal',
    active: true,
    permissions: DEMO_USER_PROFILE.permissions,
    createdByUid: 'demo-admin',
    createdByRole: 'super_admin',
  },
  {
    uid: 'demo-cashier',
    username: 'lucia.caja',
    email: 'lucia@ejemplo.local',
    fullName: 'Lucía Fernández (Ejemplo)',
    role: 'cashier',
    jobTitle: 'Personal de Caja',
    active: true,
    assignedManagerUid: 'demo-user',
    permissions: {
      operatePos: true,
      applyDiscounts: false,
      voidSales: false,
      manageCash: true,
      viewInventory: true,
      manageInventory: false,
      manageHardware: false,
      manageCashiers: false,
      manageManagers: false,
    },
    createdByUid: 'demo-user',
    createdByRole: 'manager',
  },
  {
    uid: 'demo-warehouse',
    username: 'mateo.stock',
    email: 'mateo@ejemplo.local',
    fullName: 'Mateo Rojas (Ejemplo)',
    role: 'warehouse',
    jobTitle: 'Depositero / Stock',
    active: true,
    assignedManagerUid: 'demo-user',
    permissions: {
      operatePos: false,
      applyDiscounts: false,
      voidSales: false,
      manageCash: false,
      viewInventory: true,
      manageInventory: true,
      manageHardware: false,
      manageCashiers: false,
      manageManagers: false,
    },
    createdByUid: 'demo-user',
    createdByRole: 'manager',
  },
];

function serializeProductDoc(
  p: Product,
  updatedByUid: string,
  includeCreatedAt: boolean,
  storeId: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: p.id,
    storeId,
    barcode: p.barcode.slice(0, 64),
    sku: p.sku.slice(0, 40),
    name: p.name.slice(0, 160),
    category: (p.category || 'Almacén').trim().slice(0, 40) || 'Almacén',
    unit: p.unit,
    costPrice: Number(p.costPrice) || 0,
    salePrice: Number(p.salePrice) || 0,
    taxRate: Number(p.taxRate) || 0,
    stock: Math.max(0, Number(p.stock) || 0),
    minStock: Math.max(0, Number(p.minStock) || 0),
    updatedByUid,
    updatedAt: serverTimestamp(),
  };
  if (includeCreatedAt) {
    payload.createdAt = serverTimestamp();
  }
  if (p.expiryDate) {
    payload.expiryDate = p.expiryDate.slice(0, 20);
  }
  if (p.batchCode) {
    payload.batchCode = p.batchCode.slice(0, 40);
  }
  payload.supplierId = (p.supplierId || '').trim().slice(0, 128);
  payload.supplierName = (p.supplierName || '').trim().slice(0, 120);
  return payload;
}

function serializeSupplierDoc(
  s: Supplier,
  updatedByUid: string,
  includeCreatedAt: boolean,
  storeId: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: s.id,
    storeId,
    name: s.name.trim().slice(0, 120),
    taxId: (s.taxId || '').trim().slice(0, 40),
    contactName: (s.contactName || '').trim().slice(0, 120),
    phone: (s.phone || '').trim().slice(0, 60),
    email: (s.email || '').trim().slice(0, 160),
    address: (s.address || '').trim().slice(0, 200),
    category: (s.category || '').trim().slice(0, 60),
    notes: (s.notes || '').trim().slice(0, 300),
    updatedByUid,
    updatedAt: serverTimestamp(),
  };
  if (includeCreatedAt) {
    payload.createdAt = serverTimestamp();
  }
  return payload;
}

function sanitizeStoreSettings(s: StoreSettings): StoreSettings {
  const payload: StoreSettings = {
    storeName: (s.storeName || 'Mini Market').trim().slice(0, 120) || 'Mini Market',
    legalName: (s.legalName || '').trim().slice(0, 160),
    taxId: (s.taxId || '').trim().slice(0, 40),
    address: (s.address || '').trim().slice(0, 200),
    phone: (s.phone || '').trim().slice(0, 60),
    receiptFooter: (s.receiptFooter || '').trim().slice(0, 300),
    currencySymbol: (s.currencySymbol || 'Gs.').trim().slice(0, 12) || 'Gs.',
  };
  if (s.email?.trim()) payload.email = s.email.trim().slice(0, 160);
  if (s.logoUrl?.trim()) payload.logoUrl = s.logoUrl.trim().slice(0, 250000);
  if (s.bannerUrl?.trim()) payload.bannerUrl = s.bannerUrl.trim().slice(0, 450000);
  if (s.topBannerUrl?.trim()) payload.topBannerUrl = s.topBannerUrl.trim().slice(0, 250000);
  return payload;
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<StaffProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [staffKeys, setStaffKeys] = useState<Record<string, string>>({});
  const [store, setStore] = useState<StoreSettings>(INITIAL_STORE_SETTINGS);
  const [customCategories, setCustomCategories] = useState<string[]>(DEFAULT_PRODUCT_CATEGORIES);
  const [hardwareConfig, setHardwareConfig] = useState<HardwareConfig>(INITIAL_HARDWARE_CONFIG);
  const [appPricing, setAppPricing] = useState<AppPricingConfig>(INITIAL_PRICING_CONFIG);
  const [nextTicketSeq, setNextTicketSeq] = useState<number>(145);

  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'warn' | 'err' } | null>(null);

  const [scaleWeight, setScaleWeight] = useState<number>(0);
  const [scanLogs, setScanLogs] = useState<ScanLogEntry[]>([]);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [scaleConnected, setScaleConnected] = useState(false);
  const [scannerConnected, setScannerConnected] = useState(false);

  const printerPortRef = useRef<SerialPortLike | null>(null);
  const scalePortRef = useRef<SerialPortLike | null>(null);
  const scaleReaderCancelRef = useRef<boolean>(false);
  const scannerPortRef = useRef<SerialPortLike | null>(null);
  const scannerReaderCancelRef = useRef<boolean>(false);
  const handleBarcodeScannedRef = useRef<(code: string, source?: 'teclado_hid' | 'serial' | 'buscador') => void>(() => {});
  const toastTimerRef = useRef<number | null>(null);
  const seededRef = useRef<boolean>(false);
  const taxMigratedRef = useRef<boolean>(false);
  const demoModeRef = useRef<boolean>(false);

  const showToast = useCallback((message: string, tone: 'ok' | 'warn' | 'err' = 'ok') => {
    setToast({ message, tone });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const enterDemoMode = useCallback(() => {
    demoModeRef.current = true;
    setIsDemoMode(true);
    setAuthError(null);
    setCurrentUser(DEMO_USER_PROFILE);
    setProducts(INITIAL_PRODUCTS);
    setSuppliers(INITIAL_SUPPLIERS);
    setShifts([INITIAL_SHIFT]);
    setSales(INITIAL_SALES);
    setCashMovements(INITIAL_CASH_MOVEMENTS);
    setStockMovements(INITIAL_STOCK_MOVEMENTS);
    setStaffList(DEMO_STAFF_PREVIEW);
    setStaffKeys({});
    setStore(INITIAL_STORE_SETTINGS);
    setCustomCategories(DEFAULT_PRODUCT_CATEGORIES);
    setHardwareConfig(INITIAL_HARDWARE_CONFIG);
    setCart([]);
    setReceiptSale(null);
    setActiveTab('pos');
    showToast('Modo Demo activado (solo lectura). Podés explorar todos los paneles.', 'ok');
  }, [showToast]);

  const exitDemoMode = useCallback(() => {
    demoModeRef.current = false;
    setIsDemoMode(false);
    setCurrentUser(null);
    setProducts([]);
    setSuppliers([]);
    setShifts([]);
    setSales([]);
    setCashMovements([]);
    setStockMovements([]);
    setStaffList([]);
    setStaffKeys({});
    setStore(INITIAL_STORE_SETTINGS);
    setCustomCategories(DEFAULT_PRODUCT_CATEGORIES);
    setHardwareConfig(INITIAL_HARDWARE_CONFIG);
    setCart([]);
    setReceiptSale(null);
  }, []);

  // 1. Initial Firestore connectivity test + public pricing subscription
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1') {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
      enterDemoMode();
    }
  }, [enterDemoMode]);

  useEffect(() => {
    testConnection();
    const unsubPricing = onSnapshot(
      doc(db, 'appConfig', 'pricing'),
      (snap) => {
        if (!snap.exists()) {
          setAppPricing(INITIAL_PRICING_CONFIG);
          return;
        }
        const raw = snap.data() as Partial<AppPricingConfig>;
        const nextPricing: AppPricingConfig = {
          paymentPhone: raw.paymentPhone || INITIAL_PRICING_CONFIG.paymentPhone,
          currencySymbol: raw.currencySymbol || INITIAL_PRICING_CONFIG.currencySymbol,
          monthlyPrice:
            typeof raw.monthlyPrice === 'number'
              ? raw.monthlyPrice
              : INITIAL_PRICING_CONFIG.monthlyPrice,
          monthlyNote:
            typeof raw.monthlyNote === 'string'
              ? raw.monthlyNote
              : INITIAL_PRICING_CONFIG.monthlyNote,
          semiannualPrice:
            typeof raw.semiannualPrice === 'number'
              ? raw.semiannualPrice
              : INITIAL_PRICING_CONFIG.semiannualPrice,
          semiannualNote:
            typeof raw.semiannualNote === 'string'
              ? raw.semiannualNote
              : INITIAL_PRICING_CONFIG.semiannualNote,
          annualPrice:
            typeof raw.annualPrice === 'number'
              ? raw.annualPrice
              : INITIAL_PRICING_CONFIG.annualPrice,
          annualNote:
            typeof raw.annualNote === 'string'
              ? raw.annualNote
              : INITIAL_PRICING_CONFIG.annualNote,
        };
        setAppPricing(nextPricing);
        try {
          window.localStorage.setItem('minimarket_public_pricing', JSON.stringify(nextPricing));
        } catch {
          // Ignore storage restrictions
        }
      },
      () => {
        // Fallback to defaults if unreachable before sign-in
      }
    );
    return () => unsubPricing();
  }, []);

  // 2. Firebase Auth state + Staff Profile resolution
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (!user) {
        setFirebaseUser(null);
        if (!demoModeRef.current) {
          setCurrentUser(null);
          setProducts([]);
          setSuppliers([]);
          setShifts([]);
          setSales([]);
          setCashMovements([]);
          setStockMovements([]);
          setStaffList([]);
          setStaffKeys({});
          setStore(INITIAL_STORE_SETTINGS);
          setCustomCategories(DEFAULT_PRODUCT_CATEGORIES);
          setHardwareConfig(INITIAL_HARDWARE_CONFIG);
          setNextTicketSeq(1);
          setCart([]);
          setReceiptSale(null);
        }
        seededRef.current = false;
        taxMigratedRef.current = false;
        setAuthReady(true);
        return;
      }

      demoModeRef.current = false;
      setIsDemoMode(false);
      setFirebaseUser(user);
      const isVerifiedSuperAdmin =
        user.emailVerified &&
        user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

      const staffRef = doc(db, 'staff', user.uid);

      if (isVerifiedSuperAdmin) {
        try {
          const snap = await getDoc(staffRef);
          if (!snap.exists()) {
            const adminProfile: StaffProfile = {
              uid: user.uid,
              username: 'admin.general',
              email: user.email || SUPER_ADMIN_EMAIL,
              fullName: user.displayName || 'Administrador General',
              role: 'super_admin',
              active: true,
              permissions: SUPER_ADMIN_PERMS,
              createdByUid: user.uid,
              createdByRole: 'super_admin',
            };
            await setDoc(staffRef, {
              ...adminProfile,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `staff/${user.uid}`);
        }
      }

      unsubProfile = onSnapshot(
        staffRef,
        async (snap) => {
          if (!snap.exists()) {
            await signOut(auth);
            setCurrentUser(null);
            setAuthError(
              'Esta cuenta no tiene un perfil habilitado en Mini Market. Solicitá acceso al Administrador o Gerente.'
            );
            setAuthReady(true);
            return;
          }

          const profile = snap.data() as StaffProfile;
          if (!profile.active) {
            await signOut(auth);
            setCurrentUser(null);
            setAuthError('Tu cuenta fue suspendida temporalmente por un superior.');
            setAuthReady(true);
            return;
          }

          setAuthError(null);
          setCurrentUser(profile);
          setAuthReady(true);
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `staff/${user.uid}`);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  // 3. Seed initial catalog, suppliers & app pricing once when Super Admin logs in
  useEffect(() => {
    if (
      !authReady ||
      !currentUser ||
      isDemoMode ||
      currentUser.role !== 'super_admin' ||
      seededRef.current
    ) {
      return;
    }
    seededRef.current = true;

    (async () => {
      try {
        // Ensure App Pricing document exists
        const pricingRef = doc(db, 'appConfig', 'pricing');
        const pricingSnap = await getDoc(pricingRef);
        if (!pricingSnap.exists()) {
          await setDoc(pricingRef, {
            id: 'pricing',
            ...INITIAL_PRICING_CONFIG,
            updatedByUid: currentUser.uid,
            updatedAt: serverTimestamp(),
          });
        }

        // Ensure initial suppliers exist for Super Admin store
        const suppliersCheck = await getDocs(
          query(collection(db, 'suppliers'), where('storeId', '==', STORE_ID), limit(1))
        );
        if (suppliersCheck.empty) {
          const supBatch = writeBatch(db);
          for (const sup of INITIAL_SUPPLIERS) {
            supBatch.set(
              doc(db, 'suppliers', sup.id),
              serializeSupplierDoc(sup, currentUser.uid, true, STORE_ID)
            );
          }
          await supBatch.commit();
        }

        const existingCheck = await getDocs(
          query(collection(db, 'products'), where('storeId', '==', STORE_ID), limit(1))
        );
        if (!existingCheck.empty) return;

        // Step 1: Seed shift first so subsequent sales/cashMovements rules verify shift exists
        await setDoc(doc(db, 'shifts', INITIAL_SHIFT.id), {
          ...INITIAL_SHIFT,
          storeId: STORE_ID,
          openedByUid: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Step 2: Batch seed products, settings, initial sales, and movements
        const batch = writeBatch(db);
        for (const prod of INITIAL_PRODUCTS) {
          batch.set(
            doc(db, 'products', prod.id),
            serializeProductDoc(prod, currentUser.uid, true, STORE_ID)
          );
        }

        for (const sale of INITIAL_SALES) {
          batch.set(doc(db, 'sales', sale.id), {
            ...sale,
            storeId: STORE_ID,
            cashierUid: currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        for (const cm of INITIAL_CASH_MOVEMENTS) {
          batch.set(doc(db, 'cashMovements', cm.id), {
            ...cm,
            storeId: STORE_ID,
            operatorUid: currentUser.uid,
            createdAt: serverTimestamp(),
          });
        }

        for (const sm of INITIAL_STOCK_MOVEMENTS) {
          batch.set(doc(db, 'stockMovements', sm.id), {
            ...sm,
            storeId: STORE_ID,
            actorUid: currentUser.uid,
            createdAt: serverTimestamp(),
          });
        }

        batch.set(doc(db, 'settings', 'store'), {
          id: 'store',
          storeId: STORE_ID,
          data: INITIAL_STORE_SETTINGS,
          updatedByUid: currentUser.uid,
          updatedAt: serverTimestamp(),
        });

        batch.set(doc(db, 'settings', 'hardware'), {
          id: 'hardware',
          storeId: STORE_ID,
          data: INITIAL_HARDWARE_CONFIG,
          updatedByUid: currentUser.uid,
          updatedAt: serverTimestamp(),
        });

        batch.set(doc(db, 'settings', 'ticketSeq'), {
          id: 'ticketSeq',
          storeId: STORE_ID,
          data: { nextTicketSeq: 145 },
          updatedByUid: currentUser.uid,
          updatedAt: serverTimestamp(),
        });

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'seed_initial_data');
      }
    })();
  }, [authReady, currentUser]);

  const activeStoreId = useMemo(
    () => (currentUser ? getStoreIdForStaff(currentUser) : STORE_ID),
    [currentUser]
  );

  // 4. Real-time Firestore listeners (strictly guarded by authReady && currentUser && !isDemoMode, isolated by activeStoreId)
  useEffect(() => {
    if (!authReady || !currentUser || !firebaseUser || isDemoMode) return;

    setProducts([]);
    setSuppliers([]);
    setShifts([]);
    setSales([]);
    setCashMovements([]);
    setStockMovements([]);
    setStore(INITIAL_STORE_SETTINGS);
    setCustomCategories(DEFAULT_PRODUCT_CATEGORIES);
    setHardwareConfig(INITIAL_HARDWARE_CONFIG);
    setNextTicketSeq(currentUser.role === 'super_admin' ? 145 : 1);
    setCart([]);
    setReceiptSale(null);
    taxMigratedRef.current = false;

    const storeFilter = where('storeId', '==', activeStoreId);
    const storeDocId = getStoreSettingDocId(activeStoreId, 'store');
    const hardwareDocId = getStoreSettingDocId(activeStoreId, 'hardware');
    const categoriesDocId = getStoreSettingDocId(activeStoreId, 'categories');
    const ticketSeqDocId = getStoreSettingDocId(activeStoreId, 'ticketSeq');

    const REDUCED_5_IDS = new Set([
      'p-02',
      'p-03',
      'p-04',
      'p-05',
      'p-06',
      'p-09',
      'p-15',
      'p-16',
      'p-17',
      'p-20',
    ]);

    const unsubProducts = onSnapshot(
      query(collection(db, 'products'), storeFilter),
      (snap) => {
        const legacyProducts: { id: string; nextRate: number }[] = [];
        const list = snap.docs.map((d) => {
          const item = d.data() as Product;
          if (item.taxRate === 21 || item.taxRate === 10.5 || item.taxRate === 11) {
            const nextRate =
              item.taxRate === 10.5 || REDUCED_5_IDS.has(item.id) ? 5 : 10;
            legacyProducts.push({ id: item.id, nextRate });
            return { ...item, taxRate: nextRate };
          }
          return item;
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setProducts(list);

        if (
          legacyProducts.length > 0 &&
          !taxMigratedRef.current &&
          (currentUser.role === 'super_admin' || currentUser.permissions.manageInventory)
        ) {
          taxMigratedRef.current = true;
          const batch = writeBatch(db);
          for (const legacy of legacyProducts) {
            batch.update(doc(db, 'products', legacy.id), {
              taxRate: legacy.nextRate,
              updatedByUid: currentUser.uid,
              updatedAt: serverTimestamp(),
            });
          }
          batch.commit().catch(() => {});
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'products')
    );

    const unsubShifts = onSnapshot(
      query(collection(db, 'shifts'), storeFilter),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Shift);
        list.sort((a, b) => b.openedAt.localeCompare(a.openedAt));
        setShifts(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'shifts')
    );

    const unsubSales = onSnapshot(
      query(collection(db, 'sales'), storeFilter),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Sale);
        list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        setSales(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'sales')
    );

    const unsubCashMov = onSnapshot(
      query(collection(db, 'cashMovements'), storeFilter),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as CashMovement);
        list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        setCashMovements(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'cashMovements')
    );

    const unsubStockMov = onSnapshot(
      query(collection(db, 'stockMovements'), storeFilter),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as StockMovement);
        list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        setStockMovements(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'stockMovements')
    );

    const unsubSettings = onSnapshot(
      query(collection(db, 'settings'), storeFilter),
      (snap) => {
        for (const docSnap of snap.docs) {
          const val = docSnap.data() as { id: string; data: Record<string, unknown> };
          if (val.id === storeDocId && val.data) {
            const loadedStore: StoreSettings = {
              ...INITIAL_STORE_SETTINGS,
              ...(val.data as Partial<StoreSettings>),
            };
            const needsGuaraniMigration =
              !loadedStore.currencySymbol || loadedStore.currencySymbol === '$';
            if (needsGuaraniMigration) {
              loadedStore.currencySymbol = 'Gs.';
              if (
                currentUser.role === 'super_admin' ||
                currentUser.role === 'manager' ||
                currentUser.permissions.manageHardware
              ) {
                setDoc(doc(db, 'settings', storeDocId), {
                  id: storeDocId,
                  storeId: activeStoreId,
                  data: sanitizeStoreSettings(loadedStore),
                  updatedByUid: currentUser.uid,
                  updatedAt: serverTimestamp(),
                }).catch(() => {});
              }
            }
            setStore(loadedStore);
          } else if (val.id === hardwareDocId && val.data) {
            setHardwareConfig({
              ...INITIAL_HARDWARE_CONFIG,
              ...(val.data as Partial<HardwareConfig>),
            });
          } else if (val.id === categoriesDocId && Array.isArray(val.data?.items)) {
            const cleaned = (val.data.items as unknown[])
              .filter((c): c is string => typeof c === 'string')
              .map((c) => c.trim().slice(0, 40))
              .filter(Boolean);
            if (cleaned.length > 0) {
              setCustomCategories(Array.from(new Set(cleaned)).slice(0, 60));
            }
          } else if (val.id === ticketSeqDocId && typeof val.data?.nextTicketSeq === 'number') {
            setNextTicketSeq(val.data.nextTicketSeq);
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'settings')
    );

    let unsubStaff: (() => void) | null = null;
    if (currentUser.role === 'super_admin') {
      unsubStaff = onSnapshot(
        collection(db, 'staff'),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as StaffProfile);
          list.sort((a, b) => a.fullName.localeCompare(b.fullName));
          setStaffList(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'staff')
      );
    } else if (currentUser.role === 'manager' && currentUser.permissions.manageCashiers) {
      unsubStaff = onSnapshot(
        query(collection(db, 'staff'), where('assignedManagerUid', '==', currentUser.uid)),
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as StaffProfile)
            .filter((s) => s.role === 'cashier' || s.role === 'warehouse');
          list.sort((a, b) => a.fullName.localeCompare(b.fullName));
          setStaffList(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'staff')
      );
    } else {
      setStaffList([currentUser]);
    }

    const unsubSuppliers = onSnapshot(
      query(collection(db, 'suppliers'), storeFilter),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Supplier);
        list.sort((a, b) => a.name.localeCompare(b.name));
        setSuppliers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'suppliers')
    );

    return () => {
      unsubProducts();
      unsubSuppliers();
      unsubShifts();
      unsubSales();
      unsubCashMov();
      unsubStockMov();
      unsubSettings();
      if (unsubStaff) unsubStaff();
    };
  }, [authReady, currentUser, firebaseUser, activeStoreId, isDemoMode]);

  // 4b. Subscribe to isolated access keys only for manageable staff members
  useEffect(() => {
    if (!authReady || !currentUser || !firebaseUser || isDemoMode) {
      setStaffKeys({});
      return;
    }

    const canManageStaff =
      currentUser.role === 'super_admin' ||
      (currentUser.role === 'manager' && currentUser.permissions.manageCashiers);

    if (!canManageStaff) {
      setStaffKeys({});
      return;
    }

    const manageable = staffList.filter(
      (s) =>
        s.role !== 'super_admin' &&
        (currentUser.role === 'super_admin' ||
          (currentUser.role === 'manager' &&
            (s.role === 'cashier' || s.role === 'warehouse') &&
            s.assignedManagerUid === currentUser.uid))
    );

    if (manageable.length === 0) {
      setStaffKeys({});
      return;
    }

    const unsubs = manageable.map((staff) =>
      onSnapshot(
        doc(db, 'staff', staff.uid, 'credentials', 'access'),
        (snap) => {
          setStaffKeys((prev) => {
            if (!snap.exists()) {
              if (!(staff.uid in prev)) return prev;
              const next = { ...prev };
              delete next[staff.uid];
              return next;
            }
            const accessKey = snap.data()?.accessKey;
            if (typeof accessKey !== 'string') return prev;
            if (prev[staff.uid] === accessKey) return prev;
            return { ...prev, [staff.uid]: accessKey };
          });
        },
        () => {
          // Legacy or restricted document; keep UI responsive without crashing
        }
      )
    );

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [authReady, currentUser, firebaseUser, staffList]);

  const activeShift = useMemo(
    () => shifts.find((s) => s.status === 'abierto') || null,
    [shifts]
  );

  const closedShifts = useMemo(
    () => shifts.filter((s) => s.status === 'cerrado'),
    [shifts]
  );

  const alertCounts = useMemo(() => {
    let inventoryAlerts = 0;
    for (const p of products) {
      const s = getStockStatus(p);
      const e = getExpiryStatus(p.expiryDate);
      if (s === 'low' || s === 'out' || e === 'soon' || e === 'expired') {
        inventoryAlerts += 1;
      }
    }
    return { inventoryAlerts };
  }, [products]);

  const navItems = useMemo(() => {
    if (!currentUser) return [];
    const p = currentUser.permissions;
    const items: {
      id: ActiveTab;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: number;
    }[] = [];

    if (p.operatePos) {
      items.push({ id: 'pos', label: 'Cobro Rápido', icon: ShoppingCart });
    }
    if (
      p.operatePos ||
      p.manageCash ||
      p.voidSales ||
      currentUser.role === 'super_admin' ||
      currentUser.role === 'manager'
    ) {
      items.push({ id: 'sales', label: 'Ventas y Tickets', icon: Receipt });
    }
    if (p.viewInventory || p.manageInventory) {
      items.push({
        id: 'inventory',
        label: 'Inventario',
        icon: Package,
        badge: alertCounts.inventoryAlerts > 0 ? alertCounts.inventoryAlerts : undefined,
      });
    }
    if (p.viewInventory || p.manageInventory || isDemoMode) {
      items.push({
        id: 'suppliers',
        label: 'Proveedores',
        icon: Truck,
      });
    }
    if (p.manageCash || p.operatePos) {
      items.push({ id: 'cash', label: 'Caja y Turnos', icon: Vault });
    }
    if (p.manageHardware) {
      items.push({ id: 'hardware', label: 'Equipos TPV', icon: Cpu });
    }
    if (
      currentUser.role === 'super_admin' ||
      currentUser.role === 'manager' ||
      p.manageHardware
    ) {
      items.push({ id: 'store', label: 'Datos del Comercio', icon: Store });
    }
    if (
      currentUser.role === 'super_admin' ||
      (currentUser.role === 'manager' && p.manageCashiers)
    ) {
      items.push({ id: 'admin', label: 'Personal y Permisos', icon: Users });
    }
    items.push({ id: 'pricing', label: 'Precio de la App', icon: CreditCard });
    return items;
  }, [currentUser, alertCounts.inventoryAlerts, isDemoMode]);

  // Redirect directly to Cobro Rápido when signing in or entering Demo mode
  useEffect(() => {
    if (currentUser) {
      setActiveTab('pos');
    }
  }, [currentUser?.uid, isDemoMode]);

  // Keep activeTab valid for current user's permissions
  useEffect(() => {
    if (navItems.length > 0 && !navItems.some((item) => item.id === activeTab)) {
      setActiveTab(navItems[0].id);
    }
  }, [navItems, activeTab]);

  // --- Cart & Barcode Logic ---
  const addProductToCart = useCallback(
    (product: Product, quantity: number) => {
      if (product.stock <= 0) {
        if (hardwareConfig.scannerBeep) playErrorBeep();
        showToast(`Sin stock disponible de ${product.name}`, 'err');
        return;
      }

      setCart((prev) => {
        const existing = prev.find((i) => i.productId === product.id);
        const nextQty = existing
          ? Number((existing.quantity + quantity).toFixed(3))
          : Number(quantity.toFixed(3));

        if (nextQty > product.stock) {
          showToast(
            `Stock máximo alcanzado para ${product.name} (${product.stock} ${product.unit})`,
            'warn'
          );
          return prev;
        }

        if (existing) {
          return prev.map((i) =>
            i.productId === product.id ? { ...i, quantity: nextQty } : i
          );
        }

        return [
          ...prev,
          {
            productId: product.id,
            barcode: product.barcode,
            name: product.name,
            unit: product.unit,
            unitPrice: product.salePrice,
            taxRate: product.taxRate,
            quantity: nextQty,
            discountPct: 0,
          },
        ];
      });

      if (hardwareConfig.scannerBeep) {
        playScannerBeep();
      }
    },
    [hardwareConfig.scannerBeep, showToast]
  );

  const handleBarcodeScanned = useCallback(
    (rawCode: string, source: 'teclado_hid' | 'serial' | 'buscador' = 'teclado_hid') => {
      const code = rawCode.trim();
      if (!code) return;

      let matched = products.find(
        (p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase()
      );
      let qty = 1;

      const prefix = hardwareConfig.scannerWeighedPrefix;
      if (!matched && prefix && code.startsWith(prefix) && code.length === 13) {
        const itemKey = code.slice(2, 6);
        const grams = parseInt(code.slice(7, 12), 10);
        matched = products.find((p) => p.barcode.slice(0, 6) === `${prefix}${itemKey}`);
        if (matched && Number.isFinite(grams) && grams > 0) {
          qty = Number((grams / 1000).toFixed(3));
        }
      }

      setScanLogs((prev) => [
        {
          id: `sc-${Date.now()}`,
          timestamp: new Date().toISOString(),
          code,
          matchedProduct: matched?.name,
          source,
        },
        ...prev.slice(0, 14),
      ]);

      if (!matched) {
        if (hardwareConfig.scannerBeep) playErrorBeep();
        showToast(
          activeTab === 'hardware'
            ? `Código leído (${code}) — sin producto asociado en inventario`
            : `Código no encontrado: ${code}`,
          activeTab === 'hardware' ? 'warn' : 'err'
        );
        return;
      }

      if (activeTab === 'hardware') {
        if (hardwareConfig.scannerBeep) playScannerBeep();
        showToast(`Lectura verificada: ${matched.name}`, 'ok');
        return;
      }

      if (matched.unit === 'kg' && qty === 1) {
        qty = scaleWeight > 0 ? scaleWeight : 0.5;
      }

      addProductToCart(matched, qty);
      showToast(`Agregado: ${matched.name}`, 'ok');
    },
    [
      products,
      hardwareConfig.scannerWeighedPrefix,
      hardwareConfig.scannerBeep,
      activeTab,
      scaleWeight,
      addProductToCart,
      showToast,
    ]
  );

  useEffect(() => {
    handleBarcodeScannedRef.current = handleBarcodeScanned;
  }, [handleBarcodeScanned]);

  useBarcodeScanner({
    enabled:
      Boolean(currentUser?.permissions.operatePos || currentUser?.permissions.manageHardware) &&
      hardwareConfig.scannerEnabled &&
      (activeTab === 'pos' || activeTab === 'hardware') &&
      !receiptSale,
    suffix: hardwareConfig.scannerSuffix,
    onScan: (code) => handleBarcodeScanned(code, 'teclado_hid'),
  });

  // --- Hardware Peripherals ---
  const triggerCashDrawer = useCallback(async () => {
    if (printerPortRef.current) {
      try {
        await writeBytesToSerialPort(printerPortRef.current, buildDrawerKickCommand());
        playDrawerChime();
        showToast('Pulso de apertura enviado al cajón de dinero', 'ok');
      } catch {
        showToast('Error al enviar pulso por puerto serie', 'err');
      }
    } else {
      playDrawerChime();
      showToast('Cajón abierto (modo simulación · conectá impresora ESC/POS para pulso RJ11)', 'ok');
    }
  }, [showToast]);

  const printSaleSerial = useCallback(
    async (sale: Sale, kickDrawer = false) => {
      if (!printerPortRef.current) {
        showToast('Impresora ESC/POS no conectada por USB/Serial', 'warn');
        return;
      }
      try {
        const bytes = buildEscPosReceipt(sale, store, kickDrawer);
        await writeBytesToSerialPort(printerPortRef.current, bytes);
        showToast(`Comprobante ${sale.ticketNumber} enviado a impresora ESC/POS`, 'ok');
      } catch {
        showToast('No se pudo imprimir en el puerto serie', 'err');
      }
    },
    [store, showToast]
  );

  const handleConnectPrinter = async () => {
    try {
      const port = await requestAndOpenSerialPort(hardwareConfig.printerBaudRate);
      printerPortRef.current = port;
      setPrinterConnected(true);
      showToast('Impresora térmica ESC/POS conectada', 'ok');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Conexión cancelada', 'warn');
    }
  };

  const handleDisconnectPrinter = async () => {
    try {
      await printerPortRef.current?.close();
    } catch {
      // ignore
    }
    printerPortRef.current = null;
    setPrinterConnected(false);
    showToast('Impresora desconectada', 'ok');
  };

  const handleConnectScale = async () => {
    try {
      const port = await requestAndOpenSerialPort(hardwareConfig.scaleBaudRate);
      scalePortRef.current = port;
      scaleReaderCancelRef.current = false;
      setScaleConnected(true);
      showToast('Balanza electrónica conectada por puerto serie', 'ok');

      if (port.readable) {
        const reader = port.readable.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        (async () => {
          try {
            while (!scaleReaderCancelRef.current) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value) {
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split(/[\r\n]+/);
                buffer = lines.pop() || '';
                for (const line of lines) {
                  const weight = parseScaleWeightFrame(line);
                  if (weight !== null) setScaleWeight(weight);
                }
              }
            }
          } catch {
            // Stream closed
          } finally {
            reader.releaseLock();
          }
        })();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Conexión de balanza cancelada', 'warn');
    }
  };

  const handleDisconnectScale = async () => {
    scaleReaderCancelRef.current = true;
    try {
      await scalePortRef.current?.close();
    } catch {
      // ignore
    }
    scalePortRef.current = null;
    setScaleConnected(false);
    showToast('Balanza desconectada', 'ok');
  };

  const handleConnectScanner = async () => {
    try {
      const port = await requestAndOpenSerialPort(hardwareConfig.scannerBaudRate || 9600);
      scannerPortRef.current = port;
      scannerReaderCancelRef.current = false;
      setScannerConnected(true);
      if (!hardwareConfig.scannerEnabled || hardwareConfig.scannerMode !== 'serial_com') {
        handleUpdateHardwareConfig({
          ...hardwareConfig,
          scannerEnabled: true,
          scannerMode: 'serial_com',
        });
      }
      showToast('Lector de código de barras conectado por USB/Serial', 'ok');

      if (port.readable) {
        const reader = port.readable.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        (async () => {
          try {
            while (!scannerReaderCancelRef.current) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value) {
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split(/[\r\n\t]+/);
                buffer = parts.pop() || '';
                for (const part of parts) {
                  const cleanCode = part.trim();
                  if (cleanCode.length >= 3) {
                    handleBarcodeScannedRef.current(cleanCode, 'serial');
                  }
                }
              }
            }
          } catch {
            // Stream closed
          } finally {
            reader.releaseLock();
          }
        })();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Conexión de lector cancelada', 'warn');
    }
  };

  const handleDisconnectScanner = async () => {
    scannerReaderCancelRef.current = true;
    try {
      await scannerPortRef.current?.close();
    } catch {
      // ignore
    }
    scannerPortRef.current = null;
    setScannerConnected(false);
    showToast('Lector de barras desconectado', 'ok');
  };

  const handleVerifyHidScanner = (detectedSuffix?: 'Enter' | 'Tab', sampleCode?: string) => {
    setScannerConnected(true);
    const nextConfig: HardwareConfig = {
      ...hardwareConfig,
      scannerEnabled: true,
      scannerMode: 'hid_keyboard',
      ...(detectedSuffix ? { scannerSuffix: detectedSuffix } : {}),
    };
    handleUpdateHardwareConfig(nextConfig);
    if (sampleCode && sampleCode.trim()) {
      handleBarcodeScanned(sampleCode.trim(), 'teclado_hid');
    } else {
      if (nextConfig.scannerBeep) playScannerBeep();
      showToast('Lector USB HID conectado y configurado', 'ok');
    }
  };

  // --- Firestore POS Mutations ---
  const handleCompleteSale = async ({
    documentType,
    customer,
    payment,
  }: {
    documentType: DocumentType;
    customer?: CustomerInfo;
    payment: PaymentBreakdown;
  }) => {
    if (isDemoMode) {
      showToast('Modo Demo (solo lectura): no podés registrar ventas.', 'warn');
      return;
    }
    if (!currentUser || !activeShift || cart.length === 0) return;

    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    let total = 0;

    const saleItems = cart.map((item) => {
      const raw = item.unitPrice * item.quantity;
      const disc = raw * (item.discountPct / 100);
      const net = Number((raw - disc).toFixed(2));
      const tax = net - net / (1 + item.taxRate / 100);
      subtotal += raw;
      discountTotal += disc;
      taxTotal += tax;
      total += net;
      return {
        productId: item.productId,
        barcode: item.barcode,
        name: item.name,
        unit: item.unit,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        quantity: item.quantity,
        discountPct: item.discountPct,
        lineTotal: net,
      };
    });

    const saleId = `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ticketNumber = `0001-${String(nextTicketSeq).padStart(8, '0')}`;
    const nowIso = new Date().toISOString();

    const sanitizedPayment: PaymentBreakdown = {
      method: payment.method,
      cashAmount: Number(payment.cashAmount) || 0,
      cardAmount: Number(payment.cardAmount) || 0,
      transferAmount: Number(payment.transferAmount) || 0,
      cashTendered: Number(payment.cashTendered) || 0,
      changeGiven: Number(payment.changeGiven) || 0,
    };
    if (payment.reference && payment.reference.trim()) {
      sanitizedPayment.reference = payment.reference.trim().slice(0, 80);
    }

    const sanitizedCustomer: CustomerInfo | undefined = customer
      ? {
          name: (customer.name || 'Consumidor Final').trim().slice(0, 120),
          taxId: (customer.taxId || '').trim().slice(0, 40),
          ...(customer.address?.trim()
            ? { address: customer.address.trim().slice(0, 160) }
            : {}),
        }
      : undefined;

    const newSale: Sale = {
      id: saleId,
      ticketNumber,
      shiftId: activeShift.id,
      timestamp: nowIso,
      cashier: (currentUser.fullName || currentUser.username || 'Cajero').slice(0, 120),
      documentType,
      customer: sanitizedCustomer,
      items: saleItems,
      subtotal: Number(subtotal.toFixed(2)),
      discountTotal: Number(discountTotal.toFixed(2)),
      taxTotal: Number(taxTotal.toFixed(2)),
      total: Number(total.toFixed(2)),
      payment: sanitizedPayment,
      status: 'completada',
    };

    const saleDocPayload: Record<string, unknown> = {
      id: newSale.id,
      storeId: activeStoreId,
      ticketNumber: newSale.ticketNumber,
      shiftId: newSale.shiftId,
      timestamp: newSale.timestamp,
      cashier: newSale.cashier,
      cashierUid: currentUser.uid,
      documentType: newSale.documentType,
      items: newSale.items,
      subtotal: newSale.subtotal,
      discountTotal: newSale.discountTotal,
      taxTotal: newSale.taxTotal,
      total: newSale.total,
      payment: sanitizedPayment,
      status: 'completada',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (sanitizedCustomer) {
      saleDocPayload.customer = sanitizedCustomer;
    }

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'sales', newSale.id), saleDocPayload);

      for (const sold of saleItems) {
        const prod = products.find((p) => p.id === sold.productId);
        if (!prod) continue;
        const nextStock = Math.max(0, Number((prod.stock - sold.quantity).toFixed(3)));
        batch.update(doc(db, 'products', prod.id), {
          stock: nextStock,
          updatedByUid: currentUser.uid,
          updatedAt: serverTimestamp(),
        });
        const smId = `sm-${Date.now()}-${prod.id}`;
        batch.set(doc(db, 'stockMovements', smId), {
          id: smId,
          storeId: activeStoreId,
          productId: prod.id,
          productName: prod.name.slice(0, 160),
          timestamp: nowIso,
          type: 'venta',
          delta: -sold.quantity,
          resultingStock: nextStock,
          note: `${documentType} ${ticketNumber}`.slice(0, 200),
          actorUid: currentUser.uid,
          createdAt: serverTimestamp(),
        });
      }

      const ticketSeqDocId = getStoreSettingDocId(activeStoreId, 'ticketSeq');
      batch.set(doc(db, 'settings', ticketSeqDocId), {
        id: ticketSeqDocId,
        storeId: activeStoreId,
        data: { nextTicketSeq: nextTicketSeq + 1 },
        updatedByUid: currentUser.uid,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
    } catch (err) {
      showToast('Error al registrar la venta o descontar el stock', 'err');
      handleFirestoreError(err, OperationType.WRITE, `sales/${saleId}`);
    }

    setCart([]);
    setScaleWeight(0);
    setReceiptSale(newSale);
    showToast(`${documentType} ${ticketNumber} emitido correctamente`, 'ok');

    const shouldKickDrawer =
      hardwareConfig.drawerTrigger === 'all_sales' ||
      (hardwareConfig.drawerTrigger === 'cash_only' && payment.cashAmount > 0);

    if (printerPortRef.current && hardwareConfig.printerMode === 'escpos_serial') {
      if (hardwareConfig.autoPrintOnSale) {
        printSaleSerial(newSale, shouldKickDrawer);
      } else if (shouldKickDrawer) {
        triggerCashDrawer();
      }
    } else {
      if (shouldKickDrawer) playDrawerChime();
      if (hardwareConfig.autoPrintOnSale && hardwareConfig.printerMode === 'browser_80mm') {
        window.setTimeout(() => window.print(), 250);
      }
    }
  };

  const handleVoidSale = async (saleId: string) => {
    if (isDemoMode) {
      showToast('Modo Demo (solo lectura): no podés anular comprobantes.', 'warn');
      return;
    }
    if (!currentUser) return;
    const target = sales.find((s) => s.id === saleId);
    if (!target || target.status === 'anulada') return;
    const nowIso = new Date().toISOString();

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'sales', saleId), {
        status: 'anulada',
        updatedAt: serverTimestamp(),
      });

      for (const item of target.items) {
        const prod = products.find((p) => p.id === item.productId);
        if (!prod) continue;
        const nextStock = Number((prod.stock + item.quantity).toFixed(3));
        batch.update(doc(db, 'products', prod.id), {
          stock: nextStock,
          updatedByUid: currentUser.uid,
          updatedAt: serverTimestamp(),
        });
        const smId = `sm-${Date.now()}-${prod.id}-void`;
        batch.set(doc(db, 'stockMovements', smId), {
          id: smId,
          storeId: activeStoreId,
          productId: prod.id,
          productName: prod.name.slice(0, 160),
          timestamp: nowIso,
          type: 'anulacion',
          delta: item.quantity,
          resultingStock: nextStock,
          note: `Anulación ${target.ticketNumber}`.slice(0, 200),
          actorUid: currentUser.uid,
          createdAt: serverTimestamp(),
        });
      }

      await batch.commit();
      showToast(`Comprobante ${target.ticketNumber} anulado y stock reintegrado`, 'warn');
    } catch (err) {
      showToast('No se pudo anular el comprobante. Verificá tus permisos.', 'err');
      handleFirestoreError(err, OperationType.UPDATE, `sales/${saleId}`);
    }
  };

  const handleOpenShift = async ({
    registerName,
    cashier,
    openingFloat,
  }: {
    registerName: string;
    cashier: string;
    openingFloat: number;
  }) => {
    if (isDemoMode) {
      showToast('Modo Demo (solo lectura): no podés abrir turnos.', 'warn');
      return;
    }
    if (!currentUser) return;
    const id = `turno-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      await setDoc(doc(db, 'shifts', id), {
        id,
        storeId: activeStoreId,
        registerName: registerName.slice(0, 60),
        cashier: cashier.slice(0, 120),
        openedByUid: currentUser.uid,
        openedAt: new Date().toISOString(),
        openingFloat,
        status: 'abierto',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast(`Turno abierto en ${registerName} (${cashier})`, 'ok');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `shifts/${id}`);
    }
  };

  const handleCloseShift = async ({
    countedCash,
    notes,
  }: {
    countedCash: number;
    notes: string;
  }) => {
    if (isDemoMode) {
      showToast('Modo Demo (solo lectura): no podés cerrar turnos.', 'warn');
      return;
    }
    if (!activeShift) return;
    const shiftSales = sales.filter(
      (s) => s.shiftId === activeShift.id && s.status === 'completada'
    );
    const shiftMovements = cashMovements.filter((m) => m.shiftId === activeShift.id);

    const cashSales = shiftSales.reduce((acc, s) => acc + s.payment.cashAmount, 0);
    const cashIn = shiftMovements
      .filter((m) => m.type === 'ingreso')
      .reduce((acc, m) => acc + m.amount, 0);
    const cashOut = shiftMovements
      .filter((m) => m.type === 'retiro')
      .reduce((acc, m) => acc + m.amount, 0);

    const expectedCash = Number((activeShift.openingFloat + cashSales + cashIn - cashOut).toFixed(2));
    try {
      await updateDoc(doc(db, 'shifts', activeShift.id), {
        status: 'cerrado',
        closedAt: new Date().toISOString(),
        expectedCash,
        countedCash,
        difference: Number((countedCash - expectedCash).toFixed(2)),
        notes: notes.slice(0, 300),
        updatedAt: serverTimestamp(),
      });
      showToast('Turno cerrado y arqueo Z guardado', 'ok');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shifts/${activeShift.id}`);
    }
  };

  const handleAddCashMovement = async ({
    type,
    amount,
    reason,
  }: {
    type: 'ingreso' | 'retiro';
    amount: number;
    reason: string;
  }) => {
    if (isDemoMode) {
      showToast('Modo Demo (solo lectura): no podés registrar movimientos de caja.', 'warn');
      return;
    }
    if (!activeShift || !currentUser) return;
    const id = `cm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      await setDoc(doc(db, 'cashMovements', id), {
        id,
        storeId: activeStoreId,
        shiftId: activeShift.id,
        timestamp: new Date().toISOString(),
        type,
        amount,
        reason: reason.slice(0, 200),
        operator: currentUser.fullName.slice(0, 120),
        operatorUid: currentUser.uid,
        createdAt: serverTimestamp(),
      });
      showToast(
        `${type === 'ingreso' ? 'Ingreso' : 'Retiro'} de ${formatCurrency(amount, store.currencySymbol)} registrado`,
        'ok'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `cashMovements/${id}`);
    }
  };

  const handleSaveProduct = async (product: Product, isNew: boolean) => {
    if (isDemoMode) {
      showToast('Modo Demo (solo lectura): no podés modificar el catálogo.', 'warn');
      return;
    }
    if (!currentUser) return;
    try {
      if (isNew) {
        await setDoc(
          doc(db, 'products', product.id),
          serializeProductDoc(product, currentUser.uid, true, activeStoreId)
        );
      } else {
        const updatePayload = serializeProductDoc(product, currentUser.uid, false, activeStoreId);
        delete updatePayload.id;
        delete updatePayload.storeId;
        await updateDoc(doc(db, 'products', product.id), updatePayload);
      }
      showToast(isNew ? `Producto "${product.name}" agregado` : 'Producto actualizado', 'ok');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `products/${product.id}`);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (isDemoMode) {
      showToast('Modo Demo (solo lectura): no podés eliminar productos.', 'warn');
      return;
    }
    try {
      await deleteDoc(doc(db, 'products', productId));
      setCart((prev) => prev.filter((c) => c.productId !== productId));
      showToast('Producto eliminado del catálogo', 'warn');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
    }
  };

  const handleSaveSupplier = async (supplier: Supplier, isNew: boolean) => {
    if (isDemoMode) {
      showToast('Modo Demo (solo lectura): no podés modificar proveedores.', 'warn');
      return;
    }
    if (!currentUser) return;
    try {
      if (isNew) {
        await setDoc(
          doc(db, 'suppliers', supplier.id),
          serializeSupplierDoc(supplier, currentUser.uid, true, activeStoreId)
        );
      } else {
        const updatePayload = serializeSupplierDoc(supplier, currentUser.uid, false, activeStoreId);
        delete updatePayload.id;
        delete updatePayload.storeId;
        await updateDoc(doc(db, 'suppliers', supplier.id), updatePayload);
      }
      showToast(
        isNew ? `Proveedor "${supplier.name}" registrado` : 'Proveedor actualizado',
        'ok'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `suppliers/${supplier.id}`);
    }
  };

  const handleQuickCreateSupplier = async (name: string): Promise<Supplier | null> => {
    if (isDemoMode || !currentUser) return null;
    const cleanName = name.trim().slice(0, 120);
    if (!cleanName) return null;
    const newSup: Supplier = {
      id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
    };
    try {
      await setDoc(
        doc(db, 'suppliers', newSup.id),
        serializeSupplierDoc(newSup, currentUser.uid, true, activeStoreId)
      );
      showToast(`Proveedor "${cleanName}" agregado`, 'ok');
      return newSup;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `suppliers/${newSup.id}`);
      return null;
    }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    if (isDemoMode) {
      showToast('Modo Demo (solo lectura): no podés eliminar proveedores.', 'warn');
      return;
    }
    try {
      await deleteDoc(doc(db, 'suppliers', supplierId));
      showToast('Proveedor eliminado del directorio', 'warn');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `suppliers/${supplierId}`);
    }
  };

  const handleSavePricing = async (next: AppPricingConfig) => {
    if (isDemoMode || !currentUser || currentUser.role !== 'super_admin') {
      showToast('Solo el Administrador General puede modificar los precios.', 'warn');
      return;
    }
    const payload: Record<string, unknown> = {
      id: 'pricing',
      paymentPhone: (next.paymentPhone || '+595-975635770').trim().slice(0, 60),
      currencySymbol: (next.currencySymbol || 'Gs.').trim().slice(0, 12) || 'Gs.',
      monthlyPrice: Math.max(0, Number(next.monthlyPrice) || 0),
      monthlyNote: (next.monthlyNote || '').trim().slice(0, 160),
      semiannualPrice: Math.max(0, Number(next.semiannualPrice) || 0),
      semiannualNote: (next.semiannualNote || '').trim().slice(0, 160),
      annualPrice: Math.max(0, Number(next.annualPrice) || 0),
      annualNote: (next.annualNote || '').trim().slice(0, 160),
      updatedByUid: currentUser.uid,
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, 'appConfig', 'pricing'), payload);
      showToast('Precios de la app actualizados correctamente', 'ok');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'appConfig/pricing');
    }
  };

  const handleAdjustStock = async ({
    productId,
    type,
    quantityDelta,
    note,
    newExpiryDate,
    newBatchCode,
  }: {
    productId: string;
    type: 'ingreso' | 'merma' | 'ajuste';
    quantityDelta: number;
    note: string;
    newExpiryDate?: string;
    newBatchCode?: string;
  }) => {
    if (isDemoMode) {
      showToast('Modo Demo (solo lectura): no podés ajustar el stock.', 'warn');
      return;
    }
    if (!currentUser) return;
    const target = products.find((p) => p.id === productId);
    if (!target) return;
    const nextStock = Math.max(0, Number((target.stock + quantityDelta).toFixed(3)));
    const smId = `sm-${Date.now()}`;

    const prodUpdate: Record<string, unknown> = {
      stock: nextStock,
      updatedByUid: currentUser.uid,
      updatedAt: serverTimestamp(),
    };
    if (newExpiryDate) prodUpdate.expiryDate = newExpiryDate.slice(0, 20);
    if (newBatchCode) prodUpdate.batchCode = newBatchCode.slice(0, 40);

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'products', productId), prodUpdate);
      batch.set(doc(db, 'stockMovements', smId), {
        id: smId,
        storeId: activeStoreId,
        productId: target.id,
        productName: target.name.slice(0, 160),
        timestamp: new Date().toISOString(),
        type,
        delta: quantityDelta,
        resultingStock: nextStock,
        note: note.slice(0, 200),
        actorUid: currentUser.uid,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      showToast(`Stock actualizado: ${target.name} (${nextStock} ${target.unit})`, 'ok');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `products/${productId}`);
    }
  };

  const categories = useMemo(() => {
    const merged: string[] = [];
    const seen = new Set<string>();
    for (const c of [...customCategories, ...products.map((p) => p.category)]) {
      const clean = c.trim().slice(0, 40);
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(clean);
      }
    }
    return (merged.length > 0 ? merged : DEFAULT_PRODUCT_CATEGORIES).slice(0, 60);
  }, [customCategories, products]);

  const handleSaveCategories = async (nextCategories: string[]) => {
    if (isDemoMode) {
      showToast('Modo Demo (solo lectura): no podés editar categorías.', 'warn');
      return;
    }
    const seen = new Set<string>();
    const clean: string[] = [];
    for (const raw of nextCategories) {
      const item = raw.trim().slice(0, 40);
      if (!item) continue;
      const key = item.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        clean.push(item);
      }
    }
    const finalItems = (clean.length > 0 ? clean : ['Almacén']).slice(0, 60);
    setCustomCategories(finalItems);
    if (!currentUser) return;
    const categoriesDocId = getStoreSettingDocId(activeStoreId, 'categories');
    try {
      await setDoc(doc(db, 'settings', categoriesDocId), {
        id: categoriesDocId,
        storeId: activeStoreId,
        data: { items: finalItems },
        updatedByUid: currentUser.uid,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `settings/${categoriesDocId}`);
    }
  };

  const handleUpdateHardwareConfig = async (next: HardwareConfig) => {
    if (isDemoMode) {
      showToast('Modo Demo (solo lectura): no podés modificar equipos.', 'warn');
      return;
    }
    setHardwareConfig(next);
    if (!currentUser) return;
    const hardwareDocId = getStoreSettingDocId(activeStoreId, 'hardware');
    try {
      await setDoc(doc(db, 'settings', hardwareDocId), {
        id: hardwareDocId,
        storeId: activeStoreId,
        data: next,
        updatedByUid: currentUser.uid,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `settings/${hardwareDocId}`);
    }
  };

  const handleUpdateStore = async (next: StoreSettings) => {
    if (isDemoMode) {
      showToast('Modo Demo (solo lectura): no podés modificar datos del comercio.', 'warn');
      return;
    }
    const clean = sanitizeStoreSettings(next);
    setStore(clean);
    if (!currentUser) return;
    const storeDocId = getStoreSettingDocId(activeStoreId, 'store');
    try {
      await setDoc(doc(db, 'settings', storeDocId), {
        id: storeDocId,
        storeId: activeStoreId,
        data: clean,
        updatedByUid: currentUser.uid,
        updatedAt: serverTimestamp(),
      });
      showToast('Datos del comercio guardados correctamente', 'ok');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `settings/${storeDocId}`);
    }
  };

  // --- Staff Management (Admin -> Gerente/Cajero/Depositero, Gerente -> Cajero/Depositero propio) ---
  const handleCreateStaff = async ({
    fullName,
    username,
    password,
    role,
    jobTitle,
    assignedManagerUid,
    permissions,
  }: {
    fullName: string;
    username: string;
    password: string;
    role: 'manager' | 'cashier' | 'warehouse';
    jobTitle?: string;
    assignedManagerUid?: string;
    permissions: StaffPermissions;
  }) => {
    if (isDemoMode || !currentUser) return;
    const cleanUsername = sanitizeStaffUsername(username);
    const email = normalizeStaffEmail(cleanUsername);
    const newUid = await createStaffAuthAccount(email, password);
    const cleanJobTitle = (jobTitle || '').trim().slice(0, 60);

    const profilePayload: Record<string, unknown> = {
      uid: newUid,
      username: cleanUsername.slice(0, 80),
      email: email.slice(0, 160),
      fullName: fullName.slice(0, 120),
      role,
      active: true,
      permissions,
      createdByUid: currentUser.uid,
      createdByRole: currentUser.role === 'super_admin' ? 'super_admin' : 'manager',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (cleanJobTitle) {
      profilePayload.jobTitle = cleanJobTitle;
    }
    if (currentUser.role === 'manager' && (role === 'cashier' || role === 'warehouse')) {
      profilePayload.assignedManagerUid = currentUser.uid;
    } else if (
      currentUser.role === 'super_admin' &&
      (role === 'cashier' || role === 'warehouse') &&
      assignedManagerUid?.trim()
    ) {
      profilePayload.assignedManagerUid = assignedManagerUid.trim().slice(0, 128);
    }

    try {
      await setDoc(doc(db, 'staff', newUid), profilePayload);
      await setDoc(doc(db, 'staff', newUid, 'credentials', 'access'), {
        uid: newUid,
        accessKey: password.slice(0, 128),
        updatedByUid: currentUser.uid,
        updatedAt: serverTimestamp(),
      });
      showToast(`Cuenta creada para ${fullName} (usuario: ${cleanUsername})`, 'ok');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `staff/${newUid}`);
    }
  };

  const handleUpdateStaff = async (
    uid: string,
    updates: {
      fullName: string;
      active: boolean;
      permissions: StaffPermissions;
      role: StaffProfile['role'];
      jobTitle?: string;
      assignedManagerUid?: string;
      currentPassword?: string;
      newPassword?: string;
    }
  ) => {
    if (isDemoMode || !currentUser) return;
    const target = staffList.find((s) => s.uid === uid);

    if (updates.newPassword && updates.newPassword.trim().length > 0) {
      const nextPwd = updates.newPassword;
      if (nextPwd.length < 6) {
        throw new Error('PASSWORD_TOO_SHORT');
      }
      if (!target) {
        throw new Error('STAFF_NOT_FOUND');
      }
      const oldPwd = updates.currentPassword?.trim() || staffKeys[uid] || '';
      if (!oldPwd) {
        throw new Error('MISSING_CURRENT_PASSWORD');
      }

      await updateStaffAuthPassword(target.email, oldPwd, nextPwd);
      await setDoc(doc(db, 'staff', uid, 'credentials', 'access'), {
        uid,
        accessKey: nextPwd.slice(0, 128),
        updatedByUid: currentUser.uid,
        updatedAt: serverTimestamp(),
      });
    }

    const updatePayload: Record<string, unknown> = {
      fullName: updates.fullName.slice(0, 120),
      active: updates.active,
      role: updates.role,
      jobTitle: (updates.jobTitle || '').trim().slice(0, 60),
      permissions: updates.permissions,
      updatedAt: serverTimestamp(),
    };

    if (currentUser.role === 'super_admin' && (updates.role === 'cashier' || updates.role === 'warehouse')) {
      if (updates.assignedManagerUid?.trim()) {
        updatePayload.assignedManagerUid = updates.assignedManagerUid.trim().slice(0, 128);
      } else if (target?.assignedManagerUid) {
        updatePayload.assignedManagerUid = '';
      }
    }

    try {
      await updateDoc(doc(db, 'staff', uid), updatePayload);
      showToast(
        updates.newPassword?.trim()
          ? 'Datos, clave de acceso y permisos actualizados'
          : 'Permisos de personal actualizados',
        'ok'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `staff/${uid}`);
    }
  };

  const handleDeleteStaff = async (staff: StaffProfile) => {
    if (isDemoMode) return;
    const knownKey = staffKeys[staff.uid];
    try {
      await deleteDoc(doc(db, 'staff', staff.uid, 'credentials', 'access')).catch(() => {});
      await deleteDoc(doc(db, 'staff', staff.uid));
      if (knownKey) {
        await deleteStaffAuthAccount(staff.email, knownKey).catch(() => {});
      }
      showToast(`Acceso revocado para ${staff.fullName}`, 'warn');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `staff/${staff.uid}`);
    }
  };

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-amber-50/40 text-xs text-emerald-900">
        Verificando sesión y permisos...
      </div>
    );
  }

  if (!isDemoMode && (!firebaseUser || !currentUser)) {
    return <LoginScreen externalError={authError} onEnterDemoMode={enterDemoMode} />;
  }

  if (!currentUser) {
    return <LoginScreen externalError={authError} onEnterDemoMode={enterDemoMode} />;
  }

  const roleBadgeLabel =
    currentUser.jobTitle?.trim() ||
    (currentUser.role === 'super_admin'
      ? 'Administrador General'
      : currentUser.role === 'manager'
        ? 'Gerente'
        : currentUser.role === 'warehouse'
          ? 'Depositero / Stock'
          : 'Personal de Caja');

  const normalizedStoreName = store.storeName?.trim().toLowerCase() || '';
  const hasCustomBranchName =
    Boolean(store.storeName?.trim()) &&
    normalizedStoreName !== 'mini market' &&
    normalizedStoreName !== 'mini market py';
  const commercialNameLine = hasCustomBranchName ? store.storeName.trim() : '';
  const legalBusinessLine = [
    store.legalName?.trim() || (!commercialNameLine ? store.storeName.trim() : ''),
    store.taxId?.trim() ? `RUC: ${store.taxId.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="relative flex min-h-screen flex-col bg-amber-50/35 text-stone-900 lg:h-screen lg:overflow-hidden">
      <img
        src={
          store.bannerUrl ||
          '/src/assets/images/minimarket_store_backdrop_1795272439135.jpg'
        }
        alt="Fondo de Mini Market"
        referrerPolicy="no-referrer"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-amber-50/75"
        aria-hidden="true"
      />

      {/* Top Horizontal Banner (White Background) */}
      <header className="relative z-20 shrink-0 border-b border-amber-200 bg-white text-stone-900 shadow-xs">
        <div className="flex min-h-[58px] items-center justify-between gap-3 px-4 py-2 lg:px-6">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src={store.logoUrl || '/assets/aistudio/logoMiniMarket_f519c49e.jpg'}
              alt={store.storeName}
              referrerPolicy="no-referrer"
              className="h-16 w-auto max-w-[180px] shrink-0 object-contain sm:h-20 sm:max-w-[220px] xl:h-24 xl:max-w-[260px]"
            />
            <div className="min-w-0">
              <h1 className="truncate font-display text-3xl font-extrabold leading-none tracking-tight sm:text-4xl xl:text-5xl">
                <span className="text-emerald-700">Mini</span>{' '}
                <span className="text-orange-600">Market Py</span>
              </h1>
              <div className="mt-1.5 space-y-0.5 text-[11px] leading-tight text-stone-600 sm:text-xs">
                {commercialNameLine && (
                  <p className="truncate font-semibold text-emerald-950">{commercialNameLine}</p>
                )}
                {legalBusinessLine && (
                  <p className="truncate font-medium text-emerald-950">{legalBusinessLine}</p>
                )}
                {store.address?.trim() && (
                  <p className="truncate text-stone-600">{store.address.trim()}</p>
                )}
                {store.phone?.trim() && (
                  <p className="truncate font-mono text-stone-600">{store.phone.trim()}</p>
                )}
              </div>
            </div>
          </div>

          {store.topBannerUrl && (
            <div className="hidden lg:flex flex-1 min-w-0 items-center justify-center px-2">
              <div className="flex h-[150px] w-full max-w-[820px] items-center justify-center overflow-hidden bg-white xl:h-[160px]">
                <img
                  src={store.topBannerUrl}
                  alt={`Banner superior de ${store.storeName}`}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {isDemoMode && (
              <span className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-950">
                Modo Demo · Solo lectura
              </span>
            )}
            <div
              className={`hidden items-center gap-2 text-xs text-stone-500 ${
                store.topBannerUrl ? '2xl:flex' : 'md:flex'
              }`}
            >
              <span className="font-semibold text-emerald-950 truncate max-w-[160px]">
                {currentUser.fullName}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-stone-600">{roleBadgeLabel}</span>
              <span aria-hidden="true">·</span>
              <span
                className={`font-medium ${
                  activeShift ? 'text-emerald-700' : 'text-orange-600'
                }`}
              >
                {activeShift ? activeShift.registerName : 'Caja cerrada'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('cash')}
              className={`whitespace-nowrap shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                activeShift
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                  : 'border-amber-400 bg-amber-300 text-emerald-950 hover:bg-amber-200'
              }`}
            >
              {activeShift ? 'Gestionar Caja' : 'Abrir Turno'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (isDemoMode) {
                  exitDemoMode();
                } else {
                  signOut(auth);
                }
              }}
              title={isDemoMode ? 'Salir de Demo' : 'Cerrar sesión'}
              className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm font-semibold text-stone-700 transition-colors hover:bg-amber-50 hover:text-emerald-950"
            >
              <LogOut className="h-4 w-4 text-orange-600" />
              <span className="hidden sm:inline">
                {isDemoMode ? 'Salir de Demo' : 'Cerrar sesión'}
              </span>
            </button>
          </div>
        </div>

        {store.topBannerUrl && (
          <div className="px-4 pb-2 lg:hidden">
            <div className="mx-auto flex h-[130px] w-full max-w-[820px] items-center justify-center overflow-hidden bg-white sm:h-[150px]">
              <img
                src={store.topBannerUrl}
                alt={`Banner superior de ${store.storeName}`}
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        )}
      </header>

      {/* Top Horizontal Navigation Bar below the Banner */}
      <nav
        aria-label="Navegación principal"
        className="relative z-10 shrink-0 border-b border-amber-200/90 bg-white/95 backdrop-blur-xs"
      >
        <div className="px-4 py-2.5 lg:px-6">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'text-emerald-950 hover:bg-amber-100/80 hover:text-orange-700'
                  }`}
                >
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 ${
                      active ? 'text-amber-200' : 'text-emerald-700'
                    }`}
                  />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`font-mono text-xs font-bold tabular-nums ${
                        active ? 'text-amber-100' : 'text-orange-600'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content Area (no z-index stacking context so modals overlay the header cleanly) */}
      <main
        className={`relative flex-1 p-4 lg:p-5 ${
          activeTab === 'pos'
            ? 'lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden'
            : 'lg:overflow-y-auto'
        }`}
      >
          {activeTab === 'pos' && currentUser.permissions.operatePos && (
            <PosTerminal
              products={products}
              categories={categories}
              cart={cart}
              activeShift={activeShift}
              store={store}
              scaleWeight={scaleWeight}
              scaleConnected={scaleConnected}
              canApplyDiscounts={!isDemoMode && currentUser.permissions.applyDiscounts}
              readOnly={isDemoMode}
              onSetScaleWeight={setScaleWeight}
              onAddProduct={addProductToCart}
              onUpdateQuantity={(productId, newQty) => {
                if (newQty <= 0) {
                  setCart((prev) => prev.filter((i) => i.productId !== productId));
                  return;
                }
                const prod = products.find((p) => p.id === productId);
                if (prod && newQty > prod.stock) {
                  showToast(`Stock disponible: ${prod.stock} ${prod.unit}`, 'warn');
                  return;
                }
                setCart((prev) =>
                  prev.map((i) => (i.productId === productId ? { ...i, quantity: newQty } : i))
                );
              }}
              onUpdateDiscount={(productId, discountPct) => {
                if (isDemoMode || !currentUser.permissions.applyDiscounts) return;
                setCart((prev) =>
                  prev.map((i) => (i.productId === productId ? { ...i, discountPct } : i))
                );
              }}
              onRemoveItem={(productId) =>
                setCart((prev) => prev.filter((i) => i.productId !== productId))
              }
              onClearCart={() => setCart([])}
              onBarcodeSubmit={(code) => handleBarcodeScanned(code, 'buscador')}
              onCompleteSale={handleCompleteSale}
              onRequestOpenShift={() => setActiveTab('cash')}
            />
          )}

          {activeTab === 'sales' &&
            (currentUser.permissions.operatePos ||
              currentUser.permissions.manageCash ||
              currentUser.permissions.voidSales ||
              currentUser.role === 'super_admin' ||
              currentUser.role === 'manager') && (
              <SalesHistory
                sales={sales}
                shifts={[...(activeShift ? [activeShift] : []), ...closedShifts]}
                activeShift={activeShift}
                store={store}
                canVoidSales={!isDemoMode && currentUser.permissions.voidSales}
                onViewReceipt={(sale) => setReceiptSale(sale)}
                onVoidSale={handleVoidSale}
                onOpenCashTab={() => setActiveTab('cash')}
              />
            )}

          {activeTab === 'inventory' &&
            (currentUser.permissions.viewInventory || currentUser.permissions.manageInventory) && (
              <InventoryManager
                products={products}
                categories={categories}
                suppliers={suppliers}
                stockMovements={stockMovements}
                store={store}
                canManageInventory={!isDemoMode && currentUser.permissions.manageInventory}
                onSaveProduct={handleSaveProduct}
                onDeleteProduct={handleDeleteProduct}
                onAdjustStock={handleAdjustStock}
                onSaveCategories={handleSaveCategories}
                onQuickCreateSupplier={isDemoMode ? undefined : handleQuickCreateSupplier}
              />
            )}

          {activeTab === 'suppliers' &&
            (currentUser.permissions.viewInventory ||
              currentUser.permissions.manageInventory ||
              isDemoMode) && (
              <SuppliersManager
                suppliers={suppliers}
                products={products}
                canManageSuppliers={!isDemoMode && currentUser.permissions.manageInventory}
                onSaveSupplier={handleSaveSupplier}
                onDeleteSupplier={handleDeleteSupplier}
              />
            )}

          {activeTab === 'cash' &&
            (currentUser.permissions.manageCash || currentUser.permissions.operatePos) && (
              <CashRegister
                key={isDemoMode ? 'demo' : activeStoreId}
                activeShift={activeShift}
                closedShifts={closedShifts}
                sales={sales}
                cashMovements={cashMovements}
                store={store}
                defaultCashierName={currentUser.fullName}
                canManageCash={!isDemoMode && currentUser.permissions.manageCash}
                canVoidSales={!isDemoMode && currentUser.permissions.voidSales}
                onOpenShift={handleOpenShift}
                onCloseShift={handleCloseShift}
                onAddCashMovement={handleAddCashMovement}
                onViewReceipt={(sale) => setReceiptSale(sale)}
                onVoidSale={handleVoidSale}
                onOpenDrawerTest={triggerCashDrawer}
                onViewAllSales={() => setActiveTab('sales')}
              />
            )}

          {activeTab === 'hardware' && currentUser.permissions.manageHardware && (
            <HardwareCenter
              config={hardwareConfig}
              store={store}
              scannerConnected={scannerConnected}
              printerConnected={printerConnected}
              scaleConnected={scaleConnected}
              scaleWeight={scaleWeight}
              scanLogs={scanLogs}
              readOnly={isDemoMode}
              onUpdateConfig={handleUpdateHardwareConfig}
              onOpenStoreSettings={() => setActiveTab('store')}
              onConnectScanner={handleConnectScanner}
              onDisconnectScanner={handleDisconnectScanner}
              onVerifyHidScanner={handleVerifyHidScanner}
              onConnectPrinter={handleConnectPrinter}
              onDisconnectPrinter={handleDisconnectPrinter}
              onConnectScale={handleConnectScale}
              onDisconnectScale={handleDisconnectScale}
              onSetScaleWeight={setScaleWeight}
              onTestScan={(code) => handleBarcodeScanned(code, 'teclado_hid')}
              onTestPrint={() => {
                const sampleSale = sales[0];
                if (sampleSale) setReceiptSale(sampleSale);
              }}
              onTestDrawer={triggerCashDrawer}
            />
          )}

          {activeTab === 'store' &&
            (currentUser.role === 'super_admin' ||
              currentUser.role === 'manager' ||
              currentUser.permissions.manageHardware) && (
              <StoreProfileEditor
                store={store}
                readOnly={isDemoMode}
                onSaveStore={handleUpdateStore}
              />
            )}

          {activeTab === 'admin' &&
            (currentUser.role === 'super_admin' ||
              (currentUser.role === 'manager' && currentUser.permissions.manageCashiers)) && (
              <AdminPanel
                currentUser={currentUser}
                staffList={staffList}
                staffKeys={staffKeys}
                pricing={appPricing}
                readOnly={isDemoMode}
                onSavePricing={handleSavePricing}
                onCreateStaff={handleCreateStaff}
                onUpdateStaff={handleUpdateStaff}
                onDeleteStaff={handleDeleteStaff}
              />
            )}

          {activeTab === 'pricing' && (
            <PricingPanel
              pricing={appPricing}
              canEditPricing={!isDemoMode && currentUser.role === 'super_admin'}
              isDemoMode={isDemoMode}
              onSavePricing={handleSavePricing}
            />
          )}
      </main>

      {/* Receipt Preview & Thermal Print Modal */}
      <ReceiptModal
        sale={receiptSale}
        store={store}
        printerConnected={printerConnected}
        onPrintSerial={(sale) => printSaleSerial(sale, false)}
        onClose={() => setReceiptSale(null)}
      />

      {/* Non-intrusive Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 right-4 z-50 rounded-xl border px-4 py-2.5 text-xs font-semibold shadow-lg ${
            toast.tone === 'err'
              ? 'border-red-700 bg-red-600 text-white'
              : toast.tone === 'warn'
                ? 'border-orange-500 bg-orange-500 text-white'
                : 'border-emerald-800 bg-emerald-800 text-amber-200'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
