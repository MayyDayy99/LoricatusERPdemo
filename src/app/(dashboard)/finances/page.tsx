'use client';

import { useState, useEffect } from 'react';
import { Plus, CreditCard, FileText, ScrollText } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/lib/hooks/use-t';
import { useTenant } from '@/lib/hooks/use-tenants';
import { toast } from 'sonner';

/* ── Types ──────────────────────────────────────────────────── */
type QuoteState = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
type InvoiceState = 'draft' | 'issued' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled' | 'credited';
type ContractState = 'draft' | 'active' | 'expired' | 'terminated';

interface Customer { id: string; firstName: string; lastName: string; company?: string; }
interface Quote {
  id: string; title: string; state: QuoteState;
  subTotal?: number; taxAmount?: number; totalAmount?: number;
  currency?: string; validUntil?: string;
  customer?: Customer;
}
interface Invoice {
  id: string; invoiceNumber?: string; state: InvoiceState;
  subTotal?: number; taxAmount?: number; totalAmount?: number; paidAmount?: number;
  currency?: string; dueDate?: string;
  customer?: Customer;
}
interface Contract {
  id: string; contractNumber: string; title: string; state: ContractState;
  value?: number; currency?: string; endDate?: string;
}

type TabKey = 'quotes' | 'invoices' | 'contracts';

/* ── Style maps ─────────────────────────────────────────────── */
const QUOTE_STATE_STYLES: Record<QuoteState, string> = {
  draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
  expired: 'bg-yellow-100 text-yellow-700',
};
const INVOICE_STATE_STYLES: Record<InvoiceState, string> = {
  draft: 'bg-gray-100 text-gray-600', issued: 'bg-blue-100 text-blue-700',
  sent: 'bg-cyan-100 text-cyan-700', paid: 'bg-green-100 text-green-700',
  partially_paid: 'bg-emerald-100 text-emerald-700', overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-200 text-gray-500', credited: 'bg-purple-100 text-purple-700',
};
const CONTRACT_STATE_STYLES: Record<ContractState, string> = {
  draft: 'bg-gray-100 text-gray-600', active: 'bg-green-100 text-green-700',
  expired: 'bg-yellow-100 text-yellow-700', terminated: 'bg-red-100 text-red-700',
};

const fmtMoney = (v?: number, c?: string) =>
  v != null ? new Intl.NumberFormat('hu-HU').format(v) + ' ' + (c ?? 'HUF') : '—';

