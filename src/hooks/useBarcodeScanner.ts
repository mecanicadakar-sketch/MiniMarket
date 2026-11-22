import { useEffect, useRef } from 'react';

interface UseBarcodeScannerOptions {
  enabled: boolean;
  suffix: 'Enter' | 'Tab';
  onScan: (code: string) => void;
}

/**
 * Listens globally for USB HID Keyboard-Wedge barcode scanners.
 * Hardware scanners emit characters rapidly (< 55ms between keystrokes)
 * terminated by Enter or Tab, even when a text input is not focused.
 */
export function useBarcodeScanner({ enabled, suffix, onScan }: UseBarcodeScannerOptions): void {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable;

      // Ignore if the user is actively typing inside a form input (except our dedicated scanner box which handles Enter itself)
      if (isEditable) return;

      const now = performance.now();
      const elapsed = now - lastKeyTimeRef.current;

      if (elapsed > 80) {
        bufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === suffix) {
        if (bufferRef.current.length >= 4) {
          e.preventDefault();
          const code = bufferRef.current.trim();
          bufferRef.current = '';
          onScan(code);
        } else {
          bufferRef.current = '';
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, suffix, onScan]);
}
