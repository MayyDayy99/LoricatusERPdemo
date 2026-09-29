'use client';

import { clsx } from 'clsx';
import { ExternalLink, Trophy, X } from 'lucide-react';

import { FAZIS_FELIRAT, MERET_FELIRAT, SAV_FELIRAT, type Eredmeny, type Fazis, type Sav } from '@/lib/hooks/use-procurement';

/** A Pályázatok oldal közös kis elemei (lista, részletpanel, radar). */

export const SAV_SZIN: Record<Sav, string> = {
  priority: 'bg-green-600 text-white',
  qualified: 'bg-emerald-100 text-emerald-800',
  review: 'bg-amber-100 text-amber-800',
  archive: 'bg-gray-100 text-gray-500',
};

export function PontJelveny({ score, tier }: { score: number | null; tier: Sav | null }) {
  if (score == null || !tier) return <span className="text-xs text-gray-400">—</span>;
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold tabular-nums', SAV_SZIN[tier])}>
      {score}
      <span className="font-medium opacity-80">{SAV_FELIRAT[tier]}</span>
    </span>
  );
}

export function penz(v: number | null, c: string | null) {
  if (!v) return null;
  try {
    return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: c ?? 'EUR', maximumFractionDigits: 0 }).format(v);
  } catch {
    return `${Math.round(v).toLocaleString('hu-HU')} ${c ?? ''}`;
  }
}

export function datum(v: string | null | undefined) {
  return v ? new Date(v).toLocaleDateString('hu-HU') : '';
}

const FAZIS_SZIN: Record<Fazis, string> = {
  open: 'bg-blue-50 text-blue-700',
  closed: 'bg-gray-100 text-gray-600',
  awarded: 'bg-violet-100 text-violet-800',
  unsuccessful: 'bg-red-50 text-red-700',
};

export function FazisJelveny({ fazis }: { fazis: Fazis }) {
  return <span className={clsx('text-[11px] px-2 py-0.5 rounded-full font-medium', FAZIS_SZIN[fazis])}>{FAZIS_FELIRAT[fazis]}</span>;
}

/** Egy eredményhirdetés: nyertes(ek), ár, ajánlatok száma, link. */
export function EredmenyKartya({ e, cimmel }: { e: Eredmeny; cimmel?: boolean }) {
  const ertek = penz(e.value, e.currency);
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-2.5 text-sm">
      {cimmel && e.title && <div className="text-xs text-gray-500 mb-1 line-clamp-2">{e.title}</div>}
      {e.unsuccessful ? (
        <div className="text-red-700 font-medium">
          A győztes nem került kiválasztásra, a verseny lezárult.
          {e.nonAwardReason && <span className="block text-xs font-normal text-red-600">{e.nonAwardReason}</span>}
        </div>
      ) : e.winners.length ? (
        <ul className="space-y-0.5">
          {e.winners.map((w) => (
            <li key={w.name} className="flex items-start gap-1.5">
              <Trophy className={clsx('w-3.5 h-3.5 mt-0.5 shrink-0', w.own ? 'text-green-600' : 'text-amber-500')} />
              <span className={clsx('font-semibold', w.own ? 'text-green-800' : 'text-gray-900')}>{w.name}</span>
              <span className="text-xs text-gray-500 mt-0.5">
                {[w.city, w.country, w.size ? (MERET_FELIRAT[w.size] ?? w.size) : null].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-gray-500">A nyertes neve nem nyilvános.</div>
      )}
      <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {ertek && <span>Érték: <b className="text-gray-900">{ertek}</b></span>}
        {e.valueToEstimate != null && (
          <span title={`Becsült érték: ${penz(e.estimatedValue, e.currency)}`}
            className={clsx('font-medium', e.valueToEstimate < 0.9 ? 'text-emerald-700' : e.valueToEstimate > 1.05 ? 'text-amber-700' : 'text-gray-700')}>
            a becsült {Math.round(e.valueToEstimate * 100)}%-a
          </span>
        )}
        {!ertek && !e.unsuccessful && <span className="text-gray-400">ár nem nyilvános</span>}
        {e.offersCount === 0 ? <span>nem érkezett ajánlat</span> : e.offersCount != null && <span>{e.offersCount} ajánlat</span>}
        {e.lowestOffer != null && e.highestOffer != null && e.lowestOffer !== e.highestOffer && (
          <span>ajánlatok: {penz(e.lowestOffer, e.currency)} – {penz(e.highestOffer, e.currency)}</span>
        )}
        {e.buyer && cimmel && <span className="text-gray-400">{e.buyer}</span>}
        <span className="text-gray-400">{datum(e.contractDate ?? e.decisionDate ?? e.publishedAt)}</span>
        {e.documentUrl && (
          <a href={e.documentUrl} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline inline-flex items-center gap-0.5">
            {e.noticeTypeName} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

/* ── Közös kis elemek ──────────────────────────────────────────────── */

export const INPUT = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

export function Modal({ cim, onBezar, children, szeles }: { cim: string; onBezar: () => void; children: React.ReactNode; szeles?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onBezar}>
      <div className={clsx('bg-white rounded-xl shadow-lg w-full max-h-[90vh] overflow-auto', szeles ? 'max-w-2xl' : 'max-w-md')}
        onClick={(e) => e.stopPropagation()} role="dialog" aria-label={cim}>
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900">{cim}</h2>
            <button type="button" onClick={onBezar} aria-label="Bezárás" className="p-1 rounded hover:bg-gray-100"><X className="w-4 h-4" /></button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Mezo({ cimke, children }: { cimke: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{cimke}</span>
      {children}
    </label>
  );
}

export function ModalGombok({ onMegse, onOk, ok, tiltva }: { onMegse: () => void; onOk: () => void; ok: string; tiltva?: boolean }) {
  return (
    <div className="flex gap-2 pt-2">
      <button type="button" onClick={onMegse} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50">Mégse</button>
      <button type="button" onClick={onOk} disabled={tiltva}
        className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">{ok}</button>
    </div>
  );
}
