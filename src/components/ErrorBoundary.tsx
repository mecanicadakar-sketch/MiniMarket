import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Ocurrió un error inesperado en la aplicación.',
    };
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as {
          error?: string;
          operationType?: string;
          path?: string;
        };
        if (parsed.error) {
          friendly = `Error de permisos o conexión (${parsed.operationType || 'operación'} en ${parsed.path || 'base de datos'}): ${parsed.error}`;
        }
      } catch {
        // Keep original message
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h2 className="font-display text-base font-semibold text-slate-900">
                Se detuvo la operación
              </h2>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600 break-words">
              {friendly}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Recargar sistema
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
