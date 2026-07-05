'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  X, Check, Play, CheckCircle2, Calendar, Clock, ArrowUpRight,
  ListChecks, Trash2, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import {
  completeCrmTask, startCrmTask, type CrmTask,
  useTaskChecklist, addChecklistItem, updateChecklistItem, deleteChecklistItem,
} from '@/lib/hooks/use-crm';
import { CommentThread } from '@/components/comments/comment-thread';
import { SlideOver } from '@/components/ui/slide-over';

const TASK_TYPE_LABELS: Record<string, string> = {
  todo: 'Általános', terep: 'Terep', iroda: 'Iroda', feldolgozas: 'Feldolgozás',
  sales: 'Sales', marketing: 'Marketing', szamlazas: 'Számlázás', gepido: 'Gépidő',
  follow_up: 'Utánkövetés', call: 'Hívás', email: 'E-mail', meeting: 'Meeting', review: 'Ellenőrzés',
};

const PRIORITY_LABELS: Record<string, string> = { low: 'Alacsony', medium: 'Közepes', high: 'Magas' };

function priorityPillClass(p: string): string {
  if (p === 'high') return 'bg-red-50 border-red-200 text-red-700';
  if (p === 'medium') return 'bg-amber-50 border-amber-200 text-amber-700';
  return 'bg-blue-50 border-blue-200 text-blue-700';
}

function formatDue(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', weekday: 'short' })
    + (iso.length > 10 ? ` ${d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}` : '');
}

/**
 * "Mai napom" teendő-drawer: a kiválasztott teendőn cselekvés az oldal elhagyása
 * nélkül — indítás, pipálás, checklist, hozzászólás, ugrás a szobába.
 * A `task` érték szerint érkezik a már betöltött listából; művelet után az
 * `onMutated` revalidálja a forrás-listát, így a drawer is frissül.
 */
