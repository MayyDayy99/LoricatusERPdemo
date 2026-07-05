'use client';

import { useState, useEffect } from 'react';
import { Plus, Settings, ArrowRight, ChevronDown } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/lib/hooks/use-t';
import { toast } from 'sonner';

/* ── Types ──────────────────────────────────────────────────── */
type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

interface PipelineStage {
  name: string;
  order: number;
  probability: number;
  color?: string;
}

interface Pipeline {
  id: string;
  name: string;
  isDefault?: boolean;
  stages: PipelineStage[];
}

interface Customer { id: string; firstName: string; lastName: string; company?: string; }

interface Deal {
  id: string;
  title: string;
  stage: DealStage;
  value?: number;
  currency?: string;
  probability?: number;
  expectedCloseDate?: string;
  customer?: Customer;
  pipelineId?: string;
  updatedAt?: string;
}

const STAGE_COLORS: Record<DealStage, string> = {
  lead:        'bg-blue-100 text-blue-700 border-blue-200',
  qualified:   'bg-cyan-100 text-cyan-700 border-cyan-200',
  proposal:    'bg-amber-100 text-amber-700 border-amber-200',
  negotiation: 'bg-purple-100 text-purple-700 border-purple-200',
  won:         'bg-green-100 text-green-700 border-green-200',
  lost:        'bg-red-100 text-red-700 border-red-200',
};

const STAGE_LABELS: Record<DealStage, string> = {
  lead: 'Érdeklődő', qualified: 'Minősített', proposal: 'Ajánlat',
  negotiation: 'Tárgyalás', won: 'Megnyert', lost: 'Elvesztett',
};

const ACTIVE_STAGES: DealStage[] = ['lead', 'qualified', 'proposal', 'negotiation'];
const CLOSED_STAGES: DealStage[] = ['won', 'lost'];

const TRANSITION_MAP: Record<string, string> = {
  qualified: 'qualify', proposal: 'send_proposal', negotiation: 'negotiate',
  won: 'win', lost: 'lose',
};

const NEXT_STAGES: Record<DealStage, DealStage[]> = {
  lead:        ['qualified', 'lost'],
  qualified:   ['proposal', 'lost'],
  proposal:    ['negotiation', 'lost'],
  negotiation: ['won', 'lost'],
  won:         [],
  lost:        [],
};

const fmt = (v?: number, c = 'HUF') =>
  v != null ? new Intl.NumberFormat('hu-HU').format(v) + ' ' + c : '—';

