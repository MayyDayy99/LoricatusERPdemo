'use client';

/**
 * Sprint 3 β₁: Documents global list-page rewrite.
 * ────────────────────────────────────────────────────────────────────────────
 * A customers/page.tsx-precedensen alapuló FE refactor:
 *  - tenant-globális paginated lista (per-projekt szűrő opcionális dropdown);
 *  - 4 predefined szegmens (recentDrafts / pendingSend / mineAuthored /
 *    supersededLastQuarter) + custom szegmensek user-settings-ben perzisztált;
 *  - bulk-edit (stateChange / typeChange / archive=supersede);
 *  - per-document quick-actions (generate / send / download);
 *  - drag-drop upload hint → /uploads/new (csak link).
 *
 * A régi per-projekt-card-grid view-t a state-machine kötelezi (DRAFT csak
 * generate; GENERATED csak send/supersede). A new global listán a state-badge
 * + típuslabel a customer-lifecycle-stílusú palettával jön (DOCUMENT_STATE_STYLES).
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  Plus, Send, FileText, RefreshCw, AlertCircle, Search, X, Download,
  Upload, Share2, Filter, Bookmark, Trash2, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useProjects } from '@/lib/hooks/use-projects';
import { useCurrentUser } from '@/lib/hooks/use-users';
import {
  useDocuments,
  createDocument,
  generateDocument,
  sendDocument,
  bulkUpdateDocuments,
  downloadDocument,
  type Document,
  type DocumentRecipient,
  type DocumentBulkPatch,
} from '@/lib/hooks/use-documents';
import { useT } from '@/lib/hooks/use-t';
import {
  DOCUMENT_STATES,
  DOCUMENT_TYPES,
  DOCUMENT_STATE_STYLES,
  type DocumentState as DocStateKey,
  type DocumentType as DocTypeKey,
} from '@/lib/document-lifecycle';

/* ─── konstansok ─────────────────────────────────────────────────────────── */

const PER_PAGE_OPTIONS = [25, 50, 100] as const;
type PerPage = typeof PER_PAGE_OPTIONS[number];

/* ─── szűrő-state + szegmensek (customer-page-precedens) ─────────────────── */

interface FilterState {
  state?: string;
  type?: string;
  projectId?: string;
  customerId?: string;
  dealId?: string;
  contractId?: string;
  workOrderId?: string;
  invoiceId?: string;
  /** Predefined-szegmensek belső jelzés, NEM megy a backendre. */
  recentDraftsDays?: number;
  pendingSendDays?: number;
  /** mineAuthored: a current-user ID-ját runtime tölti — a state itt csak boolean. */
  mineAuthored?: boolean;
  /** Negyedéves felváltva-szegmens: state=SUPERSEDED + createdAt > 90 nap. */
  supersededLastQuarter?: boolean;
}

const EMPTY_FILTERS: FilterState = {};

interface SavedSegment {
  id: string;
  name: string;
  filters: FilterState;
}

type PredefinedSegmentId =
  | 'recentDrafts'
  | 'pendingSend'
  | 'mineAuthored'
  | 'supersededLastQuarter';

const PREDEFINED_SEGMENT_FILTERS: Record<PredefinedSegmentId, FilterState> = {
  recentDrafts:          { state: 'draft',      recentDraftsDays: 7 },
  pendingSend:           { state: 'generated',  pendingSendDays:  3 },
  mineAuthored:          { mineAuthored: true },
  supersededLastQuarter: { state: 'superseded', supersededLastQuarter: true },
};

function filterStateEqual(a: FilterState, b: FilterState): boolean {
  return (
    a.state === b.state &&
    a.type === b.type &&
    a.projectId === b.projectId &&
    a.customerId === b.customerId &&
    a.dealId === b.dealId &&
    a.contractId === b.contractId &&
    a.workOrderId === b.workOrderId &&
    a.invoiceId === b.invoiceId &&
    a.recentDraftsDays === b.recentDraftsDays &&
    a.pendingSendDays === b.pendingSendDays &&
    a.mineAuthored === b.mineAuthored &&
    a.supersededLastQuarter === b.supersededLastQuarter
  );
}

