import useSWR from 'swr';
import { apiClient } from '../api-client';

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

export interface MeetingTask {
  id: string;
  title: string;
  assignedTo: string;
  status: string;
  workOrderId?: string;
}

export interface MeetingTaskGroup {
  workOrderId: string;
  workOrderNumber: string;
  tasks: MeetingTask[];
}

export interface MeetingSession {
  id: string;
  tenantId: string;
  date: string;
  startedAt: string;
  closedAt?: string;
  closedBy?: string;
  createdBy: string;
}

export interface MeetingTodayResponse {
  session: MeetingSession | null;
  groups: MeetingTaskGroup[];
}

export function useMeetingToday() {
  const { data, error, isLoading, mutate } = useSWR<MeetingTodayResponse>(
    '/meeting/today',
    fetcher,
  );
  return {
    data: data ?? null,
    session: data?.session ?? null,
    groups: data?.groups ?? [],
    error,
    isLoading,
    mutate,
  };
}

export async function startMeeting(): Promise<MeetingSession> {
  const res = await apiClient.post('/meeting/start');
  return res.data;
}

export async function closeMeeting(): Promise<MeetingSession> {
  const res = await apiClient.post('/meeting/today/close');
  return res.data;
}

export async function updateMeetingTask(
  taskId: string,
  transition: 'complete' | 'start' | 'cancel',
): Promise<MeetingTask> {
  const res = await apiClient.patch(`/meeting/today/tasks/${taskId}`, { transition });
  return res.data;
}

export async function addMeetingTask(body: {
  title: string;
  assignedTo: string;
  workOrderId?: string;
  description?: string;
}): Promise<MeetingTask> {
  const res = await apiClient.post('/meeting/today/tasks', body);
  return res.data;
}
