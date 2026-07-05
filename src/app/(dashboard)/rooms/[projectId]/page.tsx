'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, ChevronRight, ChevronDown, Edit2, Check, Calendar, Clock,
  AlertCircle, ListChecks, Plus, MessageSquare, Activity,
  User, FolderOpen, Trash2, Archive, Play, RefreshCw, Plane, FileText, Wallet,
} from 'lucide-react';
import { useCommissionForProject } from '@/lib/hooks/use-commission';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import {
  useProject, updateProject, deleteProject, transitionProject,
  useProjectCategories,
  useProjectActivity, type ActivityEntry,
} from '@/lib/hooks/use-projects';
import { useCrmTasks, completeCrmTask, type CrmTask } from '@/lib/hooks/use-crm';
import { useUsers, useCurrentUser } from '@/lib/hooks/use-users';
import { useProjectDroneOperation } from '@/lib/hooks/use-drone';
import { DroneFlightPanel } from '@/components/drone/drone-flight-panel';
import { TaskEditorModal } from '../task-editor-modal';
import { Newsfeed } from './newsfeed';
import { ProjectDatasheet } from '@/components/projects/project-datasheet';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATE_LABEL: Record<string, string> = {
  draft:     'Tervezet',
  active:    'Aktív',
  completed: 'Lezárt',
  archived:  'Archivált',
};

const STATE_COLOR: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-700 border-gray-200',
  active:    'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  archived:  'bg-gray-50 text-gray-400 border-gray-200',
};

const TRANSITION_LABEL: Record<string, { label: string; icon: typeof Play; tone: string }> = {
  activate:   { label: 'Aktiválás',     icon: Play,    tone: 'text-blue-600 hover:bg-blue-50' },
  complete:   { label: 'Lezárás',       icon: Check,   tone: 'text-green-600 hover:bg-green-50' },
  archive:    { label: 'Archiválás',    icon: Archive, tone: 'text-gray-600 hover:bg-gray-50' },
  reactivate: { label: 'Újranyitás',    icon: RefreshCw, tone: 'text-blue-600 hover:bg-blue-50' },
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:     ['activate', 'archive'],
  active:    ['complete', 'archive'],
  completed: ['reactivate', 'archive'],
  archived:  [],
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params?.projectId ?? null;

  const { project, isLoading, mutate } = useProject(projectId);
  const { categories } = useProjectCategories();

  if (!projectId) {
    return <div className="p-6 text-sm text-gray-400">Hiányzó projekt ID</div>;
  }
  if (isLoading) {
    return <div className="p-6 text-sm text-gray-400">Töltés…</div>;
  }
  if (!project) {
    return (
      <div className="p-6">
        <div className="text-sm text-red-600">A projekt nem található.</div>
        <button onClick={() => router.push('/rooms')} className="mt-3 text-sm text-brand-600 hover:underline">
          ← Vissza a szobákhoz
        </button>
      </div>
    );
  }

  const category = categories.find(c => c.id === project.categoryId) ?? null;

  // MiniCRM-stílusú split layout:
  // - bal főnézet: Teendők (felül) + Előzmények (alul) — egy összefüggő scroll
  // - jobb sidebar: Adatlap (description + custom fields / 7-szekciós datasheet)
  //   + projekt-meta (felelős, szoba, repülés, dátumok, állapotváltás, törlés)
  return (
    <div className="-m-6 flex h-[calc(100vh-3rem)] flex-col bg-gray-50">
      <ProjectHeader
        project={project}
        category={category}
        onBack={() => router.push('/rooms')}
        onChange={() => mutate()}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-8">
            <TasksSection projectId={projectId} />
            <NewsfeedSection projectId={projectId} />
          </div>
        </div>

        <ProjectSidebar
          project={project}
          category={category}
          onChanged={() => mutate()}
          onDeleted={() => router.push('/rooms')}
        />
      </div>
    </div>
  );
}

// ─── Header (editable title + status) ────────────────────────────────────────

