/**
 * Locale-aware navigation utilities (next-intl).
 * Import Link, useRouter, usePathname, redirect from here instead of
 * next/link or next/navigation to get automatic locale prefix handling.
 */
import { createNavigation } from 'next-intl/navigation';
import { locales } from '@/i18n';

export const { Link, redirect, usePathname, useRouter } =
  createNavigation({ locales });
