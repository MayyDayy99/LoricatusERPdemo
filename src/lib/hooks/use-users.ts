import useSWR from 'swr';
import { apiClient } from '../api-client';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'ceo' | 'manager' | 'operative' | 'client';
  roleType?: 'operativ' | 'irodai' | 'mixed';
  displayColor?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  twoFactorEnabled: boolean;
  notificationPreferences: Record<string, boolean>;
  avatarUrl?: string | null;
}

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

export function useUsers() {
  const { data, error, isLoading, mutate } = useSWR('/users', fetcher);
  return { users: (data as User[]) ?? [], error, isLoading, mutate };
}

export function useCurrentUser() {
  const { data, error, isLoading, mutate } = useSWR<CurrentUser>('/auth/me', fetcher);
  return { currentUser: data ?? null, error, isLoading, mutate };
}

export async function createUser(params: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: string;
}): Promise<User> {
  const res = await apiClient.post('/users', params);
  return res.data;
}

export async function updateUserRole(id: string, role: string): Promise<User> {
  const res = await apiClient.patch(`/users/${id}/role`, { role });
  return res.data;
}

export async function updateProfile(
  id: string,
  data: { firstName?: string; lastName?: string; email?: string;
    roleType?: 'operativ' | 'irodai' | 'mixed'; displayColor?: string },
): Promise<User> {
  const res = await apiClient.patch(`/users/${id}`, data);
  return res.data;
}

export async function updatePreferences(
  id: string,
  prefs: Record<string, boolean>,
): Promise<User> {
  const res = await apiClient.patch(`/users/${id}/preferences`, { prefs });
  return res.data;
}

export async function setUserActive(id: string, isActive: boolean): Promise<User> {
  const res = await apiClient.patch(`/users/${id}/active`, { isActive });
  return res.data;
}

/**
 * Admin jelszó-visszaállítás. `newPassword` opcionális — ha nincs megadva,
 * a backend generál egy ideiglenes jelszót. A válasz a plaintext jelszót
 * tartalmazza (egyszer látható, az adminnak át kell adnia a felhasználónak).
 */
export async function resetUserPassword(
  id: string,
  newPassword?: string,
): Promise<{ password: string }> {
  const res = await apiClient.post(`/users/${id}/reset-password`,
    newPassword ? { newPassword } : {});
  return res.data;
}

// ── Avatar (profilkép) ─────────────────────────────────────────────────────

export async function uploadMyAvatar(file: File): Promise<User> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await apiClient.post('/users/me/avatar', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function deleteMyAvatar(): Promise<User> {
  const res = await apiClient.delete('/users/me/avatar');
  return res.data;
}

export function useMyAvatarUrl() {
  const { data, mutate } = useSWR<{ url: string | null }>('/users/me/avatar', fetcher);
  return { url: data?.url ?? null, mutate };
}
