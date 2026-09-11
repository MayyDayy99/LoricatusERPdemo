'use client';

import { useState, useCallback } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import {
  Briefcase, CheckCircle, Camera, FileText,
  LogIn, RefreshCw, Smartphone, Wifi,
  Clock, CheckCheck,
  Download,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Project { id: string; name: string; state: string; address?: string; city?: string }
interface CrmTask {
  id: string; title: string; description?: string;
  status: string; priority: string; dueDate?: string;
}
interface Document {
  id: string; title: string; documentType: string; state: string; createdAt: string;
}

// ─── Fetchers ────────────────────────────────────────────────────────────────

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

function useProjects() {
  const { data, isLoading } = useSWR<any>('/projects?take=20', fetcher);
  const rows: Project[] = Array.isArray(data) ? data : (data?.data ?? []);
  return { projects: rows, isLoading };
}

function useMyTodayTasks() {
  const { data, isLoading } = useSWR<CrmTask[]>('/crm-tasks/my-today', fetcher);
  return { tasks: data ?? [], isLoading };
}

function useDocuments(projectId: string | null) {
  const url = projectId ? `/documents?projectId=${projectId}&take=20` : null;
  const { data, isLoading } = useSWR<any>(url, fetcher);
  const rows: Document[] = Array.isArray(data) ? data : (data?.data ?? []);
  return { documents: rows, isLoading };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  active: '#22c55e', completed: '#6b7280', draft: '#f59e0b',
  PENDING: '#f59e0b', IN_PROGRESS: '#3b82f6', COMPLETED: '#22c55e',
};
const PRIORITY_COLOR: Record<string, string> = {
  high: '#ef4444', medium: '#f59e0b', low: '#22c55e',
};
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function docLabel(type: string) {
  return { OFFER: 'Árajánlat', WORK_ORDER: 'Munkafüzet', CONTRACT: 'Szerződés' }[type] ?? type;
}

// ─── Screens ─────────────────────────────────────────────────────────────────

function LoginScreen() {
  return (
    <div className="flex flex-col flex-1 justify-center p-6" style={{ background: '#1a3c6e' }}>
      <div className="bg-white rounded-2xl p-6 shadow-xl">
        <p className="text-2xl font-black text-center tracking-widest mb-1" style={{ color: '#1a3c6e' }}>DIMOP</p>
        <p className="text-xs text-gray-400 text-center mb-6">Terepi alkalmazás</p>
        <div className="space-y-3">
          <div className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-400 bg-gray-50">Email cím</div>
          <div className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-400 bg-gray-50">Jelszó</div>
        </div>
        <div className="mt-4 rounded-xl py-4 text-center text-white font-semibold" style={{ background: '#1a3c6e' }}>
          Bejelentkezés
        </div>
      </div>
    </div>
  );
}

function ProjectsScreen({ onSelectProject, activeProject }: {
  onSelectProject: (p: Project | null) => void;
  activeProject: Project | null;
}) {
  const { projects, isLoading } = useProjects();

  if (isLoading) return <Spinner />;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {activeProject && (
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#1a3c6e' }}>
          <div>
            <p className="text-[10px] text-blue-200">Aktív projekt</p>
            <p className="text-white text-sm font-bold leading-tight">{activeProject.name}</p>
          </div>
          <button
            onClick={() => onSelectProject(null)}
            className="flex items-center gap-1 text-[11px] font-semibold text-white bg-white/20 rounded-lg px-3 py-1.5"
          >
            Kilépés
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
        {projects.map((p) => {
          const isActive = activeProject?.id === p.id;
          return (
            <div
              key={p.id}
              className={`bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm ${isActive ? 'ring-2' : ''}`}
              style={isActive ? { borderColor: '#1a3c6e', border: '2px solid #1a3c6e' } : undefined}
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm truncate">{p.name}</p>
                {p.address && <p className="text-xs text-gray-400 truncate">{p.address}{p.city ? `, ${p.city}` : ''}</p>}
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: STATUS_COLOR[p.state] ?? '#9ca3af' }} />
                  <span className="text-[11px] text-gray-400 capitalize">{p.state}</span>
                </div>
              </div>
              {!isActive && (
                <button
                  onClick={() => onSelectProject(p)}
                  className="text-[11px] font-semibold border rounded-lg px-3 py-1.5 flex-shrink-0"
                  style={{ borderColor: '#1a3c6e', color: '#1a3c6e' }}
                >
                  Be
                </button>
              )}
            </div>
          );
        })}
        {projects.length === 0 && <Empty icon={<Briefcase size={36} />} text="Nincs hozzárendelt projekt." />}
      </div>
    </div>
  );
}

