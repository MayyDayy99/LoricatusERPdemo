import useSWR from 'swr';
import { apiClient } from '../api-client';

export interface ProjectLocation {
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  country: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  state: string;
  location?: ProjectLocation;
  tags?: string[];
  metadata?: Record<string, unknown>;
  startDate?: string;
  endDate?: string;
  categoryId?: string | null;
  statusId?: string | null;
  customerId?: string;
  customFieldsData?: Record<string, unknown>;
  managerId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
  sortIndex?: number;
}

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

export function useProjects(filter?: { categoryId?: string | null; includeArchived?: boolean; take?: number }) {
  const params = new URLSearchParams();
  if (filter?.categoryId === null) params.set('categoryId', 'null');
  else if (filter?.categoryId) params.set('categoryId', filter.categoryId);
  if (filter?.includeArchived) params.set('includeArchived', 'true');
  // Default 200 — a MiniCRM-szobákban 100+ projekt is lehet. A backend
  // findAll() Math.min(take, 200)-szal hard-cap-eli, így nem fogyaszt el extra
  // memóriát. Lapozós UI helyett a szoba-lista végtelen scroll-hoz nyúlik.
  params.set('take', String(filter?.take ?? 200));
  const qs = params.toString();
  const url = `/projects?${qs}`;
  const { data, error, isLoading, mutate } = useSWR(url, fetcher);
  return { projects: (data as Project[]) ?? [], error, isLoading, mutate };
}

export function useProject(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR(id ? `/projects/${id}` : null, fetcher);
  return { project: data as Project | undefined, error, isLoading, mutate };
}

export async function createProject(input: {
  name: string;
  description?: string;
  categoryId?: string;
  tags?: string[];
}): Promise<Project> {
  const res = await apiClient.post('/projects', input);
  return res.data;
}

export async function updateProject(
  id: string,
  updates: {
    name?: string;
    description?: string;
    location?: ProjectLocation;
    tags?: string[];
    metadata?: Record<string, unknown>;
    startDate?: string;
    endDate?: string;
    categoryId?: string | null;
    statusId?: string | null;
    customerId?: string;
    customFieldsData?: Record<string, unknown>;
  },
): Promise<Project> {
  const res = await apiClient.patch(`/projects/${id}`, updates);
  return res.data;
}

export async function deleteProject(id: string): Promise<void> {
  await apiClient.delete(`/projects/${id}`);
}

// ── Project categories ("szobák") ───────────────────────────────────────────

export type ProjectCategoryType =
  | 'ProjectManagement' | 'Sales' | 'Generic' | 'Implementation' | 'Order' | 'OfficeAdmin';

export interface PipelineStage {
  key: string;
  label: string;
  color?: string;
}

export interface ProjectCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  sortIndex: number;
  categoryType: ProjectCategoryType;
  defaultPipelineStages?: PipelineStage[];
  /** Új projekt létrehozásakor automatikusan generált munkalap-sablon ID-ja. */
  defaultWorksheetTemplateId?: string;
  /** Megjelenjen-e a kategória a Projekt mapen (false = csak Mai napom). */
  showInProjectMap?: boolean;
  projectCount: number;
}

export interface ProjectCategoryInput {
  name: string;
  color?: string;
  icon?: string;
  sortIndex?: number;
  categoryType?: ProjectCategoryType;
  defaultPipelineStages?: PipelineStage[];
  /** `null` = törlés (kategória ne adjon sablont többé). */
  defaultWorksheetTemplateId?: string | null;
  showInProjectMap?: boolean;
}

export function useProjectCategories() {
  const { data, error, isLoading, mutate } = useSWR<ProjectCategory[]>(
    '/projects/categories',
    fetcher,
  );
  return {
    categories: data ?? [],
    error,
    isLoading,
    mutate,
  };
}

export async function createProjectCategory(input: ProjectCategoryInput): Promise<ProjectCategory> {
  const res = await apiClient.post('/projects/categories', input);
  return res.data;
}

