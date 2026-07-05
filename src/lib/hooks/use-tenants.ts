import useSWR from 'swr';
import { apiClient } from '../api-client';

export interface TenantFeatureFlags {
  notamEnabled: boolean;
  threeDEnabled: boolean;
  pdfAdvancedEnabled: boolean;
  crmEnabled: boolean;
  crmWorkflowsEnabled: boolean;
  crmInvoicingEnabled: boolean;
  crmExternalIntegrations: boolean;
  workOrdersEnabled: boolean;
  droneEnabled: boolean;
  internalTasksEnabled: boolean;
  meetingEnabled: boolean;
  fieldReportsEnabled: boolean;
  miniCrmImportEnabled: boolean;
  commissionEnabled: boolean;
}

export interface SidebarRolePolicy {
  hidden: string[];
}

export type SidebarPoliciesByRole = Partial<Record<
  'super_admin' | 'admin' | 'ceo' | 'manager' | 'operative' | 'client',
  SidebarRolePolicy
>>;

export interface TenantMetadata {
  sidebarPoliciesByRole?: SidebarPoliciesByRole;
  [key: string]: unknown;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  displayName?: string;
  logoUrl?: string;
  companyName?: string;
  address?: string;
  taxId?: string;
  registrationNumber?: string;
  ceoName?: string;
  defaultContactName?: string;
  defaultContactPhone?: string;
  defaultContactEmail?: string;
  defaultContactTitle?: string;
  warrantyTemplate?: string;
  defaultSignatory?: string;
  defaultSignatoryTitle?: string;
  defaultCurrency?: string;
  featureFlags?: TenantFeatureFlags;
  metadata?: TenantMetadata;
}

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

export function useTenant() {
  const { data, error, isLoading, mutate } = useSWR<Tenant>('/tenants/me', fetcher);
  return { tenant: data ?? null, error, isLoading, mutate };
}

export async function updateBranding(dto: {
  displayName?: string;
  logoUrl?: string;
}): Promise<Tenant> {
  const res = await apiClient.patch('/tenants/me/branding', dto);
  return res.data;
}

export async function updateCompanyProfile(dto: {
  companyName?: string;
  address?: string;
  taxId?: string;
  registrationNumber?: string;
  ceoName?: string;
  defaultContactName?: string;
  defaultContactPhone?: string;
  defaultContactEmail?: string;
  defaultContactTitle?: string;
  warrantyTemplate?: string;
  defaultSignatory?: string;
  defaultSignatoryTitle?: string;
  defaultCurrency?: string;
}): Promise<Tenant> {
  const res = await apiClient.patch('/tenants/me/company-profile', dto);
  return res.data;
}

export async function updateSidebarPolicies(patch: SidebarPoliciesByRole): Promise<Tenant> {
  const res = await apiClient.patch('/tenants/me/sidebar-policies', patch);
  return res.data;
}
