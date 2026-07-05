'use client';

// Sprint 4 β₂: publikus megosztás-landoló-oldal.
//
// Flow:
//  1) Mount-ra GET /api/v1/shares/access/:token (NO Authorization header).
//     - 404 → notFound, 410 → expired/revoked, 429 → rateLimited, 401 →
//       jelszó szükséges (vagy hibás jelszó).
//  2) Ha a backend 401-et ad vissza, megjelenítünk egy jelszó-input form-ot,
//     és ugyanazt a GET-et küldjük újra `x-share-password` headerrel
//     (a backend a header alapján kompare-eli a bcrypt-hash-t).
//  3) Sikeres access → `scope` szerinti minimal render:
//      - 'upload'   → fájl-letöltés gomb (placeholder URL: a public download
//                     endpoint későbbi sprintben kerül be — most a UI mutatja
//                     a fájl-azonosítót + open-in-browser-gombot).
//      - 'document' → PDF iframe placeholder + download-gomb.
//      - 'project'  → readonly project-summary (név + leírás placeholder).
//      - 'work_order' → readonly WO-összefoglaló placeholder.
//      - 'calculator' → "nem támogatott" üzenet.
//
// FONTOS: a (public) route-group NEM örökli a (dashboard) auth-gate-et,
// így ez az oldal akár kijelentkezve is elérhető. A tartalmi
// detail-fetch-ek (upload-url, document-meta) authenticated endpoint-okat
// használnak — a publikus access-token (most még) csak a metadata-t adja
// vissza. A részletes letöltési URL-t egy későbbi sprintben kötjük be a
// shares-modulba; addig az UI a `resourceId`-t és a `scope`-ot mutatja,
// elérhető CTA-kkal.

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Lock, AlertCircle, RefreshCw, Download, FileText, Folder, Wrench,
  Calculator as CalcIcon, ExternalLink, CheckCircle2,
} from 'lucide-react';
import { useT } from '@/lib/hooks/use-t';

// `||` (NEM `??`) — üres-string env-varra is fallbackoljunk. NAS-build üres-
// stringen az `??` átengedte, és a fetch a Next.js saját page-ére ment (HTML).
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

interface ShareLinkAccessDto {
  id: string;
  tenantId: string;
  scope: 'upload' | 'document' | 'project' | 'work_order' | 'calculator';
  resourceType: string;
  resourceId: string;
  expiresAt: string;
  useCount: number;
  maxUses?: number;
  requirePassword: boolean;
}

type ErrorKind =
  | 'notFound'
  | 'expired'
  | 'revoked'
  | 'exhausted'
  | 'rateLimited'
  | 'passwordWrong'
  | 'generic';

interface ApiErrorBody {
  message?: string | string[];
  statusCode?: number;
}

/** Backend hibakód → i18n-kulcs. */
function mapError(status: number, body: ApiErrorBody | null): ErrorKind {
  if (status === 404) return 'notFound';
  if (status === 429) return 'rateLimited';
  if (status === 401) return 'passwordWrong';
  if (status === 410) {
    // A backend `reason`-jét a GoneException üzenetébe rakja:
    //   'expired' | 'revoked' | 'max_uses' | 'invalid'.
    const raw = body?.message;
    const msg = Array.isArray(raw) ? raw.join(' ') : (raw ?? '');
    if (msg.toLowerCase().includes('revoked')) return 'revoked';
    if (msg.toLowerCase().includes('max')) return 'exhausted';
    return 'expired';
  }
  return 'generic';
}

