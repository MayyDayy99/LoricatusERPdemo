'use client';

// Sprint 3 β₂ — Uploads lista-oldal rewrite a customers/page.tsx precedensre.
//
// 4 predefined szegmens (recent / mineUploaded / largeFiles / failedScans),
// szerver-oldali pagináció+szűrő, bulk-edit modal (archive/unarchive/delete/
// category-change/promote), drag-drop zónával + duplikátum-link a fejlécben.
//
// Felfelé komplexitás: a "failedScans" szegmens állapot-OR-feltételt igényel
// (state=FAILED VAGY scanResult=infected). Mivel a backend csak `state` query-t
// fogad, a frontend `state=failed`-et küld, és kliens-oldali post-filter-rel
// szűri a `scanResult==='infected'` rekordokat is. Ez a 7-task spec szándékos
// kompromisszuma — a backend kibővítése egy következő mini-sprint.

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  Search, Filter, Bookmark, Trash2, X, GitMerge,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Upload as UploadIcon, AlertCircle, RefreshCw, ArrowUpRight,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  useUploads,
  initiateUpload, completeUpload,
  bulkUpdateUploads, type UploadBulkPatch,
  revalidateUploadScope,
} from '@/lib/hooks/use-uploads';
import { useCurrentUser } from '@/lib/hooks/use-users';
import { useProjects } from '@/lib/hooks/use-projects';
import { useT } from '@/lib/hooks/use-t';
import {
  UPLOAD_STATES, UPLOAD_STATE_STYLES, type UploadStateKey,
  UPLOAD_CATEGORIES, type UploadCategory,
} from '@/lib/upload-lifecycle';

const PER_PAGE_OPTIONS = [25, 50, 100] as const;
type PerPage = typeof PER_PAGE_OPTIONS[number];

// ─── Filter / Segment shape (customers-precedens) ─────────────────────────────

interface FilterState {
  state?: UploadStateKey;
  category?: UploadCategory;
  projectId?: string;
  mimeType?: string;
  uploadedBy?: string;
  isArchived?: boolean;
  /** Client-side: scanResult==='infected' VAGY state==='failed'. A backend
   *  csak state-et tud, így a serverquery state=failed + post-filter+'infected'. */
  failedOrInfected?: boolean;
  /** Client-side: createdAt < now-7d. A backend nem szűr dátumra; a paged
   *  list-en mintaesés van — első verzió: kliens post-filter. */
  recentDays?: number;
  /** Client-side: fileSize > N bytes. Hasonló mintaesés — kliens post-filter. */
  minFileSize?: number;
}

const EMPTY_FILTERS: FilterState = {};

interface SavedSegment {
  id: string;
  name: string;
  filters: FilterState;
}

type PredefinedSegmentId = 'recent' | 'mineUploaded' | 'largeFiles' | 'failedScans';

// A predefined-szegmens szűrőit a komponens render-szinten számolja, mert
// a `mineUploaded` az aktuális userId-t igényli — modul-szintű const-ba nem
// tehető. Lásd: useCurrentUser → predefinedSegmentFilters(userId).

function filterStateEqual(a: FilterState, b: FilterState): boolean {
  return (
    a.state === b.state &&
    a.category === b.category &&
    a.projectId === b.projectId &&
    a.mimeType === b.mimeType &&
    a.uploadedBy === b.uploadedBy &&
    a.isArchived === b.isArchived &&
    a.failedOrInfected === b.failedOrInfected &&
    a.recentDays === b.recentDays &&
    a.minFileSize === b.minFileSize
  );
}

function countActiveFilters(f: FilterState): number {
  return [
    f.state, f.category, f.projectId, f.mimeType, f.uploadedBy,
    f.isArchived, f.failedOrInfected, f.recentDays, f.minFileSize,
  ].filter((v) => v !== undefined && v !== '' && v !== false).length;
}

// ─── User-settings perzisztencia ──────────────────────────────────────────────
//
// users.settings.uploadSegments JSONB-ben tároljuk a saved szegmens-tömböt.
// Backend: GET/PUT /users/me/settings/uploadSegments — 4KB cap.

const SEGMENT_SETTING_KEY = 'uploadSegments';