function ProjectHeader({
  project, category, onBack, onChange,
}: {
  project: any;
  category: any;
  onBack: () => void;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setName(project.name); }, [project.name]);

  async function saveName() {
    if (!name.trim() || name === project.name) {
      setEditing(false);
      setName(project.name);
      return;
    }
    setBusy(true);
    try {
      await updateProject(project.id, { name: name.trim() });
      onChange();
      setEditing(false);
      toast.success('Projekt név mentve');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Mentés sikertelen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4">
      <button
        onClick={onBack}
        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded transition"
        title="Vissza a szobákhoz"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>

      {/* Breadcrumb: kategória → projekt */}
      {category && (
        <span className="text-xs text-gray-400 flex items-center gap-1.5 shrink-0">
          <FolderOpen className="w-3.5 h-3.5" style={{ color: category.color }} />
          {category.name}
          <ChevronRight className="w-3 h-3" />
        </span>
      )}

      {/* Editable title */}
      <div className="flex-1 min-w-0 flex items-center gap-2 group">
        {editing ? (
          <>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); saveName(); }
                if (e.key === 'Escape') { setEditing(false); setName(project.name); }
              }}
              maxLength={200}
              disabled={busy}
              className="flex-1 text-lg font-semibold text-gray-900 bg-transparent border-b border-brand-400 focus:outline-none"
            />
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-gray-900 truncate">{project.name}</h1>
            <button
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-700 transition"
              title="Szerkesztés"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {/* State badge */}
      <span className={clsx(
        'text-xs font-medium px-2.5 py-1 rounded-full border tabular-nums shrink-0',
        STATE_COLOR[project.state] ?? STATE_COLOR.draft,
      )}>
        {STATE_LABEL[project.state] ?? project.state}
      </span>
    </header>
  );
}

// ─── Description editor (sidebarban használjuk) ──────────────────────────────

function DescriptionBlock({ project, onChange }: { project: any; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(project.description ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setDesc(project.description ?? ''); }, [project.description]);

  async function saveDesc() {
    if (desc === (project.description ?? '')) { setEditing(false); return; }
    setBusy(true);
    try {
      await updateProject(project.id, { description: desc });
      onChange();
      setEditing(false);
      toast.success('Leírás mentve');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Mentés sikertelen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] uppercase tracking-wider text-gray-400">Leírás</h3>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            <Edit2 className="w-3 h-3" /> Szerkesztés
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            rows={4}
            maxLength={2000}
            autoFocus
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setEditing(false); setDesc(project.description ?? ''); }}
              disabled={busy}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded"
            >
              Mégsem
            </button>
            <button
              onClick={saveDesc}
              disabled={busy}
              className="px-3 py-1.5 text-xs bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? 'Mentés…' : 'Mentés'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-700 whitespace-pre-wrap">
          {project.description?.trim() || <span className="italic text-gray-400">Nincs leírás. Kattints a szerkesztésre.</span>}
        </p>
      )}
    </section>
  );
}

// ─── Newsfeed szekció a bal főnézetben ───────────────────────────────────────

function NewsfeedSection({ projectId }: { projectId: string }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-400" />
          Előzmények
        </h2>
      </div>
      <div className="bg-white border border-gray-100 rounded-lg">
        <Newsfeed projectId={projectId} />
      </div>
    </section>
  );
}

// ─── Tasks szekció a bal főnézetben ──────────────────────────────────────────

function TasksSection({ projectId }: { projectId: string }) {
  const { tasks, isLoading, mutate } = useCrmTasks({ projectId });
  const { users } = useUsers();
  const [editing, setEditing] = useState<CrmTask | 'new' | null>(null);

  const groups = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().slice(0, 10);
    const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
    const out: Record<string, CrmTask[]> = { overdue: [], today: [], week: [], later: [], none: [] };
    for (const t of tasks) {
      // Draft task-ok (árazógép-importból) kihagyva a Teendők-listából — csak a
      // Map-en jelennek meg "PISZKOZAT" sávval, amíg a user nem véglegesíti.
      if (t.status === 'draft' || t.status === 'completed' || t.status === 'cancelled') continue;
      if (!t.dueDate) { out.none.push(t); continue; }
      const due = t.dueDate.slice(0, 10);
      if (due < todayIso) out.overdue.push(t);
      else if (due === todayIso) out.today.push(t);
      else if (due < weekEnd.toISOString().slice(0, 10)) out.week.push(t);
      else out.later.push(t);
    }
    return out;
  }, [tasks]);

  const completed = tasks.filter(t => t.status === 'completed' || t.status === 'cancelled');

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-gray-400" />
          Teendők ({tasks.length})
        </h2>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition"
        >
          <Plus className="w-4 h-4" /> Új teendő
        </button>
      </div>

      {isLoading && <div className="text-sm text-gray-400">Töltés…</div>}

      <div className="bg-white border border-gray-100 rounded-lg p-4 space-y-4">
        <TaskGroup label="Lejárt"  tone="red"   tasks={groups.overdue} users={users} onChanged={() => mutate()} onEdit={setEditing} />
        <TaskGroup label="Mai"     tone="brand" tasks={groups.today}   users={users} onChanged={() => mutate()} onEdit={setEditing} />
        <TaskGroup label="A héten" tone="blue"  tasks={groups.week}    users={users} onChanged={() => mutate()} onEdit={setEditing} />
        <TaskGroup label="Később"  tone="gray"  tasks={groups.later}   users={users} onChanged={() => mutate()} onEdit={setEditing} />
        <TaskGroup label="Nincs határidő" tone="gray" tasks={groups.none} users={users} onChanged={() => mutate()} onEdit={setEditing} />
        <TaskGroup label="Lezárva" tone="muted" tasks={completed}      users={users} onChanged={() => mutate()} onEdit={setEditing} collapsedDefault />

        {!isLoading && tasks.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <ListChecks className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Még nincs teendő ehhez a projekthez.</p>
            <button onClick={() => setEditing('new')} className="mt-3 text-brand-600 text-xs hover:underline font-medium">
              Hozz létre egyet
            </button>
          </div>
        )}
      </div>

      {editing && (
        <TaskEditorModal
          projectId={projectId}
          task={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { mutate(); setEditing(null); }}
        />
      )}
    </section>
  );
}