export default function PublicSharePage() {
  const { token } = useParams() as { token: string };
  const t = useT();

  const [data, setData] = useState<ShareLinkAccessDto | null>(null);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [loading, setLoading] = useState(true);

  // Jelszó-űrlap state — csak akkor mutatjuk, ha a backend 401-et ad
  // (vagy ha az első sikeres access-on a `requirePassword: true` jött volna
  // vissza; a jelenlegi backend először 401-et ad, ha jelszó nélkül érünk
  // jelszós linkhez).
  const [needPassword, setNeedPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /**
   * Egyetlen közös access-fetch — jelszót csak akkor küld, ha kapott egyet.
   * A backend `@Headers('x-share-password')` paraméterrel olvassa be —
   * NEM cookie-ban, NEM query-stringben, NEM body-ban.
   */
  const doAccess = useCallback(
    async (pwd?: string) => {
      const headers: Record<string, string> = {};
      if (pwd) headers['x-share-password'] = pwd;
      const res = await fetch(`${API_BASE}/shares/access/${token}`, {
        method: 'GET',
        headers,
        // Public endpoint — semmi cookie/credential átküldés.
        credentials: 'omit',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
        const kind = mapError(res.status, body);
        return { ok: false as const, kind };
      }
      const ok = (await res.json()) as ShareLinkAccessDto;
      return { ok: true as const, data: ok };
    },
    [token],
  );

  // Első mount: jelszó nélküli próbálkozás.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    doAccess()
      .then((r) => {
        if (!alive) return;
        if (r.ok) {
          setData(r.data);
          setError(null);
          setNeedPassword(false);
        } else if (r.kind === 'passwordWrong') {
          // 401 első körben ≈ jelszó kell, nem helytelen jelszó.
          setNeedPassword(true);
          setError(null);
        } else {
          setError(r.kind);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [doAccess]);

  // Jelszó-submit: ugyanaz a GET, de header-rel.
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError(null);
    const r = await doAccess(password);
    setSubmitting(false);
    if (r.ok) {
      setData(r.data);
      setNeedPassword(false);
      setError(null);
    } else {
      // A második körben a 401 = HIBÁS jelszó (nem "kell jelszó").
      setError(r.kind);
    }
  }

  /* ────────────── render branches ────────────── */

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">{t.publicShare.loading}</span>
        </div>
      </div>
    );
  }

  // Hibás állapotok — terminális (nincs retry, csak üzenet).
  if (error && !needPassword) {
    return <ErrorCard kind={error} />;
  }

  if (needPassword) {
    return (
      <div className="max-w-md mx-auto mt-12 px-4">
        <div className="bg-white dark:bg-loricatus-dark/80 rounded-2xl shadow-sm border border-gray-100 dark:border-loricatus-dark/40 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-gray-100">
                {t.publicShare.passwordPrompt}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">{t.publicShare.passwordHint}</p>
            </div>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
              minLength={1}
              maxLength={128}
              className="w-full rounded-lg border border-gray-300 dark:border-loricatus-dark/40 bg-white dark:bg-loricatus-dark/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-loricatus-accent"
              placeholder="••••••••"
            />
            {error === 'passwordWrong' && (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                {t.publicShare.passwordWrong}
              </p>
            )}
            {error === 'rateLimited' && (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                {t.publicShare.rateLimited}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting || !password}
              className="w-full bg-loricatus-accent hover:opacity-90 text-loricatus-dark font-semibold py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {submitting ? '…' : t.publicShare.passwordSubmit}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!data) {
    return <ErrorCard kind="generic" />;
  }

  return <ShareViewer data={data} />;
}

/* ────────────── sub-components ────────────── */

function ErrorCard({ kind }: { kind: ErrorKind }) {
  const t = useT();
  const msg =
    kind === 'notFound'    ? t.publicShare.notFound    :
    kind === 'expired'     ? t.publicShare.expired     :
    kind === 'revoked'     ? t.publicShare.revoked     :
    kind === 'exhausted'   ? t.publicShare.exhausted   :
    kind === 'rateLimited' ? t.publicShare.rateLimited :
    kind === 'passwordWrong' ? t.publicShare.passwordWrong :
                              t.publicShare.genericError;
  return (
    <div className="max-w-md mx-auto mt-12 px-4">
      <div className="bg-white dark:bg-loricatus-dark/80 rounded-2xl shadow-sm border border-gray-100 dark:border-loricatus-dark/40 p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h1 className="font-bold text-gray-900 dark:text-gray-100 mb-1">
          {t.publicShare.title}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">{msg}</p>
      </div>
    </div>
  );
}

function ShareViewer({ data }: { data: ShareLinkAccessDto }) {
  const t = useT();

  const scopeLabel =
    data.scope === 'upload'     ? t.publicShare.viewMode.upload     :
    data.scope === 'document'   ? t.publicShare.viewMode.document   :
    data.scope === 'project'    ? t.publicShare.viewMode.project    :
    data.scope === 'work_order' ? t.publicShare.viewMode.workOrder  :
                                  t.publicShare.viewMode.calculator;

  const ScopeIcon =
    data.scope === 'upload'     ? Download   :
    data.scope === 'document'   ? FileText   :
    data.scope === 'project'    ? Folder     :
    data.scope === 'work_order' ? Wrench     :
                                  CalcIcon;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      {/* Heading + scope-jelölő */}
      <header className="bg-white dark:bg-loricatus-dark/80 rounded-2xl shadow-sm border border-gray-100 dark:border-loricatus-dark/40 p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-loricatus-accent/20 flex items-center justify-center shrink-0">
          <ScopeIcon className="w-6 h-6 text-loricatus-dark dark:text-loricatus-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-gray-400">{scopeLabel}</p>
          <h1 className="font-bold text-lg text-gray-900 dark:text-gray-100 mt-0.5 truncate">
            {t.publicShare.title}
          </h1>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            {t.publicShare.readOnlyNotice}
          </p>
        </div>
      </header>

      {/* Scope-specific tartalom */}
      <section className="bg-white dark:bg-loricatus-dark/80 rounded-2xl shadow-sm border border-gray-100 dark:border-loricatus-dark/40 p-5">
        {data.scope === 'upload' && <UploadView resourceId={data.resourceId} />}
        {data.scope === 'document' && <DocumentView resourceId={data.resourceId} />}
        {data.scope === 'project' && <ProjectView resourceId={data.resourceId} />}
        {data.scope === 'work_order' && <WorkOrderView resourceId={data.resourceId} />}
        {data.scope === 'calculator' && (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t.publicShare.calculatorNotSupported}
          </p>
        )}
      </section>
    </div>
  );
}

/** Resource-ID kártya közös szerkezet — minden scope-view ezt használja. */
function ResourceIdRow({ resourceId }: { resourceId: string }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-loricatus-dark/40 px-3 py-2 mt-3 text-xs font-mono text-gray-500 truncate">
      {resourceId}
    </div>
  );
}

