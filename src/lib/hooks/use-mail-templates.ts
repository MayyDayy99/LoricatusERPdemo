import useSWR from 'swr';
import { apiClient } from '../api-client';

/* ── Types ────────────────────────────────────────────────────── */

export type TemplateCategory = 'sales' | 'operations' | 'lifecycle' | 'drone' | 'notifications';

export interface MailTemplateListItem {
  eventKey: string;
  label: string;
  description: string;
  category: TemplateCategory;
  hasOverride: boolean;
  isActive: boolean;
  updatedAt: string | null;
}

export interface TemplateVariable {
  key: string;
  label: string;
  sample: string | number | Date;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface MailTemplateDetail {
  eventKey: string;
  label: string;
  description: string;
  category: TemplateCategory;
  hasOverride: boolean;
  isActive: boolean;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  variables: TemplateVariable[];
  defaultPreview: RenderedEmail;
}

/* ── Fetcher ──────────────────────────────────────────────────── */

const URL = '/mail-templates';
const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

/* ── Hooks ────────────────────────────────────────────────────── */

export function useMailTemplates() {
  const { data, error, isLoading, mutate } = useSWR<MailTemplateListItem[]>(URL, fetcher);
  return { templates: data ?? [], error, isLoading, mutate };
}

export function useMailTemplate(eventKey: string | null) {
  const { data, error, isLoading, mutate } = useSWR<MailTemplateDetail>(
    eventKey ? `${URL}/${encodeURIComponent(eventKey)}` : null,
    fetcher,
  );
  return { template: data, error, isLoading, mutate };
}

/* ── API calls ────────────────────────────────────────────────── */

export async function updateMailTemplate(
  eventKey: string,
  input: { subject: string; htmlBody: string; textBody?: string; isActive?: boolean },
): Promise<MailTemplateDetail> {
  const res = await apiClient.put(`${URL}/${encodeURIComponent(eventKey)}`, input);
  return res.data;
}

export async function resetMailTemplate(eventKey: string): Promise<void> {
  await apiClient.delete(`${URL}/${encodeURIComponent(eventKey)}`);
}

export async function previewMailTemplate(
  eventKey: string,
  input: { recipientEmail?: string; sampleParams?: Record<string, unknown> } = {},
): Promise<{ ok: boolean; sentTo: string }> {
  const res = await apiClient.post(`${URL}/${encodeURIComponent(eventKey)}/preview`, input);
  return res.data;
}
