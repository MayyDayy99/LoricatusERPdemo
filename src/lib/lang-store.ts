'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const SUPPORTED_LOCALES = [
  { code: 'hu', label: 'Magyar',   flag: 'HU' },
  { code: 'en', label: 'English',  flag: 'EN' },
  { code: 'it', label: 'Italiano', flag: 'IT' },
] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]['code'];

function detectDefault(): LocaleCode {
  if (typeof navigator === 'undefined') return 'hu';
  const base = navigator.language.split('-')[0].toLowerCase();
  if (base === 'en') return 'en';
  if (base === 'it') return 'it';
  return 'hu';
}

interface LangState {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
}

export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      locale: detectDefault(),
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'loricatus-lang' },
  ),
);
