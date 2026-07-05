'use client';

import { useLangStore } from '@/lib/lang-store';
import { APP_T } from '@/lib/app-i18n';

/** Returns the full translation object for the current locale. */
export function useT() {
  const { locale } = useLangStore();
  return APP_T[locale];
}
