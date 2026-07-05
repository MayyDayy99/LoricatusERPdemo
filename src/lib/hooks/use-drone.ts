import useSWR from 'swr';
import { apiClient } from '../api-client';

export interface DroneAsset {
  id: string;
  name: string;
  registrationNumber?: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  status: string;
  maxFlightTimeMin?: number;
  payloadKg?: number;
  purchaseDate?: string;
  insuranceExpiry?: string;
  certificationExpiry?: string;
  notes?: string;
}

export interface DronePilot {
  id: string;
  name: string;
  userId?: string;
  licenseNumber?: string;
  licenseClass?: string;
  licenseExpiry?: string;
  medicalExpiry?: string;
  totalFlightHours: number;
  status: string;
  notes?: string;
}

export interface DroneOperation {
  id: string;
  workOrderId?: string;
  droneAssetId?: string;
  pilotId?: string;
  status: string;
  plannedDate?: string;
  actualStart?: string;
  actualEnd?: string;
  flightTimeMin?: number;
  location?: string;
  locationAddress?: string;
  locationGps?: { lat: number; lng: number };
  areaCoveredSqm?: number;
  maxAltitudeM?: number;
  weatherConditions?: string;
  serialCode?: string;
  operationType?: string;
  airspacePermitRequired?: boolean;
  airspacePermitAcquired?: boolean;
  airspacePermitNumber?: string;
  airspacePermitExpiry?: string;
  policeNotificationRequired?: boolean;
  policeNotificationDone?: boolean;
  policeNotificationRef?: string;
  policeNotifiedAt?: string;
  calendarEntryDone?: boolean;
  clientDeclarationReceived?: boolean;
  customFields?: Record<string, unknown>;
  notes?: string;
  /** Az 1:1 párként létrehozott projekt-"szoba" ID-ja (drón→szoba fúzió). */
  projectId?: string;
  createdAt: string;
}

export function useDroneAssets(status?: string) {
  const qs = status ? `?status=${status}` : '';
  const { data, error, mutate } = useSWR(
    `/drone/assets${qs}`,
    (url: string) => apiClient.get(url).then(r => r.data),
  );
  return { assets: (data ?? []) as DroneAsset[], loading: !error && !data, error, mutate };
}

export function useDronePilots(status?: string) {
  const qs = status ? `?status=${status}` : '';
  const { data, error, mutate } = useSWR(
    `/drone/pilots${qs}`,
    (url: string) => apiClient.get(url).then(r => r.data),
  );
  return { pilots: (data ?? []) as DronePilot[], loading: !error && !data, error, mutate };
}

export function useDroneOperations(params?: { status?: string; workOrderId?: string; projectId?: string }) {
  const query = new URLSearchParams();
  if (params?.status)      query.set('status', params.status);
  if (params?.workOrderId) query.set('workOrderId', params.workOrderId);
  if (params?.projectId)   query.set('projectId', params.projectId);
  const qs = query.toString();
  const { data, error, mutate } = useSWR(
    `/drone/operations${qs ? `?${qs}` : ''}`,
    (url: string) => apiClient.get(url).then(r => r.data),
  );
  return {
    operations: ((data as any)?.data ?? []) as DroneOperation[],
    total:      ((data as any)?.total ?? 0) as number,
    loading: !error && !data, error, mutate,
  };
}

/**
 * A projekt-"szobához" linkelt repülés (1:1). `null` projectId esetén nem
 * fetch-el. A drón-feature kikapcsolt tenant-nál a hook hibát nyel → null op.
 */
export function useProjectDroneOperation(projectId: string | null) {
  const { data, error, mutate } = useSWR(
    projectId ? `/drone/operations?projectId=${projectId}` : null,
    (url: string) => apiClient.get(url).then(r => r.data).catch(() => ({ data: [] })),
  );
  return {
    operation: (((data as any)?.data ?? []) as DroneOperation[])[0] ?? null,
    loading: !error && !data && !!projectId,
    mutate,
  };
}

export async function createDroneAsset(dto: Partial<DroneAsset>): Promise<DroneAsset> {
  return apiClient.post('/drone/assets', dto).then(r => r.data);
}
export async function updateDroneAsset(id: string, dto: Partial<DroneAsset>): Promise<DroneAsset> {
  return apiClient.patch(`/drone/assets/${id}`, dto).then(r => r.data);
}
export async function deleteDroneAsset(id: string): Promise<void> {
  await apiClient.delete(`/drone/assets/${id}`);
}

export async function createDronePilot(dto: Partial<DronePilot>): Promise<DronePilot> {
  return apiClient.post('/drone/pilots', dto).then(r => r.data);
}
export async function updateDronePilot(id: string, dto: Partial<DronePilot>): Promise<DronePilot> {
  return apiClient.patch(`/drone/pilots/${id}`, dto).then(r => r.data);
}
export async function deleteDronePilot(id: string): Promise<void> {
  await apiClient.delete(`/drone/pilots/${id}`);
}

export async function createDroneOperation(dto: Partial<DroneOperation>): Promise<DroneOperation> {
  return apiClient.post('/drone/operations', dto).then(r => r.data);
}
export async function updateDroneOperation(id: string, dto: Partial<DroneOperation>): Promise<DroneOperation> {
  return apiClient.patch(`/drone/operations/${id}`, dto).then(r => r.data);
}
export async function deleteDroneOperation(id: string): Promise<void> {
  await apiClient.delete(`/drone/operations/${id}`);
}
export async function transitionDroneOperation(
  id: string,
  action: 'start' | 'complete' | 'cancel' | 'abort',
  opts?: { force?: boolean },
): Promise<DroneOperation> {
  const qs = opts?.force ? '?force=true' : '';
  return apiClient.post(`/drone/operations/${id}/${action}${qs}`).then(r => r.data);
}

