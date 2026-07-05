import useSWR from 'swr';
import { apiClient } from '../api-client';

export interface DemoStatus {
  isSeeded: boolean;
  seededAt: string | null;
  counts: {
    pipelines: number;
    accounts: number;
    customers: number;
    projects: number;
    deals: number;
    quotes: number;
    workOrders: number;
    contracts: number;
    activities: number;
    crmTasks: number;
    timesheets: number;
    total: number;
  };
}

const fetcher = (url: string) =>
  apiClient.get<DemoStatus>(url).then((r) => r.data);

export function useDemoStatus() {
  const { data, error, isLoading, mutate } = useSWR<DemoStatus>(
    '/demo/status',
    fetcher,
    { revalidateOnFocus: false },
  );

  return { status: data, loading: isLoading, error, mutate };
}

export async function seedDemo(): Promise<DemoStatus> {
  const r = await apiClient.post<DemoStatus>('/demo/seed', {});
  return r.data;
}

export async function resetDemo(): Promise<DemoStatus> {
  const r = await apiClient.post<DemoStatus>('/demo/reset', {});
  return r.data;
}

export async function clearDemo(): Promise<{ deleted: number }> {
  const r = await apiClient.delete<{ deleted: number }>('/demo/clear');
  return r.data;
}
