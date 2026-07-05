'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Report {
  project: {
    id: string;
    name: string;
    state: string;
    startDate?: string;
    endDate?: string;
    completedAt?: string;
    archivedAt?: string;
  };
  period: { from?: string; to?: string };
  team: Array<{
    userId: string;
    name: string;
    roleType: string;
    totals: Array<{ taskType: string; totalDays: number }>;
    overallDays: number;
  }>;
  equipment: Array<{
    equipmentId: string;
    name: string;
    category: string;
    holderName?: string;
    totalDays: number;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    taskType: string;
    status: string;
    assignedToName?: string;
    startDate?: string;
    endDate?: string;
    duration?: number;
    equipmentNames: string[];
  }>;
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const STATE_LABEL: Record<string, string> = {
  draft: 'Piszkozat',
  active: 'Aktív',
  completed: 'Befejezett',
  archived: 'Archivált',
  cancelled: 'Törölve',
};

const TASK_TYPE_LABEL: Record<string, string> = {
  terep: 'Terep',
  iroda: 'Iroda',
  feldolgozas: 'Feldolgozás',
  sales: 'Sales',
  marketing: 'Marketing',
  szamlazas: 'Számlázás',
  gepido: 'Gépidő',
};

export default function ProjectReportPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get(`/dashboard/projects/${projectId}/report`)
      .then(r => setReport(r.data))
      .catch(e => setError(e?.response?.data?.message ?? e.message));
  }, [projectId]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <p className="text-red-600 text-sm">Hiba: {error}</p>
      </div>
    );
  }
  if (!report) {
    return (
      <div className="max-w-3xl mx-auto py-8 flex items-center gap-2 text-gray-500">
        <RefreshCw className="w-4 h-4 animate-spin" /> Riport generálása…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Print-hidden toolbar */}
      <div className="flex items-center justify-between print:hidden">
        <Link href="/meeting" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Vissza
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700"
        >
          <Printer className="w-4 h-4" /> Nyomtatás / PDF mentés
        </button>
      </div>

      {/* Print-friendly content */}
      <div className="bg-white p-8 border border-gray-200 rounded-xl print:border-0 print:p-0 print:shadow-none">
        <header className="border-b-2 border-gray-900 pb-4 mb-6">
          <div className="flex items-baseline justify-between">
            <h1 className="text-2xl font-bold text-gray-900">{report.project.name}</h1>
            <span className="text-sm font-medium text-gray-500">
              {STATE_LABEL[report.project.state] ?? report.project.state}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Időszak: {fmtDate(report.period.from)} → {fmtDate(report.period.to)}
            {report.project.archivedAt && (
              <span className="ml-3">· Archivált: {fmtDate(report.project.archivedAt)}</span>
            )}
          </p>
        </header>

        {/* Team */}
        <section className="mb-8">
          <h2 className="text-sm font-bold text-gray-600 tracking-widest uppercase mb-3">Csapat</h2>
          {report.team.length === 0 ? (
            <p className="text-sm text-gray-400">Nincs task-hoz rendelt személy.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {report.team.map(t => (
                  <tr key={t.userId}>
                    <td className="py-2 pr-3 font-medium text-gray-900 w-1/3">{t.name}</td>
                    <td className="py-2 px-3 text-gray-600">
                      {t.totals.map((x, i) => (
                        <span key={x.taskType}>
                          {i > 0 && ', '}
                          {TASK_TYPE_LABEL[x.taskType] ?? x.taskType} ({x.totalDays} nap)
                        </span>
                      ))}
                    </td>
                    <td className="py-2 text-right font-semibold text-gray-900 w-20">{t.overallDays} nap</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Equipment */}
        <section className="mb-8">
          <h2 className="text-sm font-bold text-gray-600 tracking-widest uppercase mb-3">Eszközök</h2>
          {report.equipment.length === 0 ? (
            <p className="text-sm text-gray-400">Egy task sem használt eszközt.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {report.equipment.map(e => (
                  <tr key={e.equipmentId}>
                    <td className="py-2 pr-3 font-medium text-gray-900 w-1/3">{e.name}</td>
                    <td className="py-2 px-3 text-gray-600">{e.holderName ? `→ ${e.holderName}` : '—'}</td>
                    <td className="py-2 text-right font-semibold text-gray-900 w-20">{e.totalDays} nap</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Task summary */}
        <section>
          <h2 className="text-sm font-bold text-gray-600 tracking-widest uppercase mb-3">Task összesítő</h2>
          {report.tasks.length === 0 ? (
            <p className="text-sm text-gray-400">Nincs ütemezett task.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="py-2 pr-3 text-left">Task</th>
                  <th className="py-2 px-3 text-left">Felelős</th>
                  <th className="py-2 px-3 text-left">Mettől–Meddig</th>
                  <th className="py-2 px-3 text-left">Típus</th>
                  <th className="py-2 text-right">Nap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.tasks.map(t => (
                  <tr key={t.id}>
                    <td className="py-2 pr-3 text-gray-900">{t.title}</td>
                    <td className="py-2 px-3 text-gray-600">{t.assignedToName ?? '—'}</td>
                    <td className="py-2 px-3 text-gray-600 text-xs">
                      {fmtDate(t.startDate)} → {fmtDate(t.endDate)}
                    </td>
                    <td className="py-2 px-3 text-gray-600 text-xs">{TASK_TYPE_LABEL[t.taskType] ?? t.taskType}</td>
                    <td className="py-2 text-right text-gray-900 font-medium">{t.duration ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <footer className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 text-center">
          Loricatus Group · Projekt riport · Generálva: {new Date().toLocaleString('hu-HU')}
        </footer>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white; }
          aside, nav, header.sidebar, .sidebar { display: none !important; }
        }
      `}</style>
    </div>
  );
}
