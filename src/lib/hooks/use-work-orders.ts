/**
 * use-work-orders.ts — β₃ Sprint-2 munkalap-hook (FE)
 * ────────────────────────────────────────────────────────────────────────────
 * A Sprint-1-ben a backend pagination/search/CSV-mail már megérkezett
 * `{items, total, take, skip}` shape-pel. Ez a hook adja a frontend-réteget,
 * mirror-ja a `use-crm.ts#useCustomers`-nek (gold-standard).
 *
 *  - SWR-kulcs = `/work-orders?<params>` — minden filter URL-paramba megy,
 *    így a SWR-cache automatikusan szegmentálódik filterenként.
 *  - `revalidateWorkOrderScope({…})` predicate-mutate-tel invalidálja az
 *    összes kapcsolódó kulcsot (lista + detail + task-stats + crm-tasks +
 *    project-szintű activity), hogy minden POST/PATCH/DELETE után konzisztens
 *    nézet legyen mindenhol.
 *  - Defensive unwrap: a backend `{items,total,take,skip}` shape-jét várjuk,
 *    de a régi tömb-callerek (pl. getWorkOrderForQuote a use-project-workflow-ban)
 *    miatt fallback `Array.isArray(data)` is van.
 */

import useSWR, { mutate as swrMutate } from 'swr';
import { apiClient } from '../api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Work-order list-row a (dashboard)/work-orders/page.tsx táblához.
 *  A backend a teljes entity-t adja vissza — itt csak azokat a mezőket
 *  jelöljük, amiket a UI ténylegesen olvas. */
