'use client';

import { useEffect, useState } from 'react';
import { useLangStore, SUPPORTED_LOCALES, type LocaleCode } from '@/lib/lang-store';

interface LangPickerProps {
  /** 'icon' = kód (HU/EN), 'full' = teljes label (Magyar/English) */
  variant?: 'icon' | 'full';
  className?: string;
}

export function LangPicker({ variant = 'icon', className = '' }: LangPickerProps) {
  const { locale, setLocale } = useLangStore();
  // Prevent hydration mismatch: zustand persist reads localStorage only on the client.
  // Until mounted, render an invisible placeholder with identical dimensions.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const buttons = SUPPORTED_LOCALES.map((loc) => (
    <button
      key={loc.code}
      type="button"
      onClick={() => setLocale(loc.code as LocaleCode)}
      aria-label={`Nyelv: ${loc.label}`}
      className={[
        'px-2.5 py-1 rounded text-xs font-semibold tracking-wide transition-colors',
        mounted && locale === loc.code
          ? 'bg-loricatus-accent text-loricatus-dark'
          : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100',
      ].join(' ')}
    >
      {variant === 'full' ? loc.label : loc.flag}
    </button>
  ));

  return (
    <div className={`flex items-center gap-0.5 ${mounted ? '' : 'invisible'} ${className}`}>
      {buttons}
    </div>
  );
}
