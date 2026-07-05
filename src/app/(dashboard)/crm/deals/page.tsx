'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { ChevronRight, Pencil, Plus, TrendingUp, Trash2, Search, SlidersHorizontal, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/lib/hooks/use-t';
import { useCanAccess } from '@/lib/hooks/use-access';
import { useTenant } from '@/lib/hooks/use-tenants';
import {
  useDeals, usePipelines, transitionDeal, createDeal, updateDeal, deleteDeal,
  type Deal, type Pipeline, type CreateDealDto,
} from '@/lib/hooks/use-crm';
import { CsvExportButton } from '@/components/csv/csv-export-import';

// ─── Stage config ─────────────────────────────────────────────────────────────
// A backend (packages/domain DealStage / DealTransition) KISBETŰS enum-okat
// használ — itt is ahhoz igazodunk, hogy ne csússzon el a payload-validáció.

const STAGE = {
  LEAD:          'lead',
  QUALIFIED:     'qualified',
  PROPOSAL_SENT: 'proposal_sent',
  NEGOTIATION:   'negotiation',
  WON:           'won',
  LOST:          'lost',
} as const;
type Stage = typeof STAGE[keyof typeof STAGE];

const TRANSITION = {
  QUALIFY:        'qualify',
  SEND_PROPOSAL:  'send_proposal',
  NEGOTIATE:      'negotiate',
  WIN:            'win',
  LOSE:           'lose',
} as const;
type Transition = typeof TRANSITION[keyof typeof TRANSITION];

const STAGE_ORDER: Stage[] = [
  STAGE.LEAD, STAGE.QUALIFIED, STAGE.PROPOSAL_SENT, STAGE.NEGOTIATION, STAGE.WON, STAGE.LOST,
];

const STAGE_COLORS: Record<Stage, string> = {
  [STAGE.LEAD]:          'border-gray-200 bg-gray-50',
  [STAGE.QUALIFIED]:     'border-blue-200 bg-blue-50',
  [STAGE.PROPOSAL_SENT]: 'border-purple-200 bg-purple-50',
  [STAGE.NEGOTIATION]:   'border-yellow-200 bg-yellow-50',
  [STAGE.WON]:           'border-green-200 bg-green-50',
  [STAGE.LOST]:          'border-red-200 bg-red-50',
};

const STAGE_HEADER: Record<Stage, string> = {
  [STAGE.LEAD]:          'text-gray-600',
  [STAGE.QUALIFIED]:     'text-blue-700',
  [STAGE.PROPOSAL_SENT]: 'text-purple-700',
  [STAGE.NEGOTIATION]:   'text-yellow-700',
  [STAGE.WON]:           'text-green-700',
  [STAGE.LOST]:          'text-red-600',
};

const NEXT_TRANSITION: Partial<Record<Stage, Transition>> = {
  [STAGE.LEAD]:          TRANSITION.QUALIFY,
  [STAGE.QUALIFIED]:     TRANSITION.SEND_PROPOSAL,
  [STAGE.PROPOSAL_SENT]: TRANSITION.NEGOTIATE,
  [STAGE.NEGOTIATION]:   TRANSITION.WIN,
};

// Target stage → transition name (for drag-and-drop)
const STAGE_TO_TRANSITION: Partial<Record<Stage, Transition>> = {
  [STAGE.QUALIFIED]:     TRANSITION.QUALIFY,
  [STAGE.PROPOSAL_SENT]: TRANSITION.SEND_PROPOSAL,
  [STAGE.NEGOTIATION]:   TRANSITION.NEGOTIATE,
  [STAGE.WON]:           TRANSITION.WIN,
};

const STAGE_LABELS: Record<Stage, string> = {
  [STAGE.LEAD]:          'Lead',
  [STAGE.QUALIFIED]:     'Minősített',
  [STAGE.PROPOSAL_SENT]: 'Ajánlat küldve',
  [STAGE.NEGOTIATION]:   'Tárgyalás',
  [STAGE.WON]:           'Nyert',
  [STAGE.LOST]:          'Elveszett',
};

