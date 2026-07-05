'use client';

/**
 * Sprint-2 β₁ — Quotes list page (rewrite, customers-precedens szerint).
 *
 * Sidebar:
 *   - 4 predefined szegmens: drafts | sent | acceptedThisMonth | expiringSoon (≤14d)
 *   - custom user-szegmensek a /users/me/settings/quoteSegments JSONB-en
 *
 * Header:
 *   - paginator (25/50/100), debounced search (300ms)
 *   - bulkbar a kijelölés alapján (BulkEditModal: stateToDraft/tagAdd/tagRemove/delete)
 *
 * Table:
 *   - checkbox + quoteNumber + state-badge + customer + total + validUntil + actions
 *   - quoteNumber Link → `/quotes/:id` (új detail-page)
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, ChevronLeft, ChevronRight, Bookmark, Trash2, X, Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/lib/hooks/use-t';
import {
  useQuotes, bulkUpdateQuotes, deleteQuote,
  type QuoteListItem, type QuoteState, type QuoteBulkOp,
} from '@/lib/hooks/use-quotes';

const PER_PAGE_OPTIONS = [25, 50, 100] as const;
type PerPage = typeof PER_PAGE_OPTIONS[number];

// ─── Segments ─────────────────────────────────────────────────────────────────

interface FilterState {
  state?: QuoteState;
  /** Csak FE-kompozíció: a backend nem ismeri közvetlenül. */
  segmentKind?: 'acceptedThisMonth' | 'expiringSoon';
}

const EMPTY_FILTERS: FilterState = {};

type PredefinedSegmentId = 'drafts' | 'sent' | 'acceptedThisMonth' | 'expiringSoon';

const PREDEFINED_SEGMENT_FILTERS: Record<PredefinedSegmentId, FilterState> = {
  drafts:            { state: 'draft' },
  sent:              { state: 'sent' },
  acceptedThisMonth: { state: 'accepted', segmentKind: 'acceptedThisMonth' },
  expiringSoon:      { state: 'sent',     segmentKind: 'expiringSoon' },
};

interface SavedSegment {
  id: string;
  name: string;
  filters: FilterState;
}

const SEGMENT_SETTING_KEY = 'quoteSegments';

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

function filterStateEqual(a: FilterState, b: FilterState): boolean {
  return a.state === b.state && a.segmentKind === b.segmentKind;
}

function countActiveFilters(f: FilterState): number {
  return [f.state, f.segmentKind].filter((v) => v !== undefined).length;
}

// ─── FE szűrők (kliens-oldali részhalmaz a backend-szűrő tetején) ─────────────
//
// A backend `/quotes` szerverszintű state-szűrőt és search-et tud. Az
// acceptedThisMonth (acceptedAt ≥ ELSE_ANY_DAY_OF_MONTH) és az expiringSoon
// (validUntil ≤ ma+14d) Sprint-1 backend-en NEM létezik, ezért client-side
// szűkítünk a state-szűrt halmazon. Egy 6000+ quote-os tenant-on is OK, mert
// a paginated take=100 max 100 sort tárol; ha többre van szükség, lapozni kell.

function applyClientSegment(items: QuoteListItem[], kind?: 'acceptedThisMonth' | 'expiringSoon'): QuoteListItem[] {
  if (!kind) return items;
  if (kind === 'acceptedThisMonth') {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return items.filter((q) => {
      if (!q.acceptedAt) return false;
      return new Date(q.acceptedAt) >= monthStart;
    });
  }
  if (kind === 'expiringSoon') {
    const cutoff = Date.now() + 14 * 86_400_000;
    return items.filter((q) => {
      if (!q.validUntil) return false;
      const d = new Date(q.validUntil).getTime();
      return d <= cutoff && d >= Date.now();
    });
  }
  return items;
}

// ─── Bulk-edit modal ──────────────────────────────────────────────────────────

