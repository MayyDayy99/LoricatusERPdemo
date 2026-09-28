'use client';

import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { ArrowRight } from 'lucide-react';

/**
 * Egységes üres állapot a projekt-fülekhez.
 *
 * ELŐZMÉNY (2026-09-02): a Munkalapok fül üres állapotban csak annyit írt ki,
 * hogy „Nincs munkalap ehhez a projekthez" — nulla gomb, nulla magyarázat.
 * A felhasználó nem tudta, hogyan hozzon létre egyet, és rá is kérdezett.
 * A többi fül (Dokumentumok, Feltöltések, Szerződések, Számlák, Tevékenységek)
 * ugyanígy néma volt.
 *
 * Ez a komponens három dolgot mond el: MI hiányzik, HOGYAN keletkezik, és
 * hol tud a felhasználó továbblépni.
 */
export function ProjectEmptyState({
  icon: Icon,
  title,
  hint,
  actions,
}: {
  icon: LucideIcon;
  /** Mi hiányzik — egy rövid mondat. */
  title: string;
  /** Hogyan keletkezik — ez a lényeg, ezt kereste a felhasználó. */
  hint: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    /** Az elsődleges műveletet emeljük ki; a többi visszafogott. */
    primary?: boolean;
    disabled?: boolean;
  }>;
}) {
  return (
    <div className="p-8 text-center">
      <Icon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
      <p className="text-sm text-gray-600">{title}</p>
      <p className="text-xs text-gray-400 mt-1.5 max-w-md mx-auto leading-relaxed">{hint}</p>
      {actions && actions.length > 0 && (
        <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
          {actions.map(a => (
            <button
              key={a.label}
              onClick={a.onClick}
              disabled={a.disabled}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50',
                a.primary
                  ? 'bg-brand-600 text-white hover:bg-brand-700'
                  : 'border border-gray-200 text-gray-700 hover:bg-gray-50',
              )}
            >
              {a.label}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
