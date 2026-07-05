'use client';

import { useEffect, useMemo, useState } from 'react';
import { mutate as globalMutate } from 'swr';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ChevronDown, ChevronRight, BarChart2, PartyPopper } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useCurrentUser } from '@/lib/hooks/use-users';
import { useMeetingToday } from '@/lib/hooks/use-meeting';
import { useMyTodayTasks, useMyTasks, type CrmTask } from '@/lib/hooks/use-crm';
import { useProjects, useProjectCategories } from '@/lib/hooks/use-projects';
import { useMyDayStore, type MyDayPrefs } from '@/lib/my-day-store';
import { StatsBar } from '@/components/dashboard/stats-bar';
import { groupTasksByRoom } from '@/components/my-day/task-grouping';
import { TodayTaskList, MyDayTaskRow } from '@/components/my-day/today-task-list';
import { DailyCounterStrip } from '@/components/my-day/daily-counter-strip';
import { WeeklyLookahead } from '@/components/my-day/weekly-lookahead';
import { MeetingBanner } from '@/components/my-day/meeting-banner';
import { MyDayHeader } from '@/components/my-day/my-day-header';
import { TaskDrawer } from '@/components/my-day/task-drawer';

function isManagerRole(role?: string | null): boolean {
  return role === 'admin' || role === 'ceo' || role === 'manager';
}

function fallbackPrefs(role?: string | null): MyDayPrefs {
  return {
    showCounterStrip: true,
    showWeekly: role !== 'client',
    showKpiStrip: isManagerRole(role),
  };
}

