/**
 * Sprint-2 β₁ — Quotes hook (kiemelve a use-crm.ts-ből).
 *
 * A Sprint-1 backend response-shape `{ items, total, take, skip }`-ra váltott.
 * A hook defenzíven kicsomagolja: Array.isArray(data) ? data : (data?.items ?? [])
 * — így a régi callerek (pl. customer-summary, CRM-dashboard) sem törnek el.
 *
 * Mutáció után minden CRUD revalidateQuoteScope-ot hív. A scope kiterjed a
 * /customers/:id/summary kulcsra is, mert az accept→contract auto-create cascade
 * miatt a 360° card-on rögtön frissül a contracts-tab.
 */
import useSWR, { mutate as swrMutate } from 'swr';
import { apiClient } from '../api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

export type QuoteState = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface QuoteListItem {
  id: string;
  quoteNumber?: string;
  title: string;
  state: QuoteState;
  totalAmount?: number;
  currency?: string;
  validUntil?: string;
  acceptedAt?: string;
  customerId?: string;
  customerName?: string;
  dealId?: string;
  projectId?: string;
  tags?: string[];
  createdAt: string;
}

interface UseQuotesOptions {
  state?: QuoteState | string;
  customerId?: string;
  dealId?: string;
  projectId?: string;
  search?: string;
  take?: number;
  skip?: number;
  /** Csak az alaprenderhez — a segment-meta szerverre küldhető filter-szettre
   *  fordul a hívó kódban; itt csak SWR-kulcs-érvény szempontból érdekes. */
  segmentId?: string;
}

interface QuoteListResponse {
  items: QuoteListItem[];
  total: number;
  take: number;
  skip: number;
}

// ─── Fetcher ─────────────────────────────────────────────────────────────────

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

function buildKey(base: string, filters: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === '' || v === null) continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

// ─── Scope-invalidate ────────────────────────────────────────────────────────
//
// Egy POST/PATCH/DELETE után ezt MINDEN quote-mutáció meghívja, hogy
//   1) a paginated /quotes? kulcsok mindegyike újratöltsön (filters.size variál),
//   2) az érintett customer-summary (recentQuotes) is frissüljön,
//   3) az accept→contract auto-create cascade nyomán a /contracts* is friss legyen.

interface RevalidateScopeOpts {
  quoteId?: string;
  customerId?: string;
  projectId?: string;
}