export interface NotamItem {
  id: string;
  series?: string;
  effectiveStart?: string;
  effectiveEnd?: string;
  text?: string;
  rawText?: string;
  // Provider-specific fields are passed through as-is.
  [key: string]: unknown;
}

export interface NotamLookupResult {
  checkedAt: string;
  notams: NotamItem[];
  warning?: string;
}

export async function fetchOperationNotams(
  id: string,
  radiusNauticalMiles?: number,
): Promise<NotamLookupResult> {
  const qs = radiusNauticalMiles ? `?radius=${radiusNauticalMiles}` : '';
  return apiClient.get(`/drone/operations/${id}/notams${qs}`).then(r => r.data);
}

// ── Drone documents ──────────────────────────────────────────────────────────

export type DroneDocumentCategory =
  | 'airspace_permit'
  | 'police_notification'
  | 'client_declaration'
  | 'flight_log'
  | 'photo'
  | 'other';

export const DRONE_DOC_CATEGORY_LABELS: Record<DroneDocumentCategory, string> = {
  airspace_permit:     'Légtér engedély',
  police_notification: 'Rendőrségi bejelentés',
  client_declaration:  'Ügyfélnyilatkozat',
  flight_log:          'Repülési napló',
  photo:               'Fotó / helyszínrajz',
  other:               'Egyéb',
};

export interface DroneDocument {
  id: string;
  operationId: string;
  category: DroneDocumentCategory;
  label?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256?: string;
  uploadedBy: string;
  uploadedAt: string;
  downloadUrl?: string;
  downloadExpiresAt?: string;
}

export function useOperationDocuments(operationId: string | null) {
  const { data, error, mutate } = useSWR(
    operationId ? `/drone/operations/${operationId}/documents` : null,
    (url: string) => apiClient.get(url).then(r => r.data),
  );
  return {
    documents: (data ?? []) as DroneDocument[],
    loading: !error && !data && !!operationId,
    error,
    mutate,
  };
}

export async function uploadOperationDocument(
  operationId: string,
  params: { file: File; category: DroneDocumentCategory; label?: string },
): Promise<DroneDocument> {
  const fd = new FormData();
  fd.append('file', params.file);
  fd.append('category', params.category);
  if (params.label) fd.append('label', params.label);
  return apiClient
    .post(`/drone/operations/${operationId}/documents`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then(r => r.data);
}

export async function deleteOperationDocument(documentId: string): Promise<void> {
  await apiClient.delete(`/drone/documents/${documentId}`);
}

export async function fetchPermitArchive(params?: {
  category?: DroneDocumentCategory;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<DroneDocument[]> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.from)     qs.set('from', params.from);
  if (params?.to)       qs.set('to', params.to);
  if (params?.limit)    qs.set('limit', String(params.limit));
  const url = `/drone/permit-archive${qs.toString() ? `?${qs.toString()}` : ''}`;
  return apiClient.get(url).then(r => r.data);
}

// ── Megrendelői űrlap (public magic-link) ───────────────────────────────────

export interface DroneFormInvite {
  id: string;
  tenantId: string;
  operationId: string;
  token: string;
  status: 'pending' | 'submitted' | 'expired' | 'cancelled';
  recipientEmail?: string;
  recipientName?: string;
  subject?: string;
  expiresAt: string;
  createdAt: string;
  createdByUserId: string;
  submittedAt?: string;
  submittedData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  attachmentCount: number;
  /** Csak a `createInvite` válaszban — a frontend-en megjelenített link. */
  link?: string;
}

export function useDroneFormInvites(operationId: string | null) {
  const { data, error, mutate } = useSWR(
    operationId ? `/drone/operations/${operationId}/forms` : null,
    (url: string) => apiClient.get(url).then(r => r.data),
  );
  return {
    invites: (data ?? []) as DroneFormInvite[],
    loading: !error && !data && !!operationId,
    error,
    mutate,
  };
}

export async function createDroneFormInvite(
  operationId: string,
  params: { recipientEmail: string; recipientName: string; expiresInDays?: number; subject?: string },
): Promise<DroneFormInvite> {
  return apiClient.post(`/drone/operations/${operationId}/forms`, params).then(r => r.data);
}

export async function cancelDroneFormInvite(operationId: string, formId: string): Promise<void> {
  await apiClient.delete(`/drone/operations/${operationId}/forms/${formId}`);
}

export interface DroneFormFieldSchema {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'checkbox' | 'select' | 'file';
  required?: boolean;
}

export interface DroneFormAttachment {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  downloadUrl: string;
  downloadExpiresAt: string;
}

export interface DroneFormSubmissionDetail {
  submission: DroneFormInvite;
  fields: DroneFormFieldSchema[];
  attachments: DroneFormAttachment[];
}

export async function getDroneFormSubmission(
  operationId: string,
  formId: string,
): Promise<DroneFormSubmissionDetail> {
  return apiClient
    .get(`/drone/operations/${operationId}/forms/${formId}`)
    .then(r => r.data);
}