/* ── Create Pipeline Modal ─────────────────────────────────────── */
function CreatePipelineModal({ onClose, onSaved }: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);

  const defaultStages: PipelineStage[] = [
    { name: 'Érdeklődő', order: 1, probability: 10,  color: '#6B7280' },
    { name: 'Minősített', order: 2, probability: 25, color: '#3B82F6' },
    { name: 'Ajánlat',   order: 3, probability: 50,  color: '#F59E0B' },
    { name: 'Tárgyalás', order: 4, probability: 75,  color: '#8B5CF6' },
    { name: 'Megnyert',  order: 5, probability: 100, color: '#10B981' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post('/pipelines', { name, isDefault, stages: defaultStages });
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Új pipeline</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Pipeline neve *" value={name}
            onChange={e => setName(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isDefault}
              onChange={e => setIsDefault(e.target.checked)} />
            Alapértelmezett pipeline
          </label>
          <p className="text-xs text-gray-400">Alapértelmezett stage-ek kerülnek beállításra (később szerkeszthető).</p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600">{t.common.cancel}</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {loading ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Stage Editor Modal ─────────────────────────────────────── */
function EditPipelineModal({ pipeline, onClose, onSaved }: {
  pipeline: Pipeline;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(pipeline.name);
  const [isDefault, setIsDefault] = useState(pipeline.isDefault ?? false);
  const [stages, setStages] = useState<PipelineStage[]>(
    (pipeline.stages ?? []).map(s => ({ ...s }))
  );
  const [loading, setLoading] = useState(false);

  const updateStage = (idx: number, field: keyof PipelineStage, value: string | number) => {
    setStages(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.patch(`/pipelines/${pipeline.id}`, { name, isDefault, stages });
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Pipeline szerkesztése</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Pipeline neve *" value={name}
            onChange={e => setName(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isDefault}
              onChange={e => setIsDefault(e.target.checked)} />
            Alapértelmezett pipeline
          </label>

          {stages.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Stage-ek</div>
              <div className="space-y-2">
                {stages.map((stage, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input className="col-span-5 border rounded px-2 py-1 text-xs"
                      placeholder="Név" value={stage.name}
                      onChange={e => updateStage(idx, 'name', e.target.value)} />
                    <input type="number" min="0" max="100"
                      className="col-span-3 border rounded px-2 py-1 text-xs"
                      placeholder="Val.%" value={stage.probability}
                      onChange={e => updateStage(idx, 'probability', parseInt(e.target.value) || 0)} />
                    <input type="number" min="1"
                      className="col-span-2 border rounded px-2 py-1 text-xs"
                      placeholder="Sorr." value={stage.order}
                      onChange={e => updateStage(idx, 'order', parseInt(e.target.value) || 1)} />
                    <input className="col-span-2 border rounded px-2 py-1 text-xs"
                      placeholder="#hex" value={stage.color ?? ''}
                      onChange={e => updateStage(idx, 'color', e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600">{t.common.cancel}</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {loading ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Stage Transition Dropdown ─────────────────────────────────── */
function StageTransition({ deal, onDone }: { deal: Deal; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const options = NEXT_STAGES[deal.stage] ?? [];

  if (options.length === 0) return null;

  const doTransition = async (stage: DealStage) => {
    setLoading(true);
    setOpen(false);
    try {
      await apiClient.post(`/deals/${deal.id}/transition`, { transition: TRANSITION_MAP[stage] });
      toast.success('Átlépve');
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Hiba');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        disabled={loading}
        className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition disabled:opacity-50">
        <ArrowRight className="w-3 h-3" /> Átléptetés <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-10 w-36">
          {options.map(s => (
            <button type="button" key={s} onClick={e => { e.stopPropagation(); doTransition(s); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition">
              → {STAGE_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Deal Card ─────────────────────────────────────────────── */
function DealCard({ deal, onRefresh }: { deal: Deal; onRefresh: () => void }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition">
      <div className="font-medium text-sm text-gray-900 truncate">{deal.title}</div>
      {deal.customer && (
        <div className="text-xs text-gray-500 mt-0.5 truncate">
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
          Zárás: {new Date(deal.expectedCloseDate).toLocaleDateString('hu-HU')}
        </div>
      )}
      <div className="mt-2">
        <StageTransition deal={deal} onDone={onRefresh} />
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function PipelinesPage() {
  const t = useT();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editPipeline, setEditPipeline] = useState<Pipeline | null>(null);

  const fetchAll = async () => {
    try {
      const [pRes, dRes] = await Promise.all([
        apiClient.get('/pipelines'),
        apiClient.get('/deals'),
      ]);
      const pList: Pipeline[] = pRes.data;
      setPipelines(pList);
      setDeals(dRes.data);
      if (!activePipelineId && pList.length > 0) {
        const def = pList.find(p => p.isDefault) ?? pList[0];
        setActivePipelineId(def.id);
      }
    } catch { /* handled */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const activePipeline = pipelines.find(p => p.id === activePipelineId);
  const pipelineDeals = deals.filter(d => !d.pipelineId || d.pipelineId === activePipelineId);

  const stageDeals = (stage: DealStage) => pipelineDeals.filter(d => d.stage === stage);
  const stageValue = (stage: DealStage) =>
    stageDeals(stage).reduce((s, d) => s + (d.value ?? 0), 0);

  /* Conversion rate: lead → won */
  const totalLeads = pipelineDeals.filter(d => d.stage !== 'lost').length;
  const wonDeals = pipelineDeals.filter(d => d.stage === 'won').length;
  const conversionRate = totalLeads > 0 ? Math.round((wonDeals / totalLeads) * 100) : 0;

  if (loading) return <div className="p-8 text-gray-400">{t.common.loading}</div>;

  return (
    <div className="p-6 flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline-ok</h1>
          <p className="text-sm text-gray-500 mt-1">
            {pipelineDeals.length} deal · {conversionRate}% konverziós ráta
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activePipeline && (
            <button type="button" onClick={() => setEditPipeline(activePipeline)}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              <Settings className="w-4 h-4" /> Szerkesztés
            </button>
          )}
          <button type="button" onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
            <Plus className="w-4 h-4" /> Új pipeline
          </button>
        </div>
      </div>

      {/* Pipeline selector */}
      {pipelines.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {pipelines.map(p => (
            <button type="button" key={p.id} onClick={() => setActivePipelineId(p.id)}
              className={`px-4 py-1.5 text-sm rounded-lg border transition ${
                activePipelineId === p.id
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}>
              {p.name}
              {p.isDefault && <span className="ml-1 text-xs opacity-70">(default)</span>}
            </button>
          ))}
        </div>
      )}

      {pipelines.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
          <div className="text-4xl">📊</div>
          <p className="text-lg font-medium">Még nincs pipeline</p>
          <button type="button" onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700">
            <Plus className="w-4 h-4" /> Első pipeline létrehozása
          </button>
        </div>
      ) : (
        <>
          {/* Kanban board */}
          <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
            {ACTIVE_STAGES.map(stage => (
              <div key={stage} className="flex-shrink-0 w-72">
                <div className={`rounded-t-lg px-3 py-2 border ${STAGE_COLORS[stage]} flex items-center justify-between`}>
                  <span className="text-sm font-semibold">{STAGE_LABELS[stage]}</span>
                  <span className="text-xs font-medium">{stageDeals(stage).length}</span>
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1 border-x border-gray-200">
                  {new Intl.NumberFormat('hu-HU').format(stageValue(stage))} HUF
                </div>
                <div className="bg-gray-50/50 border border-t-0 border-gray-200 rounded-b-lg p-2 space-y-2 min-h-[200px]">
                  {stageDeals(stage).length === 0 && (
                    <div className="text-xs text-gray-300 text-center py-8">—</div>
                  )}
                  {stageDeals(stage).map(deal => (
                    <DealCard key={deal.id} deal={deal} onRefresh={fetchAll} />
                  ))}
                </div>
              </div>
            ))}

            {/* Won / Lost closed columns */}
            {CLOSED_STAGES.map(stage => (
              <div key={stage} className="flex-shrink-0 w-52">
                <div className={`rounded-t-lg px-3 py-2 border ${STAGE_COLORS[stage]} flex items-center justify-between`}>
                  <span className="text-sm font-semibold">{STAGE_LABELS[stage]}</span>
                  <span className="text-xs font-medium">{stageDeals(stage).length}</span>
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1 border-x border-gray-200">
                  {new Intl.NumberFormat('hu-HU').format(stageValue(stage))} HUF
                </div>
                <div className="bg-gray-50/50 border border-t-0 border-gray-200 rounded-b-lg p-2 space-y-1 max-h-64 overflow-y-auto">
                  {stageDeals(stage).map(d => (
                    <div key={d.id} className="text-xs text-gray-600 bg-white rounded px-2 py-1.5 border">
                      <div className="font-medium truncate">{d.title}</div>
                      {d.value != null && (
                        <div className="text-gray-400 mt-0.5">{fmt(d.value, d.currency)}</div>
                      )}
                    </div>
                  ))}
                  {stageDeals(stage).length === 0 && (
                    <div className="text-xs text-gray-300 text-center py-4">—</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showCreate && (
        <CreatePipelineModal
          onClose={() => setShowCreate(false)}
          onSaved={fetchAll}
        />
      )}
      {editPipeline && (
        <EditPipelineModal
          pipeline={editPipeline}
          onClose={() => setEditPipeline(null)}
          onSaved={() => { setEditPipeline(null); fetchAll(); }}
        />
      )}
    </div>
  );
}
