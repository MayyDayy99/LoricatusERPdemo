'use client';

import { useState } from 'react';
import { SlidersHorizontal, Check } from 'lucide-react';
import { clsx } from 'clsx';
import type { MyDayPrefs } from '@/lib/my-day-store';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Jó reggelt';
  if (h < 18) return 'Jó napot';
  return 'Jó estét';
}

export function MyDayHeader({
  firstName,
  prefs,
  isManager,
  onTogglePref,
}: {
  firstName?: string;
  prefs: MyDayPrefs;
  isManager: boolean;
  onTogglePref: (key: keyof MyDayPrefs, value: boolean) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const dateStr = new Date().toLocaleDateString('hu-HU', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const toggles: Array<{ key: keyof MyDayPrefs; label: string; show: boolean }> = [
    { key: 'showCounterStrip', label: 'Napi számláló-sáv', show: true },
    { key: 'showWeekly', label: 'Heti előretekintés', show: true },
    { key: 'showKpiStrip', label: 'Üzleti áttekintés (KPI)', show: isManager },
  ];

  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting()}{firstName ? `, ${firstName}` : ''}!
        </h1>
        <p className="text-gray-500 mt-1 capitalize">{dateStr}</p>
      </div>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Testreszabás</span>
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-lg z-50 p-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1.5">
                Szekciók
              </p>
              {toggles.filter((t) => t.show).map((t) => {
                const on = prefs[t.key];
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => onTogglePref(t.key, !on)}
                    className="w-full flex items-center justify-between gap-3 px-2 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    <span>{t.label}</span>
                    <span
                      className={clsx(
                        'w-9 h-5 rounded-full flex items-center px-0.5 transition shrink-0',
                        on ? 'bg-brand-500 justify-end' : 'bg-gray-200 justify-start',
                      )}
                    >
                      <span className="w-4 h-4 rounded-full bg-white shadow flex items-center justify-center">
                        {on && <Check className="w-2.5 h-2.5 text-brand-600" />}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
