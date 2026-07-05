'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { mutate as swrMutate } from 'swr';
import { toast as notify } from 'sonner';
import {
  Plus, UserCheck, Pencil, Search,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Filter, Bookmark, Trash2, X,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  useCustomers, type CustomerListItem,
  useAccounts,
  bulkUpdateCustomers, type CustomerBulkPatch,
} from '@/lib/hooks/use-crm';
import { useT } from '@/lib/hooks/use-t';
import { CsvExportButton, CsvImportButton } from '@/components/csv/csv-export-import';
import { LIFECYCLE_STAGES, type LifecycleStage, LIFECYCLE_STYLES } from '@/lib/customer-lifecycle';

type Customer = CustomerListItem;

// B-task: a 8-fokú lifecycle a `@/lib/customer-lifecycle`-ben él — Next.js 15 page-file
// validation csak default exportot enged ide, ezért nem maradhat lokálisan exportálva.

const PER_PAGE_OPTIONS = [25, 50, 100] as const;
type PerPage = typeof PER_PAGE_OPTIONS[number];

// ─── F-feladat: szegmentáció + bulk-edit kulcs típusok ──────────────────────────
// A FilterState a TELJES szűrő-szett — predefined / custom szegmensek ugyanezt a
// shape-et kapnak. A search-input NEM része, mert az free-text és nem szegmens-
// szintű.

interface FilterState {
  lifecycleStage?: string;
  scoreMin?: number;
  scoreMax?: number;
  tag?: string;
  accountId?: string;
  /** Pozitív szemantika: VOLT aktivitás X napon belül. */
  lastActivityWithinDays?: number;
  /** Negatív szemantika (Stagnált-szegmens): NEM volt aktivitás X napon belül. */
  staleDaysMin?: number;
  createdWithinDays?: number;
  wonDealsMin?: number;
}

const EMPTY_FILTERS: FilterState = {};

interface SavedSegment {
  id: string;
  name: string;
  filters: FilterState;
}

type PredefinedSegmentId = 'hotLeads' | 'stagnant' | 'recent' | 'vip';

const PREDEFINED_SEGMENT_FILTERS: Record<PredefinedSegmentId, FilterState> = {
  hotLeads:  { scoreMin: 70 },
  stagnant:  { staleDaysMin: 60 },     // NINCS activity 60+ napja → backend NOT EXISTS
  recent:    { createdWithinDays: 7 },
  vip:       { wonDealsMin: 5 },
};

function filterStateEqual(a: FilterState, b: FilterState): boolean {
  // Sekély + uniform-key összehasonlítás: minden FilterState mező primitív.
  return (
    a.lifecycleStage === b.lifecycleStage &&
    a.scoreMin === b.scoreMin &&
    a.scoreMax === b.scoreMax &&
    a.tag === b.tag &&
    a.accountId === b.accountId &&
    a.lastActivityWithinDays === b.lastActivityWithinDays &&
    a.staleDaysMin === b.staleDaysMin &&
    a.createdWithinDays === b.createdWithinDays &&
    a.wonDealsMin === b.wonDealsMin
  );
}

function countActiveFilters(f: FilterState): number {
  return [
    f.lifecycleStage, f.scoreMin, f.scoreMax, f.tag, f.accountId,
    f.lastActivityWithinDays, f.staleDaysMin, f.createdWithinDays, f.wonDealsMin,
  ].filter((v) => v !== undefined && v !== '').length;
}

// ─── CustomerModal (változatlan: create/edit) ───────────────────────────────────

