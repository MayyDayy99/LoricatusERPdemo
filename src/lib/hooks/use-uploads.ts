// Sprint 3 β₂ — paginated useUploads + revalidateUploadScope.
//
// A customers-precedensre építünk: szerver-oldali pagináció (take/skip),
// szerver-oldali szűrők, dedupingInterval=0, revalidateOnFocus + keepPreviousData.
// A `useUploads` mostantól `{ items, total }`-shape-et ad vissza (a backend
// `GET /uploads` válasza). A legacy `useUploads(projectId)` callerek
// továbbra is működnek a polymorphic-call signaturán keresztül — projectId-t
// adva fallback take=500-ra megyünk és tömb-shape-et adunk vissza, kompatibilis
// a régi felületekkel.
//
// A `revalidateUploadScope` minden /uploads* és /documents* SWR-kulcsot
// invalidál — utóbbi a promote-to-document cascade miatt fontos: az upload
// új document-rekordot szül, és a /documents/project/:id cache stale lenne.

import useSWR, { mutate as swrMutate } from 'swr';
import { apiClient } from '../api-client';
import type { UploadCategory, UploadStateKey } from '../upload-lifecycle';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Upload {
  id: string;
  projectId?: string | null;
  uploadedBy?: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  state: UploadStateKey;
  category: UploadCategory;
  version: number;
  previousVersionId?: string;
  isArchived: boolean;
  sha256Checksum?: string;
  scanResult?: string | null;
  storageKey?: string;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UploadListResponse {
  items: Upload[];
  total: number;
  take: number;
  skip: number;
}

export interface UseUploadsOptions {
  category?: UploadCategory;
  mimeType?: string;
  projectId?: string;
  uploadedBy?: string;
  search?: string;
  state?: UploadStateKey;
  isArchived?: boolean;
  take?: number;
  skip?: number;
  /** Client-side helper a 4 előre-definiált szegmens (recent / mineUploaded /
   *  largeFiles / failedScans) miatt — a hook-nak nem küldjük tovább, a hívó
   *  oldal a filter-derivációt direktbe végzi (predefined-segment → opts).
   *  A mező itt csak a típus-szerződés stabilitása miatt opcionális. */
  segmentId?: string;
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

// ─── Revalidate scope ─────────────────────────────────────────────────────────

/**
 * Egy upload-mutáció (initiate/complete/archive/delete/bulk/promote) után minden
 * /uploads*  és /documents* SWR-kulcsot invalidálunk. A documents cascade a
 * `promoteToDocument`-hez kell — egy upload új Document-rekordot szül, így a
 * /documents/project/:id lista stale-lé válna. A predikátum-alapú mutate a
 * customers-precedenst követi (use-crm.ts:`mergeCustomers`).
 *
 * uploadId / projectId opcionális — nincs külön kulcs hozzájuk, csak a logging
 * miatt deklaráljuk; a wide-mutate amúgy is kiterjeszti rájuk a hatást.
 */
export function revalidateUploadScope(_opts?: { uploadId?: string; projectId?: string }) {
  void swrMutate(
    (key) => typeof key === 'string' && key.startsWith('/uploads'),
    undefined,
    { revalidate: true },
  );
  void swrMutate(
    (key) => typeof key === 'string' && key.startsWith('/documents'),
    undefined,
    { revalidate: true },
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Paginated/filtered upload-lista (Sprint 3 β₂).
 *
 * - Új mód: `useUploads({ take, skip, search, category, state, … })` —
 *   `GET /uploads?...` válasza `{items, total, take, skip}` shape-ben.
 * - Legacy mód: `useUploads('uuid')` — projectId string-et adva fallback
 *   `GET /uploads/project/:projectId` shape-re megy (tömb), a régi
 *   uploads/page.tsx + project-modal callerek nem törnek.
 */
export function useUploads(
  optsOrProjectId: UseUploadsOptions | string | null = {},
) {
  // A React "rules of hooks"-megsértés elkerülésére MINDKÉT módban
  // egyetlen useSWR-hívással építjük fel a kulcsot. A legacy single-string
  // projectId-mód (régi callerek) a `/uploads/project/:projectId` route-ra
  // megy; az új mód a paginated `/uploads?...` route-ra. A `null` (explicit
  // skip) eseten a SWR key=null lesz → nem fetchel.
  let key: string | null;
  let isLegacyShape = false;

  if (typeof optsOrProjectId === 'string') {
    isLegacyShape = true;
    key = optsOrProjectId ? `/uploads/project/${optsOrProjectId}` : null;
  } else if (optsOrProjectId === null) {
    key = null;
  } else {
    const opts = optsOrProjectId;
    const params = new URLSearchParams();
    params.set('take', String(opts.take ?? 25));
    params.set('skip', String(opts.skip ?? 0));
    if (opts.search && opts.search.trim()) params.set('search', opts.search.trim());
    if (opts.state)      params.set('state', opts.state);
    if (opts.category)   params.set('category', opts.category);
    if (opts.mimeType)   params.set('mimeType', opts.mimeType);
    if (opts.projectId)  params.set('projectId', opts.projectId);
    if (opts.uploadedBy) params.set('uploadedBy', opts.uploadedBy);
    key = `/uploads?${params.toString()}`;
  }

  const { data, error, isLoading, mutate } = useSWR<UploadListResponse | Upload[]>(
    key,
    fetcher,
    {
      dedupingInterval: 0,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );

  // Defenzív shape-unwrap — legacy mód mindig array-t ad vissza; a paginated
  // route `{items,total}`-ben. A bare-array fallback proxy/CDN köztes
  // verziókra is felkészít.
  const items: Upload[] = Array.isArray(data) ? data : (data?.items ?? []);
  const total: number = isLegacyShape
    ? items.length
    : (Array.isArray(data) ? data.length : (data?.total ?? 0));

  return {
    uploads: items,
    items,
    total,
    error,
    isLoading,
    mutate,
  };
}

/**
 * Egy upload verzió-láncolata. A backend `previousVersionId` chain-en megy
 * fel; a szolgáltatás közvetlen `Upload[]`-t ad vissza (legacy shape).
 */
export function useUploadVersions(uploadId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Upload[]>(
    uploadId ? `/uploads/${uploadId}/versions` : null,
    fetcher,
  );
  return { versions: data ?? [], error, isLoading, mutate };
}

/**
 * Egyetlen upload-rekord (detail-page-hez). A backend `GET /uploads/:id`-t
 * NEM ad vissza külön — a list-endpoint findOne-ja a service-en belül van.
 * Helyette a `findByProject` shape-éből szűrünk, vagy lazy-jelleggel a
 * `/uploads/:id/url` lekérdezést használjuk. Ez a hook a list-endpointot
 * paraméterezve hívja, de fallback-ben az url-lekérdezés is működik.
 *
 * Sprint 3 β₂ NOTE: a backend tényleges `GET /uploads/:id` endpoint
 * megérkezésekor itt csak az URL cserélődik; a hook-shape stabil marad.
 */
export function useUpload(uploadId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Upload | UploadListResponse>(
    uploadId ? `/uploads?take=1&skip=0&id=${uploadId}` : null,
    fetcher,
  );
  // Ha a backend végül egyedi resource-t ad vissza, használjuk azt; ha
  // listát, az első itemet. A type-guard mindkettőre felkészít.
  let upload: Upload | null = null;
  if (data) {
    if ('items' in (data as UploadListResponse)) {
      upload = (data as UploadListResponse).items[0] ?? null;
    } else {
      upload = data as Upload;
    }
  }
  return { upload, error, isLoading, mutate };
}

/**
 * Az α₃ findDuplicates response shape-je `Record<sha256, Upload[]>`.
 * A duplicates-oldal ezt csoport-szinten rendereli; minden csoportnak
 * van 2+ tagja (a backend kiszűri az 1-tagú "csoportokat").
 */
export function useUploadDuplicates() {
  const { data, error, isLoading, mutate } = useSWR<Record<string, Upload[]>>(
    '/uploads/duplicates',
    fetcher,
    {
      dedupingInterval: 0,
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  );
  return { groups: data ?? {}, error, isLoading, mutate };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function getDownloadUrl(uploadId: string): Promise<string> {
  const res = await apiClient.get(`/uploads/${uploadId}/url`);
  return res.data.url as string;
}

export interface InitiateUploadParams {
  projectId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  category?: UploadCategory;
  previousUploadId?: string;
}

export async function initiateUpload(
  params: InitiateUploadParams,
): Promise<{ upload: Upload; chunkUploadUrls: string[] }> {
  const res = await apiClient.post('/uploads/initiate', { ...params, chunkCount: 1 });
  // A backend `chunkUploadUrls` lehet string-tömb VAGY `{index,url,expiresAt}`
  // objektum-tömb — defenzíven mindkettőből URL-string-eket csinálunk.
  const raw = res.data;
  const chunkUploadUrls: string[] = (raw.chunkUploadUrls ?? []).map(
    (c: string | { url: string }) => (typeof c === 'string' ? c : c.url),
  );
  revalidateUploadScope({ projectId: params.projectId });
  return { upload: raw.upload, chunkUploadUrls };
}

export async function completeUpload(uploadId: string): Promise<Upload> {
  const res = await apiClient.post(`/uploads/${uploadId}/complete`);
  revalidateUploadScope({ uploadId, projectId: res.data?.projectId });
  return res.data;
}

export async function deleteUpload(uploadId: string): Promise<void> {
  await apiClient.delete(`/uploads/${uploadId}`);
  revalidateUploadScope({ uploadId });
}

export async function archiveUpload(uploadId: string, archive: boolean): Promise<Upload> {
  const res = await apiClient.patch(`/uploads/${uploadId}/archive`, { archive });
  revalidateUploadScope({ uploadId, projectId: res.data?.projectId });
  return res.data;
}

// ─── Bulk + promote (Sprint 3 β₂) ─────────────────────────────────────────────

export interface UploadBulkPatch {
  isArchived?: boolean;
  category?: UploadCategory;
  /** A backend BulkPatchDto `deleteSoft: true` mező — soft-delete bulk. */
  deleteSoft?: boolean;
}

export interface BulkUpdateUploadsResult {
  affected: number;
}

export async function bulkUpdateUploads(
  ids: string[],
  patch: UploadBulkPatch,
): Promise<BulkUpdateUploadsResult> {
  const res = await apiClient.post('/uploads/bulk-update', { ids, patch });
  revalidateUploadScope();
  // A backend service `{ affected }` shape-et ad vissza; defenzíven
  // a `count`/`updated` shape-eket is elfogadjuk.
  const raw = res.data ?? {};
  const affected = raw.affected ?? raw.count ?? raw.updated ?? ids.length;
  return { affected };
}

export async function promoteToDocument(
  uploadId: string,
  title?: string,
): Promise<{ id: string; documentId?: string }> {
  const res = await apiClient.post(`/uploads/${uploadId}/promote-to-document`, { title });
  revalidateUploadScope({ uploadId });
  return res.data;
}
