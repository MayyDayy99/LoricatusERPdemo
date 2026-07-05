'use client';

/**
 * Sprint 4 β₁: Shares list — paginated + segmented + bulk-revoke.
 * ────────────────────────────────────────────────────────────────────────────
 * A customers/page.tsx precedensét tükrözi: szerver-oldali pagináció + szűrők
 * + predefined / custom szegmensek + bulk-művelet bar.
 *
 *  - Szűrők: status (active/revoked/expired) + scope (5 enum) + token-prefix
 *    search. Mind szerver-oldal, a UI csak ezeket továbbítja a hooknak.
 *  - Szegmensek: 4 előre definiált (expiringSoon, mineCreated, highUsage,
 *    passwordProtected) + custom — `users.settings.shareSegments` JSONB.
 *    Az "expiringSoon" + "mineCreated" + "passwordProtected" szempontok
 *    NEM mind szerver-oldali; ahol nincs query-mező, client-side szűrünk
 *    (a backend nincs ehhez a 4 szempontot mind támogató API-ja, és a
 *    custom-szegmens-koncepció a customer-rel azonos: a UI-szűrőket egy
 *    user-settingsben tároljuk + visszaalkalmazzuk).
 *  - Bulk-revoke: a kijelölt aktív megosztásokat egyetlen tranzakcióban
 *    REVOKED-re állítjuk a `POST /shares/bulk-revoke` endpointon.
 *  - Table-row: token-truncated (first8…last4) + scope-badge + status-badge +
 *    expires + use-count + copy/revoke akciók.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  Plus, Share2, Trash2, Copy, CheckCheck, AlertCircle, X, Lock,
  FileText, Upload, Search, ChevronLeft, ChevronRight, Bookmark,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  useShares, createShare, revokeShare, bulkRevokeShares,
  type ShareLink,
} from '@/lib/hooks/use-shares';
import { useProjects } from '@/lib/hooks/use-projects';
import { useUploads } from '@/lib/hooks/use-uploads';
import { useDocuments } from '@/lib/hooks/use-documents';
import { useCurrentUser } from '@/lib/hooks/use-users';
import { useT } from '@/lib/hooks/use-t';
import {
  SHARE_STATUSES, SHARE_STATUS_STYLES, type ShareStatusKey,
  SHARE_SCOPES, SHARE_SCOPE_STYLES, type ShareScopeKey,
} from '@/lib/share-lifecycle';

/* ─── Constants ──────────────────────────────────────────────────────────── */

const PER_PAGE_OPTIONS = [25, 50, 100] as const;
type PerPage = typeof PER_PAGE_OPTIONS[number];

type PredefinedSegmentId =
  | 'expiringSoon'
  | 'mineCreated'
  | 'highUsage'
  | 'passwordProtected';

interface FilterState {
  status?: ShareStatusKey;
  scope?: ShareScopeKey;
}

const EMPTY_FILTERS: FilterState = {};

interface SavedSegment {
  id: string;
  name: string;
  filters: FilterState;
  /** Client-side szempontok, amik nincsenek a backend filter-DTO-ban. */
  clientFlags?: {
    expiringSoon?: boolean;
    mineCreated?: boolean;
    highUsage?: boolean;
    passwordProtected?: boolean;
  };
}

/**
 * Predefined szegmensek → (FilterState, clientFlags) párba.
 * A "mineCreated" + "passwordProtected" + "expiringSoon" client-side, mert
 * a backend filter-DTO csak status + scope + search-et fogad.
 */
const PREDEFINED_SEGMENTS: Record<
  PredefinedSegmentId,
  { filters: FilterState; clientFlags: NonNullable<SavedSegment['clientFlags']> }
> = {
  expiringSoon:      { filters: { status: 'active' }, clientFlags: { expiringSoon: true } },
  mineCreated:       { filters: {}, clientFlags: { mineCreated: true } },
  highUsage:         { filters: {}, clientFlags: { highUsage: true } },
  passwordProtected: { filters: {}, clientFlags: { passwordProtected: true } },
};

const SEGMENT_SETTING_KEY = 'shareSegments';

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

/**
 * Token-truncation: az első 8 és utolsó 4 karakter, közte ellipszis.
 * A teljes (64-hex) token visszakeresése a clipboard-másoláson keresztül.
 */
function truncateToken(token: string): string {
  if (token.length <= 16) return token;
  return `${token.slice(0, 8)}…${token.slice(-4)}`;
}

