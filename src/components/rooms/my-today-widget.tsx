'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { useMyTodayTasks, completeCrmTask } from '@/lib/hooks/use-crm';
import { useProjectCategories, useProjects } from '@/lib/hooks/use-projects';
import { toast } from 'sonner';
import { groupTasksByRoom } from '@/components/my-day/task-grouping';
import { TodayTaskList } from '@/components/my-day/today-task-list';

/**
 * "Mai napom" kompakt widget — szoba szerint csoportosított teendők, 1-kattintásos
 * pipálással. A teljes "Mai napom" oldal (`/dashboard`) ugyanezt a csoportosítást és
 * lista-komponenst használja, gazdagabb (drawer-es) változatban.
 *
 * Ha a meeting nyitva van, a backend üres listát ad → "nincs mai teendő" üzenet.
 */
export function MyTodayWidget() {
  const { tasks, isLoading, mutate } = useMyTodayTasks();
  const { categories } = useProjectCategories();
  const { projects } = useProjects();

  const groups = useMemo(
    () => groupTasksByRoom(tasks, projects, categories),
    [tasks, projects, categories],
  );

  async function handleComplete(taskId: string) {
    try {
      await completeCrmTask(taskId);
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Lezárás sikertelen');
    }
  }

  const totalCount = tasks.length;
  const doneCount = tasks.filter((t) => t.status === 'completed' || t.status === 'cancelled').length;

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <header className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Mai napom</h2>
          <span className="text-xs text-gray-400 tabular-nums">
            {totalCount === 0 ? 'üres' : `${doneCount} / ${totalCount}`}
          </span>
        </div>
        <Link href="/rooms" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
          Szobák
          <ArrowRight className="w-3 h-3" />
        </Link>
      </header>

      <div className="p-4">
        {isLoading && <div className="text-sm text-gray-400">Töltés…</div>}

        {!isLoading && totalCount === 0 && (
          <div className="text-center py-8 text-gray-400">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nincs mai teendőd. 🎉</p>
          </div>
        )}

        {!isLoading && totalCount > 0 && (
          <TodayTaskList groups={groups} onQuickComplete={handleComplete} variant="compact" />
        )}
      </div>
    </section>
  );
}