function CustomerModal({
  customer,
  onClose,
  onSaved,
}: {
  customer?: Customer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState({
    firstName: customer?.firstName ?? '',
    lastName: customer?.lastName ?? '',
    email: customer?.email ?? '',
    phone: customer?.phone ?? '',
    company: customer?.company ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!customer;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        company: form.company || undefined,
      };
      if (isEdit) {
        await apiClient.patch(`/customers/${customer!.id}`, payload);
      } else {
        await apiClient.post('/customers', payload);
      }
      // Kis késleltetés mielőtt a mutate-ot triggerelnénk — a backend audit-log
      // commit-ja és a frontend SWR-cache miatt enélkül időnként az új sor
      // nem jelenik meg.
      await new Promise((r) => setTimeout(r, 100));
      await onSaved();
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
        <h2 className="text-lg font-semibold mb-4">{isEdit ? t.customers.editTitle : t.customers.newTitle}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input required className="border rounded-lg px-3 py-2 text-sm" placeholder={t.customers.firstNamePh}
              value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
            <input required className="border rounded-lg px-3 py-2 text-sm" placeholder={t.customers.lastNamePh}
              value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
          </div>
          <input type="email" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={t.customers.emailPh}
            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={t.customers.phonePh}
            value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={t.customers.companyPh}
            value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">{t.common.cancel}</button>
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

// ─── F-feladat: bulk-edit modal ─────────────────────────────────────────────────
//
// A 7 művelet (lifecycle / scoreSet / scoreAdd / tagAdd / tagRemove / deactivate /
// reactivate) közül egyet választ a kezelő. A backend egyetlen patch-mező-szett-et
// vár (BulkPatchDto), ezt a `buildPatch()` állítja össze a select + value alapján.
// A backend confirm-szöveg kétlépcsős: első klikk → confirm-kérdés, második →
// tényleges POST.

type BulkOp = 'lifecycle' | 'scoreSet' | 'scoreAdd' | 'tagAdd' | 'tagRemove' | 'deactivate' | 'reactivate';

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
  const [op, setOp] = useState<BulkOp>('lifecycle');
  const [lifecycleVal, setLifecycleVal] = useState<LifecycleStage>('customer');
  const [scoreVal, setScoreVal] = useState<string>('50');
  const [tagVal, setTagVal] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildPatch = (): CustomerBulkPatch | null => {
    switch (op) {
      case 'lifecycle':
        return { lifecycleStage: lifecycleVal };
      case 'scoreSet': {
        const n = Number(scoreVal);
        if (!Number.isFinite(n) || n < 0 || n > 100) return null;
        return { leadScore: { mode: 'set', value: n } };
      }
      case 'scoreAdd': {
        const n = Number(scoreVal);
        if (!Number.isFinite(n) || n < -100 || n > 100) return null;
        return { leadScore: { mode: 'add', value: n } };
      }
      case 'tagAdd': {
        if (!tagVal.trim()) return null;
        return { tag: { mode: 'add', value: tagVal.trim() } };
      }
      case 'tagRemove': {
        if (!tagVal.trim()) return null;
        return { tag: { mode: 'remove', value: tagVal.trim() } };
      }
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
      const result = await bulkUpdateCustomers(selectedIds, patch);
      onDone(result.affected);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? t.customers.bulk.errorToast));
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-2">{t.customers.bulk.modalTitle}</h2>
        <p className="text-sm text-gray-500 mb-4">{t.customers.bulk.modalHint}</p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t.customers.bulk.opLabel}</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={op}
              onChange={(e) => { setOp(e.target.value as BulkOp); setConfirming(false); setError(null); }}
            >
              <option value="lifecycle">{t.customers.bulk.ops.lifecycle}</option>
              <option value="scoreSet">{t.customers.bulk.ops.scoreSet}</option>
              <option value="scoreAdd">{t.customers.bulk.ops.scoreAdd}</option>
              <option value="tagAdd">{t.customers.bulk.ops.tagAdd}</option>
              <option value="tagRemove">{t.customers.bulk.ops.tagRemove}</option>
              <option value="deactivate">{t.customers.bulk.ops.deactivate}</option>
              <option value="reactivate">{t.customers.bulk.ops.reactivate}</option>
            </select>
          </div>

          {op === 'lifecycle' && (
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={lifecycleVal}
              onChange={(e) => setLifecycleVal(e.target.value as LifecycleStage)}
            >
              {LIFECYCLE_STAGES.map(stage => (
                <option key={stage} value={stage}>{t.customers.lifecycle[stage]}</option>
              ))}
            </select>
          )}
          {(op === 'scoreSet' || op === 'scoreAdd') && (
            <input
              type="number"
              min={op === 'scoreSet' ? 0 : -100}
              max={100}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={scoreVal}
              onChange={(e) => setScoreVal(e.target.value)}
              placeholder={op === 'scoreSet' ? '0..100' : '-100..+100'}
            />
          )}
          {(op === 'tagAdd' || op === 'tagRemove') && (
            <input
              type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={tagVal}
              onChange={(e) => setTagVal(e.target.value)}
              placeholder={t.customers.filters.tagPh}
              maxLength={50}
            />
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {confirming && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <p className="font-medium">{t.customers.bulk.confirmTitle}</p>
              <p>{t.customers.bulk.confirmText(selectedIds.length)}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => { if (confirming) { setConfirming(false); } else { onClose(); } }}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {t.customers.bulk.cancelBtn}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={loading}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? t.customers.bulk.applying : t.customers.bulk.applyBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Pagination renderer: Prev | 1, 2, …, N | Next pattern.
 * Window körül (current ± 1), két szélen 1 és last, középen ellipszis. Kevesebb
 * mint 8 oldalnál minden gomb látszik (nincs ellipszis).
 */
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

// ─── F-feladat: custom segmensek user-settings perzisztencia ───────────────────
// users.settings.customerSegments JSONB-ben tároljuk a saved-szegmensek tömbjét.
// A backend endpoint: GET/PUT /users/me/settings/customerSegments (4KB cap).
//
// A storage shape egyszerű: SavedSegment[].

const SEGMENT_SETTING_KEY = 'customerSegments';

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

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const t = useT();
  const [showInactive, setShowInactive] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | undefined>();

  // Search-state — kettő van, mert a beíráskor nem hívunk azonnal back-endet.
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // F-feladat: a TELJES szűrő-szett (lifecycle + score-min/max + tag + account +
  // lastActivity + createdWithin + wonDealsMin) most server-side. A "Stagnált"
  // szegmens kivétel — invertált logika, ezért külön state.
  const [filters, setFilters] = useState<FilterState>({});
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  const [sortField, setSortField] = useState<'name' | 'company' | 'email' | 'leadScore'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [perPage, setPerPage] = useState<PerPage>(25);
  const [page, setPage] = useState(1);

  // ── Bulk-edit state ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // ── Custom segments state ──
  const [customSegments, setCustomSegments] = useState<SavedSegment[]>([]);
  const [segmentNameInput, setSegmentNameInput] = useState('');
  const [showSaveSegmentInput, setShowSaveSegmentInput] = useState(false);

  useEffect(() => {
    void loadCustomSegments().then(setCustomSegments);
  }, []);

  // Bármelyik szervere-küldött param változásakor lapozzunk vissza az 1-re és
  // ürítsük a kijelölést. A kijelölés-üresítés azért fontos, mert egy id az új
  // szűrőkkel már nem feltétlenül van a halmazban.
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearch, showInactive, perPage, filters]);

  const { items, total, isLoading, mutate } = useCustomers({
    includeInactive: showInactive,
    take: perPage,
    skip: (page - 1) * perPage,
    search: debouncedSearch || undefined,
    lifecycleStage: filters.lifecycleStage,
    scoreMin: filters.scoreMin,
    scoreMax: filters.scoreMax,
    tag: filters.tag,
    accountId: filters.accountId,
    lastActivityWithinDays: filters.lastActivityWithinDays,
    staleDaysMin: filters.staleDaysMin,
    createdWithinDays: filters.createdWithinDays,
    wonDealsMin: filters.wonDealsMin,
  });

  const { accounts } = useAccounts();

  const handleToggleActive = async (c: Customer) => {
    // Defenzív: confirm-prompt + try/catch + toast + global revalidate.
    // A korábbi silent-failure pattern miatt nem látszott a felhasználónak,
    // hogy a DELETE/reactivate request elment-e (és ha 4xx/5xx jött, az is
    // csendben eltűnt). Most explicit visszajelzés a 3 ágon (cancel/ok/error).
    const action = c.isActive ? t.customers.deactivate : t.customers.reactivate;
    const name = `${c.firstName} ${c.lastName}`.trim() || c.email || c.id;
    if (typeof window !== 'undefined' && !window.confirm(`${action}: ${name}?`)) return;
    try {
      if (c.isActive) {
        await apiClient.delete(`/customers/${c.id}`);
      } else {
        await apiClient.post(`/customers/${c.id}/reactivate`);
      }
      // Globális revalidate: minden /customers* SWR-key + parent-summary frissül,
      // így a row eltűnik a listáról (showInactive=false esetén) és a 360°
      // detail-page is rögtön az új isActive státuszt mutatja.
      // Globális predicate-revalidate minden /customers* SWR-kulcsra (list-page-en
      // a paginált kulcs + a customer-detail-summary). A mutate() (local hook)
      // csak az aktuális paginált kulcsot frissítené.
      void swrMutate(
        (key) => typeof key === 'string' && key.startsWith('/customers'),
        undefined,
        { revalidate: true },
      );
      notify.success(`${action}: ${name}`);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? `${action} sikertelen`;
      notify.error(Array.isArray(msg) ? msg.join(' · ') : msg);
      // Konzolra is loggoljuk — a Sprint 2 polish-audit a silent-failure-t mint
      // diagnoszt-akadályt jelölte.
      // eslint-disable-next-line no-console
      console.error('[customers.toggleActive]', err);
    }
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  // ── Client-side csak rendezés. A szűrés (a régi lifecycle / score MEGSZŰNT
  //    client-only) most a backend dolga. ──
  const sorted = useMemo(() => [...items].sort((a, b) => {
    let va: string | number;
    let vb: string | number;
    switch (sortField) {
      case 'name':     va = `${a.firstName} ${a.lastName}`; vb = `${b.firstName} ${b.lastName}`; break;
      case 'company':  va = a.company ?? ''; vb = b.company ?? ''; break;
      case 'email':    va = a.email ?? ''; vb = b.email ?? ''; break;
      case 'leadScore':va = a.leadScore ?? -1; vb = b.leadScore ?? -1; break;
      default:         va = ''; vb = '';
    }
    if (typeof va === 'number') return sortDir === 'asc' ? va - (vb as number) : (vb as number) - va;
    return sortDir === 'asc' ? String(va).localeCompare(String(vb), 'hu') : String(vb).localeCompare(String(va), 'hu');
  }), [items, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageWindow = buildPageWindow(page, totalPages);
  const loadedLabel = t.customers.subtitleLoaded(sorted.length, total);
  const activeFilterCount = countActiveFilters(filters);

  // ── Selection helpers ──
  const allOnPageSelected = sorted.length > 0 && sorted.every(c => selectedIds.has(c.id));
  const someOnPageSelected = sorted.some(c => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      const next = new Set(selectedIds);
      sorted.forEach(c => next.delete(c.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      sorted.forEach(c => next.add(c.id));
      setSelectedIds(next);
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // ── Segment helpers ──
  const applyPredefined = (id: PredefinedSegmentId) => {
    setFilters({ ...PREDEFINED_SEGMENT_FILTERS[id] });
    setActiveSegmentId(`predefined:${id}`);
    setShowMoreFilters(true);
  };

  const applyCustom = (seg: SavedSegment) => {
    setFilters({ ...seg.filters });
    setActiveSegmentId(`custom:${seg.id}`);
    setShowMoreFilters(true);
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
      setToast(t.customers.segments.saveOk);
      setTimeout(() => setToast(null), 2000);
    } catch {
      // optimistic rollback
      setCustomSegments(customSegments);
    }
  };

  const handleDeleteSegment = async (id: string) => {
    const next = customSegments.filter(s => s.id !== id);
    setCustomSegments(next);
    if (activeSegmentId === `custom:${id}`) setActiveSegmentId(null);
    try { await saveCustomSegments(next); } catch { setCustomSegments(customSegments); }
  };

  // A "currently active" segment észlelése — ha a filter-set nem egyezik egy
  // saved-del, az activeSegmentId NULL marad. Megjegyzés: a select-mód
  // (Prefedined vagy Custom) az egyetlen módja annak, hogy a szegmens
  // "aktívnak" számítson; szabad-szerkesztés visszadobja `null`-ra.
  useEffect(() => {
    if (!activeSegmentId) return;
    const [kind, id] = activeSegmentId.split(':');
    let target: FilterState | undefined;
    if (kind === 'predefined') target = PREDEFINED_SEGMENT_FILTERS[id as PredefinedSegmentId];
    else target = customSegments.find(s => s.id === id)?.filters;
    if (!target || !filterStateEqual(filters, target)) setActiveSegmentId(null);
  }, [filters, activeSegmentId, customSegments]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.customers.title}</h1>
          <p className="text-gray-500 mt-1">{loadedLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="rounded" />
            {t.common.showInactive}
          </label>
          <CsvExportButton endpoint="/csv/customers" filename="customers.csv" label="Export" />
          <CsvImportButton endpoint="/csv/customers" label="Import" onDone={() => mutate()} />
          <button
            type="button"
            data-tour="new-customer-btn"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-brand-700 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            {t.customers.newBtn}
          </button>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* ─── F: Sidebar — Szegmensek ──────────────────────────────────────── */}
        <aside className="hidden lg:block w-60 shrink-0 sticky top-4 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
              {t.customers.segments.title}
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
              {t.customers.segments.all}
            </button>
            {(['hotLeads', 'stagnant', 'recent', 'vip'] as PredefinedSegmentId[]).map(id => (
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
                <span className="flex-1 truncate">{t.customers.segments.predefined[id]}</span>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
              {t.customers.segments.custom}
            </h2>
            {customSegments.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-1.5">{t.customers.segments.emptyCustom}</p>
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
                    title={t.customers.segments.deleteBtn}
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
                      placeholder={t.customers.segments.savePh}
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
                    + {t.customers.segments.saveBtn}
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-4">
          {/* Search + alap-filter sor */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-400"
                placeholder="Keresés név, email, cég alapján…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
            </div>
            <select
              aria-label="Életciklus szűrő"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
              value={filters.lifecycleStage ?? ''}
              onChange={e => setFilters(f => ({ ...f, lifecycleStage: e.target.value || undefined }))}
            >
              <option value="">Minden életciklus</option>
              {LIFECYCLE_STAGES.map(stage => (
                <option key={stage} value={stage}>
                  {t.customers.lifecycle[stage]}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Score:</span>
              <input type="number" min="0" max="100" className="w-16 border border-gray-200 rounded-lg px-2 py-2 text-sm"
                placeholder="min"
                value={filters.scoreMin ?? ''}
                onChange={e => setFilters(f => ({ ...f, scoreMin: e.target.value === '' ? undefined : Number(e.target.value) }))} />
              <span className="text-xs text-gray-400">—</span>
              <input type="number" min="0" max="100" className="w-16 border border-gray-200 rounded-lg px-2 py-2 text-sm"
                placeholder="max"
                value={filters.scoreMax ?? ''}
                onChange={e => setFilters(f => ({ ...f, scoreMax: e.target.value === '' ? undefined : Number(e.target.value) }))} />
            </div>
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
              {t.customers.filters.moreFilters}
              {activeFilterCount > 2 && (
                <span className="bg-brand-600 text-white text-xs rounded-full px-1.5 py-0.5 ml-1">
                  {activeFilterCount - 2}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs text-gray-500" htmlFor="customers-per-page">{t.customers.perPageLabel}</label>
              <select
                id="customers-per-page"
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

          {/* Bővített szűrők — collapsable */}
          {showMoreFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t.customers.filters.tag}</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white"
                  placeholder={t.customers.filters.tagPh}
                  value={filters.tag ?? ''}
                  onChange={(e) => setFilters(f => ({ ...f, tag: e.target.value || undefined }))}
                  maxLength={50}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t.customers.filters.account}</label>
                <select
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white"
                  value={filters.accountId ?? ''}
                  onChange={(e) => setFilters(f => ({ ...f, accountId: e.target.value || undefined }))}
                >
                  <option value="">{t.customers.filters.accountAny}</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t.customers.filters.lastActivity}</label>
                <select
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white"
                  value={filters.lastActivityWithinDays ?? ''}
                  onChange={(e) => setFilters(f => ({
                    ...f, lastActivityWithinDays: e.target.value === '' ? undefined : Number(e.target.value),
                  }))}
                >
                  <option value="">{t.customers.filters.lastActivityAny}</option>
                  <option value="30">{t.customers.filters.days30}</option>
                  <option value="60">{t.customers.filters.days60}</option>
                  <option value="90">{t.customers.filters.days90}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t.customers.filters.createdWithin}</label>
                <select
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white"
                  value={filters.createdWithinDays ?? ''}
                  onChange={(e) => setFilters(f => ({
                    ...f, createdWithinDays: e.target.value === '' ? undefined : Number(e.target.value),
                  }))}
                >
                  <option value="">{t.customers.filters.lastActivityAny}</option>
                  <option value="7">{t.customers.filters.days30.replace('30', '7')}</option>
                  <option value="30">{t.customers.filters.days30}</option>
                  <option value="90">{t.customers.filters.days90}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t.customers.filters.wonDealsMin}</label>
                <input
                  type="number"
                  min="0"
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white"
                  value={filters.wonDealsMin ?? ''}
                  onChange={(e) => setFilters(f => ({
                    ...f, wonDealsMin: e.target.value === '' ? undefined : Number(e.target.value),
                  }))}
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
                  {t.customers.filters.clear}
                </button>
              </div>
            </div>
          )}

          {/* ── F: Bulk-select bar ── */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 bg-brand-50 border border-brand-200 rounded-lg px-4 py-2.5">
              <span className="text-sm text-brand-800 font-medium">
                {t.customers.bulk.selectedCount(selectedIds.size)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(true)}
                  className="bg-brand-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-brand-700"
                >
                  {t.customers.bulk.actionBtn}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-sm text-brand-700 hover:text-brand-900 px-2 py-1"
                >
                  {t.customers.bulk.clear}
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {/* F: select-all checkbox */}
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
                    { label: t.customers.colName, field: 'name' as const },
                    { label: t.customers.colCompany, field: 'company' as const },
                    { label: t.customers.colEmail, field: 'email' as const },
                    { label: t.customers.colPhone, field: null },
                    { label: 'Életciklus', field: null },
                    { label: 'Lead score', field: 'leadScore' as const },
                    { label: t.customers.colStatus, field: null },
                    { label: '', field: null },
                  ]).map(({ label, field }) => (
                    <th key={label}
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
                      {searchInput || activeFilterCount > 0 ? 'Nincs találat a szűrési feltételekre' : t.customers.empty}
                    </td>
                  </tr>
                ) : sorted.map(c => (
                  <tr key={c.id} className={`hover:bg-gray-50 ${!c.isActive ? 'opacity-50' : ''} ${selectedIds.has(c.id) ? 'bg-brand-50/40' : ''}`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelectOne(c.id)}
                        aria-label={`${c.firstName} ${c.lastName} kijelölése`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/customers/${c.id}`}
                        className="font-medium text-gray-900 hover:text-brand-600 transition">
                        {c.firstName} {c.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{c.company ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{c.email ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      {c.lifecycleStage ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${LIFECYCLE_STYLES[c.lifecycleStage] ?? 'bg-gray-100 text-gray-600'}`}>
                          {(t.customers.lifecycle as Record<string, string>)[c.lifecycleStage] ?? c.lifecycleStage}
                        </span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.leadScore != null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${c.leadScore >= 70 ? 'bg-green-500' : c.leadScore >= 40 ? 'bg-yellow-400' : 'bg-gray-300'}`}
                              style={{ width: `${Math.min(100, c.leadScore)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{c.leadScore}</span>
                        </div>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {c.isActive ? t.common.active : t.common.inactive}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {/* Árazógép-stílus: sárga ceruza + piros kuka, w-5 h-5, strokeWidth 2.5.
                          A reaktiválás-ágon UserCheck marad (logikailag tér el a törléstől). */}
                      <button type="button" onClick={() => setEditTarget(c)}
                        aria-label={t.common.edit} title={t.common.edit}
                        className="text-yellow-500 hover:text-yellow-600 transition mr-2">
                        <Pencil className="w-5 h-5" strokeWidth={2.5} />
                      </button>
                      <button type="button" onClick={() => handleToggleActive(c)}
                        aria-label={c.isActive ? t.customers.deactivate : t.customers.reactivate}
                        title={c.isActive ? t.customers.deactivate : t.customers.reactivate}
                        className={`transition ${c.isActive ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}`}>
                        {c.isActive
                          ? <Trash2 className="w-5 h-5" strokeWidth={2.5} />
                          : <UserCheck className="w-5 h-5" strokeWidth={2.5} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination control: Prev | 1, 2, …, N | Next */}
          {total > 0 && totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                {t.customers.prev}
              </button>
              {pageWindow.map((p, i) => p === 'ellipsis' ? (
                <span key={`e-${i}`} className="px-2 text-gray-400">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`min-w-8 px-2.5 py-1.5 rounded text-sm font-medium ${
                    p === page
                      ? 'bg-brand-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  aria-label={t.customers.page(p)}
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
                {t.customers.next}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CustomerModal onClose={() => setShowCreate(false)} onSaved={() => mutate()} />
      )}
      {editTarget && (
        <CustomerModal customer={editTarget} onClose={() => setEditTarget(undefined)} onSaved={() => mutate()} />
      )}
      {showBulkModal && (
        <BulkEditModal
          selectedIds={Array.from(selectedIds)}
          onClose={() => setShowBulkModal(false)}
          onDone={(affected) => {
            setToast(t.customers.bulk.successToast(affected));
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
