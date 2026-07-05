import useSWR from 'swr';
import { apiClient } from '../api-client';

export interface ProjectWorkflowState {
  project: { id: string; name: string; state: string };
  quote: { id: string; state: string; acceptedAt: string | null } | null;
  workOrder: { id: string; state: string; itemCount: number; taskCount: number } | null;
  invoice: { id: string; state: string; paidAt: string | null } | null;
  commission: { id: string; status: string } | null;
}

const fetcher = (url: string) => apiClient.get(url).then(r => r.data);

/**
 * A /meeting ProjectModal-ban a quote/munkalap/task-ok/számla/jutalék
 * aggregált állapotát fogyasztja. Egy lekérés, hogy ne legyen N+1.
 */
export function useProjectWorkflowState(projectId: string | null | undefined) {
  const key = projectId ? `/projects/${projectId}/workflow-state` : null;
  const { data, error, isLoading, mutate } = useSWR<ProjectWorkflowState>(key, fetcher, {
    revalidateOnFocus: false,
  });
  return { state: data ?? null, error, isLoading, mutate };
}

export async function generateTasksFromWorkOrder(
  workOrderId: string,
  params: { projectId?: string; startDate: string; includeSubcontractor?: boolean },
): Promise<{
  createdCount: number; skippedCount: number;
  missingPricingItemCount: number; projectId: string;
}> {
  const res = await apiClient.post(`/work-orders/${workOrderId}/generate-tasks`, params);
  return res.data;
}

export async function getWorkOrderForQuote(quoteId: string): Promise<{ id: string } | null> {
  const res = await apiClient.get(`/work-orders?quoteId=${quoteId}&take=1`);
  const list = (res.data ?? []) as Array<{ id: string }>;
  return list[0] ?? null;
}

/** Munkalap összes DRAFT (PISZKOZAT) task-jának véglegesítése egy lépésben. */
export async function finalizeTasksForWorkOrder(workOrderId: string): Promise<{
  finalizedCount: number; projectId: string | null;
}> {
  const res = await apiClient.post(`/crm-tasks/finalize-by-work-order/${workOrderId}`);
  return res.data;
}