export function TaskDrawer({
  task,
  onClose,
  onMutated,
}: {
  task: CrmTask | null;
  onClose: () => void;
  onMutated: () => void | Promise<void>;
}) {
  // A tartalom a záró-animáció alatt is látszódjon: az utolsó nem-null taskot tartjuk.
  const [displayTask, setDisplayTask] = useState<CrmTask | null>(task);
  useEffect(() => { if (task) setDisplayTask(task); }, [task]);

  const [busy, setBusy] = useState(false);

  const t = displayTask;
  const isDone = t?.status === 'completed' || t?.status === 'cancelled';
  const canStart = t?.status === 'pending';
  const canComplete = t?.status === 'pending' || t?.status === 'in_progress';

  async function handleComplete() {
    if (!t) return;
    setBusy(true);
    try {
      await completeCrmTask(t.id);
      await onMutated();
      toast.success('Teendő kész ✓');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Lezárás sikertelen');
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    if (!t) return;
    setBusy(true);
    try {
      await startCrmTask(t.id);
      await onMutated();
      toast.success('Teendő elindítva');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Indítás sikertelen');
    } finally {
      setBusy(false);
    }
  }

  const dueLabel = formatDue(t?.dueDate);
  const overdue = !isDone && !!t?.dueDate
    && t.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10);
  const estHours = t?.estimatedMinutes ? Math.round((t.estimatedMinutes / 60) * 10) / 10 : null;

  return (
    <SlideOver open={!!task} onClose={onClose} labelledBy="task-drawer-title">
      {t && (
        <>
          {/* Header */}
          <header className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-medium border', priorityPillClass(t.priority))}>
                  {PRIORITY_LABELS[t.priority] ?? t.priority}
                </span>
                {t.taskType && t.taskType !== 'todo' && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">
                    {TASK_TYPE_LABELS[t.taskType] ?? t.taskType}
                  </span>
                )}
                {isDone && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Kész
                  </span>
                )}
              </div>
              <h2 id="task-drawer-title" className="text-base font-semibold text-gray-900 break-words">
                {t.title}
              </h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 shrink-0" aria-label="Bezárás">
              <X className="w-5 h-5" />
            </button>
          </header>

          {/* Body (scrollable) */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              {dueLabel && (
                <span className={clsx('inline-flex items-center gap-1.5', overdue ? 'text-red-600 font-medium' : 'text-gray-600')}>
                  {overdue ? <AlertTriangle className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                  {overdue ? `Lejárt — ${dueLabel}` : dueLabel}
                </span>
              )}
              {estHours != null && (
                <span className="inline-flex items-center gap-1.5 text-gray-600">
                  <Clock className="w-4 h-4" />
                  {estHours} óra
                </span>
              )}
            </div>

            {/* Projekt / szoba link */}
            {t.projectId ? (
              <Link
                href={`/rooms/${t.projectId}`}
                className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 font-medium bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg px-3 py-2 transition"
              >
                <ArrowUpRight className="w-4 h-4" />
                {t.projectName ? `Ugrás: ${t.projectName}` : 'Ugrás a szobába'}
              </Link>
            ) : (
              <p className="text-xs text-gray-400 italic">Projekten kívüli teendő</p>
            )}

            {/* Leírás */}
            {t.description && (
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{t.description}</p>
            )}

            {/* Akció-gombok */}
            {!isDone && (
              <div className="flex items-center gap-2">
                {canStart && (
                  <button
                    type="button"
                    onClick={handleStart}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                  >
                    <Play className="w-4 h-4" /> Indítom
                  </button>
                )}
                {canComplete && (
                  <button
                    type="button"
                    onClick={handleComplete}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition"
                  >
                    <Check className="w-4 h-4" /> Kész
                  </button>
                )}
              </div>
            )}

            {/* Checklist */}
            <DrawerChecklist taskId={t.id} />

            {/* Hozzászólások */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-semibold text-gray-600">Hozzászólások</label>
              <CommentThread
                targetType="crm_task"
                targetId={t.id}
                emptyHint="Még nincs hozzászólás ehhez a teendőhöz."
              />
            </div>
          </div>
        </>
      )}
    </SlideOver>
  );
}

/** A TaskEditorModal checklist-blokkjának könnyű változata a draweren. */
function DrawerChecklist({ taskId }: { taskId: string }) {
  const { items, mutate } = useTaskChecklist(taskId);
  const [newItemText, setNewItemText] = useState('');
  const completedCount = items.filter((i) => i.done).length;
  const progressPct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  async function handleAdd() {
    if (!newItemText.trim()) return;
    try {
      await addChecklistItem(taskId, newItemText);
      setNewItemText('');
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Hozzáadás sikertelen');
    }
  }
  async function toggle(id: string, done: boolean) {
    try { await updateChecklistItem(id, { done }); await mutate(); }
    catch (err: any) { toast.error(err?.response?.data?.message ?? 'Módosítás sikertelen'); }
  }
  async function remove(id: string) {
    try { await deleteChecklistItem(id); await mutate(); }
    catch (err: any) { toast.error(err?.response?.data?.message ?? 'Törlés sikertelen'); }
  }

  return (
    <div className="space-y-2 pt-1 border-t border-gray-100">
      <div className="flex items-center justify-between pt-3">
        <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5" /> Lista
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
            <button
              type="button"
              onClick={() => toggle(item.id, !item.done)}
              className={clsx(
                'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition',
                item.done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-brand-500',
              )}
            >
              {item.done && <Check className="w-3 h-3" />}
            </button>
            <span className={clsx('flex-1 text-sm', item.done && 'line-through text-gray-400')}>{item.text}</span>
            <button
              type="button"
              onClick={() => remove(item.id)}
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
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
          placeholder="+ alfeladat hozzáadása"
          maxLength={500}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newItemText.trim()}
          className="px-3 py-1.5 rounded-lg text-xs bg-brand-50 text-brand-700 font-medium hover:bg-brand-100 disabled:opacity-50"
        >
          Hozzáad
        </button>
      </div>
    </div>
  );
}
