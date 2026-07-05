'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  Plus, Trash2, RefreshCw, CheckCircle2,
  Zap, Copy, Eye, EyeOff, ToggleLeft, ToggleRight,
  ChevronDown, ChevronRight, Send,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/lib/hooks/use-t';

/* ── types ──────────────────────────────────────────────────────────────────── */

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: string;
}

interface Delivery {
  id: string;
  event: string;
  statusCode: number | null;
  success: boolean;
  attemptNumber: number;
  createdAt: string;
}

const ALL_EVENTS = [
  'deal.won', 'deal.lost',
  'quote.accepted', 'quote.rejected',
  'invoice.paid', 'invoice.overdue',
  'work_order.completed', 'work_order.signed_off',
  'crm_task.assigned',
  'meeting.closed',
  '*',
];

/* ── helpers ────────────────────────────────────────────────────────────────── */

function generateSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'whsec_';
  for (let i = 0; i < 32; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

const fetcher = (url: string) => apiClient.get(url).then(r => r.data);

/* ── webhook card ───────────────────────────────────────────────────────────── */

function WebhookCard({
  wh, onToggle, onDelete, onUpdate,
}: {
  wh: Webhook;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<Webhook>) => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showDeliveries, setShowDeliveries] = useState(false);
  const [url, setUrl] = useState(wh.url);
  const [events, setEvents] = useState<string[]>(wh.events);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const { data: deliveries, mutate: mutateDeliveries } = useSWR<Delivery[]>(
    showDeliveries ? `/webhooks/${wh.id}/deliveries` : null,
    fetcher,
  );

  async function handleTest() {
    setTesting(true);
    try {
      await apiClient.post(`/webhooks/${wh.id}/test`);
      toast.success(t.webhooks.testSent);
      setShowDeliveries(true);
      // A kézbesítés a Bull-queue-n keresztül pár száz ms múlva fut le — adunk
      // időt, majd frissítjük a naplót (kétszer, hogy biztosan elkapjuk).
      setTimeout(() => mutateDeliveries(), 1500);
      setTimeout(() => mutateDeliveries(), 4000);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? t.webhooks.testFailed);
    } finally {
      setTesting(false);
    }
  }

  function toggleEvent(ev: string) {
    if (ev === '*') {
      setEvents(events.includes('*') ? [] : ['*']);
      return;
    }
    setEvents(prev =>
      prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev.filter(e => e !== '*'), ev],
    );
  }

  async function handleSave() {
    setSaving(true);
    await onUpdate({ url, events });
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className={clsx(
      'bg-white border rounded-xl p-5 space-y-4 transition',
      wh.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={clsx(
              'inline-block w-2 h-2 rounded-full',
              wh.isActive ? 'bg-green-500' : 'bg-gray-300',
            )} />
            <code className="text-sm font-mono text-gray-800 truncate block">{wh.url}</code>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {wh.events.map(ev => (
              <span key={ev} className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                {ev}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-brand-200 text-brand-700 hover:bg-brand-50 transition disabled:opacity-60"
            title={t.webhooks.testBtn}
          >
            {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {t.webhooks.testBtn}
          </button>
          <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-gray-100 transition" title={wh.isActive ? 'Deactivate' : 'Activate'}>
            {wh.isActive
              ? <ToggleRight className="w-5 h-5 text-brand-600" />
              : <ToggleLeft className="w-5 h-5 text-gray-400" />}
          </button>
          <button
            onClick={() => setEditing(!editing)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition"
          >
            {editing ? t.common.cancel : t.common.edit}
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 transition text-gray-400 hover:text-red-600">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Secret row */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="font-medium">{t.webhooks.secretLabel}:</span>
        <code className="font-mono">{showSecret ? wh.secret : '••••••••••••••••'}</code>
        <button onClick={() => setShowSecret(!showSecret)} className="p-0.5 hover:text-gray-700">
          {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => navigator.clipboard.writeText(wh.secret)}
          className="p-0.5 hover:text-gray-700"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t.webhooks.urlLabel}</label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 font-mono"
              placeholder="https://example.com/webhook"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t.webhooks.eventsLabel}</label>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENTS.map(ev => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => toggleEvent(ev)}
                  className={clsx(
                    'text-xs font-medium px-2.5 py-1 rounded-lg border transition',
                    events.includes(ev)
                      ? 'bg-brand-50 border-brand-300 text-brand-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300',
                  )}
                >
                  {ev === '*' ? t.webhooks.allEvents : ev}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-60"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {t.common.save}
          </button>
        </div>
      )}

      {/* Delivery log toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowDeliveries(!showDeliveries)}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition"
        >
          {showDeliveries ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {t.webhooks.deliveryLog}
        </button>
        {showDeliveries && (
          <button
            onClick={() => mutateDeliveries()}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
            title={t.webhooks.refresh}
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
      </div>

      {showDeliveries && deliveries && (
        <div className="border border-gray-100 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">{t.webhooks.colEvent}</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">{t.webhooks.colStatus}</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">{t.webhooks.colAttempt}</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">{t.webhooks.colTime}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {deliveries.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400">{t.webhooks.noDeliveries}</td></tr>
              )}
              {deliveries.map(d => (
                <tr key={d.id}>
                  <td className="px-3 py-2 font-mono">{d.event}</td>
                  <td className="px-3 py-2">
                    <span className={clsx(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold',
                      d.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
                    )}>
                      {d.statusCode ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500">#{d.attemptNumber}</td>
                  <td className="px-3 py-2 text-gray-400">{new Date(d.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── create modal ───────────────────────────────────────────────────────────── */

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: any) => void }) {
  const t = useT();
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [secret, setSecret] = useState(generateSecret());
  const [saving, setSaving] = useState(false);

  function toggleEvent(ev: string) {
    if (ev === '*') {
      setEvents(events.includes('*') ? [] : ['*']);
      return;
    }
    setEvents(prev =>
      prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev.filter(e => e !== '*'), ev],
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!url || events.length === 0) return;
    setSaving(true);
    await onCreate({ url, events, secret });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-5">
        <h2 className="text-lg font-bold text-gray-900">{t.webhooks.createTitle}</h2>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">{t.webhooks.urlLabel}</label>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 font-mono"
            placeholder="https://example.com/webhook"
            required
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t.webhooks.eventsLabel}</label>
          <div className="flex flex-wrap gap-2">
            {ALL_EVENTS.map(ev => (
              <button
                key={ev}
                type="button"
                onClick={() => toggleEvent(ev)}
                className={clsx(
                  'text-xs font-medium px-2.5 py-1 rounded-lg border transition',
                  events.includes(ev)
                    ? 'bg-brand-50 border-brand-300 text-brand-700'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300',
                )}
              >
                {ev === '*' ? t.webhooks.allEvents : ev}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">{t.webhooks.secretLabel}</label>
          <div className="flex gap-2">
            <input
              value={secret}
              onChange={e => setSecret(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 font-mono"
            />
            <button
              type="button"
              onClick={() => setSecret(generateSecret())}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">{t.webhooks.secretHint}</p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            {t.common.cancel}
          </button>
          <button
            type="submit"
            disabled={saving || !url || events.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-60"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {t.common.create}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── main page ──────────────────────────────────────────────────────────────── */

export default function WebhooksPage() {
  const t = useT();
  const { data: webhooks, mutate } = useSWR<Webhook[]>('/webhooks', fetcher);
  const [showCreate, setShowCreate] = useState(false);

  async function handleCreate(data: { url: string; events: string[]; secret: string }) {
    await apiClient.post('/webhooks', data);
    mutate();
    setShowCreate(false);
  }

  async function handleToggle(id: string, isActive: boolean) {
    await apiClient.patch(`/webhooks/${id}`, { isActive: !isActive });
    mutate();
  }

  async function handleDelete(id: string) {
    if (!confirm(t.webhooks.deleteConfirm)) return;
    await apiClient.delete(`/webhooks/${id}`);
    mutate();
  }

  async function handleUpdate(id: string, patch: Partial<Webhook>) {
    await apiClient.patch(`/webhooks/${id}`, patch);
    mutate();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.webhooks.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{t.webhooks.subtitle}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition"
        >
          <Plus className="w-4 h-4" />
          {t.webhooks.addBtn}
        </button>
      </div>

      {!webhooks && (
        <div className="text-center py-12 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
          {t.common.loading}
        </div>
      )}

      {webhooks && webhooks.length === 0 && (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
          <Zap className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">{t.webhooks.emptyState}</p>
        </div>
      )}

      <div className="space-y-4">
        {webhooks?.map(wh => (
          <WebhookCard
            key={wh.id}
            wh={wh}
            onToggle={() => handleToggle(wh.id, wh.isActive)}
            onDelete={() => handleDelete(wh.id)}
            onUpdate={(patch) => handleUpdate(wh.id, patch)}
          />
        ))}
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
    </div>
  );
}
