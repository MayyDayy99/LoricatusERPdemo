'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { ChevronDown, ChevronRight, CheckCircle2, ThumbsUp, ThumbsDown, Download, BookOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { FEATURE_MODULES } from '@/lib/feature-modules-data';
import { DEV_LOG, type DevLogEntry } from '@/lib/dev-log-data';

/* ── Dev Log helpers ────────────────────────────────────────── */
const TAG_STYLES: Record<DevLogEntry['items'][0]['tag'], string> = {
  API:    'bg-blue-100 text-blue-700',
  Web:    'bg-purple-100 text-purple-700',
  Mobile: 'bg-emerald-100 text-emerald-700',
  Infra:  'bg-orange-100 text-orange-700',
  Docs:   'bg-gray-100 text-gray-600',
};

const STORAGE_KEY = 'latent-needs-v2';
type NeedStatus = 'want' | 'skip' | 'undecided';
type NeedsState = Record<string, NeedStatus>;

function loadState(): NeedsState {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); }
  catch { return {}; }
}
function saveState(s: NeedsState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/* ── Fejlesztési napló komponens ─────────────────────────────── */
function DevLog() {
  const [open, setOpen] = useState(true);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(0); // legfrissebb nyitva

  return (
    <div className="bg-white rounded-xl border-2 border-indigo-200">
      {/* Fejléc */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        {open
          ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
        <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
        <span className="font-semibold text-gray-900 flex-1">Fejlesztési napló</span>
        <span className="text-xs text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-full">
          {DEV_LOG.length} bejegyzés
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {DEV_LOG.map((entry, i) => (
            <div key={i}>
              {/* Entry fejléc */}
              <button
                type="button"
                onClick={() => setExpandedEntry(expandedEntry === i ? null : i)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                {expandedEntry === i
                  ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                <span className="text-xs font-mono text-gray-400 shrink-0 w-24">
                  {new Date(entry.date).toLocaleDateString('hu-HU')}
                </span>
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded shrink-0">
                  {entry.sprint}
                </span>
                <span className="text-sm font-medium text-gray-800 flex-1 truncate">{entry.title}</span>
                <span className="text-xs text-gray-400 shrink-0">{entry.items.length} változtatás</span>
              </button>

              {/* Entry részletek */}
              {expandedEntry === i && (
                <div className="px-5 pb-4 space-y-3">
                  <ul className="space-y-1.5">
                    {entry.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className={clsx(
                          'text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 leading-tight',
                          TAG_STYLES[item.tag]
                        )}>
                          {item.tag}
                        </span>
                        {item.text}
                      </li>
                    ))}
                  </ul>
                  {entry.nextUp && (
                    <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
                      <span className="font-semibold shrink-0">Következő:</span>
                      <span>{entry.nextUp}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DevChecklistPage() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [needs, setNeeds] = useState<NeedsState>({});
  const [hydrated, setHydrated] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const local = loadState();
    setNeeds(local);
    setHydrated(true);
    // Fetch server state and merge (server wins for non-null values)
    apiClient.get<NeedsState>(`/users/me/settings/${STORAGE_KEY}`)
      .then((res) => {
        if (res.data && typeof res.data === 'object') {
          const merged = { ...local, ...(res.data as NeedsState) };
          setNeeds(merged);
          saveState(merged);
        }
      })
      .catch(() => { /* ignore — fall back to localStorage */ });
  }, []);

  function toggleOpen(id: string) {
    setOpen((p) => ({ ...p, [id]: !p[id] }));
  }

  function setNeed(id: string, next: NeedStatus) {
    setNeeds((p) => {
      const u = { ...p, [id]: next };
      saveState(u);
      // Debounced server save (800 ms)
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        apiClient.put(`/users/me/settings/${STORAGE_KEY}`, { value: u }).catch(() => {});
      }, 800);
      return u;
    });
  }

  const allLatent = FEATURE_MODULES.flatMap((m) => m.latent);
  const wantCount = allLatent.filter((l) => needs[l.id] === 'want').length;
  const skipCount = allLatent.filter((l) => needs[l.id] === 'skip').length;
  const undecided = allLatent.length - wantCount - skipCount;

  function exportDecisions() {
    const rows = FEATURE_MODULES.flatMap((mod) =>
      mod.latent.map((l) => ({
        modul: mod.id,
        modul_cim: mod.title,
        igenypont_id: l.id,
        igenypont: l.label,
        indoklas: l.detail,
        dontes: needs[l.id] === 'want' ? 'KÉREM' : needs[l.id] === 'skip' ? 'NEM KÉREM' : 'DÖNTÉS ALATT',
      }))
    );
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `latens-igenyek-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fejlesztési összefoglaló</h1>
          <p className="text-sm text-gray-500 mt-1">
            F-1..F-24 mind teljesítve &middot; azonosított látens igények: {allLatent.length} tétel
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hydrated && (
            <button
              type="button"
              onClick={exportDecisions}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON
            </button>
          )}
          <Link href="/diagnostic" className="text-sm text-brand-600 hover:text-brand-700 font-medium whitespace-nowrap">
            ← Diagnosztika
          </Link>
        </div>
      </div>

      {/* Összesítő sáv */}
      {hydrated && allLatent.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex flex-wrap gap-4 text-sm">
          <span className="text-blue-800 font-medium">Látens igények összesítő:</span>
          <span className="text-green-700 font-semibold">{wantCount} kért</span>
          <span className="text-gray-500">{skipCount} nem kért</span>
          <span className="text-gray-400">{undecided} döntés alatt</span>
        </div>
      )}

      {/* Fejlesztési napló */}
      <DevLog />

      {/* Modulok */}
      <div className="space-y-3">
        {FEATURE_MODULES.map((mod) => {
          const isOpen = !!open[mod.id];
          const hasLatent = mod.latent.length > 0;
          const wantedInMod = mod.latent.filter((l) => needs[l.id] === 'want').length;

          return (
            <div
              key={mod.id}
              className={clsx(
                'bg-white rounded-xl border-2 transition-colors',
                hasLatent && wantedInMod > 0
                  ? 'border-blue-300'
                  : hasLatent
                  ? 'border-amber-200'
                  : 'border-green-200'
              )}
            >
              {/* Fejléc */}
              <button
                onClick={() => toggleOpen(mod.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
              >
                {isOpen
                  ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                <span className="font-mono text-xs font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded shrink-0">
                  {mod.id}
                </span>
                <span className="font-semibold text-gray-900 flex-1">{mod.title}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="flex items-center gap-1 text-xs text-green-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {mod.implemented.length} kész
                  </span>
                  {hasLatent && (
                    <span className={clsx(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      wantedInMod > 0 ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    )}>
                      {mod.latent.length} látens{wantedInMod > 0 ? ` · ${wantedInMod} kért` : ''}
                    </span>
                  )}
                </div>
              </button>

              {/* Tartalom */}
              {isOpen && (
                <div className="border-t border-gray-100">
                  {/* Megvalósítva */}
                  <div className="px-4 pt-3 pb-2">
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
                      Megvalósítva
                    </p>
                    <ul className="space-y-1.5">
                      {mod.implemented.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    {mod.href && (
                      <Link href={mod.href} className="inline-block mt-2 text-xs text-brand-600 hover:text-brand-700">
                        → Megnyitás: {mod.href}
                      </Link>
                    )}
                  </div>

                  {/* Látens igények */}
                  {hasLatent && (
                    <div className="border-t border-amber-100 bg-amber-50/40 px-4 py-3 rounded-b-xl">
                      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">
                        Látens igények — docx szerint elvárható, de az F-1-24-be nem lett belefoglalva
                      </p>
                      <div className="space-y-3">
                        {mod.latent.map((latent) => {
                          const st: NeedStatus = hydrated ? (needs[latent.id] ?? 'undecided') : 'undecided';
                          return (
                            <div
                              key={latent.id}
                              className={clsx(
                                'bg-white rounded-lg border p-3 transition-colors',
                                st === 'want' ? 'border-blue-300' : st === 'skip' ? 'border-gray-200 opacity-60' : 'border-amber-200'
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-800">{latent.label}</p>
                                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{latent.detail}</p>
                                </div>
                                {hydrated && (
                                  <div className="flex gap-1.5 shrink-0">
                                    <button
                                      onClick={() => setNeed(latent.id, st === 'want' ? 'undecided' : 'want')}
                                      title="Kérem"
                                      className={clsx(
                                        'flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors',
                                        st === 'want'
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                                      )}
                                    >
                                      <ThumbsUp className="w-3.5 h-3.5" /> Kérem
                                    </button>
                                    <button
                                      onClick={() => setNeed(latent.id, st === 'skip' ? 'undecided' : 'skip')}
                                      title="Nem kérem"
                                      className={clsx(
                                        'flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors',
                                        st === 'skip'
                                          ? 'bg-gray-500 text-white'
                                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      )}
                                    >
                                      <ThumbsDown className="w-3.5 h-3.5" /> Nem kérem
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
