import useSWR, { mutate as globalMutate } from 'swr';
import { apiClient } from '../api-client';
import { useDashboardStream } from './use-dashboard';

export type CommissionStatus = 'pending' | 'earned' | 'lost' | 'payable' | 'paid';

export interface CommissionRecord {
  id: string;
  tenantId: string;
  projectId: string;
  projectName?: string;
  quoteId?: string;
  baseFeeHuf: number;
  suggestedDays: number;
  plannedDays: number;
  perHeadHuf: number;
  status: CommissionStatus;
  earnedAt?: string;
  payableAt?: string;
  paidAt?: string;
  paidBy?: string;
  monthBucket?: string;
  lastComputedAt: string;
  computation: Record<string, unknown>;
}

export interface CommissionSettings {
  tenantId: string;
  commissionRatio: number;
  dailyRateHuf: number;
  workforceSize: number;
  monthlyBaseSalaryHuf?: number;
  // Z (listaár) 4-bontás. Összegnek = 1.0.
  ratioCost?: number;          // önköltség (X), default 0.55
  ratioProfit?: number;        // fedezet, default 0.20
  ratioCommission?: number;    // jutalék, default 0.05 (= commissionRatio)
  ratioOverhead?: number;      // rezsi, default 0.20
  // Alvállalkozói felár (Loricatus_ár = alvállalkozó_díj × markup).
  subcontractorMarkup?: number; // default 1.20
  // Milestone-offset hónapban (jutalék-folyamat: Ügyfél-kifizetés / Jutalék-kifizetés).
  customerPaymentOffsetMonths?: number; // default 1
  commissionPayoutOffsetMonths?: number; // default 2
}

export interface CommissionMonthlySummary {
  earnedCount: number;
  paidCount: number;
  lostCount: number;
  pendingCount: number;
  totalPayableHuf: number;
  totalPaidHuf: number;
  totalPayableCompanyHuf?: number;
  totalPaidCompanyHuf?: number;
  totalRoundingRemainderHuf?: number;
  monthlyBaseSalaryHuf?: number;
  totalGrossHuf?: number;
}

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

export function useCommissionList(filters?: { status?: CommissionStatus; year?: number; month?: number }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.year) params.set('year', String(filters.year));
  if (filters?.month) params.set('month', String(filters.month));
  const query = params.toString();
  const key = `/commission/list${query ? `?${query}` : ''}`;
  const { data, error, isLoading, mutate } = useSWR<CommissionRecord[]>(key, fetcher);
  // LOW-7: másik tab vagy háttér-event (invoice→payable) → realtime SSE-refresh.
  useDashboardStream((type) => {
    if (type === 'commission.changed') {
      void mutate();
      void globalMutate((k) => typeof k === 'string' && k.startsWith('/commission/monthly-summary'));
    }
  });
  return { records: data ?? [], error, isLoading, mutate };
}

export function useCommissionMonthlySummary(year: number, month: number) {
  const key = `/commission/monthly-summary?year=${year}&month=${month}`;
  const { data, error, isLoading, mutate } = useSWR<CommissionMonthlySummary>(key, fetcher);
  useDashboardStream((type) => {
    if (type === 'commission.changed') void mutate();
  });
  return { summary: data, error, isLoading, mutate };
}

export function useCommissionSettings() {
  const { data, error, isLoading, mutate } = useSWR<CommissionSettings>('/commission/settings', fetcher);
  return { settings: data, error, isLoading, mutate };
}

export function useCommissionForProject(projectId: string | null) {
  const key = projectId ? `/commission/projects/${projectId}` : null;
  const { data, error, isLoading, mutate } = useSWR<CommissionRecord | null>(key, fetcher);
  return { commission: data, error, isLoading, mutate };
}

export async function updateCommissionSettings(patch: Partial<Pick<CommissionSettings,
  'commissionRatio' | 'dailyRateHuf' | 'workforceSize' | 'monthlyBaseSalaryHuf' |
  'ratioCost' | 'ratioProfit' | 'ratioCommission' | 'ratioOverhead' | 'subcontractorMarkup' |
  'customerPaymentOffsetMonths' | 'commissionPayoutOffsetMonths'>>) {
  return apiClient.put('/commission/settings', patch).then((r) => r.data);
}

export async function markCommissionPaid(commissionId: string): Promise<CommissionRecord> {
  return apiClient.post(`/commission/${commissionId}/mark-paid`).then((r) => r.data);
}

export async function recomputeCommission(projectId: string): Promise<{ ok: boolean }> {
  return apiClient.post(`/commission/projects/${projectId}/recompute`).then((r) => r.data);
}
