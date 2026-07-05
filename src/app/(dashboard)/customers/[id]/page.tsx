'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { mutate as swrMutate } from 'swr';
import { ArrowLeft, Mail, Phone, Globe, Building2, Tag, Star, TrendingUp, FileText, Receipt, Activity, User, ClipboardList, FileSignature, Pencil, Check, X, Folder, Link2 } from 'lucide-react';
// A contracts/invoices/work-orders most summary-ből jön (D-feladat — Customer-360 bővítés);
// az audit-tab a megosztott <AuditTimeline /> komponensre lett refaktorálva (γ_polish).
import { apiClient } from '@/lib/api-client';
import { useCustomerSummary, useAccounts, type CustomerSummary } from '@/lib/hooks/use-crm';
import { useT } from '@/lib/hooks/use-t';
import { LIFECYCLE_STAGES, LIFECYCLE_STYLES } from '@/lib/customer-lifecycle';
import { AuditTimeline } from '@/components/audit/AuditTimeline';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (v?: number, c = 'HUF') =>
  v != null ? new Intl.NumberFormat('hu-HU').format(v) + ' ' + c : '—';

// B-task: a label-szöveg az i18n-ből (`t.customers.lifecycle[stage]`); a kanonikus
// style-mapping a @/lib/customer-lifecycle modulból.

