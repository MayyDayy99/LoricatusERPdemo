'use client';

/**
 * Work-Orders list page — Sprint-2 β₃
 * ────────────────────────────────────────────────────────────────────────────
 * Mirror-ja a customers/page.tsx-nek (gold-standard):
 *   - SWR-paginated `useWorkOrders` hook (use-work-orders.ts)
 *   - server-side search (debounced 300 ms)
 *   - 4 előre definiált szegmens + custom-saved szegmensek (user-settings)
 *   - bulk-edit modal (stateToArchived / tagAdd / tagRemove)
 *   - row-click → /work-orders/:id (router push)
 *
 * Server-side támogatás (Sprint-1):
 *   - search, state, take, skip a queryben
 * Client-side post-filter (Sprint-2 segments — backend FK-jellemzők nélkül):
 *   - dueSoon: deadline ≤ +7 nap AND state=ACTIVE  (deadline-szerverfilter még nincs)
 *   - awaitingSignOff: state=COMPLETED AND nincs customFields.signedBy
 *   - archivable: state=COMPLETED AND createdAt > 30 nap (proxy: nincs completedAt mező)
 *   - myActive: state=ACTIVE AND responsiblePerson tartalmazza a current user nevét
 *     (NB: a backend-ben nincs assignedTo FK — best-effort string-match)
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Filter, Bookmark, Trash2,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast as sonner } from 'sonner';
import { apiClient } from '@/lib/api-client';
import {
  useWorkOrders,
  bulkUpdateWorkOrders,
  createWorkOrder,
  type WorkOrderListItem,
  type WorkOrderBulkPatch,
  type CreateWorkOrderDto,
} from '@/lib/hooks/use-work-orders';
import { useT } from '@/lib/hooks/use-t';
import { useCurrentUser } from '@/lib/hooks/use-users';
import { CsvExportButton, CsvImportButton } from '@/components/csv/csv-export-import';
import { WORK_ORDER_STATE_STYLES } from '@/lib/work-order-lifecycle';

type WOState = WorkOrderListItem['state'];

// ─── Pagination ───────────────────────────────────────────────────────────────

const PER_PAGE_OPTIONS = [25, 50, 100] as const;
type PerPage = typeof PER_PAGE_OPTIONS[number];

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

// ─── Segments ─────────────────────────────────────────────────────────────────

/** Egy szegmens (előre definiált vagy custom) ugyanazt a shape-et használja:
 *  a fields a szerver-szűrőkre megy, a clientFilter pedig post-filter predikátum. */
interface SegmentFilters {
  state?: WOState;
  /** Client-side szegmensek: a backend nem támogatja, ezért predikátum-jelzőkkel
   *  jelöljük, hogy melyik gyökér-szegmensbe tartozunk. A custom-szegmensek
   *  csak `state`-et és `tag`-et perzisztálnak; a 4 előre definiált csak a
   *  predefinedId-jét tárolja. */
  predefinedId?: PredefinedSegmentId;
  /** A custom-szegmens user-megadta tag-szűrő (post-filter, mert a backend nem
   *  szűr tag-re a list endpointon). */
  tag?: string;
}

type PredefinedSegmentId = 'myActive' | 'dueSoon' | 'awaitingSignOff' | 'archivable';

const PREDEFINED_SEGMENT_FILTERS: Record<PredefinedSegmentId, SegmentFilters> = {
  myActive:        { state: 'active', predefinedId: 'myActive' },
  dueSoon:         { state: 'active', predefinedId: 'dueSoon' },
  awaitingSignOff: { state: 'completed', predefinedId: 'awaitingSignOff' },
  archivable:      { state: 'completed', predefinedId: 'archivable' },
};

interface SavedSegment {
  id: string;
  name: string;
  filters: SegmentFilters;
}

const EMPTY_FILTERS: SegmentFilters = {};

function filterStateEqual(a: SegmentFilters, b: SegmentFilters): boolean {
  return a.state === b.state && a.predefinedId === b.predefinedId && (a.tag ?? '') === (b.tag ?? '');
}

function countActiveFilters(f: SegmentFilters): number {
  return [f.state, f.tag, f.predefinedId].filter((v) => v !== undefined && v !== '').length;
}

const SEGMENT_SETTING_KEY = 'workOrderSegments';

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

