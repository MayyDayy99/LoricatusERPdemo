'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Plus, ArrowRight, Trash2, Phone, Mail, Users, StickyNote, MapPin, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/lib/hooks/use-t';
import { toast } from 'sonner';
import { ActivityModal } from '@/components/crm/activity-modal';
import type { CrmActivity } from '@/lib/hooks/use-crm';

/* ── Activity-type display config (shared with /crm/activities) ── */
const ACTIVITY_TYPE_ICONS: Record<string, React.ElementType> = {
  CALL:       Phone,
  EMAIL:      Mail,
  MEETING:    Users,
  NOTE:       StickyNote,
  SITE_VISIT: MapPin,
};
const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  CALL:       'Hívás',
  EMAIL:      'E-mail',
  MEETING:    'Megbeszélés',
  NOTE:       'Jegyzet',
  SITE_VISIT: 'Helyszín',
  TASK_COMPLETED: 'Teendő',
  SYSTEM:     'Rendszer',
};
const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  CALL:       'bg-blue-100 text-blue-700',
  EMAIL:      'bg-cyan-100 text-cyan-700',
  MEETING:    'bg-purple-100 text-purple-700',
  NOTE:       'bg-gray-100 text-gray-600',
  SITE_VISIT: 'bg-green-100 text-green-700',
  TASK_COMPLETED: 'bg-amber-100 text-amber-700',
  SYSTEM:     'bg-gray-100 text-gray-500',
};

/* ── Types ──────────────────────────────────────────────────── */
// A backend (packages/domain DealStage / DealTransition) értékeit tükrözzük —
// minden összekulcsolva, ne legyen szétcsúszás a payload-validációval.

const STAGE = {
  LEAD:          'lead',
  QUALIFIED:     'qualified',
  PROPOSAL_SENT: 'proposal_sent',
  NEGOTIATION:   'negotiation',
  WON:           'won',
  LOST:          'lost',
} as const;
type DealStage = typeof STAGE[keyof typeof STAGE];

const TRANSITION = {
  QUALIFY:        'qualify',
  SEND_PROPOSAL:  'send_proposal',
  NEGOTIATE:      'negotiate',
  WIN:            'win',
  LOSE:           'lose',
} as const;
type DealTransition = typeof TRANSITION[keyof typeof TRANSITION];

interface Deal {
  id: string;
  title: string;
  value?: number;
  currency?: string;
  probability?: number;
  expectedCloseDate?: string;
  stage: DealStage;
  assignedTo?: string;
  customer?: { id: string; firstName: string; lastName: string; company?: string };
}

interface Customer { id: string; firstName: string; lastName: string; company?: string; }

const ACTIVE_STAGES: DealStage[] = [STAGE.LEAD, STAGE.QUALIFIED, STAGE.PROPOSAL_SENT, STAGE.NEGOTIATION];
const CLOSED_STAGES: DealStage[] = [STAGE.WON, STAGE.LOST];

const STAGE_COLORS: Record<DealStage, string> = {
  [STAGE.LEAD]:          'bg-blue-100 text-blue-700 border-blue-200',
  [STAGE.QUALIFIED]:     'bg-cyan-100 text-cyan-700 border-cyan-200',
  [STAGE.PROPOSAL_SENT]: 'bg-amber-100 text-amber-700 border-amber-200',
  [STAGE.NEGOTIATION]:   'bg-purple-100 text-purple-700 border-purple-200',
  [STAGE.WON]:           'bg-green-100 text-green-700 border-green-200',
  [STAGE.LOST]:          'bg-red-100 text-red-700 border-red-200',
};

