'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, Check, X, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { useT } from '@/lib/hooks/use-t';
import {
  useCustomerDuplicates,
  mergeCustomers,
  type CustomerDuplicateGroup,
  type CustomerDuplicateMember,
} from '@/lib/hooks/use-crm';

// E-feladat: customer-merge oldal — a 6451-es customer-bázison szervezett
// duplicate-csoportokat (email / név / cég) mutatjuk be, és egyetlen modálos
// side-by-side compare-rel meg lehet jelölni a megmaradó primary-t.
//
// A toast egy könnyű, függőség-mentes ephemerál state — az auto-clear 3s-ben
// elég, hogy a user lássa, mi történt, de ne maradjon ott örökre. A toast-state
// szándékosan a page-level — több modal-zárás után is láthatóvá kell tegye a
// szülő-listát.

interface Toast {
  kind: 'success' | 'error';
  text: string;
}

function MergeModal({
  group,
  onClose,
  onMerged,
}: {
  group: CustomerDuplicateGroup;
  onClose: () => void;
  onMerged: (text: string) => void;
}) {
  const t = useT();
  // Default-primary: a legrégebbi customer (a duplicates-csoportokban általában
  // ez a "kanonikus" rekord, mert az új adatfelvitelek később születtek). A
  // user szabadon átválthat.
  const initialPrimary = useMemo(() => {
    const sorted = [...group.customers].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return sorted[0].id;
  }, [group]);

  const [primaryId, setPrimaryId] = useState<string>(initialPrimary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = group.customers.slice(0, 4); // a modal max 4 oszlopot mutat — 5+ duplikátum esetén a user 2 lépésben olvaszt.

  const handleMerge = async () => {
    setLoading(true);
    setError(null);
    try {
      const mergeIds = visible.filter((c) => c.id !== primaryId).map((c) => c.id);
      if (mergeIds.length === 0) {
        setError('Legalább egy duplikátumot ki kell jelölni.');
        setLoading(false);
        return;
      }
      const res = await mergeCustomers(primaryId, mergeIds);
      onMerged(t.customers.merge.successToast(res.mergedCount));
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? t.customers.merge.errorToast));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t.customers.merge.modalTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition"
            aria-label={t.customers.merge.cancelBtn}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 bg-yellow-50 border-b border-yellow-100 text-sm text-yellow-800 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{t.customers.merge.modalHint}</p>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(200px, 1fr))` }}
          >
            {visible.map((c) => {
              const isPrimary = c.id === primaryId;
              return (
                <div
                  key={c.id}
                  className={`rounded-lg border-2 p-4 transition ${
                    isPrimary
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <label className="flex items-center gap-2 cursor-pointer mb-3">
                    <input
                      type="radio"
                      name={`primary-${group.key}`}
                      checked={isPrimary}
                      onChange={() => setPrimaryId(c.id)}
                      className="w-4 h-4 text-brand-600 cursor-pointer"
                    />
                    <span className={`text-xs font-semibold uppercase tracking-wide ${
                      isPrimary ? 'text-brand-700' : 'text-gray-400'
                    }`}>
                      {isPrimary ? t.customers.merge.primaryLabel : '—'}
                    </span>
                  </label>

                  <CustomerCompareCard customer={c} />
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="px-6 py-3 bg-red-50 border-t border-red-100 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            {t.customers.merge.cancelBtn}
          </button>
          <button
            type="button"
            onClick={handleMerge}
            disabled={loading}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {loading ? t.customers.merge.merging : t.customers.merge.mergeBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerCompareCard({ customer: c }: { customer: CustomerDuplicateMember }) {
  const t = useT();
  const fields: Array<[string, string | undefined | null]> = [
    [t.customers.colName, `${c.firstName} ${c.lastName}`.trim()],
    [t.customers.colEmail, c.email],
    [t.customers.colPhone, c.phone],
    [t.customers.colCompany, c.company],
    [t.customers.lifecycleLabel, c.lifecycleStage
      ? (t.customers.lifecycle as Record<string, string>)[c.lifecycleStage] ?? c.lifecycleStage
      : undefined],
    [t.customers.leadScoreLabel, c.leadScore != null ? String(c.leadScore) : undefined],
    ['ID', c.id.slice(0, 8) + '…'],
  ];
  return (
    <div className="space-y-2 text-sm">
      {fields.map(([label, value]) => (
        <div key={label}>
          <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
          <div className={value ? 'text-gray-900' : 'text-gray-300'}>{value ?? '—'}</div>
        </div>
      ))}
      <div className="pt-1">
        <Link
          href={`/customers/${c.id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
        >
          <ExternalLink className="w-3 h-3" />
          {t.customers.merge.viewPrimary}
        </Link>
      </div>
    </div>
  );
}

export default function CustomersMergePage() {
  const t = useT();
  const { groups, isLoading, mutate } = useCustomerDuplicates();
  const [active, setActive] = useState<CustomerDuplicateGroup | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (text: string, kind: Toast['kind'] = 'success') => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/customers"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.customers.merge.backToList}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t.customers.merge.title}</h1>
          <p className="text-gray-500 mt-1">{t.customers.merge.subtitle(groups.length)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="p-10 text-center text-gray-400">{t.customers.merge.empty}</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {groups.map((g) => (
              <li key={g.key}>
                <button
                  type="button"
                  onClick={() => setActive(g)}
                  className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-gray-50 transition"
                >
                  <div className="w-10 h-10 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {g.key.replace(/^(email|name|company):/, '')}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {t.customers.merge.keyTypes[g.keyType]}
                      {' · '}
                      {t.customers.merge.groupCount(g.customers.length)}
                    </div>
                  </div>
                  <div className="flex -space-x-2 shrink-0">
                    {g.customers.slice(0, 3).map((c) => (
                      <div
                        key={c.id}
                        title={`${c.firstName} ${c.lastName}`}
                        className="w-7 h-7 rounded-full bg-gray-200 text-[10px] text-gray-600 flex items-center justify-center border-2 border-white"
                      >
                        {(c.firstName?.[0] ?? '?').toUpperCase()}
                      </div>
                    ))}
                    {g.customers.length > 3 && (
                      <div className="w-7 h-7 rounded-full bg-gray-100 text-[10px] text-gray-500 flex items-center justify-center border-2 border-white">
                        +{g.customers.length - 3}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {active && (
        <MergeModal
          group={active}
          onClose={() => setActive(null)}
          onMerged={(text) => {
            showToast(text, 'success');
            void mutate();
          }}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm flex items-center gap-2 ${
            toast.kind === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
          role="status"
        >
          {toast.kind === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {toast.text}
        </div>
      )}
    </div>
  );
}
