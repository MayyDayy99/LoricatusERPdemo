'use client';

/**
 * Boost Sprint 2 — β₂ / detail-oldal: szerződés-fókuszú részletes nézet.
 *
 * A customer-precedensre épít (apps/web/src/app/(dashboard)/customers/[id]/page.tsx):
 *  - header + state-badge + lifecycle-action gombok (activate/expire/terminate);
 *  - 6 tab: Overview / PDF / Source-quote / Linked-work-orders / Linked-invoices /
 *    Audit-timeline;
 *  - a Source-quote tab a contract.metadata.sourceQuoteId-ból nyit linket + summary;
 *  - a Linked-work-orders/invoices tab a `customerId`+`projectId` kombinációra
 *    szűr (a két FK együtt adja meg, hogy mely entitások tartoznak a szerződéshez);
 *  - a TerminateModal ugyanaz, mint a lista-oldalon (reason-textarea), a
 *    háttér-listener a sendContractExpired email-t küld a customer-recipientre.
 *
 * Megj: a Linked-invoices a kanonikus `GET /invoices?customerId=` filter-en megy;
 * ha a szerződéshez nincs customerId mezőzve, üres állapotot mutatunk.
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import {
  ArrowLeft, FileText, FileSignature, FileDown, Activity,
  ClipboardList, Receipt, CheckCircle2, Clock, XCircle, Building2,
  Calendar, Tag, AlertTriangle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/lib/hooks/use-t';
import { useCustomer } from '@/lib/hooks/use-crm';
import {
  useContract,
  activateContract,
  expireContract,
  terminateContract,
  generateContractPdf,
  downloadContractPdf,
} from '@/lib/hooks/use-contracts';
import { CONTRACT_STATE_STYLES } from '@/lib/contract-lifecycle';
import { AuditTimeline } from '@/components/audit/AuditTimeline';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('hu-HU') : '—';
const fmtValue = (n?: number | null, cur = 'HUF') =>
  n !== undefined && n !== null
    ? `${new Intl.NumberFormat('hu-HU').format(n)} ${cur}`
    : '—';
const daysUntil = (d?: string | null) =>
  d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;

// ─── Light-weight types a linked-listák UI-hoz ───────────────────────────────

interface LinkedWorkOrder {
  id: string;
  workOrderNumber: string;
  state: string;
  location?: string;
  deadline?: string;
  responsiblePerson?: string;
  createdAt: string;
}

interface LinkedInvoice {
  id: string;
  invoiceNumber: string;
  state: string;
  totalAmount?: number;
  paidAmount?: number;
  currency?: string;
  dueDate?: string;
  createdAt: string;
}

interface SourceQuoteSummary {
  id: string;
  quoteNumber?: string;
  title: string;
  state: string;
  totalAmount?: number;
  currency?: string;
  validUntil?: string;
  createdAt: string;
}

/** Backend response unwrap — `{ items, total, take, skip }` (Sprint 1 shape)
 *  VAGY legacy tömb (lásd useContracts/useCustomers defenzív kiegészítését). */
function unwrapItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && 'items' in (data as any)) {
    return ((data as any).items ?? []) as T[];
  }
  return [];
}

// ─── TerminateModal ──────────────────────────────────────────────────────────
// Ugyanaz a shape, mint a lista-oldali — a reason textarea-t küldjük a backend-re.

function TerminateModal({
  id,
  onClose,
  onDone,
}: {
  id: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await terminateContract(id, reason || undefined);
      onDone();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba történt a felmondás során.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-3">{t.contracts.terminateTitle}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={3}
            placeholder={t.contracts.reasonPh} value={reason}
            onChange={(e) => setReason(e.target.value)} />
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600">{t.common.cancel}</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {loading ? t.common.terminating : t.contracts.terminate}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── InfoRow ─────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
      <div className="text-gray-400 mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-gray-400">{label}</div>
        <div className="text-sm text-gray-800 break-words">{value}</div>
      </div>
    </div>
  );
}

// ─── Tab content components ──────────────────────────────────────────────────

const INVOICE_STATE_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', issued: 'bg-blue-100 text-blue-700',
  sent: 'bg-cyan-100 text-cyan-700', paid: 'bg-green-100 text-green-700',
  partially_paid: 'bg-teal-100 text-teal-700', overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400', credited: 'bg-purple-100 text-purple-700',
};

