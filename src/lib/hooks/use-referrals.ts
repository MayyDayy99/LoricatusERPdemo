import useSWR from 'swr';
import { apiClient } from '../api-client';

export type ReferralStatus = 'pending' | 'converted' | 'expired' | 'revoked';

export interface Referral {
  id: string;
  tenantId: string;
  referrerUserId: string;
  token: string;
  status: ReferralStatus;
  expiresAt: string;
  recipientEmail?: string | null;
  recipientName?: string | null;
  note?: string | null;
  customerId?: string | null;
  registeredUserId?: string | null;
  sentAt?: string | null;
  convertedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralStats {
  converted: number;
  pending: number;
  expired: number;
  revoked: number;
  total: number;
}

export interface LeaderboardEntry {
  userId: string;
  firstName: string;
  lastName: string;
  converted: number;
}

const fetcher = async <T = unknown>(url: string): Promise<T> => {
  const res = await apiClient.get(url);
  return res.data;
};

export function useReferrals(filter?: { referrerUserId?: string; status?: ReferralStatus }) {
  const qs = new URLSearchParams();
  if (filter?.referrerUserId) qs.set('referrerUserId', filter.referrerUserId);
  if (filter?.status) qs.set('status', filter.status);
  const url = qs.toString() ? `/referrals?${qs.toString()}` : '/referrals';
  const { data, error, isLoading, mutate } = useSWR<Referral[]>(url, fetcher);
  return { referrals: data ?? [], error, isLoading, mutate };
}

export function useMyReferralStats() {
  const { data, error, isLoading, mutate } = useSWR<ReferralStats>('/referrals/stats/me', fetcher);
  return { stats: data, error, isLoading, mutate };
}

export function useReferrerStats(userId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ReferralStats>(
    userId ? `/referrals/users/${userId}/stats` : null,
    fetcher,
  );
  return { stats: data, error, isLoading, mutate };
}

export function useReferralLeaderboard() {
  const { data, error, isLoading, mutate } = useSWR<LeaderboardEntry[]>('/referrals/stats/leaderboard', fetcher);
  return { leaderboard: data ?? [], error, isLoading, mutate };
}

export async function createReferral(input: {
  recipientEmail?: string;
  recipientName?: string;
  note?: string;
  expiresInDays?: number;
}): Promise<Referral> {
  const res = await apiClient.post('/referrals', input);
  return res.data;
}

export async function revokeReferral(id: string): Promise<void> {
  await apiClient.delete(`/referrals/${id}`);
}

const STATUS_HU: Record<ReferralStatus, string> = {
  pending: 'Folyamatban',
  converted: 'Beváltva',
  expired: 'Lejárt',
  revoked: 'Visszavonva',
};
export function referralStatusLabel(s: ReferralStatus): string {
  return STATUS_HU[s] ?? s;
}

const STATUS_STYLES: Record<ReferralStatus, string> = {
  pending:   'bg-blue-50 text-blue-700 border-blue-200',
  converted: 'bg-green-50 text-green-700 border-green-200',
  expired:   'bg-gray-50 text-gray-500 border-gray-200',
  revoked:   'bg-red-50 text-red-600 border-red-200',
};
export function referralStatusBadgeClass(s: ReferralStatus): string {
  return STATUS_STYLES[s] ?? STATUS_STYLES.pending;
}
