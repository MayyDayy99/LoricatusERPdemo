'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Receipt, Pencil, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';

const STAGE_LABELS: Record<string, string> = {
  LEAD: 'Lead',
  QUALIFIED: 'Minősített',
  PROPOSAL_SENT: 'Ajánlat küldve',
  NEGOTIATION: 'Tárgyalás',
  WON: 'Nyert',
  LOST: 'Elveszett',
};

const STAGE_COLORS: Record<string, string> = {
  LEAD: 'bg-gray-100 text-gray-600',
  QUALIFIED: 'bg-blue-100 text-blue-700',
  PROPOSAL_SENT: 'bg-purple-100 text-purple-700',
  NEGOTIATION: 'bg-yellow-100 text-yellow-700',
  WON: 'bg-green-100 text-green-700',
  LOST: 'bg-red-100 text-red-600',
};

const QUOTE_STATE_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  expired: 'bg-orange-100 text-orange-600',
};

const INVOICE_STATE_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500',
  issued: 'bg-blue-100 text-blue-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-600',
  cancelled: 'bg-gray-100 text-gray-400',
};

function fetcher(url: string) {
  return apiClient.get(url).then((r) => r.data);
}

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: deal, isLoading, error } = useSWR(id ? `/deals/${id}` : null, fetcher);
  const { data: quotes, mutate: mutateQuotes } = useSWR(
    id ? `/quotes?dealId=${id}&take=50` : null,
    fetcher,
  );
  const { data: invoices } = useSWR(
    deal?.customerId ? `/invoices?customerId=${deal.customerId}&take=50` : null,
    fetcher,
  );

  const handleNewQuote = async () => {
    if (!deal) return;
    try {
      await apiClient.post('/quotes', {
        title: `Árajánlat — ${deal.title}`,
        customerId: deal.customerId,
        dealId: deal.id,
        projectId: deal.projectId,
      });
      toast.success('Árajánlat létrehozva');
      mutateQuotes();
    } catch {
      toast.error('Hiba az árajánlat létrehozásánál');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="space-y-4 text-center py-20">
        <p className="text-gray-500">Ügylet nem található.</p>
        <Link href="/crm/deals" className="text-brand-600 hover:underline text-sm">Vissza az ügyletekhez</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/crm/deals" className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{deal.title}</h1>
            <span className={clsx('text-xs px-2.5 py-1 rounded-full font-medium shrink-0', STAGE_COLORS[deal.stage] ?? 'bg-gray-100 text-gray-600')}>
              {STAGE_LABELS[deal.stage] ?? deal.stage}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            {deal.customerName && <span>{deal.customerName} · </span>}
            {deal.value && <span className="font-medium text-gray-600">{Number(deal.value).toLocaleString('hu-HU')} Ft · </span>}
            {new Date(deal.createdAt).toLocaleDateString('hu-HU')}
          </p>
        </div>
        <Link
          href={`/crm/deals`}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          <Pencil className="w-4 h-4" />
          Szerkesztés
        </Link>
      </div>

      {/* Info kártyák */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Valószínűség</p>
          <p className="text-lg font-bold text-gray-900">{deal.probability != null ? `${deal.probability}%` : '—'}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Várható zárás</p>
          <p className="text-sm font-medium text-gray-700">
            {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString('hu-HU') : '—'}
          </p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Árajánlatok</p>
          <p className="text-lg font-bold text-brand-600">{Array.isArray(quotes) ? quotes.length : 0}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Számlák</p>
          <p className="text-lg font-bold text-gray-700">{Array.isArray(invoices) ? invoices.length : 0}</p>
        </div>
      </div>

      {/* Árajánlatok */}
      <div className="bg-white border border-gray-100 rounded-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Kapcsolódó árajánlatok</h2>
          </div>
          {deal.customerId && (
            <button
              onClick={handleNewQuote}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Új árajánlat
            </button>
          )}
        </div>
        {!quotes || quotes.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">Nincs árajánlat ehhez az ügylethez.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Szám</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Cím</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Állapot</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Összeg</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Érvényes</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q: any) => (
                <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{q.quoteNumber}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{q.title}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full', QUOTE_STATE_COLORS[q.state] ?? 'bg-gray-100 text-gray-500')}>
                      {q.state}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {q.totalAmount ? `${Number(q.totalAmount).toLocaleString('hu-HU')} Ft` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {q.validUntil ? new Date(q.validUntil).toLocaleDateString('hu-HU') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Számlák */}
      <div className="bg-white border border-gray-100 rounded-xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <Receipt className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Ügyfél számlái</h2>
          <span className="text-xs text-gray-400">(ügyfélhez kapcsolódó összes számla)</span>
        </div>
        {!invoices || invoices.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">Nincs számla ehhez az ügyfélhez.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Szám</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Állapot</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Összeg</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Határidő</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: any) => (
                <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full', INVOICE_STATE_COLORS[inv.state] ?? 'bg-gray-100 text-gray-500')}>
                      {inv.state}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {inv.totalAmount ? `${Number(inv.totalAmount).toLocaleString('hu-HU')} Ft` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('hu-HU') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
