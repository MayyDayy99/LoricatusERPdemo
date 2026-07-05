'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import {
  Eye, EyeOff, Save, Zap, Trash2, RefreshCw,
  CheckCircle2, AlertCircle, X,
} from 'lucide-react';
import { useT } from '@/lib/hooks/use-t';
import {
  upsertIntegration,
  testIntegration,
  deleteIntegration,
  type IntegrationProvider,
  type IntegrationRecord,
} from '@/lib/hooks/use-integrations';

/* ── Field definitions ─────────────────────────────────────────── */

type FieldType = 'text' | 'secret';

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
}

const PROVIDER_FIELDS: Record<IntegrationProvider, FieldDef[]> = {
  sendgrid: [
    { key: 'apiKey',    label: 'API Key',    type: 'secret', placeholder: 'SG.xxxxxxxxxxxx', required: true },
    { key: 'fromEmail', label: 'From Email', type: 'text',   placeholder: 'noreply@example.com', required: true },
    { key: 'fromName',  label: 'From Name',  type: 'text',   placeholder: 'Acme Inc.', required: false },
  ],
  azure_storage: [
    { key: 'accountName',   label: 'Account Name',   type: 'text',   placeholder: 'mystorageaccount', required: true },
    { key: 'accountKey',    label: 'Account Key',    type: 'secret', placeholder: 'base64...==', required: true },
    { key: 'containerName', label: 'Container Name', type: 'text',   placeholder: 'uploads', required: true },
  ],
  google_maps: [
    { key: 'apiKey', label: 'API Key', type: 'secret', placeholder: 'AIzaSy...', required: true },
  ],
  notam: [
    { key: 'apiUrl', label: 'API URL', type: 'text',   placeholder: 'https://notam.example/api', required: true },
    { key: 'apiKey', label: 'API Key', type: 'secret', placeholder: '••••••••', required: true },
  ],
  pdf: [
    { key: 'chromiumExecutablePath', label: 'Chromium Executable Path', type: 'text', placeholder: '/usr/bin/chromium', required: false },
  ],
  sketchfab: [
    { key: 'modelIdMapping', label: 'Model ID Mapping (JSON)', type: 'text', placeholder: '{"droneA":"abc123"}', required: false },
  ],
};

const PROVIDER_META: Record<IntegrationProvider, { title: string; description: string }> = {
  sendgrid:      { title: 'SendGrid',       description: 'E-mail küldés tenant SendGrid kulcsával (felülírja a környezeti változót).' },
  azure_storage: { title: 'Azure Storage',  description: 'Fájlfeltöltés saját Azure Blob Storage fiókba.' },
  google_maps:   { title: 'Google Maps',    description: 'Térkép és helymeghatározás saját Google Maps API kulccsal.' },
  notam:         { title: 'NOTAM',          description: 'NOTAM légtér-adatok lekérdezése egyedi végpontról.' },
  pdf:           { title: 'PDF Render',     description: 'PDF generálás egyedi Chromium binárissal (puppeteer override).' },
  sketchfab:     { title: 'Sketchfab',      description: 'Drón modellek 3D nézete egyedi Sketchfab model-ID megfeleltetéssel.' },
};

/* ── Component ─────────────────────────────────────────────────── */

interface Props {
  provider: IntegrationProvider;
  record: IntegrationRecord | undefined;
  onChanged: () => void;
}

