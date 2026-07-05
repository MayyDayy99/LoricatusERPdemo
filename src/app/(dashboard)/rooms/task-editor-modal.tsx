'use client';

import { useState } from 'react';
import { Check, Clock, GripVertical, ListChecks, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import {
  createCrmTask, updateCrmTask,
  useTaskChecklist, addChecklistItem, updateChecklistItem, deleteChecklistItem,
  type CrmTask,
} from '@/lib/hooks/use-crm';
import { useUsers } from '@/lib/hooks/use-users';
import { CommentThread } from '@/components/comments/comment-thread';

/**
 * UTC ISO-stringet (pl. "2026-05-14T08:00:00.000Z") konvertál a `datetime-local`
 * input által várt LOKÁLIS-formátumra ("2026-05-14T10:00", CET). A korábbi
 * `iso.slice(0, 16)` bug: a UTC karaktereit lokálisként értelmezte az input,
 * és a felhasználó +-1-2 órás eltolódást látott. A `Date`-objektum-on át
 * megyünk, hogy a böngésző-időzóna helyesen alkalmazódjon.
 */
function isoToLocalDatetime(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/** Lokális datetime-local-érték ("2026-05-14T10:00") UTC ISO-stringre. */
function localDatetimeToIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

const TASK_TYPES_FE: Array<{ value: string; label: string }> = [
  { value: 'todo',        label: 'Általános' },
  { value: 'terep',       label: 'Terep' },
  { value: 'iroda',       label: 'Iroda' },
  { value: 'feldolgozas', label: 'Feldolgozás' },
  { value: 'sales',       label: 'Sales' },
  { value: 'marketing',   label: 'Marketing' },
  { value: 'szamlazas',   label: 'Számlázás' },
  { value: 'gepido',      label: 'Gépidő' },
];

export function TaskEditorModal({
  projectId,
  task,
  onClose,
  onSaved,
}: {
  projectId: string;
  task: CrmTask | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { users } = useUsers();
  const [title, setTitle] = useState(task?.title ?? '');
  const [taskType, setTaskType] = useState(task?.taskType ?? 'todo');
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo ?? '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(task?.priority ?? 'medium');
  const [startDate, setStartDate] = useState(isoToLocalDatetime(task?.startDate));
  const [dueDate, setDueDate] = useState(isoToLocalDatetime(task?.dueDate));
  const [estHours, setEstHours] = useState<string>(
    task?.estimatedMinutes ? String(task.estimatedMinutes / 60) : '',
  );
  const [description, setDescription] = useState(task?.description ?? '');
  const [busy, setBusy] = useState(false);

  const { items, mutate: mutateChecklist } = useTaskChecklist(task?.id ?? null);
  const [newItemText, setNewItemText] = useState('');

  const completedCount = items.filter((i) => i.done).length;
  const progressPct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  async function save() {
    if (!title.trim()) { toast.error('A teendő címe kötelező'); return; }
    setBusy(true);
    try {
      const dto = {
        title,
        projectId,
        taskType,
        assignedTo: assignedTo || undefined,
        priority,
        description: description || undefined,
        startDate: localDatetimeToIso(startDate),
        dueDate: localDatetimeToIso(dueDate),
        estimatedMinutes: estHours ? Math.round(parseFloat(estHours) * 60) : undefined,
      };
      if (task) {
        await updateCrmTask(task.id, dto);
        toast.success('Teendő mentve');
      } else {
        await createCrmTask(dto);
        toast.success('Teendő létrehozva');
        // Új task — vizuális visszajelzés a típus alapján
        if (taskType === 'szamlazas') {
          void import('@/lib/animations/money-rain').then(m => m.triggerMoneyRain());
        } else if (taskType === 'terep') {
          void import('@/lib/animations/drone-swarm').then(m => m.triggerDroneSwarm());
        } else if (taskType === 'gepido') {
          void import('@/lib/animations/machine-time').then(m => m.triggerMachineTime());
        } else if (taskType === 'iroda') {
          void import('@/lib/animations/office-workflow').then(m => m.triggerOfficeWorkflow());
        }
      }
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Mentés sikertelen');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddItem() {
    if (!task) { toast.error('Először mentsd a teendőt'); return; }
    if (!newItemText.trim()) return;
    try {
      await addChecklistItem(task.id, newItemText);
      setNewItemText('');
      await mutateChecklist();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Hozzáadás sikertelen');
    }
  }

  async function toggleItem(id: string, done: boolean) {
    try {
      await updateChecklistItem(id, { done });
      await mutateChecklist();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Módosítás sikertelen');
    }
  }

  async function removeItem(id: string) {
    try {
      await deleteChecklistItem(id);
      await mutateChecklist();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Törlés sikertelen');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {task ? 'Teendő szerkesztése' : 'Új teendő'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </header>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Téma</label>
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Mi a teendő?"
              rows={2}
              maxLength={500}
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Felelős</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                <option value="">— Senki —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Típus</label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {TASK_TYPES_FE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Kezdődátum</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                title="Üresen hagyva a létrehozás időpontját veszi át (a Gantt-on is megjelenik)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Határidő</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Becsült idő (óra)</label>
              <input
                type="number"
                step={0.5}
                min={0}
                max={999}
                value={estHours}
                onChange={(e) => setEstHours(e.target.value)}
                placeholder="pl. 2"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Prioritás</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition',
                    priority === p
                      ? p === 'high'   ? 'bg-red-50 border-red-200 text-red-700'
                      : p === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-700'
                                       : 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50',
                  )}
                >
                  {p === 'high' ? 'Magas' : p === 'medium' ? 'Közepes' : 'Alacsony'}
                </button>
              ))}
            </div>
          </div>

          {task && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                  <ListChecks className="w-3.5 h-3.5" />
                  Lista
                </label>
                {items.length > 0 && (
                  <span className="text-[11px] text-gray-400 tabular-nums">{completedCount} / {items.length}</span>
                )}
              </div>
              {items.length > 0 && (
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 transition-all" style={{ width: `${progressPct}%` }} />
                </div>
              )}
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 group">
                    <GripVertical className="w-3.5 h-3.5 text-gray-200 shrink-0" />
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id, !item.done)}
                      className={clsx(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition',
                        item.done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-brand-500',
                      )}
                    >
                      {item.done && <Check className="w-3 h-3" />}
                    </button>
                    <span className={clsx('flex-1 text-sm', item.done && 'line-through text-gray-400')}>
                      {item.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-600 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }}
                  placeholder="+ alkérdés hozzáadása"
                  maxLength={500}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!newItemText.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs bg-brand-50 text-brand-700 font-medium hover:bg-brand-100 disabled:opacity-50"
                >
                  Hozzáad
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">Részletek</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Megjegyzések, részletek (opcionális)"
              maxLength={5000}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
          </div>

          {task && (
            <div className="space-y-2 pt-3 border-t border-gray-100">
              <label className="text-xs font-semibold text-gray-600">Hozzászólások</label>
              <CommentThread targetType="crm_task" targetId={task.id} emptyHint="Még nincs hozzászólás ehhez a teendőhöz." />
            </div>
          )}

          {!task && (
            <p className="text-[11px] text-gray-400 italic flex items-center gap-1">
              <Clock className="w-3 h-3" />
              A Lista (alfeladatok) csak mentés után válik elérhetővé.
            </p>
          )}
        </div>

        <footer className="px-6 py-3 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Mégsem
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !title.trim()}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'Mentés…' : task ? 'Mentés' : 'Létrehozás'}
          </button>
        </footer>
      </div>
    </div>
  );
}
