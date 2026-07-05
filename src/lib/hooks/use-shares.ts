// Sprint 4 β₁ — paginated useShares + revalidateShareScope.
//
// A customers / uploads precedensre építünk: szerver-oldali pagináció
// (take/skip), szerver-oldali szűrők (status / scope / search), SWR
// dedupingInterval=0, revalidateOnFocus + keepPreviousData.
//
// A `revalidateShareScope` minden /shares* SWR-kulcsot invalidál, és
// opcionálisan a kapcsolt erőforrás (/uploads/:id, /documents/:id) cache-ét
// is — egy revoke / create egyszerre érintheti a Shares-listát és a
// Document-/Upload-detail "linked shares" paneljét.

import useSWR, { mutate as swrMutate } from 'swr';
import { apiClient } from '../api-client';
import type { ShareScopeKey, ShareStatusKey } from '../share-lifecycle';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShareLink {
  id: string;
  token: string;
  scope: ShareScopeKey;
  resourceId: string;
  createdBy?: string;
  status?: ShareStatusKey;
  expiresAt?: string;
  maxUses?: number;
  useCount: number;
  /**
   * Legacy backwards-compat: a Sprint 3 wire-payload `isActive` booleant adott;
   * a Sprint 4 már `status` (ACTIVE/REVOKED/EXPIRED) enum-mal megy. A FE
   * kód mindkettőt elfogadja — ha hiányzik a `status`, az `isActive` adja
   * meg a "revoked" boolean-t.
   */
  isActive?: boolean;
  hasPassword?: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface ShareListResponse {
  items: ShareLink[];
  total: number;
  take: number;
  skip: number;
}

export interface UseSharesOptions {
  status?: ShareStatusKey;
  scope?: ShareScopeKey;
  search?: string;
  take?: number;
  skip?: number;
  /**
   * A custom-szegmens vagy predefined-szegmens id-ja (informatív, NEM küldjük
   * a backendnek — a szűrőértékek a többi mezőből összeállnak).
   */
  segmentId?: string | null;
}

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Paginated server-side szűrt shares-lista.
 *
 * Backwards-compat: a `useShares()` parameter nélküli hívás a Sprint 3-as
 * "minden megosztás" viselkedést adja (take=500, nincs szűrő). Ezzel a
 * shares/page.tsx korábbi verziója + a Document-detail "linked shares"
 * panel hívása nem törik.
 */
export function useShares(opts: UseSharesOptions = {}) {
  const take = opts.take ?? 500;
  const skip = opts.skip ?? 0;

  const params = new URLSearchParams();
  params.set('take', String(take));
  if (skip > 0) params.set('skip', String(skip));
  if (opts.search && opts.search.trim()) params.set('search', opts.search.trim());
  if (opts.status) params.set('status', opts.status);
  if (opts.scope) params.set('scope', opts.scope);

  const key = `/shares?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<
    ShareListResponse | ShareLink[]
  >(
    key,
    fetcher,
    {
      dedupingInterval: 0,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );

  // Defenzív: a backend `{ items, total, take, skip }` shape-et küldi, de
  // egy korábbi (Sprint 3) verzió tömböt adott vissza — a fallback megóv
  // a runtime `g.find is not a function` hibától.
  const items: ShareLink[] = Array.isArray(data)
    ? data
    : (data?.items ?? []);
  const total: number = Array.isArray(data)
    ? data.length
    : (data?.total ?? 0);

  return {
    shares: items,
    items,
    total,
    error,
    isLoading,
    mutate,
  };
}

/**
 * Egy konkrét megosztás-link adatai (detail-page-en). Endpoint:
 * a backend `GET /shares` paginated listájából keresünk ki id alapján —
 * dedikált `/shares/:id` GET nincs. A list-hook lapozott eredményt ad,
 * így ez a hook a SWR cache-ből rántja ki az elemet, vagy egy szűrt
 * count=1 listából.
 *
 * Ha a backend később dedikált `/shares/:id` endpoint-ot kap, csak ezt
 * a függvényt kell áthuzalozni; a caller-ek nem érintettek.
 */
export function useShare(id: string | null) {
  // A backend nincs dedikált GET /shares/:id endpoint, de az access-log
  // endpoint id-alapú — ezt használjuk a sima detail-fetch helyett, mert
  // ez biztosítja a tenant-checket is.
  const { data, error, isLoading, mutate } = useSWR<{
    id: string;
    accessLog: Array<{
      accessedAt: string;
      ipAddress?: string;
      country?: string;
      city?: string;
      region?: string;
    }>;
  }>(
    id ? `/shares/${id}/access-log` : null,
    fetcher,
  );
  return { accessLog: data?.accessLog ?? [], error, isLoading, mutate };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Minden /shares* SWR-kulcsot, és opcionálisan a kapcsolt erőforrás-detail
 * cache-eket is invalidál.
 *
 *  - Az általános `/shares` prefix-match az összes lapozott / szűrt list-cache-t
 *    újrafetcheli (különböző take/skip/search variánsok).
 *  - Ha `shareId` van, a `/shares/:id/access-log` is invalid (a revoke utáni
 *    detail-page friss adatot kap).
 *  - Ha `resourceId` van (és scope upload/document), a kapcsolt erőforrás
 *    "linked shares" paneljét is frissítjük.
 */
export function revalidateShareScope(opts: {
  shareId?: string;
  resourceId?: string;
} = {}) {
  void swrMutate(
    (key) => typeof key === 'string' && key.startsWith('/shares'),
    undefined,
    { revalidate: true },
  );
  if (opts.shareId) {
    void swrMutate(`/shares/${opts.shareId}/access-log`);
  }
  if (opts.resourceId) {
    void swrMutate(`/uploads/${opts.resourceId}`);
    void swrMutate(`/documents/${opts.resourceId}`);
  }
}

export async function createShare(params: {
  scope: string;
  resourceId: string;
  expiresInHours?: number;
  maxUses?: number;
  password?: string;
}): Promise<ShareLink> {
  const res = await apiClient.post('/shares', params);
  revalidateShareScope({ resourceId: params.resourceId });
  return res.data;
}

export async function revokeShare(id: string, resourceId?: string): Promise<void> {
  await apiClient.delete(`/shares/${id}`);
  revalidateShareScope({ shareId: id, resourceId });
}

/**
 * Tömeges visszavonás — a backend egyetlen tranzakcióban REVOKED-re állít,
 * audit-log-ot ír, és visszaadja az érintett (ténylegesen revoked-elt)
 * sorok számát.
 */
export async function bulkRevokeShares(ids: string[]): Promise<{ affected: number }> {
  const res = await apiClient.post('/shares/bulk-revoke', { ids });
  revalidateShareScope();
  return res.data;
}
