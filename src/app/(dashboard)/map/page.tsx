'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { MapPin, Layers, Navigation, PenSquare, Eye, RefreshCw, Search } from 'lucide-react';
import { useProjects, type Project } from '@/lib/hooks/use-projects';
import type { MapMode } from '@/components/map/project-map';
import { useT } from '@/lib/hooks/use-t';

/* ─── dynamic import (Leaflet requires browser APIs — no SSR) ────────────────── */

const ProjectMap = dynamic(
  () => import('@/components/map/project-map').then((m) => m.ProjectMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

function MapSkeleton() {
  return (
    <div className="w-full h-full rounded-xl bg-gray-100 animate-pulse flex items-center justify-center">
      <RefreshCw className="w-8 h-8 text-gray-300 animate-spin" />
    </div>
  );
}

/* ─── state badge ────────────────────────────────────────────────────────────── */

const STATE_COLORS: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-600',
  active:    'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  archived:  'bg-orange-100 text-orange-700',
};

/* ─── sidebar project card ───────────────────────────────────────────────────── */

function ProjectListItem({
  project,
  isSelected,
  onClick,
}: {
  project: Project;
  isSelected: boolean;
  onClick: () => void;
}) {
  const t = useT();
  const hasLocation = !!project.location?.latitude;

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'w-full text-left px-3 py-2.5 rounded-lg transition border',
        isSelected
          ? 'bg-brand-50 border-brand-200 shadow-sm'
          : 'bg-white border-gray-100 hover:border-brand-100 hover:bg-gray-50',
      )}
    >
      <div className="flex items-start gap-2.5">
        <MapPin className={clsx('w-4 h-4 mt-0.5 flex-shrink-0', hasLocation ? 'text-brand-500' : 'text-gray-300')} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate">{project.name}</p>
          {project.location?.city ? (
            <p className="text-xs text-gray-400 truncate">{project.location.city}, {project.location.country}</p>
          ) : (
            <p className="text-xs text-gray-300 italic">{t.map.noLocation}</p>
          )}
        </div>
        <div className="flex flex-col gap-1 items-end">
          <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-medium', STATE_COLORS[project.state] ?? 'bg-gray-100 text-gray-600')}>
            {project.state}
          </span>
          {Array.isArray((project.metadata as any)?.polygon) && <PenSquare className="w-3 h-3 text-green-500" />}
        </div>
      </div>
    </button>
  );
}

/* ─── mode toolbar ───────────────────────────────────────────────────────────── */

function ModeBar({
  mode,
  setMode,
  hasSelected,
}: {
  mode: MapMode;
  setMode: (m: MapMode) => void;
  hasSelected: boolean;
}) {
  const t = useT();
  const items: { id: MapMode; icon: React.ReactNode; label: string; needsProject: boolean }[] = [
    { id: 'view',           icon: <Eye className="w-4 h-4" />,        label: t.map.modeView,    needsProject: false },
    { id: 'set-location',   icon: <Navigation className="w-4 h-4" />, label: 'Helyszín beállítás', needsProject: true },
    { id: 'draw-polygon',   icon: <PenSquare className="w-4 h-4" />,  label: 'Területkijelölés',   needsProject: true },
  ];

  return (
    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setMode(item.id)}
          disabled={item.needsProject && !hasSelected}
          title={item.needsProject && !hasSelected ? t.map.selectProjectHint : item.label}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition',
            mode === item.id
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100',
            item.needsProject && !hasSelected && 'opacity-40 cursor-not-allowed',
          )}
        >
          {item.icon}
          <span className="hidden sm:inline">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ─── page ───────────────────────────────────────────────────────────────────── */

export default function MapPage() {
  const t = useT();
  const { projects, isLoading, mutate } = useProjects();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<MapMode>('view');
  const [query, setQuery] = useState('');

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.location?.city?.toLowerCase().includes(query.toLowerCase()),
  );

  const projectsWithLocation = filteredProjects.filter((p) => p.location?.latitude);
  const projectsWithoutLocation = filteredProjects.filter((p) => !p.location?.latitude);

  const handleLocationSaved = useCallback(() => {
    mutate();
    setMode('view');
  }, [mutate]);

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] -mt-6 -mx-6 px-6 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.map.title}</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {projectsWithLocation.length}/{projects.length} projekt helyszínnel · F-5, F-6, F-7
          </p>
        </div>
        <ModeBar mode={mode} setMode={setMode} hasSelected={!!selectedId} />
      </div>

      {/* Body: sidebar + map */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 flex flex-col bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder={t.map.searchPh}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {isLoading ? (
              [...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)
            ) : (
              <>
                {projectsWithLocation.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Térképen ({projectsWithLocation.length})
                    </p>
                    {projectsWithLocation.map((p) => (
                      <ProjectListItem
                        key={p.id}
                        project={p}
                        isSelected={selectedId === p.id}
                        onClick={() => { setSelectedId(p.id); setMode('view'); }}
                      />
                    ))}
                  </div>
                )}
                {projectsWithoutLocation.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1 flex items-center gap-1">
                      <Layers className="w-3 h-3" /> {t.map.noLocation} ({projectsWithoutLocation.length})
                    </p>
                    {projectsWithoutLocation.map((p) => (
                      <ProjectListItem
                        key={p.id}
                        project={p}
                        isSelected={selectedId === p.id}
                        onClick={() => { setSelectedId(p.id); setMode('set-location'); }}
                      />
                    ))}
                  </div>
                )}
                {filteredProjects.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-6">Nincs találat</p>
                )}
              </>
            )}
          </div>

          {/* Mode hint */}
          {mode !== 'view' && (
            <div className="px-3 py-2 border-t border-gray-100 bg-brand-50">
              <p className="text-xs text-brand-700 font-medium">
                {mode === 'set-location' && '📍 Kattints a térképen a helyszín megadásához'}
                {mode === 'draw-polygon' && '🔷 Kattints a sarkokra · dupla kattintás = befejezés'}
              </p>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 min-h-0">
          <ProjectMap
            projects={projects}
            selectedProjectId={selectedId}
            mode={mode}
            onProjectSelect={(id) => { setSelectedId(id); setMode('view'); }}
            onLocationSaved={handleLocationSaved}
          />
        </div>
      </div>
    </div>
  );
}
