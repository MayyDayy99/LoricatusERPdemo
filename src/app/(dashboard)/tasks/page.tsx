'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Mail,
  Pencil,
  Phone,
  Play,
  Plus,
  StickyNote,
  Users as UsersIcon,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/lib/hooks/use-t';
import { useCurrentUser } from '@/lib/hooks/use-users';

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
type Priority = 'low' | 'medium' | 'high' | 'urgent';
type ActivityType = 'call' | 'meeting' | 'email' | 'note';
type TaskScopeFilter = 'all' | 'my' | 'overdue';
type TaskStatusFilter = 'all' | 'pending' | 'in_progress';
type TabKey = 'tasks' | 'activity';

interface CrmTask {
  id: string;
  title: string;
  description?: string;
  taskType?: string;
  status: TaskStatus;
  priority?: Priority;
  dueDate?: string;
  reminderAt?: string;
  assignedTo: string;
  customerId?: string;
  dealId?: string;
  projectId?: string;
  createdAt: string;
}

interface Activity {
  id: string;
  activityType: ActivityType;
  subject: string;
  body?: string;
  direction?: string;
  durationMinutes?: number;
  occurredAt?: string;
  customerId?: string;
  dealId?: string;
  projectId?: string;
  createdBy?: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
}

interface Project {
  id: string;
  name: string;
}

interface Deal {
  id: string;
  title: string;
  customerId?: string;
}

const STATUS_STYLES: Record<TaskStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const PRIORITY_STYLES: Record<Priority, string> = {
  low: 'text-gray-400',
  medium: 'text-yellow-500',
  high: 'text-orange-500',
  urgent: 'text-red-600',
};

const ACTIVITY_ICONS: Record<ActivityType, typeof Phone> = {
  call: Phone,
  meeting: UsersIcon,
  email: Mail,
  note: StickyNote,
};

function getErrorMessage(err: any) {
  const message = err?.response?.data?.message;
  if (Array.isArray(message)) return message.join(' · ');
  return message ?? 'Hiba';
}

function isOverdue(task: CrmTask) {
  return Boolean(task.dueDate)
    && new Date(task.dueDate as string) < new Date()
    && task.status !== 'completed'
    && task.status !== 'cancelled';
}

function getDisplayName<T extends { firstName: string; lastName: string } | { name: string } | { title: string }>(item?: T) {
  if (!item) return '—';
  if ('firstName' in item) return `${item.firstName} ${item.lastName}`;
  if ('name' in item) return item.name;
  return item.title;
}

