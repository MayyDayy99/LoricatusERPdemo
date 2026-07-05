'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { mutate as globalMutate } from 'swr';
import {
  Building2, Briefcase, ClipboardList, Folder, Wrench, Building, Plane,
  Plus, Trash2, Edit2, ChevronRight, List, LayoutGrid, GanttChartSquare, RefreshCw, Download,
} from 'lucide-react';
import { MeetingView } from '../meeting/_view';
import { useRoomViewPreference } from '@/lib/hooks/use-room-view-preference';
import { useWorksheetTemplates } from '@/lib/hooks/use-worksheet-templates';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { apiClient } from '@/lib/api-client';
import { useCurrentUser } from '@/lib/hooks/use-users';
import {
  useProjectCategories, createProjectCategory, updateProjectCategory, deleteProjectCategory,
  seedDroneRoom, convertDroneOperations,
  useProjects, createProject, transitionProject,
  useTaskTemplates, createTaskTemplate, updateTaskTemplate, deleteTaskTemplate,
  type ProjectCategory, type Project, type ProjectCategoryType, type TaskTemplate,
} from '@/lib/hooks/use-projects';

// Egyszerű ikon-paletta a kategóriához. A backend tárolja az ikon nevét.
type LucideIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Folder, Briefcase, Building, Building2, ClipboardList, Wrench, Plane,
};
const ICON_NAMES = Object.keys(CATEGORY_ICONS);
const ICON_DEFAULT = 'Folder';

const COLOR_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#6b7280'];

// Sentinel: a "Besorolatlan" virtuális szoba — projektek category_id IS NULL.
const UNCATEGORISED_ID = '__uncategorised__';

// Kanban oszlopok — projekt-állapotok. A drop-művelet a megengedett
// ProjectStateMachine átmenetet hívja.
const KANBAN_COLUMNS: Array<{
  state: string;
  label: string;
  color: string;
  border: string;
}> = [
  { state: 'draft',     label: 'Tervezet', color: 'bg-gray-50',  border: 'border-gray-300' },
  { state: 'active',    label: 'Aktív',    color: 'bg-blue-50',  border: 'border-blue-300' },
  { state: 'completed', label: 'Lezárt',   color: 'bg-green-50', border: 'border-green-300' },
  { state: 'archived',  label: 'Archív',   color: 'bg-zinc-50',  border: 'border-zinc-300' },
];

/** state → state átmenet → ProjectTransition név. Ha undefined, a drop nem megengedett. */
function transitionFor(from: string, to: string): string | null {
  if (from === to) return null;
  const map: Record<string, Record<string, string>> = {
    draft:     { active: 'activate',   archived: 'archive' },
    active:    { completed: 'complete', archived: 'archive' },
    completed: { active: 'reactivate', archived: 'archive' },
    archived:  {},
  };
  return map[from]?.[to] ?? null;
}

type ViewMode = 'list' | 'kanban' | 'gantt';