async function loadCustomSegments(): Promise<SavedSegment[]> {
  try {
    const res = await apiClient.get(`/users/me/settings/${SEGMENT_SETTING_KEY}`);
    const v = res.data;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function saveCustomSegments(segments: SavedSegment[]): Promise<void> {
  await apiClient.put(`/users/me/settings/${SEGMENT_SETTING_KEY}`, { value: segments });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | undefined | null): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function buildPageWindow(current: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const out: (number | 'ellipsis')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  if (start > 2) out.push('ellipsis');
  for (let i = start; i <= end; i++) out.push(i);
  if (end < totalPages - 1) out.push('ellipsis');
  out.push(totalPages);
  return out;
}

// ─── BulkEditModal ───────────────────────────────────────────────────────────

type BulkOp = 'archive' | 'unarchive' | 'delete' | 'categoryChange' | 'promote';

function BulkEditModal({
  selectedIds,
  onClose,
  onDone,
}: {
  selectedIds: string[];
  onClose: () => void;
  onDone: (affected: number) => void;
}) {
  const t = useT();
  const [op, setOp] = useState<BulkOp>('archive');
  const [catVal, setCatVal] = useState<UploadCategory>('other');
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildPatch = (): UploadBulkPatch | null => {
    switch (op) {
      case 'archive':        return { isArchived: true };
      case 'unarchive':      return { isArchived: false };
      case 'delete':         return { deleteSoft: true };
      case 'categoryChange': return { category: catVal };
      case 'promote':        return null; // külön endpoint; lásd handleApply
    }
  };

  const handleApply = async () => {
    if (!confirming) { setConfirming(true); return; }
    setLoading(true);
    setError(null);
    try {
      let affected = 0;
      if (op === 'promote') {
        // A promote-to-document NEM bulk-endpoint a backend-en; sequentialesen
        // hívjuk minden kijelölt ID-re. Ha bármelyik dob, a többi is megszakad.
        for (const id of selectedIds) {
          // eslint-disable-next-line no-await-in-loop
          await apiClient.post(`/uploads/${id}/promote-to-document`, {});
          affected += 1;
        }
        // γ_polish: a raw apiClient.post NEM hív revalidateUploadScope-ot
        // (csak a bulkUpdateUploads hook teszi), így kézzel meghívjuk —
        // ez frissíti az /uploads* ÉS /documents* kulcsokat is, mert a
        // promote új document-rekordot hoz létre.
        revalidateUploadScope();
      } else {
        const patch = buildPatch();
        if (!patch) throw new Error('Invalid patch');
        const result = await bulkUpdateUploads(selectedIds, patch);
        affected = result.affected;
      }
      onDone(affected);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? t.uploads.bulk.errorToast));
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-2">{t.uploads.bulk.modalTitle}</h2>
        <p className="text-sm text-gray-500 mb-4">{t.uploads.bulk.modalHint}</p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t.uploads.bulk.opLabel}</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={op}
              onChange={(e) => { setOp(e.target.value as BulkOp); setConfirming(false); setError(null); }}
            >
              <option value="archive">{t.uploads.bulk.ops.archive}</option>
              <option value="unarchive">{t.uploads.bulk.ops.unarchive}</option>
              <option value="delete">{t.uploads.bulk.ops.delete}</option>
              <option value="categoryChange">{t.uploads.bulk.ops.categoryChange}</option>
              <option value="promote">{t.uploads.bulk.ops.promote}</option>
            </select>
          </div>

          {op === 'categoryChange' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.uploads.bulk.categoryLabel}</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={catVal}
                onChange={(e) => setCatVal(e.target.value as UploadCategory)}
              >
                {UPLOAD_CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {(t.uploads.categoryLabels as Record<string, string>)[c] ?? c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {confirming && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <p className="font-medium">{t.uploads.bulk.confirmTitle}</p>
              <p>{t.uploads.bulk.confirmText(selectedIds.length)}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => { if (confirming) { setConfirming(false); } else { onClose(); } }}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {t.uploads.bulk.cancelBtn}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={loading}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? t.uploads.bulk.applying : t.uploads.bulk.applyBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Drop-zone ────────────────────────────────────────────────────────────────
//
// Egyszerű HTML5 drag-drop region, NINCS külső dependency. A native-fájlból
// initiateUpload + PUT a chunkUploadUrl-ra + completeUpload szekvenciát futtat.
// A projektkiválasztás KÖTELEZŐ — drop előtt a fejlécen kell projektet választani.

function DropZone({
  projectId,
  onUploaded,
}: {
  projectId: string | null;
  onUploaded: () => void;
}) {
  const t = useT();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    if (!projectId) return;
    setUploading(true);
    setError(null);
    try {
      setProgress(t.uploads.progressPrepare);
      const { upload, chunkUploadUrls } = await initiateUpload({
        projectId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSizeBytes: file.size,
      });
      if (chunkUploadUrls[0] && !chunkUploadUrls[0].startsWith('http://mock-storage')) {
        setProgress(t.uploads.progressUpload);
        const putRes = await fetch(chunkUploadUrls[0], {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });
        if (!putRes.ok) throw new Error(t.uploads.uploadError(putRes.status));
      }
      setProgress(t.uploads.progressFinalize);
      await completeUpload(upload.id);
      onUploaded();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Ismeretlen hiba');
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }, [projectId, t, onUploaded]);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!projectId) return;
    const files = Array.from(e.dataTransfer.files);
    for (const f of files) {
      // eslint-disable-next-line no-await-in-loop
      await uploadFile(f);
    }
  };

  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={clsx(
        'rounded-xl border-2 border-dashed p-6 text-center transition cursor-pointer',
        isDragging ? 'border-brand-400 bg-brand-50' : 'border-gray-200 bg-gray-50/50 hover:border-brand-300',
        !projectId && 'opacity-60',
      )}
      onClick={() => projectId && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handlePickFile}
        disabled={!projectId || uploading}
      />
      <UploadIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
      <p className="text-sm font-medium text-gray-700">{t.uploads.dropHere}</p>
      <p className="text-xs text-gray-400 mt-1">{t.uploads.dropHint}</p>
      {progress && (
        <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-700">
          <RefreshCw className="w-3 h-3 animate-spin" /> {progress}
        </div>
      )}
      {error && (
        <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="w-3 h-3" /> {error}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UploadsPage() {
  const t = useT();
  const { currentUser } = useCurrentUser();
  const { projects } = useProjects();

  // Search-state (debounce-olt)
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const [filters, setFilters] = useState<FilterState>({});
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  // Aktív projekt a DropZone-hoz. A header-en külön projekt-választó van.
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const [sortField, setSortField] = useState<'name' | 'state' | 'size' | 'uploaded'>('uploaded');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [perPage, setPerPage] = useState<PerPage>(25);
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [customSegments, setCustomSegments] = useState<SavedSegment[]>([]);
  const [segmentNameInput, setSegmentNameInput] = useState('');
  const [showSaveSegmentInput, setShowSaveSegmentInput] = useState(false);

  useEffect(() => {
    void loadCustomSegments().then(setCustomSegments);
  }, []);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearch, perPage, filters]);

  // Predefined-szegmens szűrők — a `mineUploaded` az aktuális userId-t igényli.
  const predefinedSegmentFilters: Record<PredefinedSegmentId, FilterState> = useMemo(() => ({
    recent:       { recentDays: 7 },
    mineUploaded: { uploadedBy: currentUser?.id },
    largeFiles:   { minFileSize: 50 * 1024 * 1024 },
    failedScans:  { failedOrInfected: true, state: 'failed' },
  }), [currentUser?.id]);

  // SWR-fetch — kliens-oldali szűrőket nem küldjük a backendre
  // (recentDays, minFileSize, failedOrInfected → post-filter).
  const { items, total, isLoading, mutate } = useUploads({
    take: perPage,
    skip: (page - 1) * perPage,
    search: debouncedSearch || undefined,
    state: filters.state,
    category: filters.category,
    mimeType: filters.mimeType,
    projectId: filters.projectId,
    uploadedBy: filters.uploadedBy,
  });

  // Kliens-oldali post-filter (failedScans / recent / largeFiles szegmens-szűrők).
  const postFiltered = useMemo(() => {
    let xs = items;
    if (filters.failedOrInfected) {
      // state=failed VAGY scanResult==='infected'. A backend state=failed
      // szervere már elvégezte a felső szűrést; a post-filter csak az infected-
      // jelzéseket adja hozzá (ha a backend `scanResult: 'infected'` mellett
      // nem failed-bestate-tel marad). Defenzív: a kettő OR-ja a végeredmény.
      xs = xs.filter(u => u.state === 'failed' || u.scanResult === 'infected');
    }
    if (filters.recentDays != null) {
      const cutoff = Date.now() - filters.recentDays * 86_400_000;
      xs = xs.filter(u => new Date(u.createdAt).getTime() >= cutoff);
    }
    if (filters.minFileSize != null) {
      const min = filters.minFileSize;
      xs = xs.filter(u => (u.fileSize ?? 0) >= min);
    }
    if (filters.isArchived !== undefined) {
      xs = xs.filter(u => u.isArchived === filters.isArchived);
    }
    return xs;
  }, [items, filters]);

  // Rendezés
  const sorted = useMemo(() => [...postFiltered].sort((a, b) => {
    let va: string | number;
    let vb: string | number;
    switch (sortField) {
      case 'name':     va = a.originalName ?? a.fileName; vb = b.originalName ?? b.fileName; break;
      case 'state':    va = a.state; vb = b.state; break;
      case 'size':     va = a.fileSize ?? 0; vb = b.fileSize ?? 0; break;
      case 'uploaded': va = a.createdAt; vb = b.createdAt; break;
      default:         va = ''; vb = '';
    }
    if (typeof va === 'number') return sortDir === 'asc' ? va - (vb as number) : (vb as number) - va;
    return sortDir === 'asc' ? String(va).localeCompare(String(vb), 'hu') : String(vb).localeCompare(String(va), 'hu');
  }), [postFiltered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageWindow = buildPageWindow(page, totalPages);
  const loadedLabel = t.uploads.subtitleLoaded(sorted.length, total);
  const activeFilterCount = countActiveFilters(filters);

  // Selection
  const allOnPageSelected = sorted.length > 0 && sorted.every(u => selectedIds.has(u.id));
  const someOnPageSelected = sorted.some(u => selectedIds.has(u.id));

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      const next = new Set(selectedIds);
      sorted.forEach(u => next.delete(u.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      sorted.forEach(u => next.add(u.id));
      setSelectedIds(next);
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir(field === 'uploaded' ? 'desc' : 'asc'); }
  };

  // Segments
  const applyPredefined = (id: PredefinedSegmentId) => {
    setFilters({ ...predefinedSegmentFilters[id] });
    setActiveSegmentId(`predefined:${id}`);
  };

  const applyCustom = (seg: SavedSegment) => {
    setFilters({ ...seg.filters });
    setActiveSegmentId(`custom:${seg.id}`);
  };

  const handleClearFilters = () => {
    setFilters({ ...EMPTY_FILTERS });
    setActiveSegmentId(null);
  };

  const handleSaveSegment = async () => {
    const name = segmentNameInput.trim();
    if (!name) return;
    const id = `seg-${Date.now()}`;
    const next: SavedSegment[] = [...customSegments, { id, name, filters }];
    setCustomSegments(next);
    setSegmentNameInput('');
    setShowSaveSegmentInput(false);
    setActiveSegmentId(`custom:${id}`);
    try {
      await saveCustomSegments(next);
      setToast(t.uploads.segments.saveOk);
      setTimeout(() => setToast(null), 2000);
    } catch {
      setCustomSegments(customSegments);
    }
  };

  const handleDeleteSegment = async (id: string) => {
    const next = customSegments.filter(s => s.id !== id);
    setCustomSegments(next);
    if (activeSegmentId === `custom:${id}`) setActiveSegmentId(null);
    try { await saveCustomSegments(next); } catch { setCustomSegments(customSegments); }
  };

  // Aktív szegmens kondíció reset szabad-szerkesztéskor.
  useEffect(() => {
    if (!activeSegmentId) return;
    const [kind, id] = activeSegmentId.split(':');
    let target: FilterState | undefined;
    if (kind === 'predefined') target = predefinedSegmentFilters[id as PredefinedSegmentId];
    else target = customSegments.find(s => s.id === id)?.filters;
    if (!target || !filterStateEqual(filters, target)) setActiveSegmentId(null);
  }, [filters, activeSegmentId, customSegments, predefinedSegmentFilters]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.uploads.title}</h1>
          <p className="text-gray-500 mt-1">{loadedLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/uploads/duplicates"
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
          >
            <GitMerge className="w-4 h-4" />
            {t.uploads.duplicatesLink}
          </Link>
          <select
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600"
            value={activeProjectId ?? ''}
            onChange={(e) => setActiveProjectId(e.target.value || null)}
            aria-label="Drop-zone projekt"
          >
            <option value="">{t.common.selectProject}</option>
            {projects?.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <DropZone projectId={activeProjectId} onUploaded={() => mutate()} />

      <div className="flex gap-6 items-start">
        {/* Sidebar — Szegmensek */}
        <aside className="hidden lg:block w-60 shrink-0 sticky top-4 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
              {t.uploads.segments.title}
            </h2>
            <button
              type="button"
              onClick={handleClearFilters}
              className={`w-full text-left px-2 py-1.5 rounded text-sm ${
                activeSegmentId === null && activeFilterCount === 0
                  ? 'bg-brand-50 text-brand-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t.uploads.segments.all}
            </button>
            {(['recent', 'mineUploaded', 'largeFiles', 'failedScans'] as PredefinedSegmentId[]).map(id => (
              <button
                key={id}
                type="button"
                onClick={() => applyPredefined(id)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${
                  activeSegmentId === `predefined:${id}`
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5 opacity-60" />
                <span className="flex-1 truncate">
                  {t.uploads.segments.predefined[id]}
                </span>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
              {t.uploads.segments.custom}
            </h2>
            {customSegments.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-1.5">{t.uploads.segments.emptyCustom}</p>
            ) : (
              customSegments.map(seg => (
                <div
                  key={seg.id}
                  className={`group flex items-center gap-1 px-2 py-1.5 rounded ${
                    activeSegmentId === `custom:${seg.id}`
                      ? 'bg-brand-50 text-brand-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => applyCustom(seg)}
                    className="flex-1 text-left text-sm truncate"
                    title={seg.name}
                  >
                    {seg.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSegment(seg.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition"
                    title={t.uploads.segments.deleteBtn}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}

            {activeFilterCount > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                {showSaveSegmentInput ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                      placeholder={t.uploads.segments.savePh}
                      value={segmentNameInput}
                      onChange={(e) => setSegmentNameInput(e.target.value)}
                      maxLength={50}
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={handleSaveSegment}
                        disabled={!segmentNameInput.trim()}
                        className="flex-1 px-2 py-1 bg-brand-600 text-white text-xs rounded hover:bg-brand-700 disabled:opacity-50"
                      >
                        {t.common.save}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowSaveSegmentInput(false); setSegmentNameInput(''); }}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                      >
                        {t.common.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSaveSegmentInput(true)}
                    className="w-full text-xs text-brand-600 hover:text-brand-700 px-2 py-1.5 text-left"
                  >
                    + {t.uploads.segments.saveBtn}
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-4">
          {/* Search + alap filter */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-400"
                placeholder={t.uploads.searchPh}
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
            </div>
            <select
              aria-label={t.uploads.colState}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
              value={filters.state ?? ''}
              onChange={e => setFilters(f => ({ ...f, state: (e.target.value || undefined) as UploadStateKey | undefined }))}
            >
              <option value="">— {t.uploads.colState} —</option>
              {UPLOAD_STATES.map(s => (
                <option key={s} value={s}>
                  {(t.uploads.state as Record<string, string>)[s] ?? s}
                </option>
              ))}
            </select>
            <select
              aria-label={t.uploads.colCategory}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
              value={filters.category ?? ''}
              onChange={e => setFilters(f => ({ ...f, category: (e.target.value || undefined) as UploadCategory | undefined }))}
            >
              <option value="">— {t.uploads.colCategory} —</option>
              {UPLOAD_CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {(t.uploads.categoryLabels as Record<string, string>)[c] ?? c}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowMoreFilters(s => !s)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border ${
                activeFilterCount > 2 || showMoreFilters
                  ? 'border-brand-400 text-brand-700 bg-brand-50'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              {activeFilterCount > 2 && (
                <span className="bg-brand-600 text-white text-xs rounded-full px-1.5 py-0.5">
                  {activeFilterCount - 2}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <select
                aria-label="per-page"
                className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-600"
                value={perPage}
                onChange={e => setPerPage(Number(e.target.value) as PerPage)}
              >
                {PER_PAGE_OPTIONS.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          {showMoreFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t.uploads.colProject}</label>
                <select
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white"
                  value={filters.projectId ?? ''}
                  onChange={e => setFilters(f => ({ ...f, projectId: e.target.value || undefined }))}
                >
                  <option value="">—</option>
                  {projects?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">MIME</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white"
                  placeholder="application/pdf, image/*"
                  value={filters.mimeType ?? ''}
                  onChange={e => setFilters(f => ({ ...f, mimeType: e.target.value || undefined }))}
                  maxLength={127}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  disabled={activeFilterCount === 0}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40 flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  {t.common.cancel}
                </button>
              </div>
            </div>
          )}

          {/* Bulk-select bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 bg-brand-50 border border-brand-200 rounded-lg px-4 py-2.5">
              <span className="text-sm text-brand-800 font-medium">
                {t.uploads.bulk.selectedCount(selectedIds.size)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(true)}
                  className="bg-brand-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-brand-700"
                >
                  {t.uploads.bulk.actionBtn}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-sm text-brand-700 hover:text-brand-900 px-2 py-1"
                >
                  {t.uploads.bulk.clear}
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={allOnPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected;
                      }}
                      onChange={toggleSelectAll}
                      aria-label="Összes kijelölése"
                    />
                  </th>
                  {([
                    { label: t.uploads.colName,    field: 'name' as const },
                    { label: t.uploads.colState,   field: 'state' as const },
                    { label: t.uploads.colSize,    field: 'size' as const },
                    { label: t.uploads.colProject, field: null },
                    { label: t.uploads.colCategory, field: null },
                    { label: t.uploads.colVersion, field: null },
                    { label: t.uploads.colUploaded, field: 'uploaded' as const },
                    { label: '', field: null },
                  ]).map(({ label, field }) => (
                    <th key={label || `_${Math.random()}`}
                      className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide ${field ? 'cursor-pointer hover:text-gray-700 select-none' : ''}`}
                      onClick={field ? () => handleSort(field) : undefined}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        {field && sortField === field && (
                          sortDir === 'asc'
                            ? <ChevronUp className="w-3 h-3" />
                            : <ChevronDown className="w-3 h-3" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(9)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                      {searchInput || activeFilterCount > 0 ? '—' : t.uploads.emptyActive}
                    </td>
                  </tr>
                ) : sorted.map(u => (
                  <tr key={u.id} className={`hover:bg-gray-50 ${selectedIds.has(u.id) ? 'bg-brand-50/40' : ''}`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={selectedIds.has(u.id)}
                        onChange={() => toggleSelectOne(u.id)}
                        aria-label={`${u.originalName ?? u.fileName} kijelölése`}
                      />
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <Link href={`/uploads/${u.id}`}
                        className="font-medium text-gray-900 hover:text-brand-600 transition truncate block"
                        title={u.originalName ?? u.fileName}
                      >
                        {u.originalName ?? u.fileName}
                      </Link>
                      <div className="text-xs text-gray-400 truncate">{u.mimeType}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${UPLOAD_STATE_STYLES[u.state] ?? 'bg-gray-100 text-gray-600'}`}>
                        {(t.uploads.state as Record<string, string>)[u.state] ?? u.state}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatBytes(u.fileSize)}</td>
                    <td className="px-4 py-3 text-gray-500 truncate max-w-[10rem]">
                      {(projects?.find((p: any) => p.id === u.projectId) as any)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {(t.uploads.categoryLabels as Record<string, string>)[u.category] ?? u.category}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {u.version > 1 ? (
                        <span className="text-xs font-bold bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">v{u.version}</span>
                      ) : <span className="text-xs text-gray-300">v{u.version}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString('hu-HU')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/uploads/${u.id}`}
                          className="text-gray-400 hover:text-brand-600 transition" title="Megnyitás">
                          <ArrowUpRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > 0 && totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {pageWindow.map((p, i) => p === 'ellipsis' ? (
                <span key={`e-${i}`} className="px-2 text-gray-400">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`min-w-8 px-2.5 py-1.5 rounded text-sm font-medium ${
                    p === page ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  aria-current={p === page ? 'page' : undefined}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {showBulkModal && (
        <BulkEditModal
          selectedIds={Array.from(selectedIds)}
          onClose={() => setShowBulkModal(false)}
          onDone={(affected) => {
            setToast(t.uploads.bulk.successToast(affected));
            setTimeout(() => setToast(null), 3000);
            setSelectedIds(new Set());
            mutate();
          }}
        />
      )}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