const WO_STATE_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', active: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700', archived: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};

const QUOTE_STATE_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600',
  EXPIRED: 'bg-yellow-100 text-yellow-700',
};

// ─── PDF tab ─────────────────────────────────────────────────────────────────

function PdfTab({ contractId, hasPdf, onChanged }: {
  contractId: string;
  hasPdf: boolean;
  onChanged: () => void;
}) {
  const t = useT();
  const cx = t.contracts as Record<string, any>;
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await generateContractPdf(contractId);
      onChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba a PDF generálásakor.'));
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      const { url } = await downloadContractPdf(contractId);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba a PDF letöltésekor.'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <FileDown className="w-5 h-5 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700">{cx.pdf?.title ?? 'PDF dokumentum'}</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {hasPdf
          ? cx.pdf?.hasFile ?? 'A szerződés PDF-je elérhető. Töltsd le vagy generálj újat.'
          : cx.pdf?.noFile ?? 'Még nincs generált PDF. Kattints a "PDF generálása" gombra.'}
      </p>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>
      )}
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={handleGenerate} disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
          <FileSignature className="w-4 h-4" />
          {generating ? (cx.pdf?.generating ?? 'Generálás…') : (cx.pdf?.generateBtn ?? 'PDF generálása')}
        </button>
        {hasPdf && (
          <button type="button" onClick={handleDownload} disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
            <FileDown className="w-4 h-4" />
            {downloading ? (cx.pdf?.downloading ?? 'Letöltés…') : (cx.pdf?.downloadBtn ?? 'PDF letöltése')}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Source-quote tab ────────────────────────────────────────────────────────

function SourceQuoteTab({ quoteId }: { quoteId?: string }) {
  const t = useT();
  const cx = t.contracts as Record<string, any>;
  const { data: quote, error, isLoading } = useSWR<SourceQuoteSummary>(
    quoteId ? `/quotes/${quoteId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  if (!quoteId) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">
          {cx.sourceQuote?.none ?? 'Ez a szerződés nem ajánlatból készült.'}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="py-8 text-center text-gray-400 text-sm">{t.common.loading}</div>;
  }

  if (error || !quote) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-500">
        {cx.sourceQuote?.notFound ?? 'A forrás-ajánlat nem található (lehet, hogy törölve lett).'}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          {cx.sourceQuote?.title ?? 'Forrás-ajánlat'}
        </h3>
        <Link
          href={`/crm/quotes?id=${quote.id}`}
          className="text-xs text-brand-600 hover:underline"
        >
          {cx.sourceQuote?.viewBtn ?? 'Megnyitás'}
        </Link>
      </div>
      <div className="space-y-1">
        <InfoRow
          icon={<FileText className="w-4 h-4" />}
          label={cx.sourceQuote?.numberLabel ?? 'Árajánlat-szám'}
          value={quote.quoteNumber ?? '—'}
        />
        <InfoRow
          icon={<FileText className="w-4 h-4" />}
          label={cx.sourceQuote?.titleLabel ?? 'Cím'}
          value={quote.title}
        />
        <InfoRow
          icon={<Tag className="w-4 h-4" />}
          label={cx.sourceQuote?.stateLabel ?? 'Állapot'}
          value={(
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${QUOTE_STATE_STYLES[quote.state] ?? 'bg-gray-100 text-gray-600'}`}>
              {quote.state}
            </span>
          )}
        />
        <InfoRow
          icon={<Receipt className="w-4 h-4" />}
          label={cx.sourceQuote?.amountLabel ?? 'Összeg'}
          value={fmtValue(quote.totalAmount, quote.currency ?? 'HUF')}
        />
        <InfoRow
          icon={<Calendar className="w-4 h-4" />}
          label={cx.sourceQuote?.validUntilLabel ?? 'Érvényesség'}
          value={fmtDate(quote.validUntil)}
        />
      </div>
    </div>
  );
}

// ─── Linked work-orders tab ──────────────────────────────────────────────────

