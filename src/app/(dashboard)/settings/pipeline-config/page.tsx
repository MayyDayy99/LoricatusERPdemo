'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Star, StarOff } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/lib/hooks/use-t';
import { toast } from 'sonner';

/* ── Types ──────────────────────────────────────────────────── */
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

interface Deal { id: string; pipelineId?: string; }

const DEFAULT_STAGE_COLOR = '#6B7280';

/* ── Create Pipeline Modal (reused from /crm/pipelines) ────────── */
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
        <h2 className="text-lg font-semibold mb-4">{t.pipelineConfig.newTitle}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder={t.pipelineConfig.newNamePh} value={name}
            onChange={e => setName(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isDefault}
              onChange={e => setIsDefault(e.target.checked)} />
            {t.pipelineConfig.defaultPipeline}
          </label>
          <p className="text-xs text-gray-400">{t.pipelineConfig.defaultHint}</p>
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

/* ── Main Page ───────────────────────────────────────────────── */
export default function PipelineConfigPage() {
  const t = useT();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  /* Local edit-state for the currently selected pipeline. */
  const [editName, setEditName] = useState('');
  const [editIsDefault, setEditIsDefault] = useState(false);
  const [editStages, setEditStages] = useState<PipelineStage[]>([]);

  const fetchAll = async () => {
    try {
      const [pRes, dRes] = await Promise.all([
        apiClient.get('/pipelines'),
        apiClient.get('/deals'),
      ]);
      const pList: Pipeline[] = pRes.data;
      setPipelines(pList);
      setDeals(dRes.data);
      if (pList.length > 0) {
        const keep = pList.find(p => p.id === selectedId);
        const sel = keep ?? pList.find(p => p.isDefault) ?? pList[0];
        setSelectedId(sel.id);
        hydrateEdit(sel);
      } else {
        setSelectedId(null);
      }
    } catch { /* handled by interceptor */ } finally {
      setLoading(false);
    }
  };

  const hydrateEdit = (p: Pipeline) => {
    setEditName(p.name);
    setEditIsDefault(p.isDefault ?? false);
    setEditStages((p.stages ?? []).map(s => ({ ...s })));
  };

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, []);

  const selected = pipelines.find(p => p.id === selectedId) ?? null;
  const dealsByPipeline = (id: string) => deals.filter(d => d.pipelineId === id).length;

  const selectPipeline = (p: Pipeline) => {
    setSelectedId(p.id);
    hydrateEdit(p);
  };

  const updateStage = (idx: number, field: keyof PipelineStage, value: string | number) => {
    setEditStages(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const removeStage = (idx: number) => {
    setEditStages(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
  };

  const addStage = () => {
    setEditStages(prev => [
      ...prev,
      {
        name: t.pipelineConfig.stageNameDefault,
        order: prev.length + 1,
        probability: 50,
        color: DEFAULT_STAGE_COLOR,
      },
    ]);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiClient.patch(`/pipelines/${selected.id}`, {
        name: editName,
        isDefault: editIsDefault,
        stages: editStages,
      });
      toast.success(t.common.saved);
      await fetchAll();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Pipeline) => {
    if (!confirm(t.pipelineConfig.deleteConfirm(p.name))) return;
    try {
      await apiClient.delete(`/pipelines/${p.id}`);
      toast.success(t.pipelineConfig.deletedToast);
      if (selectedId === p.id) setSelectedId(null);
      await fetchAll();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba'));
    }
  };

  if (loading) return <div className="p-8 text-gray-400">{t.common.loading}</div>;

  return (
    <div className="p-6 flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.pipelineConfig.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t.pipelineConfig.subtitle}
          </p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
          <Plus className="w-4 h-4" /> {t.pipelineConfig.newBtn}
        </button>
      </div>

      {pipelines.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
          <div className="text-4xl">⚙️</div>
          <p className="text-lg font-medium">{t.pipelineConfig.emptyPipelines}</p>
          <button type="button" onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700">
            <Plus className="w-4 h-4" /> {t.pipelineConfig.firstPipeline}
          </button>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
          {/* Pipeline list (left) */}
          <div className="col-span-4 bg-white border border-gray-200 rounded-lg overflow-y-auto">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
              {t.pipelineConfig.sectionPipelines} ({pipelines.length})
            </div>
            <div className="divide-y divide-gray-100">
              {pipelines.map(p => {
                const dealCount = dealsByPipeline(p.id);
                const canDelete = !p.isDefault && dealCount === 0;
                const isSelected = selectedId === p.id;
                return (
                  <div key={p.id}
                    onClick={() => selectPipeline(p)}
                    className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition ${
                      isSelected ? 'bg-brand-50' : 'hover:bg-gray-50'
                    }`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm truncate ${isSelected ? 'font-semibold text-brand-700' : 'text-gray-800'}`}>
                          {p.name}
                        </span>
                        {p.isDefault && (
                          <span className="text-[10px] uppercase font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {p.stages?.length ?? 0} stage · {dealCount} deal
                      </div>
                    </div>
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(p); }}
                      disabled={!canDelete}
                      title={!canDelete
                        ? (p.isDefault ? t.pipelineConfig.deleteDefaultBlocked : t.pipelineConfig.deleteNonEmptyBlocked)
                        : t.pipelineConfig.deleteBtn}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:cursor-not-allowed">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pipeline detail (right) */}
          <div className="col-span-8 bg-white border border-gray-200 rounded-lg overflow-y-auto">
            {!selected ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                {t.pipelineConfig.selectToEdit}
              </div>
            ) : (
              <div className="p-5 space-y-5">
                {/* Pipeline-name + default toggle */}
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {t.pipelineConfig.pipelineNameLabel}
                  </label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={editName}
                    onChange={e => setEditName(e.target.value)} />
                  <button type="button"
                    onClick={() => setEditIsDefault(v => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition ${
                      editIsDefault
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}>
                    {editIsDefault ? <Star className="w-3.5 h-3.5" /> : <StarOff className="w-3.5 h-3.5" />}
                    {editIsDefault ? t.pipelineConfig.defaultPipelineLabel : t.pipelineConfig.makeDefault}
                  </button>
                </div>

                {/* Stages */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {t.pipelineConfig.stagesLabel} ({editStages.length})
                    </label>
                    <button type="button" onClick={addStage}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded">
                      <Plus className="w-3 h-3" /> {t.pipelineConfig.newStage}
                    </button>
                  </div>

                  {editStages.length === 0 ? (
                    <div className="text-xs text-gray-400 italic py-4 text-center border border-dashed rounded">
                      {t.pipelineConfig.emptyStages}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 text-[10px] uppercase text-gray-400 font-medium px-1">
                        <div className="col-span-5">{t.pipelineConfig.colName}</div>
                        <div className="col-span-2">{t.pipelineConfig.colOrder}</div>
                        <div className="col-span-2">{t.pipelineConfig.colProb}</div>
                        <div className="col-span-2">{t.pipelineConfig.colColor}</div>
                        <div className="col-span-1"></div>
                      </div>
                      {editStages.map((stage, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <input className="col-span-5 border rounded px-2 py-1 text-xs"
                            placeholder={t.pipelineConfig.stageNamePh} value={stage.name}
                            onChange={e => updateStage(idx, 'name', e.target.value)} />
                          <input type="number" min="1"
                            className="col-span-2 border rounded px-2 py-1 text-xs"
                            value={stage.order}
                            onChange={e => updateStage(idx, 'order', parseInt(e.target.value) || 1)} />
                          <input type="number" min="0" max="100"
                            className="col-span-2 border rounded px-2 py-1 text-xs"
                            value={stage.probability}
                            onChange={e => updateStage(idx, 'probability', parseInt(e.target.value) || 0)} />
                          <input type="color"
                            className="col-span-2 h-8 w-full border rounded cursor-pointer"
                            value={stage.color ?? DEFAULT_STAGE_COLOR}
                            onChange={e => updateStage(idx, 'color', e.target.value)} />
                          <button type="button" onClick={() => removeStage(idx)}
                            title={t.pipelineConfig.stageDeleteTitle}
                            className="col-span-1 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded justify-self-center">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Save bar */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                  <button type="button"
                    onClick={() => selected && hydrateEdit(selected)}
                    className="px-4 py-2 text-sm text-gray-600">
                    {t.common.cancel}
                  </button>
                  <button type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                    {saving ? t.common.saving : t.common.save}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <CreatePipelineModal
          onClose={() => setShowCreate(false)}
          onSaved={fetchAll}
        />
      )}
    </div>
  );
}