function countActiveFilters(f: FilterState): number {
  return [
    f.state, f.type, f.projectId, f.customerId, f.dealId,
    f.contractId, f.workOrderId, f.invoiceId,
  ].filter((v) => v !== undefined && v !== '').length;
}

const SEGMENT_SETTING_KEY = 'documentSegments';

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

/* ─── client-side szegmens-szűrő helper ──────────────────────────────────── */

/**
 * A 4 predefined szegmens szűrése részben backend-szintű (state/type), részben
 * client-szintű — recentDraftsDays/pendingSendDays/mineAuthored/supersededLastQuarter
 * azonnal érvényesül a sorrendezett listán. A backend egy NULL-fő-szűrőt küld
 * a megfelelő state-tel; a finom-mate dátum-szűrés kliensoldalon fut (kis perf-
 * cost — a paginált oldalon max 100 doc).
 */
function applyClientSegment(docs: Document[], f: FilterState, currentUserId?: string): Document[] {
  let result = docs;
  if (f.recentDraftsDays != null) {
    const cutoff = Date.now() - f.recentDraftsDays * 86_400_000;
    result = result.filter((d) => new Date(d.createdAt).getTime() >= cutoff);
  }
  if (f.pendingSendDays != null) {
    const cutoff = Date.now() - f.pendingSendDays * 86_400_000;
    // generated state + generatedAt 3+ napja: küldésre vár
    result = result.filter((d) =>
      d.generatedAt ? new Date(d.generatedAt).getTime() <= cutoff : false,
    );
  }
  if (f.mineAuthored && currentUserId) {
    result = result.filter((d) => d.createdBy === currentUserId);
  }
  if (f.supersededLastQuarter) {
    const cutoff = Date.now() - 90 * 86_400_000;
    result = result.filter((d) => new Date(d.createdAt).getTime() >= cutoff);
  }
  return result;
}

/* ─── pagination renderer (customer-precedens) ───────────────────────────── */

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

/* ─── create modal ───────────────────────────────────────────────────────── */

