'use client';

import { useState, useEffect } from 'react';
import { useProjects } from '@/lib/hooks/use-projects';
import { useT } from '@/lib/hooks/use-t';
import { apiClient } from '@/lib/api-client';
import { TrendingUp, Target, Receipt, AlertTriangle, FolderOpen, CheckCircle2 } from 'lucide-react';

interface DashboardKpis {
  pipelineValue: number;
  weightedPipelineValue: number;
  wonDealsCount: number;
  lostDealsCount: number;
  openDealsCount: number;
  winRate: number;
  avgDealSize: number;
  monthlyRevenue: number;
  openQuotesCount: number;
  openQuotesValue: number;
  overdueTasksCount: number;
  openInvoicesValue: number;
  paidInvoicesValue: number;
}

const huf = (v: number) => new Intl.NumberFormat('hu-HU', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

export function StatsBar() {
  const { projects } = useProjects();
  const t = useT();
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);

  useEffect(() => {
    apiClient.get('/analytics/dashboard').then(r => setKpis(r.data)).catch(() => {});
  }, []);

  const activeProjects = projects?.filter((p) => p.state === 'active').length ?? 0;

  const stats = [
    {
      label: t.dashboard.kpi?.pipeline ?? 'Pipeline',
      value: kpis ? huf(kpis.pipelineValue) + ' Ft' : '—',
      sub: kpis ? `${kpis.openDealsCount} nyitott` : '',
      icon: TrendingUp, color: 'text-brand-600 bg-brand-50',
    },
    {
      label: t.dashboard.kpi?.winRate ?? 'Win Rate',
      value: kpis ? kpis.winRate + '%' : '—',
      sub: kpis ? `${kpis.wonDealsCount}W / ${kpis.lostDealsCount}L` : '',
      icon: Target, color: 'text-green-600 bg-green-50',
    },
    {
      label: t.dashboard.kpi?.revenue ?? 'Revenue',
      value: kpis ? huf(kpis.monthlyRevenue) + ' Ft' : '—',
      sub: kpis ? `${huf(kpis.paidInvoicesValue)} Ft befizetett` : '',
      icon: Receipt, color: 'text-purple-600 bg-purple-50',
    },
    {
      label: t.dashboard.kpi?.openInvoices ?? 'Open invoices',
      value: kpis ? huf(kpis.openInvoicesValue) + ' Ft' : '—',
      sub: kpis ? `${kpis.openQuotesCount} árajánlat` : '',
      icon: Receipt, color: 'text-orange-600 bg-orange-50',
    },
    {
      label: t.dashboard.kpi?.activeProjects ?? 'Active projects',
      value: activeProjects,
      sub: `${projects?.length ?? 0} összesen`,
      icon: FolderOpen, color: 'text-blue-600 bg-blue-50',
    },
    {
      label: t.dashboard.kpi?.overdueTasks ?? 'Overdue tasks',
      value: kpis?.overdueTasksCount ?? '—',
      sub: '',
      icon: kpis && kpis.overdueTasksCount > 0 ? AlertTriangle : CheckCircle2,
      color: kpis && kpis.overdueTasksCount > 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50',
    },
  ];

  return (
    <div data-tour="stats-bar" className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4">
          <div className={`w-9 h-9 rounded-lg ${s.color} flex items-center justify-center mb-2`}>
            <s.icon className="w-4 h-4" />
          </div>
          <p className="text-xl font-bold text-gray-900">{s.value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          {s.sub && <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>}
        </div>
      ))}
    </div>
  );
}
