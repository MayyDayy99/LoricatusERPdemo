'use client';

import { useCallback, useEffect, useState } from 'react';

interface SsoProviderButtonsProps {
  tenantId?: string;
  apiBase?: string;
}

const GoogleIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const MicrosoftIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#f25022" d="M1 1h10v10H1z" />
    <path fill="#7fba00" d="M13 1h10v10H13z" />
    <path fill="#00a4ef" d="M1 13h10v10H1z" />
    <path fill="#ffb900" d="M13 13h10v10H13z" />
  </svg>
);

const HungarianShieldIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 2L4 6v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V6l-8-4z" fill="#CE2939" stroke="#fff" strokeWidth="0.5" />
    <path d="M12 2L4 6v6h8V2z" fill="#FFFFFF" />
    <path d="M12 8h8v4c0 2.5-1.5 5-4 7-1.3-.8-2.5-1.8-3.5-3L12 8z" fill="#477050" />
  </svg>
);

const DapIcon = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/logos/dap.png" alt="DÁP" className="w-4 h-4 shrink-0 object-contain" />
);

// All providers are always shown. Providers without a configured clientId
// are rendered as disabled "coming soon" placeholders.
const ALL_PROVIDERS = [
  { key: 'google',    label: 'Google',                   icon: <GoogleIcon /> },
  { key: 'microsoft', label: 'Microsoft',                icon: <MicrosoftIcon /> },
  { key: 'dap',       label: 'Digitális Állampolgárság', icon: <DapIcon /> },
  { key: 'kau',       label: 'Ügyfélkapu+',              icon: <HungarianShieldIcon /> },
];

export function SsoProviderButtons({ tenantId, apiBase }: SsoProviderButtonsProps) {
  // A-5: warn loudly in non-development if the API URL env var is missing
  useEffect(() => {
    if (!apiBase && !process.env.NEXT_PUBLIC_API_URL && process.env.NODE_ENV !== 'development') {
      console.error(
        '[SsoProviderButtons] NEXT_PUBLIC_API_URL is not set — SSO buttons are falling back to ' +
        'window.location.origin + /api/v1. Set this env var for SSO to work in production.',
      );
    }
  }, [apiBase]);

  // Az `apiBase` lehet abszolút (https://api.example.com/api/v1) vagy relatív
  // ('/api/v1'). A `new URL(...)` konstruktor relatív string-gel TypeError-t
  // dob, ezért a `handleProviderLogin`-ban kötelező abszolút origin-t adni.
  // Prioritás: explicit prop > NEXT_PUBLIC_API_URL > window.location.origin.
  // `||` (NEM `??`) — üres-string env-var-ra is fallbackoljunk.
  const base = apiBase || process.env.NEXT_PUBLIC_API_URL || '/api/v1';
  // null = loading, string[] = fetched (may be empty)
  const [configured, setConfigured] = useState<string[] | null>(null);

  useEffect(() => {
    fetch(`${base}/auth/oauth/providers`)
      .then((r) => r.json())
      .then((data) => setConfigured(data.providers ?? []))
      .catch(() => setConfigured([]));
  }, [base]);

  const handleProviderLogin = useCallback(
    (providerKey: string) => {
      // Ha a `base` relatív (pl. '/api/v1'), a `new URL()` TypeError-t dob —
      // ilyenkor a böngészőből vesszük az origin-t. A komponens 'use client',
      // tehát a klikk-handler csak böngészőben fut, `window` mindig elérhető.
      const isAbsolute = /^https?:\/\//i.test(base);
      const origin = isAbsolute ? undefined : window.location.origin;
      const url = new URL(`${base}/auth/oauth/${providerKey}/init`, origin);
      if (tenantId) url.searchParams.set('tenantId', tenantId);
      window.location.href = url.toString();
    },
    [base, tenantId],
  );

  return (
    <div className="space-y-2.5">
      {ALL_PROVIDERS.map((p) => {
        const isConfigured = configured !== null && configured.includes(p.key);
        const isLoading = configured === null;

        if (isConfigured) {
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => handleProviderLogin(p.key)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded border border-gray-200 bg-white text-loricatus-dark text-sm font-medium hover:bg-loricatus-parchment hover:border-loricatus-graphite/30 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-loricatus-accent focus-visible:ring-offset-1"
            >
              {p.icon}
              <span className="text-loricatus-slate">{p.label}</span>
            </button>
          );
        }

        // Placeholder — not yet configured
        return (
          <div
            key={p.key}
            title="Hamarosan elérhető — az adminisztrátor konfigurálja az OAuth hitelesítő adatokat"
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded border border-dashed border-gray-200 bg-gray-50 text-sm cursor-not-allowed select-none"
          >
            <span className={isLoading ? 'opacity-30' : 'opacity-40'}>{p.icon}</span>
            <span className="text-gray-400">{p.label}</span>
            {!isLoading && (
              <span className="ml-auto text-xs text-gray-300 font-medium">hamarosan</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
