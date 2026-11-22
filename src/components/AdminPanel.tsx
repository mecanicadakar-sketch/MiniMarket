import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { StaffPermissions, StaffProfile, StaffRole } from '../types/pos';
import {
  isInternalStaffEmail,
  normalizeStaffEmail,
  sanitizeStaffUsername,
} from '../firebase';

interface AdminPanelProps {
  currentUser: StaffProfile;
  staffList: StaffProfile[];
  staffKeys: Record<string, string>;
  onCreateStaff: (payload: {
    fullName: string;
    username: string;
    password: string;
    role: 'manager' | 'cashier' | 'warehouse';
    jobTitle?: string;
    assignedManagerUid?: string;
    permissions: StaffPermissions;
  }) => Promise<void>;
  onUpdateStaff: (
    uid: string,
    updates: {
      fullName: string;
      active: boolean;
      permissions: StaffPermissions;
      role: StaffRole;
      jobTitle?: string;
      assignedManagerUid?: string;
      currentPassword?: string;
      newPassword?: string;
    }
  ) => Promise<void>;
  onDeleteStaff: (staff: StaffProfile) => Promise<void>;
}

const DEFAULT_MANAGER_PERMS: StaffPermissions = {
  operatePos: true,
  applyDiscounts: true,
  voidSales: true,
  manageCash: true,
  viewInventory: true,
  manageInventory: true,
  manageHardware: false,
  manageCashiers: true,
  manageManagers: false,
};

const DEFAULT_CASHIER_PERMS: StaffPermissions = {
  operatePos: true,
  applyDiscounts: false,
  voidSales: false,
  manageCash: true,
  viewInventory: true,
  manageInventory: false,
  manageHardware: false,
  manageCashiers: false,
  manageManagers: false,
};

const DEFAULT_WAREHOUSE_PERMS: StaffPermissions = {
  operatePos: false,
  applyDiscounts: false,
  voidSales: false,
  manageCash: false,
  viewInventory: true,
  manageInventory: true,
  manageHardware: false,
  manageCashiers: false,
  manageManagers: false,
};

const PERMISSION_LABELS: {
  key: keyof StaffPermissions;
  label: string;
  description: string;
  adminOnly?: boolean;
  managerOrAdmin?: boolean;
}[] = [
  {
    key: 'operatePos',
    label: 'Cobro Rápido (POS)',
    description: 'Escanear productos, pesar en balanza y emitir tickets/facturas.',
  },
  {
    key: 'applyDiscounts',
    label: 'Aplicar descuentos',
    description: 'Otorgar porcentajes de descuento sobre líneas del ticket.',
  },
  {
    key: 'voidSales',
    label: 'Anular comprobantes',
    description: 'Anular ventas emitidas y reintegrar stock al inventario.',
  },
  {
    key: 'manageCash',
    label: 'Gestión de Caja y Turnos',
    description: 'Abrir y cerrar turnos (arqueo Z), registrar ingresos y retiros.',
  },
  {
    key: 'viewInventory',
    label: 'Ver inventario y vencimientos',
    description: 'Consultar catálogo, precios y alertas de reposición.',
  },
  {
    key: 'manageInventory',
    label: 'Cargar stock y administrar productos',
    description: 'Crear/editar productos, cargar ingresos de mercadería, precios y mermas.',
  },
  {
    key: 'manageHardware',
    label: 'Configurar Equipos TPV',
    description: 'Configurar impresora ESC/POS, balanza, cajón y datos del comercio.',
  },
  {
    key: 'manageCashiers',
    label: 'Administrar personal operativo',
    description: 'Crear cuentas de cajeros o depositeros con usuario, clave y permisos.',
    managerOrAdmin: true,
  },
];

function roleDisplayName(role: StaffRole): string {
  if (role === 'super_admin') return 'Administrador General';
  if (role === 'manager') return 'Gerente';
  if (role === 'warehouse') return 'Depositero / Stock';
  return 'Personal de Caja';
}

function defaultJobTitleForRole(role: StaffRole): string {
  if (role === 'super_admin') return 'Administrador General';
  if (role === 'manager') return 'Gerente';
  if (role === 'warehouse') return 'Depositero';
  return 'Personal de Caja';
}

