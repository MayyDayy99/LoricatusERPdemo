'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Plus, CreditCard, Send, FileCheck, XCircle, Trash2, AlertTriangle, Pencil, FileText, Download } from 'lucide-react';
import { CsvExportButton } from '@/components/csv/csv-export-import';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/lib/hooks/use-t';
import { useTenant } from '@/lib/hooks/use-tenants';
import { toast } from 'sonner';

const swrFetcher = (url: string) => apiClient.get(url).then(r => r.data);

/* ── Types ──────────────────────────────────────────────────── */
type InvoiceState = 'draft' | 'issued' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled' | 'credited';

interface Customer { id: string; firstName: string; lastName: string; company?: string; }

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
  totalPrice: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  title?: string;
  state: InvoiceState;
  totalAmount?: number;
  subtotal?: number;
  taxAmount?: number;
  taxRate?: number;
  paidAmount?: number;
  currency: string;
  dueDate?: string;
  issueDate?: string;
  bankAccount?: string;
  customer?: Customer;
  lineItems?: LineItem[];
  createdAt: string;
  quoteId?: string;
  generatedStorageKey?: string;
}

const STATE_STYLES: Record<InvoiceState, string> = {
  draft:          'bg-gray-100 text-gray-600',
  issued:         'bg-blue-100 text-blue-700',
  sent:           'bg-cyan-100 text-cyan-700',
  paid:           'bg-green-100 text-green-700',
  partially_paid: 'bg-teal-100 text-teal-700',
  overdue:        'bg-red-100 text-red-700',
  cancelled:      'bg-gray-100 text-gray-400',
  credited:       'bg-purple-100 text-purple-700',
};

const fmt = (v?: number, c = 'HUF') =>
  v != null ? new Intl.NumberFormat('hu-HU').format(v) + ' ' + c : '—';

const isOverdue = (inv: Invoice) =>
  inv.dueDate && new Date(inv.dueDate) < new Date() && !['paid', 'cancelled', 'credited'].includes(inv.state);

