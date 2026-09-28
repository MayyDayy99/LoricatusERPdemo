'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, Bell, Check, Clock, Loader2, Lock } from 'lucide-react';

import type { HetiJelentes } from '@/lib/hooks/use-weekly-reports';
import { Kartya, napNeve, oraPerc, rovidIdo } from './kozos';

/**
 * ── A HÉT MENETE ────────────────────────────────────────────────────────────
 *
 * Az oldal tetején mindig látszik, hol tart a hét: Gyűjtés → Emlékeztető →
 * Kiküldés → Lezárva, alatta egy mondat arról, mi történik most és mi a
 * teendő. Minden más az oldalon ehhez igazodik.
 *
 * Az idő a SZERVER órájához igazodik (`jelentes.most`): a válaszkori
 * eltérést megjegyezzük, és ahhoz képest lépünk tovább. Hogy írható-e a
 * jelentés, azt továbbra is kizárólag a szerver dönti el (`szerkesztheto`).
 */

type LepesAllapot = 'kesz' | 'most' | 'jon' | 'hiba' | 'lezart';
type Tonus = 'semleges' | 'figyelem' | 'hiba' | 'kesz';

export interface HetFazis {
  lepesek: [LepesAllapot, LepesAllapot, LepesAllapot, LepesAllapot];
  tonus: Tonus;
}

/** Tiszta függvény: a jelentés állapota és a (szerverhez igazított) idő alapján. */
export function hetFazisa(j: HetiJelentes, mostMs: number, beallitva: boolean): HetFazis {
  switch (j.allapot) {
    case 'sent':
      return { lepesek: ['kesz', 'kesz', 'kesz', 'lezart'], tonus: 'kesz' };
    case 'failed':
      return { lepesek: ['kesz', 'kesz', 'hiba', 'jon'], tonus: 'hiba' };
    case 'skipped':
      return { lepesek: ['kesz', 'kesz', 'hiba', 'jon'], tonus: 'figyelem' };
    case 'sending':
      return { lepesek: ['kesz', 'kesz', 'most', 'jon'], tonus: 'semleges' };
    default:
      break;
  }
  if (!j.szerkesztheto) return { lepesek: ['kesz', 'kesz', 'most', 'jon'], tonus: 'semleges' };
  const tonus: Tonus = beallitva ? 'semleges' : 'figyelem';
  return mostMs < Date.parse(j.emlekeztetoIdeje)
    ? { lepesek: ['most', 'jon', 'jon', 'jon'], tonus }
    : { lepesek: ['kesz', 'kesz', 'most', 'jon'], tonus };
}

/** „1 nap 21 óra", „15 óra 50 perc", „12 perc". */
export function hatraVan(ms: number): string {
  const perc = Math.max(1, Math.floor(ms / 60_000));
  const nap = Math.floor(perc / 1440);
  const ora = Math.floor((perc % 1440) / 60);
  if (nap > 0) return ora > 0 ? `${nap} nap ${ora} óra` : `${nap} nap`;
  if (ora > 0) return `${ora} óra ${perc % 60} perc`;
  return `${perc} perc`;
}

/** A szerverhez igazított óra, percenként frissítve. */
function useSzerverOra(szerverMost: string): number {
  const eltolas = useMemo(() => Date.parse(szerverMost) - Date.now(), [szerverMost]);
  const [most, setMost] = useState(() => Date.now() + eltolas);
  useEffect(() => {
    setMost(Date.now() + eltolas);
    const id = setInterval(() => setMost(Date.now() + eltolas), 30_000);
    return () => clearInterval(id);
  }, [eltolas]);
  return most;
}

