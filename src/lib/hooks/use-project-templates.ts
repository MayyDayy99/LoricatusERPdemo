import useSWR from 'swr';
import { apiClient } from '../api-client';

export type ProjectTemplateStepType =
  | 'task' | 'work_order' | 'legter_range' | 'deadline_marker' | 'notification' | 'reminder';

export type ProjectTemplateAnchorKind =
  | 'project_created' | 'template_input' | 'step_start' | 'step_end' | 'range_workday_n';

export type ProjectTemplateOffsetUnit = 'calendar' | 'working' | 'hours';
export type ProjectTemplateOffsetDirection = 'before' | 'after' | 'on';

export interface ProjectTemplateInput {
  id?: string;
  inputKey: string;
  label: string;
  inputType?: 'date' | 'datetime' | 'user' | 'text';
  required?: boolean;
  sortIndex?: number;
}

export interface ProjectTemplateStep {
  id?: string;
  sortIndex: number;
  stepType: ProjectTemplateStepType;
  name: string;
  description?: string;
  anchorKind: ProjectTemplateAnchorKind;
  anchorInputKey?: string;
  anchorStepSortIndex?: number;
  anchorWorkdayN?: number;
  offsetValue?: number;
  offsetUnit?: ProjectTemplateOffsetUnit;
  offsetDirection?: ProjectTemplateOffsetDirection;
  durationValue?: number;
  durationUnit?: ProjectTemplateOffsetUnit;
  taskType?: string;
  equipmentIds?: string[];
  assigneeId?: string;
  assigneeEditable?: boolean;
  helperIds?: string[];
  worksheetTemplateId?: string;
  notificationRecipientId?: string;
  notificationTitle?: string;
  notificationBody?: string;
  deadlineLabel?: string;
  dayAnnotationType?: string;
  dependsOnStepSortIndex?: number;
  /** Párhuzamos sáv-index a Gantt-on (csak task-stepeknél). null/undefined = auto. */
  laneIndex?: number | null;
  config?: Record<string, unknown>;
}

export interface ProjectTemplate {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  color?: string;
  sortIndex: number;
  isArchived: boolean;
  inputs: ProjectTemplateInput[];
  steps: ProjectTemplateStep[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTemplateUpsertInput {
  name: string;
  description?: string;
  color?: string;
  sortIndex?: number;
  inputs?: ProjectTemplateInput[];
  steps?: ProjectTemplateStep[];
}

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

export function useProjectTemplates(includeArchived?: boolean) {
  const url = includeArchived
    ? '/project-templates?includeArchived=true'
    : '/project-templates';
  const { data, error, isLoading, mutate } = useSWR<ProjectTemplate[]>(url, fetcher);
  return { templates: data ?? [], error, isLoading, mutate };
}

export function useProjectTemplate(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ProjectTemplate>(
    id ? `/project-templates/${id}` : null,
    fetcher,
  );
  return { template: data, error, isLoading, mutate };
}

export async function createProjectTemplate(input: ProjectTemplateUpsertInput): Promise<ProjectTemplate> {
  const res = await apiClient.post('/project-templates', input);
  return res.data;
}

export async function updateProjectTemplate(id: string, input: ProjectTemplateUpsertInput): Promise<ProjectTemplate> {
  const res = await apiClient.patch(`/project-templates/${id}`, input);
  return res.data;
}

export async function archiveProjectTemplate(id: string): Promise<void> {
  await apiClient.post(`/project-templates/${id}/archive`);
}

export async function unarchiveProjectTemplate(id: string): Promise<void> {
  await apiClient.post(`/project-templates/${id}/unarchive`);
}

export async function deleteProjectTemplate(id: string): Promise<void> {
  await apiClient.delete(`/project-templates/${id}`);
}

export async function importGreenAreaTemplate(): Promise<ProjectTemplate> {
  const res = await apiClient.post('/project-templates/import-green-area');
  return res.data;
}
