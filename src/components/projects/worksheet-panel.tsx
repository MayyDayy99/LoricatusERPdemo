'use client';

import { useRef, useState } from 'react';
import useSWR from 'swr';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import {
  FileText, Upload as UploadIcon, Sparkles, ArrowRight, Loader2, X, Download, Trash2,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  useProjectQuickDocs, uploadProjectQuickDoc, getProjectQuickDocDownloadUrl,
  deleteProjectQuickDoc, type ProjectQuickDoc,
} from '@/lib/hooks/use-project-quick-docs';

/**
 * KÖZÖS munkalap-panel — a projekt „Munkalapok" fülén és a Projekt map
 * projekt-modáljában UGYANEZ fut, csak `compact` módban kisebb.
 *
 * ELŐZMÉNY (2026-09-02): a munkalapnak HÁROM külön megjelenése és KÉT külön
 * feltöltési útja volt, amik nem látták egymást:
 *   1. `work_orders` tábla → /work-orders menüpont (generált)
 *   2. `project_quick_docs` → Projekt map modal (feltöltött)
 *   3. `uploads` category=worksheet → projekt Munkalapok fül  ← ezt én adtam
 *      hozzá anélkül, hogy a 2-est felfedeztem volna. Visszavonva.
 *
 * Mostantól EGY tároló a feltöltött munkalapoknak: `project_quick_docs`
 * (kind='worksheet'). Ez a panel a generált munkalapokat és a feltöltötteket
 * egy listában mutatja, és mindkét felületen ugyanígy néz ki.
 */

const fetcher = (url: string) => apiClient.get(url).then(r => r.data);

/** Elfogadott típusok — a backend allowlist munkalap-releváns részhalmaza. */
const ACCEPT = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',');

const MAX_MB = 25;

type Mode = 'idle' | 'generate' | 'upload';

