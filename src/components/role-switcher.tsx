'use client';

import { useState, useRef, useEffect } from 'react';
import { Eye, ChevronDown, Check } from 'lucide-react';
import { useImpersonationStore, type ImpersonatedRole } from '@/lib/impersonation-store';
import { useCanImpersonate, useEffectiveRole } from '@/lib/hooks/use-effective-role';

/**
 * Admin "Nézet váltás" dropdown — a felhasználó kiválaszthatja, melyik
 * szerepkör nézőpontjából látsza a felületet. Csak admin/super_admin
 * felhasználók látják.
 */
const ROLE_OPTIONS: Array<{ value: ImpersonatedRole | null; label: string; sub?: string }> = [
  { value: null,        label: 'Admin',         sub: 'Eredeti nézet' },
  { value: 'ceo',       label: 'Ügyvezető',     sub: 'CEO' },
  { value: 'manager',   label: 'Projektvezető', sub: 'Manager' },
  { value: 'operative', label: 'Operatív',      sub: 'Munkatárs' },
  { value: 'client',    label: 'Megrendelő',    sub: 'Külső ügyfél' },
];

export function RoleSwitcher() {
  const canImpersonate = useCanImpersonate();
  const effectiveRole = useEffectiveRole();
  const { impersonatedRole, setImpersonation } = useImpersonationStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  if (!canImpersonate) return null;

  function selectRole(role: ImpersonatedRole | null) {
    setImpersonation(role);
    setOpen(false);
    // Reload, hogy az SWR-cache + minden role-szintű render újrainduljon
    if (typeof window !== 'undefined') {
      setTimeout(() => window.location.reload(), 50);
    }
  }

  const currentLabel = ROLE_OPTIONS.find(o => o.value === impersonatedRole)?.label ?? 'Admin';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
          impersonatedRole
            ? 'bg-yellow-50 text-yellow-800 border-yellow-300 hover:bg-yellow-100'
            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
        }`}
        title="Nézet váltása — kipróbálja a UI-t más szerepkör nézőpontjából"
      >
        <Eye className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Nézet:</span>
        <span>{currentLabel}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
            <div className="text-xs font-semibold text-gray-700">Szerepkör-szimuláció</div>
            <div className="text-[10px] text-gray-500 mt-0.5">UI-elemek a választott szerepkör szerint</div>
          </div>
          {ROLE_OPTIONS.map(opt => {
            const active = (opt.value ?? null) === impersonatedRole;
            return (
              <button
                key={opt.value ?? 'admin'}
                type="button"
                onClick={() => selectRole(opt.value)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${
                  active ? 'bg-blue-50' : ''
                }`}
              >
                <div className="text-left">
                  <div className="text-gray-900 font-medium">{opt.label}</div>
                  {opt.sub && <div className="text-[10px] text-gray-500">{opt.sub}</div>}
                </div>
                {active && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
            );
          })}
          <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 text-[10px] text-gray-500">
            Az API hívások az eredeti admin-jogokkal mennek — adatban minden látszik.
          </div>
        </div>
      )}
    </div>
  );
}
