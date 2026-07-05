'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { X, FileText, Sparkles, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { apiClient } from '@/lib/api-client';
import { useProjects } from '@/lib/hooks/use-projects';
import {
  useProjectTemplates,
  type ProjectTemplate,
} from '@/lib/hooks/use-project-templates';

/**
 * Új projekt létrehozó modal. Két módra váltható:
 * - "Üres" (alapértelmezett): csak név + leírás
 * - "Sablon alapján": sablonválasztó + a sablon input-jainak kitöltése.
 *   Mentés után a backend eager-materializálja a sablon összes lépését.
 */
export function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const { mutate } = useProjects();
  const { templates } = useProjectTemplates(false);
  const [mode, setMode] = useState<'empty' | 'template'>('empty');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateId, setTemplateId] = useState<string>('');
  const [templateInputs, setTemplateInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const selectedTemplate: ProjectTemplate | undefined = templates.find(t => t.id === templateId);

  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find(x => x.id === id);
    // Default name from template
    if (t && !name.trim()) setName(t.name);
    // Default inputs to empty
    const init: Record<string, string> = {};
    t?.inputs.forEach(i => { init[i.inputKey] = ''; });
    setTemplateInputs(init);
  }

  async function submit() {
    if (!name.trim()) { toast.error('A projekt neve kötelező'); return; }
    if (mode === 'template') {
      if (!templateId) { toast.error('Válassz egy sablont'); return; }
      const missing = (selectedTemplate?.inputs ?? []).filter(i => i.required !== false && !templateInputs[i.inputKey]);
      if (missing.length > 0) {
        toast.error(`Hiányzó input: ${missing.map(i => i.label).join(', ')}`);
        return;
      }
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || undefined,
      };
      if (mode === 'template' && templateId) {
        payload.templateId = templateId;
        payload.templateInputs = templateInputs;
      }
      await apiClient.post('/projects', payload);
      await mutate();
      toast.success(mode === 'template' ? 'Projekt létrehozva — a sablon-lépések generálódtak.' : 'Projekt létrehozva');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Projekt létrehozása sikertelen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Új projekt</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Mode picker */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMode('empty')}
              className={clsx(
                'p-3 rounded-lg border text-left transition',
                mode === 'empty' ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:bg-gray-50',
              )}>
              <FileText className="w-5 h-5 text-gray-600 mb-1" />
              <div className="text-sm font-semibold text-gray-900">Üres projekt</div>
              <div className="text-xs text-gray-500">Csak alap-adatok, taskok nélkül.</div>
            </button>
            <button onClick={() => setMode('template')}
              className={clsx(
                'p-3 rounded-lg border text-left transition',
                mode === 'template' ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:bg-gray-50',
              )}
              disabled={templates.length === 0}
              title={templates.length === 0 ? 'Nincs aktív sablon' : ''}>
              <Sparkles className="w-5 h-5 text-gray-600 mb-1" />
              <div className="text-sm font-semibold text-gray-900">Sablon alapján</div>
              <div className="text-xs text-gray-500">{templates.length} sablon elérhető.</div>
            </button>
          </div>

          {/* Template picker + inputs */}
          {mode === 'template' && (
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Sablon</label>
                <select value={templateId} onChange={e => pickTemplate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
                  <option value="">— válassz sablont —</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.steps.length} lépés)</option>)}
                </select>
              </div>
              {selectedTemplate && (
                <>
                  {selectedTemplate.description && (
                    <p className="text-xs text-gray-500">{selectedTemplate.description}</p>
                  )}
                  {selectedTemplate.inputs.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">A sablon nem kér be paramétert.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-gray-700">Paraméterek</div>
                      {selectedTemplate.inputs.map(inp => (
                        <div key={inp.inputKey}>
                          <label className="text-xs text-gray-600 block mb-0.5">
                            {inp.label}{inp.required !== false && ' *'}
                          </label>
                          <input
                            type={inp.inputType === 'datetime' ? 'datetime-local' : inp.inputType === 'date' ? 'date' : 'text'}
                            value={templateInputs[inp.inputKey] ?? ''}
                            onChange={e => setTemplateInputs(prev => ({ ...prev, [inp.inputKey]: e.target.value }))}
                            className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Project name + description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Projekt neve *</label>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={200}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="pl. K-12 zöldfelületi tanúsítvány — Tavasz" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Leírás</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none resize-none"
              placeholder="Opcionális leírás…" />
          </div>
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button type="button" onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition">
            Mégse
          </button>
          <button onClick={submit} disabled={loading}
            className="flex-1 bg-brand-600 text-white py-2.5 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition inline-flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Létrehozás…' : 'Létrehozás'}
          </button>
        </div>
      </div>
    </div>
  );
}
