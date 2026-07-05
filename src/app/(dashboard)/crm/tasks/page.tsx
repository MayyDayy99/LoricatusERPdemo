'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { AlertCircle, Calendar, ChevronDown, ChevronUp, Pencil, Plus, Trash2, User, ShieldAlert, Star } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/hooks/use-t';
import { useCanAccess } from '@/lib/hooks/use-access';
import { useCurrentUser, useUsers } from '@/lib/hooks/use-users';
import {
  useMyTasks, useCrmTasks, createCrmTask, updateCrmTask, deleteCrmTask, completeCrmTask,
  type CrmTask, type CreateCrmTaskDto,
} from '@/lib/hooks/use-crm';
import { apiClient } from '@/lib/api-client';

// ─── Priority helpers ─────────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<string, string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low:    'bg-gray-100 text-gray-600',
};

function priorityLabel(p: string, t: ReturnType<typeof useT>) {
  if (p === 'high')   return t.crm.priorityHigh;
  if (p === 'medium') return t.crm.priorityMedium;
  return t.crm.priorityLow;
}

function isOverdue(task: CrmTask) {
  return task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
}

function formatDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
}

// ─── Task Modal (create + edit) ───────────────────────────────────────────────

const SLA_BADGE: Record<string, string> = {
  at_risk: 'bg-yellow-100 text-yellow-700',
  breached: 'bg-red-100 text-red-700',
};

interface TaskFormState {
  title: string;
  assignedTo: string;
  description: string;
  taskType: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  customerId: string;
  dealId: string;
  projectId: string;
  ticketCategory: string;
  slaDeadline: string;
}

function TaskModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: CrmTask;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const { users } = useUsers();
  const { currentUser } = useCurrentUser();
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [deals, setDeals] = useState<{ id: string; title: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  // Load related data once on mount
  useState(() => {
    Promise.all([
      // A /customers paginated: {items,total,take,skip}. A fallback még kezeli a régi shape-eket.
      apiClient.get('/customers?take=1000').then(r => setCustomers(r.data?.items ?? r.data?.data ?? r.data ?? [])),
      apiClient.get('/deals').then(r => setDeals(Array.isArray(r.data) ? r.data : (r.data?.data ?? []))),
      apiClient.get('/projects').then(r => setProjects(Array.isArray(r.data) ? r.data : (r.data?.data ?? []))),
    ]).catch(() => {});
  });

  const [form, setForm] = useState<TaskFormState>({
    title:          initial?.title ?? '',
    assignedTo:     initial?.assignedTo ?? currentUser?.id ?? '',
    description:    initial?.description ?? '',
    taskType:       initial?.taskType ?? '',
    priority:       initial?.priority ?? 'medium',
    dueDate:        initial?.dueDate ? initial.dueDate.slice(0, 10) : '',
    customerId:     initial?.customerId ?? '',
    dealId:         initial?.dealId ?? '',
    projectId:      initial?.projectId ?? '',
    ticketCategory: initial?.ticketCategory ?? '',
    slaDeadline:    initial?.slaDeadline ? initial.slaDeadline.slice(0, 16) : '',
  });

  const set = (k: keyof TaskFormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.assignedTo) return;
    setSaving(true);
    try {
      const dto: Partial<CreateCrmTaskDto> = {
        title:          form.title,
        assignedTo:     form.assignedTo,
        priority:       form.priority,
        description:    form.description || undefined,
        taskType:       form.taskType || undefined,
        dueDate:        form.dueDate || undefined,
        customerId:     form.customerId || undefined,
        dealId:         form.dealId || undefined,
        projectId:      form.projectId || undefined,
        ticketCategory: form.ticketCategory || undefined,
        slaDeadline:    form.slaDeadline || undefined,
      };
      if (initial) {
        await updateCrmTask(initial.id, dto);
        toast.success('Feladat frissítve');
      } else {
        await createCrmTask(dto as CreateCrmTaskDto);
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold">
          {initial ? 'Feladat szerkesztése' : t.crm.newTaskTitle}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required autoFocus
            placeholder={`${t.crm.newTask} *`}
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
            <select
              value={form.priority}
              onChange={e => set('priority', e.target.value as TaskFormState['priority'])}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="high">{t.crm.priorityHigh}</option>
              <option value="medium">{t.crm.priorityMedium}</option>
              <option value="low">{t.crm.priorityLow}</option>
            </select>

            <select
              value={form.taskType}
              onChange={e => set('taskType', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Típus (opcionális)</option>
              <option value="follow_up">Follow-up</option>
              <option value="call">Telefonálás</option>
              <option value="email">E-mail küldés</option>
              <option value="meeting">Megbeszélés</option>
              <option value="review">Felülvizsgálat</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select
              required
              value={form.assignedTo}
              onChange={e => set('assignedTo', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">{t.crm.assignedTo} *</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>

            <input
              type="date"
              value={form.dueDate}
              onChange={e => set('dueDate', e.target.value)}
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
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.dealId}
              onChange={e => set('dealId', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">— Ügylet —</option>
              {deals.map(d => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>

            <select
              value={form.projectId}
              onChange={e => set('projectId', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">— Projekt —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* SLA */}
          <div className="border-t border-gray-100 pt-3 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">SLA / Ticket</p>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={form.ticketCategory}
                onChange={e => set('ticketCategory', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— Kategória —</option>
                <option value="support">Support</option>
                <option value="bug">Hiba</option>
                <option value="feature">Fejlesztési igény</option>
                <option value="complaint">Reklamáció</option>
                <option value="internal">Belső</option>
              </select>
              <div>
                <label className="text-xs text-gray-500 block mb-1">SLA határidő</label>
                <input
                  type="datetime-local"
                  value={form.slaDeadline}
                  onChange={e => set('slaDeadline', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold transition"
            >
              {saving ? t.common.saving : (initial ? t.common.save : t.common.create)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ task, onClose, onDeleted }: {
  task: CrmTask;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteCrmTask(task.id);
      toast.success('Feladat törölve');
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
        <h2 className="text-base font-semibold text-gray-900">Feladat törlése</h2>
        <p className="text-sm text-gray-500">
          Biztosan törölni szeretnéd: <strong>{task.title}</strong>?
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
            Mégsem
          </button>
          <button type="button" disabled={deleting} onClick={handleDelete}
            className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold transition">
            {deleting ? 'Törlés...' : 'Törlés'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onComplete,
  completing,
  onEdit,
  onDelete,
}: {
  task: CrmTask;
  onComplete: (id: string) => void;
  completing: boolean;
  onEdit: (task: CrmTask) => void;
  onDelete: (task: CrmTask) => void;
}) {
  const t = useT();
  const canWrite = useCanAccess('crm.tasks.write');
  const overdue = isOverdue(task);

  return (
    <div className={clsx(
      'bg-white rounded-xl border shadow-sm flex flex-col gap-3 p-4 transition',
      overdue ? 'border-red-200 border-l-4 border-l-red-500' : 'border-gray-100',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.low)}>
          {priorityLabel(task.priority, t)}
        </span>
        <div className="flex items-center gap-1.5">
          {task.dueDate && (
            <span className={clsx('flex items-center gap-1 text-xs', overdue ? 'text-red-600 font-semibold' : 'text-gray-400')}>
              {overdue && <AlertCircle className="w-3 h-3" />}
              <Calendar className="w-3 h-3" />
              {formatDate(task.dueDate)}
            </span>
          )}
          {canWrite && (
            <>
              <button type="button" onClick={() => onEdit(task)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => onDelete(task)}
                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Title */}
      <p className="font-semibold text-gray-900 text-base leading-snug">{task.title}</p>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>
      )}

      {/* Meta */}
      {(task.customerName || task.dealTitle || task.assignedToName) && (
        <p className="text-xs text-gray-400 flex items-center gap-1 truncate">
          {task.assignedToName && (
            <><User className="w-3 h-3 shrink-0" /><span>{task.assignedToName}</span></>
          )}
          {task.customerName && <span className="truncate">{task.assignedToName ? ' · ' : ''}{task.customerName}</span>}
          {task.dealTitle && <span className="truncate"> · {task.dealTitle}</span>}
        </p>
      )}

      {/* SLA + status tags */}
      <div className="flex items-center gap-2 flex-wrap">
        {task.status === 'in_progress' && (
          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
            Folyamatban
          </span>
        )}
        {task.slaStatus && task.slaStatus !== 'ok' && (
          <span className={clsx('flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full', SLA_BADGE[task.slaStatus])}>
            <ShieldAlert className="w-3 h-3" />
            {task.slaStatus === 'breached' ? 'SLA megszegve' : 'SLA kockázatos'}
          </span>
        )}
        {task.status === 'completed' && task.customerSatisfaction && (
          <span className="flex items-center gap-1 text-xs text-yellow-600">
            {Array.from({ length: task.customerSatisfaction }).map((_, i) => (
              <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            ))}
          </span>
        )}
        {task.ticketCategory && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {task.ticketCategory}
          </span>
        )}
      </div>

      {/* Done button */}
      <button
        type="button"
        disabled={completing}
        onClick={() => onComplete(task.id)}
        className="mt-auto w-full py-3 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold text-base transition active:scale-95"
      >
        {completing ? t.crm.marking : t.crm.markDone}
      </button>
    </div>
  );
}

// ─── All tasks grouped by assignee ───────────────────────────────────────────

function AllTasksView({ tasks, onComplete, completing, onEdit, onDelete }: {
  tasks: CrmTask[];
  onComplete: (id: string) => void;
  completing: string | null;
  onEdit: (t: CrmTask) => void;
  onDelete: (t: CrmTask) => void;
}) {
  const t = useT();
  const grouped = tasks.reduce<Record<string, { name: string; tasks: CrmTask[] }>>((acc, task) => {
    const key = task.assignedTo;
    if (!acc[key]) acc[key] = { name: task.assignedToName ?? task.assignedTo, tasks: [] };
    acc[key].tasks.push(task);
    return acc;
  }, {});

  if (Object.keys(grouped).length === 0) {
    return <p className="text-center text-gray-400 py-16">{t.crm.emptyTasks}</p>;
  }

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([userId, group]) => (
        <div key={userId}>
          <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            {group.name}
            <span className="ml-1 bg-gray-100 text-gray-500 text-xs px-1.5 py-0.5 rounded-full">
              {group.tasks.length}
            </span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.tasks.map(task => (
              <TaskCard key={task.id} task={task}
                onComplete={onComplete}
                completing={completing === task.id}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type StatusFilter = 'active' | 'in_progress' | 'all';

export default function CrmTasksPage() {
  const t = useT();
  const canWrite = useCanAccess('crm.tasks.write');
  const canSeeAll = useCanAccess('crm.all_tasks');
  const [viewAll, setViewAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [completing, setCompleting] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<CrmTask | null>(null);
  const [deleteTask, setDeleteTask] = useState<CrmTask | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { tasks: myTasks, mutate: mutateMyTasks, isLoading: loadingMy } = useMyTasks();
  const { tasks: allTasks, mutate: mutateAll, isLoading: loadingAll } = useCrmTasks(undefined, !viewAll);

  const tasks = viewAll ? allTasks : myTasks;
  const loading = viewAll ? loadingAll : loadingMy;
  const mutate = viewAll ? mutateAll : mutateMyTasks;

  async function handleComplete(id: string) {
    setCompleting(id);
    mutate((prev) => (prev ?? []).filter(t => t.id !== id), false);
    try {
      await completeCrmTask(id);
    } catch {
      mutate();
    } finally {
      setCompleting(null);
    }
  }

  const filteredTasks = tasks.filter(task => {
    if (statusFilter === 'active') return task.status !== 'completed' && task.status !== 'cancelled';
    if (statusFilter === 'in_progress') return task.status === 'in_progress';
    return task.status !== 'completed' && task.status !== 'cancelled';
  });

  const pendingCount = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {viewAll ? t.crm.allTasks : t.crm.tasks}
          </h1>
          {!loading && (
            <p className="text-sm text-gray-400 mt-0.5">{pendingCount} feladat</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canSeeAll && (
            <button
              type="button"
              onClick={() => setViewAll(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              {viewAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {viewAll ? t.crm.tasks : t.crm.allTasks}
            </button>
          )}
          {canWrite && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition"
            >
              <Plus className="w-4 h-4" />
              {t.crm.newTask}
            </button>
          )}
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 border-b border-gray-100">
        {([
          ['active',      `Aktív (${pendingCount})`],
          ['in_progress', 'Folyamatban'],
          ['all',         'Összes aktív'],
        ] as [StatusFilter, string][]).map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setStatusFilter(val)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition',
              statusFilter === val
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <p className="text-gray-400 text-sm">{t.common.loading}</p>
      ) : viewAll ? (
        <AllTasksView
          tasks={filteredTasks}
          onComplete={handleComplete}
          completing={completing}
          onEdit={setEditTask}
          onDelete={setDeleteTask}
        />
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">✓</p>
          <p className="text-gray-500 font-medium">{t.crm.emptyTasks}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={handleComplete}
              completing={completing === task.id}
              onEdit={setEditTask}
              onDelete={setDeleteTask}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {(showCreate || editTask) && (
        <TaskModal
          initial={editTask ?? undefined}
          onClose={() => { setShowCreate(false); setEditTask(null); }}
          onSaved={() => mutate()}
        />
      )}
      {deleteTask && (
        <DeleteConfirm
          task={deleteTask}
          onClose={() => setDeleteTask(null)}
          onDeleted={() => mutate()}
        />
      )}
    </div>
  );
}
