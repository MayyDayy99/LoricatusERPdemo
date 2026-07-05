'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Wallet, CheckCircle2, XCircle, Clock, Banknote, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { mutate as globalMutate } from 'swr';
import { useCurrentUser } from '@/lib/hooks/use-users';
import {
  useCommissionList, useCommissionMonthlySummary, useCommissionSettings,
  markCommissionPaid, type CommissionStatus, type CommissionRecord,
} from '@/lib/hooks/use-commission';
import { useDashboardStream } from '@/lib/hooks/use-dashboard';

const STATUS_META: Record<CommissionStatus, { label: string; cls: string; icon: typeof Clock }> = {
  pending:  { label: 'Függőben',  cls: 'bg-gray-100 text-gray-700 border-gray-200',     icon: Clock },
  earned:   { label: 'Megszerezve', cls: 'bg-blue-50 text-blue-700 border-blue-200',     icon: CheckCircle2 },
  lost:     { label: 'Elveszett', cls: 'bg-red-50 text-red-700 border-red-200',          icon: XCircle },
  payable:  { label: 'Kifizethető', cls: 'bg-amber-50 text-amber-800 border-amber-200',  icon: Banknote },
  paid:     { label: 'Kifizetve', cls: 'bg-green-50 text-green-700 border-green-200',    icon: CheckCircle2 },
};

