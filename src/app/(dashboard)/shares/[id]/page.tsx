'use client';

/**
 * Sprint 4 β₁: Share detail page.
 * ────────────────────────────────────────────────────────────────────────────
 * 4 tab: Overview / Access-log / Linked-resource / Audit-timeline.
 *
 *  - Overview: token (copy button), scope, resourceId, status, expiresAt,
 *    maxUses, useCount, createdBy, password-protected flag.
 *  - Access-log: timeline of accessLog JSONB entries (timestamp + IP) a backend
 *    `/shares/:id/access-log` endpointról. IP-geolocation placeholder — egy
 *    későbbi MaxMind/ipapi dep tölti fel a `country/city/region` mezőket.
 *  - Linked-resource: deep-link a scope-hoz illő detail-page-re.
 *  - Audit-timeline: <AuditTimeline resource="share_link" resourceId={id} /> —
 *    a backend `share.created/accessed/revoked/bulk_revoked/expired/access.denied`
 *    action-okat ír a `share_link` resource-re.
 */

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { clsx } from 'clsx';
import {
  ArrowLeft, Share2, Copy, CheckCheck, Trash2, Globe, Activity,
  Eye, Link2, Lock, AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useShares, revokeShare, type ShareLink } from '@/lib/hooks/use-shares';
import { useT } from '@/lib/hooks/use-t';
import { AuditTimeline } from '@/components/audit/AuditTimeline';
import {
  SHARE_STATUS_STYLES, SHARE_SCOPE_STYLES, type ShareStatusKey, type ShareScopeKey,
} from '@/lib/share-lifecycle';

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

/* ─── derive helpers ────────────────────────────────────────────────────── */

function deriveStatus(s: ShareLink): ShareStatusKey {
  if (s.status) return s.status;
  if (s.isActive === false) return 'revoked';
  if (s.expiresAt && new Date(s.expiresAt) <= new Date()) return 'expired';
  if (s.maxUses && s.useCount >= s.maxUses) return 'expired';
  return 'active';
}

interface AccessLogEntry {
  accessedAt: string;
  ipAddress?: string;
  country?: string;
  city?: string;
  region?: string;
}

interface AccessLogResponse {
  id: string;
  accessLog: AccessLogEntry[];
}

/* ─── főkomponens ───────────────────────────────────────────────────────── */

type TabKey = 'overview' | 'accessLog' | 'linked' | 'audit';