/**
 * Derivált status: a backend Sprint 4-től konkrét `status` enum-ot küld
 * (ACTIVE/REVOKED/EXPIRED), de a Sprint 3 wire-payload `isActive` boolean
 * + `expiresAt` ledered status volt. Mindkettőt elfogadjuk.
 */
function deriveStatus(s: ShareLink): ShareStatusKey {
  if (s.status) return s.status;
  // Legacy: status nélkül status = "revoked" ha isActive=false, "expired" ha lejárt.
  if (s.isActive === false) return 'revoked';
  if (s.expiresAt && new Date(s.expiresAt) <= new Date()) return 'expired';
  if (s.maxUses && s.useCount >= s.maxUses) return 'expired';
  return 'active';
}

/* ─── Create-share modal (változatlan a Sprint 3-hoz képest) ─────────────── */

function CreateShareModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const t = useT();
  const [scope, setScope] = useState<'upload' | 'project' | 'document'>('upload');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [expiresInHours, setExpiresInHours] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { projects, isLoading: projLoading } = useProjects();
  const { uploads, isLoading: uplLoading } = useUploads(
    scope === 'upload' ? (selectedProjectId || null) : null,
  );
  const { documents, isLoading: docLoading } = useDocuments(
    scope === 'document' ? (selectedProjectId || null) : null,
  );

  function handleScopeChange(newScope: 'upload' | 'project' | 'document') {
    setScope(newScope);
    setResourceId('');
    setSelectedProjectId('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createShare({
        scope,
        resourceId,
        expiresInHours: expiresInHours ? Number(expiresInHours) : undefined,
        maxUses: maxUses ? Number(maxUses) : undefined,
        password: password || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.shares.createError);
    } finally {
      setBusy(false);
    }
  }

  const selectClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:bg-gray-50 disabled:text-gray-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{t.shares.newTitle}</h2>
          <button type="button" onClick={onClose} title={t.common.cancel} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="share-scope" className="block text-sm font-medium text-gray-700 mb-1.5">{t.shares.scopeLabel}</label>
            <select id="share-scope" value={scope} onChange={(e) => handleScopeChange(e.target.value as any)}
              className={selectClass}>
              {t.shares.scopeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {scope === 'project' && (
            <div>
              <label htmlFor="share-resource" className="block text-sm font-medium text-gray-700 mb-1.5">{t.shares.resourceLabel}</label>
              <select id="share-resource" required value={resourceId} onChange={(e) => setResourceId(e.target.value)}
                disabled={projLoading} className={selectClass}>
                <option value="">{projLoading ? '…' : t.shares.selectProject}</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {(scope === 'upload' || scope === 'document') && (
            <>
              <div>
                <label htmlFor="share-project" className="block text-sm font-medium text-gray-700 mb-1.5">{t.shares.projectLabel}</label>
                <select id="share-project" value={selectedProjectId}
                  onChange={(e) => { setSelectedProjectId(e.target.value); setResourceId(''); }}
                  disabled={projLoading} className={selectClass}>
                  <option value="">{projLoading ? '…' : t.shares.selectProject}</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="share-resource" className="block text-sm font-medium text-gray-700 mb-1.5">{t.shares.resourceLabel}</label>
                <select id="share-resource" required value={resourceId} onChange={(e) => setResourceId(e.target.value)}
                  disabled={!selectedProjectId || uplLoading || docLoading} className={selectClass}>
                  <option value="">
                    {(uplLoading || docLoading) ? '…' : !selectedProjectId ? t.shares.selectProject : t.shares.selectResource}
                  </option>
                  {scope === 'upload'
                    ? uploads.filter((u) => u.state === 'available').map((u) =>
                        <option key={u.id} value={u.id}>{u.originalName || u.fileName}</option>)
                    : documents.map((d) =>
                        <option key={d.id} value={d.id}>{d.title}</option>)
                  }
                  {selectedProjectId && !uplLoading && !docLoading &&
                    (scope === 'upload' ? uploads.filter((u) => u.state === 'available') : documents).length === 0 && (
                    <option value="" disabled>{t.shares.noResources}</option>
                  )}
                </select>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="share-expires" className="block text-sm font-medium text-gray-700 mb-1.5">{t.shares.expiresLabel}</label>
              <input id="share-expires" type="number" min="1" max="168" value={expiresInHours} onChange={(e) => setExpiresInHours(e.target.value)}
                placeholder={t.shares.expiresPh}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label htmlFor="share-maxuses" className="block text-sm font-medium text-gray-700 mb-1.5">{t.shares.maxUsesLabel}</label>
              <input id="share-maxuses" type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)}
                placeholder={t.shares.maxUsesPh}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
          </div>
          <div>
            <label htmlFor="share-password" className="block text-sm font-medium text-gray-700 mb-1.5">{t.shares.passwordLabel}</label>
            <input id="share-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={128}
              placeholder={t.shares.passwordPh}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              {t.common.cancel}
            </button>
            <button type="submit" disabled={busy} className="flex-1 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-60">
              {busy ? t.common.creating : t.common.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Bulk-revoke confirm modal ──────────────────────────────────────────── */

function BulkRevokeModal({
  selectedIds,
  onClose,
  onDone,
}: {
  selectedIds: string[];
  onClose: () => void;
  onDone: (affected: number) => void;
}) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await bulkRevokeShares(selectedIds);
      onDone(result.affected);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? t.shares.bulk.errorToast));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-2">{t.shares.bulk.confirmTitle}</h2>
        <p className="text-sm text-gray-600 mb-4">{t.shares.bulk.confirmText(selectedIds.length)}</p>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            {t.shares.bulk.cancelBtn}
          </button>
          <button type="button" onClick={handleApply} disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            {loading ? t.shares.bulk.applying : t.shares.bulk.applyBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── ShareRow (table row) ───────────────────────────────────────────────── */

function ShareRow({
  share, selected, onSelect, onRevoke, onCopy,
}: {
  share: ShareLink;
  selected: boolean;
  onSelect: () => void;
  onRevoke: () => void;
  onCopy: () => void;
}) {
  const t = useT();
  const status = deriveStatus(share);
  const isActive = status === 'active';

  const scopeLabel = (t.shares.scope as Record<string, string>)[share.scope] ?? share.scope;
  const statusLabel = (t.shares.status as Record<string, string>)[status] ?? status;

  return (
    <tr className={clsx('hover:bg-gray-50', !isActive && 'opacity-60', selected && 'bg-brand-50/40')}>
      <td className="px-3 py-3">
        <input
          type="checkbox"
          className="rounded"
          checked={selected}
          onChange={onSelect}
          aria-label={`${share.token.slice(0, 8)} kijelölése`}
        />
      </td>
      <td className="px-4 py-3 font-mono text-xs">
        <Link href={`/shares/${share.id}`} className="text-gray-700 hover:text-brand-600 transition">
          {truncateToken(share.token)}
        </Link>
      </td>
      <td className="px-4 py-3">
        <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full',
          SHARE_SCOPE_STYLES[share.scope] ?? 'bg-gray-100 text-gray-600')}>
          {scopeLabel}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        <ResourceLink scope={share.scope} resourceId={share.resourceId} />
      </td>
      <td className="px-4 py-3">
        <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full',
          SHARE_STATUS_STYLES[status])}>
          {statusLabel}
        </span>
        {share.hasPassword && (
          <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-gray-500">
            <Lock className="w-3 h-3" />
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {share.expiresAt
          ? new Date(share.expiresAt).toLocaleDateString('hu-HU')
          : '—'}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {share.useCount}{share.maxUses ? `/${share.maxUses}` : ''}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onCopy}
            className="text-gray-400 hover:text-brand-600 transition" title={t.common.copyLink}>
            <Copy className="w-4 h-4" />
          </button>
          {isActive && (
            <button type="button" onClick={onRevoke}
              className="text-gray-400 hover:text-red-500 transition" title={t.common.revoke}>
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * Deep-link a scope-hoz illő detail-page-re. Calculator + work_order esetén
 * a `/work-orders/:id` ill. lokálisan nincs dedikált calculator-detail
 * (a számológép a /quotes alatt él), így a fallback a resourceId-t mutatja.
 */
function ResourceLink({ scope, resourceId }: { scope: ShareScopeKey; resourceId: string }) {
  const href = (() => {
    switch (scope) {
      case 'upload':     return `/uploads/${resourceId}`;
      case 'document':   return `/documents/${resourceId}`;
      case 'project':    return `/projects/${resourceId}`;
      case 'work_order': return `/work-orders/${resourceId}`;
      case 'calculator': return null; // nincs dedikált detail-page
      default:           return null;
    }
  })();

  const short = `${resourceId.slice(0, 8)}…`;

  if (!href) return <span className="font-mono">{short}</span>;
  return (
    <Link href={href} className="font-mono text-brand-600 hover:underline">
      {short}
    </Link>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */

export default function SharesPage() {
  const t = useT();
  const { currentUser } = useCurrentUser();

  // Search-state — kettő van, mert a beíráskor nem hívunk azonnal back-endet.
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const [filters, setFilters] = useState<FilterState>({});
  const [clientFlags, setClientFlags] = useState<NonNullable<SavedSegment['clientFlags']>>({});
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  const [perPage, setPerPage] = useState<PerPage>(25);
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── Custom segments state ──
  const [customSegments, setCustomSegments] = useState<SavedSegment[]>([]);
  const [segmentNameInput, setSegmentNameInput] = useState('');
  const [showSaveSegmentInput, setShowSaveSegmentInput] = useState(false);

  useEffect(() => {
    void loadCustomSegments().then(setCustomSegments);
  }, []);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearch, perPage, filters, clientFlags]);

  const { items, total, isLoading, mutate } = useShares({
    take: perPage,
    skip: (page - 1) * perPage,
    search: debouncedSearch || undefined,
    status: filters.status,
    scope: filters.scope,
  });

  // ── Client-side szűrés a clientFlags alapján ──
  const filtered = useMemo(() => {
    if (
      !clientFlags.expiringSoon &&
      !clientFlags.mineCreated &&
      !clientFlags.highUsage &&
      !clientFlags.passwordProtected
    ) {
      return items;
    }
    const now = Date.now();
    const in48h = now + 48 * 3600 * 1000;
    return items.filter((s) => {
      if (clientFlags.expiringSoon) {
        if (!s.expiresAt) return false;
        const exp = new Date(s.expiresAt).getTime();
        if (exp < now || exp > in48h) return false;
      }
      if (clientFlags.mineCreated) {
        if (!currentUser?.id || s.createdBy !== currentUser.id) return false;
      }
      if (clientFlags.highUsage) {
        if (s.useCount <= 50) return false;
      }
      if (clientFlags.passwordProtected) {
        if (!s.hasPassword) return false;
      }
      return true;
    });
  }, [items, clientFlags, currentUser?.id]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageWindow = buildPageWindow(page, totalPages);
  const loadedLabel = t.shares.subtitleLoaded(filtered.length, total);

  // ── Selection helpers ──
  const allOnPageSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id));
  const someOnPageSelected = filtered.some((s) => selectedIds.has(s.id));

  const toggleSelectAll = () => {
    const next = new Set(selectedIds);
    if (allOnPageSelected) {
      filtered.forEach((s) => next.delete(s.id));
    } else {
      filtered.forEach((s) => next.add(s.id));
    }
    setSelectedIds(next);
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // ── Segment helpers ──
  const applyPredefined = (id: PredefinedSegmentId) => {
    setFilters({ ...PREDEFINED_SEGMENTS[id].filters });
    setClientFlags({ ...PREDEFINED_SEGMENTS[id].clientFlags });
    setActiveSegmentId(`predefined:${id}`);
  };

  const applyCustom = (seg: SavedSegment) => {
    setFilters({ ...seg.filters });
    setClientFlags({ ...(seg.clientFlags ?? {}) });
    setActiveSegmentId(`custom:${seg.id}`);
  };

  const handleClearFilters = () => {
    setFilters({ ...EMPTY_FILTERS });
    setClientFlags({});
    setActiveSegmentId(null);
  };

  const handleSaveSegment = async () => {
    const name = segmentNameInput.trim();
    if (!name) return;
    const id = `seg-${Date.now()}`;
    const next: SavedSegment[] = [...customSegments, { id, name, filters, clientFlags }];
    setCustomSegments(next);
    setSegmentNameInput('');
    setShowSaveSegmentInput(false);
    setActiveSegmentId(`custom:${id}`);
    try {
      await saveCustomSegments(next);
      setToast(t.shares.segments.saveOk);
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

  const activeFilterCount =
    (filters.status ? 1 : 0) +
    (filters.scope ? 1 : 0) +
    Object.values(clientFlags).filter(Boolean).length;

  const handleCopy = async (share: ShareLink) => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${share.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(share.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard blocked — silently fail */
    }
  };

  const handleSingleRevoke = async (share: ShareLink) => {
    if (!window.confirm(t.shares.detail.revokeConfirm)) return;
    try {
      await revokeShare(share.id, share.resourceId);
      mutate();
    } catch {
      setToast(t.shares.bulk.errorToast);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-nav: Documents / Uploads / Shares */}
      <div className="flex gap-1 border-b border-gray-200 -mb-2">
        <Link href="/documents" className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          <FileText className="w-4 h-4" /> {t.documents?.title ?? 'Dokumentumok'}
        </Link>
        <Link href="/uploads" className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          <Upload className="w-4 h-4" /> {t.uploads?.title ?? 'Feltöltések'}
        </Link>
        <span className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 border-brand-600 text-brand-700">
          <Share2 className="w-4 h-4" /> {t.shares.title}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.shares.title}</h1>
          <p className="text-gray-500 mt-1">{loadedLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-brand-700 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            {t.shares.newBtn}
          </button>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar — szegmensek */}
        <aside className="hidden lg:block w-60 shrink-0 sticky top-4 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
              {t.shares.segments.title}
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
              {t.shares.segments.all}
            </button>
            {(['expiringSoon', 'mineCreated', 'highUsage', 'passwordProtected'] as PredefinedSegmentId[]).map((id) => (
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
                <span className="flex-1 truncate">{t.shares.segments.predefined[id]}</span>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
              {t.shares.segments.custom}
            </h2>
            {customSegments.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-1.5">{t.shares.segments.emptyCustom}</p>
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
                    title={t.shares.segments.deleteBtn}
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
                      placeholder={t.shares.segments.savePh}
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
                    + {t.shares.segments.saveBtn}
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-4">
          {/* Search + status + scope szűrők */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-400"
                placeholder={t.shares.searchPh}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <select
              aria-label={t.shares.detail.statusField}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
              value={filters.status ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value || undefined) as ShareStatusKey | undefined }))}
            >
              <option value="">{t.shares.statusAny}</option>
              {SHARE_STATUSES.map((s) => (
                <option key={s} value={s}>{(t.shares.status as Record<string, string>)[s]}</option>
              ))}
            </select>
            <select
              aria-label={t.shares.detail.scopeField}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
              value={filters.scope ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, scope: (e.target.value || undefined) as ShareScopeKey | undefined }))}
            >
              <option value="">{t.shares.scopeAny}</option>
              {SHARE_SCOPES.map((s) => (
                <option key={s} value={s}>{(t.shares.scope as Record<string, string>)[s]}</option>
              ))}
            </select>
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs text-gray-500" htmlFor="shares-per-page">{t.shares.perPageLabel}</label>
              <select
                id="shares-per-page"
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
                {t.shares.bulk.selectedCount(selectedIds.size)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(true)}
                  className="bg-red-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-red-700"
                >
                  {t.shares.bulk.revokeBtn}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-sm text-brand-700 hover:text-brand-900 px-2 py-1"
                >
                  {t.shares.bulk.clear}
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
                      ref={(el) => {
                        if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected;
                      }}
                      onChange={toggleSelectAll}
                      aria-label="Összes kijelölése"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Token</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.shares.detail.scopeField}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.shares.detail.resourceField}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.shares.detail.statusField}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.shares.detail.expiresField}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.shares.detail.usesField}</th>
                  <th className="px-4 py-3"></th>
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
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                      {searchInput || activeFilterCount > 0
                        ? t.shares.noResults
                        : t.shares.empty}
                    </td>
                  </tr>
                ) : filtered.map((s) => (
                  <ShareRow
                    key={s.id}
                    share={s}
                    selected={selectedIds.has(s.id)}
                    onSelect={() => toggleSelectOne(s.id)}
                    onRevoke={() => handleSingleRevoke(s)}
                    onCopy={() => handleCopy(s)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {copiedId && (
            <div className="text-xs text-green-600 flex items-center gap-1">
              <CheckCheck className="w-3 h-3" /> {t.common.copied}
            </div>
          )}

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
                {t.shares.prev}
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
                  aria-label={t.shares.page(p)}
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
                {t.shares.next}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {showCreate && <CreateShareModal onClose={() => setShowCreate(false)} onSuccess={() => mutate()} />}
      {showBulkModal && (
        <BulkRevokeModal
          selectedIds={Array.from(selectedIds)}
          onClose={() => setShowBulkModal(false)}
          onDone={(affected) => {
            setToast(t.shares.bulk.successToast(affected));
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
