'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Archive, ArrowLeft, FileText, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ArchivedProject {
  id: string;
  name: string;
  archivedAt?: string;
  completedAt?: string;
}

const fetcher = (url: string) => apiClient.get(url).then(r => r.data);

function fmtDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function ArchivePage() {
  const searchParams = useSearchParams();
  const backHref = searchParams?.get('back') ?? '/meeting';
  const { data, isLoading, mutate } = useSWR<ArchivedProject[]>('/dashboard/projects/archived', fetcher);

  async function reactivate(id: string) {
    if (!confirm('Visszaaktiválod a projektet?')) return;
    await apiClient.patch(`/projects/${id}/transition`, { transition: 'reactivate' });
    mutate();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href={backHref} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="w-3 h-3" /> Vissza
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Archive className="w-6 h-6 text-gray-400" /> Archivált projektek
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          A lezárt projektek eltűnnek a TV nézetről, de itt továbbra is elérhetőek.
          A riport letölthető / nyomtatható formátumban elérhető.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-8">
          <RefreshCw className="w-4 h-4 animate-spin" /> Betöltés…
        </div>
      ) : !data || data.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
          <Archive className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Nincs archivált projekt.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Projekt</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Lezárva</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Archivált</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">—</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(p.completedAt)}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(p.archivedAt)}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Link
                      href={`/meeting/report/${p.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <FileText className="w-3 h-3" /> Riport
                    </Link>
                    <button
                      onClick={() => reactivate(p.id)}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      Visszaaktivál
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
