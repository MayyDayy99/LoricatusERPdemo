'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { createDroneFormInvite } from '@/lib/hooks/use-drone';

/**
 * Meghívó-küldő modal egy drón-művelethez. A backend email-t küld a
 * megrendelőnek (drónjogosítvány/biztosítás/regisztráció feltöltése), és
 * visszaad egy linket, amit fall-back-ként ki lehet másolni.
 *
 * Mindkét helyen használt (a /drone listán + a /rooms/:projectId Műveletek
 * panelben) — közös komponens, hogy a logika ne duplikálódjon.
 */
export function FormInviteModal({
  operationId,
  onClose,
  onCreated,
}: {
  operationId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [busy, setBusy] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipientEmail.trim() || !recipientName.trim()) return;
    setBusy(true);
    try {
      const out = await createDroneFormInvite(operationId, {
        recipientEmail: recipientEmail.trim(),
        recipientName: recipientName.trim(),
        expiresInDays,
      });
      const webOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      setCreatedLink(out.link ?? `${webOrigin}/public/drone-form/${(out as any).token ?? ''}`);
      toast.success('Meghívó kiküldve');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Meghívó küldése sikertelen');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!createdLink) return;
    try {
      await navigator.clipboard.writeText(createdLink);
      toast.success('Link másolva');
    } catch {
      toast.error('Másolás sikertelen');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {!createdLink ? (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Megrendelői űrlap küldése</h3>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email cím</label>
              <input type="email" required value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Megrendelő neve</label>
              <input type="text" required maxLength={200} value={recipientName} onChange={e => setRecipientName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Érvényesség (nap)</label>
              <input type="number" min={1} max={60} value={expiresInDays}
                onChange={e => setExpiresInDays(Math.min(60, Math.max(1, parseInt(e.target.value, 10) || 14)))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Mégsem</button>
              <button type="submit" disabled={busy}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
                {busy ? 'Küldés…' : 'Küldés'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Meghívó kiküldve</h3>
            <p className="text-sm text-gray-600">Az email kiment, a link itt másolható (akkor is, ha az email nem érkezne meg):</p>
            <div className="flex gap-2">
              <input type="text" readOnly value={createdLink}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono bg-gray-50"
                onFocus={e => e.target.select()} />
              <button type="button" onClick={copyLink}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-brand-50 text-brand-700 hover:bg-brand-100">
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-end pt-2">
              <button type="button" onClick={() => { onCreated(); }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700">Rendben</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
