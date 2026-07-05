'use client';

import { useEffect, useState } from 'react';
import { Copy, Mail, Plus, Trash2, Trophy, UserPlus, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import {
  useReferrals,
  useMyReferralStats,
  useReferralLeaderboard,
  createReferral,
  revokeReferral,
  referralStatusLabel,
  referralStatusBadgeClass,
  type Referral,
} from '@/lib/hooks/use-referrals';

export default function ReferralsPage() {
  const { referrals, mutate, isLoading } = useReferrals();
  const { stats, mutate: mutateStats } = useMyReferralStats();
  const { leaderboard, mutate: mutateLeaderboard } = useReferralLeaderboard();
  const [createOpen, setCreateOpen] = useState(false);

  function refresh() {
    mutate();
    mutateStats();
    mutateLeaderboard();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meghívásos ügyfél-szerzés</h1>
          <p className="text-sm text-gray-500 mt-0.5">Küldj meghívólinket egy potenciális megrendelőnek — ha beregisztrál, +1 ügyfél a számodra.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
        >
          <Plus className="w-4 h-4" /> Új meghívó
        </button>
      </header>

      {/* Saját statisztika */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Beváltva" value={stats?.converted ?? 0} color="text-green-700" />
        <StatTile label="Folyamatban" value={stats?.pending ?? 0} color="text-blue-700" />
        <StatTile label="Lejárt" value={stats?.expired ?? 0} color="text-gray-500" />
        <StatTile label="Visszavonva" value={stats?.revoked ?? 0} color="text-red-600" />
      </section>

      {/* Referral-lista */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Meghívók</h2>
        {isLoading ? (
          <p className="text-sm text-gray-400">Betöltés…</p>
        ) : referrals.length === 0 ? (
          <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4">Még nincs egyetlen meghívó sem. Kattints az „Új meghívó” gombra.</p>
        ) : (
          <ul className="space-y-2">
            {referrals.map(r => (
              <ReferralRow key={r.id} r={r} onChanged={refresh} />
            ))}
          </ul>
        )}
      </section>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <section>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
            <Trophy className="w-4 h-4 text-amber-500" /> Toplista
          </h2>
          <ul className="space-y-1 bg-white rounded-lg border border-gray-100">
            {leaderboard.map((entry, idx) => (
              <li key={entry.userId} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-b-0">
                <span className="text-xs text-gray-400 font-mono w-6 text-right">{idx + 1}.</span>
                <span className="flex-1 text-sm text-gray-800">{entry.firstName} {entry.lastName}</span>
                <span className="text-sm text-green-700 font-semibold">{entry.converted} ügyfél</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {createOpen && (
        <CreateReferralModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); refresh(); }}
        />
      )}
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={clsx('text-2xl font-bold mt-1', color)}>{value}</p>
    </div>
  );
}

function ReferralRow({ r, onChanged }: { r: Referral; onChanged: () => void }) {
  const link = typeof window !== 'undefined' ? `${window.location.origin}/public/referral/${r.token}` : '';
  const expiresLabel = new Date(r.expiresAt).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' });
  const isPending = r.status === 'pending';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link kimásolva');
    } catch {
      toast.error('Másolás sikertelen');
    }
  }

  async function handleRevoke() {
    if (!confirm('Biztosan visszavonod a meghívót?')) return;
    try {
      await revokeReferral(r.id);
      toast.success('Meghívó visszavonva');
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Visszavonás sikertelen');
    }
  }

  return (
    <li className="bg-white rounded-lg border border-gray-100 px-4 py-3">
      <div className="flex items-center gap-3">
        <Mail className="w-4 h-4 text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-800 truncate">
            {r.recipientName ?? r.recipientEmail ?? '(név nélkül)'}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {r.recipientEmail && <>{r.recipientEmail} · </>}
            lejár: {expiresLabel}
            {r.sentAt && <> · ✉️ kiküldve</>}
          </p>
          {r.note && <p className="text-xs text-gray-400 mt-0.5 italic truncate">{r.note}</p>}
        </div>
        <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full border shrink-0', referralStatusBadgeClass(r.status))}>
          {referralStatusLabel(r.status)}
        </span>
        {isPending && (
          <>
            <button
              type="button"
              onClick={copyLink}
              title="Link másolása"
              className="p-1.5 text-gray-400 hover:text-brand-600 rounded shrink-0"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRevoke}
              title="Visszavonás"
              className="p-1.5 text-gray-400 hover:text-red-600 rounded shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function CreateReferralModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  // Escape-handler — a11y / UX-konzisztencia.
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [note, setNote] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createReferral({
        recipientName: recipientName.trim() || undefined,
        recipientEmail: recipientEmail.trim() || undefined,
        note: note.trim() || undefined,
        expiresInDays,
      });
      toast.success(recipientEmail ? 'Meghívó létrehozva és e-mailben kiküldve.' : 'Meghívó létrehozva — másold a linket.');
      onCreated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Meghívó létrehozása sikertelen');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5" /> Új meghívó
          </h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Megrendelő neve (opcionális)</label>
            <input
              type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
              placeholder="Vásárhelyi Klára"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">E-mail (opcionális — ha megadod, automatikusan kiküldjük)</label>
            <input
              type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)}
              maxLength={254}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
              placeholder="kolleg@example.com"
            />
            <p className="text-xs text-gray-400 mt-1">E-mail nélkül csak a linket lehet kimásolni.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Belső megjegyzés (opcionális)</label>
            <textarea
              value={note} onChange={(e) => setNote(e.target.value)}
              maxLength={500} rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
              placeholder="Honnan ismered, mit ajánlasz neki…"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Érvényesség (nap)</label>
            <input
              type="number" value={expiresInDays} onChange={(e) => setExpiresInDays(Math.max(1, Math.min(90, parseInt(e.target.value, 10) || 30)))}
              min={1} max={90}
              className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
              Mégse
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
              {submitting ? 'Létrehozás…' : 'Létrehozás'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
