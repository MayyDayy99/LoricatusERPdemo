import useSWR from 'swr';
import { apiClient } from '../api-client';

export type ProjectQuickDocKind = 'contract' | 'worksheet' | 'quote';

export interface ProjectQuickDoc {
  id: string;
  tenantId: string;
  projectId: string;
  kind: ProjectQuickDocKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy?: string;
  storageKey?: string;
}

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

export function useProjectQuickDocs(projectId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ProjectQuickDoc[]>(
    projectId ? `/projects/${projectId}/quick-docs` : null,
    fetcher,
  );
  return { docs: data ?? [], error, isLoading, mutate };
}

export async function uploadProjectQuickDoc(
  projectId: string,
  kind: ProjectQuickDocKind,
  file: File,
): Promise<ProjectQuickDoc> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.post(`/projects/${projectId}/quick-docs/${kind}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

/**
 * Egy konkrét rekord download-URL-je (signed, 10 perc).
 * Doc-ID alapján, mert egy kind alá több fájl is tartozhat.
 */
export async function getProjectQuickDocDownloadUrl(
  projectId: string,
  docId: string,
): Promise<{ url: string; fileName: string }> {
  const res = await apiClient.get(`/projects/${projectId}/quick-docs/${docId}/download`);
  return res.data;
}

/** Egy konkrét rekord törlése doc-ID alapján. */
export async function deleteProjectQuickDoc(
  projectId: string,
  docId: string,
): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/quick-docs/${docId}`);
}

/** Helper: minden adott kind-hez tartozó dokumentum (lista) a docs-tömbből. */
export function filterQuickDocs(
  docs: ProjectQuickDoc[],
  kind: ProjectQuickDocKind,
): ProjectQuickDoc[] {
  return docs.filter(d => d.kind === kind);
}

/**
 * Helper: van-e legalább 1 fájl az adott kind-hez. Az Áttekintés tab
 * pipa-jelzéseit ez vezérli.
 */
export function hasQuickDoc(
  docs: ProjectQuickDoc[],
  kind: ProjectQuickDocKind,
): boolean {
  return docs.some(d => d.kind === kind);
}

/**
 * @deprecated Több fájl/kind támogatás óta. Csak az "első" rekordot adja vissza,
 * használj `filterQuickDocs(docs, kind)` listát vagy `hasQuickDoc(docs, kind)`
 * pipa-jelzéshez. Megmarad legacy hívók kompatibilitásához.
 */
export function findQuickDoc(
  docs: ProjectQuickDoc[],
  kind: ProjectQuickDocKind,
): ProjectQuickDoc | null {
  return docs.find(d => d.kind === kind) ?? null;
}
