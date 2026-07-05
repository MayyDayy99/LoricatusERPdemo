'use client';

import { useEffect } from 'react';
import { CheckCircle2, Circle, X, Rocket } from 'lucide-react';
import { useOnboardingStore, type ChecklistState } from '@/lib/onboarding-store';
import { useT } from '@/lib/hooks/use-t';
import { apiClient } from '@/lib/api-client';

type ChecklistKey = keyof ChecklistState;

const ITEMS: { key: ChecklistKey; labelKey: keyof ReturnType<typeof useT>['tutorial']['checklist'] }[] = [
  { key: 'createdCustomer',    labelKey: 'addCustomer' },
  { key: 'createdDeal',        labelKey: 'createDeal' },
  { key: 'loggedTimesheet',    labelKey: 'logTimesheet' },
  { key: 'generatedDocument',  labelKey: 'uploadDocument' },
];

/**
 * Dashboard widget that shows onboarding progress as a checklist.
 * Auto-detects completion by polling lightweight API endpoints.
 */
export function OnboardingChecklist() {
  const t = useT();
  const tt = t.tutorial.checklist;
  const {
    mainTour,
    checklist,
    checklistDismissed,
    updateChecklist,
    dismissChecklist,
  } = useOnboardingStore();

  // Auto-detect completed steps
  useEffect(() => {
    if (checklistDismissed) return;

    const checks: { key: ChecklistKey; url: string }[] = [
      // A /customers paginated válasza ({items,total,take,skip}) — a régi `?limit=1`
      // a backenden nem létezik, helyette `?take=1`. Az onboarding csak azt akarja
      // tudni, van-e legalább egy ügyfél, így take=1 elég.
      { key: 'createdCustomer',   url: '/customers?take=1' },
      { key: 'createdDeal',       url: '/deals?limit=1' },
      { key: 'loggedTimesheet',   url: '/timesheets?limit=1' },
      { key: 'generatedDocument', url: '/activities?limit=1' },
    ];

    checks.forEach(({ key, url }) => {
      if (!checklist[key]) {
        apiClient.get(url).then((r) => {
          // Új paginated shape: r.data.items / r.data.total; régi: tömb vagy r.data.data.
          const data = Array.isArray(r.data)
            ? r.data
            : (r.data?.items ?? r.data?.data);
          const hasAny = (typeof r.data?.total === 'number' && r.data.total > 0)
            || (data && data.length > 0);
          if (hasAny) {
            updateChecklist(key, true);
          }
        }).catch(() => {});
      }
    });
    // Run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Don't show if dismissed or if tour hasn't been completed/dismissed yet
  if (checklistDismissed) return null;
  if (mainTour !== 'completed' && mainTour !== 'dismissed') return null;

  const completedCount = (mainTour === 'completed' ? 1 : 0) +
    ITEMS.filter((i) => checklist[i.key]).length;
  const totalCount = 1 + ITEMS.length;
  const allDone = completedCount === totalCount;

  // Auto-dismiss if all done
  if (allDone) return null;

  const pct = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 animate-slide-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-brand-600" />
          <h3 className="text-sm font-semibold text-gray-700">{tt.title}</h3>
        </div>
        <button onClick={dismissChecklist} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{completedCount}/{totalCount}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {/* Tour completion */}
        <div className="flex items-center gap-2.5">
          {mainTour === 'completed' ? (
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 animate-check-pop" />
          ) : (
            <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
          )}
          <span className={`text-sm ${mainTour === 'completed' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
            {tt.completeTour}
          </span>
        </div>

        {ITEMS.map(({ key, labelKey }) => {
          const done = checklist[key];
          return (
            <div key={key} className="flex items-center gap-2.5">
              {done ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 animate-check-pop" />
              ) : (
                <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
              )}
              <span className={`text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                {tt[labelKey]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
