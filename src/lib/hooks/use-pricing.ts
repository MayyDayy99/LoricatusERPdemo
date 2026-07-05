import useSWR from 'swr';
import { apiClient } from '../api-client';

const fetcher = (url: string) => apiClient.get(url).then(r => r.data);

// ── Típusok ──────────────────────────────────────────────────────────────────

export type CalcMode = 'multiply' | 'percent';
export type PercentBasis = 'subtotal' | 'group';

/** Egy Árazógép-tétel metadata-ja a %-számítás + dinamikus oszlop-értékek tárhelye. */
export interface PricingItemMetadata {
  calcMode?: CalcMode;
  percentValue?: number;
  percentBasis?: PercentBasis;
  [columnKey: string]: unknown; // dinamikus oszlop-értékek
}

export interface PricingItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
  unit?: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  groupId?: string;
  section?: string;
  catalogCode?: string;
  sortOrder: number;
  inputType: string;
  isTemplate: boolean;
  priceVersion?: string;
  metadata: PricingItemMetadata;
  /** Jutalékrendszer: Y (true, saját munka — keretbe számít) vagy X (false, alvállalkozó). */
  defaultIsOwn?: boolean;
  /** Becsült ráfordítás per egység, percben. A draft-task-generálás 480 perc/nap-pal számol. */
  defaultEstimatedMinutes?: number;
}

export interface PricingGroup {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

export type PricingColumnType = 'text' | 'number' | 'currency';
export interface PricingColumn {
  key: string;
  label: string;
  type: PricingColumnType;
  fixed: boolean;
  sortIndex: number;
}

// ── Hookok ───────────────────────────────────────────────────────────────────

/** Az Árazógép katalógus-tételei (isTemplate=true). */
export function usePricingItems() {
  const { data, error, isLoading, mutate } = useSWR<PricingItem[]>('/pricing/catalog', fetcher);
  return { items: data ?? [], error, isLoading, mutate };
}

export function usePricingGroups() {
  const { data, error, isLoading, mutate } = useSWR<PricingGroup[]>('/pricing/groups', fetcher);
  return { groups: data ?? [], error, isLoading, mutate };
}

export function usePricingColumns() {
  const { data, error, isLoading, mutate } = useSWR<{ columns: PricingColumn[]; isCustom: boolean }>(
    '/tenants/me/pricing-columns', fetcher,
  );
  return { columns: data?.columns ?? [], isCustom: data?.isCustom ?? false, error, isLoading, mutate };
}

// ── Tétel-mutációk ───────────────────────────────────────────────────────────

export interface PricingItemInput {
  name: string;
  unit?: string;
  unitPrice: number;
  quantity?: number;
  groupId?: string;
  metadata?: PricingItemMetadata;
  isTemplate?: boolean;
  defaultIsOwn?: boolean;
  defaultEstimatedMinutes?: number;
}

export async function createPricingItem(input: PricingItemInput): Promise<PricingItem> {
  const res = await apiClient.post('/pricing', { ...input, isTemplate: input.isTemplate ?? true });
  return res.data;
}

export async function updatePricingItem(id: string, patch: Partial<PricingItemInput>): Promise<PricingItem> {
  const res = await apiClient.patch(`/pricing/${id}`, patch);
  return res.data;
}

export async function deletePricingItem(id: string): Promise<void> {
  await apiClient.delete(`/pricing/${id}`);
}

export async function reorderPricingItems(orderedIds: string[]): Promise<void> {
  await apiClient.post('/pricing/items/reorder', { orderedIds });
}

// ── Csoport-mutációk ─────────────────────────────────────────────────────────

export async function createPricingGroup(name: string, color?: string): Promise<PricingGroup> {
  const res = await apiClient.post('/pricing/groups', { name, color });
  return res.data;
}

export async function updatePricingGroup(id: string, patch: { name?: string; color?: string }): Promise<PricingGroup> {
  const res = await apiClient.patch(`/pricing/groups/${id}`, patch);
  return res.data;
}

export async function deletePricingGroup(id: string): Promise<void> {
  await apiClient.delete(`/pricing/groups/${id}`);
}

export async function reorderPricingGroups(orderedIds: string[]): Promise<void> {
  await apiClient.post('/pricing/groups/reorder', { orderedIds });
}

// ── Oszlop-séma ──────────────────────────────────────────────────────────────

export async function setPricingColumns(columns: PricingColumn[]): Promise<void> {
  await apiClient.put('/tenants/me/pricing-columns', { columns });
}

// ── Tömeges ár-módosítás + katalógus-seed ────────────────────────────────────

export async function bulkAdjustPrices(opts: {
  percentageChange?: number;
  section?: string;
  newVersion: string;
}): Promise<{ updated: number }> {
  const res = await apiClient.post('/pricing/catalog/adjust-prices', opts);
  return res.data;
}

export async function seedPricingCatalog(priceVersion?: string): Promise<{ created: number; skipped: number }> {
  const res = await apiClient.post('/pricing/catalog/seed', { priceVersion });
  return res.data;
}