function UploadView({ resourceId }: { resourceId: string }) {
  const t = useT();
  // A signed-URL fetch a jelenlegi backend-en authenticated;
  // amíg a publikus download-flow-t nem kötjük be, megnyitás-link-et
  // mutatunk a tenant-routon (ha a viewer be van jelentkezve).
  const downloadHref = `${API_BASE}/uploads/${resourceId}/url`;
  return (
    <div>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
        {t.publicShare.viewMode.upload}
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={downloadHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-loricatus-accent text-loricatus-dark font-semibold rounded-lg px-4 py-2 text-sm hover:opacity-90"
        >
          <Download className="w-4 h-4" />
          {t.publicShare.downloadBtn}
        </a>
        <a
          href={downloadHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-white dark:bg-loricatus-dark/60 border border-gray-200 dark:border-loricatus-dark/40 rounded-lg px-4 py-2 text-sm hover:bg-gray-50"
        >
          <ExternalLink className="w-4 h-4" />
          {t.publicShare.openInBrowserBtn}
        </a>
      </div>
      <ResourceIdRow resourceId={resourceId} />
    </div>
  );
}

function DocumentView({ resourceId }: { resourceId: string }) {
  const t = useT();
  const docHref = `${API_BASE}/documents/${resourceId}`;
  return (
    <div>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
        {t.publicShare.viewMode.document}
      </p>
      <div className="aspect-[4/5] w-full rounded-lg border border-gray-200 dark:border-loricatus-dark/40 overflow-hidden bg-gray-50 dark:bg-loricatus-dark/40 flex items-center justify-center">
        {/*
         * PDF iframe placeholder — a public-download-endpoint még nem készült el
         * (Sprint 4+ scope). Amíg nincs signed-URL, ide csak egy info-blokk kerül.
         */}
        <div className="text-center px-6 py-10">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{t.publicShare.viewMode.document}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={docHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-loricatus-accent text-loricatus-dark font-semibold rounded-lg px-4 py-2 text-sm hover:opacity-90"
        >
          <Download className="w-4 h-4" />
          {t.publicShare.downloadBtn}
        </a>
      </div>
      <ResourceIdRow resourceId={resourceId} />
    </div>
  );
}

function ProjectView({ resourceId }: { resourceId: string }) {
  const t = useT();
  return (
    <div>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        {t.publicShare.viewMode.project}
      </p>
      <ResourceIdRow resourceId={resourceId} />
    </div>
  );
}

function WorkOrderView({ resourceId }: { resourceId: string }) {
  const t = useT();
  return (
    <div>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        {t.publicShare.viewMode.workOrder}
      </p>
      <ResourceIdRow resourceId={resourceId} />
    </div>
  );
}