/* ── Create / Edit Invoice Modal ──────────────────────────────── */
function CreateInvoiceModal({ customers, initial, onClose, onSaved }: {
  customers: Customer[];
  initial?: Invoice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const { tenant } = useTenant();
  const defaultCurrency = tenant?.defaultCurrency ?? 'HUF';
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    customerId: initial?.customer?.id ?? '',
    dueDate: initial?.dueDate ? initial.dueDate.slice(0, 10) : '',
    issueDate: initial?.issueDate ? initial.issueDate.slice(0, 10) : '',
    taxRate: String(initial?.taxRate ?? 27),
    currency: initial?.currency ?? defaultCurrency,
    bankAccount: initial?.bankAccount ?? '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      title: form.title || undefined,
      customerId: form.customerId || undefined,
      dueDate: form.dueDate || undefined,
      issueDate: form.issueDate || undefined,
      taxRate: parseFloat(form.taxRate) || 27,
      currency: form.currency,
      bankAccount: form.bankAccount || undefined,
    };
    try {
      if (initial) {
        await apiClient.patch(`/invoices/${initial.id}`, payload);
      } else {
        await apiClient.post('/invoices', payload);
      }
      toast.success(t.common.saved);
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{initial ? 'Számla szerkesztése' : t.invoices.newTitle}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Megnevezés (opcionális)" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />

          <select aria-label={t.invoices.colCustomer} className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
            <option value="">— {t.invoices.colCustomer} —</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}{c.company ? ` (${c.company})` : ''}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{t.invoices.issueDatePh}</label>
              <input type="date" aria-label={t.invoices.issueDatePh} className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{t.invoices.dueDatePh}</label>
              <input type="date" aria-label={t.invoices.dueDatePh} className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Deviza" className="border rounded-lg px-3 py-2 text-sm"
              value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
              <option>HUF</option><option>EUR</option><option>USD</option>
            </select>
            <input type="number" min="0" max="100" className="border rounded-lg px-3 py-2 text-sm"
              placeholder="ÁFA (%)" value={form.taxRate}
              onChange={e => setForm(f => ({ ...f, taxRate: e.target.value }))} />
          </div>

          <input className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder={t.invoices.bankAccPh} value={form.bankAccount}
            onChange={e => setForm(f => ({ ...f, bankAccount: e.target.value }))} />

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600">{t.common.cancel}</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {loading ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Record Payment Modal ─────────────────────────────────────── */
function RecordPaymentModal({ invoice, onClose, onSaved }: {
  invoice: Invoice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const remaining = (invoice.totalAmount ?? 0) - (invoice.paidAmount ?? 0);
  const [form, setForm] = useState({
    amount: remaining.toString(),
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'transfer',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post(`/invoices/${invoice.id}/record-payment`, {
        amount: parseFloat(form.amount),
        paymentDate: form.paymentDate || undefined,
        paymentMethod: form.paymentMethod || undefined,
      });
      toast.success(t.common.saved);
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-1">{t.invoices.recordPayment}</h2>
        <p className="text-xs text-gray-500 mb-4">
          {invoice.invoiceNumber} · Hátralék: {fmt(remaining, invoice.currency)}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required type="number" min="0.01" step="0.01"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder={t.invoices.amountPh} value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          <input type="date" aria-label="Fizetés dátuma" className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.paymentDate}
            onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} />
          <select aria-label="Fizetési mód" className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.paymentMethod}
            onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
            <option value="transfer">Átutalás</option>
            <option value="cash">Készpénz</option>
            <option value="card">Bankkártya</option>
          </select>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600">{t.common.cancel}</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {loading ? t.common.saving : t.invoices.recordPayment}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Add Line Item Modal ─────────────────────────────────────── */
function AddLineItemModal({ invoiceId, onClose, onSaved }: {
  invoiceId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState({ description: '', quantity: '1', unitPrice: '', unit: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post(`/invoices/${invoiceId}/line-items`, {
        description: form.description,
        quantity: parseFloat(form.quantity),
        unitPrice: parseFloat(form.unitPrice),
        unit: form.unit || undefined,
      });
      toast.success(t.common.saved);
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Tétel hozzáadása</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Leírás *" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="grid grid-cols-3 gap-2">
            <input required type="number" min="0.01" step="0.01"
              className="border rounded-lg px-3 py-2 text-sm"
              placeholder="Menny. *" value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            <input required type="number" min="0" step="0.01"
              className="border rounded-lg px-3 py-2 text-sm"
              placeholder="Egységár *" value={form.unitPrice}
              onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} />
            <input className="border rounded-lg px-3 py-2 text-sm"
              placeholder="Egység" value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600">{t.common.cancel}</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {loading ? t.common.saving : t.common.add}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Invoice Detail Panel ─────────────────────────────────────── */
function InvoiceDetail({ invoice, onRefresh, onClose, onEdit }: {
  invoice: Invoice;
  onRefresh: () => void;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const t = useT();
  const [addItem, setAddItem] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const doTransition = async (action: string) => {
    setLoading(action);
    try {
      await apiClient.post(`/invoices/${invoice.id}/${action}`);
      toast.success(t.common.saved);
      onRefresh();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba'));
    } finally {
      setLoading(null);
    }
  };

  const handleGeneratePdf = async () => {
    setLoading('pdf');
    try {
      await apiClient.post(`/invoices/${invoice.id}/generate-pdf`);
      toast.success(t.common.saved);
      onRefresh();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba'));
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const { data } = await apiClient.get<{ url: string }>(`/invoices/${invoice.id}/download-url`);
      window.open(data.url, '_blank');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Letöltési link nem elérhető'));
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await apiClient.delete(`/invoices/${invoice.id}/line-items/${itemId}`);
      toast.success(t.common.saved);
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Hiba');
    }
  };

  const paidPct = invoice.totalAmount && invoice.totalAmount > 0
    ? Math.min(100, Math.round(((invoice.paidAmount ?? 0) / invoice.totalAmount) * 100))
    : 0;

  const overdue = isOverdue(invoice);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{invoice.invoiceNumber}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATE_STYLES[invoice.state]}`}>
              {t.invoices.states[invoice.state]}
            </span>
            {overdue && (
              <span className="flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                <AlertTriangle className="w-3 h-3" /> Lejárt
              </span>
            )}
          </div>
          {invoice.title && <div className="text-sm text-gray-500 mt-0.5">{invoice.title}</div>}
          {invoice.customer && (
            <div className="text-xs text-gray-400 mt-1">
              {invoice.customer.firstName} {invoice.customer.lastName}
              {invoice.customer.company ? ` · ${invoice.customer.company}` : ''}
            </div>
          )}
          {invoice.quoteId && (
            <div className="text-xs text-purple-500 mt-1">Létrehozva árajánlatból</div>
          )}
        </div>
        <button type="button" aria-label="Bezárás" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-2">✕</button>
      </div>

      {/* Payment progress */}
      {['issued', 'sent', 'partially_paid', 'overdue'].includes(invoice.state) && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Befizetve: {fmt(invoice.paidAmount, invoice.currency)}</span>
            <span>{paidPct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${paidPct}%` }} />
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
        {invoice.subtotal != null && (
          <div className="flex justify-between text-gray-500">
            <span>Nettó</span><span>{fmt(invoice.subtotal, invoice.currency)}</span>
          </div>
        )}
        {invoice.taxAmount != null && (
          <div className="flex justify-between text-gray-500">
            <span>ÁFA ({invoice.taxRate ?? 27}%)</span>
            <span>{fmt(invoice.taxAmount, invoice.currency)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-200">
          <span>Összesen</span><span>{fmt(invoice.totalAmount, invoice.currency)}</span>
        </div>
        {invoice.dueDate && (
          <div className="flex justify-between text-xs text-gray-500 pt-1">
            <span>Fizetési határidő</span>
            <span className={overdue ? 'text-red-600 font-medium' : ''}>
              {new Date(invoice.dueDate).toLocaleDateString('hu-HU')}
            </span>
          </div>
        )}
        {invoice.bankAccount && (
          <div className="flex justify-between text-xs text-gray-400 pt-1">
            <span>Bankszámlaszám</span><span className="font-mono">{invoice.bankAccount}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {invoice.state === 'draft' && onEdit && (
          <button type="button" onClick={onEdit}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600">
            <Pencil className="w-3 h-3" /> Szerkesztés
          </button>
        )}
        {invoice.state === 'draft' && (
          <button type="button" onClick={() => doTransition('issue')} disabled={loading === 'issue'}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <FileCheck className="w-3 h-3" /> {t.invoices.issueBtn}
          </button>
        )}
        {invoice.state === 'issued' && (
          <button type="button" onClick={() => doTransition('send')} disabled={loading === 'send'}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50">
            <Send className="w-3 h-3" /> {t.invoices.sendBtn}
          </button>
        )}
        {['issued', 'sent', 'partially_paid', 'overdue'].includes(invoice.state) && (
          <button type="button" onClick={() => setPaymentModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">
            <CreditCard className="w-3 h-3" /> {t.invoices.recordPayment}
          </button>
        )}
        {['draft', 'issued', 'sent'].includes(invoice.state) && (
          <button type="button" onClick={() => doTransition('cancel')} disabled={loading === 'cancel'}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">
            <XCircle className="w-3 h-3" /> {t.invoices.cancelBtn}
          </button>
        )}
        {invoice.generatedStorageKey ? (
          <button type="button" onClick={handleDownloadPdf}
            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50">
            <Download className="w-3 h-3" /> PDF letöltés
          </button>
        ) : (
          <button type="button" onClick={handleGeneratePdf} disabled={loading === 'pdf'}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
            <FileText className="w-3 h-3" /> PDF generálás
          </button>
        )}
      </div>

      {/* Line Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Tételek</span>
          {invoice.state === 'draft' && (
            <button type="button" onClick={() => setAddItem(true)}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium">+ Tétel hozzáadása</button>
          )}
        </div>
        {(!invoice.lineItems || invoice.lineItems.length === 0) ? (
          <div className="text-xs text-gray-400 py-4 text-center border rounded-lg">Még nincs tétel</div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-500">Leírás</th>
                  <th className="px-3 py-2 text-right text-gray-500">Menny.</th>
                  <th className="px-3 py-2 text-right text-gray-500">Egységár</th>
                  <th className="px-3 py-2 text-right text-gray-500">Összesen</th>
                  {invoice.state === 'draft' && <th className="w-8 px-2 py-2" scope="col"><span className="sr-only">Műveletek</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.lineItems.map(item => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 text-gray-700">{item.description}</td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {item.quantity}{item.unit ? ' ' + item.unit : ''}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {new Intl.NumberFormat('hu-HU').format(item.unitPrice)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      {new Intl.NumberFormat('hu-HU').format(item.totalPrice)}
                    </td>
                    {invoice.state === 'draft' && (
                      <td className="px-2 py-2 text-center">
                        <button type="button" aria-label="Tétel törlése" onClick={() => handleDeleteItem(item.id)}
                          className="text-red-400 hover:text-red-600">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addItem && (
        <AddLineItemModal invoiceId={invoice.id}
          onClose={() => setAddItem(false)}
          onSaved={() => { setAddItem(false); onRefresh(); }} />
      )}
      {paymentModal && (
        <RecordPaymentModal invoice={invoice}
          onClose={() => setPaymentModal(false)}
          onSaved={() => { setPaymentModal(false); onRefresh(); }} />
      )}
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function InvoicesPage() {
  const t = useT();
  const { data: invoices = [], mutate: mutateInvoices, isLoading } = useSWR<Invoice[]>('/invoices', swrFetcher);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [filterState, setFilterState] = useState<InvoiceState | 'all'>('all');
  const [dueDateFrom, setDueDateFrom] = useState('');
  const [dueDateTo, setDueDateTo] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  useEffect(() => {
    // A /customers paginated: {items,total,take,skip}. Kompat-fallback a régi shape-re.
    apiClient.get('/customers?take=1000').then(r => setCustomers(r.data?.items ?? r.data ?? [])).catch(() => {});
  }, []);

  const fetchSelected = async (id: string) => {
    try {
      const res = await apiClient.get(`/invoices/${id}`);
      setSelectedInvoice(res.data);
    } catch { /* handled */ }
  };

  const filtered = invoices.filter(i => {
    if (filterState !== 'all' && i.state !== filterState) return false;
    if (overdueOnly && !isOverdue(i)) return false;
    if (dueDateFrom && (!i.dueDate || i.dueDate.slice(0, 10) < dueDateFrom)) return false;
    if (dueDateTo && (!i.dueDate || i.dueDate.slice(0, 10) > dueDateTo)) return false;
    return true;
  });

  const handleRowClick = async (inv: Invoice) => {
    if (selectedInvoice?.id === inv.id) {
      setSelectedInvoice(null);
    } else {
      await fetchSelected(inv.id);
    }
  };

  const handleRefresh = async () => {
    await mutateInvoices();
    if (selectedInvoice) await fetchSelected(selectedInvoice.id);
  };

  /* Summary bar calculations */
  const payable = invoices
    .filter(i => ['issued', 'sent', 'partially_paid'].includes(i.state))
    .reduce((s, i) => s + ((i.totalAmount ?? 0) - (i.paidAmount ?? 0)), 0);
  const overdueTotal = invoices
    .filter(isOverdue)
    .reduce((s, i) => s + ((i.totalAmount ?? 0) - (i.paidAmount ?? 0)), 0);
  const paidTotal = invoices
    .filter(i => i.state === 'paid')
    .reduce((s, i) => s + (i.totalAmount ?? 0), 0);

  if (isLoading) return <div className="p-8 text-gray-400">{t.common.loading}</div>;

  const stateFilters: (InvoiceState | 'all')[] = ['all', 'draft', 'issued', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'];

  return (
    <div className="p-6 flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.invoices.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{t.invoices.subtitle(invoices.length)}</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvExportButton endpoint="/csv/invoices" filename="invoices.csv" label="Export" />
          <button type="button" onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
            <Plus className="w-4 h-4" /> {t.invoices.newBtn}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Fizetendő</div>
          <div className="text-lg font-bold text-gray-900">{new Intl.NumberFormat('hu-HU').format(payable)} Ft</div>
        </div>
        <div className={`bg-white rounded-xl border p-4 ${overdueTotal > 0 ? 'border-red-200' : 'border-gray-200'}`}>
          <div className="text-xs text-gray-500 mb-1">Lejárt</div>
          <div className={`text-lg font-bold ${overdueTotal > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {new Intl.NumberFormat('hu-HU').format(overdueTotal)} Ft
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Befizetve</div>
          <div className="text-lg font-bold text-green-600">{new Intl.NumberFormat('hu-HU').format(paidTotal)} Ft</div>
        </div>
      </div>

      {/* State filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {stateFilters.map(s => (
          <button type="button" key={s} onClick={() => setFilterState(s)}
            className={`px-3 py-1 text-xs rounded-full border transition ${
              filterState === s
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}>
            {s === 'all' ? 'Összes' : t.invoices.states[s]}
            <span className="ml-1 opacity-70">
              ({s === 'all' ? invoices.length : invoices.filter(i => i.state === s).length})
            </span>
          </button>
        ))}
      </div>

      {/* Advanced filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Határidő:</span>
          <input type="date" aria-label="Határidő dátumtól" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
            value={dueDateFrom} onChange={e => setDueDateFrom(e.target.value)} />
          <span className="text-xs text-gray-400">—</span>
          <input type="date" aria-label="Határidő dátumig" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
            value={dueDateTo} onChange={e => setDueDateTo(e.target.value)} />
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)}
            className="rounded" />
          <span className="text-xs text-gray-600">Csak lejártak</span>
        </label>
        {(dueDateFrom || dueDateTo || overdueOnly) && (
          <button type="button"
            onClick={() => { setDueDateFrom(''); setDueDateTo(''); setOverdueOnly(false); }}
            className="text-xs text-gray-400 hover:text-gray-600 underline">Törlés</button>
        )}
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Table */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.invoices.colNumber}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.invoices.colCustomer}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.invoices.colState}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{t.invoices.colTotal}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Befizetve</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.invoices.colDue}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">{t.invoices.empty}</td></tr>
              )}
              {filtered.map(inv => {
                const overdue = isOverdue(inv);
                const isSelected = selectedInvoice?.id === inv.id;
                return (
                  <tr key={inv.id}
                    onClick={() => handleRowClick(inv)}
                    className={`hover:bg-gray-50 cursor-pointer transition ${
                      overdue ? 'bg-red-50/40' : ''
                    } ${isSelected ? 'bg-brand-50 border-l-2 border-l-brand-500' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {inv.customer ? `${inv.customer.firstName} ${inv.customer.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATE_STYLES[inv.state]}`}>
                          {t.invoices.states[inv.state]}
                        </span>
                        {overdue && <AlertTriangle className="w-3 h-3 text-red-500" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {fmt(inv.totalAmount, inv.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500">
                      {inv.paidAmount ? fmt(inv.paidAmount, inv.currency) : '—'}
                    </td>
                    <td className={`px-4 py-3 text-xs ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('hu-HU') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selectedInvoice && (
          <div className="w-96 flex-shrink-0 overflow-y-auto">
            <InvoiceDetail
              invoice={selectedInvoice}
              onRefresh={handleRefresh}
              onClose={() => setSelectedInvoice(null)}
              onEdit={() => setEditingInvoice(selectedInvoice)}
            />
          </div>
        )}
      </div>

      {showCreate && (
        <CreateInvoiceModal
          customers={customers}
          onClose={() => setShowCreate(false)}
          onSaved={() => mutateInvoices()}
        />
      )}
      {editingInvoice && (
        <CreateInvoiceModal
          customers={customers}
          initial={editingInvoice}
          onClose={() => setEditingInvoice(null)}
          onSaved={() => { mutateInvoices(); if (selectedInvoice) fetchSelected(selectedInvoice.id); }}
        />
      )}
    </div>
  );
}
