import React, { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { Eye, EyeOff, KeyRound, Lock, PlayCircle, ShieldCheck, User } from 'lucide-react';
import {
  SUPER_ADMIN_EMAIL,
  auth,
  googleProvider,
  normalizeStaffEmail,
} from '../firebase';

interface LoginScreenProps {
  externalError?: string | null;
  onEnterDemoMode: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ externalError, onEnterDemoMode }) => {
  const [mode, setMode] = useState<'staff' | 'admin'>('admin');
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showProviderHelp, setShowProviderHelp] = useState(false);

  const activeError = errorMsg || externalError;

  const handleGoogleAdminLogin = async () => {
    setErrorMsg(null);
    setShowProviderHelp(false);
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const email = cred.user.email?.toLowerCase() || '';
      if (email !== SUPER_ADMIN_EMAIL.toLowerCase()) {
        await signOut(auth);
        setErrorMsg(
          'Acceso denegado: esta cuenta de Google no está autorizada como Administrador General.'
        );
      }
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setErrorMsg('Se cerró la ventana de inicio de sesión con Google.');
      } else {
        setErrorMsg('No se pudo iniciar sesión con Google. Verificá tu conexión e intentá nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setShowProviderHelp(false);
    const trimmedUser = usernameOrEmail.trim().toLowerCase();
    if (!trimmedUser || !password) {
      setErrorMsg('Ingresá tu usuario y contraseña.');
      return;
    }

    if (
      (trimmedUser === 'demo' || trimmedUser === 'demo@minimarket.local') &&
      password === '123456'
    ) {
      onEnterDemoMode();
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = normalizeStaffEmail(usernameOrEmail);
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setShowProviderHelp(true);
        setErrorMsg(
          'El método Correo electrónico/contraseña aún no está habilitado en Firebase Authentication.'
        );
      } else if (code === 'auth/invalid-email') {
        setErrorMsg('El formato del usuario o email ingresado no es válido.');
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setErrorMsg('Usuario, email o contraseña incorrectos.');
      } else if (code === 'auth/user-disabled') {
        setErrorMsg('Esta cuenta fue deshabilitada por un superior.');
      } else {
        setErrorMsg('No se pudo iniciar sesión. Verificá tus credenciales.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-emerald-950 p-4">
      <img
        src="/src/assets/images/minimarket_store_backdrop_1795272439135.jpg"
        alt="Interior de Mini Market"
        referrerPolicy="no-referrer"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-950/80 via-stone-900/65 to-orange-950/75 backdrop-blur-[2px]"
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-amber-200/80 bg-white shadow-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-600 via-amber-400 to-orange-500" />
        <div className="border-b border-amber-100 px-6 py-5">
          <h1 className="font-display text-xl font-bold tracking-tight text-emerald-950">
            Mini Market
          </h1>
          <p className="mt-1 text-xs text-stone-500">
            Sistema Punto de Venta · Acceso por rol y permisos
          </p>
        </div>

        <div className="p-6">
          {/* Segmented mode switch */}
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-amber-200/70 bg-amber-50/70 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('admin');
                setErrorMsg(null);
              }}
              className={`rounded-md px-3 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                mode === 'admin'
                  ? 'bg-white text-emerald-950 shadow-sm'
                  : 'text-stone-600 hover:text-emerald-950'
              }`}
            >
              Administrador General
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('staff');
                setErrorMsg(null);
              }}
              className={`rounded-md px-3 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                mode === 'staff'
                  ? 'bg-white text-emerald-950 shadow-sm'
                  : 'text-stone-600 hover:text-emerald-950'
              }`}
            >
              Gerente / Personal
            </button>
          </div>

          {activeError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
              <p>{activeError}</p>
              {showProviderHelp && (
                <p className="mt-2 text-[11px] text-red-700">
                  Habilitalo en Firebase Console → Authentication → Sign-in method → Correo electrónico/contraseña.
                </p>
              )}
            </div>
          )}

          {mode === 'admin' ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
                  <div className="text-xs text-stone-600 leading-relaxed">
                    <p className="font-semibold text-emerald-950">
                      Ingreso único con cuenta de Google
                    </p>
                    <p className="mt-1">
                      Acceso exclusivo del Administrador General autorizado para gestionar Gerentes,
                      permisos y configuración integral.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleAdminLogin}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
              >
                <KeyRound className="h-5 w-5 text-amber-300" />
                {loading ? 'Verificando cuenta...' : 'Ingresar con Google'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleStaffLogin} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-stone-700">
                  Usuario o Email de acceso
                </label>
                <div className="relative mt-1">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    placeholder="Ej: mabel o mabel@minimarket.local"
                    className="w-full rounded-lg border border-stone-300 py-2.5 pl-9 pr-3 text-sm text-stone-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700">Contraseña</label>
                <div className="relative mt-1">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-stone-300 py-2.5 pl-9 pr-10 text-sm text-stone-900 focus:border-orange-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-stone-400 hover:bg-amber-50 hover:text-stone-700"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-orange-500 px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
              >
                {loading ? 'Ingresando...' : 'Ingresar al sistema'}
              </button>

              <p className="text-center text-[11px] text-stone-500">
                Cada gerente y empleado ingresa con su email o usuario local asignado desde
                Personal y Permisos.
              </p>
            </form>
          )}

          {/* Demo Read-Only Access */}
          <div className="mt-5 border-t border-amber-100 pt-4">
            <button
              type="button"
              disabled={loading}
              onClick={onEnterDemoMode}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50/70 px-4 py-2.5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-amber-100 disabled:opacity-60"
            >
              <PlayCircle className="h-4 w-4 text-orange-600" />
              Ver App como Demo (Solo lectura)
            </button>
            <p className="mt-1.5 text-center font-mono text-[11px] text-stone-500">
              Usuario: <strong className="text-emerald-950">demo</strong> · Clave:{' '}
              <strong className="text-emerald-950">123456</strong> (solo visualización)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
