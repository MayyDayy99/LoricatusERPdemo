'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/lib/navigation';
import { locales, type Locale } from '@/i18n';
import { clsx } from 'clsx';

export function LocaleSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const t = useTranslations('locale');
  const pathname = usePathname();
  const router = useRouter();

  const handleChange = (locale: Locale) => {
    router.replace(pathname, { locale });
  };

  return (
    <div className="flex items-center gap-1 px-3 pb-3">
      {locales.map((locale) => (
        <button
          key={locale}
          onClick={() => handleChange(locale)}
          className={clsx(
            'px-2 py-1 rounded text-xs font-medium transition',
            locale === currentLocale
              ? 'bg-brand-600 text-white'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
          )}
        >
          {t(locale)}
        </button>
      ))}
    </div>
  );
}
