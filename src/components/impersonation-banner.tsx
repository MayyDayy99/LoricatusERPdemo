'use client';

import { Eye, X } from 'lucide-react';
import { useImpersonationStore } from '@/lib/impersonation-store';
import { useCanImpersonate } from '@/lib/hooks/use-effective-role';

const ROLE_LABELS: Record<string, string> = {
  ceo:       'Ügyvezető (CEO)',
  manager:   'Projektvezető',
  operative: 'Operatív',
  client:    'Megrendelő',
  admin:     'Admin',
};

/**
 * Felül lebegő figyelmeztető csík — aktív impersonation állapotban
 * jelzi, hogy a UI nem a tényleges admin-felület, hanem szimulált.
 *
 * Csak admin/super_admin user láthatja egyébként, de az `useCanImpersonate`
 * dupla-check kizárja a féloldalas állapotokat.
 */
export function ImpersonationBanner() {
  const impersonatedRole = useImpersonationStore(s => s.impersonatedRole);
  const clearImpersonation = useImpersonationStore(s => s.clearImpersonation);
  const canImpersonate = useCanImpersonate();

  if (!impersonatedRole || !canImpersonate) return null;

  const label = ROLE_LABELS[impersonatedRole] ?? impersonatedRole;

  function disable() {
    clearImpersonation();
    if (typeof window !== 'undefined') {
      setTimeout(() => window.location.reload(), 50);
    }
  }

  return (
    <div
      className="sticky top-0 z-50 bg-yellow-400 text-yellow-950 px-4 py-1.5 flex items-center justify-center gap-3 text-xs font-medium border-b border-yellow-500"
      role="status"
      aria-live="polite"
    >
      <Eye className="w-3.5 h-3.5" />
      <span>
        <strong>{label}</strong>-nézet aktív — UI-elemek szimulálva. Az adat-hozzáférés változatlan (admin).
      </span>
      <button
        type="button"
        onClick={disable}
        className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-500/40 hover:bg-yellow-500/60 transition"
      >
        <X className="w-3 h-3" /> Visszaváltás
      </button>
    </div>
  );
}
