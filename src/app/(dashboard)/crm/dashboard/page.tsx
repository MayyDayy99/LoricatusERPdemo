'use client';

import { useCrmDashboard, type CrmDashboard } from '@/lib/hooks/use-crm';
import { useT } from '@/lib/hooks/use-t';
import Link from 'next/link';
import { TrendingUp, CheckCircle, XCircle, BarChart2, Receipt, Wallet, AlertTriangle, RefreshCw, Clock, Hammer, TrendingDown } from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number, currency = 'HUF') =>
  new Intl.NumberFormat('hu-HU').format(Math.round(v)) + ' ' + currency;

const fmtK = (v: number, currency = 'HUF') => {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' M ' + currency;
  if (v >= 1_000) return (v / 1_000).toFixed(0) + ' E ' + currency;
  return fmt(v, currency);
};

// A backend DealStage kisbetűs (lásd packages/domain/state-machines/deal.state-machine.ts).
const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Minősített', proposal_sent: 'Ajánlat küldve',
  negotiation: 'Tárgyalás', won: 'Nyert', lost: 'Elveszett',
};

const STAGE_COLORS: Record<string, string> = {
  lead: 'bg-gray-400', qualified: 'bg-blue-400', proposal_sent: 'bg-purple-400',
  negotiation: 'bg-orange-400', won: 'bg-green-500', lost: 'bg-red-400',
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, color = 'text-gray-900', trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color?: string;
  trend?: { direction: 'up' | 'down' | 'neutral'; label: string };
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-medium">{label}</span>
        <div className="text-gray-400">{icon}</div>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
      {trend && (
        <div className={`text-xs font-medium flex items-center gap-1 ${
          trend.direction === 'up' ? 'text-green-600' : trend.direction === 'down' ? 'text-red-600' : 'text-gray-500'
        }`}>
          <span>{trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}</span>
          {trend.label}
        </div>
      )}
    </div>
  );
}

// ─── Win Rate Gauge ───────────────────────────────────────────────────────────