function formatValue(value?: number, currency?: string) {
  if (!value) return null;
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency', currency: currency ?? 'HUF', maximumFractionDigits: 0,
  }).format(value);
}

// ─── Deal Modal (create + edit) ───────────────────────────────────────────────

interface DealFormState {
  title: string;
  pipelineId: string;
  value: string;
  currency: string;
  probability: string;
  expectedCloseDate: string;
  customerId: string;
  projectId: string;
}

function DealModal({ initial, pipelines, onClose, onSaved }: {
  initial?: Deal;
  pipelines: Pipeline[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const { tenant } = useTenant();
  const defaultCurrency = tenant?.defaultCurrency ?? 'HUF';
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<{ id: string; firstName: string; lastName: string; company?: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    Promise.all([
      // A /customers paginated: {items,total,take,skip}. A fallback még kezeli a régi shape-eket.
      apiClient.get('/customers?take=1000').then(r => setCustomers(r.data?.items ?? r.data?.data ?? r.data ?? [])),
      apiClient.get('/projects').then(r => setProjects(Array.isArray(r.data) ? r.data : (r.data?.data ?? []))),
    ]).catch(() => {});
  }, []);

  const defaultPipeline = pipelines.find(p => p.isDefault)?.id ?? pipelines[0]?.id ?? '';

  const [form, setForm] = useState<DealFormState>({
    title:             initial?.title ?? '',
    pipelineId:        initial?.pipelineId ?? defaultPipeline,
    value:             initial?.value?.toString() ?? '',
    currency:          initial?.currency ?? defaultCurrency,
    probability:       initial?.probability?.toString() ?? '',
    expectedCloseDate: initial?.expectedCloseDate ? initial.expectedCloseDate.slice(0, 10) : '',
    customerId:        initial?.customerId ?? '',
    projectId:         initial?.projectId ?? '',
  });

  const set = (k: keyof DealFormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.pipelineId) return;
    setSaving(true);
    try {
      const dto: Partial<CreateDealDto> = {
        title:             form.title,
        pipelineId:        form.pipelineId,
        value:             form.value ? Number(form.value) : undefined,
        currency:          form.currency || 'HUF',
        probability:       form.probability ? Number(form.probability) : undefined,
        expectedCloseDate: form.expectedCloseDate || undefined,
        customerId:        form.customerId || undefined,
        projectId:         form.projectId || undefined,
      };
      if (initial) {
        await updateDeal(initial.id, dto);
        toast.success('Ügylet frissítve');
      } else {
        await createDeal(dto as CreateDealDto);
        toast.success('Ügylet létrehozva');
      }
      onSaved();
      onClose();
    } catch {
      toast.error('Mentés sikertelen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold">
          {initial ? 'Ügylet szerkesztése' : 'Új ügylet'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required autoFocus
            placeholder="Ügylet neve *"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />

          {pipelines.length > 1 && (
            <select
              value={form.pipelineId}
              onChange={e => set('pipelineId', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {pipelines.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <input
                type="number" min="0" step="1000"
                placeholder="Értéke (HUF)"
                value={form.value}
                onChange={e => set('value', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <select
              value={form.currency}
              onChange={e => set('currency', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="HUF">HUF</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="number" min="0" max="100"
              placeholder="Valószínűség (%)"
              value={form.probability}
              onChange={e => set('probability', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <input
              type="date"
              value={form.expectedCloseDate}
              onChange={e => set('expectedCloseDate', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <select
            value={form.customerId}
            onChange={e => set('customerId', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">— Ügyfél (opcionális) —</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}{c.company ? ` (${c.company})` : ''}
              </option>
            ))}
          </select>

          <select
            value={form.projectId}
            onChange={e => set('projectId', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">— Projekt (opcionális) —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              {t.common.cancel}
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold transition">
              {saving ? t.common.saving : (initial ? t.common.save : t.common.create)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Lost reason modal ────────────────────────────────────────────────────────

function LostReasonModal({ dealId, onClose, onDone }: {
  dealId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post(`/deals/${dealId}/transition`, { transition: TRANSITION.LOSE, lostReason: reason || undefined });
      toast.success('Ügylet elveszettnek jelölve');
      onDone();
      onClose();
    } catch {
      toast.error('Hiba történt');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-semibold">Elveszett ügylet</h2>
        <form onSubmit={handle} className="space-y-3">
          <textarea
            rows={3}
            placeholder="Miért veszett el? (opcionális)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Mégsem
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold transition">
              {saving ? 'Mentés...' : 'Elveszett jelölés'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Deal Card ────────────────────────────────────────────────────────────────

function DealCard({ deal, onTransition, transitioning, onEdit, onDelete, onLose, isDragging, onDragStart, onDragEnd }: {
  deal: Deal;
  onTransition: (id: string, transition: string) => void;
  transitioning: boolean;
  onEdit: (d: Deal) => void;
  onDelete: (d: Deal) => void;
  onLose: (id: string) => void;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
}) {
  const t = useT();
  const canWrite = useCanAccess('crm.tasks.write');
  const nextTransition = NEXT_TRANSITION[deal.stage as Stage];
  const isActive = deal.stage !== STAGE.WON && deal.stage !== STAGE.LOST;

  return (
    <div
      draggable={isActive}
      onDragStart={isActive ? (e) => onDragStart(e, deal.id) : undefined}
      onDragEnd={isActive ? onDragEnd : undefined}
      className={clsx(
        'bg-white rounded-lg border border-gray-100 shadow-sm p-3 space-y-2 group transition-opacity',
        isActive && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-40 scale-95',
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <p
          className="text-sm font-semibold text-gray-900 leading-snug flex-1 cursor-pointer hover:text-brand-700 transition"
          onClick={() => onEdit(deal)}
        >
          {deal.title}
        </p>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
          <Link href={`/crm/deals/${deal.id}`}
            className="p-1 rounded hover:bg-brand-50 text-gray-400 hover:text-brand-600 transition">
            <ExternalLink className="w-3 h-3" />
          </Link>
          {canWrite && (
            <>
              <button type="button" onClick={() => onEdit(deal)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
                <Pencil className="w-3 h-3" />
              </button>
              <button type="button" onClick={() => onDelete(deal)}
                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition">
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {deal.customerName && (
        <p className="text-xs text-gray-400 truncate">{deal.customerName}</p>
      )}
      {deal.value && (
        <p className="text-sm font-medium text-gray-700">{formatValue(deal.value, deal.currency)}</p>
      )}
      {deal.probability != null && (
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full"
              style={{ width: `${deal.probability}%` }}
            />
          </div>
          <span className="text-xs text-gray-400">{deal.probability}%</span>
        </div>
      )}

      {/* Action buttons */}
      {canWrite && isActive && (
        <div className="flex gap-1">
          {nextTransition && (
            <button
              type="button"
              disabled={transitioning}
              onClick={() => onTransition(deal.id, nextTransition)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-medium transition disabled:opacity-60"
            >
              {t.crm.dealTransitions?.[nextTransition as keyof typeof t.crm.dealTransitions] ?? nextTransition}
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
          {deal.stage !== STAGE.LOST && (
            <button
              type="button"
              disabled={transitioning}
              onClick={() => onLose(deal.id)}
              className="px-2 py-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium transition disabled:opacity-60"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({ stage, deals, onTransition, transitioning, onEdit, onDelete, onLose, draggingId, isDragOver, onDragOver, onDragLeave, onDrop, onDragStart, onDragEnd }: {
  stage: Stage;
  deals: Deal[];
  onTransition: (id: string, t: string) => void;
  transitioning: string | null;
  onEdit: (d: Deal) => void;
  onDelete: (d: Deal) => void;
  onLose: (id: string) => void;
  draggingId: string | null;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
}) {
  const totalValue = deals.reduce((s, d) => s + (d.value ?? 0), 0);

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={clsx(
        'rounded-xl border-2 p-3 min-w-[220px] w-[220px] shrink-0 space-y-2 transition-all',
        STAGE_COLORS[stage],
        isDragOver && 'ring-2 ring-brand-400 ring-offset-1 border-brand-300',
      )}
    >
      <div className={clsx('flex items-center justify-between', STAGE_HEADER[stage])}>
        <span className="text-xs font-semibold uppercase tracking-wide">{STAGE_LABELS[stage] ?? stage}</span>
        <span className="text-xs bg-white/60 rounded-full px-1.5 py-0.5 font-medium">{deals.length}</span>
      </div>
      {totalValue > 0 && (
        <p className={clsx('text-xs font-medium opacity-70', STAGE_HEADER[stage])}>
          {new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(totalValue)}
        </p>
      )}
      {deals.map(deal => (
        <DealCard
          key={deal.id}
          deal={deal}
          onTransition={onTransition}
          transitioning={transitioning === deal.id}
          onEdit={onEdit}
          onDelete={onDelete}
          onLose={onLose}
          isDragging={draggingId === deal.id}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ))}
      {deals.length === 0 && (
        <p className={clsx(
          'text-xs text-center py-6 border-2 border-dashed rounded-lg transition-colors',
          isDragOver ? 'border-brand-300 text-brand-400' : 'border-gray-200 text-gray-300',
        )}>
          {isDragOver ? 'Ejtés ide' : '—'}
        </p>
      )}
    </div>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteDealConfirm({ deal, onClose, onDeleted }: {
  deal: Deal;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  async function handle() {
    setDeleting(true);
    try {
      await deleteDeal(deal.id);
      toast.success('Ügylet törölve');
      onDeleted();
      onClose();
    } catch {
      toast.error('Törlés sikertelen');
      setDeleting(false);
    }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-semibold">Ügylet törlése</h2>
        <p className="text-sm text-gray-500">Biztosan törölni: <strong>{deal.title}</strong>?</p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
            Mégsem
          </button>
          <button type="button" disabled={deleting} onClick={handle}
            className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold transition">
            {deleting ? 'Törlés...' : 'Törlés'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DealsPage() {
  const t = useT();
  const canWrite = useCanAccess('crm.tasks.write');
  const { pipelines } = usePipelines();
  const [selectedPipeline, setSelectedPipeline] = useState<string>('');
  const { deals, mutate, isLoading } = useDeals(selectedPipeline ? { pipelineId: selectedPipeline } : undefined);

  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [deleteDealItem, setDeleteDealItem] = useState<Deal | null>(null);
  const [loseId, setLoseId] = useState<string | null>(null);

  // Drag & drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<Stage | null>(null);

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [valueMin, setValueMin] = useState('');
  const [valueMax, setValueMax] = useState('');
  const [closeDateFrom, setCloseDateFrom] = useState('');
  const [closeDateTo, setCloseDateTo] = useState('');

  const filteredDeals = deals.filter(d => {
    if (searchQ && !d.title.toLowerCase().includes(searchQ.toLowerCase()) &&
        !(d.customerName ?? '').toLowerCase().includes(searchQ.toLowerCase())) return false;
    if (valueMin && (d.value ?? 0) < parseFloat(valueMin)) return false;
    if (valueMax && (d.value ?? 0) > parseFloat(valueMax)) return false;
    if (closeDateFrom && d.expectedCloseDate && d.expectedCloseDate < closeDateFrom) return false;
    if (closeDateTo && d.expectedCloseDate && d.expectedCloseDate > closeDateTo) return false;
    return true;
  });

  // Set default pipeline once loaded
  useEffect(() => {
    if (!selectedPipeline && pipelines.length > 0) {
      const def = pipelines.find(p => p.isDefault) ?? pipelines[0];
      setSelectedPipeline(def.id);
    }
  }, [pipelines, selectedPipeline]);

  async function handleTransition(id: string, transition: string) {
    setTransitioning(id);
    try {
      await transitionDeal(id, transition);
      mutate();
    } catch {
      toast.error('Átmenet sikertelen');
    } finally {
      setTransitioning(null);
    }
  }

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('dealId', id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverStage(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stage: Stage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stage);
  }, []);

  const handleDrop = useCallback((targetStage: Stage) => {
    const id = draggingId;
    setDraggingId(null);
    setDragOverStage(null);
    if (!id) return;
    const deal = filteredDeals.find(d => d.id === id);
    if (!deal || deal.stage === targetStage) return;
    if (targetStage === STAGE.LOST) {
      setLoseId(id);
      return;
    }
    const transition = STAGE_TO_TRANSITION[targetStage as Stage];
    if (transition) handleTransition(id, transition);
    else toast.error('Ez az átmenet nem lehetséges');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingId, filteredDeals]);

  const grouped = STAGE_ORDER.reduce<Record<Stage, Deal[]>>((acc, stage) => {
    acc[stage] = filteredDeals.filter(d => d.stage === stage);
    return acc;
  }, {} as Record<Stage, Deal[]>);

  const totalPipelineValue = filteredDeals
    .filter(d => d.stage !== STAGE.LOST)
    .reduce((s, d) => s + (d.value ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-brand-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.crm.deals ?? 'Ügyletek'}</h1>
            {!isLoading && (
              <p className="text-sm text-gray-400">
                {filteredDeals.length} ügylet
                {totalPipelineValue > 0 && ` · ${new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(totalPipelineValue)} pipeline érték`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pipelines.length > 1 && (
            <select
              value={selectedPipeline}
              onChange={e => setSelectedPipeline(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {pipelines.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <CsvExportButton endpoint="/csv/deals" filename="deals.csv" label="Export" />
          {canWrite && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition"
            >
              <Plus className="w-4 h-4" />
              Új ügylet
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-400"
            placeholder="Keresés ügylet neve, ügyfél…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
        </div>
        <button type="button" onClick={() => setShowFilters(f => !f)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition ${showFilters ? 'border-brand-400 text-brand-700 bg-brand-50' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
          <SlidersHorizontal className="w-4 h-4" />
          Szűrők
          {(valueMin || valueMax || closeDateFrom || closeDateTo) && (
            <span className="w-2 h-2 rounded-full bg-brand-500 ml-0.5" />
          )}
        </button>
      </div>
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Érték (min)</label>
            <input type="number" min="0" className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="0" value={valueMin} onChange={e => setValueMin(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Érték (max)</label>
            <input type="number" min="0" className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="—" value={valueMax} onChange={e => setValueMax(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Zárás dátumtól</label>
            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
              value={closeDateFrom} onChange={e => setCloseDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Zárás dátumig</label>
            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
              value={closeDateTo} onChange={e => setCloseDateTo(e.target.value)} />
          </div>
          <div className="col-span-full flex justify-end">
            <button type="button"
              onClick={() => { setValueMin(''); setValueMax(''); setCloseDateFrom(''); setCloseDateTo(''); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg">
              Törlés
            </button>
          </div>
        </div>
      )}

      {/* Kanban board */}
      {isLoading ? (
        <p className="text-gray-400 text-sm">{t.common.loading}</p>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {STAGE_ORDER.map(stage => (
              <KanbanColumn
                key={stage}
                stage={stage}
                deals={grouped[stage] ?? []}
                onTransition={handleTransition}
                transitioning={transitioning}
                onEdit={setEditDeal}
                onDelete={setDeleteDealItem}
                onLose={setLoseId}
                draggingId={draggingId}
                isDragOver={dragOverStage === stage}
                onDragOver={(e) => handleDragOver(e, stage)}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={() => handleDrop(stage)}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {(showCreate || editDeal) && (
        <DealModal
          initial={editDeal ?? undefined}
          pipelines={pipelines}
          onClose={() => { setShowCreate(false); setEditDeal(null); }}
          onSaved={() => mutate()}
        />
      )}
      {deleteDealItem && (
        <DeleteDealConfirm
          deal={deleteDealItem}
          onClose={() => setDeleteDealItem(null)}
          onDeleted={() => mutate()}
        />
      )}
      {loseId && (
        <LostReasonModal
          dealId={loseId}
          onClose={() => setLoseId(null)}
          onDone={() => mutate()}
        />
      )}
    </div>
  );
}