function TaskModal({
  task,
  users,
  customers,
  deals,
  projects,
  defaultAssignee,
  onClose,
  onSaved,
}: {
  task: CrmTask | null;
  users: User[];
  customers: Customer[];
  deals: Deal[];
  projects: Project[];
  defaultAssignee?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const isEdit = Boolean(task?.id);
  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    taskType: task?.taskType ?? 'todo',
    dueDate: task?.dueDate ? task.dueDate.slice(0, 10) : '',
    priority: task?.priority ?? 'medium',
    assignedTo: task?.assignedTo ?? defaultAssignee ?? '',
    customerId: task?.customerId ?? '',
    dealId: task?.dealId ?? '',
    projectId: task?.projectId ?? '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm({
      title: task?.title ?? '',
      description: task?.description ?? '',
      taskType: task?.taskType ?? 'todo',
      dueDate: task?.dueDate ? task.dueDate.slice(0, 10) : '',
      priority: task?.priority ?? 'medium',
      assignedTo: task?.assignedTo ?? defaultAssignee ?? '',
      customerId: task?.customerId ?? '',
      dealId: task?.dealId ?? '',
      projectId: task?.projectId ?? '',
    });
  }, [defaultAssignee, task]);

  const availableDeals = useMemo(
    () => (form.customerId ? deals.filter((deal) => deal.customerId === form.customerId) : deals),
    [deals, form.customerId],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.assignedTo) return;

    setLoading(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        taskType: form.taskType || undefined,
        dueDate: form.dueDate || undefined,
        priority: form.priority,
        assignedTo: form.assignedTo,
        customerId: form.customerId || undefined,
        dealId: form.dealId || undefined,
        projectId: form.projectId || undefined,
      };

      if (isEdit && task) {
        await apiClient.patch(`/crm-tasks/${task.id}`, payload);
      } else {
        await apiClient.post('/crm-tasks', payload);
      }

      toast.success(t.common.saved);
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">{isEdit ? t.tasks.editTitle : t.tasks.newTitle}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder={t.tasks.titlePh}
            title={t.tasks.titlePh}
            aria-label={t.tasks.titlePh}
            value={form.title}
            onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
          />
          <textarea
            rows={2}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder={t.tasks.descPh}
            value={form.description}
            onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
          />
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder={t.tasks.taskTypePh}
            title={t.tasks.taskTypePh}
            aria-label={t.tasks.taskTypePh}
            value={form.taskType}
            onChange={(e) => setForm((current) => ({ ...current, taskType: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className="rounded-lg border px-3 py-2 text-sm"
              title={t.tasks.dueDatePh}
              aria-label={t.tasks.dueDatePh}
              value={form.dueDate}
              onChange={(e) => setForm((current) => ({ ...current, dueDate: e.target.value }))}
            />
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              title={t.tasks.priorityPh}
              aria-label={t.tasks.priorityPh}
              value={form.priority}
              onChange={(e) => setForm((current) => ({ ...current, priority: e.target.value as Priority }))}
            >
              {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((priority) => (
                <option key={priority} value={priority}>{t.tasks.priorities[priority]}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              required
              className="rounded-lg border px-3 py-2 text-sm"
              title={t.tasks.assigneePh}
              aria-label={t.tasks.assigneePh}
              value={form.assignedTo}
              onChange={(e) => setForm((current) => ({ ...current, assignedTo: e.target.value }))}
            >
              <option value="">— {t.tasks.assigneePh} —</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>)}
            </select>
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              title={t.tasks.customerPh}
              aria-label={t.tasks.customerPh}
              value={form.customerId}
              onChange={(e) => setForm((current) => ({ ...current, customerId: e.target.value, dealId: '' }))}
            >
              <option value="">— {t.tasks.customerPh} —</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.firstName} {customer.lastName}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              title={t.tasks.dealPh}
              aria-label={t.tasks.dealPh}
              value={form.dealId}
              onChange={(e) => setForm((current) => ({ ...current, dealId: e.target.value }))}
            >
              <option value="">— {t.tasks.dealPh} —</option>
              {availableDeals.map((deal) => <option key={deal.id} value={deal.id}>{deal.title}</option>)}
            </select>
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              title={t.tasks.projectPh}
              aria-label={t.tasks.projectPh}
              value={form.projectId}
              onChange={(e) => setForm((current) => ({ ...current, projectId: e.target.value }))}
            >
              <option value="">— {t.tasks.projectPh} —</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">{t.common.cancel}</button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? (isEdit ? t.common.saving : t.common.creating) : (isEdit ? t.common.save : t.common.create)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LogActivityModal({ customers, onClose, onSaved }: {
  customers: Customer[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState({
    activityType: 'note' as ActivityType,
    subject: '',
    body: '',
    customerId: '',
    durationMinutes: '',
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post('/activities', {
        activityType: form.activityType,
        subject: form.subject,
        body: form.body || undefined,
        customerId: form.customerId || undefined,
        durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes, 10) : undefined,
      });
      toast.success(t.common.saved);
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">{t.tasks.logActivity}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              title={t.tasks.activityType}
              aria-label={t.tasks.activityType}
              value={form.activityType}
              onChange={(e) => setForm((current) => ({ ...current, activityType: e.target.value as ActivityType }))}
            >
              {(['call', 'meeting', 'email', 'note'] as ActivityType[]).map((type) => (
                <option key={type} value={type}>{t.tasks.activityTypes[type]}</option>
              ))}
            </select>
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              title={t.tasks.customerPh}
              aria-label={t.tasks.customerPh}
              value={form.customerId}
              onChange={(e) => setForm((current) => ({ ...current, customerId: e.target.value }))}
            >
              <option value="">— {t.tasks.customerPh} —</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.firstName} {customer.lastName}</option>)}
            </select>
          </div>
          <input
            required
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder={t.tasks.activitySubject}
            value={form.subject}
            onChange={(e) => setForm((current) => ({ ...current, subject: e.target.value }))}
          />
          <textarea
            rows={3}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder={t.tasks.activityBody}
            value={form.body}
            onChange={(e) => setForm((current) => ({ ...current, body: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">{t.common.cancel}</button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? t.common.creating : t.common.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const t = useT();
  const { currentUser } = useCurrentUser();
  const [tab, setTab] = useState<TabKey>('tasks');
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeFilter, setScopeFilter] = useState<TaskScopeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [taskModalTask, setTaskModalTask] = useState<CrmTask | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  async function fetchAll() {
    setLoading(true);
    try {
      const [tasksResponse, activitiesResponse, usersResponse, customersResponse, projectsResponse, dealsResponse] = await Promise.all([
        apiClient.get<CrmTask[]>('/crm-tasks'),
        apiClient.get<Activity[]>('/activities'),
        apiClient.get<User[]>('/users'),
        // A /customers paginated: {items,total,take,skip}. A típus-cast Customer[]-ról
        // any-re vált, mert az új shape objektum.
        apiClient.get<any>('/customers?take=1000'),
        apiClient.get<Project[]>('/projects'),
        apiClient.get<Deal[]>('/deals'),
      ]);

      setTasks(tasksResponse.data);
      setActivities(activitiesResponse.data);
      setUsers(usersResponse.data);
      setCustomers(customersResponse.data?.items ?? customersResponse.data ?? []);
      setProjects(projectsResponse.data);
      setDeals(dealsResponse.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function runTaskAction(taskId: string, action: 'start' | 'complete' | 'cancel') {
    setBusyTaskId(taskId);
    try {
      await apiClient.post(`/crm-tasks/${taskId}/${action}`);
      toast.success(t.common.saved);
      await fetchAll();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyTaskId(null);
    }
  }

  const usersById = useMemo(
    () => Object.fromEntries(users.map((user) => [user.id, user])) as Record<string, User>,
    [users],
  );
  const customersById = useMemo(
    () => Object.fromEntries(customers.map((customer) => [customer.id, customer])) as Record<string, Customer>,
    [customers],
  );
  const projectsById = useMemo(
    () => Object.fromEntries(projects.map((project) => [project.id, project])) as Record<string, Project>,
    [projects],
  );
  const dealsById = useMemo(
    () => Object.fromEntries(deals.map((deal) => [deal.id, deal])) as Record<string, Deal>,
    [deals],
  );

  const filteredTasks = useMemo(() => tasks
    .filter((task) => {
      if (!showCompleted && (task.status === 'completed' || task.status === 'cancelled')) return false;
      if (scopeFilter === 'my') return task.assignedTo === currentUser?.id;
      if (scopeFilter === 'overdue') return isOverdue(task);
      return true;
    })
    .filter((task) => (statusFilter === 'all' ? true : task.status === statusFilter))
    .sort((left, right) => {
      const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return leftDue - rightDue;
    }), [currentUser?.id, scopeFilter, showCompleted, statusFilter, tasks]);

  const activityItems = useMemo(() => activities.map((activity) => ({
    ...activity,
    customer: activity.customerId ? customersById[activity.customerId] : undefined,
    deal: activity.dealId ? dealsById[activity.dealId] : undefined,
    project: activity.projectId ? projectsById[activity.projectId] : undefined,
    createdByUser: activity.createdBy ? usersById[activity.createdBy] : undefined,
  })), [activities, customersById, dealsById, projectsById, usersById]);

  if (loading) {
    return <div className="p-8 text-gray-400">{t.common.loading}</div>;
  }

  const overdueCount = tasks.filter((task) => isOverdue(task)).length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.tasks.title}</h1>
          <p className="mt-1 text-sm text-gray-500">{t.tasks.subtitle(filteredTasks.length)}</p>
        </div>

        <div className="flex gap-2">
          {tab === 'tasks' && (
            <button
              onClick={() => {
                setTaskModalTask(null);
                setTaskModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" /> {t.tasks.newBtn}
            </button>
          )}
          {tab === 'activity' && (
            <button
              onClick={() => setShowLogActivity(true)}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" /> {t.tasks.logActivity}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setTab('tasks')}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === 'tasks' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.tasks.tabTasks} <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs">{tasks.length}</span>
          </button>
          <button
            onClick={() => setTab('activity')}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === 'activity' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.tasks.tabActivity} <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs">{activities.length}</span>
          </button>
        </div>

        {tab === 'tasks' && (
          <div className="mb-px flex flex-wrap items-center gap-2">
            {([
              ['all', t.tasks.allTasks],
              ['my', t.tasks.myTasks],
              ['overdue', `${t.tasks.overdue} (${overdueCount})`],
            ] as [TaskScopeFilter, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setScopeFilter(key)}
                className={`rounded-full px-3 py-1 text-xs ${
                  scopeFilter === key ? 'bg-brand-50 font-medium text-brand-700' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}

            {([
              ['all', t.tasks.allStatuses],
              ['pending', t.tasks.statuses.pending],
              ['in_progress', t.tasks.statuses.in_progress],
            ] as [TaskStatusFilter, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`rounded-full px-3 py-1 text-xs ${
                  statusFilter === key ? 'bg-gray-900 font-medium text-white' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}

            <label className="ml-2 flex items-center gap-2 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                className="rounded border-gray-300"
              />
              {t.tasks.showCompleted}
            </label>
          </div>
        )}
      </div>

      {tab === 'tasks' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.tasks.colStatus}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.tasks.colTitle}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.tasks.colAssignee}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.tasks.colPriority}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.tasks.colDue}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{t.tasks.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTasks.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">{t.tasks.empty}</td></tr>
              )}
              {filteredTasks.map((task) => {
                const overdue = isOverdue(task);
                const assignee = usersById[task.assignedTo];
                const customer = task.customerId ? customersById[task.customerId] : undefined;
                const deal = task.dealId ? dealsById[task.dealId] : undefined;
                const project = task.projectId ? projectsById[task.projectId] : undefined;

                return (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 align-top">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[task.status]}`}>
                        {t.tasks.statuses[task.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-gray-900">{task.title}</div>
                      {task.description && (
                        <div className="mt-1 line-clamp-2 text-xs text-gray-500">{task.description}</div>
                      )}
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-400">
                        {customer && <span>{getDisplayName(customer)}</span>}
                        {deal && <span>{getDisplayName(deal)}</span>}
                        {project && <span>{getDisplayName(project)}</span>}
                        {task.taskType && <span>{task.taskType}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-gray-600">{getDisplayName(assignee)}</td>
                    <td className="px-4 py-3 align-top">
                      {task.priority && (
                        <span className={`text-xs font-medium ${PRIORITY_STYLES[task.priority]}`}>
                          {t.tasks.priorities[task.priority]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {task.dueDate ? (
                        <span className={overdue ? 'text-xs font-medium text-red-600' : 'text-xs text-gray-500'}>
                          {overdue && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                          {new Date(task.dueDate).toLocaleDateString('hu-HU')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="space-x-1 px-4 py-3 text-right align-top">
                      <button
                        onClick={() => {
                          setTaskModalTask(task);
                          setTaskModalOpen(true);
                        }}
                        title={t.common.edit}
                        aria-label={t.common.edit}
                        className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Pencil className="inline h-3 w-3" />
                      </button>
                      {task.status === 'pending' && (
                        <button
                          onClick={() => runTaskAction(task.id, 'start')}
                          disabled={busyTaskId === task.id}
                          className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                        >
                          <Play className="mr-0.5 inline h-3 w-3" />{t.tasks.startBtn}
                        </button>
                      )}
                      {(task.status === 'pending' || task.status === 'in_progress') && (
                        <button
                          onClick={() => runTaskAction(task.id, 'complete')}
                          disabled={busyTaskId === task.id}
                          className="rounded px-2 py-1 text-xs text-green-600 hover:bg-green-50 disabled:opacity-50"
                        >
                          <CheckCircle2 className="mr-0.5 inline h-3 w-3" />{t.tasks.completeBtn}
                        </button>
                      )}
                      {task.status !== 'completed' && task.status !== 'cancelled' && (
                        <button
                          onClick={() => runTaskAction(task.id, 'cancel')}
                          disabled={busyTaskId === task.id}
                          title={t.tasks.cancelBtn}
                          aria-label={t.tasks.cancelBtn}
                          className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50"
                        >
                          <XCircle className="inline h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'activity' && (
        <div className="space-y-3">
          {activityItems.length === 0 && (
            <div className="py-12 text-center text-gray-400">{t.tasks.activityEmpty}</div>
          )}
          {activityItems.map((activity) => {
            const Icon = ACTIVITY_ICONS[activity.activityType] ?? StickyNote;
            return (
              <div key={activity.id} className="flex gap-4 rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                  <Icon className="h-4 w-4 text-gray-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {t.tasks.activityTypes[activity.activityType]}
                    </span>
                    {activity.customer && (
                      <span className="text-xs text-gray-400">{getDisplayName(activity.customer)}</span>
                    )}
                    {activity.occurredAt && (
                      <span className="ml-auto text-xs text-gray-300">
                        {new Date(activity.occurredAt).toLocaleString('hu-HU')}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm font-medium text-gray-900">{activity.subject}</div>
                  {activity.body && <div className="mt-1 line-clamp-2 text-sm text-gray-500">{activity.body}</div>}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                    {activity.deal && <span>{getDisplayName(activity.deal)}</span>}
                    {activity.project && <span>{getDisplayName(activity.project)}</span>}
                    {activity.createdByUser && <span>{getDisplayName(activity.createdByUser)}</span>}
                    {activity.durationMinutes && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {activity.durationMinutes} perc</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {taskModalOpen && (
        <TaskModal
          task={taskModalTask}
          users={users}
          customers={customers}
          deals={deals}
          projects={projects}
          defaultAssignee={currentUser?.id}
          onClose={() => {
            setTaskModalOpen(false);
            setTaskModalTask(null);
          }}
          onSaved={fetchAll}
        />
      )}

      {showLogActivity && (
        <LogActivityModal
          customers={customers}
          onClose={() => setShowLogActivity(false)}
          onSaved={fetchAll}
        />
      )}
    </div>
  );
}
