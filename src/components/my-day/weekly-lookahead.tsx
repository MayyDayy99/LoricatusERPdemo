'use client';

import { useMemo } from 'react';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import type { CrmTask } from '@/lib/hooks/use-crm';

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500', medium: 'bg-amber-400', low: 'bg-blue-400',
};

interface DayBucket {
  iso: string;
  label: string;
  tasks: CrmTask[];
}

/** Heti előretekintés: a holnap..+7 nap között esedékes (még nyitott) teendők,
 *  napra bontva. Forrás: useMyTasks() (összes pending). A mai/lejárt teendők
 *  a fő listában vannak, ide nem kerülnek. */
export function WeeklyLookahead({
  tasks,
  onSelectTask,
}: {
  tasks: CrmTask[];
  onSelectTask?: (task: CrmTask) => void;
}) {
  const buckets = useMemo<DayBucket[]>(() => {
    const todayMid = new Date();
    todayMid.setHours(0, 0, 0, 0);
    const byDay = new Map<string, DayBucket>();

    for (const t of tasks) {
      if (t.status !== 'pending' || !t.dueDate) continue;
      const due = new Date(t.dueDate);
      if (Number.isNaN(due.getTime())) continue;
      const dueMid = new Date(due);
      dueMid.setHours(0, 0, 0, 0);
      const diffDays = Math.round((dueMid.getTime() - todayMid.getTime()) / 86_400_000);
      if (diffDays < 1 || diffDays > 7) continue;

      const iso = dueMid.toISOString().slice(0, 10);
      let b = byDay.get(iso);
      if (!b) {
        b = {
          iso,
          label: due.toLocaleDateString('hu-HU', { weekday: 'long', month: 'short', day: 'numeric' }),
          tasks: [],
        };
        byDay.set(iso, b);
      }
      b.tasks.push(t);
    }

    return [...byDay.values()].sort((a, b) => a.iso.localeCompare(b.iso));
  }, [tasks]);

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <header className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">A héten még</h2>
      </header>
      <div className="p-4">
        {buckets.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">A héten nincs több ütemezett teendőd.</p>
        ) : (
          <div className="space-y-4">
            {buckets.map((b) => (
              <div key={b.iso}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-gray-600 capitalize">{b.label}</span>
                  <span className="text-[10px] text-gray-400 tabular-nums">({b.tasks.length})</span>
                </div>
                <div className="space-y-0.5 ml-1">
                  {b.tasks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelectTask?.(t)}
                      disabled={!onSelectTask}
                      className={clsx(
                        'group w-full flex items-center gap-2 text-left py-1.5 px-2 -mx-2 rounded-lg transition',
                        onSelectTask && 'hover:bg-gray-50 cursor-pointer',
                      )}
                    >
                      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', PRIORITY_DOT[t.priority] ?? 'bg-gray-300')} />
                      <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">{t.title}</span>
                      {t.projectName && (
                        <span className="text-[11px] text-gray-400 truncate max-w-[40%] hidden sm:inline">{t.projectName}</span>
                      )}
                      {onSelectTask && (
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
