import useSWR from 'swr';
import { apiClient } from '../api-client';

const fetcher = (url: string) => apiClient.get(url).then(r => r.data);

export interface ProjectQuote {
  id: string;
  quoteNumber: string;
  title: string;
  state: string;
  projectId?: string;
  customerId: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  priceLockedAt?: string;
  generatedStorageKey?: string;
  createdAt: string;
  // Loricatus 4-bontás audit: a recalculateTotals írja a metadata.pricing
  // mezőbe a subcontractor-felár adatokat.
  metadata?: {
    pricing?: {
      ownSubtotal?: number;
      subcontractorRaw?: number;
      subcontractorMarkup?: number;
      subcontractorMarkupAmount?: number;
    };
  } & Record<string, unknown>;
}

export interface QuoteLineItem {
  id: string;
  quoteId: string;
  position: number;
  description: string;
  section?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  pricingItemId?: string;
  isOwn?: boolean;
}


/** A projekthez tartozó (első, legfrissebb) árajánlat — vagy null, ha még nincs. */
export function useProjectQuote(projectId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ProjectQuote[]>(
    projectId ? `/quotes?projectId=${projectId}` : null,
    fetcher,
  );
  const quote = (data && data.length > 0) ? data[0] : null;
  return { quote, error, isLoading, mutate };
}

export function useQuoteLineItems(quoteId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<QuoteLineItem[]>(
    quoteId ? `/quotes/${quoteId}/line-items` : null,
    fetcher,
  );
  return { lineItems: data ?? [], error, isLoading, mutate };
}

export async function createProjectQuote(
  projectId: string, customerId: string, title: string,
): Promise<ProjectQuote> {
  const res = await apiClient.post('/quotes', { projectId, customerId, title });
  return res.data;
}

export async function addQuoteLineItem(quoteId: string, input: {
  description: string; unitPrice: number; quantity?: number;
  unit?: string; section?: string; pricingItemId?: string;
}): Promise<QuoteLineItem> {
  const res = await apiClient.post(`/quotes/${quoteId}/line-items`, input);
  return res.data;
}

export async function removeQuoteLineItem(quoteId: string, itemId: string): Promise<void> {
  await apiClient.delete(`/quotes/${quoteId}/line-items/${itemId}`);
}

export async function generateQuotePdf(quoteId: string): Promise<void> {
  await apiClient.post(`/quotes/${quoteId}/generate-pdf`);
}

export async function getQuotePdfUrl(quoteId: string): Promise<string> {
  const res = await apiClient.get(`/quotes/${quoteId}/pdf`);
  return res.data.url as string;
}

export async function exportQuoteToWorkOrder(quoteId: string): Promise<{ workOrderId: string }> {
  const res = await apiClient.post(`/quotes/${quoteId}/export-to-work-order`);
  return res.data;
}

/** Árajánlat elküldése az ügyfélnek (draft → sent). Opcionális e-mail-cím. */
export async function sendProjectQuote(quoteId: string, recipientEmail?: string): Promise<ProjectQuote> {
  const res = await apiClient.post(`/quotes/${quoteId}/send`, recipientEmail ? { recipientEmail } : {});
  return res.data;
}

/** Árajánlat elfogadottra állítása (sent → accepted). */
export async function acceptProjectQuote(quoteId: string): Promise<ProjectQuote> {
  const res = await apiClient.post(`/quotes/${quoteId}/accept`, {});
  return res.data;
}

/** Árajánlat elutasítása (sent → rejected). */
export async function rejectProjectQuote(quoteId: string): Promise<ProjectQuote> {
  const res = await apiClient.post(`/quotes/${quoteId}/reject`, {});
  return res.data;
}

/**
 * Árajánlat másolása — új DRAFT árajánlat ugyanazzal a megrendelővel/projekttel.
 * A tételeket NEM másolja (a backend /quotes csak a fej-adatokat hozza létre).
 */
export async function duplicateProjectQuote(quote: ProjectQuote): Promise<ProjectQuote> {
  const res = await apiClient.post('/quotes', {
    title: quote.title + ' (másolat)',
    customerId: quote.customerId,
    projectId: quote.projectId,
    currency: quote.currency,
    taxRate: quote.taxRate,
  });
  return res.data;
}