/* ── Deal Activities Tab — list of activities scoped to the deal ── */
function DealActivitiesTab({ dealId, customers }: { dealId: string; customers: Customer[] }) {
  const t = useT();
  const fetcher = (url: string) => apiClient.get(url).then(r => r.data);
  const { data, isLoading, mutate } = useSWR<CrmActivity[]>(`/activities?dealId=${dealId}`, fetcher);
  const [showNew, setShowNew] = useState(false);
  const activities = data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {t.activities.countBadge(activities.length)}
        </div>
        <button type="button" onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-brand-700 transition">
          <Plus className="w-3.5 h-3.5" /> {t.activities.addInDealBtn}
        </button>
      </div>

      <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1 space-y-2">
        {isLoading && (
          <div className="text-center text-gray-400 py-8 text-sm">{t.common.loading}</div>
        )}
        {!isLoading && activities.length === 0 && (
          <div className="text-center text-gray-400 py-8 text-sm">
            {t.activities.emptyInDeal}
          </div>
        )}
        {activities.map(a => {
          const Icon = ACTIVITY_TYPE_ICONS[a.activityType] ?? StickyNote;
          const colorCls = ACTIVITY_TYPE_COLORS[a.activityType] ?? ACTIVITY_TYPE_COLORS.NOTE;
          const occurredAt = a.occurredAt ?? a.createdAt;
          const dateStr = new Date(occurredAt).toLocaleString('hu-HU', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          });
          return (
            <div key={a.id} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50/50 transition">
              <div className={`flex-shrink-0 p-1.5 rounded ${colorCls}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-medium text-gray-900 truncate">
                    <span className="text-gray-400 mr-1">{ACTIVITY_TYPE_LABELS[a.activityType] ?? a.activityType}:</span>
                    {a.subject || '—'}
                  </div>
                  <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" />
                    {dateStr}
                  </span>
                </div>
                {a.body && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.body}</p>
                )}
                {a.createdByName && (
                  <div className="text-[10px] text-gray-400 mt-0.5">{a.createdByName}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showNew && (
        <ActivityModal
          dealId={dealId}
          customers={customers}
          hideRelations={false}
          onClose={() => setShowNew(false)}
          onSaved={() => mutate()}
        />
      )}
    </div>
  );
}

/* ── Create / Edit Modal ───────────────────────────────────── */
function DealModal({
  deal, customers, onClose, onSaved,
}: {
  deal?: Deal;
  customers: Customer[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState({
    title: deal?.title ?? '',
    value: deal?.value?.toString() ?? '',
    currency: deal?.currency ?? 'HUF',
    probability: deal?.probability?.toString() ?? '',
    expectedCloseDate: deal?.expectedCloseDate?.slice(0, 10) ?? '',
    customerId: deal?.customer?.id ?? '',
  });
  const [loading, setLoading] = useState(false);
  const isEdit = !!deal;
  const hasActivitiesTab = !!(deal && deal.id);
  const [tab, setTab] = useState<'details' | 'activities'>('details');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title: form.title,
        value: form.value ? parseFloat(form.value) : undefined,
        currency: form.currency || 'HUF',
        probability: form.probability ? parseInt(form.probability, 10) : undefined,
        expectedCloseDate: form.expectedCloseDate || undefined,
        customerId: form.customerId || undefined,
      };
      if (isEdit) {
        await apiClient.patch(`/deals/${deal!.id}`, payload);
      } else {
        await apiClient.post('/deals', payload);
      }
      toast.success(t.common.saved);
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-3">
          {isEdit ? t.deals.editTitle : t.deals.newTitle}
        </h2>

        {/* Tabs (only meaningful when editing an existing deal) */}
        {hasActivitiesTab && (
          <div className="flex border-b border-gray-200 mb-4 -mx-1">
            <button type="button" onClick={() => setTab('details')}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                tab === 'details'
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.activities.dealTabDetails}
            </button>
            <button type="button" onClick={() => setTab('activities')}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                tab === 'activities'
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.activities.dealTabActivities}
            </button>
          </div>
        )}

        {tab === 'details' && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input required className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder={t.deals.titlePh} value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />

            <select className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
              <option value="">— {t.deals.colCustomer} —</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}{c.company ? ` (${c.company})` : ''}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-3 gap-2">
              <input type="number" min="0" step="1" className="border rounded-lg px-3 py-2 text-sm"
                placeholder={t.deals.valuePh} value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
              <select className="border rounded-lg px-2 py-2 text-sm"
                value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                <option>HUF</option><option>EUR</option><option>USD</option>
              </select>
              <input type="number" min="0" max="100" className="border rounded-lg px-3 py-2 text-sm"
                placeholder={t.deals.probabilityPh} value={form.probability}
                onChange={e => setForm(f => ({ ...f, probability: e.target.value }))} />
            </div>

            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.expectedCloseDate}
              onChange={e => setForm(f => ({ ...f, expectedCloseDate: e.target.value }))} />

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">{t.common.cancel}</button>
              <button type="submit" disabled={loading}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                {loading ? t.common.saving : t.common.save}
              </button>
            </div>
          </form>
        )}

        {tab === 'activities' && hasActivitiesTab && (
          <DealActivitiesTab dealId={deal!.id} customers={customers} />
        )}
      </div>
    </div>
  );
}

/* ── Transition Modal ──────────────────────────────────────── */
function TransitionModal({
  deal, onClose, onSaved,
}: {
  deal: Deal;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [target, setTarget] = useState<DealStage | ''>('');
  const [lostReason, setLostReason] = useState('');
  const [loading, setLoading] = useState(false);

  const transitions: Record<DealStage, DealStage[]> = {
    [STAGE.LEAD]:          [STAGE.QUALIFIED, STAGE.LOST],
    [STAGE.QUALIFIED]:     [STAGE.PROPOSAL_SENT, STAGE.LOST],
    [STAGE.PROPOSAL_SENT]: [STAGE.NEGOTIATION, STAGE.LOST],
    [STAGE.NEGOTIATION]:   [STAGE.WON, STAGE.LOST],
    [STAGE.WON]:           [],
    [STAGE.LOST]:          [],
  };

  const options = transitions[deal.stage] ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setLoading(true);
    try {
      const transitionMap: Record<DealStage, DealTransition | undefined> = {
        [STAGE.LEAD]:          undefined,
        [STAGE.QUALIFIED]:     TRANSITION.QUALIFY,
        [STAGE.PROPOSAL_SENT]: TRANSITION.SEND_PROPOSAL,
        [STAGE.NEGOTIATION]:   TRANSITION.NEGOTIATE,
        [STAGE.WON]:           TRANSITION.WIN,
        [STAGE.LOST]:          TRANSITION.LOSE,
      };
      await apiClient.post(`/deals/${deal.id}/transition`, {
        transition: transitionMap[target],
        lostReason: target === STAGE.LOST ? lostReason || undefined : undefined,
      });
      toast.success(t.common.saved);
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-4">{t.deals.transition}: {deal.title}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <select required className="w-full border rounded-lg px-3 py-2 text-sm"
            value={target} onChange={e => setTarget(e.target.value as DealStage)}>
            <option value="">— {t.deals.colStage} —</option>
            {options.map(s => (
              <option key={s} value={s}>{t.deals.stages[s]}</option>
            ))}
          </select>
          {target === STAGE.LOST && (
            <input className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder={t.deals.lostReasonPh} value={lostReason}
              onChange={e => setLostReason(e.target.value)} />
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600">{t.common.cancel}</button>
            <button type="submit" disabled={loading || !target}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {loading ? t.common.saving : t.deals.transition}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Kanban Card ───────────────────────────────────────────── */
function DealCard({
  deal, onTransition, onEdit, onDelete,
}: {
  deal: Deal;
  onTransition: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const fmt = (v?: number, c?: string) =>
    v != null ? new Intl.NumberFormat('hu-HU').format(v) + ' ' + (c ?? 'HUF') : '—';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition cursor-pointer"
      onClick={onEdit}>
      <div className="font-medium text-sm text-gray-900 truncate">{deal.title}</div>
      {deal.customer && (
        <div className="text-xs text-gray-500 mt-1 truncate">
          {deal.customer.firstName} {deal.customer.lastName}
          {deal.customer.company ? ` · ${deal.customer.company}` : ''}
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm font-semibold text-gray-900">{fmt(deal.value, deal.currency)}</span>
        {deal.probability != null && (
          <span className="text-xs text-gray-400">{deal.probability}%</span>
        )}
      </div>
      {deal.expectedCloseDate && (
        <div className="text-xs text-gray-400 mt-1">
          {t.deals.colClose}: {new Date(deal.expectedCloseDate).toLocaleDateString('hu-HU')}
        </div>
      )}
      <div className="flex gap-1 mt-2">
        <button onClick={e => { e.stopPropagation(); onTransition(); }}
          className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition">
          <ArrowRight className="w-3 h-3 inline" /> {t.deals.transition}
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded transition">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────── */
export default function DealsPage() {
  const t = useT();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [showCreate, setShowCreate] = useState(false);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [transitionDeal, setTransitionDeal] = useState<Deal | null>(null);

  const fetchDeals = async () => {
    try {
      const [dRes, cRes] = await Promise.all([
        apiClient.get('/deals'),
        // A /customers paginated: {items,total,take,skip}. Kompat-fallback a régi tömb-shape-re.
        apiClient.get('/customers?take=1000'),
      ]);
      setDeals(dRes.data);
      setCustomers(cRes.data?.items ?? cRes.data ?? []);
    } catch { /* handled */ } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchDeals(); }, []);

  const handleDelete = async (deal: Deal) => {
    try {
      await apiClient.delete(`/deals/${deal.id}`);
      toast.success(t.common.saved);
      fetchDeals();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Hiba');
    }
  };

  /* Kanban columns for active stages */
  const stageDeals = (stage: DealStage) => deals.filter(d => d.stage === stage);
  const stageTotal = (stage: DealStage) =>
    stageDeals(stage).reduce((s, d) => s + (d.value ?? 0), 0);

  if (loading) return <div className="p-8 text-gray-400">{t.common.loading}</div>;

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.deals.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{t.deals.subtitle(deals.length)}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setView('kanban')}
              className={`px-3 py-1.5 text-xs font-medium ${view === 'kanban' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50'}`}>
              {t.deals.kanban}
            </button>
            <button onClick={() => setView('list')}
              className={`px-3 py-1.5 text-xs font-medium ${view === 'list' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50'}`}>
              {t.deals.list}
            </button>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
            <Plus className="w-4 h-4" /> {t.deals.newBtn}
          </button>
        </div>
      </div>

      {/* Kanban View */}
      {view === 'kanban' && (
        <div data-tour="deals-kanban" className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {ACTIVE_STAGES.map(stage => (
            <div key={stage} className="flex-shrink-0 w-72">
              <div className={`rounded-t-lg px-3 py-2 border ${STAGE_COLORS[stage]} flex items-center justify-between`}>
                <span className="text-sm font-semibold">{t.deals.stages[stage]}</span>
                <span className="text-xs font-medium">{stageDeals(stage).length}</span>
              </div>
              <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1 border-x border-gray-200">
                {new Intl.NumberFormat('hu-HU').format(stageTotal(stage))} HUF
              </div>
              <div className="bg-gray-50/50 border border-t-0 border-gray-200 rounded-b-lg p-2 space-y-2 min-h-[200px]">
                {stageDeals(stage).length === 0 && (
                  <div className="text-xs text-gray-300 text-center py-8">—</div>
                )}
                {stageDeals(stage).map(deal => (
                  <DealCard key={deal.id} deal={deal}
                    onTransition={() => setTransitionDeal(deal)}
                    onEdit={() => setEditDeal(deal)}
                    onDelete={() => handleDelete(deal)} />
                ))}
              </div>
            </div>
          ))}

          {/* Won / Lost summary columns */}
          {CLOSED_STAGES.map(stage => (
            <div key={stage} className="flex-shrink-0 w-56">
              <div className={`rounded-t-lg px-3 py-2 border ${STAGE_COLORS[stage]} flex items-center justify-between`}>
                <span className="text-sm font-semibold">{t.deals.stages[stage]}</span>
                <span className="text-xs font-medium">{stageDeals(stage).length}</span>
              </div>
              <div className="bg-gray-50/50 border border-t-0 border-gray-200 rounded-b-lg p-2 space-y-1 max-h-64 overflow-y-auto">
                {stageDeals(stage).map(d => (
                  <div key={d.id} className="text-xs text-gray-600 bg-white rounded px-2 py-1 border">
                    {d.title} — {d.value ? new Intl.NumberFormat('hu-HU').format(d.value) : '—'}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.deals.colTitle}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.deals.colCustomer}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.deals.colStage}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{t.deals.colValue}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">{t.deals.colProb}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.deals.colClose}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{t.deals.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deals.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">{t.deals.empty}</td></tr>
              )}
              {deals.map(deal => (
                <tr key={deal.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{deal.title}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {deal.customer ? `${deal.customer.firstName} ${deal.customer.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STAGE_COLORS[deal.stage]}`}>
                      {t.deals.stages[deal.stage]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {deal.value ? new Intl.NumberFormat('hu-HU').format(deal.value) + ' ' + (deal.currency ?? 'HUF') : '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{deal.probability ?? '—'}%</td>
                  <td className="px-4 py-3 text-gray-500">
                    {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString('hu-HU') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <button onClick={() => setTransitionDeal(deal)}
                      className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded">
                      <ArrowRight className="w-3 h-3 inline" />
                    </button>
                    <button onClick={() => setEditDeal(deal)}
                      className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded">
                      {t.common.edit}
                    </button>
                    <button onClick={() => handleDelete(deal)}
                      className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded">
                      <Trash2 className="w-3 h-3 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <DealModal customers={customers} onClose={() => setShowCreate(false)} onSaved={fetchDeals} />
      )}
      {editDeal && (
        <DealModal deal={editDeal} customers={customers}
          onClose={() => setEditDeal(null)} onSaved={fetchDeals} />
      )}
      {transitionDeal && (
        <TransitionModal deal={transitionDeal}
          onClose={() => setTransitionDeal(null)} onSaved={fetchDeals} />
      )}
    </div>
  );
}
