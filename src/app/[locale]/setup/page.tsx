'use client';

import { useTranslations } from 'next-intl';
import { SetupWizard } from '@/components/setup/setup-wizard';

export default function SetupPage() {
  const t = useTranslations('setup');

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 to-brand-700 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">{t('platformTitle')}</h1>
          <p className="text-brand-100 mt-2">{t('enterpriseSetup')}</p>
        </div>
        <SetupWizard />
      </div>
    </div>
  );
}
