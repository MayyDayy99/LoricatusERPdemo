'use client';

/**
 * Boost Sprint 2 — β₂: contracts list-oldal teljes rewrite a customer-precedens
 * mintájára. Eddig inline `apiClient.get`-tel + filter-állapot nélkül futott.
 *
 * Mostantól:
 *  - server-side paginated lista a `useContracts` hook-on át (Sprint 1 backend
 *    objektum-shape: `{ items, total, take, skip }`);
 *  - debounce-olt search-input (300ms), state + tag + per-page szelektor;
 *  - 4 predefined szegmens (expiringSoon30d / pendingSignature / activeHighValue /
 *    terminatedThisYear) + custom szegmensek `/users/me/settings/contractSegments`-en;
 *  - bulk-edit modal — a backend BulkPatchDto-shape (tag add/remove + isActive flip);
 *  - lista táblázat: contractNumber, title, state-badge, value+currency, customer,
 *    startDate → endDate, actions.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Filter, Bookmark, Trash2, X, AlertTriangle,
  CheckCircle2, Clock, XCircle,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  useContracts,
  type ContractListItem,
  createContract,
  activateContract,
  expireContract,
  terminateContract,
  bulkUpdateContracts,
  type ContractBulkPatch,
} from '@/lib/hooks/use-contracts';
import { useT } from '@/lib/hooks/use-t';
import { useTenant } from '@/lib/hooks/use-tenants';
import { CONTRACT_STATES, CONTRACT_STATE_STYLES, type ContractState } from '@/lib/contract-lifecycle';

// ─── Tipusok és konstansok ───────────────────────────────────────────────────

type Contract = ContractListItem;

const PER_PAGE_OPTIONS = [25, 50, 100, 200] as const;
type PerPage = typeof PER_PAGE_OPTIONS[number];

/**
 * A lista-szintű szűrő-szett. A `search` NEM része, mert free-text + debounce-olt
 * (külön state). A `state` kanonikus contract-állapot (draft|active|expired|terminated).
 *
 * A 4 predefined szegmens ezek kombinációja + frontend-szintű utószűrés:
 *  - expiringSoon30d: state=ACTIVE AND endDate within 30d (frontend-szűrés)
 *  - pendingSignature: state=DRAFT AND createdAt > 7d ago (frontend-szűrés)
 *  - activeHighValue: state=ACTIVE AND value > 1000000 (frontend-szűrés)
 *  - terminatedThisYear: state=TERMINATED AND terminatedAt this year (frontend-szűrés)
 *
 * Megjegyzés: a backend NEM ad endDate-range / value-range szűrőt — az utószűrés
 * a lap-szinten megjelenített halmazon belül történik. 6000+ contract-es tenant-on
 * ez azt jelenti, hogy a szegmens-választás után a UI a take=200 lapon szűr — a
 * pontos count rosszul jeleníthető meg. A frontend ezt jelzi: a count-badge a
 * total helyett a frontend-szűrés UTÁN megjelenített elemszámot mutatja.
 */
interface FilterState {
  state?: ContractState;
  tag?: string;
}

const EMPTY_FILTERS: FilterState = {};

interface SavedSegment {
  id: string;
  name: string;
  filters: FilterState;
  /** Predefined szegmens-id (csak custom-szegmenseknél hiányzik). */
  predefinedKey?: PredefinedSegmentId;
}

type PredefinedSegmentId =
  | 'expiringSoon30d'
  | 'pendingSignature'
  | 'activeHighValue'
  | 'terminatedThisYear';

const PREDEFINED_SEGMENT_FILTERS: Record<PredefinedSegmentId, FilterState> = {
  expiringSoon30d:    { state: 'active' },
  pendingSignature:   { state: 'draft' },
  activeHighValue:    { state: 'active' },
  terminatedThisYear: { state: 'terminated' },
};

/**
 * Frontend-utószűrés a predefined szegmensekre. A backend csak az alap state-szűrőt
 * kapja meg; itt szűkítjük a megjelenített halmazt.
 */
