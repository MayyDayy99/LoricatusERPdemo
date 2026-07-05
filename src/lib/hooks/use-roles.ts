import useSWR from 'swr';
import { apiClient } from '../api-client';

/* ── Types ────────────────────────────────────────────────────── */

export interface TenantRole {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  hierarchyLevel: number;
  color: string;
}

export interface PermissionOverride {
  id: string;
  userId: string;
  tenantId: string;
  permission: string;
  type: 'grant' | 'revoke';
}

/* ── Fetcher ──────────────────────────────────────────────────── */

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

/* ── Hooks ────────────────────────────────────────────────────── */

export function useRoles() {
  const { data, error, isLoading, mutate } = useSWR<TenantRole[]>('/roles', fetcher);
  return { roles: data ?? [], error, isLoading, mutate };
}

export function usePermissionOverrides() {
  const { data, error, isLoading, mutate } = useSWR<PermissionOverride[]>('/roles/overrides', fetcher);
  return { overrides: data ?? [], error, isLoading, mutate };
}

/* ── API calls ────────────────────────────────────────────────── */

export async function createRole(params: {
  name: string; slug: string; description?: string;
  permissions: string[]; hierarchyLevel?: number; color?: string;
}): Promise<TenantRole> {
  const res = await apiClient.post('/roles', params);
  return res.data;
}

export async function updateRolePermissions(id: string, permissions: string[]): Promise<TenantRole> {
  const res = await apiClient.patch(`/roles/${id}/permissions`, { permissions });
  return res.data;
}

export async function updateRole(id: string, params: {
  name?: string; description?: string; color?: string; hierarchyLevel?: number;
}): Promise<TenantRole> {
  const res = await apiClient.patch(`/roles/${id}`, params);
  return res.data;
}

export async function deleteRole(id: string): Promise<void> {
  await apiClient.delete(`/roles/${id}`);
}

export async function setPermissionOverride(
  userId: string, permission: string, type: 'grant' | 'revoke',
): Promise<PermissionOverride> {
  const res = await apiClient.post('/roles/overrides', { userId, permission, type });
  return res.data;
}

export async function removePermissionOverride(userId: string, permission: string): Promise<void> {
  await apiClient.delete('/roles/overrides', { data: { userId, permission } });
}