function WinRateGauge({ rate }: { rate: number }) {
  const pct = Math.min(100, Math.max(0, rate));
  const color = pct >= 50 ? '#22c55e' : pct >= 25 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.9" fill="none"
            stroke={color} strokeWidth="3"
            strokeDasharray={`${pct} ${100 - pct}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-gray-900">{Math.round(pct)}%</span>
          <span className="text-[10px] text-gray-400">win rate</span>
        </div>
      </div>
    </div>
  );
}

// ─── Pipeline Funnel ──────────────────────────────────────────────────────────

function PipelineFunnel({ funnel }: { funnel: CrmDashboard['pipelineFunnel'] }) {
  const active = funnel.filter(s => s.stage !== 'lost');
  const maxValue = Math.max(...active.map(s => s.value), 1);

  if (active.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">Nincs pipeline adat</p>;
  }

  return (
    <div className="space-y-2">
      {active.map(stage => {
        const barWidth = Math.max(4, (stage.value / maxValue) * 100);
        const color = STAGE_COLORS[stage.stage] ?? 'bg-gray-400';
        return (
          <div key={stage.stage} className="flex items-center gap-3">
            <div className="w-24 text-xs text-gray-500 text-right shrink-0">
              {STAGE_LABELS[stage.stage] ?? stage.stage}
            </div>
            <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden">
              <div
                className={`h-full ${color} rounded-md flex items-center px-2 transition-all duration-500`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <div className="w-24 text-xs text-gray-600 shrink-0">
              <span className="font-medium">{stage.count}</span>
              <span className="text-gray-400 ml-1">db · {fmtK(stage.value)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Invoice Split Bar ────────────────────────────────────────────────────────

function InvoiceSplitBar({ paid, open }: { paid: number; open: number }) {
  const total = paid + open;
  if (total === 0) return <p className="text-xs text-gray-400">Nincs számla adat</p>;
  const paidPct = Math.round((paid / total) * 100);
  return (
    <div className="space-y-2">
      <div className="flex h-4 rounded-full overflow-hidden">
        <div className="bg-green-400 transition-all" style={{ width: `${paidPct}%` }} />
        <div className="bg-orange-300 flex-1" />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />Befizetve: {fmtK(paid)}</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-orange-300 mr-1" />Nyitott: {fmtK(open)}</span>
      </div>
    </div>
  );
}

// ─── Alert Card ───────────────────────────────────────────────────────────────

function AlertCard({
  count, label, sub, icon, color, href,
}: {
  count: number; label: string; sub?: string;
  icon: React.ReactNode; color: string; href: string;
}) {
  if (count === 0) return null;
  return (
    <Link href={href}
      className={`flex items-center gap-4 bg-white rounded-xl border-l-4 ${color} border border-gray-200 px-4 py-3 hover:shadow-sm transition-shadow`}>
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-xl font-bold text-gray-900">{count}</div>
        <div className="text-xs font-medium text-gray-700 truncate">{label}</div>
        {sub && <div className="text-[11px] text-gray-400 truncate">{sub}</div>}
      </div>
    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CrmDashboardPage() {
  const t = useT();
  const { dashboard: d, isLoading, error, mutate, stale } = useCrmDashboard();

  if (isLoading && !d) return <div className="p-8 text-gray-400">{t.common.loading}</div>;
  if (error && !d) return (
    <div className="p-8 text-red-500">Nem sikerült betölteni az analitikai adatokat.</div>
  );
  if (!d) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CRM Vezérlőpult</h1>
            <p className="text-sm text-gray-500 mt-1">Pipeline, bevétel és értékesítési teljesítmény</p>
          </div>
          {stale && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-100 text-yellow-700" title="Az adatok ideiglenesen korábbi lekérésből származnak.">
              CACHED
            </span>
          )}
        </div>
        <button type="button" onClick={() => mutate()}
          className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition">
          <RefreshCw className="w-3.5 h-3.5" /> Frissítés
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Pipeline érték"
          value={fmtK(d.pipelineValue)}
          sub={`Súlyozott: ${fmtK(d.weightedPipelineValue)}`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="text-brand-700"
        />
        <KpiCard
          label="Nyitott ügyletek"
          value={String(d.openDealsCount)}
          sub={`Átlagos méret: ${fmtK(d.avgDealSize)}`}
          icon={<BarChart2 className="w-5 h-5" />}
        />
        <KpiCard
          label="Havi bevétel"
          value={fmtK(d.monthlyRevenue)}
          sub="Aktuális hónap (befizetett számlák)"
          icon={<Wallet className="w-5 h-5" />}
          color="text-green-600"
        />
        <KpiCard
          label="Lejárt feladatok"
          value={String(d.overdueTasksCount)}
          sub={d.overdueTasksCount > 0 ? 'Figyelmet igényel!' : 'Minden feladat rendben'}
          icon={<AlertTriangle className="w-5 h-5" />}
          color={d.overdueTasksCount > 0 ? 'text-red-600' : 'text-green-600'}
        />
      </div>

      {/* Proactive Alerts — only visible if any issue exists */}
      {(d.overdueInvoicesCount > 0 || d.expiringContractsCount > 0 || d.overdueWorkOrdersCount > 0 || d.stagnantDealsCount > 0) && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Figyelmeztetések</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <AlertCard
              count={d.overdueInvoicesCount}
              label="Lejárt számla"
              sub={d.overdueInvoicesValue > 0 ? fmtK(d.overdueInvoicesValue) + ' kintlévőség' : undefined}
              icon={<Wallet className="w-5 h-5 text-red-500" />}
              color="border-l-red-500"
              href="/crm/invoices"
            />
            <AlertCard
              count={d.expiringContractsCount}
              label="Szerződés lejár 30 napon belül"
              icon={<Clock className="w-5 h-5 text-amber-500" />}
              color="border-l-amber-500"
              href="/contracts"
            />
            <AlertCard
              count={d.overdueWorkOrdersCount}
              label="Lejárt határidős munkalap"
              icon={<Hammer className="w-5 h-5 text-orange-500" />}
              color="border-l-orange-500"
              href="/work-orders"
            />
            <AlertCard
              count={d.stagnantDealsCount}
              label="Stagnáló ügylet (30+ nap)"
              icon={<TrendingDown className="w-5 h-5 text-yellow-600" />}
              color="border-l-yellow-500"
              href="/crm/deals"
            />
          </div>
        </div>
      )}

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Win Rate */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Nyerési arány</h3>
          <div className="flex items-center gap-6">
            <WinRateGauge rate={d.winRate} />
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-gray-600">Nyert:</span>
                <span className="font-semibold text-gray-900 ml-auto">{d.wonDealsCount}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-gray-600">Elveszett:</span>
                <span className="font-semibold text-gray-900 ml-auto">{d.lostDealsCount}</span>
              </div>
              <div className="flex items-center gap-2 text-sm pt-2 border-t border-gray-100">
                <Receipt className="w-4 h-4 text-purple-400" />
                <span className="text-gray-600">Függő árajánlat:</span>
                <span className="font-semibold text-gray-900 ml-auto">{d.pendingQuotesCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline Funnel */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Pipeline szakaszok</h3>
          <PipelineFunnel funnel={d.pipelineFunnel} />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quotes summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Árajánlatok</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Nyitott (elküldve)</span>
              <div className="text-right">
                <span className="font-semibold text-gray-900">{d.openQuotesCount} db</span>
                <span className="text-gray-400 ml-2 text-xs">{fmtK(d.openQuotesValue)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Elfogadva</span>
              <span className="font-semibold text-green-600">{d.acceptedQuotesCount} db</span>
            </div>
            {d.openQuotesCount > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-400 rounded-full transition-all"
                    style={{
                      width: `${Math.round((d.acceptedQuotesCount / (d.openQuotesCount + d.acceptedQuotesCount)) * 100)}%`,
                    }}
                  />
                </div>
                <div className="text-[10px] text-gray-400 mt-1 text-right">
                  {Math.round((d.acceptedQuotesCount / (d.openQuotesCount + d.acceptedQuotesCount)) * 100)}% elfogadva
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Invoice split */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Számlák</h3>
          <InvoiceSplitBar paid={d.paidInvoicesValue} open={d.openInvoicesValue} />
          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-sm">
            <span className="text-gray-500">Havi bevétel (tárgy hó)</span>
            <span className="font-semibold text-green-600">{fmtK(d.monthlyRevenue)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
