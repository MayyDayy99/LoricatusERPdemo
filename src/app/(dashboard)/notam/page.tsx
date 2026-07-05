'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import {
  Plane, Search, AlertTriangle, AlertCircle, Info, RefreshCw,
  Calendar, Mountain, Radio, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useProjects } from '@/lib/hooks/use-projects';
import { useNotamSearch, type Notam, type NotamSearchParams } from '@/lib/hooks/use-notam';
import { useT } from '@/lib/hooks/use-t';

/* ─── dynamic: map with circle (no SSR) ─────────────────────────────────────── */

const NotamMap = dynamic(() => import('@/components/map/notam-map').then((m) => m.NotamMap), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-100 rounded-xl animate-pulse" />,
});

/* ─── quota bar ──────────────────────────────────────────────────────────────── */

function QuotaBar({ used, limit }: { used: number; limit: number }) {
  const t = useT();
  const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-orange-400' : 'bg-brand-500';
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
      <Radio className="w-4 h-4 text-brand-500 flex-shrink-0" />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-700">{t.notam.quota}</span>
          <span className={clsx('text-xs font-bold', pct >= 90 ? 'text-red-600' : 'text-gray-600')}>
            {used}/{limit}
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-xs text-gray-400">{t.notam.quotaLeft(Math.max(0, limit - used))}</span>
    </div>
  );
}

/* ─── classification helpers ─────────────────────────────────────────────────── */

