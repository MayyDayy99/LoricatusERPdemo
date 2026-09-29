import useSWR from 'swr';
import { apiClient } from '../api-client';

export type TenderStatus =
  | 'new' | 'relevant' | 'dismissed' | 'watching' | 'bidding' | 'submitted' | 'won' | 'lost';

export interface Tender {
  id: string;
  source: string;
  sourceId: string;
  title: string;
  buyer?: string;
  buyerCountry?: string;
  cpvCodes?: string[];
  estimatedValue?: number;
  currency?: string;
  publishedAt?: string;
  deadlineAt?: string;
  documentUrl?: string;
  relevanceScore?: number;
  aiSummary?: string;
  interest?: {
    status: TenderStatus;
    note?: string;
  };
}

export interface TenderWatchProfile {
  id: string;
  name: string;
  keywords?: string[];
  cpvPrefixes?: string[];
  minValue?: number;
  maxValue?: number;
  isActive: boolean;
  lastRunAt?: string;
  /** Feed-forrás típusa: 'ted' (default) | 'rss' | 'http' | 'n8n' (custom). */
  sourceType?: string;
  /** Custom-source (rss/http) esetén a lekérendő URL. */
  sourceUrl?: string;
  countries?: string[];
  /** Nem-TED forrás beállítása: forrás-kulcs, ország, API, linkminta, részletek, szűrés. */
  sourceConfig?: {
    forrasKulcs?: string; orszag?: string; api?: 'ekr' | 'anac' | 'ocds_de' | 'plone'; linkMinta?: string; lapozasMinta?: string; maxOldal?: number;
    reszletek?: boolean; maxReszlet?: number; szures?: 'relevans' | 'mind';
    lapMeret?: number; sorLinkek?: boolean; sorLinkSablon?: string;
  } | null;
}

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

export function useTenders(params: { status?: string; search?: string; page?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  if (params.page) qs.set('page', String(params.page));

  const { data, error, isLoading, mutate } = useSWR<{
    items: Tender[];
    total: number;
    page: number;
    limit: number;
  }>(`/tenders?${qs.toString()}`, fetcher);

  return {
    tenders: data?.items ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    limit: data?.limit ?? 25,
    error,
    isLoading,
    mutate,
  };
}

export function useTenderWatchProfiles() {
  const { data, error, isLoading, mutate } = useSWR<TenderWatchProfile[]>(
    '/tenders/watch-profiles',
    fetcher,
  );
  return { profiles: data ?? [], error, isLoading, mutate };
}

/**
 * A cég MINDEN aktív figyelőprofiljának szinkronja (TED, RSS, API, weboldal,
 * e-mail) — a háttérben fut; a végén értesítés jön az összesítővel.
 */
export async function mindenSzinkron(): Promise<{ started: boolean; profiles: number; marFut?: boolean }> {
  const res = await apiClient.post('/tenders/sync', {});
  return res.data;
}

export async function syncTenders(profileId?: string): Promise<{ added: number; skipped: number }> {
  const res = await apiClient.post('/tenders/sync', profileId ? { profileId } : {}, { timeout: 300_000 });
  return res.data;
}

export async function upsertTenderInterest(
  tenderId: string,
  data: { status?: TenderStatus; note?: string; assignedTo?: string },
) {
  const res = await apiClient.put(`/tenders/${tenderId}/interest`, data);
  return res.data;
}

export async function createWatchProfile(data: Partial<TenderWatchProfile>) {
  const res = await apiClient.post('/tenders/watch-profiles', data);
  return res.data;
}

export async function updateWatchProfile(id: string, data: Partial<TenderWatchProfile>) {
  const res = await apiClient.put(`/tenders/watch-profiles/${id}`, data);
  return res.data;
}

export async function deleteWatchProfile(id: string) {
  await apiClient.delete(`/tenders/watch-profiles/${id}`);
}
