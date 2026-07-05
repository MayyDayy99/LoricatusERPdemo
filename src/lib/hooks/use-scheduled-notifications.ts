import { mutate as globalMutate } from 'swr';
import { apiClient } from '../api-client';

/**
 * Időzített értesítés ("harang"/ping) helper-fv-ek.
 *
 * Backend endpointok:
 *   POST   /scheduled-notifications              — időzítés jövőbeli pillanatra
 *   POST   /scheduled-notifications/now          — insert + azonnali dispatch
 *   POST   /scheduled-notifications/:id/send-now — meglevő ping azonnali dispatch-e
 *   DELETE /scheduled-notifications/:id          — soft cancel (cancelledAt set)
 *
 * Mindegyik hívás után érdemes a `useDashboardOverview` SWR cache-t
 * újrahúzni (a Gantt-on a PingMarker-ek frissüljenek). A "Küldd most"
 * útvonalakon a `/notifications/unread-count` cache-t is — hogy a header
 * bell-badge azonnal frissüljön.
 */
export interface CreatePingInput {
  userId: string;
  scheduledFor: string; // ISO 8601
  title: string;
  body?: string;
  type?: string;
  projectId?: string;
}

export interface CreatePingNowInput {
  userId: string;
  title: string;
  body?: string;
  type?: string;
  projectId?: string;
}

export async function createPing(input: CreatePingInput) {
  const res = await apiClient.post('/scheduled-notifications', input);
  return res.data;
}

export async function createAndSendNow(input: CreatePingNowInput) {
  const res = await apiClient.post('/scheduled-notifications/now', input);
  // Az új bell-sor azonnali megjelenése érdekében invalidáljuk a count + lista cache-t.
  await invalidateBellCache();
  return res.data;
}

export async function sendNowPing(id: string) {
  const res = await apiClient.post(`/scheduled-notifications/${id}/send-now`);
  await invalidateBellCache();
  return res.data;
}

export async function cancelPing(id: string) {
  const res = await apiClient.delete(`/scheduled-notifications/${id}`);
  return res.data;
}

async function invalidateBellCache() {
  await Promise.all([
    globalMutate('/notifications/unread-count'),
    globalMutate((key) => typeof key === 'string' && key.startsWith('/notifications')),
  ]);
}
