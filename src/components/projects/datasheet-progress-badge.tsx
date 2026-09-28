'use client';

import { clsx } from 'clsx';
import { Bell, CheckCircle2, Landmark, Mail, MinusCircle, Receipt, Wallet, XCircle } from 'lucide-react';
import type { DatasheetProgress, MilestoneIcon } from '@/lib/datasheet-progress';

/** Mérföldkő-ikonok — mindegyik lépésnek sajátja, hogy tooltip nélkül is
 *  látszódjon, MELYIK lépés van kész (öt egyforma pipa olvashatatlan volt). */
const MILESTONE_ICONS: Record<MilestoneIcon, typeof Mail> = {
  mail: Mail,
  wallet: Wallet,
  receipt: Receipt,
  bell: Bell,
  landmark: Landmark,
};

/**
 * Adatlap-haladás jelző a szoba lista- és kanban-nézetéhez.
 *
 * `compact` (kanban-kártya): csak a mini progress-sáv + „7/22".
 * Teljes (lista-sor): + a mérföldkő-pipák tooltippel.
 *
 * Lezárt ügynél (`outcome` kitöltve) a haladás helyett az EREDMÉNYT mutatjuk —
 * ott már nem a „hány mező van kész" a releváns információ.
 */
export function DatasheetProgressBadge({
  progress,
  compact = false,
}: {
  progress: DatasheetProgress;
  compact?: boolean;
}) {
  if (progress.outcome) {
    const map = {
      succeeded: { label: 'Sikeres',    cls: 'bg-green-100 text-green-700', Icon: CheckCircle2 },
      failed:    { label: 'Sikertelen', cls: 'bg-red-100 text-red-700',     Icon: XCircle },
      cancelled: { label: 'Lemondva',   cls: 'bg-gray-100 text-gray-600',   Icon: MinusCircle },
    }[progress.outcome];
    return (
      <span className={clsx('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', map.cls)}>
        <map.Icon className="w-3 h-3" />
        {map.label}
      </span>
    );
  }

  const bar = (
    <span className="flex items-center gap-1.5" title={`${progress.done} / ${progress.total} mező kitöltve`}>
      <span className="relative w-12 h-1.5 rounded-full bg-gray-200 overflow-hidden shrink-0">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-brand-500 transition-all"
          style={{ width: `${progress.percent}%` }}
        />
      </span>
      <span className="text-[11px] font-medium text-gray-500 tabular-nums">
        {progress.done}/{progress.total}
      </span>
    </span>
  );

  if (compact) return bar;

  return (
    <span className="flex items-center gap-2.5">
      {bar}
      {progress.milestones.length > 0 && (
        <span className="hidden md:flex items-center gap-1">
          {progress.milestones.map((m) => {
            const Icon = MILESTONE_ICONS[m.icon];
            return (
              <span
                key={m.key}
                title={`${m.label}${m.done ? ' — kész' : ' — még nincs kész'}`}
                className={clsx(
                  'w-5 h-5 rounded-full flex items-center justify-center transition-colors',
                  m.done ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-300',
                )}
              >
                <Icon className="w-3 h-3" strokeWidth={2.25} />
              </span>
            );
          })}
        </span>
      )}
    </span>
  );
}
