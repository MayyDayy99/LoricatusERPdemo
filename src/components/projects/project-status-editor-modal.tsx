'use client';

import { useState } from 'react';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import {
  useProjectStatuses,
  createProjectStatus, updateProjectStatus, deleteProjectStatus, reorderProjectStatuses,
} from '@/lib/hooks/use-projects';

const COLOR_PALETTE = [
  '#94a3b8', '#60a5fa', '#34d399', '#fbbf24', '#f87171',
  '#a78bfa', '#f472b6', '#22d3ee', '#fb923c', '#4ade80',
];

/**
 * Projekt-státusz szerkesztő — tenant-szintű, testreszabható státuszok
 * (címke + szín) kezelése: hozzáadás / átnevezés / szín / sorrend / törlés.
 * Az /projects oldal "Státuszok" gombja nyitja.
 */
export function ProjectStatusEditorModal({ onClose }: { onClose: () => void }) {
  const { statuses, mutate } = useProjectStatuses();
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  async function add() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await createProjectStatus({ name: newName.trim(), color: COLOR_PALETTE[statuses.length % COLOR_PALETTE.length] });
      setNewName('');
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Státusz létrehozása sikertelen');
    } finally {
      setBusy(false);
    }
  }

  async function setColor(id: string, color: string) {
    try {
      await updateProjectStatus(id, { color });
      await mutate();
    } catch { toast.error('Szín mentése sikertelen'); }
  }

  async function rename(id: string, name: string) {
    try {
      await updateProjectStatus(id, { name });
      await mutate();
    } catch { toast.error('Átnevezés sikertelen'); }
  }

  async function remove(id: string, projectCount: number) {
    if (projectCount > 0 && !window.confirm(
      `Ehhez a státuszhoz ${projectCount} projekt tartozik. Törlés után azok "Nincs státusz" állapotba kerülnek. Folytatod?`,
    )) return;
    try {
      await deleteProjectStatus(id);
      await mutate();
    } catch { toast.error('Törlés sikertelen'); }
  }

  async function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = statuses.map(s => s.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setDragId(null);
    // Optimista átrendezés
    await mutate(
      ids.map((id, i) => ({ ...statuses.find(s => s.id === id)!, sortIndex: i })),
      { revalidate: false },
    );
    try {
      await reorderProjectStatuses(ids);
      await mutate();
    } catch { toast.error('Sorrend mentése sikertelen'); await mutate(); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl mx-4 max-h-[88vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Projekt-státuszok</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </header>

        <div className="p-6 overflow-y-auto space-y-3">
          <p className="text-xs text-gray-500">
            A státuszok a beépített Állapot (Vázlat / Aktív / …) mellett szabadon szerkeszthetők.
            A projektekhez a listában rendelhetők hozzá. Húzd a sorokat a sorrendhez.
          </p>

          <div className="space-y-1.5">
            {statuses.map(s => (
              <div
                key={s.id}
                draggable
                onDragStart={() => setDragId(s.id)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => onDrop(s.id)}
                className="flex items-center gap-2 p-2 rounded-lg border border-gray-100"
                style={{ background: s.color + '22' }}
              >
                <GripVertical className="w-4 h-4 text-gray-300 cursor-grab shrink-0" />
                <span className="w-3 h-3 rounded-full shrink-0 border border-white shadow-sm" style={{ background: s.color }} />
                <input
                  defaultValue={s.name}
                  onBlur={e => { if (e.target.value.trim() && e.target.value !== s.name) rename(s.id, e.target.value.trim()); }}
                  className="flex-1 bg-white/80 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <div className="flex gap-1">
                  {COLOR_PALETTE.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(s.id, c)}
                      title={c}
                      className={clsx('w-5 h-5 rounded-full border', s.color === c ? 'ring-2 ring-brand-500 border-white' : 'border-gray-300')}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-gray-400 w-12 text-right shrink-0">{s.projectCount} db</span>
                <button type="button" onClick={() => remove(s.id, s.projectCount)} className="text-gray-400 hover:text-red-600 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {statuses.length === 0 && (
              <p className="text-xs text-gray-400 italic py-3 text-center">Még nincs státusz — hozd létre az elsőt lent.</p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
              placeholder="Új státusz neve…"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <button type="button" onClick={add} disabled={busy || !newName.trim()}
              className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40 inline-flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Hozzáad
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