export function HetMenete({ jelentes: j, beallitva, hianyzik, onIdopontAtlepve }: {
  jelentes: HetiJelentes;
  /** Van tag ÉS címzett — különben a küldéskor nem megy ki semmi. */
  beallitva: boolean;
  /** Mi hiányzik a beállításból (a figyelmeztető mondathoz). */
  hianyzik: string[];
  /** Egy határidő (emlékeztető, küldés) átlépésekor — a hívó frissítse az adatot. */
  onIdopontAtlepve: () => void;
}) {
  const most = useSzerverOra(j.most);
  const fazis = hetFazisa(j, most, beallitva);

  // Ha nyitva hagyott oldalon eljön az emlékeztető vagy a küldés ideje, a
  // szerver állapota (emlékeztető kiment, jelentés lezárult) a következő
  // lekérésnél változik — egyszer kérjük le újra, ne várjunk a fókuszra.
  const atlepve = useRef<string | null>(null);
  useEffect(() => {
    if (j.allapot !== 'draft') return;
    const hatar = most >= Date.parse(j.kuldesIdeje) ? 'kuldes'
      : most >= Date.parse(j.emlekeztetoIdeje) + 6 * 60_000 && !j.emlekeztetoKiment ? 'emlekezteto' : null;
    if (hatar && atlepve.current !== `${j.id}:${hatar}`) {
      atlepve.current = `${j.id}:${hatar}`;
      onIdopontAtlepve();
    }
  }, [most, j.id, j.allapot, j.kuldesIdeje, j.emlekeztetoIdeje, j.emlekeztetoKiment, onIdopontAtlepve]);

  const emlekIdo = new Date(j.emlekeztetoIdeje);
  const kuldIdo = new Date(j.kuldesIdeje);
  const lepesek = [
    { cim: 'Gyűjtés', ido: 'egész héten' },
    { cim: 'Emlékeztető', ido: `${napNeve.format(emlekIdo)} ${oraPerc.format(emlekIdo)}` },
    { cim: 'Kiküldés', ido: `${napNeve.format(kuldIdo)} ${oraPerc.format(kuldIdo)}` },
    { cim: 'Lezárva', ido: 'utána nem módosítható' },
  ];
  const aktivIndex = fazis.lepesek.findIndex((a) => a === 'most' || a === 'hiba' || a === 'lezart');

  return (
    <Kartya>
      {/* Asztali: négy lépés vonallal összekötve */}
      <ol className="hidden sm:grid grid-cols-4 px-5 pt-5 pb-4" aria-label="A hét menete">
        {lepesek.map((l, i) => {
          const a = fazis.lepesek[i];
          return (
            <li key={l.cim} className="relative flex flex-col items-center gap-2 text-center"
              aria-current={i === aktivIndex ? 'step' : undefined}>
              {i < lepesek.length - 1 && (
                <span aria-hidden className={clsx(
                  'absolute top-[13px] left-[calc(50%+22px)] right-[calc(-50%+22px)] h-0.5',
                  a === 'kesz' ? 'bg-green-600' : 'bg-gray-200',
                )} />
              )}
              <LepesJel allapot={a} szam={i + 1} />
              <div>
                <div className={clsx('text-sm', a === 'jon' ? 'font-medium text-gray-500' : a === 'kesz' ? 'font-medium text-gray-900' : 'font-semibold text-gray-900')}>
                  {l.cim}
                </div>
                <div className="text-xs text-gray-500">{l.ido}</div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Mobil: négy sáv és a mostani lépés neve */}
      <div className="sm:hidden px-4 pt-4 pb-3">
        <div className="flex gap-1.5" aria-hidden>
          {fazis.lepesek.map((a, i) => (
            <span key={i} className={clsx('flex-1 h-1.5 rounded-full', {
              'bg-green-600': a === 'kesz' || a === 'lezart',
              'bg-brand-600': a === 'most',
              'bg-red-600': a === 'hiba',
              'bg-gray-200': a === 'jon',
            })} />
          ))}
        </div>
        {aktivIndex >= 0 && (
          <p className="mt-2 text-xs text-gray-500">
            {aktivIndex + 1}. lépés a négyből: <span className="font-semibold text-gray-900">{lepesek[aktivIndex].cim}</span>
          </p>
        )}
      </div>

      <div role="status" className={clsx('flex gap-2.5 items-start px-4 sm:px-5 py-3 border-t text-sm', {
        'bg-gray-50 border-gray-100 text-gray-700': fazis.tonus === 'semleges',
        'bg-amber-50 border-amber-100 text-amber-900': fazis.tonus === 'figyelem',
        'bg-red-50 border-red-100 text-red-800': fazis.tonus === 'hiba',
        'bg-green-50 border-green-100 text-gray-700': fazis.tonus === 'kesz',
      })}>
        <AllapotMondat jelentes={j} most={most} beallitva={beallitva} hianyzik={hianyzik} />
      </div>
    </Kartya>
  );
}

function LepesJel({ allapot, szam }: { allapot: LepesAllapot; szam: number }) {
  const alap = 'relative w-7 h-7 rounded-full flex items-center justify-center shrink-0';
  switch (allapot) {
    case 'kesz':
      return <span className={clsx(alap, 'bg-green-600 text-white')}><Check className="w-4 h-4" /><span className="sr-only">kész</span></span>;
    case 'most':
      return <span className={clsx(alap, 'bg-brand-600 text-white text-sm font-bold ring-4 ring-brand-100')}>{szam}</span>;
    case 'lezart':
      return <span className={clsx(alap, 'bg-green-600 text-white ring-4 ring-green-100')}><Lock className="w-3.5 h-3.5" /></span>;
    case 'hiba':
      return <span className={clsx(alap, 'bg-red-600 text-white ring-4 ring-red-100')}><AlertTriangle className="w-3.5 h-3.5" /></span>;
    default:
      return <span className={clsx(alap, 'bg-white border-2 border-gray-200 text-gray-400 text-xs font-semibold')}>{szam}</span>;
  }
}

function AllapotMondat({ jelentes: j, most, beallitva, hianyzik }: {
  jelentes: HetiJelentes; most: number; beallitva: boolean; hianyzik: string[];
}) {
  const kuldIdo = new Date(j.kuldesIdeje);
  const kuldes = <strong className="font-semibold text-gray-900">{napNeve.format(kuldIdo)} {oraPerc.format(kuldIdo)}-kor</strong>;
  const cimzett = j.cimzett ? <> Címzett: {j.cimzett}.</> : null;
  const hiba = j.utolsoHiba && <span className="block text-xs mt-1 opacity-80">Ok: {j.utolsoHiba}</span>;

  if (j.allapot === 'sent') {
    return (
      <>
        <Lock className="w-4 h-4 mt-0.5 shrink-0 text-green-700" />
        <span>
          Kiküldve: <strong className="font-semibold text-gray-900">{j.elkuldve ? rovidIdo.format(new Date(j.elkuldve)) : rovidIdo.format(kuldIdo)}</strong>
          {j.cimzett && <> — {j.cimzett}</>}. A jelentés lezárult, a Projekt Map akkori állapotát őrzi.
        </span>
      </>
    );
  }
  if (j.allapot === 'failed') {
    return (
      <>
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>A jelentést nem sikerült kiküldeni.{hiba}</span>
      </>
    );
  }
  if (j.allapot === 'skipped') {
    return (
      <>
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Ez a jelentés nem ment ki.
          <span className="block text-xs mt-1 opacity-80">
            {j.utolsoHiba ?? 'A küldés idején nem volt beállítva címzett vagy tag.'}
          </span>
        </span>
      </>
    );
  }
  if (j.allapot === 'sending' || !j.szerkesztheto) {
    return (
      <>
        <Loader2 className="w-4 h-4 mt-0.5 shrink-0 animate-spin text-gray-500" />
        <span>
          Lezárva, a jelentés kiküldése folyamatban.
          {j.utolsoHiba && <span className="block text-xs mt-1 opacity-80">Legutóbbi hiba: {j.utolsoHiba}</span>}
        </span>
      </>
    );
  }

  // Vázlat, még írható
  if (!beallitva) {
    return (
      <>
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
        <span>
          A heti jelentés még nincs beállítva ({hianyzik.join(', ')}) — {napNeve.format(kuldIdo)} {oraPerc.format(kuldIdo)}-kor <strong className="font-semibold">nem megy ki semmi</strong>.
          {!j.jogok.kezel && ' Szólj az ügyvezetőnek vagy egy adminisztrátornak.'}
        </span>
      </>
    );
  }

  const hatra = <span className="ml-auto pl-3 text-xs text-gray-500 whitespace-nowrap hidden sm:inline">még {hatraVan(Date.parse(j.kuldesIdeje) - most)}</span>;
  if (most < Date.parse(j.emlekeztetoIdeje)) {
    return (
      <>
        <Clock className="w-4 h-4 mt-0.5 shrink-0 text-brand-700" />
        <span>Most gyűjtünk. A jelentés {kuldes} megy ki — addig bármit pótolhatsz.{cimzett}</span>
        {hatra}
      </>
    );
  }
  return (
    <>
      <Bell className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
      <span>
        {j.emlekeztetoKiment && <>Az emlékeztető {oraPerc.format(new Date(j.emlekeztetoKiment))}-kor kiment a tagoknak. </>}
        A jelentés {kuldes} megy ki — ami még hiányzik, most pótold.{cimzett}
      </span>
      {hatra}
    </>
  );
}
