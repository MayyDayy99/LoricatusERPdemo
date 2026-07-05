'use client';

/**
 * Demó-figyelmeztető sáv + auto-login biztosíték. Csak IS_DEMO esetén renderel.
 * - Beállítja a demó-tokent (ha a persist-rehidráció felülírta volna).
 * - Fix sávban jelzi, hogy ez portfólió-demó, valós backend nélkül.
 */

import { useEffect, useState } from 'react';
import { IS_DEMO, DEMO_TOKEN, DEMO_TENANT_ID } from '@/lib/demo/config';
import { useAuthStore } from '@/lib/auth-store';

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!IS_DEMO) return;
    // Biztosíték: ha a mentett tenantId null-ra hidrált, tegyük vissza a demót.
    const { accessToken, setAuth } = useAuthStore.getState();
    if (!accessToken) setAuth(DEMO_TOKEN, DEMO_TENANT_ID);
  }, []);

  if (!IS_DEMO || dismissed) return null;

  return (
    <div className="pointer-events-auto fixed bottom-0 left-0 right-0 z-[9998] flex items-center justify-center gap-3 bg-amber-500/95 px-4 py-1.5 text-center text-[12px] font-medium text-amber-950 shadow-[0_-1px_6px_rgba(0,0,0,0.15)] backdrop-blur">
      <span>
        🎭 <strong>DEMÓ</strong> — portfólió-bemutató. Az itt látható <strong>minden adat AI-generált és kitalált</strong> — semmilyen átfedés nincs a Loricatus valós adataival. Nincs valódi backend, az adatok nem mentődnek (újratöltéskor visszaállnak).
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="rounded bg-amber-950/10 px-2 py-0.5 text-[11px] hover:bg-amber-950/20"
      >
        Elrejt
      </button>
    </div>
  );
}
