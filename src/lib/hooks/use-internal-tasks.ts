import useSWR from 'swr';
import { apiClient } from '../api-client';

export interface InternalTask {
  id: string;
  title: string;
  description?: string;
  category: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  assignedTo?: string;
  assignedToName?: string;
  dueDate?: string;
  recurring?: string;
  recurrenceConfig?: Record<string, unknown>;
  completedAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface CreateInternalTaskDto {
  title: string;
  description?: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high';
  assignedTo?: string;
  dueDate?: string;
  recurring?: string;
}

export function useInternalTasks(params?: { status?: string; category?: string; assignedTo?: string }) {
  const query = new URLSearchParams();
  if (params?.status)     query.set('status', params.status);
  if (params?.category)   query.set('category', params.category);
  if (params?.assignedTo) query.set('assignedTo', params.assignedTo);
  const qs = query.toString();

  const { data, error, mutate } = useSWR(
    `/internal-tasks${qs ? `?${qs}` : ''}`,
    (url: string) => apiClient.get(url).then(r => r.data),
  );

  return {
    tasks:   (data?.data ?? []) as InternalTask[],
    total:   (data?.total ?? 0) as number,
    loading: !error && !data,
    error,
    mutate,
  };
}

export async function createInternalTask(dto: CreateInternalTaskDto): Promise<InternalTask> {
  const r = await apiClient.post('/internal-tasks', dto);
  return r.data;
}

export async function updateInternalTask(id: string, dto: Partial<CreateInternalTaskDto>): Promise<InternalTask> {
  const r = await apiClient.patch(`/internal-tasks/${id}`, dto);
  return r.data;
}

export async function deleteInternalTask(id: string): Promise<void> {
  await apiClient.delete(`/internal-tasks/${id}`);
}

export async function transitionInternalTask(id: string, action: 'start' | 'complete' | 'cancel'): Promise<InternalTask> {
  const r = await apiClient.post(`/internal-tasks/${id}/${action}`);
  return r.data;
}