export default function ShareDetailPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  // A backend nincs dedikált GET /shares/:id endpoint, ezért a list-cache-ből
  // (vagy egy gyors single-shot listából) keressük ki. A list-hook a Sprint 4
  // β₁ révén `revalidateOnFocus + dedupingInterval=0`, így friss adatot ad.
  const { shares, isLoading: listLoading } = useShares({ take: 1000 });
  const share = shares.find((s) => s.id === id) ?? null;

  const { data: accessData, isLoading: logLoading, mutate: mutateLog } = useSWR<AccessLogResponse>(
    id ? `/shares/${id}/access-log` : null,
    fetcher,
  );

  const [tab, setTab] = useState<TabKey>('overview');
  const [copied, setCopied] = useState<'token' | 'url' | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (listLoading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!share) {
    return (
      <div className="space-y-6 max-w-5xl">
        <Link href="/shares" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-brand-600">
          <ArrowLeft className="w-4 h-4" />
          {t.shares.detail.backToList}
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
          <p className="font-medium">{t.shares.empty}</p>
        </div>
      </div>
    );
  }

  const status = deriveStatus(share);
  const statusLabel = (t.shares.status as Record<string, string>)[status] ?? status;
  const scopeLabel = (t.shares.scope as Record<string, string>)[share.scope] ?? share.scope;

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${share.token}`;

  async function handleCopy(what: 'token' | 'url', value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  async function handleRevoke() {
    if (!share) return;
    if (!window.confirm(t.shares.detail.revokeConfirm)) return;
    setRevoking(true);
    setError(null);
    try {
      await revokeShare(share.id, share.resourceId);
      // List-cache friss, a status badge "revoked"-re ugrik a következő render-en.
      // Direkt navigálás nincs — a user a detail-oldalon marad, lát a változást.
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.shares.bulk.errorToast);
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="space-y-3">
        <Link href="/shares" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-brand-600">
          <ArrowLeft className="w-4 h-4" />
          {t.shares.detail.backToList}
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <Share2 className="w-6 h-6 text-brand-500" />
              <h1 className="text-2xl font-bold text-gray-900 truncate font-mono">
                {share.token.slice(0, 8)}…{share.token.slice(-4)}
              </h1>
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full',
                SHARE_STATUS_STYLES[status])}>
                {statusLabel}
              </span>
              <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full',
                SHARE_SCOPE_STYLES[share.scope as ShareScopeKey] ?? 'bg-gray-100 text-gray-600')}>
                {scopeLabel}
              </span>
              {share.hasPassword && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3" /> {t.shares.hasPassword}
                </span>
              )}
              <span className="text-xs text-gray-400">
                {new Date(share.createdAt).toLocaleString('hu-HU')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {status === 'active' && (
              <button type="button" onClick={handleRevoke} disabled={revoking}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50 transition disabled:opacity-60">
                <Trash2 className="w-4 h-4" />
                {revoking ? t.shares.bulk.applying : t.shares.detail.revokeBtn}
              </button>
            )}
          </div>
        </div>
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'overview',  label: t.shares.tabs.overview,  Icon: Eye      },
          { key: 'accessLog', label: t.shares.tabs.accessLog, Icon: Globe    },
          { key: 'linked',    label: t.shares.tabs.linked,    Icon: Link2    },
          { key: 'audit',     label: t.shares.tabs.audit,     Icon: Activity },
        ] as { key: TabKey; label: string; Icon: typeof Eye }[]).map(({ key, label, Icon }) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={clsx('flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition',
              tab === key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        {tab === 'overview' && (
          <OverviewTab
            share={share}
            shareUrl={shareUrl}
            statusLabel={statusLabel}
            scopeLabel={scopeLabel}
            copied={copied}
            onCopy={handleCopy}
          />
        )}
        {tab === 'accessLog' && (
          <AccessLogTab
            entries={accessData?.accessLog ?? []}
            isLoading={logLoading}
            onRefresh={() => mutateLog()}
          />
        )}
        {tab === 'linked' && (
          <LinkedTab share={share} />
        )}
        {tab === 'audit' && (
          <AuditTimeline resource="share_link" resourceId={share.id} />
        )}
      </div>
    </div>
  );
}

/* ─── Overview tab ─────────────────────────────────────────────────────── */

function OverviewTab({
  share, shareUrl, statusLabel, scopeLabel, copied, onCopy,
}: {
  share: ShareLink;
  shareUrl: string;
  statusLabel: string;
  scopeLabel: string;
  copied: 'token' | 'url' | null;
  onCopy: (what: 'token' | 'url', value: string) => void;
}) {
  const t = useT();

  return (
    <div className="space-y-5">
      {/* Token + URL */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {t.shares.detail.tokenLabel}
          </label>
          <div className="mt-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <code className="flex-1 text-xs font-mono text-gray-700 truncate">{share.token}</code>
            <button type="button" onClick={() => onCopy('token', share.token)}
              className="text-gray-400 hover:text-brand-600 transition" title={t.common.copyLink}>
              {copied === 'token' ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {t.shares.detail.urlLabel}
          </label>
          <div className="mt-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <code className="flex-1 text-xs font-mono text-gray-700 truncate">{shareUrl}</code>
            <button type="button" onClick={() => onCopy('url', shareUrl)}
              className="text-gray-400 hover:text-brand-600 transition" title={t.shares.detail.copyUrl}>
              {copied === 'url' ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Meta-grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
        <MetaField label={t.shares.detail.scopeField} value={scopeLabel} />
        <MetaField label={t.shares.detail.statusField} value={statusLabel} />
        <MetaField label={t.shares.detail.resourceField}
          value={<code className="font-mono text-xs">{share.resourceId}</code>} />
        <MetaField
          label={t.shares.detail.expiresField}
          value={share.expiresAt ? new Date(share.expiresAt).toLocaleString('hu-HU') : '—'} />
        <MetaField
          label={t.shares.detail.usesField}
          value={`${share.useCount}${share.maxUses ? ` / ${share.maxUses}` : ''}`} />
        <MetaField
          label={t.shares.detail.passwordField}
          value={share.hasPassword ? t.shares.detail.passwordYes : t.shares.detail.passwordNo} />
        <MetaField
          label={t.shares.detail.createdByField}
          value={share.createdBy ? <code className="font-mono text-xs">{share.createdBy.slice(0, 8)}…</code> : '—'} />
        <MetaField
          label={t.shares.detail.createdAtField}
          value={new Date(share.createdAt).toLocaleString('hu-HU')} />
      </div>
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

/* ─── Access-log tab ───────────────────────────────────────────────────── */

function AccessLogTab({
  entries, isLoading, onRefresh,
}: {
  entries: AccessLogEntry[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const t = useT();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 bg-gray-50 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <Globe className="w-10 h-10 mx-auto text-gray-300" />
        <p className="text-gray-600">{t.shares.detail.accessEmpty}</p>
      </div>
    );
  }

  // A legfrissebb a tetejére — a backend a tömb VÉGÉRE pusholt, ezért visszafelé.
  const reversed = [...entries].reverse();

  return (
    <ol className="space-y-2">
      {reversed.map((entry, i) => {
        // Geo-stub: ha a backend NEM ad country-t (jelenleg: never), placeholder
        // szöveg jelenik meg. Amikor MaxMind/ipapi be lesz huzalozva, a `country`
        // field kitöltődik, és a `geoDisplay` automatikusan átvált.
        const ip = entry.ipAddress ?? '';
        const geoDisplay = entry.country
          ? `${ip || t.shares.detail.accessIpUnknown} — ${entry.country}${entry.city ? `, ${entry.city}` : ''}`
          : ip
            ? t.shares.detail.accessGeoStub(ip)
            : t.shares.detail.accessIpUnknown;

        return (
          <li key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <Globe className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 truncate">{geoDisplay}</p>
              <time className="text-xs text-gray-500 font-mono"
                dateTime={typeof entry.accessedAt === 'string' ? entry.accessedAt : new Date(entry.accessedAt).toISOString()}>
                {new Date(entry.accessedAt).toLocaleString('hu-HU')}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ─── Linked-resource tab ──────────────────────────────────────────────── */

function LinkedTab({ share }: { share: ShareLink }) {
  const t = useT();

  const href = (() => {
    switch (share.scope) {
      case 'upload':     return `/uploads/${share.resourceId}`;
      case 'document':   return `/documents/${share.resourceId}`;
      case 'project':    return `/projects/${share.resourceId}`;
      case 'work_order': return `/work-orders/${share.resourceId}`;
      case 'calculator': return null;
      default:           return null;
    }
  })();

  const scopeLabel = (t.shares.scope as Record<string, string>)[share.scope] ?? share.scope;

  if (!href) {
    return (
      <div className="text-center py-12 space-y-2">
        <Link2 className="w-10 h-10 mx-auto text-gray-300" />
        <p className="text-gray-600">{t.shares.detail.linkedNone}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
        <Link2 className="w-5 h-5 text-gray-400" />
        <div className="flex-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{scopeLabel}</p>
          <Link href={href} className="text-brand-600 hover:underline font-medium font-mono text-sm">
            {share.resourceId}
          </Link>
        </div>
        <Link href={href}
          className="text-sm text-brand-600 hover:text-brand-700 font-medium">
          {t.shares.detail.linkedOpen} →
        </Link>
      </div>
    </div>
  );
}
