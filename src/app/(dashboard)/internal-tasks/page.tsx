'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { AlertCircle, Calendar, CheckCircle2, Clock, ListChecks, Pencil, Plus, Trash2, User, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentUser, useUsers } from '@/lib/hooks/use-users';
import {
  useInternalTasks, createInternalTask, updateInternalTask, deleteInternalTask,
  transitionInternalTask,
  type InternalTask, type CreateInternalTaskDto,
} from '@/lib/hooks/use-internal-tasks';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  hr:       'HR',
  fleet:    'Flotta',
  facility: 'Létesítmény',
  legal:    'Jogi',
  finance:  'Pénzügyi',
  internal: 'Belső',
  other:    'Egyéb',
};

const STATUS_BADGE: Record<string, string> = {
  pending:     'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-50 text-red-500',
};

const STATUS_LABELS: Record<string, string> = {
  pending:     'Várakozik',
  in_progress: 'Folyamatban',
  completed:   'Kész',
  cancelled:   'Törölve',
};

const PRIORITY_BADGE: Record<string, string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low:    'bg-gray-100 text-gray-600',
};

const PRIORITY_LABELS: Record<string, string> = {
  high:   'Magas',
  medium: 'Közepes',
  low:    'Alacsony',
};

function formatDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
}

function isOverdue(t: InternalTask) {
  return t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed' && t.status !== 'cancelled';
}

// ─── Form ─────────────────────────────────────────────────────────────────────

interface FormState {
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  assignedTo: string;
  dueDate: string;
  recurring: string;
}

function TaskModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: InternalTask;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { users } = useUsers();
  const { currentUser } = useCurrentUser();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FormState>({
    title:       initial?.title ?? '',
    description: initial?.description ?? '',
    category:    initial?.category ?? 'internal',
    priority:    (initial?.priority as FormState['priority']) ?? 'medium',
    assignedTo:  initial?.assignedTo ?? currentUser?.id ?? '',
    dueDate:     initial?.dueDate ? initial.dueDate.slice(0, 10) : '',
    recurring:   initial?.recurring ?? '',
  });

  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const dto: Partial<CreateInternalTaskDto> = {
        title:       form.title.trim(),
        description: form.description || undefined,
        category:    form.category || undefined,
        priority:    form.priority,
        assignedTo:  form.assignedTo || undefined,
        dueDate:     form.dueDate || undefined,
        recurring:   form.recurring || undefined,
      };
      if (initial) {
        await updateInternalTask(initial.id, dto);
        toast.success('Feladat frissítve');
      } else {
        await createInternalTask(dto as CreateInternalTaskDto);
        toast.success('Feladat létrehozva');
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          {initial ? 'Feladat szerkesztése' : 'Új belső feladat'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required autoFocus
            placeholder="Cím *"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />

          <textarea
            rows={2}
            placeholder="Leírás (opcionális)"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Kategória</label>
              <select
                value={form.category}
                onChange={e => set('category', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Prioritás</label>
              <select
                value={form.priority}
                onChange={e => set('priority', e.target.value as FormState['priority'])}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="low">Alacsony</option>
                <option value="medium">Közepes</option>
                <option value="high">Magas</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Felelős</label>
              <select
                value={form.assignedTo}
                onChange={e => set('assignedTo', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— Nincs kiosztva —</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Határidő</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={e => set('dueDate', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Ismétlődés (opcionális, pl. weekly)</label>
            <input
              type="text"
              placeholder="pl. weekly, monthly"
              value={form.recurring}
              onChange={e => set('recurring', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Mégsem
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Mentés...' : initial ? 'Módosítás' : 'Létrehozás'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onEdit,
  onDeleted,
  onTransitioned,
}: {
  task: InternalTask;
  onEdit: (t: InternalTask) => void;
  onDeleted: () => void;
  onTransitioned: () => void;
}) {
  const overdue = isOverdue(task);

  async function handleTransition(action: 'start' | 'complete' | 'cancel') {
    try {
      await transitionInternalTask(task.id, action);
      onTransitioned();
    } catch {
      toast.error('Állapotváltás sikertelen');
    }
  }

  async function handleDelete() {
    if (!confirm('Törlöd ezt a feladatot?')) return;
    try {
      await deleteInternalTask(task.id);
      toast.success('Feladat törölve');
      onDeleted();
    } catch {
      toast.error('Törlés sikertelen');
    }
  }

  return (
    <div className={clsx(
      'bg-white rounded-xl border p-4 space-y-2 transition hover:shadow-sm',
      overdue ? 'border-red-200' : 'border-gray-100',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={clsx('text-sm font-medium truncate', task.status === 'completed' && 'line-through text-gray-400')}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {task.status !== 'completed' && task.status !== 'cancelled' && (
            <button
              onClick={() => onEdit(task)}
              className="p-1 text-gray-400 hover:text-brand-600 rounded"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleDelete}
            className="p-1 text-gray-400 hover:text-red-500 rounded"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className={clsx('px-2 py-0.5 rounded-full font-medium', STATUS_BADGE[task.status])}>
          {STATUS_LABELS[task.status]}
        </span>
        <span className={clsx('px-2 py-0.5 rounded-full font-medium', PRIORITY_BADGE[task.priority])}>
          {PRIORITY_LABELS[task.priority]}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">
          {CATEGORY_LABELS[task.category] ?? task.category}
        </span>
        {task.assignedToName && (
          <span className="flex items-center gap-1 text-gray-500">
            <User className="w-3 h-3" />
            {task.assignedToName}
          </span>
        )}
        {task.dueDate && (
          <span className={clsx(
            'flex items-center gap-1',
            overdue ? 'text-red-500 font-medium' : 'text-gray-500',
          )}>
            {overdue ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
            {formatDate(task.dueDate)}
          </span>
        )}
        {task.recurring && (
          <span className="flex items-center gap-1 text-gray-400">
            <Clock className="w-3 h-3" />
            {task.recurring}
          </span>
        )}
      </div>

      {/* Action buttons */}
      {task.status === 'pending' && (
        <div className="flex gap-1.5 pt-1">
          <button
            onClick={() => handleTransition('start')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
          >
            <Clock className="w-3 h-3" />
            Indít
          </button>
          <button
            onClick={() => handleTransition('cancel')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-600 hover:bg-red-50 hover:text-red-600"
          >
            <XCircle className="w-3 h-3" />
            Törölve
          </button>
        </div>
      )}
      {task.status === 'in_progress' && (
        <div className="flex gap-1.5 pt-1">
          <button
            onClick={() => handleTransition('complete')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100"
          >
            <CheckCircle2 className="w-3 h-3" />
            Kész
          </button>
          <button
            onClick={() => handleTransition('cancel')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-600 hover:bg-red-50 hover:text-red-600"
          >
            <XCircle className="w-3 h-3" />
            Törölve
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InternalTasksPage() {
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [modalTask, setModalTask] = useState<InternalTask | 'new' | null>(null);

  const { tasks, loading, error, mutate } = useInternalTasks({
    status:   filterStatus   || undefined,
    category: filterCategory || undefined,
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-50 rounded-xl">
            <ListChecks className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Belső feladatok</h1>
            <p className="text-sm text-gray-500">
              {tasks.length} feladat
            </p>
          </div>
        </div>
        <button
          onClick={() => setModalTask('new')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition"
        >
          <Plus className="w-4 h-4" />
          Új feladat
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Minden státusz</option>
          <option value="pending">Várakozik</option>
          <option value="in_progress">Folyamatban</option>
          <option value="completed">Kész</option>
          <option value="cancelled">Törölve</option>
        </select>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Minden kategória</option>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 h-28 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-red-500 text-sm">
          Nem sikerült betölteni a feladatokat.
        </div>
      )}

      {!loading && !error && tasks.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <ListChecks className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nincsenek feladatok</p>
          <button
            onClick={() => setModalTask('new')}
            className="mt-4 text-brand-600 text-sm font-medium hover:underline"
          >
            Hozz létre egyet
          </button>
        </div>
      )}

      {!loading && tasks.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={t => setModalTask(t)}
              onDeleted={() => mutate()}
              onTransitioned={() => mutate()}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalTask && (
        <TaskModal
          initial={modalTask === 'new' ? undefined : modalTask}
          onClose={() => setModalTask(null)}
          onSaved={() => mutate()}
        />
      )}
    </div>
  );
}