/**
 * "Drón ügyintézés" szoba seedelése — kategória + 7 doboz + ~30 mező a
 * MiniCRM-adatlap mintájára. Idempotens: ha létezik, nem duplikál.
 */
export async function seedDroneRoom(): Promise<{ categoryId: string; created: boolean }> {
  const res = await apiClient.post('/projects/categories/seed-drone-room');
  return res.data;
}

/**
 * Drón repülések → szobák konverzió. Minden DroneOperation-ből 1:1 projekt-
 * szoba a "Drón ügyintézés" kategóriában + hírfolyam-backfill. Idempotens
 * (a már konvertált repüléseket kihagyja). A kategóriát maga seedeli, ha kell.
 */
export async function convertDroneOperations(): Promise<{
  created: number; skipped: number; linkedActivities: number; errors: string[];
}> {
  const res = await apiClient.post('/projects/categories/convert-drone-operations');
  return res.data;
}

export async function updateProjectCategory(
  id: string,
  patch: Partial<ProjectCategoryInput>,
): Promise<ProjectCategory> {
  const res = await apiClient.patch(`/projects/categories/${id}`, patch);
  return res.data;
}

export async function deleteProjectCategory(id: string): Promise<void> {
  await apiClient.delete(`/projects/categories/${id}`);
}

// ── Project state transition ────────────────────────────────────────────────

export async function transitionProject(id: string, transition: string): Promise<Project> {
  const res = await apiClient.patch(`/projects/${id}/transition`, { transition });
  return res.data;
}

// ── Activity feed (audit log) ───────────────────────────────────────────────

