'use client';

/**
 * AuditTimeline (γ_infra1)
 * ────────────────────────────────────────────────────────────────────────────
 * Shared timeline component used across all 6 module detail pages
 * (customers, quotes, contracts, work-orders, invoices, projects).
 *
 * Renders a vertical timeline of audit log entries for a single resource.
 * Pulls from the `/audit/filter` endpoint (audit.controller.ts → findFiltered),
 * which returns `{ data: AuditLogEntity[], total: number }`. For legacy
 * shapes (bare array) we fall back to `Array.isArray(payload)` — defensive,
 * matches the Sprint-1 convention.
 *
 * Visuals:
 *   - vertical rail with one icon per entry (lucide-react)
 *   - actor name (userName / userEmail / userId truncated / 'rendszer')
 *   - timestamp formatted via Intl.DateTimeFormat('hu-HU') (or locale)
 *   - localised action-label via t.audit.actions[action] with `unknown(action)` fallback
 *   - optional `metadata.diff` shown in collapsible <details>
 *
 * Loading: 3 skeleton rows.
 * Empty:   single centred message from t.audit.empty.
 */

import useSWR from 'swr';
import {
  Plus,
  Pencil,
  Trash2,
  Mail,
  Check,
  X,
  Send,
  Archive,
  FileSignature,
  AlertCircle,
  ClipboardList,
  Users,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/lib/hooks/use-t';
import { useLangStore } from '@/lib/lang-store';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Audit log row as returned by the API. */
export interface AuditLogEntry {
  id: string;
  userId?: string;
  /** Optional join-time fields the API may hydrate later; we display them if present. */
  userName?: string;
  userEmail?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown> & {
    diff?:   Record<string, { before?: unknown; after?: unknown }>;
    before?: Record<string, unknown>;
    after?:  Record<string, unknown>;
  };
  createdAt: string;
}

interface FilteredResponse {
  data:  AuditLogEntry[];
  total: number;
}

export interface AuditTimelineProps {
  /** Resource type key on the backend (e.g. 'customer', 'quote', 'contract'). */
  resource:   string;
  /** Specific resource UUID. */
  resourceId: string;
  /** How many entries to load. Defaults to 50 per spec. */
  limit?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fetcher = (url: string) => apiClient.get(url).then(r => r.data);

/**
 * Defensive unwrap: prefers `{data, total}` shape (Sprint-1 convention),
 * falls back to plain array, then `{items}` just in case.
 */
function unwrap(payload: unknown): AuditLogEntry[] {
  if (Array.isArray(payload))                       return payload as AuditLogEntry[];
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    if (Array.isArray(p.data))  return p.data  as AuditLogEntry[];
    if (Array.isArray(p.items)) return p.items as AuditLogEntry[];
  }
  return [];
}

/**
 * Picks the icon + colour-class for a given action string.
 * Convention: `<resource>.<verb>` — we key off the verb (last segment).
 */
function actionVisual(action: string): { Icon: typeof Plus; iconClass: string; ringClass: string } {
  const verb = action.split('.').pop() ?? '';
  switch (verb) {
    case 'created':
      return { Icon: Plus, iconClass: 'text-green-700', ringClass: 'bg-green-100 ring-green-200' };
    case 'updated':
    case 'bulk_updated':
      return { Icon: Pencil, iconClass: 'text-blue-700', ringClass: 'bg-blue-100 ring-blue-200' };
    case 'deleted':
      return { Icon: Trash2, iconClass: 'text-red-600', ringClass: 'bg-red-100 ring-red-200' };
    case 'sent':
    case 'send':
      return { Icon: Send, iconClass: 'text-indigo-700', ringClass: 'bg-indigo-100 ring-indigo-200' };
    case 'accepted':
    case 'accept':
    case 'completed':
    case 'complete':
    case 'activated':
    case 'activate':
      return { Icon: Check, iconClass: 'text-green-700', ringClass: 'bg-green-100 ring-green-200' };
    case 'rejected':
    case 'reject':
    case 'cancel':
    case 'cancelled':
      return { Icon: X, iconClass: 'text-red-600', ringClass: 'bg-red-100 ring-red-200' };
    case 'expired':
    case 'expire':
    case 'terminated':
      return { Icon: AlertCircle, iconClass: 'text-amber-700', ringClass: 'bg-amber-100 ring-amber-200' };
    case 'archived':
    case 'archive':
      return { Icon: Archive, iconClass: 'text-yellow-700', ringClass: 'bg-yellow-100 ring-yellow-200' };
    case 'signed_off':
      return { Icon: FileSignature, iconClass: 'text-emerald-700', ringClass: 'bg-emerald-100 ring-emerald-200' };
    case 'merged':
      return { Icon: Users, iconClass: 'text-purple-700', ringClass: 'bg-purple-100 ring-purple-200' };
    default:
      // Mail-like actions (e.g. `customer.automation_sent`)
      if (verb.includes('mail') || verb.includes('email')) {
        return { Icon: Mail, iconClass: 'text-sky-700', ringClass: 'bg-sky-100 ring-sky-200' };
      }
      return { Icon: ClipboardList, iconClass: 'text-gray-500', ringClass: 'bg-gray-100 ring-gray-200' };
  }
}

/**
 * Returns the human-readable actor string. The API today exposes only
 * `userId`; if a future enrichment adds `userName`/`userEmail`, we prefer those.
 */
function formatActor(entry: AuditLogEntry, fallback: { system: string; unknown: string }): string {
  if (entry.userName)  return entry.userName;
  if (entry.userEmail) return entry.userEmail;
  if (entry.userId)    return entry.userId.slice(0, 8) + '…';
  // No userId → the entry was likely written by a cron / system action.
  // Cron entries' resource action names often signal this (e.g. `.expired`).
  const verb = entry.action.split('.').pop() ?? '';
  if (verb === 'expired' || verb.startsWith('automation_')) return fallback.system;
  return fallback.unknown;
}

/**
 * Locale → BCP-47 tag for Intl.DateTimeFormat. The app's `useLangStore`
 * exposes `hu`/`en`/`it`; we widen to full tags so Intl picks the right calendar.
 */
function localeTag(locale: string): string {
  switch (locale) {
    case 'hu': return 'hu-HU';
    case 'en': return 'en-GB';
    case 'it': return 'it-IT';
    default:   return 'hu-HU';
  }
}

/**
 * Pulls the i18n action label. If the action key is unknown, falls back to
 * `t.audit.unknown(action)` so the timeline never renders an empty entry.
 */
function actionLabel(action: string, audit: ReturnType<typeof useT>['audit']): string {
  const map = audit.actions as Record<string, string>;
  return map[action] ?? audit.unknown(action);
}

/**
 * Diff extractor. Backend usually writes either
 *   `metadata.diff = { field: { before, after } }`     (preferred)
 * or `metadata = { before: {...}, after: {...} }`      (AuditService.diff() shape)
 * We unify both into the per-field shape for rendering.
 */
function extractDiff(metadata?: AuditLogEntry['metadata']): Array<{ field: string; before?: unknown; after?: unknown }> {
  if (!metadata) return [];
  if (metadata.diff && typeof metadata.diff === 'object') {
    return Object.entries(metadata.diff).map(([field, val]) => ({
      field,
      before: (val as any)?.before,
      after:  (val as any)?.after,
    }));
  }
  if (metadata.before || metadata.after) {
    const keys = new Set([
      ...Object.keys(metadata.before ?? {}),
      ...Object.keys(metadata.after  ?? {}),
    ]);
    return Array.from(keys).map(field => ({
      field,
      before: (metadata.before as any)?.[field],
      after:  (metadata.after  as any)?.[field],
    }));
  }
  return [];
}

/**
 * Stringifies an arbitrary metadata value safely. Avoids "[object Object]".
 */
function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string')  return v;
  if (typeof v === 'number')  return String(v);
  if (typeof v === 'boolean') return v ? '✓' : '✗';
  try   { return JSON.stringify(v); }
  catch { return String(v); }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AuditTimeline({ resource, resourceId, limit = 50 }: AuditTimelineProps) {
  const t = useT();
  const { locale } = useLangStore();

  const url = `/audit/filter?resource=${encodeURIComponent(resource)}&resourceId=${encodeURIComponent(resourceId)}&limit=${limit}`;
  const { data, isLoading, error } = useSWR<FilteredResponse | AuditLogEntry[]>(
    resourceId ? url : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const entries = unwrap(data);

  // Memoise a single formatter — re-creating Intl.DateTimeFormat per row is wasteful.
  const dtf = new Intl.DateTimeFormat(localeTag(locale), {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label={t.audit.loading}>
        {[0, 1, 2].map(i => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-gray-100 ring-2 ring-gray-50 shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 bg-gray-100 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    // Soft fail — the timeline is auxiliary; never crash the parent page.
    return (
      <div className="py-8 text-center text-xs text-gray-400">
        {t.audit.empty}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        {t.audit.empty}
      </div>
    );
  }

  return (
    <ol className="relative space-y-4">
      {/* Vertical rail */}
      <div
        aria-hidden="true"
        className="absolute left-4 top-2 bottom-2 w-px bg-gray-200"
      />
      {entries.map(entry => {
        const { Icon, iconClass, ringClass } = actionVisual(entry.action);
        const diff = extractDiff(entry.metadata);
        const actor = formatActor(entry, {
          system:  t.audit.actorSystem,
          unknown: t.audit.unknownActor,
        });
        const when = dtf.format(new Date(entry.createdAt));

        return (
          <li key={entry.id} className="relative flex items-start gap-3 pl-0">
            <div className={`relative z-10 w-8 h-8 rounded-full ring-2 flex items-center justify-center shrink-0 ${ringClass}`}>
              <Icon className={`w-4 h-4 ${iconClass}`} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900">
                  {actionLabel(entry.action, t.audit)}
                </span>
                <time
                  className="text-[10px] text-gray-400 font-mono whitespace-nowrap"
                  dateTime={entry.createdAt}
                >
                  {when}
                </time>
              </div>
              <div className="text-xs text-gray-500 mt-0.5 truncate" title={actor}>
                {actor}
              </div>

              {diff.length > 0 && (
                <details className="mt-2 group">
                  <summary className="text-[11px] text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                    {t.audit.detailsToggle} · {diff.length}
                  </summary>
                  <div className="mt-1 text-[11px] font-mono bg-gray-50 rounded p-2 space-y-0.5 max-h-48 overflow-auto">
                    {diff.map(({ field, before, after }) => (
                      <div key={field} className="flex items-baseline gap-1 flex-wrap">
                        <span className="text-gray-400">{field}:</span>
                        {before !== undefined && (
                          <span className="text-red-500 line-through">
                            {fmtValue(before)}
                          </span>
                        )}
                        {after !== undefined && (
                          <span className="text-green-700">
                            {fmtValue(after)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default AuditTimeline;
