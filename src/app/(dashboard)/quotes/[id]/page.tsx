'use client';

/**
 * Sprint-2 β₁ — Quote detail page (NEW).
 *
 * Tabs:
 *   - overview     : meta + customer + recipient + payment terms
 *   - line-items   : a quote tételsorai (lazy via /quotes/:id/line-items)
 *   - pdf          : PDF versions (generatedStorageKey jelez), generate/download
 *   - contracts    : auto-created contracts (metadata.sourceQuoteId === id)
 *   - work-orders  : workOrdersService.findAll({ quoteId })
 *   - audit        : <AuditTimeline resource="quote" resourceId={id} />
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  ArrowLeft, FileText, FileSignature, ClipboardList, Activity, Send,
  CheckCircle, XCircle, Download, RefreshCw, Loader2, User, Building2,
  Mail, Phone, Calendar, Banknote, Wrench, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/lib/hooks/use-t';
import {
  useQuote,
  sendQuote, acceptQuote, rejectQuote,
  generateQuotePdf, downloadQuotePdf,
  type QuoteState,
} from '@/lib/hooks/use-quotes';
import { AuditTimeline } from '@/components/audit/AuditTimeline';

// ─── State styling (kanonikus quote-lifecycle) ────────────────────────────────
const STATE_STYLES: Record<QuoteState, string> = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired:  'bg-yellow-100 text-yellow-700',
};

const fmt = (v?: number, c = 'HUF') =>
  v != null ? new Intl.NumberFormat('hu-HU').format(v) + ' ' + c : '—';

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unit?: string;
  section?: string;
  detailedDescription?: string;
  position: number;
}

interface ContractListItem {
  id: string;
  contractNumber: string;
  title: string;
  state: string;
  value?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  metadata?: { sourceQuoteId?: string };
}

interface WorkOrderListItem {
  id: string;
  workOrderNumber: string;
  state: string;
  location?: string;
  deadline?: string;
  quoteId?: string;
}

// ─── Sub: PDF version display ────────────────────────────────────────────────

interface PdfTabProps {
  quoteId: string;
  quoteNumber?: string;
  generatedStorageKey?: string;
  onRegenerated: () => void;
}

function PdfTab({ quoteId, quoteNumber, generatedStorageKey, onRegenerated }: PdfTabProps) {
  const t = useT();
  const [busy, setBusy] = useState<'generate' | 'download' | null>(null);
  const qx = t.quotes as Record<string, any>;
  const detailLabels = (qx.detail ?? {}) as Record<string, string>;

  const handleGenerate = async () => {
    setBusy('generate');
    try {
      await generateQuotePdf(quoteId);
      toast.success(t.common.saved);
      onRegenerated();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba'));
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    setBusy('download');
    try {
      await downloadQuotePdf(quoteId, quoteNumber);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">
        {detailLabels.pdfTitle ?? 'PDF dokumentum'}
      </h3>

      {generatedStorageKey ? (
        <div className="flex items-center justify-between border border-gray-100 rounded-lg p-3 bg-gray-50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            <div>
              <div className="text-sm font-medium text-gray-800">
                {quoteNumber ?? quoteId.slice(0, 8)}.pdf
              </div>
              <div className="text-xs text-gray-500 font-mono truncate max-w-md">
                {generatedStorageKey}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy === 'download'}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy === 'download' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            {t.quotes.downloadPdf}
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-400">
          {detailLabels.pdfMissing ?? 'Még nincs PDF generálva ehhez az árajánlathoz.'}
        </p>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={busy === 'generate'}
        className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white rounded-lg text-xs hover:bg-gray-700 disabled:opacity-50"
      >
        {busy === 'generate' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        {busy === 'generate' ? t.quotes.generatingPdf : t.quotes.generatePdf}
      </button>
    </div>
  );
}

// ─── Sub: Line items ──────────────────────────────────────────────────────────

function LineItemsTab({ quoteId, currency }: { quoteId: string; currency?: string }) {
  const t = useT();
  const { data: items, isLoading } = useSWR<LineItem[]>(
    `/quotes/${quoteId}/line-items`,
    fetcher,
  );

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-8 text-center">{t.common.loading}</div>;
  }
  if (!items || items.length === 0) {
    const detailLabels = (t.quotes as Record<string, any>).detail ?? {};
    return (
      <div className="text-sm text-gray-400 py-8 text-center">
        {detailLabels.lineItemsEmpty ?? 'Nincs tétel.'}
      </div>
    );
  }

  // Szekciók szerint csoportosítva (a CRM-quotes detail-panel-précedens szerint).
  const sections = Array.from(new Set(items.map((i) => i.section ?? '')));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-500">{t.quotes.descriptionPh.replace(' *', '')}</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-500">{t.quotes.quantityPh.replace(' *', '')}</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-500">{t.quotes.unitPricePh.replace(' *', '')}</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-500">{t.quotes.total}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sections.map((sec) => {
            const inSec = items.filter((i) => (i.section ?? '') === sec);
            return (
              <React.Fragment key={sec || 'default'}>
                {sec && (
                  <tr>
                    <td colSpan={4} className="px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-600">
                      {sec}
                    </td>
                  </tr>
                )}
                {inSec.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 text-gray-700">
                      {item.description}
                      {item.detailedDescription && (
                        <p className="text-gray-400 mt-0.5 text-[10px]">{item.detailedDescription}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {item.quantity}{item.unit ? ' ' + item.unit : ''}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {new Intl.NumberFormat('hu-HU').format(item.unitPrice)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      {new Intl.NumberFormat('hu-HU').format(item.totalPrice)} {currency ?? 'HUF'}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sub: Linked contracts (auto-create cascade) ──────────────────────────────

function LinkedContractsTab({ quoteId }: { quoteId: string }) {
  const t = useT();
  // A backend `/contracts` listája NEM tud `metadata->>sourceQuoteId` filterre
  // szűrni (Sprint-2 nem bővíti a Contracts API-t). Lehúzzuk az első 100
  // szerződést és a metadata.sourceQuoteId === id-re kliens-oldalon szűrünk —
  // ez az auto-create cascade-en max 1-2 elem. A `take=100` egyszerre fedi
  // az átlagos tenant-méretet, és a Linked-tab egy nézhető részhalmaz.
  const { data, isLoading } = useSWR<
    { items: ContractListItem[]; total: number } | ContractListItem[]
  >('/contracts?take=100', fetcher);

  const all: ContractListItem[] = Array.isArray(data) ? data : (data?.items ?? []);
  const linked = useMemo(
    () => all.filter((c) => c.metadata?.sourceQuoteId === quoteId),
    [all, quoteId],
  );

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-8 text-center">{t.common.loading}</div>;
  }
  const detailLabels = (t.quotes as Record<string, any>).detail ?? {};
  if (linked.length === 0) {
    return (
      <div className="text-sm text-gray-400 py-8 text-center">
        {detailLabels.linkedContractsEmpty ?? 'Nincs kapcsolódó szerződés.'}
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{t.contracts.colNumber}</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{t.contracts.colTitle}</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{t.contracts.colState}</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">{t.contracts.colValue}</th>
            <th className="px-3 py-2 w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {linked.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{c.contractNumber}</td>
              <td className="px-3 py-2 text-gray-900">{c.title}</td>
              <td className="px-3 py-2">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                  {c.state}
                </span>
              </td>
              <td className="px-3 py-2 text-right text-gray-700">{fmt(c.value, c.currency ?? 'HUF')}</td>
              <td className="px-3 py-2">
                <Link
                  href={`/contracts/${c.id}`}
                  className="text-gray-400 hover:text-brand-600"
                  aria-label="Open contract"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sub: Linked work orders ──────────────────────────────────────────────────

function LinkedWorkOrdersTab({ quoteId }: { quoteId: string }) {
  const t = useT();
  // /work-orders?quoteId=... — a Sprint-1 backend a quoteId-t fel-listázza.
  const { data, isLoading } = useSWR<
    { items: WorkOrderListItem[]; total: number } | WorkOrderListItem[]
  >(`/work-orders?quoteId=${encodeURIComponent(quoteId)}&take=100`, fetcher);

  const linked: WorkOrderListItem[] = Array.isArray(data) ? data : (data?.items ?? []);
  const detailLabels = (t.quotes as Record<string, any>).detail ?? {};

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-8 text-center">{t.common.loading}</div>;
  }
  if (linked.length === 0) {
    return (
      <div className="text-sm text-gray-400 py-8 text-center">
        {detailLabels.linkedWorkOrdersEmpty ?? 'Nincs kapcsolódó munkalap.'}
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{t.workOrders.colNumber}</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{t.workOrders.colLocation}</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{t.workOrders.colState}</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{t.workOrders.colDeadline}</th>
            <th className="px-3 py-2 w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {linked.map((wo) => (
            <tr key={wo.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{wo.workOrderNumber}</td>
              <td className="px-3 py-2 text-gray-900">{wo.location ?? '—'}</td>
              <td className="px-3 py-2">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                  {wo.state}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-gray-500">
                {wo.deadline ? new Date(wo.deadline).toLocaleDateString('hu-HU') : '—'}
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/work-orders/${wo.id}`}
                  className="text-gray-400 hover:text-brand-600"
                  aria-label="Open work order"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sub: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ quote }: { quote: any }) {
  const t = useT();
  const detailLabels = (t.quotes as Record<string, any>).detail ?? {};
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Customer card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <User className="w-4 h-4 text-gray-400" /> {t.quotes.colCustomer}
        </h3>
        {quote.customer ? (
          <Link
            href={`/customers/${quote.customer.id}`}
            className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-700 hover:underline text-sm"
          >
            {quote.customer.firstName} {quote.customer.lastName}
            {quote.customer.company && <span className="text-gray-400">· {quote.customer.company}</span>}
            <ExternalLink className="w-3 h-3" />
          </Link>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </div>

      {/* Validity / totals */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <Banknote className="w-4 h-4 text-gray-400" /> {detailLabels.totalsTitle ?? 'Összegzés'}
        </h3>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{t.quotes.subtotal}</span>
          <span className="text-gray-700">{fmt(quote.subtotal, quote.currency)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{t.quotes.tax} ({quote.taxRate ?? 27}%)</span>
          <span className="text-gray-700">{fmt(quote.taxAmount, quote.currency)}</span>
        </div>
        <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-200">
          <span>{t.quotes.total}</span>
          <span>{fmt(quote.totalAmount, quote.currency)}</span>
        </div>
        {quote.validUntil && (
          <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100">
            <span className="flex items-center gap-1 text-gray-500">
              <Calendar className="w-3.5 h-3.5" />
              {t.quotes.colValid}
            </span>
            <span className="text-gray-700">{new Date(quote.validUntil).toLocaleDateString('hu-HU')}</span>
          </div>
        )}
      </div>

      {/* Recipient */}
      {(quote.recipientName || quote.recipientCompany || quote.recipientEmail) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-1.5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-gray-400" /> {t.quotes.sectionRecipient}
          </h3>
          {quote.recipientName && (
            <div className="text-sm text-gray-700">{quote.recipientName}</div>
          )}
          {quote.recipientCompany && (
            <div className="text-xs text-gray-500">{quote.recipientCompany}</div>
          )}
          {quote.recipientEmail && (
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <Mail className="w-3 h-3" />{quote.recipientEmail}
            </div>
          )}
          {quote.recipientPhone && (
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <Phone className="w-3 h-3" />{quote.recipientPhone}
            </div>
          )}
        </div>
      )}

      {/* Payment terms */}
      {quote.paymentTerms && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <Wrench className="w-4 h-4 text-gray-400" /> {t.quotes.paymentTerms}
          </h3>
          <p className="text-xs text-gray-600 whitespace-pre-wrap">{quote.paymentTerms}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'line-items' | 'pdf' | 'contracts' | 'work-orders' | 'audit';

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const { quote, isLoading, error, mutate } = useQuote(id ?? null);

  const detailLabels = (t.quotes as Record<string, any>).detail ?? {};

  const handleAction = async (action: 'send' | 'accept' | 'reject') => {
    if (!id) return;
    setBusyAction(action);
    try {
      if (action === 'send')   await sendQuote(id);
      if (action === 'accept') await acceptQuote(id);
      if (action === 'reject') await rejectQuote(id);
      toast.success(t.common.saved);
      await mutate();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba'));
    } finally {
      setBusyAction(null);
    }
  };

  if (isLoading) return <div className="p-8 text-gray-400">{t.common.loading}</div>;
  if (error || !quote) {
    return (
      <div className="p-8 text-red-500">
        {detailLabels.loadError ?? 'Nem sikerült betölteni az árajánlatot.'}
      </div>
    );
  }

  const tabDefs: { id: Tab; key: string; icon: React.ReactNode }[] = [
    { id: 'overview',    key: 'overview',    icon: <User className="w-4 h-4" /> },
    { id: 'line-items',  key: 'lineItems',   icon: <FileText className="w-4 h-4" /> },
    { id: 'pdf',         key: 'pdf',         icon: <FileText className="w-4 h-4" /> },
    { id: 'contracts',   key: 'contracts',   icon: <FileSignature className="w-4 h-4" /> },
    { id: 'work-orders', key: 'workOrders',  icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'audit',       key: 'audit',       icon: <Activity className="w-4 h-4" /> },
  ];
  const tabLabels = (detailLabels.tabs ?? {}) as Record<string, string>;

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.push('/crm/quotes')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.quotes.title}
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-700 font-medium">{quote.quoteNumber ?? quote.title}</span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{quote.title}</h1>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATE_STYLES[quote.state as QuoteState] ?? 'bg-gray-100 text-gray-600'}`}>
                {(t.quotes.state as Record<string, string>)[quote.state] ?? quote.state}
              </span>
            </div>
            {quote.quoteNumber && (
              <div className="font-mono text-xs text-gray-500 mt-1">{quote.quoteNumber}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">{t.quotes.total}</div>
            <div className="text-xl font-bold text-gray-900">{fmt(quote.totalAmount, quote.currency)}</div>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
          {quote.state === 'draft' && (
            <button
              type="button"
              onClick={() => handleAction('send')}
              disabled={busyAction === 'send'}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {busyAction === 'send' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {t.quotes.sendBtn}
            </button>
          )}
          {quote.state === 'sent' && (
            <>
              <button
                type="button"
                onClick={() => handleAction('accept')}
                disabled={busyAction === 'accept'}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {busyAction === 'accept' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                {t.quotes.acceptBtn}
              </button>
              <button
                type="button"
                onClick={() => handleAction('reject')}
                disabled={busyAction === 'reject'}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {busyAction === 'reject' ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                {t.quotes.rejectBtn}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 flex-wrap">
          {tabDefs.map((tab) => {
            const label = tabLabels[tab.key] ?? tab.key;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
                  activeTab === tab.id
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview'    && <OverviewTab quote={quote} />}
        {activeTab === 'line-items'  && <LineItemsTab quoteId={quote.id} currency={quote.currency} />}
        {activeTab === 'pdf'         && (
          <PdfTab
            quoteId={quote.id}
            quoteNumber={quote.quoteNumber}
            generatedStorageKey={quote.generatedStorageKey}
            onRegenerated={() => mutate()}
          />
        )}
        {activeTab === 'contracts'   && <LinkedContractsTab quoteId={quote.id} />}
        {activeTab === 'work-orders' && <LinkedWorkOrdersTab quoteId={quote.id} />}
        {activeTab === 'audit'       && <AuditTimeline resource="quote" resourceId={quote.id} />}
      </div>
    </div>
  );
}
