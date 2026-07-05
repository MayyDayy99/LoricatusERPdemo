import useSWR, { mutate as swrMutate } from 'swr';
import { apiClient } from '../api-client';

// Sprint 3 β₁: a global tenant-list (/documents) + paginated dropdownnal lecseréli
// a régi `/documents/project/:projectId` single-shot lekérést. A backward-
// compat (boolean / string overload) megmarad, hogy a meglévő callerek
// (drone/[id]/page.tsx etc.) ne törjenek.

export interface DocumentRecipient {
  email: string;
  name: string;
  sentAt?: string;
}

export interface Document {
  id: string;
  tenantId: string;
  projectId?: string;
  customerId?: string;
  dealId?: string;
  contractId?: string;
  workOrderId?: string;
  invoiceId?: string;
  uploadId?: string;
  title: string;
  type: string;
  state: 'draft' | 'generated' | 'sent' | 'superseded';
  recipients: DocumentRecipient[];
  templateId?: string;
  generatedStorageKey?: string;
  supersededById?: string;
  metadata?: Record<string, unknown>;
  generatedAt?: string;
  sentAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface DocumentListResponse {
  items: Document[];
  total: number;
  take: number;
  skip: number;
}

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

// ─── Revalidate scope ────────────────────────────────────────────────────────
//
// Customer-precedens: minden mutate után invalidáljuk a `/documents*` prefix
// minden kulcsát + az érintett parent-entity-k summary/activity-feedjét. Egy
// document.send PATCH-et a customer/deal/contract/work-order/invoice oldal is
// hallhat, ha közvetlenül oda van linkelve.

export function revalidateDocumentScope(scope?: {
  documentId?: string;
  projectId?: string;
  customerId?: string;
  dealId?: string;
  contractId?: string;
  workOrderId?: string;
  invoiceId?: string;
}) {
  // Általános /documents kulcsok — a global lista + a /documents/:id GET-ek
  // mind újra-fetchelődnek. A predicate-mutate az SWR-cache-ben jelenleg élő
  // kulcsokon fut.
  void swrMutate(
    (key) => typeof key === 'string' && key.startsWith('/documents'),
    undefined,
    { revalidate: true },
  );

  // Parent-entity summary + audit-timeline kulcsok. Az AuditTimeline a
  // `/audit/filter?resource=document&...` kulcson lóg, így a documentId-specific
  // entry-knél azt is invalidáljuk.
  if (scope?.documentId) {
    void swrMutate(
      (key) =>
        typeof key === 'string' &&
        key.startsWith('/audit/filter') &&
        key.includes(`resourceId=${encodeURIComponent(scope.documentId!)}`),
    );
  }

  if (scope?.projectId) {
    void swrMutate(`/projects/${scope.projectId}/activity`);
    void swrMutate(`/activities/project/${scope.projectId}`);
  }
  if (scope?.customerId) {
    void swrMutate(`/customers/${scope.customerId}/summary`);
  }
  if (scope?.dealId) {
    void swrMutate(`/deals/${scope.dealId}/summary`);
  }
  if (scope?.contractId) {
    void swrMutate(`/contracts/${scope.contractId}/summary`);
  }
  if (scope?.workOrderId) {
    void swrMutate(`/work-orders/${scope.workOrderId}/summary`);
  }
  if (scope?.invoiceId) {
    void swrMutate(`/invoices/${scope.invoiceId}/summary`);
  }
}

// ─── List options ────────────────────────────────────────────────────────────

export interface UseDocumentsOptions {
  state?: string;
  type?: string;
  projectId?: string;
  customerId?: string;
  dealId?: string;
  contractId?: string;
  workOrderId?: string;
  invoiceId?: string;
  search?: string;
  take?: number;
  skip?: number;
  /** Predefined/custom szegmens jelzés — csak metadata, nem küldjük a backendnek. */
  segmentId?: string;
}

function buildKey(opts: UseDocumentsOptions): string {
  const params = new URLSearchParams();
  if (opts.take != null) params.set('take', String(opts.take));
  if (opts.skip != null) params.set('skip', String(opts.skip));
  if (opts.search && opts.search.trim()) params.set('search', opts.search.trim());
  if (opts.state) params.set('state', opts.state);
  if (opts.type) params.set('type', opts.type);
  if (opts.projectId) params.set('projectId', opts.projectId);
  if (opts.customerId) params.set('customerId', opts.customerId);
  if (opts.dealId) params.set('dealId', opts.dealId);
  if (opts.contractId) params.set('contractId', opts.contractId);
  if (opts.workOrderId) params.set('workOrderId', opts.workOrderId);
  if (opts.invoiceId) params.set('invoiceId', opts.invoiceId);
  return `/documents?${params.toString()}`;
}

/**
 * Sprint 3 β₁: paginated documents hook.
 *
 * Defensive overload: a régi `useDocuments(projectId: string | null)` hívás
 * továbbra is működik — projectId-vel a backend a `/documents?projectId=...`-en
 * üt, így nem kell külön legacy endpoint.
 *
 * Új mód: `useDocuments({ state, type, projectId, ..., take, skip, search })`
 * — a list-page használja a paginator + debounce-olt kereső köteggel. A
 * backend response objektum-paginated; az `items`/`total` mező közvetlenül
 * elérhető. A `documents` alias a régi callerek miatt marad.
 */
export function useDocuments(
  optsOrId: UseDocumentsOptions | string | null = {},
) {
  // Backwards-compat: legacy string/null → projectId-szűrt list, default take=200,
  // hogy a kártya-rács a régi single-projekt-nézethez idomuljon.
  const opts: UseDocumentsOptions =
    typeof optsOrId === 'string'
      ? { projectId: optsOrId, take: 200 }
      : optsOrId === null
        ? { take: 0 }                // null → SWR-key NULL, skip-fetch
        : { take: 25, ...optsOrId };

  // A NULL-projectId-s overload skip-fetch kell legyen — különben a documents
  // page selectedProjectId nélkül 6000+ doc-ot rántana le.
  const skip = typeof optsOrId === 'string' ? false : optsOrId === null;
  const key = skip ? null : buildKey(opts);

  const { data, error, isLoading, mutate } = useSWR<
    DocumentListResponse | Document[]
  >(
    key,
    fetcher,
    {
      // Customer-precedens: nincs deduping, hogy egy mutate() azonnal friss
      // DB-snapshotot kapjon (a backend audit-log commit-ja után különben
      // stale-cache-elt válasz jönne).
      dedupingInterval: 0,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );

  const items: Document[] = Array.isArray(data)
    ? data
    : (data?.items ?? []);
  const total: number = Array.isArray(data)
    ? data.length
    : (data?.total ?? 0);

  return {
    documents: items,
    items,
    total,
    error,
    isLoading,
    mutate,
  };
}

/** Egy document részletes lekérése (detail page). */
export function useDocument(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Document>(
    id ? `/documents/${id}` : null,
    fetcher,
  );
  return { document: data ?? null, error, isLoading, mutate };
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createDocument(params: {
  projectId: string;
  title: string;
  type?: string;
  templateId?: string;
}): Promise<Document> {
  const res = await apiClient.post('/documents', params);
  revalidateDocumentScope({ documentId: res.data?.id, projectId: params.projectId });
  return res.data;
}

export async function generateDocument(id: string): Promise<Document> {
  const res = await apiClient.post(`/documents/${id}/generate`);
  revalidateDocumentScope({
    documentId: id,
    projectId: res.data?.projectId,
    customerId: res.data?.customerId,
    dealId: res.data?.dealId,
    contractId: res.data?.contractId,
    workOrderId: res.data?.workOrderId,
    invoiceId: res.data?.invoiceId,
  });
  return res.data;
}

export async function sendDocument(
  id: string,
  recipients: DocumentRecipient[],
): Promise<Document> {
  const res = await apiClient.post(`/documents/${id}/send`, { recipients });
  revalidateDocumentScope({
    documentId: id,
    projectId: res.data?.projectId,
    customerId: res.data?.customerId,
    dealId: res.data?.dealId,
    contractId: res.data?.contractId,
    workOrderId: res.data?.workOrderId,
    invoiceId: res.data?.invoiceId,
  });
  return res.data;
}

/**
 * Supersede transition — DRAFT/GENERATED/SENT → SUPERSEDED. A backend endpoint
 * a bulk-update keretrendszerben futtatja (state=superseded patch). A legacy
 * dokumentumot a frontend visszamenőleg "Felváltva" badge-zsel jelöli; ha az
 * új verzió még nincs link-elve, a supersededById üres marad, a UI csak a
 * timeline-on jelenít meg utalást.
 */
export async function supersedeDocument(id: string): Promise<{ affected: number }> {
  const res = await apiClient.post('/documents/bulk-update', {
    ids: [id],
    patch: { state: 'superseded' },
  });
  revalidateDocumentScope({ documentId: id });
  return res.data;
}

export function downloadDocument(id: string): void {
  const base = (apiClient.defaults.baseURL ?? '').replace(/\/$/, '');
  window.open(`${base}/documents/${id}/pdf`, '_blank');
}

// ─── Bulk update ─────────────────────────────────────────────────────────────

export interface DocumentBulkPatch {
  state?: 'draft' | 'generated' | 'sent' | 'superseded';
  type?: string;
  addRecipients?: DocumentRecipient[];
}

export interface BulkUpdateResult {
  affected: number;
}

export async function bulkUpdateDocuments(
  ids: string[],
  patch: DocumentBulkPatch,
): Promise<BulkUpdateResult> {
  const res = await apiClient.post('/documents/bulk-update', { ids, patch });
  revalidateDocumentScope();
  return res.data;
}