// ─── Bulk-edit ────────────────────────────────────────────────────────────────

type BulkOp = 'stateToArchived' | 'tagAdd' | 'tagRemove';

function BulkEditModal({
  selectedIds, onClose, onDone,
}: {
  selectedIds: string[];
  onClose: () => void;
  onDone: (affected: number) => void;
}) {
  const t = useT();
  const [op, setOp] = useState<BulkOp>('stateToArchived');
  const [tagVal, setTagVal] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildPatch = (): WorkOrderBulkPatch | null => {
    switch (op) {
      case 'stateToArchived':
        return { state: 'archived' };
      case 'tagAdd': {
        if (!tagVal.trim()) return null;
        return { tag: { mode: 'add', value: tagVal.trim() } };
      }
      case 'tagRemove': {
        if (!tagVal.trim()) return null;
        return { tag: { mode: 'remove', value: tagVal.trim() } };
      }
    }
  };

  const handleApply = async () => {
    const patch = buildPatch();
    if (!patch) { setError('Hiányzó érték a művelethez.'); return; }
    if (!confirming) { setConfirming(true); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await bulkUpdateWorkOrders(selectedIds, patch);
      onDone(result.affected);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? t.workOrders.bulk.errorToast));
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-2">{t.workOrders.bulk.modalTitle}</h2>
        <p className="text-sm text-gray-500 mb-4">{t.workOrders.bulk.modalHint}</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t.workOrders.bulk.opLabel}</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={op}
              onChange={(e) => { setOp(e.target.value as BulkOp); setConfirming(false); setError(null); }}
            >
              <option value="stateToArchived">{t.workOrders.bulk.ops.stateToArchived}</option>
              <option value="tagAdd">{t.workOrders.bulk.ops.tagAdd}</option>
              <option value="tagRemove">{t.workOrders.bulk.ops.tagRemove}</option>
            </select>
          </div>
          {(op === 'tagAdd' || op === 'tagRemove') && (
            <input
              type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={tagVal}
              onChange={(e) => setTagVal(e.target.value)}
              placeholder={t.workOrders.filters.tagPh}
              maxLength={50}
            />
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          {confirming && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <p className="font-medium">{t.workOrders.bulk.confirmTitle}</p>
              <p>{t.workOrders.bulk.confirmText(selectedIds.length)}</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button"
            onClick={() => { if (confirming) setConfirming(false); else onClose(); }}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            {t.workOrders.bulk.cancelBtn}
          </button>
          <button type="button" onClick={handleApply} disabled={loading}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {loading ? t.workOrders.bulk.applying : t.workOrders.bulk.applyBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const daysUntil = (dateStr?: string) => {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
};

const daysAgo = (dateStr?: string) => {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
};

// ─── Create modal (minimal — kötelező mezők only) ────────────────────────────
//
// A korábbi verzió 8-szekciós create-modal-t tartalmazott (350+ sor). β₃-ban
// a lista-oldal a customers-mintát követi: a quick-create-hez csak a kötelező
// mezőket kéri (location / clientCompany / projectGoal); a többi a /work-orders/:id
// szerkesztőjén állítható be a teljes panelból.

function CreateWorkOrderModal({
  onClose, onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState<CreateWorkOrderDto>({
    location: '',
    clientCompany: '',
    projectGoal: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      await createWorkOrder(form);
      sonner.success(t.common.saved);
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{t.workOrders.newTitle}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t.workOrders.location} *</label>
            <input required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t.workOrders.clientCompany} *</label>
            <input required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.clientCompany}
              onChange={(e) => setForm((f) => ({ ...f, clientCompany: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t.workOrders.projectGoal} *</label>
            <textarea required rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.projectGoal}
              onChange={(e) => setForm((f) => ({ ...f, projectGoal: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t.workOrders.deadline}</label>
            <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.deadline ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value || undefined }))} />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              {t.common.cancel}
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
              {loading ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorkOrdersPage() {
  const t = useT();
  const { currentUser } = useCurrentUser();

  const [showCreate, setShowCreate] = useState(false);

  // ── Search debounce ──
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // ── Filters / segments ──
  const [filters, setFilters] = useState<SegmentFilters>({});
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  const [sortField, setSortField] = useState<'workOrderNumber' | 'location' | 'client' | 'deadline'>('workOrderNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [perPage, setPerPage] = useState<PerPage>(25);
  const [page, setPage] = useState(1);

  // ── Bulk-edit state ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // ── Custom segments ──
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

  const { items, total, isLoading, mutate } = useWorkOrders({
    state: filters.state,
    search: debouncedSearch || undefined,
    take: perPage,
    skip: (page - 1) * perPage,
  });

  // ── Client-side post-filter a 4 előre definiált szegmenshez ──
  const filtered = useMemo(() => {
    const pred = filters.predefinedId;
    let list: WorkOrderListItem[] = items;

    if (pred === 'dueSoon') {
      list = list.filter((wo) => {
        const d = daysUntil(wo.deadline);
        return d != null && d >= 0 && d <= 7;
      });
    } else if (pred === 'awaitingSignOff') {
      list = list.filter((wo) => !wo.customFields?.['signedBy']);
    } else if (pred === 'archivable') {
      list = list.filter((wo) => {
        const a = daysAgo(wo.createdAt);
        return a != null && a >= 30;
      });
    } else if (pred === 'myActive' && currentUser) {
      const myKeys = [
        currentUser.email,
        `${currentUser.firstName ?? ''} ${currentUser.lastName ?? ''}`.trim(),
      ]
        .filter(Boolean).map((s) => s!.toLowerCase());
      list = list.filter((wo) => {
        const rp = (wo.responsiblePerson ?? '').toLowerCase();
        return myKeys.some((k) => rp.includes(k));
      });
    }

    // Custom-szegmens tag-szűrő (post-filter).
    if (filters.tag) {
      const target = filters.tag.toLowerCase();
      list = list.filter((wo) => {
        const tags = (wo.customFields?.['tags'] as string[] | undefined) ?? [];
        return tags.some((t) => t.toLowerCase() === target);
      });
    }

    return list;
  }, [items, filters.predefinedId, filters.tag, currentUser]);

  // ── Client-side sort ──
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let va: string;
    let vb: string;
    switch (sortField) {
      case 'workOrderNumber': va = a.workOrderNumber; vb = b.workOrderNumber; break;
      case 'location':        va = a.location ?? '';  vb = b.location ?? '';  break;
      case 'client':          va = a.clientCompany ?? ''; vb = b.clientCompany ?? ''; break;
      case 'deadline':        va = a.deadline ?? '9999'; vb = b.deadline ?? '9999'; break;
      default: va = ''; vb = '';
    }
    return sortDir === 'asc' ? va.localeCompare(vb, 'hu') : vb.localeCompare(va, 'hu');
  }), [filtered, sortField, sortDir]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageWindow = buildPageWindow(page, totalPages);
  const loadedLabel = t.workOrders.subtitleLoaded(sorted.length, total);
  const activeFilterCount = countActiveFilters(filters);

  // ── Selection helpers ──
  const allOnPageSelected = sorted.length > 0 && sorted.every((c) => selectedIds.has(c.id));
  const someOnPageSelected = sorted.some((c) => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    const next = new Set(selectedIds);
    if (allOnPageSelected) sorted.forEach((c) => next.delete(c.id));
    else sorted.forEach((c) => next.add(c.id));
    setSelectedIds(next);
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  // ── Segment helpers ──
  const applyPredefined = (id: PredefinedSegmentId) => {
    setFilters({ ...PREDEFINED_SEGMENT_FILTERS[id] });
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
      setToast(t.workOrders.segments.saveOk);
      setTimeout(() => setToast(null), 2000);
    } catch {
      setCustomSegments(customSegments);
    }
  };

  const handleDeleteSegment = async (id: string) => {
    const next = customSegments.filter((s) => s.id !== id);
    setCustomSegments(next);
    if (activeSegmentId === `custom:${id}`) setActiveSegmentId(null);
    try { await saveCustomSegments(next); } catch { setCustomSegments(customSegments); }
  };

  // Active-segment self-clear ha a user szabadon szerkesztett a szűrőkön.
  useEffect(() => {
    if (!activeSegmentId) return;
    const [kind, id] = activeSegmentId.split(':');
    let target: SegmentFilters | undefined;
    if (kind === 'predefined') target = PREDEFINED_SEGMENT_FILTERS[id as PredefinedSegmentId];
    else target = customSegments.find((s) => s.id === id)?.filters;
    if (!target || !filterStateEqual(filters, target)) setActiveSegmentId(null);
  }, [filters, activeSegmentId, customSegments]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.workOrders.title}</h1>
          <p className="text-gray-500 mt-1">{loadedLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CsvExportButton endpoint="/csv/work-orders" filename="work-orders.csv" label="Export" />
          <CsvImportButton endpoint="/csv/work-orders" label="Import" onDone={() => mutate()} />
          <button type="button" onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-brand-700 transition text-sm">
            <Plus className="w-4 h-4" />
            {t.workOrders.newBtn}
          </button>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── Sidebar segments ── */}
        <aside className="hidden lg:block w-60 shrink-0 sticky top-4 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
              {t.workOrders.segments.title}
            </h2>
            <button type="button" onClick={handleClearFilters}
              className={`w-full text-left px-2 py-1.5 rounded text-sm ${
                activeSegmentId === null && activeFilterCount === 0
                  ? 'bg-brand-50 text-brand-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}>
              {t.workOrders.segments.all}
            </button>
            {(['myActive', 'dueSoon', 'awaitingSignOff', 'archivable'] as PredefinedSegmentId[]).map((id) => (
              <button key={id} type="button" onClick={() => applyPredefined(id)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${
                  activeSegmentId === `predefined:${id}`
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}>
                <Bookmark className="w-3.5 h-3.5 opacity-60" />
                <span className="flex-1 truncate">{t.workOrders.segments[id]}</span>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
              {t.workOrders.segments.custom}
            </h2>
            {customSegments.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-1.5">{t.workOrders.segments.emptyCustom}</p>
            ) : (
              customSegments.map((seg) => (
                <div key={seg.id}
                  className={`group flex items-center gap-1 px-2 py-1.5 rounded ${
                    activeSegmentId === `custom:${seg.id}`
                      ? 'bg-brand-50 text-brand-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  <button type="button" onClick={() => applyCustom(seg)}
                    className="flex-1 text-left text-sm truncate" title={seg.name}>
                    {seg.name}
                  </button>
                  <button type="button" onClick={() => handleDeleteSegment(seg.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition"
                    title={t.workOrders.segments.deleteBtn}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
            {activeFilterCount > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                {showSaveSegmentInput ? (
                  <div className="space-y-2">
                    <input type="text"
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                      placeholder={t.workOrders.segments.savePh}
                      value={segmentNameInput}
                      onChange={(e) => setSegmentNameInput(e.target.value)}
                      maxLength={50}
                      autoFocus />
                    <div className="flex gap-1">
                      <button type="button" onClick={handleSaveSegment}
                        disabled={!segmentNameInput.trim()}
                        className="flex-1 px-2 py-1 bg-brand-600 text-white text-xs rounded hover:bg-brand-700 disabled:opacity-50">
                        {t.common.save}
                      </button>
                      <button type="button"
                        onClick={() => { setShowSaveSegmentInput(false); setSegmentNameInput(''); }}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">
                        {t.common.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowSaveSegmentInput(true)}
                    className="w-full text-xs text-brand-600 hover:text-brand-700 px-2 py-1.5 text-left">
                    + {t.workOrders.segments.saveBtn}
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-4">
          {/* ── Search + state-filter ── */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-400"
                placeholder={t.workOrders.searchPh}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)} />
            </div>
            <select
              aria-label="State"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
              value={filters.state ?? ''}
              onChange={(e) => setFilters((f) => ({
                ...f,
                state: (e.target.value || undefined) as WOState | undefined,
                predefinedId: undefined,
              }))}>
              <option value="">{t.workOrders.filters.stateAll}</option>
              <option value="draft">{t.workOrders.state.draft}</option>
              <option value="active">{t.workOrders.state.active}</option>
              <option value="completed">{t.workOrders.state.completed}</option>
              <option value="cancelled">{t.workOrders.state.cancelled}</option>
              <option value="archived">{t.workOrders.state.archived}</option>
            </select>
            <button type="button" onClick={handleClearFilters}
              disabled={activeFilterCount === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              <Filter className="w-3.5 h-3.5" />
              {t.workOrders.filters.clear}
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs text-gray-500" htmlFor="wo-per-page">{t.workOrders.perPageLabel}</label>
              <select id="wo-per-page"
                className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-600"
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value) as PerPage)}>
                {PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Bulk-select bar ── */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 bg-brand-50 border border-brand-200 rounded-lg px-4 py-2.5">
              <span className="text-sm text-brand-800 font-medium">
                {t.workOrders.bulk.selectedCount(selectedIds.size)}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowBulkModal(true)}
                  className="bg-brand-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-brand-700">
                  {t.workOrders.bulk.actionBtn}
                </button>
                <button type="button" onClick={() => setSelectedIds(new Set())}
                  className="text-sm text-brand-700 hover:text-brand-900 px-2 py-1">
                  {t.workOrders.bulk.clear}
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input type="checkbox"
                      className="rounded"
                      checked={allOnPageSelected}
                      ref={(el) => { if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected; }}
                      onChange={toggleSelectAll}
                      aria-label="Összes kijelölése" />
                  </th>
                  {([
                    { label: t.workOrders.colNumber,   field: 'workOrderNumber' as const },
                    { label: t.workOrders.colLocation, field: 'location' as const },
                    { label: t.workOrders.colClient,   field: 'client' as const },
                    { label: t.workOrders.colState,    field: null },
                    { label: t.workOrders.colDeadline, field: 'deadline' as const },
                  ]).map(({ label, field }) => (
                    <th key={label}
                      className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide ${field ? 'cursor-pointer hover:text-gray-700 select-none' : ''}`}
                      onClick={field ? () => handleSort(field) : undefined}>
                      <span className="flex items-center gap-1">
                        {label}
                        {field && sortField === field && (
                          sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
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
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                      {searchInput || activeFilterCount > 0
                        ? t.workOrders.emptyFiltered
                        : t.workOrders.empty}
                    </td>
                  </tr>
                ) : sorted.map((wo) => {
                  const days = daysUntil(wo.deadline);
                  return (
                    <tr key={wo.id} className={`hover:bg-gray-50 ${selectedIds.has(wo.id) ? 'bg-brand-50/40' : ''}`}>
                      <td className="px-3 py-3">
                        <input type="checkbox"
                          className="rounded"
                          checked={selectedIds.has(wo.id)}
                          onChange={() => toggleSelectOne(wo.id)}
                          aria-label={`${wo.workOrderNumber} kijelölése`} />
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/work-orders/${wo.id}`}
                          className="font-mono text-xs text-gray-700 hover:text-brand-600 transition">
                          {wo.workOrderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/work-orders/${wo.id}`}
                          className="font-medium text-gray-900 hover:text-brand-600 transition">
                          {wo.location}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{wo.clientCompany}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${WORK_ORDER_STATE_STYLES[wo.state] ?? 'bg-gray-100 text-gray-600'}`}>
                          {t.workOrders.state[wo.state]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {wo.deadline ? (
                          <span className={
                            days == null ? 'text-gray-500'
                            : days < 0 ? 'text-red-600 font-medium'
                            : days <= 3 ? 'text-yellow-600 font-medium'
                            : 'text-gray-500'
                          }>
                            {new Date(wo.deadline).toLocaleDateString('hu-HU')}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 0 && totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <button type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
                {t.workOrders.prev}
              </button>
              {pageWindow.map((p, i) => p === 'ellipsis' ? (
                <span key={`e-${i}`} className="px-2 text-gray-400">…</span>
              ) : (
                <button key={p} type="button" onClick={() => setPage(p)}
                  className={`min-w-8 px-2.5 py-1.5 rounded text-sm font-medium ${
                    p === page ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  aria-label={t.workOrders.page(p)}
                  aria-current={p === page ? 'page' : undefined}>
                  {p}
                </button>
              ))}
              <button type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed">
                {t.workOrders.next}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateWorkOrderModal
          onClose={() => setShowCreate(false)}
          onSaved={() => mutate()} />
      )}
      {showBulkModal && (
        <BulkEditModal
          selectedIds={Array.from(selectedIds)}
          onClose={() => setShowBulkModal(false)}
          onDone={(affected) => {
            setToast(t.workOrders.bulk.successToast(affected));
            setTimeout(() => setToast(null), 3000);
            setSelectedIds(new Set());
            mutate();
          }} />
      )}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