export function revalidateQuoteScope(_opts: RevalidateScopeOpts = {}) {
  // A /quotes prefix-ű listák (paginált, filter-variánsokkal) mind elavultak.
  void swrMutate(
    (key) => typeof key === 'string' && key.startsWith('/quotes'),
    undefined,
    { revalidate: true },
  );
  // Customer-summary (recentQuotes) — egy konkrét customer-é ha tudjuk, különben
  // előfordulhat, hogy a quote customer-szintű listájában megjelenik. Az
  // unmounted kulcsokat az SWR ignorálja, ezért biztonságos prefix-match.
  void swrMutate(
    (key) => typeof key === 'string' && key.startsWith('/customers/') && key.endsWith('/summary'),
    undefined,
    { revalidate: true },
  );
  // Contracts — egy accept-elt quote DRAFT contract-ot generál.
  void swrMutate(
    (key) => typeof key === 'string' && key.startsWith('/contracts'),
    undefined,
    { revalidate: true },
  );
  // CRM-dashboard widget-jei (openQuotesCount/Value, pendingQuotesCount, …).
  void swrMutate(
    (key) => typeof key === 'string' && key.startsWith('/analytics/crm-dashboard'),
    undefined,
    { revalidate: true },
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useQuotes(opts: UseQuotesOptions = {}) {
  const key = buildKey('/quotes', {
    state: opts.state,
    customerId: opts.customerId,
    dealId: opts.dealId,
    projectId: opts.projectId,
    search: opts.search?.trim() || undefined,
    take: opts.take,
    skip: opts.skip,
  });

  const { data, error, isLoading, mutate } = useSWR<QuoteListResponse | QuoteListItem[]>(
    key,
    fetcher,
    {
      // A bulk-update / state-shift után a hívó kód explicit `mutate()`-et
      // hív; ne dedup-eljünk, hogy az új DB-snapshot azonnal érkezzen.
      dedupingInterval: 0,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );

  const items: QuoteListItem[] = Array.isArray(data) ? data : (data?.items ?? []);
  const total: number = Array.isArray(data) ? data.length : (data?.total ?? 0);

  return {
    // Mind a két alias, mert a legacy hívók (pl. customer-summary view-k)
    // `quotes`-t használnak; a paginated list-page `items`+`total`-t.
    quotes: items,
    items,
    total,
    error,
    isLoading,
    mutate,
  };
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export interface CreateQuoteDto {
  title: string;
  customerId: string;
  dealId?: string;
  projectId?: string;
  validUntil?: string;
  taxRate?: number;
  currency?: string;
  notes?: string;
  paymentTerms?: string;
  quoteType?: string;
  worksheetTemplateId?: string;
  // …a teljes DTO többi mezőjét a hívó UI ráteszi a `payload`-ra; itt csak a
  // shape-jelzők szerepelnek a típusbiztonsághoz.
  [extra: string]: unknown;
}

export async function createQuote(dto: CreateQuoteDto) {
  const res = await apiClient.post('/quotes', dto);
  revalidateQuoteScope({
    quoteId: res.data?.id,
    customerId: res.data?.customerId ?? dto.customerId,
    projectId: res.data?.projectId ?? (dto.projectId as string | undefined),
  });
  return res.data;
}

export async function updateQuote(id: string, dto: Record<string, unknown>) {
  const res = await apiClient.patch(`/quotes/${id}`, dto);
  revalidateQuoteScope({
    quoteId: id,
    customerId: res.data?.customerId,
    projectId: res.data?.projectId,
  });
  return res.data;
}

export async function sendQuote(id: string, recipientEmail?: string) {
  const res = await apiClient.post(`/quotes/${id}/send`, recipientEmail ? { recipientEmail } : {});
  revalidateQuoteScope({
    quoteId: id,
    customerId: res.data?.customerId,
    projectId: res.data?.projectId,
  });
  return res.data;
}

export async function acceptQuote(id: string) {
  const res = await apiClient.post(`/quotes/${id}/accept`);
  revalidateQuoteScope({
    quoteId: id,
    customerId: res.data?.customerId,
    projectId: res.data?.projectId,
  });
  return res.data;
}

export async function rejectQuote(id: string) {
  const res = await apiClient.post(`/quotes/${id}/reject`);
  revalidateQuoteScope({
    quoteId: id,
    customerId: res.data?.customerId,
    projectId: res.data?.projectId,
  });
  return res.data;
}

export async function deleteQuote(id: string) {
  await apiClient.delete(`/quotes/${id}`);
  revalidateQuoteScope({ quoteId: id });
}

// ─── Bulk-update ────────────────────────────────────────────────────────────
//
// Backend BulkQuotePatchDto (Sprint-1): state | tag.
// FE-side ops:
//   stateToDraft → patch={state:'draft'}
//   tagAdd       → patch={tag:'<value>'}     (backend mode='add' a default)
//   tagRemove    → patch={tag:'<value>'}     (mode='remove' — N/A a current backend-en;
//                                             a backend implementation Sprint-1 alapján
//                                             single-tag-mode; remove-ot ezért egy
//                                             dedikált endpoint-on (ha lesz) intézzük,
//                                             addig csak hívunk).

export type QuoteBulkOp = 'stateToDraft' | 'tagAdd' | 'tagRemove' | 'delete';

export interface QuoteBulkPatch {
  /** Új állapot (csak DRAFT-ra engedélyezett a backend-en — Sprint-1-spec). */
  state?: QuoteState;
  /** Tag value (a backend single-string a Sprint-1 DTO szerint). */
  tag?: string;
}

export interface QuoteBulkResult {
  affected: number;
}

export async function bulkUpdateQuotes(
  ids: string[],
  patch: QuoteBulkPatch,
): Promise<QuoteBulkResult> {
  const res = await apiClient.post('/quotes/bulk-update', { ids, patch });
  revalidateQuoteScope();
  return res.data;
}

// ─── Egy quote betöltése (detail-page) ───────────────────────────────────────

export interface QuoteDetail extends QuoteListItem {
  subtotal?: number;
  taxAmount?: number;
  taxRate?: number;
  notes?: string;
  paymentTerms?: string;
  recipientName?: string;
  recipientCompany?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  scopeDescription?: string;
  projectLocation?: string;
  generatedStorageKey?: string;
  customer?: { id: string; firstName: string; lastName: string; company?: string };
  lineItems?: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    unit?: string;
    section?: string;
    detailedDescription?: string;
    position: number;
  }>;
}

export function useQuote(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<QuoteDetail>(
    id ? `/quotes/${id}` : null,
    fetcher,
  );
  return { quote: data ?? null, error, isLoading, mutate };
}

// ─── PDF helper ─────────────────────────────────────────────────────────────

export async function generateQuotePdf(id: string) {
  const res = await apiClient.post(`/quotes/${id}/generate-pdf`);
  revalidateQuoteScope({ quoteId: id });
  return res.data;
}

export async function downloadQuotePdf(id: string, quoteNumber?: string) {
  const res = await apiClient.get(`/quotes/${id}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${quoteNumber ?? id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
