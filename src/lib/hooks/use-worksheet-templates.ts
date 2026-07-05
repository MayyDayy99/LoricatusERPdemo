import useSWR from 'swr';
import { apiClient } from '../api-client';

export interface WorksheetItem {
  id?: string;
  code: string;
  task: string;
  tool1?: string;
  tool2?: string;
  owner?: string;
  sortIndex?: number;
}

export interface WorksheetSection {
  id?: string;
  code: string;
  title: string;
  sortIndex?: number;
  items: WorksheetItem[];
}

export interface WorksheetTemplate {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  color?: string;
  sortIndex: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  sections: WorksheetSection[];
}

export interface WorksheetTemplateInput {
  name: string;
  description?: string;
  color?: string;
  sortIndex?: number;
  sections: WorksheetSection[];
}

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

export function useWorksheetTemplates() {
  const { data, error, isLoading, mutate } = useSWR<WorksheetTemplate[]>(
    '/worksheet-templates',
    fetcher,
  );
  return { templates: data ?? null, error, isLoading, mutate };
}

export function useWorksheetTemplate(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<WorksheetTemplate>(
    id ? `/worksheet-templates/${id}` : null,
    fetcher,
  );
  return { template: data ?? null, error, isLoading, mutate };
}

export async function createWorksheetTemplate(dto: WorksheetTemplateInput): Promise<WorksheetTemplate> {
  const res = await apiClient.post('/worksheet-templates', dto);
  return res.data;
}

export async function updateWorksheetTemplate(id: string, dto: Partial<WorksheetTemplateInput>): Promise<WorksheetTemplate> {
  const res = await apiClient.patch(`/worksheet-templates/${id}`, dto);
  return res.data;
}

export async function archiveWorksheetTemplate(id: string): Promise<void> {
  await apiClient.delete(`/worksheet-templates/${id}`);
}

export async function unarchiveWorksheetTemplate(id: string): Promise<void> {
  await apiClient.post(`/worksheet-templates/${id}/unarchive`);
}

export async function importGreenareaTemplate(): Promise<WorksheetTemplate> {
  const res = await apiClient.post('/worksheet-templates/import-greenarea');
  return res.data;
}