// Lead-score → "Hideg / Langyos / Forró" sávkulcs. A score-érték a t.customers.scoreLabel-ből
// kapja a fordított szövegét.
function scoreBand(score: number): 'cold' | 'warm' | 'hot' {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

const ACTIVITY_LABELS: Record<string, string> = {
  CALL: 'Hívás', EMAIL: 'Email', MEETING: 'Találkozó',
  NOTE: 'Megjegyzés', SITE_VISIT: 'Helyszíni', TASK_COMPLETED: 'Feladat', SYSTEM: 'Rendszer',
};

const DEAL_STAGE_LABELS: Record<string, string> = {
  LEAD: 'Lead', QUALIFIED: 'Minősített', PROPOSAL_SENT: 'Ajánlat', NEGOTIATION: 'Tárgyalás', WON: 'Nyert', LOST: 'Elveszett',
};

const DEAL_STAGE_STYLES: Record<string, string> = {
  LEAD: 'bg-gray-100 text-gray-600',
  QUALIFIED: 'bg-blue-100 text-blue-700',
  PROPOSAL_SENT: 'bg-purple-100 text-purple-700',
  NEGOTIATION: 'bg-orange-100 text-orange-700',
  WON: 'bg-green-100 text-green-700',
  LOST: 'bg-red-100 text-red-600',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * B-task: lifecycle + lead score inline-szerkesztő. A pencil-gombra váltja át az
 * olvasó nézetet egy select + slider/number-input párosra; Save → PATCH /customers/:id,
 * majd optimistic SWR-mutate-tel pörgeti a summary-cache-t.
 */
function LifecycleEditPanel({
  customerId,
  initialStage,
  initialScore,
  onSaved,
}: {
  customerId: string;
  initialStage: string;
  initialScore: number;
  onSaved: () => Promise<unknown> | void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [stage, setStage] = useState(initialStage || 'other');
  const [score, setScore] = useState<number>(initialScore ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labels = t.customers.lifecycle as Record<string, string>;
  const scoreLabels = t.customers.scoreLabel as Record<string, string>;
  const band = scoreBand(score);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const safeScore = Math.max(0, Math.min(100, Math.round(score)));
      await apiClient.patch(`/customers/${customerId}`, {
        lifecycleStage: stage,
        leadScore: safeScore,
      });
      // γ_polish: az onSaved() a parent useCustomerSummary mutate-jét hívja
      // (csak a /customers/${id}/summary SWR-kulcsot). A customer-lista
      // (/customers?...) prefix-match kulcsait is invalidáljuk, hogy a
      // lifecycle-badge és lead-score azonnal frissüljön a listanézetben.
      void swrMutate(
        (key) => typeof key === 'string' && (key === '/customers' || key.startsWith('/customers?')),
        undefined,
        { revalidate: true },
      );
      await onSaved();
      setEditing(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setStage(initialStage || 'other');
    setScore(initialScore ?? 0);
    setError(null);
    setEditing(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">
          {(t.customers as Record<string, any>).editPanelTitle ?? 'Lifecycle & lead score'}
        </h3>
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600 transition">
            <Pencil className="w-3.5 h-3.5" />
            {t.common.edit}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleCancel} disabled={saving}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
              <X className="w-3.5 h-3.5" />
              {t.common.cancel}
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 bg-brand-600 text-white rounded text-xs font-medium hover:bg-brand-700 disabled:opacity-50">
              <Check className="w-3.5 h-3.5" />
              {saving ? t.common.saving : t.common.save}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Lifecycle */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            {(t.customers as Record<string, any>).lifecycleLabel ?? 'Lifecycle stage'}
          </label>
          {editing ? (
            <select
              value={stage}
              onChange={e => setStage(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {LIFECYCLE_STAGES.map(s => (
                <option key={s} value={s}>{labels[s] ?? s}</option>
              ))}
            </select>
          ) : (
            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${LIFECYCLE_STYLES[initialStage] ?? 'bg-gray-100 text-gray-600'}`}>
              {labels[initialStage] ?? initialStage}
            </span>
          )}
        </div>

        {/* Lead score */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            {(t.customers as Record<string, any>).leadScoreLabel ?? 'Lead score (0–100)'}
          </label>
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="range" min={0} max={100} step={1}
                value={score}
                onChange={e => setScore(Number(e.target.value))}
                className="flex-1"
              />
              <input
                type="number" min={0} max={100}
                value={score}
                onChange={e => setScore(Number(e.target.value))}
                className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-right"
              />
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                band === 'hot' ? 'bg-red-100 text-red-600'
                : band === 'warm' ? 'bg-yellow-100 text-yellow-700'
                : 'bg-blue-100 text-blue-600'
              }`}>
                {scoreLabels[band] ?? band}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${band === 'hot' ? 'bg-red-500' : band === 'warm' ? 'bg-yellow-400' : 'bg-blue-400'}`}
                  style={{ width: `${Math.min(100, initialScore)}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-700">{initialScore} / 100</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                scoreBand(initialScore) === 'hot' ? 'bg-red-100 text-red-600'
                : scoreBand(initialScore) === 'warm' ? 'bg-yellow-100 text-yellow-700'
                : 'bg-blue-100 text-blue-600'
              }`}>
                {scoreLabels[scoreBand(initialScore)] ?? ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>
      )}
    </div>
  );
}

/**
 * H-feladat: B2B Account-link inline szerkesztő. Edit-módban az `useAccounts`
 * hookból érkező listán szűkül a select; read-módban az aktív account-név
 * link-elhetően jelenik meg. Save → PATCH /customers/:id { accountId } —
 * ''/null clear-eli a kapcsolatot. A summary mutate-jét a parent hívja, hogy
 * a customer-objektum frissüljön.
 */
function AccountLinkPanel({
  customerId,
  initialAccountId,
  onSaved,
}: {
  customerId: string;
  initialAccountId?: string;
  onSaved: () => Promise<unknown> | void;
}) {
  const t = useT();
  const { accounts, isLoading: accountsLoading } = useAccounts();
  const [editing, setEditing] = useState(false);
  const [accountId, setAccountId] = useState<string>(initialAccountId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cx = t.customers as Record<string, any>;
  const title = cx.b2bPanelTitle ?? 'Anyacég (B2B)';
  const label = cx.b2bAccountLabel ?? 'Anyacég';
  const noneLabel = cx.b2bNone ?? 'Nincs csatolva';
  const placeholder = cx.b2bPlaceholder ?? '— Válassz cégszintű Account-ot —';

  const current = accounts.find(a => a.id === (initialAccountId ?? ''));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch(`/customers/${customerId}`, {
        accountId: accountId || null,
      });
      // γ_polish: az anyacég-csatolás után a listanézet B2B-oszlopa is frissüljön.
      void swrMutate(
        (key) => typeof key === 'string' && (key === '/customers' || key.startsWith('/customers?')),
        undefined,
        { revalidate: true },
      );
      await onSaved();
      setEditing(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setAccountId(initialAccountId ?? '');
    setError(null);
    setEditing(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <Link2 className="w-4 h-4 text-gray-400" />
          {title}
        </h3>
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600 transition">
            <Pencil className="w-3.5 h-3.5" />
            {t.common.edit}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleCancel} disabled={saving}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
              <X className="w-3.5 h-3.5" />
              {t.common.cancel}
            </button>
            <button type="button" onClick={handleSave} disabled={saving || accountsLoading}
              className="flex items-center gap-1 px-2.5 py-1 bg-brand-600 text-white rounded text-xs font-medium hover:bg-brand-700 disabled:opacity-50">
              <Check className="w-3.5 h-3.5" />
              {saving ? t.common.saving : t.common.save}
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">{label}</label>
        {editing ? (
          <select
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            disabled={accountsLoading}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">{placeholder}</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.name}{a.accountType ? ` · ${a.accountType}` : ''}
              </option>
            ))}
          </select>
        ) : current ? (
          <a href={`/accounts/${current.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 hover:underline">
            <Building2 className="w-3.5 h-3.5" />
            {current.name}
          </a>
        ) : (
          <span className="text-sm text-gray-400">{noneLabel}</span>
        )}
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color = 'text-gray-900' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
      <div className="text-gray-400 mt-0.5 shrink-0">{icon}</div>
      <div>
        <div className="text-xs text-gray-400">{label}</div>
        <div className="text-sm text-gray-800">{value}</div>
      </div>
    </div>
  );
}

// ─── Tab content ──────────────────────────────────────────────────────────────

// D-feladat: konszolidált customer-timeline — a 7 entitás-típust (project /
// contract / invoice / work-order / deal / quote / activity) egy lista-shape-be
// olvasztja és date-DESC rendezi. A type-szín a side-bar dot-on jelenik meg;
// minden item-en a `t.customers.timeline.types.*` HU/EN/IT label kerül.
type TimelineKind = 'project' | 'contract' | 'invoice' | 'workOrder' | 'deal' | 'quote' | 'activity';

interface TimelineItem {
  id: string;
  kind: TimelineKind;
  date: string;
  title: string;
  subtitle?: string;
}

const TIMELINE_DOT_COLOR: Record<TimelineKind, string> = {
  project:   'bg-indigo-500',
  contract:  'bg-amber-500',
  invoice:   'bg-emerald-500',
  workOrder: 'bg-cyan-500',
  deal:      'bg-purple-500',
  quote:     'bg-blue-500',
  activity:  'bg-brand-400',
};

const TIMELINE_BADGE: Record<TimelineKind, string> = {
  project:   'bg-indigo-100 text-indigo-700',
  contract:  'bg-amber-100 text-amber-700',
  invoice:   'bg-emerald-100 text-emerald-700',
  workOrder: 'bg-cyan-100 text-cyan-700',
  deal:      'bg-purple-100 text-purple-700',
  quote:     'bg-blue-100 text-blue-700',
  activity:  'bg-gray-100 text-gray-600',
};

function buildTimeline(summary: CustomerSummary): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const p of summary.recentProjects ?? []) {
    items.push({ id: `proj-${p.id}`, kind: 'project', date: p.createdAt, title: p.name });
  }
  for (const c of summary.recentContracts ?? []) {
    items.push({ id: `con-${c.id}`, kind: 'contract', date: c.createdAt, title: c.title, subtitle: c.contractNumber });
  }
  for (const inv of summary.recentInvoices ?? []) {
    items.push({ id: `inv-${inv.id}`, kind: 'invoice', date: inv.createdAt, title: inv.invoiceNumber });
  }
  for (const wo of summary.recentWorkOrders ?? []) {
    items.push({ id: `wo-${wo.id}`, kind: 'workOrder', date: wo.createdAt, title: wo.workOrderNumber, subtitle: wo.location ?? undefined });
  }
  for (const d of summary.recentDeals) {
    items.push({ id: `deal-${d.id}`, kind: 'deal', date: d.createdAt, title: d.title });
  }
  for (const q of summary.recentQuotes) {
    items.push({ id: `quote-${q.id}`, kind: 'quote', date: q.createdAt, title: q.title, subtitle: q.quoteNumber ?? undefined });
  }
  for (const a of summary.recentActivities) {
    items.push({ id: `act-${a.id}`, kind: 'activity', date: a.createdAt ?? a.occurredAt, title: ACTIVITY_LABELS[a.activityType] ?? a.activityType, subtitle: a.subject });
  }

  return items.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime());
}

function ConsolidatedTimeline({ summary }: { summary: CustomerSummary }) {
  const t = useT();
  const items = buildTimeline(summary).slice(0, 20);
  const typeLabels = (t.customers as Record<string, any>).timeline?.types as Record<string, string> | undefined;
  const title = (t.customers as Record<string, any>).timeline?.title ?? 'Idővonal';
  const emptyLabel = (t.customers as Record<string, any>).tabEmpty?.timeline ?? 'Nincs esemény';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 py-6 text-center">{emptyLabel}</p>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {items.map(it => (
            <div key={it.id} className="flex gap-3">
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${TIMELINE_DOT_COLOR[it.kind]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${TIMELINE_BADGE[it.kind]}`}>
                    {typeLabels?.[it.kind] ?? it.kind}
                  </span>
                  <span className="text-xs font-medium text-gray-700 truncate">{it.title}</span>
                  {it.subtitle && <span className="text-xs text-gray-400 truncate">· {it.subtitle}</span>}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {new Date(it.date).toLocaleDateString('hu-HU')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OverviewTab({ summary }: { summary: CustomerSummary }) {
  const { customer } = summary;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Contact card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Kapcsolati adatok</h3>
        <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={customer.email} />
        <InfoRow icon={<Phone className="w-4 h-4" />} label="Telefon" value={customer.phone} />
        <InfoRow icon={<Globe className="w-4 h-4" />} label="Weboldal" value={customer.website} />
        <InfoRow icon={<Building2 className="w-4 h-4" />} label="Cég" value={customer.company} />
        <InfoRow icon={<FileText className="w-4 h-4" />} label="Adószám" value={customer.taxNumber} />
        <InfoRow icon={<User className="w-4 h-4" />} label="Forrás" value={customer.source} />
        {customer.notes && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 whitespace-pre-wrap">{customer.notes}</div>
        )}
      </div>

      {/* D-feladat: konszolidált customer-timeline (project + contract + invoice + work-order + deal + quote + activity) */}
      <ConsolidatedTimeline summary={summary} />
    </div>
  );
}

function DealsTab({ summary }: { summary: CustomerSummary }) {
  if (summary.recentDeals.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">Nincs ügylet</p>;
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Cím</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Státusz</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Érték</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Létrehozva</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {summary.recentDeals.map(deal => (
            <tr key={deal.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{deal.title}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${DEAL_STAGE_STYLES[deal.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                  {DEAL_STAGE_LABELS[deal.stage] ?? deal.stage}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-gray-700">{fmt(deal.value, deal.currency ?? 'HUF')}</td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {new Date(deal.createdAt).toLocaleDateString('hu-HU')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuotesTab({ summary }: { summary: CustomerSummary }) {
  if (summary.recentQuotes.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">Nincs árajánlat</p>;
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Szám / Cím</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Állapot</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Összeg</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Létrehozva</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {summary.recentQuotes.map(q => (
            <tr key={q.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="font-mono text-xs text-gray-400">{q.quoteNumber}</div>
                <div className="font-medium text-gray-900 text-sm">{q.title}</div>
              </td>
              <td className="px-4 py-3">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                  {q.state}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-gray-700">{fmt(q.totalAmount, q.currency ?? 'HUF')}</td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {new Date(q.createdAt).toLocaleDateString('hu-HU')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivitiesTab({ summary }: { summary: CustomerSummary }) {
  if (summary.recentActivities.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">Nincs tevékenység</p>;
  }
  return (
    <div className="space-y-3">
      {summary.recentActivities.map(act => (
        <div key={act.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex gap-3">
          <Activity className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-700">
                {ACTIVITY_LABELS[act.activityType] ?? act.activityType}
              </span>
              {act.subject && <span className="text-sm text-gray-900">{act.subject}</span>}
            </div>
            {act.body && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{act.body}</p>}
            <div className="text-[10px] text-gray-400 mt-1">
              {new Date(act.occurredAt).toLocaleDateString('hu-HU')} · {act.createdByName ?? act.createdBy}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// γ_polish: a régi AuditTab a `/audit/filter` választ tömbként kezelte, miközben a
// backend `{ data, total }` shape-t ad vissza — ez némán üres timeline-t okozott.
// Lecseréltük a megosztott <AuditTimeline /> komponensre (lásd quotes/[id], contracts/[id]),
// így konzisztens ikon-rail + i18n-action-label + diff-extrakció jár vele.

const CONTRACT_STATE_STYLES: Record<string, string> = {
  draft:      'bg-gray-100 text-gray-600',
  active:     'bg-green-100 text-green-700',
  expired:    'bg-red-100 text-red-600',
  terminated: 'bg-gray-100 text-gray-400',
};
const CONTRACT_STATE_LABELS: Record<string, string> = {
  draft: 'Vázlat', active: 'Aktív', expired: 'Lejárt', terminated: 'Megszüntetve',
};

const INVOICE_STATE_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', issued: 'bg-blue-100 text-blue-700',
  sent: 'bg-cyan-100 text-cyan-700', paid: 'bg-green-100 text-green-700',
  partially_paid: 'bg-teal-100 text-teal-700', overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400', credited: 'bg-purple-100 text-purple-700',
};
const INVOICE_STATE_LABELS: Record<string, string> = {
  draft: 'Vázlat', issued: 'Kiállítva', sent: 'Elküldve', paid: 'Fizetve',
  partially_paid: 'Részben fizetve', overdue: 'Lejárt', cancelled: 'Törölve', credited: 'Jóváírva',
};

const WO_STATE_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', active: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700', archived: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};
const WO_STATE_LABELS: Record<string, string> = {
  draft: 'Vázlat', active: 'Aktív', completed: 'Befejezett', archived: 'Archivált', cancelled: 'Visszavont',
};

// D-feladat: ProjectsTab — a customer-summary recentProjects-jén alapul (top 10).
const PROJECT_STATE_STYLES: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-600',
  active:    'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  archived:  'bg-yellow-100 text-yellow-700',
};
const PROJECT_STATE_LABELS: Record<string, string> = {
  draft: 'Vázlat', active: 'Aktív', completed: 'Befejezett', archived: 'Archivált',
};

function ProjectsTab({ summary, emptyLabel }: { summary: CustomerSummary; emptyLabel: string }) {
  const items = summary.recentProjects ?? [];
  if (items.length === 0) return <p className="text-sm text-gray-400 py-8 text-center">{emptyLabel}</p>;
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Név</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Állapot</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Kezdet / Vég</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Létrehozva</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map(p => (
            <tr key={p.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${PROJECT_STATE_STYLES[p.state] ?? 'bg-gray-100 text-gray-600'}`}>
                  {PROJECT_STATE_LABELS[p.state] ?? p.state}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {p.startDate ? new Date(p.startDate).toLocaleDateString('hu-HU') : '—'}
                {p.endDate ? ` – ${new Date(p.endDate).toLocaleDateString('hu-HU')}` : ''}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {new Date(p.createdAt).toLocaleDateString('hu-HU')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContractsTab({ summary, emptyLabel }: { summary: CustomerSummary; emptyLabel: string }) {
  const items = summary.recentContracts ?? [];
  if (items.length === 0) return <p className="text-sm text-gray-400 py-8 text-center">{emptyLabel}</p>;
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Szám / Cím</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Állapot</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Érték</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Kezdet / Vég</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map(c => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="font-mono text-xs text-gray-400">{c.contractNumber}</div>
                <div className="font-medium text-gray-900">{c.title}</div>
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${CONTRACT_STATE_STYLES[c.state] ?? 'bg-gray-100 text-gray-600'}`}>
                  {CONTRACT_STATE_LABELS[c.state] ?? c.state}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-gray-700">
                {c.value != null ? new Intl.NumberFormat('hu-HU').format(c.value) + ' ' + (c.currency ?? 'HUF') : '—'}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {c.startDate ? new Date(c.startDate).toLocaleDateString('hu-HU') : '—'}
                {c.endDate ? ` – ${new Date(c.endDate).toLocaleDateString('hu-HU')}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoicesTab({ summary, emptyLabel }: { summary: CustomerSummary; emptyLabel: string }) {
  const items = summary.recentInvoices ?? [];
  if (items.length === 0) return <p className="text-sm text-gray-400 py-8 text-center">{emptyLabel}</p>;
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Szám</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Állapot</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Összeg</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Határidő</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map(inv => (
            <tr key={inv.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="font-mono text-xs text-gray-700">{inv.invoiceNumber}</div>
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${INVOICE_STATE_STYLES[inv.state] ?? 'bg-gray-100 text-gray-600'}`}>
                  {INVOICE_STATE_LABELS[inv.state] ?? inv.state}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-gray-700">
                {inv.totalAmount != null ? new Intl.NumberFormat('hu-HU').format(inv.totalAmount) + ' ' + (inv.currency ?? 'HUF') : '—'}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('hu-HU') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkOrdersTab({ summary, emptyLabel }: { summary: CustomerSummary; emptyLabel: string }) {
  const items = summary.recentWorkOrders ?? [];
  if (items.length === 0) return <p className="text-sm text-gray-400 py-8 text-center">{emptyLabel}</p>;
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Szám / Helyszín</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Állapot</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Határidő</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Felelős</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map(wo => (
            <tr key={wo.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="font-mono text-xs text-gray-400">{wo.workOrderNumber}</div>
                <div className="font-medium text-gray-900">{wo.location ?? '—'}</div>
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${WO_STATE_STYLES[wo.state] ?? 'bg-gray-100 text-gray-600'}`}>
                  {WO_STATE_LABELS[wo.state] ?? wo.state}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {wo.deadline ? new Date(wo.deadline).toLocaleDateString('hu-HU') : '—'}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">{wo.responsiblePerson ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'deals' | 'quotes' | 'projects' | 'activities' | 'audit' | 'contracts' | 'invoices' | 'work-orders';

// D-feladat: i18n-driven tab-labelek (`t.customers.tabs.*`) — a `key` mapping
// a tabs-objektum kulcsára mutat, így HU/EN/IT pluginok automatikusan jönnek.
const TAB_DEFS: { id: Tab; key: string; icon: React.ReactNode }[] = [
  { id: 'overview',    key: 'overview',   icon: <User className="w-4 h-4" /> },
  { id: 'deals',       key: 'deals',      icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'quotes',      key: 'quotes',     icon: <FileText className="w-4 h-4" /> },
  { id: 'projects',    key: 'projects',   icon: <Folder className="w-4 h-4" /> },
  { id: 'contracts',   key: 'contracts',  icon: <FileSignature className="w-4 h-4" /> },
  { id: 'invoices',    key: 'invoices',   icon: <Receipt className="w-4 h-4" /> },
  { id: 'work-orders', key: 'workOrders', icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'activities',  key: 'activities', icon: <Activity className="w-4 h-4" /> },
  { id: 'audit',       key: 'audit',      icon: <ClipboardList className="w-4 h-4" /> },
];

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { summary, isLoading, error, mutate } = useCustomerSummary(id ?? null);

  if (isLoading) return <div className="p-8 text-gray-400">{t.common.loading}</div>;
  if (error || !summary) return (
    <div className="p-8 text-red-500">Nem sikerült betölteni az ügyfelet.</div>
  );

  const { customer, stats } = summary;
  const lifecycle = customer.lifecycleStage ?? 'other';
  // D-feladat: tab-labelek + empty-state üzenetek a t.customers.tabs / empty kulcsból.
  const tabLabels = (t.customers as Record<string, any>).tabs as Record<string, string> | undefined ?? {};
  const emptyLabels = (t.customers as Record<string, any>).tabEmpty as Record<string, string> | undefined ?? {};

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => router.push('/customers')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition">
          <ArrowLeft className="w-4 h-4" />
          Ügyfelek
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-700 font-medium">
          {customer.firstName} {customer.lastName}
        </span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
                {customer.firstName} {customer.lastName}
              </h1>
              {!customer.isActive && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">Inaktív</span>
              )}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${LIFECYCLE_STYLES[lifecycle] ?? 'bg-gray-100 text-gray-600'}`}>
                {(t.customers.lifecycle as Record<string, string>)[lifecycle] ?? lifecycle}
              </span>
            </div>
            {customer.company && (
              <div className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {customer.company}
              </div>
            )}
            {customer.tags && customer.tags.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <Tag className="w-3 h-3 text-gray-400" />
                {customer.tags.map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Lead score */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="font-semibold">{customer.leadScore}</span>
              <span className="text-gray-400">/ 100</span>
            </div>
            <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all"
                style={{ width: `${Math.min(100, customer.leadScore)}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400">Lead score</span>
          </div>
        </div>
      </div>

      {/* B-task: lifecycle + lead-score inline szerkesztő */}
      <LifecycleEditPanel
        customerId={customer.id}
        initialStage={customer.lifecycleStage ?? 'other'}
        initialScore={customer.leadScore ?? 0}
        onSaved={() => mutate()}
      />

      {/* H-feladat: B2B Account-link inline szerkesztő */}
      <AccountLinkPanel
        customerId={customer.id}
        initialAccountId={(customer as any).accountId ?? undefined}
        onSaved={() => mutate()}
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Összes ügylet" value={String(stats.totalDeals)} />
        <StatCard label="Nyert" value={String(stats.wonDeals)} color="text-green-600" />
        <StatCard label="Nyitott" value={String(stats.openDeals)} color="text-blue-600" />
        <StatCard label="Számlák" value={String(stats.invoiceCount)} />
        <StatCard label="Befizetve" value={fmt(stats.totalPaid)} color="text-green-600" />
        <StatCard label="Kinnlevőség" value={fmt(stats.totalOutstanding)} color={stats.totalOutstanding > 0 ? 'text-red-600' : 'text-gray-900'} />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 flex-wrap">
          {TAB_DEFS.map(tab => {
            const label = tabLabels[tab.key] ?? tab.key;
            const badge =
              tab.id === 'deals'       ? stats.totalDeals :
              tab.id === 'quotes'      ? summary.recentQuotes.length :
              tab.id === 'projects'    ? (summary.recentProjects?.length ?? stats.projectCount ?? 0) :
              tab.id === 'contracts'   ? (summary.recentContracts?.length ?? stats.contractCount ?? 0) :
              tab.id === 'invoices'    ? (summary.recentInvoices?.length ?? stats.invoiceCount) :
              tab.id === 'work-orders' ? (summary.recentWorkOrders?.length ?? stats.workOrderCount ?? 0) :
              tab.id === 'activities'  ? summary.recentActivities.length :
              0;
            return (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
                  activeTab === tab.id
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}>
                {tab.icon}
                {label}
                {badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded-full">{badge}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview'    && <OverviewTab summary={summary} />}
        {activeTab === 'deals'       && <DealsTab summary={summary} />}
        {activeTab === 'quotes'      && <QuotesTab summary={summary} />}
        {activeTab === 'projects'    && <ProjectsTab summary={summary} emptyLabel={emptyLabels.projects ?? 'Nincs projekt'} />}
        {activeTab === 'contracts'   && <ContractsTab summary={summary} emptyLabel={emptyLabels.contracts ?? 'Nincs szerződés'} />}
        {activeTab === 'invoices'    && <InvoicesTab summary={summary} emptyLabel={emptyLabels.invoices ?? 'Nincs számla'} />}
        {activeTab === 'work-orders' && <WorkOrdersTab summary={summary} emptyLabel={emptyLabels.workOrders ?? 'Nincs munkalap'} />}
        {activeTab === 'activities'  && <ActivitiesTab summary={summary} />}
        {activeTab === 'audit'       && <AuditTimeline resource="customer" resourceId={customer.id} />}
      </div>
    </div>
  );
}