export interface WorkOrderListItem {
  id: string;
  workOrderNumber: string;
  state: 'draft' | 'active' | 'completed' | 'archived' | 'cancelled';
  location: string;
  locationAddress?: string;
  clientCompany: string;
  deadline?: string;
  responsiblePerson?: string;
  customerId?: string;
  projectId?: string;
  quoteId?: string;
  customFields?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

interface UseWorkOrdersOptions {
  state?: WorkOrderListItem['state'];
  customerId?: string;
  projectId?: string;
  quoteId?: string;
  from?: string;
  to?: string;
  search?: string;
  take?: number;
  skip?: number;
}

interface WorkOrderListResponse {
  items: WorkOrderListItem[];
  total: number;
  take: number;
  skip: number;
}

/** β₃: bulk-patch DTO — tag a customers-mintával egyezően {mode,value}. */
export interface WorkOrderBulkPatch {
  state?: 'archived';
  tag?: { mode: 'add' | 'remove'; value: string };
  isActive?: boolean;
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Paginated/szűrhető work-order lista. A SWR-kulcs minden filter-érték
 * függvénye — váltáskor új cache-bucket-be megy. Az `items`/`total` shape
 * a Sprint-1 backend-szel egyezik.
 */
export function useWorkOrders(opts: UseWorkOrdersOptions = {}) {
  const params = new URLSearchParams();
  if (opts.state) params.set('state', opts.state);
  if (opts.customerId) params.set('customerId', opts.customerId);
  if (opts.projectId) params.set('projectId', opts.projectId);
  if (opts.quoteId) params.set('quoteId', opts.quoteId);
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  if (opts.search && opts.search.trim()) params.set('search', opts.search.trim());
  if (opts.take != null) params.set('take', String(opts.take));
  if (opts.skip != null) params.set('skip', String(opts.skip));

  const key = `/work-orders?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<
    WorkOrderListResponse | WorkOrderListItem[]
  >(key, fetcher, {
    // POST/PATCH után az `mutate()` azonnal kapjon új DB-snapshotot —
    // customers-mintával egyezően.
    dedupingInterval: 0,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  // Defensive unwrap — Sprint-1 utáni `{items,total,…}` az elsődleges, de
  // ha bárhol még csupasz tömböt adna a backend, ne csak akkor működjünk.
  const items: WorkOrderListItem[] = Array.isArray(data)
    ? data
    : (data?.items ?? []);
  const total: number = Array.isArray(data)
    ? data.length
    : (data?.total ?? 0);

  return {
    workOrders: items,
    items,
    total,
    error,
    isLoading,
    mutate,
  };
}

// ─── Revalidation helpers ─────────────────────────────────────────────────────

/**
 * Predicate-alapú SWR-invalidálás minden olyan kulcsra, ami egy work-order
 * mutáció után elavul. A spec szerint:
 *  - `/work-orders` lista-kulcs összes szegmense (URLSearchParams variánsok)
 *  - `/work-orders/:id` detail-kulcs
 *  - `/work-orders/:id/task-stats` (a Generated-Tasks tab számlálóhoz)
 *  - `/crm-tasks?workOrderId=…` (Generated-Tasks tab content)
 *  - `/projects/:id/task-stats` és `/activity` (a projekt-room hírfolyamhoz)
 *  - `/documents/project/:id` (a Linked-Documents tabhoz)
 *
 * `workOrderId` / `projectId` / `customerId` / `quoteId` opcionális — minden
 * megadott kulcs-prefixen revalidálunk.
 */
export function revalidateWorkOrderScope(scope: {
  workOrderId?: string;
  projectId?: string;
  customerId?: string;
  quoteId?: string;
} = {}): void {
  // List + count összes filter-variáns — prefix-match.
  void swrMutate(
    (key) => typeof key === 'string' && (
      key.startsWith('/work-orders?') || key === '/work-orders'
    ),
    undefined,
    { revalidate: true },
  );

  if (scope.workOrderId) {
    void swrMutate(`/work-orders/${scope.workOrderId}`);
    void swrMutate(`/work-orders/${scope.workOrderId}/task-stats`);
    void swrMutate(
      (key) => typeof key === 'string' && key.includes(`workOrderId=${scope.workOrderId}`),
      undefined,
      { revalidate: true },
    );
  }

  if (scope.projectId) {
    void swrMutate(`/projects/${scope.projectId}/task-stats`);
    void swrMutate(`/projects/${scope.projectId}/activity`);
    void swrMutate(`/documents/project/${scope.projectId}`);
  }

  if (scope.customerId) {
    // Customer-360 (recentWorkOrders) — summary-cache.
    void swrMutate(`/customers/${scope.customerId}/summary`);
  }

  if (scope.quoteId) {
    void swrMutate(`/quotes/${scope.quoteId}`);
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export interface CreateWorkOrderDto {
  location: string;
  clientCompany: string;
  projectGoal: string;
  projectId?: string;
  customerId?: string;
  locationAddress?: string;
  locationGps?: { lat: number; lng: number };
  deadline?: string;
  workDates?: string[];
  contacts?: Array<{ name: string; phone?: string; email?: string; role?: string }>;
  accessInfo?: string;
  requiredDocuments?: string;
  priorAdministration?: string;
  scanningTasks?: string;
  droneTasks?: string;
  processingTasks?: string;
  modelingTasks?: string;
  consultationDate?: string;
  consultationPrepTime?: string;
  isExtraWork?: boolean;
  deliverableFormats?: string[];
  responsiblePerson?: string;
  notes?: string;
  customFields?: Record<string, unknown>;
}

export async function createWorkOrder(dto: CreateWorkOrderDto): Promise<WorkOrderListItem> {
  const res = await apiClient.post('/work-orders', dto);
  revalidateWorkOrderScope({
    projectId: dto.projectId,
    customerId: dto.customerId,
  });
  return res.data;
}

export async function activateWorkOrder(id: string): Promise<WorkOrderListItem> {
  const res = await apiClient.post(`/work-orders/${id}/activate`);
  revalidateWorkOrderScope({
    workOrderId: id,
    projectId: res.data?.projectId,
    customerId: res.data?.customerId,
  });
  return res.data;
}

export async function completeWorkOrder(id: string): Promise<WorkOrderListItem> {
  const res = await apiClient.post(`/work-orders/${id}/complete`);
  revalidateWorkOrderScope({
    workOrderId: id,
    projectId: res.data?.projectId,
    customerId: res.data?.customerId,
  });
  return res.data;
}

/**
 * Client sign-off. A SignaturePad-komponens base64-PNG-t és az aláíró
 * nevét adja át — a backend customFields-ba menti.
 */
export async function signOffWorkOrder(
  id: string,
  body: { signerName: string; signaturePngBase64?: string },
): Promise<WorkOrderListItem> {
  const res = await apiClient.post(`/work-orders/${id}/sign-off`, body);
  revalidateWorkOrderScope({
    workOrderId: id,
    projectId: res.data?.projectId,
    customerId: res.data?.customerId,
  });
  return res.data;
}

export async function archiveWorkOrder(id: string): Promise<WorkOrderListItem> {
  const res = await apiClient.post(`/work-orders/${id}/archive`);
  revalidateWorkOrderScope({
    workOrderId: id,
    projectId: res.data?.projectId,
    customerId: res.data?.customerId,
  });
  return res.data;
}

export async function cancelWorkOrder(id: string): Promise<WorkOrderListItem> {
  const res = await apiClient.post(`/work-orders/${id}/cancel`);
  revalidateWorkOrderScope({
    workOrderId: id,
    projectId: res.data?.projectId,
    customerId: res.data?.customerId,
  });
  return res.data;
}

export async function deleteWorkOrder(id: string): Promise<void> {
  await apiClient.delete(`/work-orders/${id}`);
  revalidateWorkOrderScope({ workOrderId: id });
}

export async function restoreWorkOrder(id: string): Promise<WorkOrderListItem> {
  const res = await apiClient.post(`/work-orders/${id}/restore`);
  revalidateWorkOrderScope({
    workOrderId: id,
    projectId: res.data?.projectId,
    customerId: res.data?.customerId,
  });
  return res.data;
}

export interface BulkUpdateWorkOrdersResult {
  affected: number;
  skipped: number;
}

export async function bulkUpdateWorkOrders(
  ids: string[],
  patch: WorkOrderBulkPatch,
): Promise<BulkUpdateWorkOrdersResult> {
  const res = await apiClient.post('/work-orders/bulk-update', { ids, patch });
  revalidateWorkOrderScope();
  return res.data;
}
