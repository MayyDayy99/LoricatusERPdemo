'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Globe, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAccounts, createAccount, updateAccount, deleteAccount, type Account, type CreateAccountDto } from '@/lib/hooks/use-crm';
import { useCanAccess } from '@/lib/hooks/use-access';
import { useT } from '@/lib/hooks/use-t';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_TYPE_STYLES: Record<string, string> = {
  prospect:   'bg-yellow-100 text-yellow-700',
  customer:   'bg-green-100 text-green-700',
  partner:    'bg-blue-100 text-blue-700',
  competitor: 'bg-red-100 text-red-600',
};

// ─── Account Modal ────────────────────────────────────────────────────────────

function AccountModal({ initial, onClose, onSaved }: {
  initial?: Account;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState<{
    name: string;
    accountType: string;
    industry: string;
    website: string;
    phone: string;
    email: string;
    taxNumber: string;
    euTaxNumber: string;
  }>({
    name:        initial?.name ?? '',
    accountType: initial?.accountType ?? 'prospect',
    industry:    initial?.industry ?? '',
    website:     initial?.website ?? '',
    phone:       initial?.phone ?? '',
    email:       initial?.email ?? '',
    taxNumber:   initial?.taxNumber ?? '',
    euTaxNumber: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload: CreateAccountDto = {
      name: form.name,
      accountType: form.accountType || undefined,
      industry: form.industry || undefined,
      website: form.website || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      taxNumber: form.taxNumber || undefined,
      euTaxNumber: form.euTaxNumber || undefined,
    };
    try {
      if (initial) {
        await updateAccount(initial.id, payload);
      } else {
        await createAccount(payload);
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

  const inp = (key: keyof typeof form, ph: string, type = 'text') => (
    <input type={type} className="w-full border rounded-lg px-3 py-2 text-sm"
      placeholder={ph} value={form[key]} onChange={set(key)} />
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">
          {initial ? t.accounts.editTitle : t.accounts.newTitle}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder={t.accounts.companyPh} value={form.name}
            onChange={set('name')} />

          <div className="grid grid-cols-2 gap-2">
            <select aria-label={t.accounts.colType} className="border rounded-lg px-3 py-2 text-sm"
              value={form.accountType} onChange={set('accountType')}>
              <option value="prospect">{t.accounts.typeProspect}</option>
              <option value="customer">{t.accounts.typeCustomer}</option>
              <option value="partner">{t.accounts.typePartner}</option>
              <option value="competitor">{t.accounts.typeCompetitor}</option>
            </select>
            {inp('industry', t.accounts.industryPh)}
          </div>

          {inp('website', t.accounts.websitePh, 'url')}

          <div className="grid grid-cols-2 gap-2">
            {inp('phone', t.accounts.phonePh, 'tel')}
            {inp('email', t.accounts.emailPh, 'email')}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {inp('taxNumber', t.accounts.taxIdPh)}
            {inp('euTaxNumber', t.accounts.euTaxIdPh)}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">{t.common.cancel}</button>
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

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ account, onClose, onDeleted }: {
  account: Account;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteAccount(account.id);
      toast.success(t.accounts.deleted);
      onDeleted();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Hiba');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-2">{t.accounts.deleteTitle}</h2>
        <p className="text-sm text-gray-600 mb-4">
          {t.accounts.deleteConfirm(account.name)}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">{t.common.cancel}</button>
          <button type="button" onClick={handleDelete} disabled={loading}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {loading ? t.common.saving : t.common.delete}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const t = useT();
  const { accounts, mutate, isLoading } = useAccounts();
  const canWrite = useCanAccess('crm.write');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Account | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  const filtered = filterType === 'all' ? accounts : accounts.filter(a => a.accountType === filterType);

  if (isLoading) return <div className="p-8 text-gray-400">{t.common.loading}</div>;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.accounts.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{t.accounts.subtitle(accounts.length)}</p>
        </div>
        {canWrite && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
            <Plus className="w-4 h-4" /> {t.accounts.newBtn}
          </button>
        )}
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'prospect', 'customer', 'partner', 'competitor'] as const).map(type => {
          const typeLabels: Record<string, string> = {
            prospect: t.accounts.typeProspect,
            customer: t.accounts.typeCustomer,
            partner: t.accounts.typePartner,
            competitor: t.accounts.typeCompetitor,
          };
          return (
            <button key={type} type="button" onClick={() => setFilterType(type)}
              className={`px-3 py-1 text-xs rounded-full border transition ${
                filterType === type
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}>
              {type === 'all' ? t.accounts.filterAll : typeLabels[type]}
              <span className="ml-1 opacity-70">
                ({type === 'all' ? accounts.length : accounts.filter(a => a.accountType === type).length})
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.accounts.colCompany}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.accounts.colType}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.accounts.colIndustry}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.accounts.colContact}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.accounts.colCreated}</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{t.accounts.colActions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">{t.accounts.empty}</td>
              </tr>
            )}
            {filtered.map(account => (
              <tr key={account.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3">
                  <Link href={`/accounts/${account.id}`}
                    className="font-medium text-gray-900 hover:text-brand-600 transition">
                    {account.name}
                  </Link>
                  {account.website && (
                    <a href={account.website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-600 mt-0.5">
                      <Globe className="w-3 h-3" />
                      {account.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </td>

                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACCOUNT_TYPE_STYLES[account.accountType ?? 'prospect'] ?? 'bg-gray-100 text-gray-600'}`}>
                    {(() => {
                      const type = account.accountType ?? 'prospect';
                      const labels: Record<string, string> = {
                        prospect: t.accounts.typeProspect,
                        customer: t.accounts.typeCustomer,
                        partner: t.accounts.typePartner,
                        competitor: t.accounts.typeCompetitor,
                      };
                      return labels[type] ?? type;
                    })()}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {account.industry ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-0.5">
                    {account.phone && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Phone className="w-3 h-3" />{account.phone}
                      </div>
                    )}
                    {account.email && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Mail className="w-3 h-3" />{account.email}
                      </div>
                    )}
                    {!account.phone && !account.email && <span className="text-xs text-gray-300">—</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(account.createdAt).toLocaleDateString('hu-HU')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {canWrite && (
                      <>
                        <button type="button" onClick={() => setEditTarget(account)}
                          className="text-gray-400 hover:text-brand-600 transition" title={t.common.edit}>
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(account)}
                          className="text-gray-400 hover:text-red-500 transition" title={t.common.delete}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <AccountModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { mutate(); setShowCreate(false); }}
        />
      )}
      {editTarget && (
        <AccountModal
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { mutate(); setEditTarget(null); }}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          account={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => mutate()}
        />
      )}
    </div>
  );
}
