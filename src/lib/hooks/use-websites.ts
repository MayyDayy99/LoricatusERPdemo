import useSWR from 'swr';
import { apiClient } from '../api-client';

/* ── Types ────────────────────────────────────────────────────── */

export interface ClarityMetric {
  metricName: string;
  information: Array<Record<string, unknown>>;
}

export interface ClarityDaySnapshot {
  capturedDate: string;
  fetchedAt: string;
  /** { overview, byBrowser, byOS, byDevice, byCountry, byUrl } → Clarity metrikák vagy null. */
  payload: Record<string, ClarityMetric[] | null>;
}

/* ── Fetcher ──────────────────────────────────────────────────── */

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

/* ── Hooks ────────────────────────────────────────────────────── */

export function useWebsitesLatest() {
  const { data, error, isLoading, mutate } = useSWR<ClarityDaySnapshot | null>(
    '/websites/latest',
    fetcher,
  );
  return { latest: data ?? null, error, isLoading, mutate };
}

export function useWebsitesHistory(days = 30) {
  const { data, error, isLoading, mutate } = useSWR<ClarityDaySnapshot[]>(
    `/websites/history?days=${days}`,
    fetcher,
  );
  return { history: data ?? [], error, isLoading, mutate };
}

export interface SyncStatus {
  lastSyncAt: string | null;
  nextAllowedAt: string;
  canSyncNow: boolean;
  secondsUntilAllowed: number;
  limit: { requestsPerSync: number; dailyApiLimit: number; cooldownHours: number };
}

export function useWebsitesSyncStatus() {
  const { data, error, isLoading, mutate } = useSWR<SyncStatus>(
    '/websites/sync-status',
    fetcher,
    { refreshInterval: 30_000 },
  );
  return { status: data, error, isLoading, mutate };
}

export async function triggerWebsitesSync(): Promise<{ ok: boolean; capturedDate: string }> {
  const r = await apiClient.post<{ ok: boolean; capturedDate: string }>('/websites/sync-now', {});
  return r.data;
}

/* ── Summary (historikus import + napi rekordok kombinálva) ──────────────── */

export interface ClarityHistoricalImport {
  periodStartDate: string;
  periodEndDate: string;
  payload: Record<string, ClarityMetric[] | null>;
  fetchedAt: string;
}

export interface ClaritySummary {
  historicalImport: ClarityHistoricalImport | null;
  dailySnapshots: ClarityDaySnapshot[];
  totalPeriodStart: string | null;
  totalPeriodEnd: string | null;
}

export function useWebsitesSummary() {
  const { data, error, isLoading, mutate } = useSWR<ClaritySummary>(
    '/websites/summary',
    fetcher,
  );
  return { summary: data ?? null, error, isLoading, mutate };
}
