'use client';

import { clsx } from 'clsx';
import { ArrowRight, CheckCircle2, Circle, Redo2 } from 'lucide-react';

import { describeApiError } from '@/lib/error-messages';
import { KepHiba } from '@/lib/kep-kicsinyites';
import type { Tavollet } from '@/lib/hooks/use-weekly-reports';

/**
 * A Heti jelentés oldal közös építőkövei. A megjelenés a „Mai napom" kártyáit
 * követi (rounded-2xl, gray-100 keret, shadow-sm), hogy az oldal ne lógjon ki
 * az alkalmazásból.
 *
 * Minden időpont BUDAPESTI idő szerint jelenik meg — akkor is, ha valaki
 * külföldön, más időzónájú gépen nyitja meg. A küldési idő is budapesti.
 */

export const MAX_SZOVEG = 5000;
export const MAX_KEP_BEJEGYZESENKENT = 10;

export const hibaSzoveg = (err: unknown) => (err instanceof KepHiba ? err.message : describeApiError(err).message);

const IDOZONA = 'Europe/Budapest';
const naptar = new Intl.DateTimeFormat('hu-HU', { timeZone: IDOZONA, month: 'short', day: 'numeric' });
/** „szept. 16." */
export const datum = (iso: string) => naptar.format(new Date(iso));
/** `YYYY-MM-DD` délben — időzóna-eltolás ne billentse át a szomszéd napra. */
export const naptariNap = (d: string) => naptar.format(new Date(`${d}T12:00:00Z`));
/** „szept. 16. 14:32" */
export const rovidIdo = new Intl.DateTimeFormat('hu-HU', {
  timeZone: IDOZONA, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});
/** „14:00" */
export const oraPerc = new Intl.DateTimeFormat('hu-HU', { timeZone: IDOZONA, hour: 'numeric', minute: '2-digit' });
/** „csütörtök" */
export const napNeve = new Intl.DateTimeFormat('hu-HU', { timeZone: IDOZONA, weekday: 'long' });

/** „péntek 13:50" — a küldés vagy az emlékeztető ideje. */
export const napEsIdo = (iso: string) => {
  const d = new Date(iso);
  return `${napNeve.format(d)} ${oraPerc.format(d)}`;
};

export const tavolletSzoveg = (lista: Tavollet[]) =>
  lista.map((t) => (t.tol === t.ig ? naptariNap(t.tol) : `${naptariNap(t.tol)} – ${naptariNap(t.ig)}`)).join(', ');

export function Kartya({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={clsx('bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden', className)}>
      {children}
    </section>
  );
}

type CimkeTonus = 'segito' | 'lejart' | 'folyamatban' | 'kesz' | 'szurke';

export function Cimke({ tonus, children }: { tonus: CimkeTonus; children: React.ReactNode }) {
  return (
    <span className={clsx('text-[11px] leading-4 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap', {
      'bg-brand-100 text-brand-800': tonus === 'segito',
      'bg-red-100 text-red-700': tonus === 'lejart',
      'bg-sky-100 text-sky-700': tonus === 'folyamatban',
      'bg-green-50 text-green-700': tonus === 'kesz',
      'bg-gray-100 text-gray-600': tonus === 'szurke',
    })}>
      {children}
    </span>
  );
}

export const projektNeve = (projekt: string, szoba: string | null = null) => (szoba ? `${projekt} (${szoba})` : projekt);

const SOR_IKON = {
  kesz: <CheckCircle2 className="w-4 h-4 text-green-600" />,
  nyitott: <Circle className="w-4 h-4 text-gray-400" />,
  jovo: <ArrowRight className="w-4 h-4 text-brand-700" />,
  csuszott: <Redo2 className="w-4 h-4 text-amber-600" />,
};

/** Egy feladat sora: ikon, cím és címkék, alatta projekt · dátum. */
export function FeladatSor({ tipus, cim, meta, cimkek, jobbra, kicsi }: {
  tipus: keyof typeof SOR_IKON;
  cim: string;
  meta: string;
  cimkek?: React.ReactNode;
  jobbra?: React.ReactNode;
  kicsi?: boolean;
}) {
  return (
    <li className={clsx('flex items-start gap-2.5', kicsi ? 'py-1' : 'py-2')}>
      <span className={clsx('shrink-0', kicsi ? 'mt-px [&>svg]:w-3.5 [&>svg]:h-3.5' : 'mt-0.5')}>{SOR_IKON[tipus]}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className={clsx('break-words text-gray-900', kicsi ? 'text-xs' : 'text-sm')}>{cim}</span>
          {cimkek}
        </div>
        <div className={clsx('text-gray-500 break-words', kicsi ? 'text-[11px] leading-[14px]' : 'text-xs')}>{meta}</div>
      </div>
      {jobbra}
    </li>
  );
}

/** Kis nagybetűs szakaszcím egy listához. */
export function SzakaszCim({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[11px] leading-4 font-semibold uppercase tracking-wide text-gray-500 mt-2 mb-0.5">{children}</h4>;
}

export function Monogram({ nev, kicsi }: { nev: string; kicsi?: boolean }) {
  const betuk = nev.split(/\s+/).filter(Boolean).map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span aria-hidden className={clsx(
      'rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-semibold shrink-0',
      kicsi ? 'w-6 h-6 text-[10px]' : 'w-9 h-9 text-xs',
    )}>
      {betuk || '?'}
    </span>
  );
}

/** Fülsor — a Dokumentumok oldal füleivel azonos. */
export function Fulek<T extends string>({ lista, aktiv, onValt }: {
  lista: Array<{ kulcs: T; cimke: string; ikon: React.ReactNode }>;
  aktiv: T;
  onValt: (kulcs: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-gray-200 overflow-x-auto">
      {lista.map((f) => (
        <button
          key={f.kulcs}
          type="button"
          role="tab"
          aria-selected={aktiv === f.kulcs}
          onClick={() => onValt(f.kulcs)}
          className={clsx(
            'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
            aktiv === f.kulcs ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700',
          )}
        >
          {f.ikon}
          {f.cimke}
        </button>
      ))}
    </div>
  );
}