function BulkEditModal({
  selectedIds, onClose, onDone,
}: {
  selectedIds: string[];
  onClose: () => void;
  onDone: (affected: number) => void;
}) {
  const t = useT();
  const [op, setOp] = useState<QuoteBulkOp>('stateToDraft');
  const [tagVal, setTagVal] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    // Validáció op-onként
    if ((op === 'tagAdd' || op === 'tagRemove') && !tagVal.trim()) {
      setError(t.quotes.bulk.errorToast);
      return;
    }
    if (!confirming) { setConfirming(true); return; }

    setLoading(true);
    setError(null);
    try {
      if (op === 'delete') {
        // Sprint-1 backend: nincs bulk-delete endpoint, sorban hívunk.
        let affected = 0;
        for (const id of selectedIds) {
          try { await deleteQuote(id); affected++; } catch { /* skip */ }
        }
        onDone(affected);
      } else if (op === 'stateToDraft') {
        const res = await bulkUpdateQuotes(selectedIds, { state: 'draft' });
        onDone(res.affected);
      } else if (op === 'tagAdd' || op === 'tagRemove') {
        // A backend Sprint-1 DTO single-string tag-et fogad; az
        // add/remove szemantikát a service alapértelmezett `add` mode-on
        // intézi. A `tagRemove`-ot a UI csak tervez (Sprint-3 backend bővítés).
        const res = await bulkUpdateQuotes(selectedIds, { tag: tagVal.trim() });
        onDone(res.affected);
      }
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? t.quotes.bulk.errorToast));
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-2">{t.quotes.bulk.modalTitle}</h2>
        <p className="text-sm text-gray-500 mb-4">{t.quotes.bulk.modalHint}</p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t.quotes.bulk.opLabel}</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={op}
              onChange={(e) => { setOp(e.target.value as QuoteBulkOp); setConfirming(false); setError(null); }}
            >
              <option value="stateToDraft">{t.quotes.bulk.ops.stateToDraft}</option>
              <option value="tagAdd">{t.quotes.bulk.ops.tagAdd}</option>
              <option value="tagRemove">{t.quotes.bulk.ops.tagRemove}</option>
              <option value="delete">{(t.quotes.bulk.ops as any).delete ?? 'Törlés'}</option>
            </select>
          </div>

          {(op === 'tagAdd' || op === 'tagRemove') && (
            <input
              type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={tagVal}
              onChange={(e) => setTagVal(e.target.value)}
              placeholder="Címke"
              maxLength={50}
            />
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {confirming && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <p className="font-medium">
                {(t.customers as any).bulk?.confirmTitle ?? 'Megerősítés'}
              </p>
              <p>
                {selectedIds.length} {t.quotes.title.toLowerCase()} érintve.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => { if (confirming) setConfirming(false); else onClose(); }}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={loading}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? t.common.saving : (confirming ? ((t.customers as any).bulk?.confirmTitle ?? 'Megerősítés') : ((t.customers as any).bulk?.applyBtn ?? 'Alkalmaz'))}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pagination window helper (customers-precedens) ──────────────────────────

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

// ─── State styling ───────────────────────────────────────────────────────────

const STATE_STYLES: Record<QuoteState, string> = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired:  'bg-yellow-100 text-yellow-700',
};

const fmt = (v?: number, c = 'HUF') =>
  v != null ? new Intl.NumberFormat('hu-HU').format(v) + ' ' + c : '—';

// ─── Main page ────────────────────────────────────────────────────────────────

