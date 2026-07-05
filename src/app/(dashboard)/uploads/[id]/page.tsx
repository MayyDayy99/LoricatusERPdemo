'use client';

// Sprint 3 β₂ — Upload-detail oldal.
//
// 5 tab: Preview / Versions / Metadata / Linked-documents / Audit-timeline.
// A Preview MIME-szelekcionál: image/* → inline img; PDF → iframe; egyéb →
// download-csak. A signed URL `getDownloadUrl(id)` (5 perces preszín) — minden
// preview cache-eli a fetchelt URL-t a tab-on belül, hogy a re-render ne
// generáljon új signed-URL-t.

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import {
  ArrowLeft, Download, Copy, FileText, History, Info, Link2, ClipboardList,
  ExternalLink, AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { apiClient } from '@/lib/api-client';
import {
  useUploadVersions, getDownloadUrl, type Upload,
} from '@/lib/hooks/use-uploads';
import { useT } from '@/lib/hooks/use-t';
import { useProjects } from '@/lib/hooks/use-projects';
import { useUsers } from '@/lib/hooks/use-users';
import { AuditTimeline } from '@/components/audit/AuditTimeline';
import { UPLOAD_STATE_STYLES } from '@/lib/upload-lifecycle';

const fetcher = (url: string) => apiClient.get(url).then(r => r.data);

function formatBytes(bytes: number | undefined | null): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

type TabId = 'preview' | 'versions' | 'metadata' | 'documents' | 'audit';

interface LinkedDocument {
  id: string;
  title: string;
  state?: string;
  type?: string;
  createdAt: string;
}

export default function UploadDetailPage() {
  const t = useT();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  // A backend `GET /uploads/:id` endpoint nincs külön — a paginated lista-
  // szűrőjén keresztül kérjük. A defenzív path: ha a backend egyedi resource-t
  // ad vissza, használjuk; ha listát, az első itemet. (Lásd useUpload-shape.)
  // Most direkt: a `/uploads?take=1&id=…` query nem hivatalos; helyette
  // `GET /uploads/:id/versions` válaszának első eleméből vesszük a meta-t,
  // mert az ON találatra van a backend tényleges find-ja.
  const { versions, isLoading: versionsLoading } = useUploadVersions(id || null);

  // Az egyedi Upload itt a versions[0]-ban van (a /versions végpoint a hívott
  // id-vel kezdődik vagy a legfrissebb verzióval — a service `findVersionHistory`
  // az aktuális rekordot is visszaadja). A type-cast szigorú.
  const upload: Upload | null = useMemo(() => {
    if (!versions || versions.length === 0) return null;
    // A legfrissebb (highest version) — a service is így rendezi DESC.
    return versions.find(v => v.id === id) ?? versions[0];
  }, [versions, id]);

  // Linked documents — a documents.upload_id = id-vel szűrt.
  const { data: linkedDocs } = useSWR<LinkedDocument[] | { items: LinkedDocument[] }>(
    id ? `/documents?uploadId=${id}` : null,
    fetcher,
  );
  const documentsList: LinkedDocument[] = Array.isArray(linkedDocs)
    ? linkedDocs
    : (linkedDocs?.items ?? []);

  const { projects } = useProjects();
  const { users } = useUsers();

  const [tab, setTab] = useState<TabId>('preview');
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);
  const [copyToast, setCopyToast] = useState(false);

  // Signed URL lazy-fetch — csak akkor, amikor a Preview vagy Metadata tab
  // aktív (a többi tab nem igényli).
  useEffect(() => {
    if (!upload || (tab !== 'preview' && tab !== 'metadata')) return;
    if (signedUrl) return;
    if (upload.state !== 'available') return;
    let cancelled = false;
    setUrlLoading(true);
    void getDownloadUrl(upload.id).then((url) => {
      if (!cancelled) {
        setSignedUrl(url);
        setUrlLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setUrlLoading(false);
    });
    return () => { cancelled = true; };
  }, [upload, tab, signedUrl]);

  const projectName = projects?.find((p: any) => p.id === upload?.projectId)?.name;
  const uploaderName = users.find(u => u.id === upload?.uploadedBy);
  const uploaderLabel = uploaderName
    ? `${uploaderName.firstName} ${uploaderName.lastName}`
    : (upload?.uploadedBy ?? '—');

  const handleCopyUrl = async () => {
    if (!signedUrl) return;
    try {
      await navigator.clipboard.writeText(signedUrl);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    } catch { /* clipboard API not available */ }
  };

  if (versionsLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 bg-gray-100 rounded w-1/3 animate-pulse" />
        <div className="h-64 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!upload) {
    return (
      <div className="py-20 text-center text-gray-400">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p>{t.uploads.emptyActive}</p>
        <button
          type="button"
          onClick={() => router.push('/uploads')}
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.uploads.detail.backToList}
        </button>
      </div>
    );
  }

  const isImage = (upload.mimeType ?? '').startsWith('image/');
  const isPdf = upload.mimeType === 'application/pdf';
  const isAvailable = upload.state === 'available';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.push('/uploads')}
            className="text-gray-500 hover:text-brand-600 transition"
            title={t.uploads.detail.backToList}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate" title={upload.originalName ?? upload.fileName}>
              {upload.originalName ?? upload.fileName}
            </h1>
            <p className="text-xs text-gray-500 truncate">
              {upload.mimeType} · {formatBytes(upload.fileSize)} · v{upload.version}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {signedUrl && (
            <button
              type="button"
              onClick={handleCopyUrl}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Copy className="w-3.5 h-3.5" />
              {t.uploads.detail.copyUrlBtn}
            </button>
          )}
          {isAvailable && (
            <a
              href={signedUrl ?? '#'}
              onClick={async (e) => {
                if (!signedUrl) {
                  e.preventDefault();
                  const url = await getDownloadUrl(upload.id);
                  setSignedUrl(url);
                  window.open(url, '_blank');
                }
              }}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
            >
              <Download className="w-3.5 h-3.5" />
              {t.uploads.detail.downloadBtn}
            </a>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${UPLOAD_STATE_STYLES[upload.state] ?? 'bg-gray-100 text-gray-600'}`}>
          {(t.uploads.state as Record<string, string>)[upload.state] ?? upload.state}
        </span>
        {upload.scanResult && (
          <span className={clsx(
            'px-2 py-0.5 rounded text-xs font-medium',
            upload.scanResult === 'clean'    ? 'bg-green-100 text-green-700' :
            upload.scanResult === 'infected' ? 'bg-red-100 text-red-700'   :
                                                'bg-yellow-100 text-yellow-700',
          )}>
            {t.uploads.detail.meta.scanResult}: {upload.scanResult}
          </span>
        )}
        {projectName && (
          <Link
            href={`/projects/${upload.projectId}`}
            className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            {projectName}
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { id: 'preview',   label: t.uploads.tabs.preview,   Icon: FileText },
          { id: 'versions',  label: t.uploads.tabs.versions,  Icon: History },
          { id: 'metadata',  label: t.uploads.tabs.metadata,  Icon: Info },
          { id: 'documents', label: t.uploads.tabs.documents, Icon: Link2 },
          { id: 'audit',     label: t.uploads.tabs.audit,     Icon: ClipboardList },
        ] as const).map(({ id: tid, label, Icon }) => (
          <button
            key={tid}
            type="button"
            onClick={() => setTab(tid)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition',
              tab === tid ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'preview' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {!isAvailable ? (
            <div className="py-16 text-center text-gray-400">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t.uploads.detail.previewUnavail}</p>
            </div>
          ) : upload.isArchived ? (
            <div className="py-16 text-center text-gray-400">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t.uploads.detail.previewArchived}</p>
            </div>
          ) : urlLoading || !signedUrl ? (
            <div className="py-16 text-center text-gray-300">
              <div className="inline-block w-6 h-6 border-2 border-gray-300 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signedUrl} alt={upload.originalName ?? upload.fileName}
              className="w-full max-h-[60vh] object-contain bg-gray-50" />
          ) : isPdf ? (
            <iframe src={signedUrl} title={upload.originalName ?? upload.fileName}
              className="w-full h-[70vh]" />
          ) : (
            <div className="py-16 text-center text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t.uploads.detail.previewUnavail}</p>
              <a href={signedUrl} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700">
                <Download className="w-4 h-4" />
                {t.uploads.detail.downloadBtn}
              </a>
            </div>
          )}
        </div>
      )}

      {tab === 'versions' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {versions.length <= 1 ? (
            <p className="py-12 text-center text-sm text-gray-400">{t.uploads.detail.noVersions}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t.uploads.colVersion}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t.uploads.colName}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t.uploads.colSize}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t.uploads.colState}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t.uploads.colUploaded}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {versions.map(v => (
                  <tr key={v.id} className={clsx('hover:bg-gray-50', v.id === id && 'bg-brand-50/40')}>
                    <td className="px-4 py-2 font-mono text-xs">v{v.version}</td>
                    <td className="px-4 py-2">
                      <Link href={`/uploads/${v.id}`} className="text-gray-900 hover:text-brand-600 truncate block max-w-xs">
                        {v.originalName ?? v.fileName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-500">{formatBytes(v.fileSize)}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${UPLOAD_STATE_STYLES[v.state] ?? 'bg-gray-100 text-gray-600'}`}>
                        {(t.uploads.state as Record<string, string>)[v.state] ?? v.state}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{new Date(v.createdAt).toLocaleString('hu-HU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'metadata' && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3 max-w-3xl">
          <MetaRow label={t.uploads.detail.meta.sha} value={upload.sha256Checksum ?? '—'} mono />
          <MetaRow label={t.uploads.detail.meta.mimeType} value={upload.mimeType} />
          <MetaRow label={t.uploads.detail.meta.fileSize} value={formatBytes(upload.fileSize)} />
          <MetaRow label={t.uploads.detail.meta.state} value={(t.uploads.state as Record<string, string>)[upload.state] ?? upload.state} />
          <MetaRow label={t.uploads.detail.meta.category} value={(t.uploads.categoryLabels as Record<string, string>)[upload.category] ?? upload.category} />
          <MetaRow label={t.uploads.detail.meta.version} value={`v${upload.version}`} />
          <MetaRow label={t.uploads.detail.meta.uploadedBy} value={uploaderLabel} />
          <MetaRow label={t.uploads.detail.meta.uploadedAt} value={new Date(upload.createdAt).toLocaleString('hu-HU')} />
          {upload.scanResult && (
            <MetaRow label={t.uploads.detail.meta.scanResult} value={upload.scanResult} />
          )}
          {signedUrl && (
            <div className="border-t border-gray-100 pt-3">
              <div className="text-xs text-gray-500 mb-1">{t.uploads.detail.meta.signedUrl}</div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={signedUrl}
                  className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs font-mono bg-gray-50"
                />
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-2.5 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'documents' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {documentsList.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">{t.uploads.detail.noLinkedDocs}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cím</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Típus</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Állapot</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Létrehozva</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {documentsList.map(doc => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link href={`/documents/${doc.id}`} className="text-gray-900 hover:text-brand-600">{doc.title}</Link>
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{doc.type ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{doc.state ?? '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{new Date(doc.createdAt).toLocaleDateString('hu-HU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <AuditTimeline resource="upload" resourceId={upload.id} />
        </div>
      )}

      {copyToast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {t.uploads.detail.urlCopied}
        </div>
      )}
    </div>
  );
}

function MetaRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2 border-b border-gray-50 last:border-0">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={clsx('col-span-2 text-sm text-gray-800 break-all', mono && 'font-mono text-xs')}>
        {value}
      </div>
    </div>
  );
}
