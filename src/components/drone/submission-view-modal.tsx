'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Download, FileText, Image, XCircle } from 'lucide-react';
import {
  getDroneFormSubmission,
  type DroneFormSubmissionDetail,
} from '@/lib/hooks/use-drone';

/**
 * A drón megrendelői űrlap beküldött adatának read-only nézete. Modal
 * formában nyílik meg — a `/drone` modul és a projekt-detail oldal
 * (Légtér szoba) `DroneFlightPanel`-je is használja.
 */
export function SubmissionViewModal({
  operationId,
  formId,
  onClose,
}: {
  operationId: string;
  formId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<DroneFormSubmissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDroneFormSubmission(operationId, formId)
      .then(setData)
      .catch((e) => setError(e?.response?.data?.message ?? e?.message ?? 'Hiba'))
      .finally(() => setLoading(false));
  }, [operationId, formId]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Megrendelői nyilatkozat — beküldve</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading && <p className="text-sm text-gray-500">Betöltés…</p>}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {data && (
            <>
              <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                <p>
                  <span className="text-gray-500">Megrendelő:</span>{' '}
                  <span className="font-medium text-gray-800">
                    {data.submission.recipientName ?? '—'}
                  </span>
                  {data.submission.recipientEmail && (
                    <span className="text-gray-500"> · {data.submission.recipientEmail}</span>
                  )}
                </p>
                {data.submission.submittedAt && (
                  <p>
                    <span className="text-gray-500">Beküldve:</span>{' '}
                    <span className="text-gray-800">
                      {new Date(data.submission.submittedAt).toLocaleString('hu-HU')}
                    </span>
                  </p>
                )}
                {data.submission.ipAddress && (
                  <p className="text-gray-400">IP: {data.submission.ipAddress}</p>
                )}
              </div>

              <div className="space-y-3">
                {data.fields
                  .filter((f) => f.type !== 'file')
                  .map((f) => {
                    const v = data.submission.submittedData?.[f.key];
                    return (
                      <div key={f.key} className="border-b border-gray-100 pb-2 last:border-b-0">
                        <p className="text-xs text-gray-500 mb-0.5">{f.label}</p>
                        {f.type === 'checkbox' ? (
                          v === true ? (
                            <p className="text-sm text-green-700 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" /> Elfogadva
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400">— nincs elfogadva —</p>
                          )
                        ) : typeof v === 'string' && v.trim().length > 0 ? (
                          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                            {v}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400">—</p>
                        )}
                      </div>
                    );
                  })}
              </div>

              {data.attachments.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-700 mt-2">Mellékletek</p>
                  <ul className="space-y-1">
                    {data.attachments.map((a) => {
                      const Icon = a.mime.startsWith('image/') ? Image : FileText;
                      const sizeKb = (a.sizeBytes / 1024).toFixed(0);
                      return (
                        <li
                          key={a.id}
                          className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-2 py-1.5"
                        >
                          <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-700 truncate">{a.filename}</p>
                            <p className="text-[11px] text-gray-400 truncate">
                              {a.mime} · {sizeKb} kB
                            </p>
                          </div>
                          <a
                            href={a.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Letöltés"
                            className="p-1 text-gray-400 hover:text-brand-600 rounded shrink-0"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Bezárás
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
