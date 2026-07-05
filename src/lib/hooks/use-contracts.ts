/**
 * Boost Sprint 2 — β₂: szerződés-modul dedikált SWR-hook + mutáció-réteg.
 *
 * Eddig a `/contracts` lista-oldal inline `apiClient.get`-tel kérdezte le a
 * szerződéseket, lapozás/keresés/szűrés nélkül. Ez a hook a customer-mintát
 * követi (apps/web/src/lib/hooks/use-crm.ts → useCustomers):
 *  - server-side pagination ({ items, total, take, skip } shape kibontás, with
 *    Array.isArray fallback a legacy tömb-callerekre);
 *  - search + state + customerId + projectId + tag + includeInactive params;
 *  - predikátum-alapú SWR-cache invalidálás minden POST/PATCH/DELETE után —
 *    a contracts/[id] detail és lista oldal egyazon mutate-ből frissül.
 *
 * A backend response shape-jét a contracts.controller.ts `findAll` adja
 * (Boost Sprint 1 — A): { items, total, take, skip }.
 */
import useSWR, { mutate as swrMutate } from 'swr';
import { apiClient } from '../api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * A backend ContractState enum kanonikus értékei. A storage-shape kisbetűs
 * ('draft'|'active'|'expired'|'terminated') — egységes a customer-lifecycle-style
 * konvencióval, és kompatibilis a `@/lib/contract-lifecycle` CONTRACT_STATES-szel.
 */
export type ContractListState = 'draft' | 'active' | 'expired' | 'terminated';

/**
 * Lista-elem shape. Csak azokat a mezőket exportáljuk, amelyeket a lista-oldal
 * táblázata megjelenít — a detail-oldal a `useContract(id)` hook-on keresztül a
 * teljes entitást kéri le.
 */