function fmtHuf(n: number) {
  return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(n);
}
function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function JutalekPage() {
  const { currentUser } = useCurrentUser();
  const role = (currentUser as any)?.role;
  const isAdmin = role === 'admin' || role === 'ADMIN' || role === 'ceo' || role === 'CEO';

  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState<CommissionStatus | 'all'>('all');
  const [pendingPay, setPendingPay] = useState<Set<string>>(new Set());

  const { records, mutate } = useCommissionList({
    status: statusFilter === 'all' ? undefined : statusFilter,
    year, month,
  });
  const { summary, mutate: mutateSummary } = useCommissionMonthlySummary(year, month);
  const { settings } = useCommissionSettings();

  // LOW-4/LOW-18: SSE-bridge → cross-tab/cross-admin frissítés.
  // A dashboard-events.service.ts 'commission.changed'-et átküldi a dashboard SSE-re,
  // itt minden /commission cache-t újrahúzunk hogy másik admin kifizetése is látszódjon.
  useDashboardStream((type) => {
    if (type !== 'commission.changed') return;
    void mutate();
    void mutateSummary();
    void globalMutate((key) => typeof key === 'string' && key.startsWith('/commission'));
  });

  if (!currentUser) return <div className="p-6 text-sm text-gray-400">Töltés…</div>;
  if (!isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold text-gray-900">Jutalék</h1>
        <p className="mt-3 text-sm text-gray-500">Ez a felület csak admin / CEO szerepkörrel érhető el.</p>
      </div>
    );
  }

  async function handleMarkPaid(rec: CommissionRecord) {
    if (pendingPay.has(rec.id)) return;
    if (!confirm(`Kifizetve jelölöd? — ${rec.projectName ?? '(törölt projekt)'} (${fmtHuf(rec.perHeadHuf)} / fő)`)) return;
    setPendingPay((prev) => {
      const next = new Set(prev);
      next.add(rec.id);
      return next;
    });
    try {
      await markCommissionPaid(rec.id);
      toast.success('Kifizetve jelölve');
      void mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Sikertelen művelet');
    } finally {
      setPendingPay((prev) => {
        const next = new Set(prev);
        next.delete(rec.id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-brand-600" />
          <h1 className="text-xl font-semibold text-gray-900">Jutalék</h1>
        </div>
        <Link
          href="/settings/jutalek-konfig"
          className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
        >
          Konfiguráció <ArrowUpRight className="w-3 h-3" />
        </Link>
      </header>

      {/* Havi összegzés */}
      <section className="bg-white border border-gray-100 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Havi összegzés</h2>
          <div className="flex items-center gap-2">
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="text-xs border border-gray-200 rounded px-2 py-1"
            >
              {[year - 2, year - 1, year, year + 1].map((y) => (<option key={y} value={y}>{y}</option>))}
            </select>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              className="text-xs border border-gray-200 rounded px-2 py-1"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}. hó</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <SummaryStat
            label="Megszerzett (db)"
            value={summary?.earnedCount ?? 0}
            cls="text-blue-700"
            hint={(summary?.earnedCount ?? 0) === 0 ? 'Nincs ebben a hónapban' : undefined}
          />
          <SummaryStat
            label="Elveszett (db)"
            value={summary?.lostCount ?? 0}
            cls="text-red-600"
            hint={(summary?.lostCount ?? 0) === 0 ? 'Nincs ebben a hónapban' : undefined}
          />
          <SummaryStat
            label="Függőben (db)"
            value={(summary as any)?.pendingCount ?? 0}
            cls="text-gray-700"
            hint={(((summary as any)?.pendingCount ?? 0) === 0) ? 'Nincs ebben a hónapban' : undefined}
          />
        </div>
        {/* "Fizetésed + Jutalék = Összes" — a havi alapbér tenant-globális,
            a jutalék az adott havi payable összege per fő. */}
        <div className="mt-4 mb-4 bg-gradient-to-r from-brand-50 to-amber-50 border border-amber-100 rounded-md p-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <span className="text-gray-600">Fizetésed:</span>
          <strong className="text-gray-900">{fmtHuf(summary?.monthlyBaseSalaryHuf ?? 0)}</strong>
          <span className="text-gray-400">+</span>
          <span className="text-gray-600">Jutalék:</span>
          <strong className="text-amber-700">{fmtHuf(summary?.totalPayableHuf ?? 0)}</strong>
          <span className="text-gray-400">=</span>
          <span className="text-gray-600">Összes:</span>
          <strong className="text-green-700 text-base">
            {fmtHuf((summary?.totalGrossHuf ?? ((summary?.monthlyBaseSalaryHuf ?? 0) + (summary?.totalPayableHuf ?? 0))))}
          </strong>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-100 rounded-md p-3">
            <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Egy főre eső jutalék</div>
            <div className="flex items-baseline gap-3">
              <span className="text-xs text-gray-500">Kifizethető:</span>
              <span className="text-base font-semibold text-amber-700">{fmtHuf(summary?.totalPayableHuf ?? 0)}</span>
            </div>
            <div className="flex items-baseline gap-3 mt-0.5">
              <span className="text-xs text-gray-500">Kifizetve:</span>
              <span className="text-base font-semibold text-green-700">{fmtHuf(summary?.totalPaidHuf ?? 0)}</span>
            </div>
          </div>
          <div className="border border-gray-100 rounded-md p-3">
            <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">
              Cégszintű kötelezettség{settings ? ` (× ${settings.workforceSize} fő)` : ''}
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-xs text-gray-500">Kifizethető:</span>
              <span className="text-base font-semibold text-amber-700">
                {fmtHuf(summary?.totalPayableCompanyHuf ?? ((summary?.totalPayableHuf ?? 0) * (settings?.workforceSize ?? 1)))}
              </span>
            </div>
            <div className="flex items-baseline gap-3 mt-0.5">
              <span className="text-xs text-gray-500">Kifizetve:</span>
              <span className="text-base font-semibold text-green-700">
                {fmtHuf(summary?.totalPaidCompanyHuf ?? ((summary?.totalPaidHuf ?? 0) * (settings?.workforceSize ?? 1)))}
              </span>
            </div>
          </div>
        </div>
        {settings && (
          <div className="mt-3 text-xs text-gray-400">
            Konfiguráció: jutalék-kulcs <span className="font-medium text-gray-600">{Math.round(Number(settings.commissionRatio) * 100)}%</span> ·
            napi érték <span className="font-medium text-gray-600">{fmtHuf(settings.dailyRateHuf)}</span> ·
            dolgozói létszám <span className="font-medium text-gray-600">{settings.workforceSize}</span>
          </div>
        )}
      </section>

      {/* Lista */}
      <section className="bg-white border border-gray-100 rounded-lg">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Projektenkénti jutalék</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Státusz:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CommissionStatus | 'all')}
              className="text-xs border border-gray-200 rounded px-2 py-1"
            >
              <option value="all">Mind</option>
              {Object.entries(STATUS_META).map(([k, m]) => (
                <option key={k} value={k}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {records.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-400">
              Nincs jutalék-rekord a kiválasztott hónapra / státuszra.
            </div>
          )}
          {records.map((rec) => {
            const meta = STATUS_META[rec.status];
            const Icon = meta.icon;
            return (
              <div key={rec.id} className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link href={`/rooms/${rec.projectId}`} className="text-sm font-medium text-gray-900 hover:text-brand-600 truncate">
                      {rec.projectName ?? '(törölt projekt)'}
                    </Link>
                    <span className={clsx('text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-medium flex items-center gap-1', meta.cls)}>
                      <Icon className="w-3 h-3" /> {meta.label}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>Alap: <strong className="text-gray-700">{fmtHuf(rec.baseFeeHuf)}</strong></span>
                    <span>Per fő: <strong className="text-gray-700">{fmtHuf(rec.perHeadHuf)}</strong></span>
                    <span>Napok: <strong className={rec.plannedDays > rec.suggestedDays ? 'text-red-600' : 'text-gray-700'}>{Number(rec.plannedDays).toFixed(1)} / {rec.suggestedDays}</strong></span>
                    {rec.payableAt && <span>Kifizethető: <strong className="text-gray-700">{fmtDate(rec.payableAt)}</strong></span>}
                    {rec.paidAt && <span>Kifizetve: <strong className="text-gray-700">{fmtDate(rec.paidAt)}</strong></span>}
                  </div>
                </div>
                {rec.status === 'payable' && (
                  <button
                    onClick={() => handleMarkPaid(rec)}
                    disabled={pendingPay.has(rec.id)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors',
                      pendingPay.has(rec.id)
                        ? 'bg-green-400 cursor-not-allowed opacity-70'
                        : 'bg-green-600 hover:bg-green-700',
                    )}
                  >
                    {pendingPay.has(rec.id) ? 'Mentés…' : 'Kifizetve'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SummaryStat({ label, value, cls, hint }: { label: string; value: number | string; cls?: string; hint?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-0.5">{label}</div>
      <div className={clsx('text-lg font-semibold', cls ?? 'text-gray-900')}>{value}</div>
      {hint && <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>}
    </div>
  );
}
