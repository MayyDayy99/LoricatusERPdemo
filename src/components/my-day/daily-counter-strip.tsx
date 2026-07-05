'use client';

import { useMemo } from 'react';
import { CircleDot, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { CrmTask } from '@/lib/hooks/use-crm';

/**
 * Napi számláló-sáv: a "Mai napom" lista alapján mutatja a mai / folyamatban /
 * lejárt / ma-kész teendők számát. (A backend my-today a ma lezárt teendőket is
 * visszaadja, így a "Kész ma" valós.)
 */
export function DailyCounterStrip({ tasks }: { tasks: CrmTask[] }) {
  const counts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let dueToday = 0, overdue = 0, inProgress = 0, doneToday = 0;
    for (const t of tasks) {
      if (t.status === 'in_progress') inProgress++;
      else if (t.status === 'completed') doneToday++;
      else if (t.status === 'pending') {
        if (t.dueDate && t.dueDate.slice(0, 10) < today) overdue++;
        else dueToday++;
      }
    }
    return { dueToday, overdue, inProgress, doneToday };
  }, [tasks]);

  const cards = [
    { key: 'today', label: 'Mai', value: counts.dueToday, Icon: CircleDot, tint: 'text-brand-600 bg-brand-50' },
    { key: 'progress', label: 'Folyamatban', value: counts.inProgress, Icon: Loader2, tint: 'text-amber-600 bg-amber-50' },
    { key: 'overdue', label: 'Lejárt', value: counts.overdue, Icon: AlertTriangle, tint: 'text-red-600 bg-red-50' },
    { key: 'done', label: 'Kész ma', value: counts.doneToday, Icon: CheckCircle2, tint: 'text-green-600 bg-green-50' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map(({ key, label, value, Icon, tint }) => (
        <div key={key} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
          <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tint}`}>
            <Icon className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="text-xl font-bold text-gray-900 tabular-nums leading-none">{value}</div>
            <div className="text-xs text-gray-500 mt-1 truncate">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
