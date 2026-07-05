import useSWR from 'swr';
import { apiClient } from '../api-client';

export interface TaskType {
  value: string;
  label: string;
  color: string;     // #RRGGBB
  sortIndex: number;
  /** Emoji-karakter a task-bar avatárján (esemény-szerű típusoknál). */
  icon?: string;
  /** Ha true: a task nem személyhez kötött (gepido, számlázás, TIG, várható kifizetés stb.). */
  isUnassigned?: boolean;
}

export interface TaskTypesResponse {
  taskTypes: TaskType[];
  isCustom: boolean;
}

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

export function useTaskTypes() {
  const { data, error, isLoading, mutate } = useSWR<TaskTypesResponse>(
    '/tenants/me/task-types',
    fetcher,
  );
  return {
    taskTypes: data?.taskTypes ?? null,
    isCustom: data?.isCustom ?? false,
    error,
    isLoading,
    mutate,
  };
}

export async function saveTaskTypes(taskTypes: TaskType[]): Promise<TaskTypesResponse> {
  const res = await apiClient.put('/tenants/me/task-types', { taskTypes });
  return res.data;
}

export async function resetTaskTypes(): Promise<TaskTypesResponse> {
  const res = await apiClient.delete('/tenants/me/task-types');
  return res.data;
}

/** Színt visszaadó helper a Gantt task-bar-okhoz. Ha a task-type nem szerepel
 *  a listában (pl. törölve lett), null-t ad vissza — a hívó projekt-színre eshet vissza. */
export function getTaskTypeColor(taskTypes: TaskType[] | null, value: string | undefined): string | null {
  if (!taskTypes || !value) return null;
  return taskTypes.find(t => t.value === value)?.color ?? null;
}

/** Label-helper a task-type értékhez. Ha nincs a listában, magát a value-t adja vissza. */
export function getTaskTypeLabel(taskTypes: TaskType[] | null, value: string | undefined): string {
  if (!taskTypes || !value) return value ?? '—';
  return taskTypes.find(t => t.value === value)?.label ?? value;
}

/** Emoji-ikon a task-type-hoz. Ha nincs beállítva, null-t ad vissza. A `gepido`
 *  hardcoded fallback megőrzi a visszafelé-kompat-it. */
export function getTaskTypeIcon(taskTypes: TaskType[] | null, value: string | undefined): string | null {
  if (!value) return null;
  const fromList = taskTypes?.find(t => t.value === value)?.icon;
  if (fromList) return fromList;
  if (value === 'gepido') return '⚙'; // hardcoded fallback
  return null;
}

/** Ha a task-type `isUnassigned`-flag-je true, nem személyhez kötött. A `gepido`
 *  hardcoded fallback — ha a tenant még nem frissítette a listát. */
export function isUnassignedTaskType(taskTypes: TaskType[] | null, value: string | undefined): boolean {
  if (!value) return false;
  const meta = taskTypes?.find(t => t.value === value);
  if (meta) return !!meta.isUnassigned;
  return value === 'gepido'; // fallback
}