function TaskGroup({
  label, tone, tasks, users, onChanged, onEdit, collapsedDefault,
}: {
  label: string;
  tone: 'red' | 'brand' | 'blue' | 'gray' | 'muted';
  tasks: CrmTask[];
  users: Array<{ id: string; firstName: string; lastName: string }>;
  onChanged: () => void;
  onEdit: (task: CrmTask | 'new') => void;
  collapsedDefault?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(!!collapsedDefault);
  if (tasks.length === 0) return null;
  const toneCls = {
    red:   'text-red-600',
    brand: 'text-brand-700',
    blue:  'text-blue-700',
    gray:  'text-gray-600',
    muted: 'text-gray-400',
  }[tone];
  return (
    <div>
      <button
        onClick={() => setCollapsed(c => !c)}
        className={clsx('w-full flex items-center gap-2 text-xs font-semibold uppercase tracking-wider py-1', toneCls)}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        <span>{label}</span>
        <span className="text-gray-300 tabular-nums">({tasks.length})</span>
      </button>
      {!collapsed && (
        <ul className="mt-1.5 space-y-1.5">
          {tasks.map(t => <TaskRow key={t.id} task={t} users={users} onChanged={onChanged} onClick={() => onEdit(t)} />)}
        </ul>
      )}
    </div>
  );
}

function TaskRow({
  task, users, onChanged, onClick,
}: {
  task: CrmTask;
  users: Array<{ id: string; firstName: string; lastName: string }>;
  onChanged: () => void;
  onClick: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const assignee = task.assignedTo ? users.find(u => u.id === task.assignedTo) : null;
  const dueLabel = task.dueDate ? new Date(task.dueDate).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }) : null;
  const isDone = task.status === 'completed' || task.status === 'cancelled';
  const overdue = !isDone && task.dueDate && task.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10);

  async function handleComplete(e: React.MouseEvent) {
    e.stopPropagation();
    if (isDone) return;
    setBusy(true);
    try {
      await completeCrmTask(task.id);
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Lezárás sikertelen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      onClick={onClick}
      className={clsx(
        'flex items-start gap-2 px-3 py-2 rounded-lg transition cursor-pointer bg-white border border-gray-100',
        isDone ? 'opacity-60' : 'hover:border-gray-200 hover:shadow-sm',
      )}
    >
      <button
        onClick={handleComplete}
        disabled={busy || isDone}
        className={clsx(
          'mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition',
          isDone ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-brand-500',
        )}
      >
        {isDone && <Check className="w-3 h-3" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={clsx('text-sm', isDone && 'line-through text-gray-500', !isDone && 'text-gray-900')}>
          {task.title}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5 flex-wrap">
          {dueLabel && (
            <span className={clsx('flex items-center gap-0.5', overdue && 'text-red-600 font-medium')}>
              <Calendar className="w-3 h-3" />
              {dueLabel}
              {overdue && <AlertCircle className="w-3 h-3 ml-0.5" />}
            </span>
          )}
          {assignee && <span>· {assignee.firstName} {assignee.lastName}</span>}
          {task.taskType && task.taskType !== 'todo' && <span>· {task.taskType}</span>}
          {task.estimatedMinutes ? (
            <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{Math.round(task.estimatedMinutes / 60 * 10) / 10}h</span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

// ─── Communication tab (placeholder) ─────────────────────────────────────────

function CommunicationTab(_props: { projectId: string }) {
  return (
    <div className="p-6 max-w-3xl">
      <div className="text-center py-16 text-gray-400">
        <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">A kommunikációs napló (jegyzetek, email-ek, hívások) hamarosan elérhető.</p>
        <p className="text-xs mt-2 text-gray-300">A meglévő tevékenységek a Tevékenység tabon olvashatók.</p>
      </div>
    </div>
  );
}

// ─── Activity tab ────────────────────────────────────────────────────────────

function ActivityTab({ projectId }: { projectId: string }) {
  const { entries, isLoading } = useProjectActivity(projectId);
  const { users } = useUsers();

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-base font-semibold text-gray-900 mb-4">
        Tevékenység
        <span className="ml-2 text-xs text-gray-400 font-normal">({entries.length})</span>
      </h2>

      {isLoading && <div className="text-sm text-gray-400">Töltés…</div>}

      {!isLoading && entries.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nincs naplózott tevékenység.</p>
        </div>
      )}

      <ol className="space-y-3 relative pl-5">
        <span className="absolute top-1 left-1.5 bottom-1 w-px bg-gray-200" />
        {entries.map(entry => <ActivityEntryRow key={entry.id} entry={entry} users={users} />)}
      </ol>
    </div>
  );
}

function ActivityEntryRow({
  entry, users,
}: {
  entry: ActivityEntry;
  users: Array<{ id: string; firstName: string; lastName: string }>;
}) {
  const user = entry.userId ? users.find(u => u.id === entry.userId) : null;
  const date = new Date(entry.createdAt);
  return (
    <li className="relative">
      <span className="absolute -left-[18px] top-1.5 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-white" />
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-900">{actionLabel(entry.action)}</span>
        {user && <span className="text-xs text-gray-500">— {user.firstName} {user.lastName}</span>}
        <span className="text-[11px] text-gray-400">{date.toLocaleString('hu-HU')}</span>
      </div>
      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
        <pre className="mt-1 text-[11px] text-gray-500 bg-gray-50 px-2 py-1 rounded overflow-x-auto">
          {JSON.stringify(entry.metadata, null, 2)}
        </pre>
      )}
    </li>
  );
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    'project.created':    'Projekt létrehozva',
    'project.updated':    'Projekt módosítva',
    'project.transition': 'Állapotváltás',
    'project.deleted':    'Projekt törölve',
  };
  return map[action] ?? action;
}