export function MyDayPage() {
  const { currentUser } = useCurrentUser();
  const role = currentUser?.role;
  const isManager = isManagerRole(role);

  const { session } = useMeetingToday();
  const { tasks: todayTasks, isLoading: todayLoading, mutate: mutateToday } = useMyTodayTasks();
  const { tasks: myTasks, mutate: mutateMy } = useMyTasks();
  const { projects } = useProjects();
  const { categories } = useProjectCategories();

  const { prefs: storePrefs, setPref, ensureDefaults } = useMyDayStore();
  useEffect(() => {
    if (role) ensureDefaults(role);
  }, [role, ensureDefaults]);
  const prefs = storePrefs ?? fallbackPrefs(role);

  const meetingOpen = !!session && !session.closedAt;

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [kpiCollapsed, setKpiCollapsed] = useState(false);
  const [doneCollapsed, setDoneCollapsed] = useState(true);

  // Nyitott vs. kész szétválasztás: a nyitott teendők kerülnek a szoba-csoportos
  // listába, a kész/lemondott teendők a lista alján egy összecsukható szekcióba.
  const openTasks = useMemo(
    () => todayTasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled'),
    [todayTasks],
  );
  const doneTasks = useMemo(
    () => todayTasks.filter((t) => t.status === 'completed' || t.status === 'cancelled'),
    [todayTasks],
  );

  const groups = useMemo(
    () => groupTasksByRoom(openTasks, projects, categories),
    [openTasks, projects, categories],
  );

  // A kiválasztott teendő a már betöltött listákból (mai + heti) — érték szerint a drawernek.
  const selectedTask: CrmTask | null = useMemo(() => {
    if (!selectedTaskId) return null;
    return (
      todayTasks.find((t) => t.id === selectedTaskId) ??
      myTasks.find((t) => t.id === selectedTaskId) ??
      null
    );
  }, [selectedTaskId, todayTasks, myTasks]);

  async function refresh() {
    await Promise.all([mutateToday(), mutateMy()]);
  }

  // Státuszváltás OPTIMISTA módon: a teendő azonnal, helyben átvált a cache-ben
  // (revalidate:false → nincs újrahúzás, nincs skeleton-„újratöltés"). A POST a
  // háttérben fut; a saját listát NEM revalidáljuk (az optimista állapot már
  // helyes), csak a többi felület (szobák / projekt-map) crm-task-listáit
  // frissítjük halkan. Hiba esetén visszagörgetünk a szerver szerinti igazságra.
  function patchStatus(
    taskId: string,
    next: CrmTask['status'],
    endpoint: 'complete' | 'start' | 'reopen',
    errMsg: string,
  ) {
    const apply = (list: CrmTask[] | undefined): CrmTask[] =>
      (list ?? []).map((t) =>
        t.id === taskId
          ? { ...t, status: next, completedAt: next === 'completed' ? new Date().toISOString() : undefined }
          : t,
      );

    void mutateToday((cur) => apply(cur), { revalidate: false });
    void mutateMy((cur) => apply(cur), { revalidate: false });

    apiClient
      .post(`/crm-tasks/${taskId}/${endpoint}`)
      .then(() => {
        void globalMutate(
          (key) =>
            typeof key === 'string' &&
            key.startsWith('/crm-tasks') &&
            key !== '/crm-tasks/my-today' &&
            key !== '/crm-tasks/my',
        );
      })
      .catch((err: any) => {
        toast.error(err?.response?.data?.message ?? errMsg);
        void mutateToday();
        void mutateMy();
      });
  }

  const handleQuickComplete = (id: string) => patchStatus(id, 'completed', 'complete', 'A teendő lezárása nem sikerült');
  const handleQuickStart = (id: string) => patchStatus(id, 'in_progress', 'start', 'A teendő indítása nem sikerült');
  const handleReopen = (id: string) => patchStatus(id, 'pending', 'reopen', 'A teendő visszanyitása nem sikerült');

  const rowActions = {
    onSelectTask: (t: CrmTask) => setSelectedTaskId(t.id),
    onQuickComplete: handleQuickComplete,
    onStart: handleQuickStart,
    onReopen: handleReopen,
  };

  const totalCount = todayTasks.length;
  const doneCount = doneTasks.length;

  return (
    <div className="space-y-6 max-w-5xl">
      <MyDayHeader
        firstName={currentUser?.firstName}
        prefs={prefs}
        isManager={isManager}
        onTogglePref={setPref}
      />

      {/* Csak a 'nyitott meeting' bannert mutatjuk — ez az egyetlen állapot, ami
          a viselkedést módosítja (a backend üres listát ad). A 'nincs session' /
          'lezárt' bannerek elhagyva, hogy a meetinget nem használó tenant-oknál
          ne legyen állandó zaj. */}
      {meetingOpen && <MeetingBanner state="open" />}

      {!meetingOpen && prefs.showCounterStrip && <DailyCounterStrip tasks={todayTasks} />}

      {isManager && prefs.showKpiStrip && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setKpiCollapsed((c) => !c)}
            className="w-full px-5 py-3 border-b border-gray-100 flex items-center gap-2 text-left hover:bg-gray-50 transition"
          >
            <BarChart2 className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 flex-1">Üzleti áttekintés</h2>
            {kpiCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {!kpiCollapsed && <div className="p-4"><StatsBar /></div>}
        </section>
      )}

      {/* Mai teendőim */}
      {!meetingOpen && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <header className="px-5 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Mai teendőim</h2>
                <span className="text-xs text-gray-400 tabular-nums">
                  {totalCount === 0 ? 'üres' : `${doneCount} / ${totalCount} kész`}
                </span>
              </div>
              <Link href="/rooms" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
                Szobák
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {totalCount > 0 && (
              <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={doneCount} aria-valuemax={totalCount}>
                <div
                  className="h-full rounded-full bg-brand-500 transition-all duration-500 ease-out"
                  style={{ width: `${Math.round((doneCount / totalCount) * 100)}%` }}
                />
              </div>
            )}
          </header>

          <div className="p-4">
            {!todayLoading && totalCount > 0 && doneCount === totalCount && (
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-green-50 border border-green-100 px-4 py-2.5 text-sm font-medium text-green-700">
                <PartyPopper className="w-4 h-4 shrink-0" />
                Mindennel megvagy mára — szép munka!
              </div>
            )}

            {todayLoading && (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            )}

            {!todayLoading && totalCount === 0 && (
              <div className="text-center py-10 text-gray-400">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nincs mai teendőd. 🎉</p>
              </div>
            )}

            {!todayLoading && groups.length > 0 && (
              <TodayTaskList
                groups={groups}
                selectedTaskId={selectedTaskId}
                variant="full"
                {...rowActions}
              />
            )}

            {!todayLoading && doneTasks.length > 0 && (
              <div className={groups.length > 0 ? 'mt-4 pt-3 border-t border-gray-100' : ''}>
                <button
                  type="button"
                  onClick={() => setDoneCollapsed((c) => !c)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition"
                >
                  {doneCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  Kész ma ({doneTasks.length})
                </button>
                {!doneCollapsed && (
                  <div className="mt-2 space-y-0.5">
                    {doneTasks.map((t) => (
                      <MyDayTaskRow
                        key={t.id}
                        task={t}
                        actions={rowActions}
                        selected={selectedTaskId === t.id}
                        variant="full"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {prefs.showWeekly && (
        <WeeklyLookahead tasks={myTasks} onSelectTask={(t) => setSelectedTaskId(t.id)} />
      )}

      <TaskDrawer
        task={selectedTask}
        onClose={() => setSelectedTaskId(null)}
        onMutated={refresh}
      />
    </div>
  );
}