function CreateDocumentModal({
  projects,
  onClose,
  onSuccess,
}: {
  projects: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useT();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('safety_report');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) { setError(t.documents.emptyNoProject); return; }
    setBusy(true);
    setError(null);
    try {
      await createDocument({ projectId, title, type });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.documents.createError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
        <h2 className="text-lg font-bold text-gray-900">{t.documents.newTitle}</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="doc-projid" className="block text-sm font-medium text-gray-700 mb-1.5">
              {t.documents.linkedProject}
            </label>
            <select
              id="doc-projid"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="doc-title" className="block text-sm font-medium text-gray-700 mb-1.5">
              {t.documents.titleLabel}
            </label>
            <input
              id="doc-title" type="text" required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={500}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div>
            <label htmlFor="doc-type" className="block text-sm font-medium text-gray-700 mb-1.5">
              {t.documents.typeLabel}
            </label>
            <select
              id="doc-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {t.documents.typeOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              {t.common.cancel}
            </button>
            <button type="submit" disabled={busy}
              className="flex-1 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-60">
              {busy ? t.common.creating : t.common.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── send modal ─────────────────────────────────────────────────────────── */

function SendModal({
  doc, onClose, onSuccess,
}: { doc: Document; onClose: () => void; onSuccess: () => void }) {
  const t = useT();
  const [recipients, setRecipients] = useState<DocumentRecipient[]>([{ email: '', name: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRecipient() { setRecipients((r) => [...r, { email: '', name: '' }]); }
  function removeRecipient(i: number) { setRecipients((r) => r.filter((_, idx) => idx !== i)); }
  function updateRecipient(i: number, field: keyof DocumentRecipient, value: string) {
    setRecipients((r) => r.map((rec, idx) => idx === i ? { ...rec, [field]: value } : rec));
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sendDocument(doc.id, recipients);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.documents.sendError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{t.documents.sendTitle}</h2>
          <button type="button" onClick={onClose} title={t.common.cancel}
            className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-gray-500 -mt-2">{doc.title}</p>

        <form onSubmit={handleSend} className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">{t.documents.recipients}</label>
              <button type="button" onClick={addRecipient}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium">{t.common.add}</button>
            </div>
            {recipients.map((rec, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input type="text" required placeholder={t.documents.namePh}
                  value={rec.name} onChange={(e) => updateRecipient(i, 'name', e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <input type="email" required placeholder={t.documents.emailPh}
                  value={rec.email} onChange={(e) => updateRecipient(i, 'email', e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                {recipients.length > 1 && (
                  <button type="button" onClick={() => removeRecipient(i)} title={t.common.delete}
                    className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              {t.common.cancel}
            </button>
            <button type="submit" disabled={busy}
              className="flex-1 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-60">
              {busy ? t.common.sending : t.common.send}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── bulk-edit modal ────────────────────────────────────────────────────── */

type BulkOp = 'stateChange' | 'typeChange' | 'archive';

function BulkEditModal({
  selectedIds, onClose, onDone,
}: {
  selectedIds: string[];
  onClose: () => void;
  onDone: (affected: number) => void;
}) {
  const t = useT();
  const [op, setOp] = useState<BulkOp>('stateChange');
  const [stateVal, setStateVal] = useState<DocStateKey>('generated');
  const [typeVal, setTypeVal] = useState<DocTypeKey>('custom');
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildPatch = (): DocumentBulkPatch | null => {
    switch (op) {
      case 'stateChange':
        return { state: stateVal };
      case 'typeChange':
        return { type: typeVal };
      case 'archive':
        // Az archive = state→superseded (state-machine: GENERATED|SENT→SUPERSEDED).
        // A DRAFT-eket NEM állítja át — a backend bulk-update szilárdan eldobja, ha
        // a transition nem érvényes a state-machine szerint. A frontend értesít.
        return { state: 'superseded' };
    }
  };

  const handleApply = async () => {
    const patch = buildPatch();
    if (!patch) { setError(t.documents.bulk.errorToast); return; }
    if (!confirming) { setConfirming(true); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await bulkUpdateDocuments(selectedIds, patch);
      onDone(result.affected);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? t.documents.bulk.errorToast));
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-2">{t.documents.bulk.modalTitle}</h2>
        <p className="text-sm text-gray-500 mb-4">{t.documents.bulk.modalHint}</p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t.documents.bulk.opLabel}</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={op}
              onChange={(e) => { setOp(e.target.value as BulkOp); setConfirming(false); setError(null); }}
            >
              <option value="stateChange">{t.documents.bulk.ops.stateChange}</option>
              <option value="typeChange">{t.documents.bulk.ops.typeChange}</option>
              <option value="archive">{t.documents.bulk.ops.archive}</option>
            </select>
          </div>

          {op === 'stateChange' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.documents.bulk.stateLabel}</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={stateVal}
                onChange={(e) => setStateVal(e.target.value as DocStateKey)}
              >
                {DOCUMENT_STATES.map((s) => (
                  <option key={s} value={s}>
                    {(t.documents.stateLabels as Record<string, string>)[s] ?? s}
                  </option>
                ))}
              </select>
            </div>
          )}
          {op === 'typeChange' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.documents.bulk.typeLabel}</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={typeVal}
                onChange={(e) => setTypeVal(e.target.value as DocTypeKey)}
              >
                {DOCUMENT_TYPES.map((tp) => (
                  <option key={tp} value={tp}>
                    {(t.documents.typeLabels as Record<string, string>)[tp] ?? tp}
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
              <p className="font-medium">{t.documents.bulk.confirmTitle}</p>
              <p>{t.documents.bulk.confirmText(selectedIds.length)}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button"
            onClick={() => { if (confirming) { setConfirming(false); } else { onClose(); } }}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            {t.documents.bulk.cancelBtn}
          </button>
          <button type="button" onClick={handleApply} disabled={loading}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {loading ? t.documents.bulk.applying : t.documents.bulk.applyBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── linked-entity link cell ────────────────────────────────────────────── */

function LinkedEntityCell({ doc, projectNameMap }: {
  doc: Document;
  projectNameMap: Record<string, string>;
}) {
  const t = useT();
  // Az első non-null FK-t mutatjuk (priority: project > customer > deal > contract > work-order > invoice).
  if (doc.projectId) {
    return (
      <Link href={`/projects/${doc.projectId}`}
        className="text-brand-600 hover:underline truncate inline-flex items-center gap-1">
        <span className="text-xs text-gray-400">{t.documents.linkedProject}:</span>
        <span className="truncate">{projectNameMap[doc.projectId] ?? doc.projectId.slice(0, 8) + '…'}</span>
      </Link>
    );
  }
  if (doc.customerId) {
    return (
      <Link href={`/customers/${doc.customerId}`} className="text-brand-600 hover:underline">
        {t.documents.linkedCustomer}
      </Link>
    );
  }
  if (doc.dealId) {
    return (
      <Link href={`/crm`} className="text-brand-600 hover:underline">
        {t.documents.linkedDeal}
      </Link>
    );
  }
  if (doc.contractId) {
    return (
      <Link href={`/contracts/${doc.contractId}`} className="text-brand-600 hover:underline">
        {t.documents.linkedContract}
      </Link>
    );
  }
  if (doc.workOrderId) {
    return (
      <Link href={`/work-orders/${doc.workOrderId}`} className="text-brand-600 hover:underline">
        {t.documents.linkedWorkOrder}
      </Link>
    );
  }
  if (doc.invoiceId) {
    return (
      <Link href={`/invoices/${doc.invoiceId}`} className="text-brand-600 hover:underline">
        {t.documents.linkedInvoice}
      </Link>
    );
  }
  return <span className="text-xs text-gray-300">—</span>;
}

/* ─── action buttons cell ────────────────────────────────────────────────── */

function RowActions({
  doc, onAction,
}: { doc: Document; onAction: (id: string, action: 'generate' | 'send') => void }) {
  const t = useT();
  return (
    <div className="flex items-center justify-end gap-2">
      {doc.state === 'draft' && (
        <button type="button" onClick={() => onAction(doc.id, 'generate')}
          title={t.documents.generateBtn}
          className="text-gray-400 hover:text-brand-600 transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      )}
      {doc.state === 'generated' && (
        <button type="button" onClick={() => onAction(doc.id, 'send')}
          title={t.documents.sendBtn}
          className="text-gray-400 hover:text-green-600 transition">
          <Send className="w-4 h-4" />
        </button>
      )}
      {doc.state !== 'draft' && (
        <button type="button" onClick={() => downloadDocument(doc.id)}
          title={t.documents.pdfBtn}
          className="text-gray-400 hover:text-gray-700 transition">
          <Download className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/* ─── főoldal ───────────────────────────────────────────────────────────── */

export default function DocumentsPage() {
  const t = useT();
  const { projects } = useProjects();
  const { currentUser } = useCurrentUser();

  // ── search ──
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // ── filters + segments ──
  const [filters, setFilters] = useState<FilterState>({});
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  const [sortField, setSortField] = useState<'title' | 'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [perPage, setPerPage] = useState<PerPage>(25);
  const [page, setPage] = useState(1);

  // ── bulk-edit state ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [sendTarget, setSendTarget] = useState<Document | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // ── custom segments state ──
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

  const { documents, total, isLoading, mutate } = useDocuments({
    take: perPage,
    skip: (page - 1) * perPage,
    search: debouncedSearch || undefined,
    state: filters.state,
    type: filters.type,
    projectId: filters.projectId,
    customerId: filters.customerId,
    dealId: filters.dealId,
    contractId: filters.contractId,
    workOrderId: filters.workOrderId,
    invoiceId: filters.invoiceId,
  });

  // client-side szegmens-szűrés (recentDraftsDays/pendingSendDays/mineAuthored/supersededLastQuarter)
  const segmentFiltered = useMemo(
    () => applyClientSegment(documents, filters, currentUser?.id),
    [documents, filters, currentUser?.id],
  );

  // Sortolás kliens-szintű — a backend default DESC createdAt-szal jön.
  const sorted = useMemo(() => [...segmentFiltered].sort((a, b) => {
    let va: string | number;
    let vb: string | number;
    switch (sortField) {
      case 'title':     va = a.title ?? ''; vb = b.title ?? ''; break;
      case 'createdAt': va = a.createdAt;   vb = b.createdAt;   break;
      default:          va = ''; vb = '';
    }
    return sortDir === 'asc'
      ? String(va).localeCompare(String(vb), 'hu')
      : String(vb).localeCompare(String(va), 'hu');
  }), [segmentFiltered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageWindow = buildPageWindow(page, totalPages);
  const loadedLabel = t.documents.subtitleLoaded(sorted.length, total);
  const activeFilterCount = countActiveFilters(filters);

  // ── selection helpers ──
  const allOnPageSelected = sorted.length > 0 && sorted.every((d) => selectedIds.has(d.id));
  const someOnPageSelected = sorted.some((d) => selectedIds.has(d.id));

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      const next = new Set(selectedIds);
      sorted.forEach((d) => next.delete(d.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      sorted.forEach((d) => next.add(d.id));
      setSelectedIds(next);
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // ── segment helpers ──
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
      setToast(t.documents.segments.saveOk);
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

  // szabad-szerkesztés detektálása → activeSegmentId reset
  useEffect(() => {
    if (!activeSegmentId) return;
    const [kind, id] = activeSegmentId.split(':');
    let target: FilterState | undefined;
    if (kind === 'predefined') target = PREDEFINED_SEGMENT_FILTERS[id as PredefinedSegmentId];
    else target = customSegments.find((s) => s.id === id)?.filters;
    if (!target || !filterStateEqual(filters, target)) setActiveSegmentId(null);
  }, [filters, activeSegmentId, customSegments]);

  // sorrend-handler
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  // per-row gyorsművelet
  const handleRowAction = async (id: string, action: 'generate' | 'send') => {
    if (action === 'generate') {
      try { await generateDocument(id); await mutate(); } catch {/* toast nélkül — generate async */}
    } else if (action === 'send') {
      const doc = sorted.find((d) => d.id === id);
      if (doc) setSendTarget(doc);
    }
  };

  const projectNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach((p) => { m[p.id] = p.name; });
    return m;
  }, [projects]);

  return (
    <div className="space-y-6">
      {/* Sub-navigation tabs */}
      <div data-tour="documents-subtabs" className="flex gap-1 border-b border-gray-200 -mb-2">
        <span className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 border-brand-600 text-brand-700">
          <FileText className="w-4 h-4" /> {t.documents.title}
        </span>
        <Link href="/uploads"
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          <Upload className="w-4 h-4" /> {t.uploads?.title ?? 'Feltöltések'}
        </Link>
        <Link href="/shares"
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          <Share2 className="w-4 h-4" /> {t.shares?.title ?? 'Megosztások'}
        </Link>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.documents.title}</h1>
          <p className="text-gray-500 mt-1">{loadedLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Drag-drop link a feltöltésre — gyorslink, nem natív DnD */}
          <Link href="/uploads/new"
            className="flex items-center gap-2 border border-dashed border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
            <Upload className="w-4 h-4" />
            {t.uploads?.title ?? 'Feltöltés'}
          </Link>
          <button type="button" onClick={() => setShowCreate(true)}
            disabled={projects.length === 0}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-brand-700 transition disabled:opacity-50">
            <Plus className="w-4 h-4" />
            {t.documents.newBtn}
          </button>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* ─── Sidebar — szegmensek ──────────────────────────────────────── */}
        <aside className="hidden lg:block w-60 shrink-0 sticky top-4 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
              {t.documents.segments.title}
            </h2>
            <button type="button" onClick={handleClearFilters}
              className={clsx('w-full text-left px-2 py-1.5 rounded text-sm',
                activeSegmentId === null && activeFilterCount === 0
                  ? 'bg-brand-50 text-brand-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50',
              )}>
              {t.documents.segments.all}
            </button>
            {(['recentDrafts', 'pendingSend', 'mineAuthored', 'supersededLastQuarter'] as PredefinedSegmentId[]).map((id) => (
              <button key={id} type="button" onClick={() => applyPredefined(id)}
                className={clsx('w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2',
                  activeSegmentId === `predefined:${id}`
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50',
                )}>
                <Bookmark className="w-3.5 h-3.5 opacity-60" />
                <span className="flex-1 truncate">{t.documents.segments.predefined[id]}</span>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
              {t.documents.segments.custom}
            </h2>
            {customSegments.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-1.5">{t.documents.segments.emptyCustom}</p>
            ) : (
              customSegments.map((seg) => (
                <div key={seg.id}
                  className={clsx('group flex items-center gap-1 px-2 py-1.5 rounded',
                    activeSegmentId === `custom:${seg.id}`
                      ? 'bg-brand-50 text-brand-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50',
                  )}>
                  <button type="button" onClick={() => applyCustom(seg)}
                    className="flex-1 text-left text-sm truncate" title={seg.name}>
                    {seg.name}
                  </button>
                  <button type="button" onClick={() => handleDeleteSegment(seg.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition"
                    title={t.documents.segments.deleteBtn}>
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
                      placeholder={t.documents.segments.savePh}
                      value={segmentNameInput}
                      onChange={(e) => setSegmentNameInput(e.target.value)}
                      maxLength={50} autoFocus />
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
                    + {t.documents.segments.saveBtn}
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
                placeholder={t.documents.searchPh}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <select aria-label={t.documents.colState}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
              value={filters.state ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value || undefined }))}>
              <option value="">{t.documents.stateFilterAll}</option>
              {DOCUMENT_STATES.map((s) => (
                <option key={s} value={s}>
                  {(t.documents.stateLabels as Record<string, string>)[s] ?? s}
                </option>
              ))}
            </select>
            <select aria-label={t.documents.colType}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
              value={filters.type ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value || undefined }))}>
              <option value="">{t.documents.typeFilterAll}</option>
              {DOCUMENT_TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {(t.documents.typeLabels as Record<string, string>)[tp] ?? tp}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setShowMoreFilters((s) => !s)}
              className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border',
                activeFilterCount > 2 || showMoreFilters
                  ? 'border-brand-400 text-brand-700 bg-brand-50'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50',
              )}>
              <Filter className="w-3.5 h-3.5" />
              {t.customers.filters.moreFilters}
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs text-gray-500" htmlFor="docs-per-page">{t.documents.perPageLabel}</label>
              <select id="docs-per-page"
                className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-600"
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value) as PerPage)}>
                {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {/* Bővített szűrők — projekt dropdown a per-project-szűrőhöz */}
          {showMoreFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t.documents.linkedProject}</label>
                <select
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white"
                  value={filters.projectId ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, projectId: e.target.value || undefined }))}>
                  <option value="">{t.documents.projectFilterAll}</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button type="button" onClick={handleClearFilters}
                  disabled={activeFilterCount === 0}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40 flex items-center gap-1">
                  <X className="w-3.5 h-3.5" />
                  {t.documents.clearFilters}
                </button>
              </div>
            </div>
          )}

          {/* Bulk-select bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 bg-brand-50 border border-brand-200 rounded-lg px-4 py-2.5">
              <span className="text-sm text-brand-800 font-medium">
                {t.documents.bulk.selectedCount(selectedIds.size)}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowBulkModal(true)}
                  className="bg-brand-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-brand-700">
                  {t.documents.bulk.actionBtn}
                </button>
                <button type="button" onClick={() => setSelectedIds(new Set())}
                  className="text-sm text-brand-700 hover:text-brand-900 px-2 py-1">
                  {t.documents.bulk.clear}
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
                    <input type="checkbox" className="rounded"
                      checked={allOnPageSelected}
                      ref={(el) => { if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected; }}
                      onChange={toggleSelectAll}
                      aria-label="Összes kijelölése" />
                  </th>
                  {([
                    { label: t.documents.colTitle,   field: 'title' as const },
                    { label: t.documents.colState,   field: null },
                    { label: t.documents.colType,    field: null },
                    { label: t.documents.colLinked,  field: null },
                    { label: t.documents.colCreated, field: 'createdAt' as const },
                    { label: t.documents.colActions, field: null },
                  ]).map(({ label, field }, idx) => (
                    <th key={`${label}-${idx}`}
                      className={clsx(
                        'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide',
                        field && 'cursor-pointer hover:text-gray-700 select-none',
                      )}
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
                      {[...Array(7)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                      {searchInput || activeFilterCount > 0
                        ? t.documents.empty
                        : t.documents.emptyDocs}
                    </td>
                  </tr>
                ) : sorted.map((doc) => (
                  <tr key={doc.id}
                    className={clsx('hover:bg-gray-50',
                      selectedIds.has(doc.id) && 'bg-brand-50/40',
                    )}>
                    <td className="px-3 py-3">
                      <input type="checkbox" className="rounded"
                        checked={selectedIds.has(doc.id)}
                        onChange={() => toggleSelectOne(doc.id)}
                        aria-label={`${doc.title} kijelölése`} />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/documents/${doc.id}`}
                        className="font-medium text-gray-900 hover:text-brand-600 transition truncate inline-block max-w-xs"
                        title={doc.title}>
                        {doc.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full',
                        DOCUMENT_STATE_STYLES[doc.state] ?? 'bg-gray-100 text-gray-600')}>
                        {(t.documents.stateLabels as Record<string, string>)[doc.state] ?? doc.state}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {(t.documents.typeLabels as Record<string, string>)[doc.type] ?? doc.type}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs">
                      <LinkedEntityCell doc={doc} projectNameMap={projectNameMap} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(doc.createdAt).toLocaleDateString('hu-HU')}
                    </td>
                    <td className="px-4 py-3">
                      <RowActions doc={doc} onAction={handleRowAction} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 0 && totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
                {t.documents.prev}
              </button>
              {pageWindow.map((p, i) => p === 'ellipsis' ? (
                <span key={`e-${i}`} className="px-2 text-gray-400">…</span>
              ) : (
                <button key={p} type="button" onClick={() => setPage(p)}
                  className={clsx('min-w-8 px-2.5 py-1.5 rounded text-sm font-medium',
                    p === page ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100',
                  )}
                  aria-label={t.documents.page(p)}
                  aria-current={p === page ? 'page' : undefined}>
                  {p}
                </button>
              ))}
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed">
                {t.documents.next}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateDocumentModal
          projects={projects}
          onClose={() => setShowCreate(false)}
          onSuccess={() => mutate()}
        />
      )}
      {sendTarget && (
        <SendModal
          doc={sendTarget}
          onClose={() => setSendTarget(null)}
          onSuccess={() => { setSendTarget(null); mutate(); }}
        />
      )}
      {showBulkModal && (
        <BulkEditModal
          selectedIds={Array.from(selectedIds)}
          onClose={() => setShowBulkModal(false)}
          onDone={(affected) => {
            setToast(t.documents.bulk.successToast(affected));
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
