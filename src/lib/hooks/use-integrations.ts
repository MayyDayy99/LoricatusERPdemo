import useSWR from 'swr';
import { apiClient } from '../api-client';

/* ── Types ────────────────────────────────────────────────────── */

export type IntegrationProvider =
  | 'sendgrid'
  | 'azure_storage'
  | 'google_maps'
  | 'notam'
  | 'pdf'
  | 'sketchfab';

export interface IntegrationRecord {
  provider: IntegrationProvider;
  hasCredential: boolean;
  maskedCredentials: Record<string, string>;
  enabled: boolean;
  lastTestedAt?: string;
  lastTestResult?: 'ok' | 'failed';
  lastTestError?: string;
}

/* ── Fetcher ──────────────────────────────────────────────────── */

const URL = '/integrations';

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

/* ── Hooks ────────────────────────────────────────────────────── */

export function useIntegrations() {
  const { data, error, isLoading, mutate } = useSWR<IntegrationRecord[]>(URL, fetcher);
  return { integrations: data ?? [], error, isLoading, mutate };
}

/* ── API calls ────────────────────────────────────────────────── */

export async function upsertIntegration(
  provider: IntegrationProvider,
  credentials: Record<string, string>,
): Promise<IntegrationRecord> {
  const res = await apiClient.put(`${URL}/${provider}`, { credentials });
  return res.data;
}

export async function testIntegration(
  provider: IntegrationProvider,
  credentials: Record<string, string>,
): Promise<{ ok: boolean; message: string; timeout?: boolean }> {
  const res = await apiClient.post(`${URL}/${provider}/test`, { credentials });
  return res.data;
}

export async function deleteIntegration(provider: IntegrationProvider): Promise<void> {
  await apiClient.delete(`${URL}/${provider}`);
}