const CLASS_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  W: { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',    icon: <AlertTriangle className="w-4 h-4" /> },
  R: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', icon: <AlertCircle className="w-4 h-4" /> },
  A: { bg: 'bg-blue-50 border-blue-200',  text: 'text-blue-700',   icon: <Info className="w-4 h-4" /> },
};
function getClassStyle(cls: string) {
  return CLASS_STYLES[cls.toUpperCase()] ?? { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-700', icon: <Info className="w-4 h-4" /> };
}

/* ─── notam card ─────────────────────────────────────────────────────────────── */

function NotamCard({ notam }: { notam: Notam }) {
  const [open, setOpen] = useState(false);
  const style = getClassStyle(notam.classification);

  const from = new Date(notam.effectiveFrom);
  const to = notam.effectiveTo ? new Date(notam.effectiveTo) : null;
  const isActive = to ? new Date() <= to : true;

  return (
    <div className={clsx('border rounded-xl overflow-hidden transition', style.bg, !isActive && 'opacity-60')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        <span className={clsx('flex-shrink-0 mt-0.5', style.text)}>{style.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full border', style.bg, style.text)}>
              {notam.classification}
            </span>
            <span className="text-xs font-semibold text-gray-700">{notam.type}</span>
            <span className="text-xs text-gray-500 bg-white/60 px-1.5 py-0.5 rounded">{notam.location}</span>
            {!isActive && <span className="text-xs text-gray-400 italic">lejárt</span>}
          </div>
          <p className={clsx('text-sm font-medium mt-1 line-clamp-2', style.text)}>{notam.message}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {from.toLocaleDateString('hu-HU')}
              {to && ` – ${to.toLocaleDateString('hu-HU')}`}
            </span>
            {notam.altitude && (
              <span className="flex items-center gap-1">
                <Mountain className="w-3 h-3" />
                {notam.altitude.lower}–{notam.altitude.upper} {notam.altitude.unit}
              </span>
            )}
          </div>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          <pre className="text-xs text-gray-600 bg-white/70 border border-white/40 rounded-lg p-3 whitespace-pre-wrap font-mono overflow-x-auto">
            {notam.raw}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ─── search form ────────────────────────────────────────────────────────────── */

function SearchForm({
  onSearch,
  isLoading,
}: {
  onSearch: (p: NotamSearchParams) => void;
  isLoading: boolean;
}) {
  const t = useT();
  const { projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState(25);

  const projectsWithLocation = projects.filter((p) => p.location?.latitude);

  function handleProjectChange(id: string) {
    setSelectedProjectId(id);
    if (!id) return;
    const project = projects.find((p) => p.id === id);
    if (project?.location) {
      setLat(project.location.latitude.toFixed(6));
      setLng(project.location.longitude.toFixed(6));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) return;
    onSearch({ latitude, longitude, radiusNauticalMiles: radius });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
      <h2 className="font-bold text-gray-900 text-sm">{t.notam.searchTitle}</h2>

      {/* Project quick-fill */}
      {projectsWithLocation.length > 0 && (
        <div>
          <label htmlFor="notam-proj" className="block text-xs font-medium text-gray-600 mb-1.5">{t.notam.projectLocation}</label>
          <select
            id="notam-proj"
            value={selectedProjectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="">{t.common.selectProject}</option>
            {projectsWithLocation.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.location?.city})</option>
            ))}
          </select>
        </div>
      )}

      {/* Coordinates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="notam-lat" className="block text-xs font-medium text-gray-600 mb-1.5">{t.notam.latLabel}</label>
          <input
            id="notam-lat"
            type="number"
            step="0.000001"
            min="-90"
            max="90"
            required
            value={lat}
            onChange={(e) => { setLat(e.target.value); setSelectedProjectId(''); }}
            placeholder="47.4979"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <div>
          <label htmlFor="notam-lng" className="block text-xs font-medium text-gray-600 mb-1.5">{t.notam.lngLabel}</label>
          <input
            id="notam-lng"
            type="number"
            step="0.000001"
            min="-180"
            max="180"
            required
            value={lng}
            onChange={(e) => { setLng(e.target.value); setSelectedProjectId(''); }}
            placeholder="19.0402"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
      </div>

      {/* Radius */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="notam-radius" className="text-xs font-medium text-gray-600">{t.notam.radiusLabel}</label>
          <span className="text-xs font-bold text-brand-700">{radius} NM</span>
        </div>
        <input
          id="notam-radius"
          type="range"
          min="1"
          max="200"
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="w-full accent-brand-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>1 NM</span>
          <span>~{Math.round(radius * 1.852)} km</span>
          <span>200 NM</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !lat || !lng}
        className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-brand-700 transition disabled:opacity-50"
      >
        {isLoading
          ? <><RefreshCw className="w-4 h-4 animate-spin" /> {t.notam.searching}</>
          : <><Search className="w-4 h-4" /> {t.notam.searchBtn}</>}
      </button>
    </form>
  );
}

/* ─── page ───────────────────────────────────────────────────────────────────── */

export default function NotamPage() {
  const t = useT();
  const { notams, quota, isLoading, error, lastParams, search, fetchQuota } = useNotamSearch();

  useEffect(() => { fetchQuota(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const activeNotams = notams.filter((n) => !n.effectiveTo || new Date(n.effectiveTo) >= new Date());
  const expiredNotams = notams.filter((n) => n.effectiveTo && new Date(n.effectiveTo) < new Date());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Plane className="w-6 h-6 text-brand-600" />
            {t.notam.title}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Légtérkorlátozások és repülési figyelmeztetések · F-8
          </p>
        </div>
        {quota && <QuotaBar used={quota.used} limit={quota.limit} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: form */}
        <div className="space-y-4">
          <SearchForm onSearch={search} isLoading={isLoading} />

          {/* Legend */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.notam.legendTitle}</p>
            {[
              { cls: 'W', label: 'Figyelmeztetés (Warning)' },
              { cls: 'R', label: 'Korlátozás (Restriction)' },
              { cls: 'A', label: 'Tájékoztató (Advisory)' },
            ].map(({ cls, label }) => {
              const style = getClassStyle(cls);
              return (
                <div key={cls} className="flex items-center gap-2">
                  <span className={clsx('w-6 h-6 flex items-center justify-center rounded border', style.bg, style.text)}>
                    {style.icon}
                  </span>
                  <span className="text-xs text-gray-600">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: map + results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Mini map */}
          <div className="h-64 rounded-xl overflow-hidden border border-gray-100">
            <NotamMap searchParams={lastParams} notamCount={notams.length} />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Results */}
          {notams.length > 0 && (
            <div className="space-y-4">
              {activeNotams.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Aktív NOTAM ({activeNotams.length})
                  </p>
                  <div className="space-y-2">
                    {activeNotams.map((n) => <NotamCard key={n.id} notam={n} />)}
                  </div>
                </div>
              )}
              {expiredNotams.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Lejárt / archív ({expiredNotams.length})
                  </p>
                  <div className="space-y-2">
                    {expiredNotams.map((n) => <NotamCard key={n.id} notam={n} />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {!isLoading && !error && notams.length === 0 && lastParams && (
            <div className="text-center py-12 text-gray-400 bg-white border border-gray-100 rounded-xl">
              <Plane className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-medium">{t.notam.emptyNoResults}</p>
              <p className="text-sm mt-1">{lastParams.radiusNauticalMiles} NM sugarú körzetben nem találtunk aktív légtér-figyelmeztetést.</p>
            </div>
          )}

          {!lastParams && !error && (
            <div className="text-center py-12 text-gray-400 bg-white border border-gray-100 rounded-xl">
              <Plane className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-medium">{t.notam.emptySearch}</p>
              <p className="text-sm mt-1">{t.notam.emptySearchHint}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
