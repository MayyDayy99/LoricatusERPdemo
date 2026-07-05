'use client';

import { useState, useRef } from 'react';
import { Download, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

// ─── Export Button ─────────────────────────────────────────────────────────────

export function CsvExportButton({
  endpoint, filename, label,
}: {
  endpoint: string; filename: string; label?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await apiClient.get<string>(endpoint, {
        responseType: 'blob',
        headers: { Accept: 'text/csv' },
      });
      const url = URL.createObjectURL(new Blob([res.data as unknown as BlobPart], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-800 transition disabled:opacity-60"
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <Download className="w-3.5 h-3.5" />
      }
      {label ?? 'CSV export'}
    </button>
  );
}

// ─── Import Button ─────────────────────────────────────────────────────────────

interface ImportResult {
  imported: number;
  errors: string[];
}

export function CsvImportButton({
  endpoint, label, onDone,
}: {
  endpoint: string; label?: string; onDone?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiClient.post<ImportResult>(endpoint, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      onDone?.();
    } catch {
      setResult({ imported: 0, errors: ['Import sikertelen — ellenőrizd a fájl formátumát'] });
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-800 transition disabled:opacity-60"
      >
        {loading
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <Upload className="w-3.5 h-3.5" />
        }
        {label ?? 'CSV import'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFile}
      />
      {result && (
        <span className="flex items-center gap-1 text-xs">
          {result.imported > 0
            ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            : <AlertCircle className="w-3.5 h-3.5 text-red-500" />
          }
          {result.imported > 0
            ? `${result.imported} ügyfél importálva`
            : result.errors[0]
          }
        </span>
      )}
    </div>
  );
}
