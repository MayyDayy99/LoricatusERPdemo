'use client';

import { useState } from 'react';
import {
  CalendarCheck, CheckSquare, Square, Plus, Lock, Play, ChevronDown, ChevronRight,
  AlertCircle, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useMeetingToday,
  startMeeting,
  closeMeeting,
  updateMeetingTask,
  addMeetingTask,
  type MeetingTaskGroup,
} from '@/lib/hooks/use-meeting';
import { useUsers } from '@/lib/hooks/use-users';

/* ── Helpers ─────────────────────────────────────────────────── */
function formatTime(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
}

/* ── TaskRow ─────────────────────────────────────────────────── */
function TaskRow({
  task,
  users,
  onTransition,
  locked,
}: {
  task: { id: string; title: string; assignedTo: string; status: string };
  users: Array<{ id: string; firstName: string; lastName: string }>;
  onTransition: (id: string, t: 'complete' | 'start' | 'cancel') => Promise<void>;
  locked: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const user = users.find(u => u.id === task.assignedTo);
  const userName = user ? `${user.firstName} ${user.lastName}` : task.assignedTo;
  const done = task.status === 'completed';

  async function handle(t: 'complete' | 'start' | 'cancel') {
    setBusy(true);
    try { await onTransition(task.id, t); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 group">
      <button
        type="button"
        disabled={locked || busy || done}
        onClick={() => handle(done ? 'start' : 'complete')}
        className="shrink-0 text-gray-400 hover:text-brand-600 disabled:opacity-40 disabled:cursor-default"
      >
        {busy
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : done
            ? <CheckSquare className="w-4 h-4 text-green-600" />
            : <Square className="w-4 h-4" />
        }
      </button>
      <span className={`flex-1 text-sm ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
        {task.title}
      </span>
      <span className="text-xs text-gray-500 shrink-0">{userName}</span>
      {!locked && !done && (
        <button
          type="button"
          onClick={() => handle('start')}
          disabled={busy || task.status === 'in_progress'}
          className="hidden group-hover:flex items-center gap-1 text-xs text-brand-600 hover:underline disabled:opacity-40"
        >
          <Play className="w-3 h-3" /> Folyamatban
        </button>
      )}
    </div>
  );
}

/* ── WorkOrderGroup ──────────────────────────────────────────── */
function WorkOrderGroup({
  group,
  users,
  onTransition,
  locked,
}: {
  group: MeetingTaskGroup;
  users: Array<{ id: string; firstName: string; lastName: string }>;
  onTransition: (id: string, t: 'complete' | 'start' | 'cancel') => Promise<void>;
  locked: boolean;
}) {
  const [open, setOpen] = useState(true);
  const done = group.tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-3 w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
      >
        {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        <span className="font-medium text-gray-800 flex-1 text-sm">{group.workOrderNumber}</span>
        <span className="text-xs text-gray-500">{done}/{group.tasks.length} kész</span>
      </button>
      {open && (
        <div className="divide-y divide-gray-50 px-1">
          {group.tasks.map(task => (
            <TaskRow key={task.id} task={task} users={users} onTransition={onTransition} locked={locked} />
          ))}
          {group.tasks.length === 0 && (
            <p className="text-xs text-gray-400 px-4 py-3">Nincs feladat ennél a munkalapnál.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── AddTaskForm ─────────────────────────────────────────────── */
function AddTaskForm({
  groups,
  users,
  onAdd,
}: {
  groups: MeetingTaskGroup[];
  users: Array<{ id: string; firstName: string; lastName: string }>;
  onAdd: (body: { title: string; assignedTo: string; workOrderId?: string }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState(users[0]?.id ?? '');
  const [workOrderId, setWorkOrderId] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !assignedTo) return;
    setBusy(true);
    try {
      await onAdd({ title: title.trim(), assignedTo, workOrderId: workOrderId || undefined });
      setTitle('');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-brand-600 hover:underline px-1 mt-2"
      >
        <Plus className="w-4 h-4" /> Feladat hozzáadása
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="border border-dashed border-brand-300 rounded-xl p-4 mt-2 space-y-3 bg-brand-50/30">
      <div>
        <label className="text-xs text-gray-600 font-medium block mb-1">Feladat leírása *</label>
        <input
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="pl. Helyszíni előkészítés"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-600 font-medium block mb-1">Felelős *</label>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            value={assignedTo}
            onChange={e => setAssignedTo(e.target.value)}
            required
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 font-medium block mb-1">Munkalap</label>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            value={workOrderId}
            onChange={e => setWorkOrderId(e.target.value)}
          >
            <option value="">— nincs —</option>
            {groups.map(g => (
              <option key={g.workOrderId} value={g.workOrderId}>{g.workOrderNumber}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">
          Mégsem
        </button>
        <button
          type="submit"
          disabled={busy}
          className="bg-brand-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Hozzáadás
        </button>
      </div>
    </form>
  );
}

/* ── Meeting Page ────────────────────────────────────────────── */
export default function MeetingPage() {
  const { session, groups, isLoading, mutate } = useMeetingToday();
  const { users } = useUsers();
  const [closeBusy, setCloseBusy] = useState(false);
  const [startBusy, setStartBusy] = useState(false);

  const allTasks = groups.flatMap(g => g.tasks);
  const doneTasks = allTasks.filter(t => t.status === 'completed').length;
  const locked = !!session?.closedAt;

  async function handleStart() {
    setStartBusy(true);
    try {
      await startMeeting();
      await mutate();
      toast.success('Meeting elkezdve!');
    } catch {
      toast.error('Nem sikerült elindítani a meetinget.');
    } finally {
      setStartBusy(false);
    }
  }

  async function handleClose() {
    if (!confirm('Lezárod a meetinget? A munkások ezután látják a feladatokat.')) return;
    setCloseBusy(true);
    try {
      await closeMeeting();
      await mutate();
      toast.success('Meeting lezárva!');
    } catch {
      toast.error('Nem sikerült lezárni a meetinget.');
    } finally {
      setCloseBusy(false);
    }
  }

  async function handleTransition(taskId: string, transition: 'complete' | 'start' | 'cancel') {
    await updateMeetingTask(taskId, transition);
    await mutate();
  }

  async function handleAdd(body: { title: string; assignedTo: string; workOrderId?: string }) {
    await addMeetingTask(body);
    await mutate();
    toast.success('Feladat hozzáadva');
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  /* ── Nincs session — indítás ── */
  if (!session) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <CalendarCheck className="w-12 h-12 text-brand-400 mx-auto" />
        <h2 className="text-xl font-semibold text-gray-800">Nincsen mai meeting</h2>
        <p className="text-sm text-gray-500">
          Indítsd el a reggeli meetinget, hogy kioszhassátok a napi feladatokat.
        </p>
        <button
          type="button"
          onClick={handleStart}
          disabled={startBusy}
          className="inline-flex items-center gap-2 bg-brand-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-50"
        >
          {startBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Meeting indítása
        </button>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-brand-600" />
            Reggeli meeting — {today}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {doneTasks}/{allTasks.length} feladat kész
            {locked && (
              <span className="ml-2 inline-flex items-center gap-1 text-green-700 font-medium">
                <Lock className="w-3.5 h-3.5" />
                Lezárva {formatTime(session.closedAt)}
              </span>
            )}
          </p>
        </div>
        {!locked && (
          <button
            type="button"
            onClick={handleClose}
            disabled={closeBusy}
            className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
          >
            {closeBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Meeting lezárása
          </button>
        )}
      </div>

      {/* Locked banner */}
      {locked && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <CheckSquare className="w-4 h-4 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">
            A meeting lezárult. A munkások mostantól látják a mai feladataikat.
          </p>
        </div>
      )}

      {/* Nincs WO-hoz rendelt feladat */}
      {groups.length === 0 && !locked && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
          <p className="text-sm text-yellow-800">
            Még nincsenek munkalaphoz rendelt feladatok. Adj hozzá feladatot alább.
          </p>
        </div>
      )}

      {/* WO Groups */}
      <div className="space-y-3">
        {groups.map(group => (
          <WorkOrderGroup
            key={group.workOrderId}
            group={group}
            users={users ?? []}
            onTransition={handleTransition}
            locked={locked}
          />
        ))}
      </div>

      {/* Add task (csak nyitott session) */}
      {!locked && (
        <AddTaskForm groups={groups} users={users ?? []} onAdd={handleAdd} />
      )}
    </div>
  );
}
