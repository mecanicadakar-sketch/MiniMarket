import { deleteApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const STORE_ID = 'minimarket-principal';
export const SUPER_ADMIN_EMAIL = 'mecanicadakar@gmail.com';
export const INTERNAL_STAFF_DOMAIN = '@minimarket.local';

export function getStoreIdForStaff(profile: {
  uid: string;
  role: 'super_admin' | 'manager' | 'cashier' | 'warehouse';
  assignedManagerUid?: string;
}): string {
  if (profile.role === 'super_admin') {
    return STORE_ID;
  }
  if (profile.role === 'manager') {
    return `mgr-${profile.uid}`.slice(0, 64);
  }
  if (profile.assignedManagerUid && profile.assignedManagerUid.trim()) {
    return `mgr-${profile.assignedManagerUid.trim()}`.slice(0, 64);
  }
  return STORE_ID;
}

export function getStoreSettingDocId(
  storeId: string,
  settingKey: 'store' | 'hardware' | 'categories' | 'ticketSeq'
): string {
  if (storeId === STORE_ID) {
    return settingKey;
  }
  return `${storeId}__${settingKey}`.slice(0, 64);
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export function sanitizeStaffUsername(usernameOrEmail: string): string {
  const trimmed = usernameOrEmail.trim().toLowerCase().replace(/\s+/g, '');
  if (trimmed.endsWith(INTERNAL_STAFF_DOMAIN)) {
    return trimmed.slice(0, -INTERNAL_STAFF_DOMAIN.length);
  }
  if (trimmed.includes('@')) return trimmed;
  return trimmed.replace(/[^a-z0-9._-]/g, '');
}

export function isInternalStaffEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(INTERNAL_STAFF_DOMAIN);
}

export function normalizeStaffEmail(usernameOrEmail: string): string {
  const trimmed = usernameOrEmail.trim().toLowerCase().replace(/\s+/g, '');
  if (trimmed.includes('@')) return trimmed;
  const sanitized = trimmed.replace(/[^a-z0-9._-]/g, '');
  return `${sanitized}${INTERNAL_STAFF_DOMAIN}`;
}

/**
 * Provisions a new Firebase Auth Email/Password user on an isolated secondary
 * Firebase app instance so the active Admin or Manager session is never replaced.
 */
export async function createStaffAuthAccount(
  email: string,
  password: string
): Promise<string> {
  const appName = `staff-provisioner-${Date.now()}`;
  const existing = getApps().find((a) => a.name === appName);
  const secondaryApp = existing || initializeApp(firebaseConfig, appName);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    await setPersistence(secondaryAuth, inMemoryPersistence);
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = credential.user.uid;
    await signOut(secondaryAuth);
    return uid;
  } finally {
    await deleteApp(secondaryApp).catch(() => {});
  }
}

/**
 * Updates a staff member's Firebase Auth password using an isolated secondary
 * Firebase app instance so the Admin or Manager session stays intact.
 */
export async function updateStaffAuthPassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const appName = `staff-pwd-updater-${Date.now()}`;
  const existing = getApps().find((a) => a.name === appName);
  const secondaryApp = existing || initializeApp(firebaseConfig, appName);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    await setPersistence(secondaryAuth, inMemoryPersistence);
    const credential = await signInWithEmailAndPassword(secondaryAuth, email, currentPassword);
    await updatePassword(credential.user, newPassword);
    await signOut(secondaryAuth);
  } finally {
    await deleteApp(secondaryApp).catch(() => {});
  }
}

/**
 * Deletes a staff member's Firebase Auth account on an isolated secondary
 * Firebase app instance so the username can be cleanly reused if needed.
 */
export async function deleteStaffAuthAccount(
  email: string,
  currentPassword: string
): Promise<void> {
  const appName = `staff-deleter-${Date.now()}`;
  const existing = getApps().find((a) => a.name === appName);
  const secondaryApp = existing || initializeApp(firebaseConfig, appName);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    await setPersistence(secondaryAuth, inMemoryPersistence);
    const credential = await signInWithEmailAndPassword(secondaryAuth, email, currentPassword);
    await deleteUser(credential.user);
  } finally {
    await deleteApp(secondaryApp).catch(() => {});
  }
}