/* ── Create Quote Modal ────────────────────────────────────── */
function CreateQuoteModal({ customers, onClose, onSaved }: {
  customers: Customer[]; onClose: () => void; onSaved: () => void;
}) {
  const t = useT();
  const { tenant } = useTenant();
  const [form, setForm] = useState({
    title: '', customerId: '', validUntil: '', taxRate: '27', currency: tenant?.defaultCurrency ?? 'HUF', notes: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post('/quotes', {
        title: form.title,
        customerId: form.customerId || undefined,
        validUntil: form.validUntil || undefined,
        taxRate: form.taxRate ? parseFloat(form.taxRate) : 27,
        currency: form.currency,
        notes: form.notes || undefined,
      });
      toast.success(t.common.saved);
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Hiba');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{t.quotes.newTitle}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder={t.quotes.titlePh} value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <select className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
            <option value="">— {t.quotes.colCustomer} —</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.company ? ` (${c.company})` : ''}</option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <input type="date" className="border rounded-lg px-3 py-2 text-sm"
              value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} />
            <input type="number" className="border rounded-lg px-3 py-2 text-sm"
              placeholder={t.quotes.taxRatePh} value={form.taxRate}
              onChange={e => setForm(f => ({ ...f, taxRate: e.target.value }))} />
            <select className="border rounded-lg px-2 py-2 text-sm"
              value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
              <option>HUF</option><option>EUR</option><option>USD</option>
            </select>
          </div>
          <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder={t.quotes.notesPh} value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">{t.common.cancel}</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {loading ? t.common.creating : t.common.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Create Invoice Modal ──────────────────────────────────── */
function CreateInvoiceModal({ customers, onClose, onSaved }: {
  customers: Customer[]; onClose: () => void; onSaved: () => void;
}) {
  const t = useT();
  const { tenant } = useTenant();
  const [form, setForm] = useState({
    customerId: '', dueDate: '', taxRate: '27', currency: tenant?.defaultCurrency ?? 'HUF', notes: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post('/invoices', {
        customerId: form.customerId || undefined,
        dueDate: form.dueDate || undefined,
        taxRate: form.taxRate ? parseFloat(form.taxRate) : 27,
        currency: form.currency,
        notes: form.notes || undefined,
      });
      toast.success(t.common.saved);
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Hiba');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{t.invoices.newTitle}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <select required className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
            <option value="">— {t.invoices.colCustomer} —</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.company ? ` (${c.company})` : ''}</option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <input type="date" className="border rounded-lg px-3 py-2 text-sm"
              value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            <input type="number" className="border rounded-lg px-3 py-2 text-sm"
              placeholder={t.quotes.taxRatePh} value={form.taxRate}
              onChange={e => setForm(f => ({ ...f, taxRate: e.target.value }))} />
            <select className="border rounded-lg px-2 py-2 text-sm"
              value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
              <option>HUF</option><option>EUR</option><option>USD</option>
            </select>
          </div>
          <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder={t.quotes.notesPh} value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">{t.common.cancel}</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {loading ? t.common.creating : t.common.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Payment Modal ─────────────────────────────────────────── */
function PaymentModal({ invoice, onClose, onSaved }: {
  invoice: Invoice; onClose: () => void; onSaved: () => void;
}) {
  const t = useT();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post(`/invoices/${invoice.id}/record-payment`, {
        amount: parseFloat(amount),
      });
      toast.success(t.common.saved);
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Hiba');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xs p-6">
        <h2 className="text-lg font-semibold mb-4">{t.invoices.recordPayment}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required type="number" min="1" step="1"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder={t.invoices.amountPh} value={amount}
            onChange={e => setAmount(e.target.value)} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">{t.common.cancel}</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {loading ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE — Tabbed: Quotes | Invoices | Contracts
   ══════════════════════════════════════════════════════════════ */
export default function FinancesPage() {
  const t = useT();
  const [tab, setTab] = useState<TabKey>('quotes');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  /* Modals */
  const [showCreateQuote, setShowCreateQuote] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);

  const fetchAll = async () => {
    try {
      const [qRes, iRes, cRes, custRes] = await Promise.all([
        apiClient.get('/quotes'),
        apiClient.get('/invoices'),
        apiClient.get('/contracts'),
        // A /customers paginated: {items,total,take,skip}. Kompat-fallback a régi tömb-shape-re.
        apiClient.get('/customers?take=1000'),
      ]);
      setQuotes(qRes.data);
      setInvoices(iRes.data);
      setContracts(cRes.data);
      setCustomers(custRes.data?.items ?? custRes.data ?? []);
    } catch { /* */ } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchAll(); }, []);

  /* ── Quick actions ───────────────────────────────────────── */
  const sendQuote = async (q: Quote) => {
    try {
      await apiClient.post(`/quotes/${q.id}/send`);
      toast.success(t.common.saved);
      fetchAll();
    } catch (err: any) { toast.error(err?.response?.data?.message ?? 'Hiba'); }
  };
  const acceptQuote = async (q: Quote) => {
    try {
      await apiClient.post(`/quotes/${q.id}/accept`);
      toast.success(t.common.saved);
      fetchAll();
    } catch (err: any) { toast.error(err?.response?.data?.message ?? 'Hiba'); }
  };
  const issueInvoice = async (inv: Invoice) => {
    try {
      await apiClient.post(`/invoices/${inv.id}/issue`);
      toast.success(t.common.saved);
      fetchAll();
    } catch (err: any) { toast.error(err?.response?.data?.message ?? 'Hiba'); }
  };
  const sendInvoice = async (inv: Invoice) => {
    try {
      await apiClient.post(`/invoices/${inv.id}/send`);
      toast.success(t.common.saved);
      fetchAll();
    } catch (err: any) { toast.error(err?.response?.data?.message ?? 'Hiba'); }
  };
  const activateContract = async (c: Contract) => {
    try {
      await apiClient.post(`/contracts/${c.id}/activate`);
      toast.success(t.common.saved);
      fetchAll();
    } catch (err: any) { toast.error(err?.response?.data?.message ?? 'Hiba'); }
  };

  const TABS: { key: TabKey; label: string; count: number; icon: typeof FileText }[] = [
    { key: 'quotes',    label: t.finances.tabQuotes,    count: quotes.length,    icon: FileText  },
    { key: 'invoices',  label: t.finances.tabInvoices,  count: invoices.length,  icon: CreditCard },
    { key: 'contracts', label: t.finances.tabContracts, count: contracts.length, icon: ScrollText },
  ];

  if (loading) return <div className="p-8 text-gray-400">{t.common.loading}</div>;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t.finances.title}</h1>
        {tab === 'quotes' && (
          <button onClick={() => setShowCreateQuote(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
            <Plus className="w-4 h-4" /> {t.quotes.newBtn}
          </button>
        )}
        {tab === 'invoices' && (
          <button onClick={() => setShowCreateInvoice(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
            <Plus className="w-4 h-4" /> {t.invoices.newBtn}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div data-tour="finances-tabs" className="flex border-b border-gray-200 mb-6">
        {TABS.map(({ key, label, count, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              tab === key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <Icon className="w-4 h-4" />
            {label}
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500">{count}</span>
          </button>
        ))}
      </div>

      {/* ── Quotes Tab ──────────────────────────────────────── */}
      {tab === 'quotes' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.quotes.colTitle}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.quotes.colCustomer}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.quotes.colState}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{t.quotes.colTotal}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.quotes.colValid}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{t.quotes.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quotes.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">{t.quotes.empty}</td></tr>
              )}
              {quotes.map(q => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{q.title}</td>
                  <td className="px-4 py-3 text-gray-600">{q.customer ? `${q.customer.firstName} ${q.customer.lastName}` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${QUOTE_STATE_STYLES[q.state]}`}>
                      {t.quotes.states[q.state]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{fmtMoney(q.totalAmount, q.currency)}</td>
                  <td className="px-4 py-3 text-gray-500 text-sm">
                    {q.validUntil ? new Date(q.validUntil).toLocaleDateString('hu-HU') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    {q.state === 'draft' && (
                      <button onClick={() => sendQuote(q)}
                        className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded">{t.quotes.sendBtn}</button>
                    )}
                    {q.state === 'sent' && (
                      <button onClick={() => acceptQuote(q)}
                        className="text-xs px-2 py-1 text-green-600 hover:bg-green-50 rounded">{t.quotes.acceptBtn}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Invoices Tab ────────────────────────────────────── */}
      {tab === 'invoices' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.invoices.colNumber}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.invoices.colCustomer}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.invoices.colState}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{t.invoices.colTotal}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.invoices.colDue}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{t.invoices.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">{t.invoices.empty}</td></tr>
              )}
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{inv.invoiceNumber ?? inv.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-gray-600">{inv.customer ? `${inv.customer.firstName} ${inv.customer.lastName}` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${INVOICE_STATE_STYLES[inv.state]}`}>
                      {t.invoices.states[inv.state]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{fmtMoney(inv.totalAmount, inv.currency)}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('hu-HU') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    {inv.state === 'draft' && (
                      <button onClick={() => issueInvoice(inv)}
                        className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded">{t.invoices.issueBtn}</button>
                    )}
                    {(inv.state === 'issued' || inv.state === 'overdue') && (
                      <button onClick={() => sendInvoice(inv)}
                        className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded">{t.invoices.sendBtn}</button>
                    )}
                    {['issued', 'sent', 'partially_paid', 'overdue'].includes(inv.state) && (
                      <button onClick={() => setPaymentInvoice(inv)}
                        className="text-xs px-2 py-1 text-green-600 hover:bg-green-50 rounded">{t.invoices.recordPayment}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Contracts Tab ───────────────────────────────────── */}
      {tab === 'contracts' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.contracts.colNumber}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.contracts.colTitle}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.contracts.colState}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{t.contracts.colValue}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.contracts.colEndDate}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{t.contracts.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contracts.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">{t.contracts.empty}</td></tr>
              )}
              {contracts.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{c.contractNumber}</td>
                  <td className="px-4 py-3 font-medium">{c.title}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${CONTRACT_STATE_STYLES[c.state]}`}>
                      {t.contracts.states[c.state]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{fmtMoney(c.value, c.currency)}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {c.endDate ? new Date(c.endDate).toLocaleDateString('hu-HU') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.state === 'draft' && (
                      <button onClick={() => activateContract(c)}
                        className="text-xs px-2 py-1 text-green-600 hover:bg-green-50 rounded">{t.contracts.activate}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showCreateQuote && (
        <CreateQuoteModal customers={customers}
          onClose={() => setShowCreateQuote(false)} onSaved={fetchAll} />
      )}
      {showCreateInvoice && (
        <CreateInvoiceModal customers={customers}
          onClose={() => setShowCreateInvoice(false)} onSaved={fetchAll} />
      )}
      {paymentInvoice && (
        <PaymentModal invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)} onSaved={fetchAll} />
      )}
    </div>
  );
}
