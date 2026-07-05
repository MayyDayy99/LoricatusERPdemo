'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Search, RefreshCw, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/lib/hooks/use-t';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  ipAddress?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  create:  'bg-green-100 text-green-700',
  created: 'bg-green-100 text-green-700',
  update:  'bg-blue-100 text-blue-700',
  updated: 'bg-blue-100 text-blue-700',
  delete:  'bg-red-100 text-red-600',
  deleted: 'bg-red-100 text-red-600',
  login:   'bg-purple-100 text-purple-700',
  logout:  'bg-gray-100 text-gray-600',
};

function actionColor(action: string): string {
  const key = action.split('.').pop() ?? '';
  return ACTION_COLORS[key] ?? 'bg-gray-100 text-gray-600';
}

function timeStr(iso: string): string {
  return new Date(iso).toLocaleString('hu-HU', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const t = useT();
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({
    resource: '',
    action: '',
    dateFrom: '',
    dateTo: '',
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const buildUrl = () => {
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(page * PAGE_SIZE));
    if (appliedFilters.resource) params.set('resource', appliedFilters.resource);
    if (appliedFilters.action)   params.set('action',   appliedFilters.action);
    if (appliedFilters.dateFrom) params.set('dateFrom', appliedFilters.dateFrom);
    if (appliedFilters.dateTo)   params.set('dateTo',   appliedFilters.dateTo);
    const hasFilters = appliedFilters.resource || appliedFilters.action || appliedFilters.dateFrom || appliedFilters.dateTo;
    return `/audit${hasFilters ? '/filter' : ''}?${params.toString()}`;
  };

  const { data, isLoading, mutate } = useSWR<AuditLogsResponse>(
    buildUrl(),
    url => apiClient.get(url).then(r => r.data),
    { revalidateOnFocus: false },
  );

  const logs: AuditLog[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleApplyFilters = () => {
    setAppliedFilters(filters);
    setPage(0);
  };

  const handleReset = () => {
    const empty = { resource: '', action: '', dateFrom: '', dateTo: '' };
    setFilters(empty);
    setAppliedFilters(empty);
    setPage(0);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-gray-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit napló</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {total > 0 ? `${total} bejegyzés` : 'Nincs bejegyzés'}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => mutate()}
          className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition">
          <RefreshCw className="w-3.5 h-3.5" /> Frissítés
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <input
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="Erőforrás (pl. customer)"
            value={filters.resource}
            onChange={e => setFilters(f => ({ ...f, resource: e.target.value }))}
          />
          <input
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="Művelet (pl. created)"
            value={filters.action}
            onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
          />
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Dátumtól</label>
            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
              value={filters.dateFrom}
              onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Dátumig</label>
            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
              value={filters.dateTo}
              onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={handleApplyFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition">
            <Search className="w-3.5 h-3.5" /> Szűrés
          </button>
          <button type="button" onClick={handleReset}
            className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:border-gray-400 transition">
            Visszaállítás
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">{t.common.loading}</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Nincs naplóbejegyzés a megadott feltételekre</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Időpont</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Művelet</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Erőforrás</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Felhasználó</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">IP</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Metaadat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">
                    {timeStr(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {log.resource && (
                      <span className="font-medium">{log.resource}</span>
                    )}
                    {log.resourceId && (
                      <span className="text-gray-400 ml-1 font-mono text-[10px]">
                        {log.resourceId.slice(0, 8)}…
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                    {log.userId ? log.userId.slice(0, 8) + '…' : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                    {log.ipAddress ?? '—'}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {Object.keys(log.metadata).length > 0 ? (
                      <details className="cursor-pointer">
                        <summary className="text-xs text-gray-400 hover:text-gray-600">
                          {Object.keys(log.metadata).length} mező
                        </summary>
                        <pre className="text-[10px] text-gray-500 mt-1 bg-gray-50 rounded p-2 overflow-auto max-h-32">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} / {total}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="p-1.5 rounded-lg border border-gray-200 hover:border-gray-400 disabled:opacity-40 transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3">{page + 1} / {totalPages}</span>
            <button type="button" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg border border-gray-200 hover:border-gray-400 disabled:opacity-40 transition">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
