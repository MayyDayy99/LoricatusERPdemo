'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, List, LayoutGrid, Tag, MapPin, Archive } from 'lucide-react';
import { clsx } from 'clsx';
import { useProjects, useProjectStatuses } from '@/lib/hooks/use-projects';
import { useT } from '@/lib/hooks/use-t';
import { ProjectCard } from '@/components/projects/project-card';
import { ProjectStatusSelect } from '@/components/projects/project-status-select';
import { CreateProjectModal } from '@/components/projects/create-project-modal';
import { ProjectStatusEditorModal } from '@/components/projects/project-status-editor-modal';

const STATE_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  archived: 'bg-orange-100 text-orange-700',
};
const STATE_LABELS: Record<string, string> = {
  draft: 'Vázlat', active: 'Aktív', completed: 'Befejezett', archived: 'Archivált',
};

type ViewMode = 'list' | 'grid';

export default function ProjectsPage() {
  // Alapból a Projekt map-pel azonos szűrés: archiváltak nélkül.
  const [showArchived, setShowArchived] = useState(false);
  const { projects, isLoading, mutate } = useProjects({ includeArchived: showArchived });
  const { statuses } = useProjectStatuses();
  const [showCreate, setShowCreate] = useState(false);
  const [showStatusEditor, setShowStatusEditor] = useState(false);
  // Alapból lista nézet; a választás localStorage-ban megmarad.
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const t = useT();

  useEffect(() => {
    const saved = localStorage.getItem('projects-view-mode');
    if (saved === 'list' || saved === 'grid') setViewMode(saved);
  }, []);
  function changeView(m: ViewMode) {
    setViewMode(m);
    localStorage.setItem('projects-view-mode', m);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.projects.title}</h1>
          <p className="text-gray-500 mt-1">{t.projects.subtitle(projects?.length ?? 0)}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Nézet-váltó: lista / csempés */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => changeView('list')}
              className={clsx('p-2 transition', viewMode === 'list' ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50')}
              title="Lista nézet"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => changeView('grid')}
              className={clsx('p-2 transition', viewMode === 'grid' ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50')}
              title="Csempés nézet"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={clsx(
              'flex items-center gap-2 border px-3 py-2.5 rounded-lg font-medium transition',
              showArchived
                ? 'border-brand-200 bg-brand-50 text-brand-700'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50',
            )}
            title="Archivált projektek megjelenítése"
          >
            <Archive className="w-4 h-4" /> Archiváltak
          </button>
          <button
            onClick={() => setShowStatusEditor(true)}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition"
          >
            <Tag className="w-4 h-4" /> Státuszok
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-brand-700 transition"
          >
            <Plus className="w-4 h-4" />
            {t.projects.newBtn}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects?.map((p) => (
            <ProjectCard key={p.id} project={p} statuses={statuses} onStatusChanged={() => mutate()} />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          {projects.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">Nincs projekt.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Név</th>
                  <th className="text-left px-4 py-3">Státusz</th>
                  <th className="text-left px-4 py-3">Állapot</th>
                  <th className="text-left px-4 py-3">Helyszín</th>
                  <th className="text-left px-4 py-3">Kezdés</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <Link href={`/projects/${p.id}`} className="font-medium text-gray-900 hover:text-brand-700 hover:underline">
                        {p.name}
                      </Link>
                      {p.description && <div className="text-xs text-gray-400 line-clamp-1 mt-0.5">{p.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <ProjectStatusSelect project={p} statuses={statuses} onChanged={() => mutate()} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STATE_COLORS[p.state] ?? 'bg-gray-100 text-gray-600')}>
                        {STATE_LABELS[p.state] ?? p.state}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {p.location ? (
                        <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-gray-400" />{p.location.city}</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {p.startDate ? new Date(p.startDate).toLocaleDateString('hu-HU') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
      {showStatusEditor && <ProjectStatusEditorModal onClose={() => setShowStatusEditor(false)} />}
    </div>
  );
}