// ─── Right sidebar ───────────────────────────────────────────────────────────

function ProjectSidebar({
  project, category, onChanged, onDeleted,
}: {
  project: any;
  category: any;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { users } = useUsers();
  const manager = users.find(u => u.id === project.managerId);
  const allowedTransitions = ALLOWED_TRANSITIONS[project.state] ?? [];
  // Drón→szoba fúzió: ha a projekthez tartozik repülés (DroneOperation),
  // a légtér-vezérlőpanel itt jelenik meg. Drón-feature nélkül null.
  const { operation: droneOp, mutate: mutateDrone } = useProjectDroneOperation(project.id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function doTransition(transition: string) {
    try {
      await transitionProject(project.id, transition);
      onChanged();
      toast.success('Állapot frissítve');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Sikertelen állapotváltás');
    }
  }

  // In-app kétlépcsős megerősítés a natív window.confirm() helyett — különben
  // ha a felhasználó bepipálta a böngésző "ne jelenjen meg több párbeszéd"
  // opcióját, a confirm() némán false-t adna és a gomb nem csinálna semmit.
  async function doDelete() {
    try {
      await deleteProject(project.id);
      toast.success('Projekt törölve');
      onDeleted();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Törlés sikertelen');
    }
  }

  // MiniCRM-stílusú jobb sidebar: ~420px széles, scrollolható.
  // Tartalom (felülről lefelé):
  //   • Műveletek — csak drón-projektnél (Indít/Lemondás/Befejezés/Megszakít
  //     + Dokumentumok + Megrendelői űrlap; a DroneFlightPanel teljes UI-ja)
  //   • Adatlap — projekt-meta (felelős/szoba/dátumok), leírás, 7-szekciós
  //     custom-fields datasheet, állapotváltás, törlés.
  return (
    <aside className="w-[420px] bg-white border-l border-gray-100 flex flex-col shrink-0 overflow-y-auto">
      {/* MŰVELETEK — csak ha van drón-művelet a projekthez kapcsolva */}
      {droneOp && (
        <div className="p-5 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 pb-1 mb-3">
            <Plane className="w-4 h-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-gray-900">Műveletek</h2>
          </div>
          <DroneFlightPanel operation={droneOp} onChanged={() => mutateDrone()} />
        </div>
      )}

      {/* JUTALÉK — admin/CEO-only badge a projekt-jutalék állapotáról */}
      <CommissionSidebarBadge projectId={project.id} />

      <div className="p-5 space-y-5">
        <div className="flex items-center gap-2 pb-1 -mt-1 mb-1 border-b border-gray-100">
          <FileText className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Adatlap</h2>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Felelős</div>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-300" />
            <span className="text-sm text-gray-800">
              {manager ? `${manager.firstName} ${manager.lastName}` : '—'}
            </span>
          </div>
        </div>

        {category && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Szoba</div>
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4" style={{ color: category.color }} />
              <span className="text-sm text-gray-800">{category.name}</span>
              <span className="text-[10px] text-gray-400 ml-auto">{category.categoryType}</span>
            </div>
          </div>
        )}

        <div>
          <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Létrehozva</div>
          <div className="text-sm text-gray-800">
            {new Date(project.createdAt).toLocaleString('hu-HU', {
              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </div>
        </div>

        {project.updatedAt && project.updatedAt !== project.createdAt && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Módosítva</div>
            <div className="text-sm text-gray-800">
              {new Date(project.updatedAt).toLocaleString('hu-HU', {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </div>
          </div>
        )}

        {/* Leírás */}
        <div className="pt-3 border-t border-gray-100">
          <DescriptionBlock project={project} onChange={onChanged} />
        </div>

        {/* Adatlap — kategória-specifikus dobozok + egyedi mezők (7-szekciós sablon) */}
        {project.categoryId && (
          <div className="pt-3 border-t border-gray-100">
            <ProjectDatasheet categoryId={project.categoryId} project={project} onChange={onChanged} />
          </div>
        )}

        {/* Címkék */}
        {project.tags && project.tags.length > 0 && (
          <div className="pt-3 border-t border-gray-100">
            <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">Címkék</div>
            <div className="flex flex-wrap gap-1.5">
              {project.tags.map((tag: string) => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {/* State transitions */}
        {allowedTransitions.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">Állapotváltás</div>
            <div className="space-y-1">
              {allowedTransitions.map(tr => {
                const meta = TRANSITION_LABEL[tr];
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <button
                    key={tr}
                    onClick={() => doTransition(tr)}
                    className={clsx(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition',
                      meta.tone,
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Delete — kétlépcsős in-app megerősítés (nincs window.confirm) */}
        <div className="pt-2 border-t border-gray-100">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-600">
                Biztosan törlöd a(z) <strong>{project.name}</strong> projektet? A teendők megmaradnak, a projekt soft-delete kerül.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={doDelete}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 transition"
                >
                  <Trash2 className="w-4 h-4" /> Törlés
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                >
                  Mégse
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition"
            >
              <Trash2 className="w-4 h-4" />
              Projekt törlése
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

// ─── Commission sidebar badge (admin/CEO-only) ──────────────────────────────

function CommissionSidebarBadge({ projectId }: { projectId: string }) {
  const { currentUser } = useCurrentUser();
  const { commission } = useCommissionForProject(projectId);
  const role = (currentUser as any)?.role;
  if (role !== 'admin' && role !== 'ADMIN' && role !== 'ceo' && role !== 'CEO') return null;
  if (!commission) return null; // nem-quote-eredetű projekt → ne mutassunk semmit

  const statusMeta: Record<string, { label: string; cls: string }> = {
    pending:  { label: 'Függőben',    cls: 'bg-gray-100 text-gray-700 border-gray-200' },
    earned:   { label: 'Megszerezve', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    lost:     { label: 'Elveszett',   cls: 'bg-red-50 text-red-700 border-red-200' },
    payable:  { label: 'Kifizethető', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
    paid:     { label: 'Kifizetve',   cls: 'bg-green-50 text-green-700 border-green-200' },
  };
  const meta = statusMeta[commission.status] ?? statusMeta.pending;
  const fmtHuf = (n: number) => new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(n);
  const overBudget = Number(commission.plannedDays) > commission.suggestedDays;

  return (
    <div className="p-5 border-b border-gray-200 bg-gradient-to-br from-amber-50 to-yellow-50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-amber-700" />
          <h2 className="text-sm font-semibold text-gray-900">Jutalék</h2>
        </div>
        <span className={clsx('text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-medium', meta.cls)}>
          {meta.label}
        </span>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between text-gray-600">
          <span>Alap</span><span className="font-medium text-gray-900">{fmtHuf(commission.baseFeeHuf)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Per fő</span><span className="font-medium text-gray-900">{fmtHuf(commission.perHeadHuf)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Napok</span>
          <span className={clsx('font-medium', overBudget ? 'text-red-600' : 'text-gray-900')}>
            {Number(commission.plannedDays).toFixed(1)} / {commission.suggestedDays}
          </span>
        </div>
      </div>
    </div>
  );
}