function TasksScreen() {
  const { tasks, isLoading } = useMyTodayTasks();

  const handleComplete = async (id: string) => {
    await apiClient.post(`/crm-tasks/${id}/complete`);
    globalMutate('/crm-tasks/my-today');
  };

  if (isLoading) return <Spinner />;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <p className="font-bold text-gray-900 text-sm">Mai feladatok</p>
        <span className="text-xs text-gray-400">{tasks.length} db</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tasks.map((t) => {
          const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status === 'PENDING';
          return (
            <div key={t.id} className={`bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm ${overdue ? 'border-l-4 border-red-400' : t.status === 'IN_PROGRESS' ? 'border-l-4 border-blue-400' : ''}`}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: PRIORITY_COLOR[t.priority] ?? '#9ca3af' }} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${overdue ? 'text-red-500' : 'text-gray-900'}`}>{t.title}</p>
                {t.description && <p className="text-xs text-gray-400 truncate">{t.description}</p>}
                {t.dueDate && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock size={10} className={overdue ? 'text-red-400' : 'text-gray-400'} />
                    <span className={`text-[10px] ${overdue ? 'text-red-400' : 'text-gray-400'}`}>{fmtDate(t.dueDate)}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => handleComplete(t.id)}
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: '#22c55e' }}
              >
                <CheckCheck size={16} color="white" />
              </button>
            </div>
          );
        })}
        {tasks.length === 0 && <Empty icon={<CheckCircle size={36} color="#22c55e" />} text="Nincs elvégzendő feladat mára!" />}
      </div>
    </div>
  );
}

function CameraScreen({ activeProject }: { activeProject: Project | null }) {
  if (!activeProject) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-3 p-8 bg-gray-50">
        <Briefcase size={44} className="text-gray-300" />
        <p className="text-sm text-gray-400 text-center">Válassz aktív projektet a Projektek fülön.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col flex-1 bg-black overflow-hidden">
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(26,60,110,0.85)' }}>
        <Briefcase size={13} color="rgba(255,255,255,0.8)" />
        <span className="text-white text-xs font-semibold">{activeProject.name}</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="w-24 h-24 rounded-full border-4 border-white/30 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
            <Camera size={32} color="white" />
          </div>
        </div>
        <p className="text-white/50 text-xs">Kamera — böngészőben nem elérhető</p>
      </div>
      <div className="flex items-center justify-center pb-6">
        <div className="w-16 h-16 rounded-full border-4 border-white/30 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}

function DocumentsScreen({ activeProject }: { activeProject: Project | null }) {
  const { documents, isLoading } = useDocuments(activeProject?.id ?? null);

  if (!activeProject) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-3 p-8 bg-gray-50">
        <Briefcase size={44} className="text-gray-300" />
        <p className="text-sm text-gray-400 text-center">Válassz aktív projektet a Projektek fülön.</p>
      </div>
    );
  }
  if (isLoading) return <Spinner />;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <p className="font-bold text-gray-900 text-sm truncate">{activeProject.name}</p>
        <p className="text-[11px] text-gray-400">{documents.length} dokumentum</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {documents.map((d) => (
          <div key={d.id} className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#eff6ff' }}>
              <FileText size={20} color="#1a3c6e" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{d.title}</p>
              <p className="text-[11px] text-gray-400">{docLabel(d.documentType)} · {new Date(d.createdAt).toLocaleDateString('hu')}</p>
            </div>
            <Download size={16} className="text-gray-300 flex-shrink-0" />
          </div>
        ))}
        {documents.length === 0 && <Empty icon={<FileText size={36} />} text="Nincs dokumentum ehhez a projekthez." />}
      </div>
    </div>
  );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex flex-1 items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-3 border-gray-200 border-t-blue-600 rounded-full animate-spin" style={{ borderWidth: 3 }} />
    </div>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 pt-16 text-gray-300">
      {icon}
      <p className="text-sm text-gray-400 text-center">{text}</p>
    </div>
  );
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'projects',  label: 'Projektek',    icon: Briefcase  },
  { id: 'tasks',     label: 'Feladatok',    icon: CheckCircle },
  { id: 'camera',    label: 'Fotó',         icon: Camera     },
  { id: 'documents', label: 'Dok.',         icon: FileText   },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Phone Frame ──────────────────────────────────────────────────────────────

function PhoneFrame({ children }: { children: React.ReactNode }) {
  // Responsive: a kepernyo szelesseget kovetjuk (max 375px), magassagot az
  // iPhone X-szeru 375:812 aspect-ratio adja meg. Mobilbongeszon nem logyik ki.
  return (
    <div
      className="relative mx-auto select-none w-[calc(100vw-2rem)] max-w-[375px]"
      style={{
        aspectRatio: '375 / 812',
        borderRadius: 'clamp(28px, 9vw, 48px)',
        background: '#111',
        boxShadow: '0 0 0 10px #1a1a1a, 0 30px 80px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)',
      }}
    >
      {/* Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20"
        style={{ width: '32%', height: 30, background: '#111', borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }} />
      {/* Status bar */}
      <div className="absolute top-0 left-0 right-0 h-12 flex items-end justify-between px-8 pb-1 z-10" style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>
        <span>9:41</span>
        <div className="flex items-center gap-1">
          <Wifi size={12} />
          <span>●●●</span>
        </div>
      </div>
      {/* Screen area */}
      <div
        className="absolute inset-0 overflow-hidden flex flex-col"
        style={{ borderRadius: 'clamp(28px, 9vw, 48px)', background: '#fff', marginTop: 44, marginBottom: 0 }}
      >
        {children}
      </div>
      {/* Home bar */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 bg-white/30 rounded-full z-20" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MobilePreviewPage() {
  const [activeTab, setActiveTab] = useState<TabId>('projects');
  const [showLogin, setShowLogin] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  const handleRefresh = useCallback(() => {
    globalMutate(() => true, undefined, { revalidate: true });
  }, []);

  const tabContent = showLogin ? <LoginScreen /> : (() => {
    switch (activeTab) {
      case 'projects':  return <ProjectsScreen onSelectProject={setActiveProject} activeProject={activeProject} />;
      case 'tasks':     return <TasksScreen />;
      case 'camera':    return <CameraScreen activeProject={activeProject} />;
      case 'documents': return <DocumentsScreen activeProject={activeProject} />;
    }
  })();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <Smartphone size={18} className="text-gray-500" />
        <h1 className="font-bold text-gray-800 text-sm">DIMOP Mobile Preview</h1>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setShowLogin((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition ${showLogin ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
          >
            <LogIn size={13} />
            Login screen
          </button>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300 transition"
          >
            <RefreshCw size={13} />
            Frissít
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center py-6 md:py-12 px-2 overflow-hidden">
        <PhoneFrame>
          {/* Scrollable content area */}
          <div className="flex flex-col flex-1 overflow-hidden" style={{ paddingBottom: showLogin ? 0 : 68 }}>
            {tabContent}
          </div>

          {/* Tab bar */}
          {!showLogin && (
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex" style={{ height: 68, paddingBottom: 10 }}>
              {TABS.map(({ id, label, icon: Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className="flex-1 flex flex-col items-center justify-end gap-0.5 pb-1"
                  >
                    <Icon size={22} color={active ? '#1a3c6e' : '#9ca3af'} />
                    <span className="text-[10px] font-medium" style={{ color: active ? '#1a3c6e' : '#9ca3af' }}>{label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </PhoneFrame>
      </div>
    </div>
  );
}
