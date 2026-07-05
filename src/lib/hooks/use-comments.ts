import useSWR from 'swr';
import { apiClient } from '../api-client';

export type CommentTargetType = 'project' | 'crm_task';

export interface Comment {
  id: string;
  tenantId: string;
  targetType: CommentTargetType;
  targetId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
}

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

export function useComments(targetType: CommentTargetType | null, targetId: string | null) {
  const url = (targetType && targetId)
    ? `/comments?targetType=${targetType}&targetId=${targetId}`
    : null;
  const { data, error, isLoading, mutate } = useSWR<Comment[]>(url, fetcher);
  return { comments: data ?? [], error, isLoading, mutate };
}

export async function createComment(
  targetType: CommentTargetType, targetId: string, body: string,
): Promise<Comment> {
  const res = await apiClient.post('/comments', { targetType, targetId, body });
  return res.data;
}

export async function updateComment(id: string, body: string): Promise<Comment> {
  const res = await apiClient.patch(`/comments/${id}`, { body });
  return res.data;
}

export async function deleteComment(id: string): Promise<void> {
  await apiClient.delete(`/comments/${id}`);
}