function generateAccessKey(length = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  staffList,
  staffKeys,
  onCreateStaff,
  onUpdateStaff,
  onDeleteStaff,
}) => {
  const isSuperAdmin = currentUser.role === 'super_admin';

  const [createOpen, setCreateOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showAuthProviderNotice, setShowAuthProviderNotice] = useState(false);

  // Table key visibility & clipboard feedback
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create form state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showCreatePwd, setShowCreatePwd] = useState(true);
  const [newRole, setNewRole] = useState<'manager' | 'cashier' | 'warehouse'>(
    isSuperAdmin ? 'manager' : 'cashier'
  );
  const [newJobTitle, setNewJobTitle] = useState(
    isSuperAdmin ? 'Gerente' : 'Personal de Caja'
  );
  const [newAssignedManagerUid, setNewAssignedManagerUid] = useState('');
  const [newPermissions, setNewPermissions] = useState<StaffPermissions>(
    isSuperAdmin ? { ...DEFAULT_MANAGER_PERMS } : { ...DEFAULT_CASHIER_PERMS }
  );

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editRole, setEditRole] = useState<StaffRole>('cashier');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editAssignedManagerUid, setEditAssignedManagerUid] = useState('');
  const [editCurrentPwd, setEditCurrentPwd] = useState('');
  const [showEditCurrentPwd, setShowEditCurrentPwd] = useState(false);
  const [editNewPwd, setEditNewPwd] = useState('');
  const [showEditPwd, setShowEditPwd] = useState(true);
  const [editPermissions, setEditPermissions] = useState<StaffPermissions>({
    ...DEFAULT_CASHIER_PERMS,
  });

  const managersList = useMemo(
    () => staffList.filter((s) => s.role === 'manager'),
    [staffList]
  );

  const visibleStaff = useMemo(() => {
    if (isSuperAdmin) return staffList;
    return staffList.filter(
      (s) =>
        s.uid === currentUser.uid ||
        ((s.role === 'cashier' || s.role === 'warehouse') &&
          s.assignedManagerUid === currentUser.uid)
    );
  }, [staffList, isSuperAdmin, currentUser.uid]);

  const counts = useMemo(() => {
    const managers = visibleStaff.filter((s) => s.role === 'manager' && s.active).length;
    const cashiers = visibleStaff.filter((s) => s.role === 'cashier' && s.active).length;
    const warehouse = visibleStaff.filter((s) => s.role === 'warehouse' && s.active).length;
    const inactive = visibleStaff.filter((s) => !s.active).length;
    return { managers, cashiers, warehouse, inactive, total: visibleStaff.length };
  }, [visibleStaff]);

  const handleCopy = async (id: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1800);
    } catch {
      // Clipboard blocked in non-HTTPS iframe; user can still reveal and read it directly
    }
  };

  const openCreateModal = () => {
    const defaultRole: 'manager' | 'cashier' | 'warehouse' = isSuperAdmin ? 'manager' : 'cashier';
    setNewRole(defaultRole);
    setNewJobTitle(defaultJobTitleForRole(defaultRole));
    setNewAssignedManagerUid(isSuperAdmin ? managersList[0]?.uid || '' : currentUser.uid);
    setNewPermissions(
      defaultRole === 'manager' ? { ...DEFAULT_MANAGER_PERMS } : { ...DEFAULT_CASHIER_PERMS }
    );
    setFullName('');
    setUsername('');
    setPassword(generateAccessKey());
    setShowCreatePwd(true);
    setFormError(null);
    setShowAuthProviderNotice(false);
    setCreateOpen(true);
  };

  const handleRoleChangeOnCreate = (role: 'manager' | 'cashier' | 'warehouse') => {
    setNewRole(role);
    const defaults = ['Gerente', 'Personal de Caja', 'Depositero', ''];
    if (defaults.includes(newJobTitle.trim())) {
      setNewJobTitle(defaultJobTitleForRole(role));
    }
    if (role === 'manager') {
      setNewPermissions({ ...DEFAULT_MANAGER_PERMS });
    } else if (role === 'warehouse') {
      setNewPermissions({ ...DEFAULT_WAREHOUSE_PERMS });
    } else {
      setNewPermissions({ ...DEFAULT_CASHIER_PERMS });
    }
  };

  const openEditModal = (staff: StaffProfile) => {
    setEditingStaff(staff);
    setEditName(staff.fullName);
    setEditActive(staff.active);
    setEditRole(staff.role);
    setEditJobTitle(staff.jobTitle || defaultJobTitleForRole(staff.role));
    setEditAssignedManagerUid(staff.assignedManagerUid || '');
    setEditCurrentPwd('');
    setShowEditCurrentPwd(false);
    setEditNewPwd('');
    setShowEditPwd(true);
    setEditPermissions({ ...staff.permissions });
    setFormError(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setShowAuthProviderNotice(false);

    const cleanUser = sanitizeStaffUsername(username);
    if (cleanUser.length < 2) {
      setFormError('Ingresá un usuario o email válido de al menos 2 caracteres.');
      return;
    }

    if (cleanUser.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanUser)) {
      setFormError('El formato del email ingresado no es válido.');
      return;
    }

    if (password.length < 6) {
      setFormError('La clave de acceso debe tener al menos 6 caracteres.');
      return;
    }

    const sanitizedRole: 'manager' | 'cashier' | 'warehouse' = isSuperAdmin
      ? newRole
      : newRole === 'warehouse'
        ? 'warehouse'
        : 'cashier';

    const sanitizedPerms: StaffPermissions = {
      ...newPermissions,
      manageManagers: false,
      manageCashiers: sanitizedRole === 'manager' ? newPermissions.manageCashiers : false,
    };

    setSubmitting(true);
    try {
      await onCreateStaff({
        fullName: fullName.trim(),
        username: cleanUser,
        password,
        role: sanitizedRole,
        jobTitle: newJobTitle.trim() || defaultJobTitleForRole(sanitizedRole),
        assignedManagerUid:
          sanitizedRole === 'cashier' || sanitizedRole === 'warehouse'
            ? isSuperAdmin
              ? newAssignedManagerUid || undefined
              : currentUser.uid
            : undefined,
        permissions: sanitizedPerms,
      });
      setCreateOpen(false);
    } catch (err) {
      const code = (err as { code?: string; message?: string })?.code || '';
      const msg = err instanceof Error ? err.message : '';
      if (code === 'auth/operation-not-allowed' || msg.includes('operation-not-allowed')) {
        setShowAuthProviderNotice(true);
        setFormError(
          'Debés habilitar el proveedor "Correo electrónico/contraseña" en Firebase Console para crear cuentas con usuario y contraseña.'
        );
      } else if (code === 'auth/email-already-in-use' || msg.includes('email-already-in-use')) {
        setFormError('Ese usuario o email ya existe en Firebase. Elegí otro identificador.');
      } else if (code === 'auth/invalid-email' || msg.includes('invalid-email')) {
        setFormError('El formato del usuario o email no es válido para Firebase.');
      } else {
        setFormError('No se pudo crear la cuenta. Verificá los datos e intentá nuevamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setFormError(null);

    const trimmedNewPwd = editNewPwd.trim();
    const knownKey = staffKeys[editingStaff.uid];

    if (trimmedNewPwd.length > 0) {
      if (trimmedNewPwd.length < 6) {
        setFormError('La nueva clave de acceso debe tener al menos 6 caracteres.');
        return;
      }
      if (!knownKey && !editCurrentPwd.trim()) {
        setFormError(
          'Para cambiar la clave de una cuenta anterior, ingresá primero su clave actual.'
        );
        return;
      }
    }

    setSubmitting(true);

    const safeRole: StaffRole = isSuperAdmin
      ? editingStaff.role === 'super_admin'
        ? 'super_admin'
        : editRole
      : editRole === 'warehouse'
        ? 'warehouse'
        : 'cashier';

    const sanitizedPerms: StaffPermissions = {
      ...editPermissions,
      manageManagers: safeRole === 'super_admin',
      manageCashiers: safeRole === 'manager' ? editPermissions.manageCashiers : safeRole === 'super_admin',
    };

    try {
      await onUpdateStaff(editingStaff.uid, {
        fullName: editName.trim(),
        active: editActive,
        role: safeRole,
        jobTitle: editJobTitle.trim() || defaultJobTitleForRole(safeRole),
        assignedManagerUid:
          safeRole === 'cashier' || safeRole === 'warehouse'
            ? isSuperAdmin
              ? editAssignedManagerUid || undefined
              : editingStaff.assignedManagerUid
            : undefined,
        permissions: sanitizedPerms,
        currentPassword: editCurrentPwd.trim() || undefined,
        newPassword: trimmedNewPwd || undefined,
      });
      setEditingStaff(null);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      const msg = err instanceof Error ? err.message : '';
      if (
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential' ||
        msg.includes('INVALID_LOGIN_CREDENTIALS')
      ) {
        setFormError('La clave actual ingresada no coincide con la cuenta.');
      } else if (msg === 'MISSING_CURRENT_PASSWORD') {
        setFormError('Ingresá la clave actual para poder actualizar la contraseña.');
      } else if (msg === 'PASSWORD_TOO_SHORT' || code === 'auth/weak-password') {
        setFormError('La nueva clave debe tener al menos 6 caracteres.');
      } else {
        setFormError('No se pudieron guardar los cambios. Verificá los datos e intentá nuevamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActiveQuick = async (staff: StaffProfile) => {
    if (staff.role === 'super_admin') return;
    if (!isSuperAdmin && staff.role !== 'cashier' && staff.role !== 'warehouse') return;
    await onUpdateStaff(staff.uid, {
      fullName: staff.fullName,
      active: !staff.active,
      role: staff.role,
      jobTitle: staff.jobTitle,
      permissions: staff.permissions,
    });
  };

  const cleanUsernameInput = sanitizeStaffUsername(username);
  const generatedFirebaseEmail = cleanUsernameInput ? normalizeStaffEmail(cleanUsernameInput) : '';

  return (
    <div className="space-y-5">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-amber-200/80 bg-white p-4">
          <p className="text-xs text-stone-500">Tu nivel de acceso</p>
          <p className="mt-1 font-display text-base font-bold text-emerald-950">
            {currentUser.jobTitle?.trim() || roleDisplayName(currentUser.role)}
          </p>
          <p className="mt-0.5 truncate text-xs text-stone-500">
            {isInternalStaffEmail(currentUser.email)
              ? `Usuario: ${currentUser.username}`
              : currentUser.email}
          </p>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-white p-4">
          <p className="text-xs text-stone-500">
            {isSuperAdmin ? 'Gerentes activos' : 'Tu local / gerencia'}
          </p>
          <p className="mt-1 font-mono text-2xl font-bold text-orange-600 tabular-nums">
            {isSuperAdmin ? counts.managers : 'Activo'}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">
            {isSuperAdmin ? 'Locales independientes' : 'Personal propio e independiente'}
          </p>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-white p-4">
          <p className="text-xs text-stone-500">Caja y Depósito activos</p>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {counts.cashiers + counts.warehouse}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">
            {counts.cashiers} caja · {counts.warehouse} depósito / stock
          </p>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-white p-4">
          <p className="text-xs text-stone-500">Cuentas suspendidas</p>
          <p className="mt-1 font-mono text-2xl font-bold text-amber-700 tabular-nums">
            {counts.inactive}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">Sin acceso al sistema</p>
        </div>
      </div>

      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-white p-4">
        <div>
          <h2 className="font-display text-sm font-semibold text-emerald-950">
            {isSuperAdmin
              ? 'Administración de Gerentes, Caja y Depósito'
              : 'Administración de Personal de Caja y Depósito'}
          </h2>
          <p className="mt-0.5 text-xs text-stone-500">
            {isSuperAdmin
              ? 'Como Administrador General podés asignar usuario, clave de acceso, cargo (ej: Gerente, Cajero, Depositero) y permisos granulares.'
              : 'Como Gerente podés crear cuentas con usuario, clave y permisos para Personal de Caja o Depositero / Stock.'}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
        >
          <Plus className="h-4 w-4" />
          Alta de Personal
        </button>
      </div>

      {/* Staff Table */}
      <div className="overflow-hidden rounded-xl border border-amber-200/80 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-amber-200/70 bg-amber-50/50 text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre y usuario</th>
                <th className="px-4 py-3 font-medium">Puesto / Rol</th>
                <th className="px-4 py-3 font-medium">Clave de acceso</th>
                <th className="px-4 py-3 font-medium">Permisos habilitados</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100/70">
              {visibleStaff.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-stone-500">
                    Todavía no tenés personal cargado para tu local. Usá{' '}
                    <strong className="text-emerald-950">Alta de Personal</strong> para crear cuentas
                    exclusivas de tu sucursal.
                  </td>
                </tr>
              )}
              {visibleStaff.map((staff) => {
                const canManageThisUser =
                  staff.role !== 'super_admin' &&
                  (isSuperAdmin ||
                    (currentUser.permissions.manageCashiers &&
                      (staff.role === 'cashier' || staff.role === 'warehouse') &&
                      staff.assignedManagerUid === currentUser.uid));

                const activePermsList = PERMISSION_LABELS.filter(
                  (p) => staff.permissions[p.key]
                ).map((p) => p.label);

                const storedKey = staffKeys[staff.uid];
                const isKeyRevealed = Boolean(revealedKeys[staff.uid]);
                const displayJobTitle = staff.jobTitle?.trim() || roleDisplayName(staff.role);
                const baseRoleLabel = roleDisplayName(staff.role);
                const assignedManager = staff.assignedManagerUid
                  ? managersList.find((m) => m.uid === staff.assignedManagerUid)
                  : undefined;

                return (
                  <tr key={staff.uid} className="hover:bg-amber-50/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-emerald-950">{staff.fullName}</div>
                      <div className="font-mono text-[11px] text-stone-500">
                        Usuario: {staff.username}
                      </div>
                      {staff.email && (
                        <div className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-emerald-800">
                          <span>Email Firebase: {staff.email}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(`email-${staff.uid}`, staff.email)}
                            title="Copiar email de acceso"
                            className="rounded p-0.5 text-stone-400 hover:bg-amber-100 hover:text-emerald-950"
                          >
                            {copiedId === `email-${staff.uid}` ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-semibold text-stone-800">{displayJobTitle}</div>
                      {displayJobTitle.toLowerCase() !== baseRoleLabel.toLowerCase() && (
                        <div className="text-[11px] text-stone-500">{baseRoleLabel}</div>
                      )}
                      {isSuperAdmin &&
                        (staff.role === 'cashier' || staff.role === 'warehouse') && (
                          <div className="mt-0.5 text-[11px] font-medium text-orange-700">
                            {assignedManager
                              ? `Local de ${assignedManager.fullName}`
                              : 'Sin gerente asignado'}
                          </div>
                        )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {staff.role === 'super_admin' ? (
                        <span className="text-[11px] text-stone-500">Cuenta Google</span>
                      ) : !canManageThisUser ? (
                        <span className="text-[11px] text-stone-400">Privada</span>
                      ) : storedKey ? (
                        <div className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50/60 px-2 py-1">
                          <span className="font-mono text-xs font-semibold text-emerald-950">
                            {isKeyRevealed ? storedKey : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedKeys((prev) => ({
                                ...prev,
                                [staff.uid]: !prev[staff.uid],
                              }))
                            }
                            title={isKeyRevealed ? 'Ocultar clave' : 'Ver clave'}
                            className="rounded p-0.5 text-stone-500 hover:bg-amber-100 hover:text-emerald-950"
                          >
                            {isKeyRevealed ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(`row-${staff.uid}`, storedKey)}
                            title="Copiar clave"
                            className="rounded p-0.5 text-stone-500 hover:bg-amber-100 hover:text-emerald-950"
                          >
                            {copiedId === `row-${staff.uid}` ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openEditModal(staff)}
                          className="text-xs font-semibold text-orange-600 underline hover:text-orange-700"
                        >
                          Sin registrar (definir en Editar)
                        </button>
                      )}
                    </td>

                    <td className="px-4 py-3 max-w-sm">
                      <span className="text-stone-600">
                        {staff.role === 'super_admin'
                          ? 'Control total de la aplicación (Google Auth)'
                          : activePermsList.length > 0
                            ? activePermsList.join(' · ')
                            : 'Sin permisos asignados'}
                      </span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          staff.active ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {staff.active ? 'Activo' : 'Suspendido'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {canManageThisUser ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(staff)}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-amber-50"
                          >
                            <Edit3 className="h-3.5 w-3.5 text-orange-600" />
                            Editar / Clave
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleActiveQuick(staff)}
                            title={staff.active ? 'Suspender acceso' : 'Reactivar acceso'}
                            className="rounded-lg p-1.5 text-stone-500 hover:bg-amber-100/70 hover:text-emerald-950"
                          >
                            {staff.active ? (
                              <UserX className="h-3.5 w-3.5" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5 text-emerald-700" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteStaff(staff)}
                            title="Revocar y eliminar perfil"
                            className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-stone-400">
                          {staff.role === 'super_admin' ? 'Protegido' : 'Solo lectura'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Staff Modal via Portal so top banner never overlaps it */}
      {createOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-950/60 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label="Crear cuenta de personal"
          >
            <form
              onSubmit={handleCreateSubmit}
              className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-amber-200 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50/40 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-orange-600" />
                  <h3 className="font-display text-base font-semibold text-emerald-950">
                    Alta de personal · Usuario, cargo y permisos
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-amber-100/70 hover:text-stone-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                {formError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                    <p>{formError}</p>
                    {showAuthProviderNotice && (
                      <a
                        href="https://console.firebase.google.com/project/project-bca7c627-a682-4fa4-b57/authentication/providers"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 font-semibold underline"
                      >
                        Abrir Firebase Authentication Providers
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block font-medium text-stone-700">Nombre y apellido</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ej: José González"
                      className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-orange-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-stone-700">
                      Usuario o Email de acceso
                    </label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ej: mabel o mabel@tienda.com"
                      className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                    />
                    {cleanUsernameInput && (
                      <div className="mt-1 space-y-0.5 text-[11px] text-emerald-800">
                        <p>
                          Ingreso en «Gerente / Personal»:{' '}
                          <span className="font-mono font-semibold">{cleanUsernameInput}</span>
                        </p>
                        <p className="text-stone-600">
                          Email Firebase asignado:{' '}
                          <span className="font-mono font-semibold text-emerald-900">
                            {generatedFirebaseEmail}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label className="block font-medium text-stone-700">
                        Clave asignada (mín. 6)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setPassword(generateAccessKey());
                          setShowCreatePwd(true);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Generar clave
                      </button>
                    </div>
                    <div className="relative mt-1 flex items-center">
                      <input
                        type={showCreatePwd ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full rounded-lg border border-stone-300 py-2 pl-3 pr-16 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                      />
                      <div className="absolute right-1.5 flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => setShowCreatePwd((v) => !v)}
                          title={showCreatePwd ? 'Ocultar' : 'Mostrar'}
                          className="rounded p-1 text-stone-400 hover:bg-amber-50 hover:text-stone-700"
                        >
                          {showCreatePwd ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy('create-pwd', password)}
                          title="Copiar clave"
                          className="rounded p-1 text-stone-400 hover:bg-amber-50 hover:text-stone-700"
                        >
                          {copiedId === 'create-pwd' ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block font-medium text-stone-700">
                      Perfil / Rol base del empleado
                    </label>
                    <div
                      className={`mt-1.5 grid gap-2 ${
                        isSuperAdmin ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'
                      }`}
                    >
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => handleRoleChangeOnCreate('manager')}
                          className={`rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                            newRole === 'manager'
                              ? 'border-orange-500 bg-orange-500 text-white'
                              : 'border-amber-200 bg-white text-stone-700 hover:bg-amber-50'
                          }`}
                        >
                          <div className="text-sm font-semibold">Gerente</div>
                          <div className="text-xs opacity-90">Stock, caja y personal</div>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRoleChangeOnCreate('cashier')}
                        className={`rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                          newRole === 'cashier'
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : 'border-amber-200 bg-white text-stone-700 hover:bg-amber-50'
                        }`}
                      >
                        <div className="text-sm font-semibold">Personal de Caja</div>
                        <div className="text-xs opacity-90">Ventas en caja y cobro</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRoleChangeOnCreate('warehouse')}
                        className={`rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                          newRole === 'warehouse'
                            ? 'border-amber-500 bg-amber-500 text-white'
                            : 'border-amber-200 bg-white text-stone-700 hover:bg-amber-50'
                        }`}
                      >
                        <div className="text-sm font-semibold">Depositero / Stock</div>
                        <div className="text-xs opacity-90">Cargar mercadería y stock</div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-stone-700">
                      Nombre del puesto o cargo (podés escribir ej: Depositero, Repositor, Cajero)
                    </label>
                    <input
                      type="text"
                      maxLength={60}
                      value={newJobTitle}
                      onChange={(e) => setNewJobTitle(e.target.value)}
                      placeholder="Ej: Depositero, Repositor, Encargado de Depósito..."
                      className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-orange-500 focus:outline-none"
                    />
                  </div>

                  {isSuperAdmin &&
                    (newRole === 'cashier' || newRole === 'warehouse') &&
                    managersList.length > 0 && (
                      <div>
                        <label className="block font-medium text-stone-700">
                          Gerente / Local asignado
                        </label>
                        <select
                          value={newAssignedManagerUid}
                          onChange={(e) => setNewAssignedManagerUid(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                        >
                          <option value="">Sin gerente asignado (solo Administrador)</option>
                          {managersList.map((mgr) => (
                            <option key={mgr.uid} value={mgr.uid}>
                              Local de {mgr.fullName} ({mgr.username})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                </div>

                <div>
                  <p className="font-medium text-stone-700">Permisos del usuario</p>
                  <div className="mt-2 divide-y divide-amber-100 rounded-xl border border-amber-200">
                    {PERMISSION_LABELS.filter(
                      (perm) => !perm.managerOrAdmin || (isSuperAdmin && newRole === 'manager')
                    ).map((perm) => (
                      <label
                        key={perm.key}
                        className="flex cursor-pointer items-start justify-between gap-3 px-3.5 py-2.5 hover:bg-amber-50/50"
                      >
                        <div>
                          <p className="font-medium text-emerald-950">{perm.label}</p>
                          <p className="text-[11px] text-stone-500">{perm.description}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={newPermissions[perm.key]}
                          onChange={(e) =>
                            setNewPermissions({
                              ...newPermissions,
                              [perm.key]: e.target.checked,
                            })
                          }
                          className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-600 accent-emerald-600"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-amber-100 bg-amber-50/30 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-lg border border-amber-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-amber-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {submitting ? 'Creando cuenta...' : 'Crear Cuenta y Otorgar Permisos'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Edit Staff & Key Modal via Portal */}
      {editingStaff &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-950/60 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label="Editar personal, clave y permisos"
          >
            <form
              onSubmit={handleEditSubmit}
              className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-amber-200 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50/40 px-5 py-3.5">
                <div>
                  <h3 className="font-display text-base font-semibold text-emerald-950">
                    Editar cuenta de {editingStaff.fullName}
                  </h3>
                  <p className="font-mono text-[11px] text-stone-600">
                    Usuario: {editingStaff.username}
                    {editingStaff.email ? ` · Email Firebase: ${editingStaff.email}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-amber-100/70 hover:text-stone-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                {formError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block font-medium text-stone-700">Nombre</label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-stone-700">Estado de acceso</label>
                    <select
                      value={editActive ? 'active' : 'inactive'}
                      onChange={(e) => setEditActive(e.target.value === 'active')}
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                    >
                      <option value="active">Activo (puede ingresar)</option>
                      <option value="inactive">Suspendido (bloqueado)</option>
                    </select>
                  </div>
                </div>

                {editingStaff.role !== 'super_admin' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block font-medium text-stone-700">Perfil / Rol base</label>
                        <select
                          value={editRole}
                          onChange={(e) => {
                            const nextRole = e.target.value as 'manager' | 'cashier' | 'warehouse';
                            setEditRole(nextRole);
                            const defaults = ['Gerente', 'Personal de Caja', 'Depositero', ''];
                            if (defaults.includes(editJobTitle.trim())) {
                              setEditJobTitle(defaultJobTitleForRole(nextRole));
                            }
                          }}
                          className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                        >
                          {isSuperAdmin && <option value="manager">Gerente</option>}
                          <option value="cashier">Personal de Caja</option>
                          <option value="warehouse">Depositero / Stock</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-medium text-stone-700">
                          Puesto / Cargo (ej: Depositero)
                        </label>
                        <input
                          type="text"
                          maxLength={60}
                          value={editJobTitle}
                          onChange={(e) => setEditJobTitle(e.target.value)}
                          placeholder="Ej: Depositero, Cajero, Repositor"
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {isSuperAdmin &&
                      (editRole === 'cashier' || editRole === 'warehouse') &&
                      managersList.length > 0 && (
                        <div>
                          <label className="block font-medium text-stone-700">
                            Gerente / Local asignado
                          </label>
                          <select
                            value={editAssignedManagerUid}
                            onChange={(e) => setEditAssignedManagerUid(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                          >
                            <option value="">Sin gerente asignado (solo Administrador)</option>
                            {managersList.map((mgr) => (
                              <option key={mgr.uid} value={mgr.uid}>
                                Local de {mgr.fullName} ({mgr.username})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                  </div>
                )}

                {/* Password View & Edit Section */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-semibold text-emerald-950">
                      <KeyRound className="h-3.5 w-3.5 text-orange-600" />
                      <span>Clave de acceso</span>
                    </div>
                    {staffKeys[editingStaff.uid] && (
                      <div className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-white px-2 py-0.5">
                        <span className="text-[11px] text-stone-500">Actual:</span>
                        <span className="font-mono text-xs font-semibold text-emerald-950">
                          {staffKeys[editingStaff.uid]}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy('edit-current', staffKeys[editingStaff.uid])}
                          title="Copiar clave actual"
                          className="rounded p-0.5 text-stone-400 hover:text-emerald-900"
                        >
                          {copiedId === 'edit-current' ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {!staffKeys[editingStaff.uid] && (
                    <div>
                      <label className="block font-medium text-stone-700">
                        Clave actual (solo si vas a cambiarla)
                      </label>
                      <div className="relative mt-1 flex items-center">
                        <input
                          type={showEditCurrentPwd ? 'text' : 'password'}
                          value={editCurrentPwd}
                          onChange={(e) => setEditCurrentPwd(e.target.value)}
                          placeholder="Ingresá la clave actual asignada anteriormente"
                          className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-3 pr-10 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEditCurrentPwd((v) => !v)}
                          title={showEditCurrentPwd ? 'Ocultar' : 'Mostrar'}
                          className="absolute right-2 rounded p-1 text-stone-400 hover:bg-amber-50 hover:text-stone-700"
                        >
                          {showEditCurrentPwd ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-stone-500">
                        Esta cuenta se creó antes de guardar claves visibles. Una vez que definas la
                        nueva clave aquí, quedará visible y editable siempre. Si la olvidaste,
                        eliminá el perfil y crealo de nuevo.
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label className="block font-medium text-stone-700">
                        Nueva clave de acceso (opcional, mín. 6)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setEditNewPwd(generateAccessKey());
                          setShowEditPwd(true);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Generar nueva clave
                      </button>
                    </div>
                    <div className="relative mt-1 flex items-center">
                      <input
                        type={showEditPwd ? 'text' : 'password'}
                        value={editNewPwd}
                        onChange={(e) => setEditNewPwd(e.target.value)}
                        placeholder="Dejá vacío para mantener la clave actual"
                        className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-3 pr-16 font-mono text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                      />
                      <div className="absolute right-1.5 flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => setShowEditPwd((v) => !v)}
                          title={showEditPwd ? 'Ocultar' : 'Mostrar'}
                          className="rounded p-1 text-stone-400 hover:bg-amber-50 hover:text-stone-700"
                        >
                          {showEditPwd ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                        {editNewPwd.trim() && (
                          <button
                            type="button"
                            onClick={() => handleCopy('edit-new', editNewPwd)}
                            title="Copiar nueva clave"
                            className="rounded p-1 text-stone-400 hover:bg-amber-50 hover:text-stone-700"
                          >
                            {copiedId === 'edit-new' ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="font-medium text-stone-700">Permisos habilitados</p>
                  <div className="mt-2 divide-y divide-amber-100 rounded-xl border border-amber-200">
                    {PERMISSION_LABELS.filter(
                      (perm) => !perm.managerOrAdmin || (isSuperAdmin && editRole === 'manager')
                    ).map((perm) => (
                      <label
                        key={perm.key}
                        className="flex cursor-pointer items-start justify-between gap-3 px-3.5 py-2.5 hover:bg-amber-50/50"
                      >
                        <div>
                          <p className="font-medium text-emerald-950">{perm.label}</p>
                          <p className="text-[11px] text-stone-500">{perm.description}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={editPermissions[perm.key]}
                          onChange={(e) =>
                            setEditPermissions({
                              ...editPermissions,
                              [perm.key]: e.target.checked,
                            })
                          }
                          className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-600 accent-emerald-600"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-amber-100 bg-amber-50/30 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="rounded-lg border border-amber-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-amber-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {submitting ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}
    </div>
  );
};