export function WorksheetPanel({
  projectId,
  onGoToQuote,
  compact = false,
}: {
  projectId: string;
  /** Átvált a projekt árajánlat-felületére (a generálás előfeltétele). */
  onGoToQuote: () => void;
  /** Projekt map modal: szűkebb elrendezés, kisebb betűk. */
  compact?: boolean;
}) {
  const [mode, setMode] = useState<Mode>('idle');

  const [generating, setGenerating] = useState(false);

  const { data: workOrdersRaw, mutate: mutateWorkOrders } = useSWR(
    `/work-orders?projectId=${projectId}&take=100`,
    fetcher,
  );
  const { docs, mutate: mutateDocs } = useProjectQuickDocs(projectId);

  // A projekt árajánlatai — ebből derül ki, hogy a Generálás gomb TUD-e
  // dolgozni, vagy csak elmagyarázza a folyamatot. A panel csak akkor kéri le,
  // amikor a felhasználó tényleg a generálást nézi.
  const { data: quotesRaw } = useSWR(
    mode === 'generate' ? `/quotes?projectId=${projectId}&take=50` : null,
    fetcher,
  );
  const quotes: any[] = Array.isArray(quotesRaw) ? quotesRaw : (quotesRaw?.items ?? quotesRaw?.data ?? []);
  const acceptedQuote = quotes.find(q => String(q.state).toLowerCase() === 'accepted') ?? null;
  const hasAnyQuote = quotes.length > 0;

  async function handleGenerate() {
    if (!acceptedQuote) return;
    setGenerating(true);
    try {
      const res = await apiClient.post(`/work-orders/generate-from-quote/${acceptedQuote.id}`);
      toast.success(`Munkalap létrehozva: ${res.data?.workOrderNumber ?? ''}`.trim());
      await mutateWorkOrders();
      setMode('idle');
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;
      // 409 = már van munkalap ehhez az árajánlathoz → felajánljuk a mégis-generálást
      if (status === 409 && confirm(`${msg}\n\nMégis létrehozol egy újat?`)) {
        try {
          const res = await apiClient.post(
            `/work-orders/generate-from-quote/${acceptedQuote.id}?allowDuplicate=true`,
          );
          toast.success(`Munkalap létrehozva: ${res.data?.workOrderNumber ?? ''}`.trim());
          await mutateWorkOrders();
          setMode('idle');
        } catch (e: any) {
          toast.error(e?.response?.data?.message ?? 'Generálás sikertelen');
        }
      } else if (status !== 409) {
        toast.error(msg ?? 'Generálás sikertelen');
      }
    } finally {
      setGenerating(false);
    }
  }

  const generated: any[] = Array.isArray(workOrdersRaw)
    ? workOrdersRaw
    : (workOrdersRaw?.items ?? []);
  const uploaded = docs.filter(d => d.kind === 'worksheet');
  const isEmpty = generated.length === 0 && uploaded.length === 0;

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {/* Műveletsáv — MINDIG látszik, üres állapotban is. Ennek a hiánya
          okozta az eredeti panaszt: a felhasználó nem talált kiindulópontot. */}
      <div className={clsx('bg-white border border-gray-100 rounded-xl', compact ? 'p-2.5' : 'p-3')}>
        <ExpandPanel open={mode === 'idle'}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setMode('generate')}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg border border-gray-200 font-medium text-gray-700',
                'hover:border-brand-300 hover:bg-gray-50 transition',
                compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
              )}
            >
              <Sparkles className={compact ? 'w-3.5 h-3.5 text-brand-600' : 'w-4 h-4 text-brand-600'} />
              Generálás
            </button>
            <button
              onClick={() => setMode('upload')}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg bg-brand-600 text-white font-medium',
                'hover:bg-brand-700 transition',
                compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
              )}
            >
              <UploadIcon className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
              Feltöltés
            </button>
            {!compact && (
              <span className="text-xs text-gray-400 ml-1">
                Generálás elfogadott árajánlatból, vagy kész munkalap feltöltése.
              </span>
            )}
          </div>
        </ExpandPanel>

        <ExpandPanel open={mode === 'generate'}>
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className={clsx('font-medium text-gray-900', compact ? 'text-xs' : 'text-sm')}>
                Munkalap generálása
              </div>

              {/* Három eset, három üzenet — a gomb sosem néma. */}
              <p className={clsx('text-gray-500 mt-1 leading-relaxed', compact ? 'text-[11px]' : 'text-xs')}>
                {acceptedQuote ? (
                  <>
                    Elfogadott árajánlat: <strong>{acceptedQuote.quoteNumber ?? acceptedQuote.title ?? '—'}</strong>.
                    A munkalap ennek a tételeiből jön létre.
                  </>
                ) : hasAnyQuote ? (
                  <>
                    Van árajánlat a projekten, de <strong>egyik sincs elfogadva</strong>. A munkalap
                    elfogadott árajánlatból generálódik — fogadd el az árajánlatot, majd térj vissza ide.
                  </>
                ) : (
                  <>
                    A munkalap <strong>elfogadott árajánlatból</strong> jön létre, a hozzá tartozó
                    tételekkel. Ehhez a projekthez még nincs árajánlat — előbb készíts egyet.
                  </>
                )}
              </p>

              <div className="flex items-center gap-2 mt-3">
                {acceptedQuote && (
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition disabled:opacity-60"
                  >
                    {generating
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generálás…</>
                      : <><Sparkles className="w-3.5 h-3.5" /> Generálás most</>}
                  </button>
                )}
                <button
                  onClick={onGoToQuote}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition',
                    acceptedQuote
                      ? 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                      : 'bg-brand-600 text-white hover:bg-brand-700',
                  )}
                >
                  {hasAnyQuote ? 'Ugrás az árajánlathoz' : 'Árajánlat készítése'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setMode('idle')}
                  className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-700 transition"
                >
                  Mégse
                </button>
              </div>
            </div>
          </div>
        </ExpandPanel>

        <ExpandPanel open={mode === 'upload'}>
          <WorksheetDropzone
            projectId={projectId}
            compact={compact}
            onDone={() => { void mutateDocs(); setMode('idle'); }}
            onCancel={() => setMode('idle')}
          />
        </ExpandPanel>
      </div>

      {/* Lista — generált és feltöltött EGYÜTT. */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        {isEmpty ? (
          <div className={compact ? 'p-5 text-center' : 'p-8 text-center'}>
            <FileText className={clsx('mx-auto mb-2 text-gray-300', compact ? 'w-7 h-7' : 'w-10 h-10')} />
            <p className={clsx('text-gray-500', compact ? 'text-xs' : 'text-sm')}>
              Még nincs munkalap ehhez a projekthez.
            </p>
            <p className={clsx('text-gray-400 mt-1', compact ? 'text-[11px]' : 'text-xs')}>
              Generálj egyet árajánlatból, vagy tölts fel egy meglévőt.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {generated.map((wo: any) => (
              <a
                key={wo.id}
                href={`/work-orders/${wo.id}`}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition group"
              >
                <Sparkles className="w-4 h-4 text-brand-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className={clsx('font-medium text-gray-900 truncate', compact ? 'text-xs' : 'text-sm')}>
                    {wo.workOrderNumber ?? wo.location ?? wo.id.slice(0, 8)}
                  </div>
                  <div className="text-[11px] text-gray-400 truncate">
                    Generált{wo.state ? ` · ${wo.state}` : ''}
                    {wo.deadline ? ` · ${new Date(wo.deadline).toLocaleDateString('hu-HU')}` : ''}
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-600 transition shrink-0" />
              </a>
            ))}
            {uploaded.map(doc => (
              <UploadedRow
                key={doc.id}
                doc={doc}
                projectId={projectId}
                compact={compact}
                onDeleted={() => void mutateDocs()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Magasság-animációval nyíló panel.
 *
 * `grid-rows: 0fr → 1fr` — a VALÓDI magasságra animál, nem becsült
 * `max-height`-re. (A max-height-es változat első fele láthatatlan
 * tartományban telik, ezért villanásnak tűnik — ezt a hibát a task-pipálásnál
 * már megettük egyszer.)
 */
function ExpandPanel({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={clsx(
        'grid transition-all duration-300 ease-out',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

function UploadedRow({
  doc, projectId, compact, onDeleted,
}: {
  doc: ProjectQuickDoc;
  projectId: string;
  compact: boolean;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try {
      const { url } = await getProjectQuickDocDownloadUrl(projectId, doc.id);
      window.open(url, '_blank', 'noopener');
    } catch {
      toast.error('A fájl nem érhető el');
    } finally {
      setBusy(false);
    }
  }

  async function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Biztosan törlöd? — ${doc.fileName}`)) return;
    setBusy(true);
    try {
      await deleteProjectQuickDoc(projectId, doc.id);
      toast.success('Munkalap törölve');
      onDeleted();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Törlés sikertelen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition group">
      <UploadIcon className="w-4 h-4 text-gray-400 shrink-0" />
      <button onClick={open} disabled={busy} className="flex-1 min-w-0 text-left disabled:opacity-50">
        <div className={clsx('font-medium text-gray-900 truncate', compact ? 'text-xs' : 'text-sm')}>
          {doc.fileName}
        </div>
        <div className="text-[11px] text-gray-400">
          Feltöltött · {Math.round(doc.sizeBytes / 1024)} KB
          {doc.uploadedAt ? ` · ${new Date(doc.uploadedAt).toLocaleDateString('hu-HU')}` : ''}
        </div>
      </button>
      <button
        onClick={open}
        disabled={busy}
        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-white transition shrink-0 disabled:opacity-50"
        aria-label="Letöltés"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={remove}
        disabled={busy}
        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-white transition shrink-0 disabled:opacity-50"
        aria-label="Törlés"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function WorksheetDropzone({
  projectId, compact, onDone, onCancel,
}: {
  projectId: string;
  compact: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    const list = files ? Array.from(files) : [];
    if (!list.length) return;
    setBusy(true);
    let ok = 0;
    try {
      for (const file of list) {
        if (file.size > MAX_MB * 1024 * 1024) {
          toast.error(`${file.name}: ${(file.size / 1024 / 1024).toFixed(1)} MB — maximum ${MAX_MB} MB.`);
          continue;
        }
        setCurrent(file.name);
        try {
          await uploadProjectQuickDoc(projectId, 'worksheet', file);
          ok++;
        } catch (err: any) {
          toast.error(`${file.name}: ${err?.response?.data?.message ?? 'Feltöltés sikertelen'}`);
        }
      }
      if (ok > 0) {
        toast.success(ok === 1 ? 'Munkalap feltöltve' : `${ok} munkalap feltöltve`);
        onDone();
      }
    } finally {
      setBusy(false);
      setCurrent(null);
    }
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); void handleFiles(e.dataTransfer.files); }}
      onClick={() => !busy && inputRef.current?.click()}
      className={clsx(
        'relative rounded-xl border-2 border-dashed text-center cursor-pointer transition-colors duration-200',
        compact ? 'px-3 py-5' : 'px-4 py-8',
        dragging ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50',
        busy && 'pointer-events-none opacity-70',
      )}
    >
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onCancel(); }}
        className="absolute top-2 right-2 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
        aria-label="Feltöltés bezárása"
      >
        <X className="w-4 h-4" />
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={e => { void handleFiles(e.target.files); e.target.value = ''; }}
      />

      {busy ? (
        <>
          <Loader2 className={clsx('mx-auto mb-2 text-brand-600 animate-spin', compact ? 'w-5 h-5' : 'w-7 h-7')} />
          <p className={clsx('text-gray-600', compact ? 'text-xs' : 'text-sm')}>Feltöltés…</p>
          {current && <p className="text-[11px] text-gray-400 mt-0.5 truncate px-4">{current}</p>}
        </>
      ) : (
        <>
          <UploadIcon
            className={clsx(
              'mx-auto mb-2 transition-transform duration-200',
              compact ? 'w-5 h-5' : 'w-7 h-7',
              dragging ? 'text-brand-600 scale-110' : 'text-gray-300',
            )}
          />
          <p className={clsx('text-gray-600', compact ? 'text-xs' : 'text-sm')}>
            Húzd ide a munkalapot, vagy <span className="text-brand-600 font-medium">tallózz</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-1">PDF, DOC, DOCX, XLS, XLSX · max {MAX_MB} MB</p>
        </>
      )}
    </div>
  );
}