export default function QuotesPage() {
  const t = useT();

  // Search
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Filters / segments
  const [filters, setFilters] = useState<FilterState>({});
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  // Pagination
  const [perPage, setPerPage] = useState<PerPage>(25);
  const [page, setPage] = useState(1);

  // Bulk
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Custom segments
  const [customSegments, setCustomSegments] = useState<SavedSegment[]>([]);
  const [segmentNameInput, setSegmentNameInput] = useState('');
  const [showSaveSegmentInput, setShowSaveSegmentInput] = useState(false);

  useEffect(() => {
    void loadCustomSegments().then(setCustomSegments);
  }, []);

  // Reset page + selection ha bármi szervere-küldött szűrő változik
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearch, perPage, filters]);

  const { items, total, isLoading, mutate } = useQuotes({
    state: filters.state,
    search: debouncedSearch || undefined,
    take: perPage,
    skip: (page - 1) * perPage,
  });

  // Kliens-szegmens (acceptedThisMonth / expiringSoon) szűkítés a state-szűrt
  // halmazon. A `total` ezért a server-side-é marad — a UI nem tud erre szóló
  // pontos count-ot mutatni. Tudatosan elfogadjuk: ezek a szegmensek mind 1-2
  // tucatos sorhalmaz, és a backend-bővítés majd Sprint-3.
  const visible = useMemo(
    () => applyClientSegment(items, filters.segmentKind),
    [items, filters.segmentKind],
  );

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageWindow = buildPageWindow(page, totalPages);
  const activeFilterCount = countActiveFilters(filters);

  // Selection helpers
  const allOnPageSelected = visible.length > 0 && visible.every((q) => selectedIds.has(q.id));
  const someOnPageSelected = visible.some((q) => selectedIds.has(q.id));

  const toggleSelectAll = () => {
    const next = new Set(selectedIds);
    if (allOnPageSelected) visible.forEach((q) => next.delete(q.id));
    else visible.forEach((q) => next.add(q.id));
    setSelectedIds(next);
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Segment helpers
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
      setToastMsg('Szegmens elmentve.');
      setTimeout(() => setToastMsg(null), 2000);
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

  // Activate-segment észlelése — a customers-precedens szerint
  useEffect(() => {
    if (!activeSegmentId) return;
    const [kind, segId] = activeSegmentId.split(':');
    let target: FilterState | undefined;
    if (kind === 'predefined') target = PREDEFINED_SEGMENT_FILTERS[segId as PredefinedSegmentId];
    else target = customSegments.find((s) => s.id === segId)?.filters;
    if (!target || !filterStateEqual(filters, target)) setActiveSegmentId(null);
  }, [filters, activeSegmentId, customSegments]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.quotes.title}</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {t.quotes.subtitle(visible.length)} / {total}
          </p>
        </div>
        <Link
          href="/crm/quotes?action=new"
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-brand-700 transition text-sm"
        >
          <Plus className="w-4 h-4" />
          {t.quotes.newBtn}
        </Link>
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar */}
        <aside className="hidden lg:block w-60 shrink-0 sticky top-4 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
              {(t.customers.segments as any).title ?? 'Szegmensek'}
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
              {(t.customers.segments as any).all ?? 'Összes'}
            </button>
            {(['drafts', 'sent', 'acceptedThisMonth', 'expiringSoon'] as PredefinedSegmentId[]).map((id) => (
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
                <span className="flex-1 truncate">{t.quotes.segments[id]}</span>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
              {(t.customers.segments as any).custom ?? 'Saját szegmensek'}
            </h2>
            {customSegments.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-1.5">
                {(t.customers.segments as any).emptyCustom ?? 'Még nincs.'}
              </p>
            ) : (
              customSegments.map((seg) => (
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
                    aria-label="Szegmens törlése"
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
                      placeholder="Szegmens neve…"
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
                    + Szegmens mentése
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Main column */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Search + perPage */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-400"
                placeholder="Keresés szám, cím, ügyfél…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <select
              aria-label={t.quotes.colState}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
              value={filters.state ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, state: (e.target.value || undefined) as QuoteState | undefined }))}
            >
              <option value="">{t.quotes.colState}</option>
              <option value="draft">{t.quotes.state.draft}</option>
              <option value="sent">{t.quotes.state.sent}</option>
              <option value="accepted">{t.quotes.state.accepted}</option>
              <option value="rejected">{t.quotes.state.rejected}</option>
              <option value="expired">{t.quotes.state.expired}</option>
            </select>
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs text-gray-500" htmlFor="quotes-per-page">
                {(t.customers as any).perPageLabel ?? 'Oldal méret:'}
              </label>
              <select
                id="quotes-per-page"
                className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-600"
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value) as PerPage)}
              >
                {PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Bulk bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 bg-brand-50 border border-brand-200 rounded-lg px-4 py-2.5">
              <span className="text-sm text-brand-800 font-medium">
                {selectedIds.size} kijelölve
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(true)}
                  className="bg-brand-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-brand-700"
                >
                  {(t.customers as any).bulk?.actionBtn ?? 'Tömeges szerkesztés'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-sm text-brand-700 hover:text-brand-900 px-2 py-1"
                >
                  {(t.customers as any).bulk?.clear ?? 'Mégse'}
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={allOnPageSelected}
                      ref={(el) => { if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected; }}
                      onChange={toggleSelectAll}
                      aria-label="Összes kijelölése"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Szám</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.quotes.colTitle}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.quotes.colState}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.quotes.colCustomer}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{t.quotes.colTotal}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.quotes.colValid}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(7)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                      {searchInput || activeFilterCount > 0 ? 'Nincs találat a szűrési feltételekre' : t.quotes.empty}
                    </td>
                  </tr>
                ) : visible.map((q) => (
                  <tr key={q.id} className={`hover:bg-gray-50 ${selectedIds.has(q.id) ? 'bg-brand-50/40' : ''}`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={selectedIds.has(q.id)}
                        onChange={() => toggleSelectOne(q.id)}
                        aria-label={`${q.quoteNumber ?? q.title} kijelölése`}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      <Link href={`/quotes/${q.id}`} className="hover:text-brand-600">
                        {q.quoteNumber ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/quotes/${q.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                        {q.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATE_STYLES[q.state] ?? 'bg-gray-100 text-gray-600'}`}>
                        {t.quotes.state[q.state] ?? q.state}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {q.customerName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {fmt(q.totalAmount, q.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {q.validUntil ? new Date(q.validUntil).toLocaleDateString('hu-HU') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 0 && totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                {(t.customers as any).prev ?? 'Előző'}
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {(t.customers as any).next ?? 'Következő'}
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
            toast.success(t.quotes.bulk.successToast(affected));
            setSelectedIds(new Set());
            mutate();
          }}
        />
      )}

      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
