'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowLeft, Globe, Phone, Mail, Building2, User, TrendingUp, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/lib/hooks/use-t';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Account {
  id: string;
  name: string;
  accountType?: string;
  industry?: string;
  website?: string;
  phone?: string;
  email?: string;
  taxNumber?: string;
  assignedTo?: string;
  tags?: string[];
  createdAt: string;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  contactType?: string;
  lifecycleStage?: string;
  isActive: boolean;
}

interface Deal {
  id: string;
  title: string;
  stage: string;
  value?: number;
  currency?: string;
  probability?: number;
  expectedCloseDate?: string;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  prospect:   'Érdeklődő',
  customer:   'Ügyfél',
  partner:    'Partner',
  competitor: 'Versenytárs',
};

const ACCOUNT_TYPE_STYLES: Record<string, string> = {
  prospect:   'bg-yellow-100 text-yellow-700',
  customer:   'bg-green-100 text-green-700',
  partner:    'bg-blue-100 text-blue-700',
  competitor: 'bg-red-100 text-red-600',
};

const DEAL_STAGE_LABELS: Record<string, string> = {
  LEAD: 'Lead', QUALIFIED: 'Minősített', PROPOSAL_SENT: 'Ajánlat',
  NEGOTIATION: 'Tárgyalás', WON: 'Nyert', LOST: 'Elveszett',
};

const DEAL_STAGE_STYLES: Record<string, string> = {
  LEAD: 'bg-gray-100 text-gray-600',
  QUALIFIED: 'bg-blue-100 text-blue-700',
  PROPOSAL_SENT: 'bg-purple-100 text-purple-700',
  NEGOTIATION: 'bg-orange-100 text-orange-700',
  WON: 'bg-green-100 text-green-700',
  LOST: 'bg-red-100 text-red-600',
};

const fmt = (v?: number, c = 'HUF') =>
  v != null ? new Intl.NumberFormat('hu-HU').format(Math.round(v)) + ' ' + c : '—';

// ─── Fetcher ──────────────────────────────────────────────────────────────────

const fetcher = (url: string) => apiClient.get(url).then(r => r.data);

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'contacts' | 'deals';

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const [tab, setTab] = useState<Tab>('contacts');

  const { data: account, isLoading: loadingAccount, mutate: mutateAccount } = useSWR<Account>(
    id ? `/accounts/${id}` : null,
    fetcher,
  );
  const { data: contacts = [], isLoading: loadingContacts, mutate: mutateContacts } = useSWR<Contact[]>(
    id && tab === 'contacts' ? `/accounts/${id}/contacts` : null,
    fetcher,
  );
  const { data: deals = [], isLoading: loadingDeals, mutate: mutateDeals } = useSWR<Deal[]>(
    id && tab === 'deals' ? `/accounts/${id}/deals` : null,
    fetcher,
  );

  if (loadingAccount) {
    return <div className="p-8 text-gray-400">{t.common.loading}</div>;
  }

  if (!account) {
    return (
      <div className="p-8">
        <p className="text-red-500">Fiók nem található.</p>
        <Link href="/accounts" className="text-brand-600 text-sm hover:underline mt-2 inline-block">← Vissza a fiókokhoz</Link>
      </div>
    );
  }

  const handleRefresh = () => {
    mutateAccount();
    if (tab === 'contacts') mutateContacts();
    else mutateDeals();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <Link href="/accounts"
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 transition w-fit">
        <ArrowLeft className="w-4 h-4" />
        Fiókok
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-brand-600" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{account.name}</h1>
                {account.accountType && (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACCOUNT_TYPE_STYLES[account.accountType] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ACCOUNT_TYPE_LABELS[account.accountType] ?? account.accountType}
                  </span>
                )}
              </div>
              {account.industry && (
                <p className="text-sm text-gray-500 mt-0.5">{account.industry}</p>
              )}
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                {account.website && (
                  <a href={account.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600">
                    <Globe className="w-3.5 h-3.5" />
                    {account.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {account.phone && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Phone className="w-3.5 h-3.5" />
                    {account.phone}
                  </span>
                )}
                {account.email && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Mail className="w-3.5 h-3.5" />
                    {account.email}
                  </span>
                )}
                {account.taxNumber && (
                  <span className="text-xs text-gray-400 font-mono">
                    Adószám: {account.taxNumber}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button type="button" onClick={handleRefresh}
            className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition">
            <RefreshCw className="w-3.5 h-3.5" /> Frissítés
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {([
            { key: 'contacts', label: 'Kapcsolatok', icon: User },
            { key: 'deals', label: 'Ügyletek', icon: TrendingUp },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                tab === key
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'contacts' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loadingContacts ? (
            <div className="p-8 text-center text-gray-400">{t.common.loading}</div>
          ) : contacts.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nincs kapcsolat ehhez a fiókhoz
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Név</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Telefon</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Állapot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contacts.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <Link href={`/customers/${c.id}`}
                        className="font-medium text-gray-900 hover:text-brand-600 transition">
                        {c.firstName} {c.lastName}
                      </Link>
                      {c.contactType && (
                        <div className="text-xs text-gray-400 mt-0.5">{c.contactType}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{c.email ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {c.isActive ? 'Aktív' : 'Inaktív'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'deals' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loadingDeals ? (
            <div className="p-8 text-center text-gray-400">{t.common.loading}</div>
          ) : deals.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nincs ügylet ehhez a fiókhoz
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Ügylet</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Szakasz</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Érték</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Várható zárás</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deals.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{d.title}</div>
                      {d.probability != null && (
                        <div className="text-xs text-gray-400 mt-0.5">{d.probability}% valószínűség</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${DEAL_STAGE_STYLES[d.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                        {DEAL_STAGE_LABELS[d.stage] ?? d.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {fmt(d.value, d.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {d.expectedCloseDate
                        ? new Date(d.expectedCloseDate).toLocaleDateString('hu-HU')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
