'use client';

/**
 * Lightweight i18n utility for the setup wizard.
 *
 * Reads the user's preferred locale from the browser (navigator.language),
 * falls back to English if the locale is not supported.
 *
 * Designed to be replaced with next-intl or similar when a full i18n
 * solution is adopted. The message file shape matches what next-intl
 * expects so the migration will be non-breaking.
 */

type DeepRecord = { [key: string]: string | DeepRecord };

// Statically import all supported locales to avoid dynamic require issues
// with Next.js bundling. Add new locales here as they are translated.
import enMessages from '../../messages/en.json';
import huMessages from '../../messages/hu.json';
import itMessages from '../../messages/it.json';

const MESSAGES: Record<string, DeepRecord> = {
  en: enMessages as DeepRecord,
  hu: huMessages as DeepRecord,
  it: itMessages as DeepRecord,
};

const SUPPORTED_LOCALES = Object.keys(MESSAGES);
const DEFAULT_LOCALE = 'hu';

function detectLocale(): string {
  // 1. Check persisted user preference in localStorage
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('loricatus-lang');
      if (stored) {
        const parsed = JSON.parse(stored) as { state?: { locale?: string } };
        const loc = parsed?.state?.locale;
        if (loc && SUPPORTED_LOCALES.includes(loc)) return loc;
      }
    } catch {
      // ignore parse errors
    }
  }
  // 2. Fall back to browser language
  if (typeof navigator !== 'undefined') {
    const base = navigator.language.split('-')[0].toLowerCase();
    if (SUPPORTED_LOCALES.includes(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/**
 * Returns translations for a specific namespace (top-level key in the
 * message files). The returned function `t(key)` resolves dot-separated
 * paths within the namespace, e.g. `t('step1.button')`.
 */
export function useTranslations(namespace: string) {
  const locale = detectLocale();
  const messages = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
  const ns = (messages[namespace] ?? {}) as DeepRecord;

  function t(path: string): string {
    const parts = path.split('.');
    let current: string | DeepRecord = ns;
    for (const part of parts) {
      if (typeof current !== 'object') return path;
      current = current[part];
      if (current === undefined) return path;
    }
    return typeof current === 'string' ? current : path;
  }

  // Allow accessing nested objects directly (for iteration over step defs)
  function raw(path: string): DeepRecord {
    const parts = path.split('.');
    let current: string | DeepRecord = ns;
    for (const part of parts) {
      if (typeof current !== 'object') return {};
      current = current[part];
      if (current === undefined) return {};
    }
    return typeof current === 'object' ? current : {};
  }

  return { t, raw };
}
