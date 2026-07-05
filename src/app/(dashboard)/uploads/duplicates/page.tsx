'use client';

// Sprint 3 β₂ — SHA-256 alapú upload-duplikátum oldal.
//
// A backend `GET /uploads/duplicates` (uploads.controller.ts:findDuplicates)
// `Record<sha256, Upload[]>` válasz-shape. A frontend a 2+ tagú csoportokat
// (a backend kiszűri az 1-tagúakat) kártyán rendereli, és csoportszintű
// "Archive these N" bulk-műveletet kínál — a 'tartsd meg az elsőt, archiváld
// a többit' minta. A teljes-archiválás `bulkUpdateUploads(ids, { isArchived: true })`.

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Archive, Download, GitMerge, RefreshCw } from 'lucide-react';
import {
  useUploadDuplicates,
  bulkUpdateUploads,
  getDownloadUrl,
  type Upload,
} from '@/lib/hooks/use-uploads';
import { useT } from '@/lib/hooks/use-t';

function formatBytes(bytes: number | undefined | null): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface DupGroup {
  sha: string;
  files: Upload[];
}

export default function UploadDuplicatesPage() {
  const t = useT();
  const { groups, isLoading, mutate } = useUploadDuplicates();
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // groups: Record<sha, Upload[]>. UI-listára konvertáljuk + 2+ tagúakra szűrjük.
  const groupList: DupGroup[] = useMemo(() => {
    if (!groups) return [];
    return Object.entries(groups)
      .map(([sha, files]) => ({ sha, files: files ?? [] }))
      .filter(g => g.files.length >= 2)
      .sort((a, b) => b.files.length - a.files.length);
  }, [groups]);

  const handleArchiveExceptFirst = async (group: DupGroup) => {
    // A csoport első elemét megtartjuk (legrégebbi feltöltés), a többit
    // archiváljuk. A backend bulkUpdate `isArchived:true`-vel megy.
    const sorted = [...group.files].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const toArchive = sorted.slice(1).map(f => f.id);
    if (toArchive.length === 0) return;
    setBusy(group.sha);
    try {
      const { affected } = await bulkUpdateUploads(toArchive, { isArchived: true });
      setToast(t.uploads.bulk.successToast(affected));
      setTimeout(() => setToast(null), 3000);
      await mutate();
    } catch {
      setToast(t.uploads.bulk.errorToast);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async (uploadId: string) => {
    try {
      const url = await getDownloadUrl(uploadId);
      window.open(url, '_blank');
    } catch {
      /* swallow; the download fail is non-critical */
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/uploads" className="text-gray-500 hover:text-brand-600 transition" title={t.uploads.detail.backToList}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <GitMerge className="w-6 h-6 text-brand-500" />
              {t.uploads.duplicates.title}
            </h1>
            <p className="text-gray-500 mt-1">{t.uploads.duplicates.subtitle(groupList.length)}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : groupList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
          <GitMerge className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-lg font-medium text-gray-700">{t.uploads.duplicates.emptyState}</p>
          <p className="text-sm text-gray-500 mt-1">{t.uploads.duplicates.emptyHint}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupList.map(group => {
            const archiveCount = group.files.length - 1;
            return (
              <div key={group.sha} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-xs text-gray-500">{t.uploads.duplicates.sha}</div>
                    <code className="text-xs font-mono text-gray-700 break-all">
                      {group.sha.slice(0, 16)}…{group.sha.slice(-8)}
                    </code>
                  </div>
                  <button
                    type="button"
                    disabled={busy === group.sha || archiveCount === 0}
                    onClick={() => handleArchiveExceptFirst(group)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-sm font-medium hover:bg-amber-200 disabled:opacity-50"
                  >
                    {busy === group.sha
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Archive className="w-3.5 h-3.5" />}
                    {t.uploads.duplicates.archiveAllBtn(archiveCount)}
                  </button>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-white border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t.uploads.colName}</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t.uploads.colSize}</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t.uploads.colUploaded}</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Feltöltő</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {group.files.map((f, idx) => (
                      <tr key={f.id} className={idx === 0 ? 'bg-green-50/40' : ''}>
                        <td className="px-4 py-2">
                          <Link href={`/uploads/${f.id}`} className="text-gray-900 hover:text-brand-600 truncate block max-w-md">
                            {f.originalName ?? f.fileName}
                          </Link>
                          {idx === 0 && (
                            <span className="text-[10px] uppercase tracking-wide text-green-700 font-bold">Eredeti (megtart)</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-500">{formatBytes(f.fileSize)}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{new Date(f.createdAt).toLocaleString('hu-HU')}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{f.uploadedBy ?? '—'}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleDownload(f.id)}
                            className="text-gray-400 hover:text-brand-600"
                            title={t.uploads.duplicates.downloadLink}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
