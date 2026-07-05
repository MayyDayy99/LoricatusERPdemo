'use client';

import Link from 'next/link';
import { clsx } from 'clsx';
import { ChevronRight, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import {
  RC_ITEMS,
  HEALTH_SCORE,
  DEPLOY_CHECKLIST,
  FEATURE_MODULES,
} from '@/lib/diagnostic-data';

export function DiagnosticSummary() {
  const doneTasks = RC_ITEMS.filter(r => r.status === 'done').length;
  const totalTasks = RC_ITEMS.length;
  const allTasksDone = doneTasks === totalTasks;

  const requiredDeploy = DEPLOY_CHECKLIST.filter(d => d.status !== 'optional').length;
  const doneDeploy = DEPLOY_CHECKLIST.filter(d => d.status === 'done').length;
  const deployPct = Math.round((doneDeploy / requiredDeploy) * 100);

  const totalModules = FEATURE_MODULES.length;
  const doneModules = FEATURE_MODULES.filter(m => m.tasksDone === m.tasksTotal).length;

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-900">Fejlesztési Állapot</h2>
        <Link
          href="/diagnostic"
          className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
        >
          Részletek
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Health score bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className={clsx(
          'flex items-baseline gap-1 px-4 py-2 rounded-lg border-2',
          HEALTH_SCORE >= 80 ? 'border-green-400 bg-green-50' : 'border-yellow-400 bg-yellow-50',
        )}>
          <span className={clsx('text-2xl font-black', HEALTH_SCORE >= 80 ? 'text-green-600' : 'text-yellow-600')}>
            {HEALTH_SCORE}
          </span>
          <span className="text-sm text-gray-400">/100</span>
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-gray-700">Egészségpontszám</div>
          <div className="text-xs text-gray-400 mt-0.5">RC feladatok + CI ellenőrzések alapján</div>
        </div>
      </div>

      {/* Stat rows */}
      <div className="space-y-2.5">
        <StatRow
          icon={allTasksDone ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Clock className="w-4 h-4 text-yellow-500" />}
          label="RC feladatok"
          value={`${doneTasks}/${totalTasks}`}
          pct={Math.round((doneTasks / totalTasks) * 100)}
          color={allTasksDone ? 'bg-green-500' : 'bg-yellow-400'}
        />
        <StatRow
          icon={<AlertTriangle className="w-4 h-4 text-orange-400" />}
          label="Élesítési lépések"
          value={`${doneDeploy}/${requiredDeploy}`}
          pct={deployPct}
          color={deployPct === 100 ? 'bg-green-500' : 'bg-orange-400'}
        />
        <StatRow
          icon={<CheckCircle2 className="w-4 h-4 text-brand-500" />}
          label="Modulok kész"
          value={`${doneModules}/${totalModules}`}
          pct={Math.round((doneModules / totalModules) * 100)}
          color="bg-brand-500"
        />
      </div>
    </div>
  );
}

function StatRow({
  icon,
  label,
  value,
  pct,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  pct: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-shrink-0">{icon}</span>
      <span className="text-sm text-gray-600 w-36">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-10 text-right">{value}</span>
    </div>
  );
}