export interface ActivityEntry {
  id: string;
  action: string;
  resource?: string;
  resourceId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export function useProjectActivity(projectId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ActivityEntry[]>(
    projectId ? `/projects/${projectId}/activity` : null,
    fetcher,
  );
  return { entries: data ?? [], error, isLoading, mutate };
}

// ── Task templates per category ──────────────────────────────────────────────

export interface TaskTemplate {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  taskType: string;
  priority: string;
  defaultDueOffsetDays?: number;
  sortIndex: number;
}

export interface TaskTemplateInput {
  name: string;
  description?: string;
  taskType?: string;
  priority?: string;
  defaultDueOffsetDays?: number;
  sortIndex?: number;
}

export function useTaskTemplates(categoryId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<TaskTemplate[]>(
    categoryId ? `/projects/categories/${categoryId}/task-templates` : null,
    fetcher,
  );
  return { templates: data ?? [], error, isLoading, mutate };
}

export async function createTaskTemplate(categoryId: string, input: TaskTemplateInput): Promise<TaskTemplate> {
  const res = await apiClient.post(`/projects/categories/${categoryId}/task-templates`, input);
  return res.data;
}

export async function updateTaskTemplate(id: string, patch: Partial<TaskTemplateInput>): Promise<TaskTemplate> {
  const res = await apiClient.patch(`/projects/task-templates/${id}`, patch);
  return res.data;
}

export async function deleteTaskTemplate(id: string): Promise<void> {
  await apiClient.delete(`/projects/task-templates/${id}`);
}

// ── Adatlap-séma: dobozok + egyedi mezők ────────────────────────────────────

export type CustomFieldType =
  | 'text' | 'textarea' | 'number' | 'date' | 'boolean' | 'select'
  | 'multiselect' | 'file' | 'user';

/** A `file` típusú mező értéke a projekt customFieldsData JSONB-jében.
 *  A meglévő chunked upload-rendszerre mutat (uploads modul); a letöltési
 *  URL-t megjelenítéskor a getDownloadUrl(uploadId) oldja fel. */
export interface CustomFieldFileValue {
  uploadId: string;
  name: string;
  size?: number;
}

export interface CustomFieldDef {
  id: string;
  categoryId: string;
  boxId: string;
  fieldKey: string;
  label: string;
  fieldType: CustomFieldType;
  required: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  sortIndex: number;
}

export interface CustomFieldInput {
  boxId: string;
  fieldKey: string;
  label: string;
  fieldType?: CustomFieldType;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  sortIndex?: number;
}

export interface FieldBox {
  id: string;
  categoryId: string;
  title: string;
  icon?: string;
  collapsedByDefault: boolean;
  sortIndex: number;
}

export interface FieldBoxWithFields extends FieldBox {
  fields: CustomFieldDef[];
}

// ── Project statuses (testreszabható projekt-státusz: címke + szín) ─────────

export interface ProjectStatus {
  id: string;
  name: string;
  color: string;
  sortIndex: number;
  projectCount: number;
}

export interface ProjectStatusInput {
  name: string;
  color?: string;
  sortIndex?: number;
}

export function useProjectStatuses() {
  const { data, error, isLoading, mutate } = useSWR<ProjectStatus[]>(
    '/projects/statuses',
    fetcher,
  );
  return { statuses: data ?? [], error, isLoading, mutate };
}

export async function createProjectStatus(input: ProjectStatusInput): Promise<ProjectStatus> {
  const res = await apiClient.post('/projects/statuses', input);
  return res.data;
}

export async function updateProjectStatus(
  id: string,
  patch: Partial<ProjectStatusInput>,
): Promise<ProjectStatus> {
  const res = await apiClient.patch(`/projects/statuses/${id}`, patch);
  return res.data;
}

export async function deleteProjectStatus(id: string): Promise<void> {
  await apiClient.delete(`/projects/statuses/${id}`);
}

export async function reorderProjectStatuses(orderedIds: string[]): Promise<void> {
  await apiClient.patch('/projects/statuses/reorder', { orderedIds });
}

export interface FieldBoxInput {
  title: string;
  icon?: string;
  collapsedByDefault?: boolean;
  sortIndex?: number;
}

/** A kategória teljes adatlap-sémája: dobozok sorrendben, mindegyikben a mezői. */
export function useFieldLayout(categoryId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<FieldBoxWithFields[]>(
    categoryId ? `/projects/categories/${categoryId}/field-layout` : null,
    fetcher,
  );
  return { boxes: data ?? [], error, isLoading, mutate };
}

// — Dobozok —

export async function createFieldBox(categoryId: string, input: FieldBoxInput): Promise<FieldBox> {
  const res = await apiClient.post(`/projects/categories/${categoryId}/field-boxes`, input);
  return res.data;
}

export async function updateFieldBox(id: string, patch: Partial<FieldBoxInput>): Promise<FieldBox> {
  const res = await apiClient.patch(`/projects/field-boxes/${id}`, patch);
  return res.data;
}

export async function deleteFieldBox(id: string): Promise<void> {
  await apiClient.delete(`/projects/field-boxes/${id}`);
}

export async function reorderFieldBoxes(categoryId: string, orderedIds: string[]): Promise<void> {
  await apiClient.patch(`/projects/categories/${categoryId}/field-boxes/reorder`, { orderedIds });
}

// — Mezők —

export async function createCustomField(categoryId: string, input: CustomFieldInput): Promise<CustomFieldDef> {
  const res = await apiClient.post(`/projects/categories/${categoryId}/custom-fields`, input);
  return res.data;
}

export async function updateCustomField(
  id: string,
  patch: Partial<Omit<CustomFieldInput, 'fieldKey' | 'boxId'>>,
): Promise<CustomFieldDef> {
  const res = await apiClient.patch(`/projects/custom-fields/${id}`, patch);
  return res.data;
}

export async function deleteCustomField(id: string): Promise<void> {
  await apiClient.delete(`/projects/custom-fields/${id}`);
}

/** Mező áthelyezése másik dobozba (drag-drop dobozok között). */
export async function moveCustomField(id: string, boxId: string, sortIndex?: number): Promise<CustomFieldDef> {
  const res = await apiClient.patch(`/projects/custom-fields/${id}/move`, { boxId, sortIndex });
  return res.data;
}

/** Egy dobozon belüli mező-sorrend átírása. */
export async function reorderCustomFields(boxId: string, orderedIds: string[]): Promise<void> {
  await apiClient.patch(`/projects/custom-fields/reorder`, { boxId, orderedIds });
}
