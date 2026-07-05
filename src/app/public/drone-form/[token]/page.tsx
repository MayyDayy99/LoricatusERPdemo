'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  HardHat, MapPin, Calendar, CheckCircle2, AlertCircle,
  RefreshCw, Paperclip, X,
} from 'lucide-react';

interface FormFieldSchema {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'checkbox' | 'select' | 'file';
  required?: boolean;
  options?: { value: string; label: string }[];
  maxFiles?: number;
  maxBytes?: number;
  mimeAllowlist?: string[];
}

interface FormState {
  status: 'pending' | 'submitted';
  fields: FormFieldSchema[];
  operationSummary: { location?: string; plannedDate?: string; operationType?: string };
  submittedAt?: string;
}

interface UploadedAttachment {
  attachmentId: string;
  filename: string;
}

// `||` (NEM `??`) — üres-string env-varra is fallbackoljunk. A korábbi `??` miatt
// NAS-prod-on ha NEXT_PUBLIC_API_URL='' (üresen állítva a build-args-on át),
// API_BASE üres maradt → fetch a Next.js saját page-é-re ment → HTML jött vissza
// `<!DOCTYPE...` → "Unexpected token '<' is not valid JSON" silent-fail.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

function fmtDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function DroneFormPublicPage() {
  const { token } = useParams() as { token: string };
  const [data, setData] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Defenzív fetch + JSON-parse: a SyntaxError a r.json()-en homályos
    // "JSON.parse: unexpected character"-üzenetet ad, amiből a user nem
    // tudja eldönteni mi a baj (NEM kapott választ / AdBlock cserélte /
    // szerver HTML-t adott vissza). Most r.text()-szel olvassuk a body-t,
    // és informatív hibaüzenetet adunk a UI-n.
    (async () => {
      try {
        const url = `${API_BASE}/public/drone-form/${token}`;
        const r = await fetch(url, { cache: 'no-store' });
        const ct = r.headers.get('content-type') ?? '';
        const text = await r.text();

        if (!ct.includes('application/json')) {
          // A NAS-on AdBlock vagy Brave Shield néha "lecserélt" választ ad
          // text/html-lel — vagy a reverse-proxy hibás (502 + nginx-HTML).
          const preview = text.slice(0, 200).replace(/\s+/g, ' ').trim();
          throw new Error(
            `A szerver válasza nem JSON (${r.status}, ${ct || 'no content-type'}). ` +
            `Tipp: ellenőrizd a browser-bővítményeket (uBlock / AdBlock / Brave Shield) — ` +
            `kapcsold ki ezen az oldalon, és próbáld újra. ` +
            (preview ? `Első 200 char: ${preview}` : 'Üres válasz.'),
          );
        }

        let body: any = null;
        try { body = JSON.parse(text); }
        catch {
          throw new Error(
            `A JSON-válasz hibás (${r.status}). Első 200 char: ` +
            text.slice(0, 200).replace(/\s+/g, ' ').trim(),
          );
        }

        if (!r.ok) throw new Error(body?.message ?? `HTTP ${r.status}`);
        setData(body as FormState);
      } catch (e: any) {
        setError(e?.message ?? 'Hiba');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const fileField = data?.fields.find(f => f.type === 'file');
  const maxFiles = fileField?.maxFiles ?? 5;
  const maxBytes = fileField?.maxBytes ?? 10 * 1024 * 1024;
  const mimeAllowlist = fileField?.mimeAllowlist ?? ['application/pdf', 'image/jpeg', 'image/png'];

  async function handleUpload(file: File) {
    if (!file) return;
    if (attachments.length >= maxFiles) {
      setError(`Max ${maxFiles} fájl tölthető fel`);
      return;
    }
    if (file.size > maxBytes) {
      setError(`A fájl nagyobb, mint ${Math.round(maxBytes / 1024 / 1024)} MB`);
      return;
    }
    if (!mimeAllowlist.includes(file.type)) {
      setError('Csak PDF, JPG vagy PNG fájl engedélyezett');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/public/drone-form/${token}/upload`, {
        method: 'POST', body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      const out = (await res.json()) as UploadedAttachment;
      setAttachments(prev => [...prev, out]);
    } catch (err: any) {
      setError(err?.message ?? 'Feltöltés sikertelen');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;

    // Kliens-oldali kötelező-mező validáció — a backend ugyanazt ellenőrzi.
    for (const f of data.fields) {
      if (!f.required) continue;
      if (f.type === 'file') continue;
      const v = values[f.key];
      if (f.type === 'checkbox') {
        if (v !== true) { setError(`Kötelező elfogadni: ${f.label}`); return; }
      } else if (typeof v !== 'string' || v.trim().length === 0) {
        setError(`Kötelező mező: ${f.label}`); return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/public/drone-form/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submittedData: values,
          attachmentIds: attachments.map(a => a.attachmentId),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message ?? 'Beküldés sikertelen');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <RefreshCw className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-gray-900 mb-2">Hozzáférés megtagadva</h1>
          <p className="text-sm text-gray-600">
            A link lejárt, érvénytelen vagy már fel lett használva. Kérjük kérd meg az ügyintézőt új linkre.
          </p>
          {error && <p className="text-xs text-gray-400 mt-3">{error}</p>}
        </div>
      </div>
    );
  }

  const showThankYou = submitted || data.status === 'submitted';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <HardHat className="w-6 h-6 text-brand-600" />
          <div>
            <h1 className="font-bold text-gray-900">Megrendelői nyilatkozat</h1>
            <p className="text-xs text-gray-400">Drón repülés — {data.operationSummary.operationType ?? 'légtér ügyintézés'}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Operation summary */}
        <section className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Repülés adatai</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {data.operationSummary.location && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                <span className="text-gray-700">{data.operationSummary.location}</span>
              </div>
            )}
            {data.operationSummary.plannedDate && (
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                <span className="text-gray-700">{fmtDate(data.operationSummary.plannedDate)}</span>
              </div>
            )}
          </div>
        </section>

        {showThankYou && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
            <div>
              <p className="font-bold text-green-900">Köszönjük, az adatok megérkeztek</p>
              <p className="text-sm text-green-700 mt-1">
                {data.submittedAt ? `Beküldve: ${fmtDate(data.submittedAt)}` : 'A nyilatkozatot rögzítettük a rendszerünkben.'}
              </p>
            </div>
          </div>
        )}

        {!showThankYou && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 space-y-4">
            {data.fields.map(field => {
              if (field.type === 'file') {
                return (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field.label}
                    </label>
                    <div className="space-y-2">
                      {attachments.map(a => (
                        <div key={a.attachmentId} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm">
                          <Paperclip className="w-4 h-4 text-gray-400" />
                          <span className="flex-1 truncate text-gray-700">{a.filename}</span>
                          <button
                            type="button"
                            onClick={() => setAttachments(prev => prev.filter(p => p.attachmentId !== a.attachmentId))}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {attachments.length < maxFiles && (
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={mimeAllowlist.join(',')}
                          disabled={uploading}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                          className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 file:cursor-pointer disabled:opacity-50"
                        />
                      )}
                      {uploading && <p className="text-xs text-gray-500">Feltöltés folyamatban…</p>}
                    </div>
                  </div>
                );
              }
              if (field.type === 'checkbox') {
                return (
                  <label key={field.key} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={values[field.key] === true}
                      onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.checked }))}
                      className="mt-0.5 w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">
                      {field.label}{field.required && <span className="text-red-500"> *</span>}
                    </span>
                  </label>
                );
              }
              if (field.type === 'textarea') {
                return (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}{field.required && <span className="text-red-500"> *</span>}
                    </label>
                    <textarea
                      value={(values[field.key] as string) ?? ''}
                      onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                );
              }
              if (field.type === 'select') {
                return (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}{field.required && <span className="text-red-500"> *</span>}
                    </label>
                    <select
                      value={(values[field.key] as string) ?? ''}
                      onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                    >
                      <option value="">— válassz —</option>
                      {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                );
              }
              // text, date
              return (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}{field.required && <span className="text-red-500"> *</span>}
                  </label>
                  <input
                    type={field.type === 'date' ? 'date' : 'text'}
                    value={(values[field.key] as string) ?? ''}
                    onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              );
            })}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? 'Küldés…' : 'Beküldés'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