function LinkedWorkOrdersTab({
  customerId,
  projectId,
}: {
  customerId?: string;
  projectId?: string;
}) {
  const t = useT();
  const cx = t.contracts as Record<string, any>;
  // A backend a customerId + projectId filtert egymástól függetlenül enged
  // (work-orders.controller.findAll). A két FK-ot együtt szűkítjük a kliens-
  // oldalon: ha mindkettő ismert, csak akkor mutatunk eredményt.
  const params = new URLSearchParams();
  if (customerId) params.set('customerId', customerId);
  if (projectId) params.set('projectId', projectId);
  params.set('take', '50');

  const shouldFetch = !!(customerId || projectId);
  const { data, error, isLoading } = useSWR(
    shouldFetch ? `/work-orders?${params.toString()}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  if (!shouldFetch) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">
          {cx.linkedWorkOrders?.noLink ?? 'A szerződéshez nincs ügyfél vagy projekt csatolva.'}
        </p>
      </div>
    );
  }

  if (isLoading) return <div className="py-8 text-center text-gray-400 text-sm">{t.common.loading}</div>;
  if (error) {
    return (
      <div className="py-8 text-center text-gray-400 text-sm">
        {cx.linkedWorkOrders?.empty ?? 'Nincs kapcsolt munkalap.'}
      </div>
    );
  }

  const items = unwrapItems<LinkedWorkOrder>(data);
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
        {cx.linkedWorkOrders?.empty ?? 'Nincs kapcsolt munkalap.'}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
              {cx.linkedWorkOrders?.colNumber ?? 'Szám / Helyszín'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
              {cx.linkedWorkOrders?.colState ?? 'Állapot'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
              {cx.linkedWorkOrders?.colDeadline ?? 'Határidő'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
              {cx.linkedWorkOrders?.colResponsible ?? 'Felelős'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((wo) => (
            <tr key={wo.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link href={`/work-orders/${wo.id}`} className="block hover:text-brand-600 transition">
                  <div className="font-mono text-xs text-gray-400">{wo.workOrderNumber}</div>
                  <div className="font-medium text-gray-900">{wo.location ?? '—'}</div>
                </Link>
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${WO_STATE_STYLES[wo.state] ?? 'bg-gray-100 text-gray-600'}`}>
                  {wo.state}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(wo.deadline)}</td>
              <td className="px-4 py-3 text-xs text-gray-500">{wo.responsiblePerson ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Linked invoices tab ─────────────────────────────────────────────────────

function LinkedInvoicesTab({ customerId }: { customerId?: string }) {
  const t = useT();
  const cx = t.contracts as Record<string, any>;

  const { data, error, isLoading } = useSWR(
    customerId ? `/invoices?customerId=${customerId}&take=50` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  if (!customerId) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Receipt className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">
          {cx.linkedInvoices?.noCustomer ?? 'A szerződéshez nincs ügyfél csatolva.'}
        </p>
      </div>
    );
  }

  if (isLoading) return <div className="py-8 text-center text-gray-400 text-sm">{t.common.loading}</div>;
  if (error) {
    return (
      <div className="py-8 text-center text-gray-400 text-sm">
        {cx.linkedInvoices?.empty ?? 'Nincs kapcsolt számla.'}
      </div>
    );
  }

  const items = unwrapItems<LinkedInvoice>(data);
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
        {cx.linkedInvoices?.empty ?? 'Nincs kapcsolt számla.'}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
              {cx.linkedInvoices?.colNumber ?? 'Szám'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
              {cx.linkedInvoices?.colState ?? 'Állapot'}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">
              {cx.linkedInvoices?.colAmount ?? 'Összeg'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
              {cx.linkedInvoices?.colDueDate ?? 'Határidő'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((inv) => (
            <tr key={inv.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-mono text-xs text-gray-700">{inv.invoiceNumber}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${INVOICE_STATE_STYLES[inv.state] ?? 'bg-gray-100 text-gray-600'}`}>
                  {inv.state}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-gray-700">
                {fmtValue(inv.totalAmount, inv.currency ?? 'HUF')}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(inv.dueDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Overview tab ────────────────────────────────────────────────────────────

function OverviewTab({
  contract,
  customerName,
}: {
  contract: any;
  customerName?: string;
}) {
  const t = useT();
  const cx = t.contracts as Record<string, any>;
  const days = contract.state === 'active' ? daysUntil(contract.endDate) : null;
  const expiringSoon = days !== null && days >= 0 && days <= 30;
  const overdue = days !== null && days < 0;
  const stateLabels = cx.state as Record<string, string> | undefined ?? cx.states ?? {};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          {cx.overview?.detailsTitle ?? 'Részletek'}
        </h3>
        <InfoRow
          icon={<FileSignature className="w-4 h-4" />}
          label={cx.colNumber}
          value={<span className="font-mono">{contract.contractNumber}</span>}
        />
        <InfoRow
          icon={<FileText className="w-4 h-4" />}
          label={cx.colTitle}
          value={contract.title}
        />
        <InfoRow
          icon={<Tag className="w-4 h-4" />}
          label={cx.colState}
          value={(
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CONTRACT_STATE_STYLES[contract.state] ?? 'bg-gray-100 text-gray-600'}`}>
              {stateLabels[contract.state] ?? contract.state}
            </span>
          )}
        />
        <InfoRow
          icon={<Receipt className="w-4 h-4" />}
          label={cx.colValue}
          value={fmtValue(contract.value, contract.currency ?? 'HUF')}
        />
        <InfoRow
          icon={<Calendar className="w-4 h-4" />}
          label={cx.startDate}
          value={fmtDate(contract.startDate)}
        />
        <InfoRow
          icon={<Calendar className="w-4 h-4" />}
          label={cx.endDate}
          value={(
            <span className="flex items-center gap-2">
              <span className={expiringSoon ? 'text-orange-600 font-medium' : overdue ? 'text-red-600 font-medium' : ''}>
                {fmtDate(contract.endDate)}
              </span>
              {(expiringSoon || overdue) && (
                <span className={`flex items-center gap-0.5 text-xs font-medium ${overdue ? 'text-red-600' : 'text-orange-600'}`}>
                  <AlertTriangle className="w-3 h-3" />
                  {overdue
                    ? `${Math.abs(days!)} ${cx.daysExpiredSuffix ?? 'napja lejárt'}`
                    : `${days} ${cx.daysLeftSuffix ?? 'nap'}`}
                </span>
              )}
            </span>
          )}
        />
        {contract.signedAt && (
          <InfoRow
            icon={<CheckCircle2 className="w-4 h-4" />}
            label={cx.overview?.signedAt ?? 'Aláírva'}
            value={fmtDate(contract.signedAt)}
          />
        )}
        {contract.terminatedAt && (
          <InfoRow
            icon={<XCircle className="w-4 h-4" />}
            label={cx.overview?.terminatedAt ?? 'Felmondva'}
            value={fmtDate(contract.terminatedAt)}
          />
        )}
        {contract.terminatedReason && (
          <InfoRow
            icon={<FileText className="w-4 h-4" />}
            label={cx.overview?.terminatedReason ?? 'Felmondás indoka'}
            value={contract.terminatedReason}
          />
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          {cx.overview?.relationsTitle ?? 'Kapcsolatok'}
        </h3>
        <InfoRow
          icon={<Building2 className="w-4 h-4" />}
          label={cx.colCustomer ?? 'Ügyfél'}
          value={contract.customerId ? (
            <Link href={`/customers/${contract.customerId}`} className="text-brand-600 hover:underline">
              {customerName ?? contract.customerId}
            </Link>
          ) : '—'}
        />
        {contract.projectId && (
          <InfoRow
            icon={<ClipboardList className="w-4 h-4" />}
            label={cx.overview?.project ?? 'Projekt'}
            value={(
              <Link href={`/projects/${contract.projectId}`} className="text-brand-600 hover:underline">
                {cx.overview?.openProject ?? 'Projekt megnyitása'}
              </Link>
            )}
          />
        )}
        {contract.description && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 whitespace-pre-wrap">
            {contract.description}
          </div>
        )}
        {contract.tags && contract.tags.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <Tag className="w-3 h-3 text-gray-400" />
            {contract.tags.map((tag: string, i: number) => (
              <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

type Tab = 'overview' | 'pdf' | 'sourceQuote' | 'workOrders' | 'invoices' | 'audit';

const TAB_DEFS: { id: Tab; key: string; icon: React.ReactNode }[] = [
  { id: 'overview',    key: 'overview',    icon: <FileSignature className="w-4 h-4" /> },
  { id: 'pdf',         key: 'pdf',         icon: <FileDown className="w-4 h-4" /> },
  { id: 'sourceQuote', key: 'sourceQuote', icon: <FileText className="w-4 h-4" /> },
  { id: 'workOrders',  key: 'workOrders',  icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'invoices',    key: 'invoices',    icon: <Receipt className="w-4 h-4" /> },
  { id: 'audit',       key: 'audit',       icon: <Activity className="w-4 h-4" /> },
];

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const cx = t.contracts as Record<string, any>;

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showTerminate, setShowTerminate] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { contract, isLoading, error, mutate } = useContract(id ?? null);

  // A customer-nevet külön kérjük, hogy a header-en + overview-tabon a teljes név
  // jelenjen meg. Csak akkor, ha van customerId — defenzív null-handling.
  const { customer } = useCustomer(contract?.customerId ?? null);

  if (isLoading) {
    return <div className="p-8 text-gray-400">{t.common.loading}</div>;
  }
  if (error || !contract) {
    return (
      <div className="p-8 text-red-500">
        {cx.detail?.loadError ?? 'Nem sikerült betölteni a szerződést.'}
      </div>
    );
  }

  const sourceQuoteId = (contract.metadata as any)?.sourceQuoteId as string | undefined;
  const hasPdf = !!contract.generatedStorageKey;
  const stateLabels = (cx.state as Record<string, string> | undefined) ?? cx.states ?? {};
  const customerName = customer
    ? `${customer.firstName} ${customer.lastName}${customer.company ? ` · ${customer.company}` : ''}`
    : undefined;

  const handleActivate = async () => {
    setActionError(null);
    try {
      await activateContract(contract.id);
      void mutate();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setActionError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba az aktiválás során.'));
    }
  };
  const handleExpire = async () => {
    setActionError(null);
    try {
      await expireContract(contract.id);
      void mutate();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setActionError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba a lejáratás során.'));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => router.push('/contracts')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition">
          <ArrowLeft className="w-4 h-4" />
          {cx.title}
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-700 font-medium font-mono">
          {contract.contractNumber}
        </span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{contract.title}</h1>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${CONTRACT_STATE_STYLES[contract.state] ?? 'bg-gray-100 text-gray-600'}`}>
                {stateLabels[contract.state] ?? contract.state}
              </span>
              {!contract.isActive && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">
                  {t.common.inactive}
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500 mt-1 font-mono">{contract.contractNumber}</div>
            {customerName && (
              <div className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {customerName}
              </div>
            )}
          </div>

          {/* Lifecycle action buttons */}
          <div className="flex flex-wrap gap-2">
            {contract.state === 'draft' && (
              <button type="button" onClick={handleActivate}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">
                <CheckCircle2 className="w-4 h-4" />
                {t.contracts.activate}
              </button>
            )}
            {contract.state === 'active' && (
              <button type="button" onClick={handleExpire}
                className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition">
                <Clock className="w-4 h-4" />
                {t.contracts.expire}
              </button>
            )}
            {(contract.state === 'draft' || contract.state === 'active') && (
              <button type="button" onClick={() => setShowTerminate(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition">
                <XCircle className="w-4 h-4" />
                {t.contracts.terminate}
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {actionError}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 flex-wrap">
          {TAB_DEFS.map((tab) => {
            const labels = (cx.tabs as Record<string, string> | undefined) ?? {};
            const label = labels[tab.key] ?? tab.key;
            return (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
                  activeTab === tab.id
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}>
                {tab.icon}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && (
          <OverviewTab contract={contract} customerName={customerName} />
        )}
        {activeTab === 'pdf' && (
          <PdfTab contractId={contract.id} hasPdf={hasPdf} onChanged={() => void mutate()} />
        )}
        {activeTab === 'sourceQuote' && (
          <SourceQuoteTab quoteId={sourceQuoteId} />
        )}
        {activeTab === 'workOrders' && (
          <LinkedWorkOrdersTab customerId={contract.customerId} projectId={contract.projectId} />
        )}
        {activeTab === 'invoices' && (
          <LinkedInvoicesTab customerId={contract.customerId} />
        )}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <AuditTimeline resource="contract" resourceId={contract.id} />
          </div>
        )}
      </div>

      {showTerminate && (
        <TerminateModal
          id={contract.id}
          onClose={() => setShowTerminate(false)}
          onDone={() => void mutate()}
        />
      )}
    </div>
  );
}
