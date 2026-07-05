'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';

/**
 * Általános jobb-oldali becsúszó panel (slide-over / drawer) váz.
 * - overlay-re / Esc-re zár
 * - enter/exit transition (a tartalom a záró-animáció alatt is látszik)
 * - body-scroll lock nyitott állapotban
 *
 * A tartalmat a hívó adja (header/body/footer) — a drawer csak a "héjat" biztosítja.
 */
export function SlideOver({
  open,
  onClose,
  children,
  widthClass = 'max-w-md',
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
  labelledBy?: string;
}) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);

  // Enter/exit animáció vezérlése
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(id);
    }
    setEntered(false);
    const t = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(t);
  }, [open]);

  // Esc-zárás + body-scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={clsx(
          'absolute inset-0 bg-black/40 transition-opacity duration-200',
          entered ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={clsx(
          'absolute inset-y-0 right-0 w-full bg-white shadow-xl flex flex-col',
          'transition-transform duration-200 ease-out',
          widthClass,
          entered ? 'translate-x-0' : 'translate-x-full',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