export function IntegrationCard({ provider, record, onChanged }: Props) {
  const t = useT();
  const tInt = t.integrations;
  const fields = PROVIDER_FIELDS[provider];
  const meta = PROVIDER_META[provider];

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, ''])),
  );
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const hasCredential = Boolean(record?.hasCredential);
  const lastResult = record?.lastTestResult;

  const badge = (() => {
    if (!hasCredential) {
      return { cls: 'bg-gray-100 text-gray-500',     label: tInt.noKey };
    }
    if (lastResult === 'ok') {
      return { cls: 'bg-green-100 text-green-700',   label: tInt.statusOk };
    }
    if (lastResult === 'failed') {
      return { cls: 'bg-red-100 text-red-700',       label: tInt.statusFailed };
    }
    return { cls: 'bg-amber-100 text-amber-700',     label: tInt.statusNotTested };
  })();

  function effectiveCreds(): Record<string, string> {
    /* Üres mezők elhagyva — ha a felhasználó nem írt új értéket,
       a backend megtartja a meglévőt (csak változott mezőket küldjük). */
    const out: Record<string, string> = {};
    for (const f of fields) {
      if (values[f.key]?.trim().length) out[f.key] = values[f.key];
    }
    return out;
  }

  async function handleSave() {
    const creds = effectiveCreds();
    if (Object.keys(creds).length === 0 && !hasCredential) {
      toast.error(tInt.saveAtLeastOne);
      return;
    }
    setSaving(true);
    try {
      await upsertIntegration(provider, creds);
      toast.success(tInt.savedToast(meta.title));
      setValues(Object.fromEntries(fields.map((f) => [f.key, ''])));
      onChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg ?? tInt.saveFailed));
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    const creds = effectiveCreds();
    if (Object.keys(creds).length === 0 && !hasCredential) {
      toast.error(tInt.testAtLeastOne);
      return;
    }
    setTesting(true);
    try {
      const res = await testIntegration(provider, creds);
      if (res.ok) {
        toast.success(res.message || tInt.testOkToast(meta.title));
      } else if (res.timeout) {
        // Audit #8: timeout-specifikus toast (tobbet mond mint generic "test failed")
        toast.error(tInt.testTimeoutToast(meta.title));
      } else {
        toast.error(res.message || tInt.testFailToast(meta.title));
      }
      onChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg ?? tInt.genericTestFailed));
    } finally {
      setTesting(false);
    }
  }

  async function performDelete() {
    setShowConfirm(false);
    setDeleting(true);
    try {
      await deleteIntegration(provider);
      toast.success(tInt.deletedToast(meta.title));
      setValues(Object.fromEntries(fields.map((f) => [f.key, ''])));
      onChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg ?? tInt.deleteFailed));
    } finally {
      setDeleting(false);
    }
  }

  function placeholderFor(f: FieldDef): string {
    const masked = record?.maskedCredentials?.[f.key];
    if (masked) return String(masked);
    return f.placeholder ?? '';
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-1 border-b border-gray-50">
        <div className="flex items-start gap-3">
          <span className="text-brand-500 mt-0.5"><Zap className="w-5 h-5" /></span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-gray-900">{meta.title}</h2>
              <span className={clsx(
                'text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full',
                badge.cls,
              )}>
                {badge.label}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{meta.description}</p>
            {record?.lastTestedAt && (
              <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                {lastResult === 'ok'
                  ? <CheckCircle2 className="w-3 h-3 text-green-500" />
                  : <AlertCircle className="w-3 h-3 text-red-500" />}
                {tInt.lastTestLabel} {new Date(record.lastTestedAt).toLocaleString()}
                {record.lastTestError && (
                  <span className="text-red-600">— {record.lastTestError}</span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-3">
        {fields.map((f) => {
          const isSecret = f.type === 'secret';
          const reveal = revealed[f.key] ?? false;
          const inputType = isSecret && !reveal ? 'password' : 'text';
          return (
            <div key={f.key}>
              <label
                htmlFor={`int-${provider}-${f.key}`}
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                {f.label}
                {f.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <div className="relative">
                <input
                  id={`int-${provider}-${f.key}`}
                  type={inputType}
                  value={values[f.key] ?? ''}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                  placeholder={placeholderFor(f)}
                  className={clsx(
                    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400',
                    isSecret && 'pr-10 font-mono',
                  )}
                  autoComplete="off"
                />
                {isSecret && (
                  <button
                    type="button"
                    onClick={() =>
                      setRevealed((r) => ({ ...r, [f.key]: !r[f.key] }))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
                    title={reveal ? tInt.hideKey2 : tInt.revealKey}
                  >
                    {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || testing || deleting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-60"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? tInt.saving : tInt.save}
        </button>

        <button
          type="button"
          onClick={handleTest}
          disabled={saving || testing || deleting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-brand-200 bg-brand-50 text-brand-700 text-sm font-medium hover:bg-brand-100 transition disabled:opacity-60"
        >
          {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {testing ? tInt.testing : tInt.test}
        </button>

        {hasCredential && (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={saving || testing || deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 transition disabled:opacity-60 ml-auto"
          >
            {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {deleting ? tInt.deleting : tInt.delete}
          </button>
        )}
      </div>

      {hasCredential && (
        <p className="text-[11px] text-gray-400">
          {tInt.existingHint}
        </p>
      )}

      {/* Audit #11: nativ window.confirm() helyett React-modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`confirm-title-${provider}`}
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-[92%] p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <h3
                  id={`confirm-title-${provider}`}
                  className="font-bold text-gray-900"
                >
                  {tInt.deleteConfirmTitle(meta.title)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="text-gray-400 hover:text-gray-700"
                aria-label={t.common?.cancel ?? 'Cancel'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              {tInt.deleteConfirmBody(meta.title)}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
              >
                {t.common?.cancel ?? 'Cancel'}
              </button>
              <button
                type="button"
                onClick={performDelete}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition"
              >
                {tInt.confirmDelete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
