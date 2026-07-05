'use client';

import { Zap, Shield, RefreshCw } from 'lucide-react';
import { useCurrentUser } from '@/lib/hooks/use-users';
import { useT } from '@/lib/hooks/use-t';
import {
  useIntegrations,
  type IntegrationProvider,
  type IntegrationRecord,
} from '@/lib/hooks/use-integrations';
import { IntegrationCard } from '@/components/settings/integration-card';

const PROVIDERS: IntegrationProvider[] = [
  'sendgrid',
  'azure_storage',
  'google_maps',
  'notam',
  'pdf',
  'sketchfab',
];

export default function IntegrationsPage() {
  const t = useT();
  const { currentUser } = useCurrentUser();
  const { integrations, isLoading, mutate } = useIntegrations();

  /* ── Admin guard ─────────────────────────────────────────────── */
  if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'ceo') {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
          <Shield className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-700">Csak admin</h2>
          <p className="text-sm text-gray-400 mt-1">
            Ez az oldal csak admin vagy CEO szerepkörrel érhető el.
          </p>
        </div>
      </div>
    );
  }

  const byProvider = new Map<IntegrationProvider, IntegrationRecord>();
  for (const rec of integrations) byProvider.set(rec.provider, rec);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Zap className="w-6 h-6 text-brand-500" />
          Integrációk
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Per-tenant API kulcsok beállítása a 3rd-party szolgáltatókhoz. A kulcsok
          AES-256-GCM titkosítással kerülnek tárolásra, és felülírják az alapértelmezett
          környezeti változókat.
        </p>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
          {t.common?.loading ?? 'Betöltés...'}
        </div>
      )}

      {!isLoading && (
        <div className="space-y-5">
          {PROVIDERS.map((p) => (
            <IntegrationCard
              key={p}
              provider={p}
              record={byProvider.get(p)}
              onChanged={() => mutate()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