export interface ContractListItem {
  id: string;
  contractNumber: string;
  title: string;
  description?: string;
  state: ContractListState;
  value?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  signedAt?: string;
  terminatedAt?: string;
  terminatedReason?: string;
  projectId?: string;
  customerId?: string;
  isActive: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Detail-shape — a backend `GET /contracts/:id` teljes entitást ad vissza.
 * A list-item mezők + minden további meta (generatedStorageKey, createdBy stb.)
 */
export interface ContractDetail extends ContractListItem {
  generatedStorageKey?: string;
  createdBy?: string;
}

interface UseContractsOptions {
  state?: string;
  customerId?: string;
  projectId?: string;
  tag?: string;
  search?: string;
  take?: number;
  skip?: number;
  includeInactive?: boolean;
}

interface ContractListResponse {
  items: ContractListItem[];
  total: number;
  take: number;
  skip: number;
}

// ─── Fetcher ─────────────────────────────────────────────────────────────────

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

// ─── SWR invalidálás ─────────────────────────────────────────────────────────

/**
 * Predikátum-alapú SWR-cache invalidálás minden contract-mutáció után.
 * - A contract-lista (paginated, sokféle szűrő-kombináció) `/contracts?...` kulcson
 *   él — prefix-match-tel egyszerre dobjuk az összes variánst.
 * - A detail-oldal `/contracts/:id` kulcson — ha contractId ismert, pontos invalidálás.
 * - A kapcsolódó customer-summary (`/customers/:id/summary`) is elavult (a
 *   recentContracts blokk frissül), ha customerId ismert.
 * - A projekt-summary szerződés-szekciója (`/projects/:id/summary` ha létezik) is
 *   elavul, hasonlóképpen.
 * - Egy quote-ból generált contract elavítja a forrás-quote summary-jét is
 *   (`/quotes/:id` — Sprint 1-ben ez nem volt revalidálva inline).
 */
export function revalidateContractScope(scope: {
  contractId?: string;
  customerId?: string;
  quoteId?: string;
  projectId?: string;
} = {}): void {
  // Lista-kulcsok (paginated): /contracts?take=...&skip=...&search=...
  void swrMutate(
    (key) => typeof key === 'string' && key.startsWith('/contracts'),
    undefined,
    { revalidate: true },
  );
  if (scope.contractId) {
    void swrMutate(`/contracts/${scope.contractId}`);
  }
  if (scope.customerId) {
    void swrMutate(`/customers/${scope.customerId}/summary`);
    void swrMutate(`/contracts/customer/${scope.customerId}`);
  }
  if (scope.quoteId) {
    void swrMutate(`/quotes/${scope.quoteId}`);
  }
  if (scope.projectId) {
    void swrMutate(`/contracts/project/${scope.projectId}`);
  }
}

// ─── List hook ───────────────────────────────────────────────────────────────

/**
 * Server-side paginated contract-lista.
 *
 * A backend response objektum-paginated: { items, total, take, skip }. Az
 * `Array.isArray` fallback ágy biztosítja, hogy egy korábbi tömb-shape (proxy
 * vagy CDN köztes verzió) NE rontsa el a UI-t — defenzív, ahogy a useCustomers-nél.
 */
export function useContracts(opts: UseContractsOptions = {}) {
  const params = new URLSearchParams();
  params.set('includeInactive', String(opts.includeInactive ?? false));
  if (opts.take != null) params.set('take', String(opts.take));
  if (opts.skip != null) params.set('skip', String(opts.skip));
  if (opts.search && opts.search.trim()) params.set('search', opts.search.trim());
  if (opts.state) params.set('state', opts.state);
  if (opts.customerId) params.set('customerId', opts.customerId);
  if (opts.projectId) params.set('projectId', opts.projectId);
  if (opts.tag) params.set('tag', opts.tag);

  const key = `/contracts?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<
    ContractListResponse | ContractListItem[]
  >(key, fetcher, {
    // Customer-precedens: POST/PATCH után azonnal friss DB-snapshot kell, a
    // dedup nélküli refresh-szel a lista-oldal nem ragad stale-be.
    dedupingInterval: 0,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  const items: ContractListItem[] = Array.isArray(data)
    ? data
    : (data?.items ?? []);
  const total: number = Array.isArray(data)
    ? data.length
    : (data?.total ?? 0);

  return {
    contracts: items,
    items,
    total,
    error,
    isLoading,
    mutate,
  };
}

// ─── Detail hook ─────────────────────────────────────────────────────────────

export function useContract(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ContractDetail>(
    id ? `/contracts/${id}` : null,
    fetcher,
  );
  return { contract: data ?? null, error, isLoading, mutate };
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export interface CreateContractDto {
  contractNumber: string;
  title: string;
  description?: string;
  projectId?: string;
  customerId?: string;
  value?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
}

export async function createContract(dto: CreateContractDto): Promise<ContractDetail> {
  const res = await apiClient.post('/contracts', dto);
  revalidateContractScope({
    contractId: res.data?.id,
    customerId: res.data?.customerId,
    projectId: res.data?.projectId,
  });
  return res.data;
}

export interface UpdateContractDto {
  title?: string;
  description?: string;
  projectId?: string;
  customerId?: string;
  value?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
}

export async function updateContract(id: string, dto: UpdateContractDto): Promise<ContractDetail> {
  const res = await apiClient.patch(`/contracts/${id}`, dto);
  revalidateContractScope({
    contractId: id,
    customerId: res.data?.customerId,
    projectId: res.data?.projectId,
  });
  return res.data;
}

export async function activateContract(id: string): Promise<ContractDetail> {
  const res = await apiClient.post(`/contracts/${id}/activate`);
  revalidateContractScope({
    contractId: id,
    customerId: res.data?.customerId,
    projectId: res.data?.projectId,
  });
  return res.data;
}

export async function expireContract(id: string): Promise<ContractDetail> {
  const res = await apiClient.post(`/contracts/${id}/expire`);
  revalidateContractScope({
    contractId: id,
    customerId: res.data?.customerId,
    projectId: res.data?.projectId,
  });
  return res.data;
}

export async function terminateContract(id: string, reason?: string): Promise<ContractDetail> {
  const res = await apiClient.post(`/contracts/${id}/terminate`, { reason });
  revalidateContractScope({
    contractId: id,
    customerId: res.data?.customerId,
    projectId: res.data?.projectId,
  });
  return res.data;
}

export async function deleteContract(id: string): Promise<void> {
  await apiClient.delete(`/contracts/${id}`);
  // A delete-válasz nem ad vissza customer/project-id-t — a teljes scope-ot
  // invalidáljuk. SWR csak a mountolt kulcsokat tölti újra.
  revalidateContractScope();
}

export async function restoreContract(id: string): Promise<ContractDetail> {
  const res = await apiClient.post(`/contracts/${id}/restore`);
  revalidateContractScope({
    contractId: id,
    customerId: res.data?.customerId,
    projectId: res.data?.projectId,
  });
  return res.data;
}

// ─── Bulk-update ──────────────────────────────────────────────────────────────

/**
 * A backend BulkPatchDto-jának 1-az-1 leképezése. Szándékosan NINCS bulk-state-
 * transition (lasd contracts.service ContractBulkPatch dokumentáció): a contract-
 * lifecycle jogi következménye miatt kötegelten nem futtatható.
 */
export interface ContractBulkPatch {
  tag?: { mode: 'add' | 'remove'; value: string };
  isActive?: boolean;
}

export interface ContractBulkUpdateResult {
  affected: number;
}

export async function bulkUpdateContracts(
  ids: string[],
  patch: ContractBulkPatch,
): Promise<ContractBulkUpdateResult> {
  const res = await apiClient.post('/contracts/bulk-update', { ids, patch });
  // Minden /contracts-kulcs (lista + detail) elavult.
  revalidateContractScope();
  return res.data;
}

// ─── PDF generálás ───────────────────────────────────────────────────────────

export async function generateContractPdf(id: string): Promise<ContractDetail> {
  const res = await apiClient.post(`/contracts/${id}/generate-pdf`);
  // A queue csak fut, de a contract entity-n action-log frissül.
  revalidateContractScope({ contractId: id });
  return res.data;
}

export async function downloadContractPdf(id: string): Promise<{ url: string }> {
  const res = await apiClient.get(`/contracts/${id}/pdf-url`);
  // A backend stringet ad vissza — wrappeljük objektumba a típus-konzisztenciaért.
  const url = typeof res.data === 'string' ? res.data : (res.data?.url ?? res.data);
  return { url };
}