export default function RoomsPage() {
  const { categories, mutate: mutateCategories } = useProjectCategories();
  const [activeRoomId, setActiveRoomIdState] = useState<string | null>(null);
  const [showCategoryEditor, setShowCategoryEditor] = useState<ProjectCategory | 'new' | null>(null);
  const [converting, setConverting] = useState(false);
  const searchParams = useSearchParams();
  const { viewModes, lastActiveRoom, isLoaded, setRoomView, setLastActiveRoom } = useRoomViewPreference();

  // URL-query alkalmazás (redirect-flow miatt: pl. /office-admin → /rooms?room=X&view=gantt).
  const queryRoomId = searchParams.get('room');
  const queryView = searchParams.get('view') as ViewMode | null;

  // Auto-pick prioritás: 1. URL-query, 2. server-side perzisztált utolsó szoba,
  // 3. első kategória. KÖTELEZŐ várni amíg az `isLoaded === true`, különben az
  // SWR még tölt és visszaesnénk az első szobára (false-fallback).
  useEffect(() => {
    if (activeRoomId) return;
    if (!isLoaded) return;
    if (categories.length === 0) return;
    if (queryRoomId && categories.some(c => c.id === queryRoomId)) {
      setActiveRoomIdState(queryRoomId);
      return;
    }
    if (lastActiveRoom && categories.some(c => c.id === lastActiveRoom)) {
      setActiveRoomIdState(lastActiveRoom);
      return;
    }
    setActiveRoomIdState(categories[0].id);
  }, [categories, activeRoomId, queryRoomId, lastActiveRoom, isLoaded]);

  // Wrap: minden szoba-kiválasztás server-side mentődik a `lastActiveRoom`-ba.
  function setActiveRoomId(id: string | null) {
    setActiveRoomIdState(id);
    if (id && id !== UNCATEGORISED_ID) {
      void setLastActiveRoom(id);
    }
  }

  return (
    <div className="flex h-full -m-6">
      {/* ── Bal sáv: szobák ─────────────────────────────────────────── */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Szobák</h2>
          <button
            onClick={() => setShowCategoryEditor('new')}
            title="Új szoba"
            className="p-1 text-gray-400 hover:text-brand-600 rounded transition"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {categories.map(c => {
            const Icon = CATEGORY_ICONS[c.icon] ?? Folder;
            return (
              <button
                key={c.id}
                onClick={() => setActiveRoomId(c.id)}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition border-l-2',
                  activeRoomId === c.id
                    ? 'bg-gray-50 border-l-current font-medium'
                    : 'border-l-transparent hover:bg-gray-50',
                )}
                style={activeRoomId === c.id ? { color: c.color } : { color: '#374151' }}
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color: c.color }} />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-xs text-gray-400 tabular-nums">{c.projectCount}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Jobb: kiválasztott szoba projektjei ─────────────────────── */}
      <RoomProjects
        roomId={activeRoomId}
        category={categories.find(c => c.id === activeRoomId) ?? null}
        defaultView={queryView === 'kanban' || queryView === 'gantt' ? queryView : 'list'}
        onEditCategory={(c) => setShowCategoryEditor(c)}
        onCategoryChanged={() => mutateCategories()}
      />

      {/* Category editor modal */}
      {showCategoryEditor && (
        <CategoryEditorModal
          initial={showCategoryEditor === 'new' ? null : showCategoryEditor}
          onClose={() => setShowCategoryEditor(null)}
          onSaved={async () => { await mutateCategories(); setShowCategoryEditor(null); }}
        />
      )}
    </div>
  );
}

// ─── Room Projects (közép panel) ─────────────────────────────────────────────

function RoomProjects({
  roomId,
  category,
  defaultView = 'list',
  onEditCategory,
  onCategoryChanged,
}: {
  roomId: string | null;
  category: ProjectCategory | null;
  defaultView?: ViewMode;
  onEditCategory: (c: ProjectCategory) => void;
  onCategoryChanged: () => void;
}) {
  const router = useRouter();
  const filter = roomId === UNCATEGORISED_ID ? { categoryId: null } : roomId ? { categoryId: roomId } : undefined;
  const { projects, isLoading, mutate } = useProjects(filter);
  const [showNewProject, setShowNewProject] = useState(false);
  const [view, setView] = useState<ViewMode>(defaultView);
  const { viewModes, isLoaded, setRoomView } = useRoomViewPreference();

  // Per-szoba perzisztált view-mód: roomId-változáskor betölti a megjegyzett
  // view-t. KÖTELEZŐ várni amíg az SWR betölt (`isLoaded`), különben a "nincs
  // perzisztált érték" fallback-re esnénk vissza még a server-választás előtt.
  //
  // STICKY BEHAVIOR: ha az új szobához NINCS még mentett view, a jelenlegi
  // view-t MEGTARTJUK (nem váltunk vissza list-re). A user kérése: ha Gantt-on
  // vagyok és szobát váltok, maradjak Gantt-on. Csak akkor változik a view,
  // ha az új szobához van konkrét, korábban elmentett választás.
  useEffect(() => {
    if (!roomId || roomId === UNCATEGORISED_ID) return;
    if (!isLoaded) return;
    const stored = viewModes[roomId];
    if (stored) setView(stored);
    // else: nincs mentett érték → maradunk a jelenlegi view-n (sticky)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isLoaded, viewModes]);

  function handleSetView(v: ViewMode) {
    setView(v);
    if (roomId && roomId !== UNCATEGORISED_ID) {
      void setRoomView(roomId, v);  // fire-and-forget; optimistic local update
    }
  }

  // Manuális cross-cache invalidation: a /rooms saját mutation-pontjai (Kanban
  // transition, új projekt) a /dashboard/overview cache-t is invalidálják,
  // hogy a Gantt-tab azonnal lássa a változást (gyorsabb mint az SSE-roundtrip).
  function bumpOverview() {
    void globalMutate(key => typeof key === 'string' && key.startsWith('/dashboard/overview'));
  }

  if (!roomId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Válassz egy szobát a bal oldalon.
      </div>
    );
  }

  const title = roomId === UNCATEGORISED_ID ? 'Besorolatlan' : category?.name ?? '…';
  const titleColor = roomId === UNCATEGORISED_ID ? '#6b7280' : category?.color ?? '#374151';
  const Icon = roomId === UNCATEGORISED_ID
    ? Folder
    : (category && CATEGORY_ICONS[category.icon]) ?? Folder;

  async function handleDeleteCategory() {
    if (!category) return;
    if (!confirm(
      `Töröljed a(z) "${category.name}" szobát?\n\n` +
      `A benne lévő projektek nem törlődnek — átkerülnek a "Besorolatlan" gyűjtőbe.`,
    )) return;
    try {
      await deleteProjectCategory(category.id);
      toast.success('Szoba törölve');
      onCategoryChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Törlés sikertelen');
    }
  }

  return (
    <section className="flex-1 flex flex-col bg-gray-50 min-w-0">
      <header className="px-6 py-4 border-b border-gray-100 bg-white flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-5 h-5 shrink-0" style={{ color: titleColor }} />
          <h1 className="text-lg font-semibold text-gray-900 truncate" style={{ color: titleColor }}>{title}</h1>
          <span className="text-xs text-gray-400 tabular-nums">({projects.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 mr-1">
            <button
              onClick={() => handleSetView('list')}
              className={clsx(
                'px-2 py-1 rounded-md text-xs flex items-center gap-1 transition',
                view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              )}
              title="Lista nézet"
            >
              <List className="w-3.5 h-3.5" />
              Lista
            </button>
            <button
              onClick={() => handleSetView('kanban')}
              className={clsx(
                'px-2 py-1 rounded-md text-xs flex items-center gap-1 transition',
                view === 'kanban' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              )}
              title="Kanban nézet"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Kanban
            </button>
            <button
              onClick={() => handleSetView('gantt')}
              className={clsx(
                'px-2 py-1 rounded-md text-xs flex items-center gap-1 transition',
                view === 'gantt' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              )}
              title="Gantt nézet — szoba-szintű projekt map"
            >
              <GanttChartSquare className="w-3.5 h-3.5" />
              Gantt
            </button>
          </div>
          {category && (
            <>
              <button onClick={() => onEditCategory(category)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition" title="Szoba szerkesztése">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={handleDeleteCategory} className="p-1.5 text-gray-400 hover:text-red-600 rounded transition" title="Szoba törlése">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => setShowNewProject(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition"
          >
            <Plus className="w-4 h-4" /> Új projekt
          </button>
        </div>
      </header>

      {view === 'list' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading && <div className="text-sm text-gray-400">Töltés…</div>}
          {!isLoading && projects.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Folder className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Még nincs projekt ebben a szobában.</p>
            </div>
          )}
          {projects.map(p => (
            <ProjectRowMini
              key={p.id}
              project={p}
              onClick={() => router.push(`/rooms/${p.id}`)}
            />
          ))}
        </div>
      )}
      {view === 'kanban' && (
        <KanbanBoard
          projects={projects}
          isLoading={isLoading}
          onProjectClick={id => router.push(`/rooms/${id}`)}
          onTransitioned={() => { mutate(); bumpOverview(); }}
        />
      )}
      {view === 'gantt' && roomId && roomId !== UNCATEGORISED_ID && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <MeetingView categoryId={roomId} embedded />
        </div>
      )}
      {view === 'gantt' && (!roomId || roomId === UNCATEGORISED_ID) && (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-500 p-8 text-center">
          A „Besorolatlan” szobához nincs Gantt-nézet — válassz egy rendes szobát.
        </div>
      )}

      {showNewProject && (
        <NewProjectInRoomModal
          categoryId={roomId === UNCATEGORISED_ID ? null : roomId}
          onClose={() => setShowNewProject(false)}
          onCreated={() => { mutate(); bumpOverview(); setShowNewProject(false); }}
        />
      )}
    </section>
  );
}

function ProjectRowMini({
  project,
  onClick,
}: {
  project: Project;
  onClick: () => void;
}) {
  const stateColor: Record<string, string> = {
    draft:     'bg-gray-100 text-gray-600',
    active:    'bg-blue-50 text-blue-700',
    on_hold:   'bg-amber-50 text-amber-700',
    completed: 'bg-green-50 text-green-700',
    archived:  'bg-gray-100 text-gray-400',
    cancelled: 'bg-red-50 text-red-600',
  };
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition border bg-white border-gray-100 hover:border-brand-300 hover:shadow-sm group"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">{project.name}</div>
        {project.description && (
          <div className="text-xs text-gray-500 truncate mt-0.5">{project.description}</div>
        )}
      </div>
      <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', stateColor[project.state] ?? stateColor.draft)}>
        {project.state}
      </span>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-600 transition" />
    </button>
  );
}

// ─── Kanban board ───────────────────────────────────────────────────────────

function KanbanBoard({
  projects, isLoading, onProjectClick, onTransitioned,
}: {
  projects: Project[];
  isLoading: boolean;
  onProjectClick: (id: string) => void;
  onTransitioned: () => void;
}) {
  // Optimisztikus state: drop után azonnal mutatjuk az új oszlopban a kártyát.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState<string | null>(null);

  // Reset overrides amikor a projects újra-fetchelődik (kívülről).
  useEffect(() => { setOverrides({}); }, [projects]);

  const effectiveState = (p: Project) => overrides[p.id] ?? p.state;
  const projectsByState = (state: string) => projects.filter(p => effectiveState(p) === state);

  function handleDragStart(e: React.DragEvent, project: Project) {
    e.dataTransfer.setData('text/plain', project.id);
    e.dataTransfer.setData('application/x-project-state', project.state);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, columnState: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(columnState);
  }

  function handleDragLeave() {
    setDragOver(null);
  }

  async function handleDrop(e: React.DragEvent, targetState: string) {
    e.preventDefault();
    setDragOver(null);
    const projectId = e.dataTransfer.getData('text/plain');
    const fromState = e.dataTransfer.getData('application/x-project-state');
    if (!projectId || !fromState || fromState === targetState) return;

    const transition = transitionFor(fromState, targetState);
    if (!transition) {
      const labels: Record<string, string> = {
        draft: 'Tervezet', active: 'Aktív', completed: 'Lezárt', archived: 'Archív',
      };
      toast.error(`Nem megengedett: ${labels[fromState]} → ${labels[targetState]}`);
      return;
    }

    // Optimisztikus áthelyezés
    setOverrides(o => ({ ...o, [projectId]: targetState }));

    try {
      await transitionProject(projectId, transition);
      toast.success('Áthelyezve');
      onTransitioned();
    } catch (err: any) {
      // Visszafordítás
      setOverrides(o => {
        const next = { ...o };
        delete next[projectId];
        return next;
      });
      toast.error(err?.response?.data?.message ?? 'Áthelyezés sikertelen');
    }
  }

  if (isLoading) {
    return <div className="flex-1 p-4 text-sm text-gray-400">Töltés…</div>;
  }

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden">
      <div className="flex gap-3 p-3 h-full min-w-max">
        {KANBAN_COLUMNS.map(col => {
          const colProjects = projectsByState(col.state);
          const isDragTarget = dragOver === col.state;
          return (
            <div
              key={col.state}
              onDragOver={e => handleDragOver(e, col.state)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.state)}
              className={clsx(
                'flex flex-col w-72 rounded-lg border-2 transition',
                isDragTarget ? `${col.color} ${col.border} border-solid` : `bg-white border-gray-100 border-dashed`,
              )}
            >
              <div className={clsx('px-3 py-2 border-b flex items-center justify-between', col.color, 'rounded-t-lg')}>
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{col.label}</span>
                <span className="text-xs text-gray-500 tabular-nums">{colProjects.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px]">
                {colProjects.length === 0 && (
                  <div className="text-center text-[11px] text-gray-300 py-6">Üres</div>
                )}
                {colProjects.map(p => (
                  <KanbanCard
                    key={p.id}
                    project={p}
                    onClick={() => onProjectClick(p.id)}
                    onDragStart={e => handleDragStart(e, p)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({
  project, onClick, onDragStart,
}: {
  project: Project;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-2.5 cursor-pointer hover:border-brand-300 hover:shadow-sm transition active:cursor-grabbing"
    >
      <div className="text-sm font-medium text-gray-900 truncate">{project.name}</div>
      {project.description && (
        <div className="text-[11px] text-gray-500 line-clamp-2 mt-1">{project.description}</div>
      )}
      <div className="text-[10px] text-gray-400 mt-1.5 tabular-nums">
        {new Date(project.createdAt).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}
      </div>
    </div>
  );
}

// ─── Modals ─────────────────────────────────────────────────────────────────

function CategoryEditorModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: ProjectCategory | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? COLOR_PALETTE[0]);
  const [icon, setIcon] = useState(initial?.icon ?? ICON_DEFAULT);
  const [categoryType, setCategoryType] = useState<ProjectCategoryType>(initial?.categoryType ?? 'Generic');
  // Új projekt automatikus adatlapja (munkalap-sablon) — pl. Drón ügyintézéshez légtér-adatlap.
  const [defaultWorksheetTemplateId, setDefaultWorksheetTemplateId] = useState<string>(
    initial?.defaultWorksheetTemplateId ?? '',
  );
  // A szoba projektjei megjelennek-e a Projekt mapen. A MiniCRM-szobák
  // és az Iroda-adminisztráció alapból false — csak a "Mai napom"-on
  // látszanak a task-ok, a Gantt-on nem.
  const [showInProjectMap, setShowInProjectMap] = useState<boolean>(
    initial?.showInProjectMap ?? true,
  );
  const { templates: worksheetTemplates } = useWorksheetTemplates();
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) { toast.error('Add meg a nevet'); return; }
    setBusy(true);
    try {
      const payload = {
        name, color, icon, categoryType,
        defaultWorksheetTemplateId: defaultWorksheetTemplateId || null,
        showInProjectMap,
      };
      if (initial) await updateProjectCategory(initial.id, payload);
      else         await createProjectCategory(payload);
      await onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Mentés sikertelen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {initial ? 'Szoba szerkesztése' : 'Új szoba'}
        </h2>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Név</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="pl. Iroda menedzselés"
            maxLength={120}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Szín</label>
          <div className="flex gap-2">
            {COLOR_PALETTE.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={clsx('w-7 h-7 rounded-full border-2 transition', color === c ? 'border-gray-900 scale-110' : 'border-transparent')}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Ikon</label>
          <div className="flex gap-1.5 flex-wrap">
            {ICON_NAMES.map(name => {
              const I = CATEGORY_ICONS[name];
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setIcon(name)}
                  className={clsx(
                    'p-2 rounded-lg border transition',
                    icon === name ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50',
                  )}
                  title={name}
                >
                  <I className="w-4 h-4" style={{ color }} />
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Típus</label>
          <select
            value={categoryType}
            onChange={e => setCategoryType(e.target.value as ProjectCategoryType)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="Generic">Általános</option>
            <option value="ProjectManagement">Projekt-menedzsment</option>
            <option value="Sales">Értékesítés</option>
            <option value="Implementation">Implementáció</option>
            <option value="Order">Rendelés</option>
            <option value="OfficeAdmin">Iroda-adminisztráció</option>
          </select>
          <p className="text-[11px] text-gray-400 mt-1">A típus határozza meg a projekt-detail jobb sávjának default akcióit. <strong>Iroda-adminisztráció</strong>: külön szoba, NEM jelenik meg a fő `/meeting` Projekt mapon (de a szoba saját Gantt-jén igen).</p>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-2">Projekt mapen megjelenjen?</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowInProjectMap(true)}
              className={clsx(
                'flex-1 px-3 py-2 rounded-lg text-sm border transition',
                showInProjectMap ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              Igen (Gantt-on látszik)
            </button>
            <button
              type="button"
              onClick={() => setShowInProjectMap(false)}
              className={clsx(
                'flex-1 px-3 py-2 rounded-lg text-sm border transition',
                !showInProjectMap ? 'bg-amber-50 border-amber-400 text-amber-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              Nem (csak Mai napom-on)
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            A „Nem"-re állított szoba projektjei nem jelennek meg a /meeting Gantt-on.
            A task-ok továbbra is feltűnnek a „Mai napom" napi nézetnél a hozzárendelt
            személynél — csak a teljes terv nem szennyezi a Projekt mapet. Hasznos
            MiniCRM-importált archív szobákhoz vagy iroda-adminisztrációs feladatokhoz.
          </p>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Alapértelmezett adatlap (munkalap-sablon)</label>
          <select
            value={defaultWorksheetTemplateId}
            onChange={e => setDefaultWorksheetTemplateId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="">— nincs —</option>
            {(worksheetTemplates ?? []).map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <p className="text-[11px] text-gray-400 mt-1">
            Ha be van állítva, minden új projekt ebben a kategóriában automatikusan megkapja
            ezt a munkalap-sablont (pl. „Drón ügyintézés" → légtér-adatlap). A munkalap a
            szoba „Munkalap" fülén jelenik meg, és bármikor szerkeszthető.
          </p>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Mégsem</button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !name.trim()}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'Mentés…' : initial ? 'Mentés' : 'Létrehozás'}
          </button>
        </div>
        </div>

        {/* Sablon-feladatok — csak meglévő kategóriához (mentés után) */}
        {initial && <TaskTemplatesEditor categoryId={initial.id} />}

        {/* Adatlap-szerkesztő — dobozok + egyedi mezők */}
        {initial && (
          <div className="border-t border-gray-100 px-6 py-5 bg-gray-50 rounded-b-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Adatlap</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  A projekt-oldal adatlapjának dobozai és egyedi mezői.
                </p>
              </div>
              <button
                onClick={() => router.push(`/rooms/categories/${initial.id}/fields`)}
                className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 font-medium"
              >
                Adatlap testreszabása
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskTemplatesEditor({ categoryId }: { categoryId: string }) {
  const { templates, mutate } = useTaskTemplates(categoryId);
  const [editing, setEditing] = useState<TaskTemplate | 'new' | null>(null);

  return (
    <div className="border-t border-gray-100 px-6 py-5 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Sablon-feladatok</h3>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Új sablon
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Új projekt létrehozásakor a szobához tartozó sablon-feladatok automatikusan elkészülnek.
      </p>

      {templates.length === 0 ? (
        <div className="text-xs text-gray-400 text-center py-4">Nincs sablon-feladat ehhez a szobához.</div>
      ) : (
        <ul className="space-y-1.5">
          {templates.map(t => (
            <li
              key={t.id}
              className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-100 group"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900 truncate">{t.name}</div>
                <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                  {t.taskType && t.taskType !== 'todo' && <span>{t.taskType}</span>}
                  {t.priority && t.priority !== 'medium' && <span>· {t.priority}</span>}
                  {t.defaultDueOffsetDays != null && <span>· +{t.defaultDueOffsetDays} nap</span>}
                </div>
              </div>
              <button
                onClick={() => setEditing(t)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition"
                title="Szerkesztés"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`Törlöd a(z) "${t.name}" sablont?`)) return;
                  try { await deleteTaskTemplate(t.id); await mutate(); }
                  catch (err: any) { toast.error(err?.response?.data?.message ?? 'Törlés sikertelen'); }
                }}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition"
                title="Törlés"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <TaskTemplateModal
          categoryId={categoryId}
          template={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { await mutate(); setEditing(null); }}
        />
      )}
    </div>
  );
}

function TaskTemplateModal({
  categoryId, template, onClose, onSaved,
}: {
  categoryId: string;
  template: TaskTemplate | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [taskType, setTaskType] = useState(template?.taskType ?? 'todo');
  const [priority, setPriority] = useState(template?.priority ?? 'medium');
  const [offsetDays, setOffsetDays] = useState<string>(
    template?.defaultDueOffsetDays != null ? String(template.defaultDueOffsetDays) : '',
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) { toast.error('Add meg a nevet'); return; }
    setBusy(true);
    try {
      const dto = {
        name: name.trim(),
        description: description.trim() || undefined,
        taskType,
        priority,
        defaultDueOffsetDays: offsetDays ? parseInt(offsetDays, 10) : undefined,
      };
      if (template) await updateTaskTemplate(template.id, dto);
      else          await createTaskTemplate(categoryId, dto);
      await onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Mentés sikertelen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-gray-900">
          {template ? 'Sablon-feladat szerkesztése' : 'Új sablon-feladat'}
        </h3>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Név</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="pl. Légtér engedély intézése"
            maxLength={500}
            autoFocus
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Leírás</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            maxLength={5000}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Típus</label>
            <select
              value={taskType}
              onChange={e => setTaskType(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="todo">Általános</option>
              <option value="terep">Terep</option>
              <option value="iroda">Iroda</option>
              <option value="feldolgozas">Feldolgozás</option>
              <option value="sales">Sales</option>
              <option value="marketing">Marketing</option>
              <option value="szamlazas">Számlázás</option>
              <option value="gepido">Gépidő</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Prioritás</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="low">Alacsony</option>
              <option value="medium">Közepes</option>
              <option value="high">Magas</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Határidő-eltolás (nap, opcionális)</label>
          <input
            type="number"
            min={0} max={365}
            value={offsetDays}
            onChange={e => setOffsetDays(e.target.value)}
            placeholder="pl. 7 → projektkezdés + 7 nap"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Mégsem</button>
          <button
            onClick={save}
            disabled={busy || !name.trim()}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'Mentés…' : template ? 'Mentés' : 'Létrehozás'}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewProjectInRoomModal({
  categoryId,
  onClose,
  onCreated,
}: {
  categoryId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) { toast.error('Add meg a projekt nevét'); return; }
    setBusy(true);
    try {
      await createProject({
        name,
        ...(description ? { description } : {}),
        ...(categoryId ? { categoryId } : {}),
      });
      toast.success('Projekt létrehozva');
      onCreated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Létrehozás sikertelen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900">Új projekt</h2>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Projekt neve"
          maxLength={200}
          autoFocus
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="Rövid leírás (opcionális)"
          maxLength={2000}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Mégsem</button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !name.trim()}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'Létrehozás…' : 'Létrehozás'}
          </button>
        </div>
      </div>
    </div>
  );
}