function applyPredefinedFilter(
  items: Contract[],
  segment: PredefinedSegmentId | null,
): Contract[] {
  if (!segment) return items;
  const now = Date.now();
  switch (segment) {
    case 'expiringSoon30d': {
      const thirtyDaysMs = 30 * 86400000;
      return items.filter((c) => {
        if (c.state !== 'active' || !c.endDate) return false;
        const diff = new Date(c.endDate).getTime() - now;
        return diff >= 0 && diff <= thirtyDaysMs;
      });
    }
    case 'pendingSignature': {
      const sevenDaysMs = 7 * 86400000;
      return items.filter((c) => {
        if (c.state !== 'draft') return false;
        return now - new Date(c.createdAt).getTime() > sevenDaysMs;
      });
    }
    case 'activeHighValue':
      return items.filter((c) => c.state === 'active' && (c.value ?? 0) > 1_000_000);
    case 'terminatedThisYear': {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
      return items.filter((c) => {
        if (c.state !== 'terminated' || !c.terminatedAt) return false;
        return new Date(c.terminatedAt).getTime() >= startOfYear;
      });
    }
  }
}

function filterStateEqual(a: FilterState, b: FilterState): boolean {
  return a.state === b.state && a.tag === b.tag;
}

function countActiveFilters(f: FilterState): number {
  return [f.state, f.tag].filter((v) => v !== undefined && v !== '').length;
}

// ─── Custom segments user-settings ───────────────────────────────────────────

const SEGMENT_SETTING_KEY = 'contractSegments';

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

// ─── Formatterek ─────────────────────────────────────────────────────────────

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('hu-HU') : '—');
const fmtValue = (n?: number, cur = 'HUF') =>
  n !== undefined && n !== null
    ? `${new Intl.NumberFormat('hu-HU').format(n)} ${cur}`
    : '—';
const daysUntil = (d?: string) =>
  d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;

// ─── CreateContractModal ─────────────────────────────────────────────────────

function CreateContractModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useT();
  const { tenant } = useTenant();
  const [form, setForm] = useState({
    contractNumber: '',
    title: '',
    value: '',
    currency: tenant?.defaultCurrency ?? 'HUF',
    startDate: '',
    endDate: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createContract({
        contractNumber: form.contractNumber,
        title: form.title,
        value: form.value ? parseFloat(form.value) : undefined,
        currency: form.currency || 'HUF',
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      });
      onCreated();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba történt a mentés során.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{t.contracts.newTitle}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input required className="border rounded-lg px-3 py-2 text-sm"
              placeholder={t.contracts.contractNoPh}
              value={form.contractNumber}
              onChange={(e) => setForm((f) => ({ ...f, contractNumber: e.target.value }))} />
            <div className="flex gap-2">
              <input type="number" min="0" step="0.01"
                className="border rounded-lg px-3 py-2 text-sm w-full"
                placeholder={t.contracts.valuePh}
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
              <select className="border rounded-lg px-2 py-2 text-sm"
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                <option>HUF</option><option>EUR</option><option>USD</option>
              </select>
            </div>
          </div>
          <input required className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder={t.contracts.titlePh}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{t.contracts.startDate}</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{t.contracts.endDate}</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">{t.common.cancel}</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
              {loading ? t.common.creating : t.common.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── TerminateModal ──────────────────────────────────────────────────────────

function TerminateModal({
  id,
  onClose,
  onDone,
}: {
  id: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await terminateContract(id, reason || undefined);
      onDone();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba történt a felmondás során.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-3">{t.contracts.terminateTitle}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={3}
            placeholder={t.contracts.reasonPh} value={reason}
            onChange={(e) => setReason(e.target.value)} />
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600">{t.common.cancel}</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {loading ? t.common.terminating : t.contracts.terminate}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── BulkEditModal ───────────────────────────────────────────────────────────
//
// A backend ContractBulkPatch shape-je szándékosan szűk: `tag` (add/remove) + `isActive`.
// Bulk-state-transition NINCS — a contract-lifecycle jogi következménnyel jár
// (terminatedReason, signedAt) és kötegelten nem futtatható biztonságosan.

type BulkOp = 'tagAdd' | 'tagRemove' | 'deactivate' | 'reactivate';

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
  const [op, setOp] = useState<BulkOp>('tagAdd');
  const [tagVal, setTagVal] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildPatch = (): ContractBulkPatch | null => {
    switch (op) {
      case 'tagAdd':
        if (!tagVal.trim()) return null;
        return { tag: { mode: 'add', value: tagVal.trim() } };
      case 'tagRemove':
        if (!tagVal.trim()) return null;
        return { tag: { mode: 'remove', value: tagVal.trim() } };
      case 'deactivate':
        return { isActive: false };
      case 'reactivate':
        return { isActive: true };
    }
  };

  const handleApply = async () => {
    const patch = buildPatch();
    if (!patch) { setError('Hiányzó érték a művelethez.'); return; }
    if (!confirming) { setConfirming(true); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await bulkUpdateContracts(selectedIds, patch);
      onDone(result.affected);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? t.contracts.bulk.errorToast));
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  const cx = t.contracts.bulk as Record<string, any>;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-2">{cx.modalTitle}</h2>
        <p className="text-sm text-gray-500 mb-4">{cx.modalHint}</p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{cx.opLabel}</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={op}
              onChange={(e) => { setOp(e.target.value as BulkOp); setConfirming(false); setError(null); }}
            >
              <option value="tagAdd">{cx.ops.tagAdd}</option>
              <option value="tagRemove">{cx.ops.tagRemove}</option>
              <option value="deactivate">{cx.ops.deactivate ?? 'Deaktiválás'}</option>
              <option value="reactivate">{cx.ops.reactivate ?? 'Reaktiválás'}</option>
            </select>
          </div>

          {(op === 'tagAdd' || op === 'tagRemove') && (
            <input type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={tagVal}
              onChange={(e) => setTagVal(e.target.value)}
              placeholder={cx.tagPh ?? 'pl. lakossagi'}
              maxLength={50}
            />
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {confirming && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <p className="font-medium">{cx.confirmTitle ?? 'Megerősítés'}</p>
              <p>{typeof cx.confirmText === 'function' ? cx.confirmText(selectedIds.length) : `Biztosan? (${selectedIds.length})`}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button"
            onClick={() => { if (confirming) { setConfirming(false); } else { onClose(); } }}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            {cx.cancelBtn ?? t.common.cancel}
          </button>
          <button type="button" onClick={handleApply} disabled={loading}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {loading ? (cx.applying ?? 'Alkalmazás…') : (cx.applyBtn ?? 'Alkalmazás')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pagination window ───────────────────────────────────────────────────────

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

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const t = useT();
  const [showInactive, setShowInactive] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [terminateId, setTerminateId] = useState<string | null>(null);

  // Search-state — debounce-olt (300ms), hogy a beíráskor ne menjen minden
  // karakterre back-end-call.
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Filter + szegmens-állapot
  const [filters, setFilters] = useState<FilterState>({});
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [activePredefinedSegment, setActivePredefinedSegment] =
    useState<PredefinedSegmentId | null>(null);

  // Per-page lapozás
  const [perPage, setPerPage] = useState<PerPage>(50);
  const [page, setPage] = useState(1);

  // Rendezés (csak client-side a megjelenített halmazon)
  const [sortField, setSortField] = useState<'contractNumber' | 'title' | 'value' | 'endDate'>('contractNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Bulk-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Custom szegmensek
  const [customSegments, setCustomSegments] = useState<SavedSegment[]>([]);
  const [segmentNameInput, setSegmentNameInput] = useState('');
  const [showSaveSegmentInput, setShowSaveSegmentInput] = useState(false);

  useEffect(() => {
    void loadCustomSegments().then(setCustomSegments);
  }, []);

  // Bármely server-side param változására page=1 + kijelölés-ürítés. Egy id az
  // új szűrőkkel már nem feltétlenül van a halmazban.
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearch, showInactive, perPage, filters]);

  const { items, total, isLoading, mutate } = useContracts({
    includeInactive: showInactive,
    take: perPage,
    skip: (page - 1) * perPage,
    search: debouncedSearch || undefined,
    state: filters.state,
    tag: filters.tag,
  });

  // ── Frontend-utószűrés (predefined szegmens) ──
  const filtered = useMemo(
    () => applyPredefinedFilter(items, activePredefinedSegment),
    [items, activePredefinedSegment],
  );

  // ── Rendezés (a frontend-szűrt halmazon) ──
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: string | number;
      let vb: string | number;
      switch (sortField) {
        case 'contractNumber':
          va = a.contractNumber; vb = b.contractNumber; break;
        case 'title':
          va = a.title; vb = b.title; break;
        case 'value':
          va = a.value ?? -1; vb = b.value ?? -1; break;
        case 'endDate':
          va = a.endDate ? new Date(a.endDate).getTime() : 0;
          vb = b.endDate ? new Date(b.endDate).getTime() : 0;
          break;
        default:
          va = ''; vb = '';
      }
      if (typeof va === 'number') return sortDir === 'asc' ? va - (vb as number) : (vb as number) - va;
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb), 'hu')
        : String(vb).localeCompare(String(va), 'hu');
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageWindow = buildPageWindow(page, totalPages);
  const activeFilterCount = countActiveFilters(filters);

  // Selection helpers
  const allOnPageSelected = sorted.length > 0 && sorted.every((c) => selectedIds.has(c.id));
  const someOnPageSelected = sorted.some((c) => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      const next = new Set(selectedIds);
      sorted.forEach((c) => next.delete(c.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      sorted.forEach((c) => next.add(c.id));
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
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  // ── Segment-handlerek ──
  const applyPredefined = (id: PredefinedSegmentId) => {
    setFilters({ ...PREDEFINED_SEGMENT_FILTERS[id] });
    setActiveSegmentId(`predefined:${id}`);
    setActivePredefinedSegment(id);
  };

  const applyCustom = (seg: SavedSegment) => {
    setFilters({ ...seg.filters });
    setActiveSegmentId(`custom:${seg.id}`);
    setActivePredefinedSegment(seg.predefinedKey ?? null);
  };

  const handleClearFilters = () => {
    setFilters({ ...EMPTY_FILTERS });
    setActiveSegmentId(null);
    setActivePredefinedSegment(null);
  };

  const handleSaveSegment = async () => {
    const name = segmentNameInput.trim();
    if (!name) return;
    const id = `seg-${Date.now()}`;
    const next: SavedSegment[] = [
      ...customSegments,
      { id, name, filters, predefinedKey: activePredefinedSegment ?? undefined },
    ];
    setCustomSegments(next);
    setSegmentNameInput('');
    setShowSaveSegmentInput(false);
    setActiveSegmentId(`custom:${id}`);
    try {
      await saveCustomSegments(next);
      setToast((t.contracts as Record<string, any>).segments?.saveOk ?? 'Szegmens mentve');
      setTimeout(() => setToast(null), 2000);
    } catch {
      setCustomSegments(customSegments);
    }
  };

  const handleDeleteSegment = async (id: string) => {
    const next = customSegments.filter((s) => s.id !== id);
    setCustomSegments(next);
    if (activeSegmentId === `custom:${id}`) {
      setActiveSegmentId(null);
      setActivePredefinedSegment(null);
    }
    try { await saveCustomSegments(next); } catch { setCustomSegments(customSegments); }
  };

  // Szabad-szerkesztés visszadobja a "nincs aktív szegmens"-re.
  useEffect(() => {
    if (!activeSegmentId) return;
    const [kind, id] = activeSegmentId.split(':');
    let target: FilterState | undefined;
    if (kind === 'predefined') target = PREDEFINED_SEGMENT_FILTERS[id as PredefinedSegmentId];
    else target = customSegments.find((s) => s.id === id)?.filters;
    if (!target || !filterStateEqual(filters, target)) {
      setActiveSegmentId(null);
      setActivePredefinedSegment(null);
    }
  }, [filters, activeSegmentId, customSegments]);

  // ── Mutáció-helperek ──
  const handleActivate = async (id: string) => {
    await activateContract(id);
    void mutate();
  };
  const handleExpire = async (id: string) => {
    await expireContract(id);
    void mutate();
  };

  // ── Label-helperek (i18n) ──
  const cx = t.contracts as Record<string, any>;
  const segments = cx.segments as Record<string, any> | undefined;
  const stateLabels = cx.state as Record<string, string> | undefined ?? cx.states ?? {};
  const filtersLabels = cx.filters as Record<string, any> | undefined;
  const loadedLabel = (cx.subtitleLoaded as ((l: number, t: number) => string) | undefined)
    ? cx.subtitleLoaded(sorted.length, total)
    : cx.subtitle?.(total) ?? `${total}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.contracts.title}</h1>
          <p className="text-gray-500 mt-1">{loadedLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded" />
            {t.common.showInactive}
          </label>
          <button type="button" onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-brand-700 transition text-sm">
            <Plus className="w-4 h-4" />
            {t.contracts.newBtn}
          </button>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar: szegmensek */}
        <aside className="hidden lg:block w-60 shrink-0 sticky top-4 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
              {segments?.title ?? 'Szegmensek'}
            </h2>
            <button type="button" onClick={handleClearFilters}
              className={`w-full text-left px-2 py-1.5 rounded text-sm ${
                activeSegmentId === null && activeFilterCount === 0
                  ? 'bg-brand-50 text-brand-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {segments?.all ?? 'Minden szerződés'}
            </button>
            {(['expiringSoon30d', 'pendingSignature', 'activeHighValue', 'terminatedThisYear'] as PredefinedSegmentId[]).map((id) => (
              <button key={id} type="button" onClick={() => applyPredefined(id)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${
                  activeSegmentId === `predefined:${id}`
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5 opacity-60" />
                <span className="flex-1 truncate">{segments?.[id] ?? id}</span>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
              {segments?.custom ?? 'Egyéni szegmensek'}
            </h2>
            {customSegments.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-1.5">
                {segments?.emptyCustom ?? 'Még nincs egyéni szegmens.'}
              </p>
            ) : (
              customSegments.map((seg) => (
                <div key={seg.id}
                  className={`group flex items-center gap-1 px-2 py-1.5 rounded ${
                    activeSegmentId === `custom:${seg.id}`
                      ? 'bg-brand-50 text-brand-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <button type="button" onClick={() => applyCustom(seg)}
                    className="flex-1 text-left text-sm truncate" title={seg.name}>
                    {seg.name}
                  </button>
                  <button type="button" onClick={() => handleDeleteSegment(seg.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition"
                    title={segments?.deleteBtn ?? 'Törlés'}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}

            {(activeFilterCount > 0 || activePredefinedSegment) && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                {showSaveSegmentInput ? (
                  <div className="space-y-2">
                    <input type="text"
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                      placeholder={segments?.savePh ?? 'Szegmens neve'}
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
                    + {segments?.saveBtn ?? 'Aktuális szegmens mentése'}
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-4">
          {/* Search + state-select + per-page */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-400"
                placeholder={(filtersLabels?.searchPh as string) ?? 'Keresés szám, cím, leírás alapján…'}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <select
              aria-label={filtersLabels?.stateLabel ?? 'Állapot szűrő'}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
              value={filters.state ?? ''}
              onChange={(e) => setFilters((f) => ({
                ...f, state: (e.target.value || undefined) as ContractState | undefined,
              }))}
            >
              <option value="">{filtersLabels?.stateAny ?? 'Minden állapot'}</option>
              {CONTRACT_STATES.map((s) => (
                <option key={s} value={s}>{stateLabels[s] ?? s}</option>
              ))}
            </select>
            <input type="text"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32"
              placeholder={filtersLabels?.tagPh ?? 'Címke'}
              value={filters.tag ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, tag: e.target.value || undefined }))}
              maxLength={50} />
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs text-gray-500" htmlFor="contracts-per-page">
                {(cx.perPageLabel as string) ?? 'Oldalanként'}
              </label>
              <select id="contracts-per-page"
                className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-600"
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value) as PerPage)}>
                {PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          {activePredefinedSegment && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
              <Filter className="w-3.5 h-3.5" />
              {segments?.[activePredefinedSegment] ?? activePredefinedSegment}
              <span className="opacity-60">·</span>
              <span>{sorted.length} / {items.length}</span>
              <button type="button" onClick={handleClearFilters}
                className="ml-auto text-amber-700 hover:text-amber-900">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Bulk-select bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 bg-brand-50 border border-brand-200 rounded-lg px-4 py-2.5">
              <span className="text-sm text-brand-800 font-medium">
                {(cx.bulk?.selectedCount as ((n: number) => string) | undefined)?.(selectedIds.size) ?? `${selectedIds.size} kiválasztva`}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowBulkModal(true)}
                  className="bg-brand-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-brand-700">
                  {cx.bulk?.actionBtn ?? 'Tömeges művelet'}
                </button>
                <button type="button" onClick={() => setSelectedIds(new Set())}
                  className="text-sm text-brand-700 hover:text-brand-900 px-2 py-1">
                  {cx.bulk?.clear ?? 'Kijelölés törlése'}
                </button>
              </div>
            </div>
          )}

          {/* Tábla */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input type="checkbox" className="rounded"
                      checked={allOnPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected;
                      }}
                      onChange={toggleSelectAll}
                      aria-label="Összes kijelölése" />
                  </th>
                  {([
                    { label: t.contracts.colNumber, field: 'contractNumber' as const },
                    { label: t.contracts.colTitle, field: 'title' as const },
                    { label: t.contracts.colState, field: null },
                    { label: t.contracts.colValue, field: 'value' as const },
                    { label: cx.colCustomer ?? 'Ügyfél', field: null },
                    { label: t.contracts.colEndDate, field: 'endDate' as const },
                    { label: t.contracts.colActions, field: null },
                  ]).map(({ label, field }) => (
                    <th key={label as string}
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
                      {[...Array(8)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                      {searchInput || activeFilterCount > 0 || activePredefinedSegment
                        ? cx.emptyFiltered ?? 'Nincs találat a szűrési feltételekre'
                        : t.contracts.empty}
                    </td>
                  </tr>
                ) : sorted.map((c) => {
                  const days = c.state === 'active' ? daysUntil(c.endDate) : null;
                  const expiringSoon = days !== null && days >= 0 && days <= 30;
                  const overdue = days !== null && days < 0;
                  return (
                    <tr key={c.id}
                      className={`${expiringSoon ? 'bg-orange-50/40 hover:bg-orange-50' : overdue ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-gray-50'} ${!c.isActive ? 'opacity-50' : ''} ${selectedIds.has(c.id) ? 'bg-brand-50/40' : ''}`}
                    >
                      <td className="px-3 py-3">
                        <input type="checkbox" className="rounded"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelectOne(c.id)}
                          aria-label={`${c.contractNumber} kijelölése`} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        <Link href={`/contracts/${c.id}`}
                          className="text-gray-700 hover:text-brand-600 transition">
                          {c.contractNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <Link href={`/contracts/${c.id}`}
                          className="hover:text-brand-600 transition">{c.title}</Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CONTRACT_STATE_STYLES[c.state] ?? 'bg-gray-100 text-gray-600'}`}>
                          {stateLabels[c.state] ?? c.state}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{fmtValue(c.value, c.currency)}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {c.customerId ? (
                          <Link href={`/customers/${c.customerId}`}
                            className="text-brand-600 hover:underline text-xs">
                            {(cx.viewCustomer as string) ?? 'Megnyitás'}
                          </Link>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-400">
                            {fmtDate(c.startDate)}
                          </span>
                          <span className="text-gray-300">→</span>
                          <span className={expiringSoon ? 'text-orange-600 font-medium' : overdue ? 'text-red-600 font-medium' : 'text-gray-500'}>
                            {fmtDate(c.endDate)}
                          </span>
                          {(expiringSoon || overdue) && (
                            <span className={`flex items-center gap-0.5 text-xs font-medium ${overdue ? 'text-red-600' : 'text-orange-600'}`}>
                              <AlertTriangle className="w-3 h-3" />
                              {overdue ? `${Math.abs(days!)} ${(cx.daysExpiredSuffix as string) ?? 'napja lejárt'}` : `${days} ${(cx.daysLeftSuffix as string) ?? 'nap'}`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {c.state === 'draft' && (
                            <button onClick={() => handleActivate(c.id)}
                              className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium transition">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {t.contracts.activate}
                            </button>
                          )}
                          {c.state === 'active' && (
                            <button onClick={() => handleExpire(c.id)}
                              className="flex items-center gap-1 text-xs text-yellow-600 hover:text-yellow-800 font-medium transition">
                              <Clock className="w-3.5 h-3.5" /> {t.contracts.expire}
                            </button>
                          )}
                          {(c.state === 'draft' || c.state === 'active') && (
                            <button onClick={() => setTerminateId(c.id)}
                              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium transition">
                              <XCircle className="w-3.5 h-3.5" /> {t.contracts.terminate}
                            </button>
                          )}
                        </div>
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
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                {(cx.prev as string) ?? 'Előző'}
              </button>
              {pageWindow.map((p, i) => p === 'ellipsis' ? (
                <span key={`e-${i}`} className="px-2 text-gray-400">…</span>
              ) : (
                <button key={p} type="button" onClick={() => setPage(p)}
                  className={`min-w-8 px-2.5 py-1.5 rounded text-sm font-medium ${
                    p === page
                      ? 'bg-brand-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  aria-current={p === page ? 'page' : undefined}
                >
                  {p}
                </button>
              ))}
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {(cx.next as string) ?? 'Következő'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateContractModal onClose={() => setShowCreate(false)} onCreated={() => void mutate()} />
      )}
      {terminateId && (
        <TerminateModal id={terminateId}
          onClose={() => setTerminateId(null)}
          onDone={() => void mutate()} />
      )}
      {showBulkModal && (
        <BulkEditModal
          selectedIds={Array.from(selectedIds)}
          onClose={() => setShowBulkModal(false)}
          onDone={(affected) => {
            const successText = (cx.bulk?.successToast as ((n: number) => string) | undefined)?.(affected);
            setToast(successText ?? `${affected} frissítve`);
            setTimeout(() => setToast(null), 3000);
            setSelectedIds(new Set());
            void mutate();
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
