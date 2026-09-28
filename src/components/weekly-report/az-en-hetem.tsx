'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import {
  ArrowRight, Check, CheckCircle2, ChevronDown, Circle, ExternalLink, Eye, Info, Loader2, Snowflake,
} from 'lucide-react';

import { apiClient } from '@/lib/api-client';
import type { CrmTask } from '@/lib/hooks/use-crm';
import type { HetiJelentes, SzemelyTevekenyseg } from '@/lib/hooks/use-weekly-reports';
import { TaskDrawer } from '@/components/my-day/task-drawer';
import { BejegyzesKartya, Szerkeszto } from './bejegyzesek';
import {
  Cimke, datum, FeladatSor, hibaSzoveg, Kartya, napEsIdo, projektNeve, rovidIdo, SzakaszCim, tavolletSzoveg,
} from './kozos';

/**
 * ── AZ ÉN HETEM ─────────────────────────────────────────────────────────────
 *
 * A csapattag teendője három lépésben, sorrendben:
 *   1. átnézi, amit a Projekt Map magától rögzített (nincs dolga vele);
 *   2. lezárja, ami már kész — a feladat itt helyben megnyílik;
 *   3. megírja, amit a feladatok nem mondanak el (nem kötelező).
 * Mellette élőben látja, hogyan kerül mindez a jelentésbe.
 *
 * Lezárt hétnél ugyanez a szerkezet, csak olvasható: nincs lezárás, nincs
 * szerkesztő.
 */
export function AzEnHetem({ jelentes: j, szemely: sz, onValtozas }: {
  jelentes: HetiJelentes;
  szemely: SzemelyTevekenyseg;
  onValtozas: () => void;
}) {
  const nyitott = j.szerkesztheto;
  const sajatBejegyzesek = j.bejegyzesek.filter((b) => b.szerzoId === sz.userId);
  const lejart = sz.nyitva.filter((f) => f.lejart).length;
  const [feladatId, setFeladatId] = useState<string | null>(null);
  const { data: feladat, mutate: feladatFrissit } = useSWR<CrmTask>(
    feladatId ? `/crm-tasks/${feladatId}` : null,
    (url: string) => apiClient.get<CrmTask>(url).then((r) => r.data),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      onError: (err) => {
        toast.error(`A feladat nem nyitható meg innen: ${hibaSzoveg(err)}`);
        setFeladatId(null);
      },
    },
  );
  const betoltottFeladat = feladatId && feladat?.id === feladatId ? feladat : null;
  const szobakbol = j.forras === 'project_map_and_rooms';
  // „Csak a megjegyzések": a jelentésben nincsenek feladatok, így az első két
  // lépésnek sincs értelme — egyetlen dolog van: megírni, mi történt.
  const csakMegjegyzes = j.forras === 'notes_only';

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
      <div className="space-y-4 min-w-0">
        {!csakMegjegyzes && <>
        <LepesKartya
          szam={1}
          jel="kesz"
          cim={nyitott ? 'Nézd át, amit a Projekt Map rögzített' : 'Elvégezve'}
          alcim={nyitott
            ? `Ami a héten ${szobakbol ? 'a Projekt Mapen vagy a szobákban ' : ''}lezárult, magától bekerül — ezzel nincs dolgod.`
            : 'A kiküldéskori állapot szerint.'}
          jelveny={<Cimke tonus="kesz">{sz.elvegezve.length} elvégzett</Cimke>}
          mobilonOsszecsukhato={sz.elvegezve.length > 0}
          lab={nyitott && (
            <>
              <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span>
                Hiányzik valami? Zárd le a <Link href="/meeting" className="text-brand-700 hover:underline">Projekt Mapen</Link> — {napEsIdo(j.kuldesIdeje)}-ig még bekerül.
              </span>
            </>
          )}
        >
          {sz.elvegezve.length === 0 ? (
            <Ures>Ezen a héten még nincs lezárt feladatod.</Ures>
          ) : (
            <ul className="divide-y divide-gray-50">
              {sz.elvegezve.map((f) => (
                <FeladatSor key={f.id} tipus="kesz" cim={f.cim}
                  meta={`${projektNeve(f.projekt, f.projektMap ? null : f.szoba)} · ${datum(f.kesz)}`}
                  cimkek={f.szerep === 'segito' && <Cimke tonus="segito">segítőként</Cimke>} />
              ))}
            </ul>
          )}
        </LepesKartya>

        <LepesKartya
          szam={2}
          jel={sz.nyitva.length === 0 ? 'kesz' : lejart > 0 ? 'figyelem' : 'teendo'}
          cim={nyitott ? 'Zárd le, ami már kész' : 'Nyitva maradt'}
          alcim={nyitott
            ? 'Ami nyitva marad, a jelentésben nyitottként látszik.'
            : 'Ezek a feladatok a kiküldéskor még nyitottak voltak.'}
          jelveny={sz.nyitva.length === 0
            ? <Cimke tonus="kesz">nincs nyitott</Cimke>
            : lejart > 0 ? <Cimke tonus="lejart">{lejart} lejárt</Cimke> : <Cimke tonus="szurke">{sz.nyitva.length} nyitott</Cimke>}
        >
          {sz.nyitva.length === 0 && sz.csuszott.length === 0 ? (
            <Ures>{nyitott ? 'Nincs nyitott feladatod ezen a héten.' : 'Nem maradt nyitott feladat.'}</Ures>
          ) : (
            <>
              <ul className="divide-y divide-gray-50">
                {sz.nyitva.map((f) => (
                  <FeladatSor key={f.id} tipus="nyitott" cim={f.cim}
                    meta={`${f.projekt}${f.hatarido ? ` · határidő: ${datum(f.hatarido)}` : ''}`}
                    cimkek={<>
                      {f.lejart && <Cimke tonus="lejart">lejárt</Cimke>}
                      {f.folyamatban && <Cimke tonus="folyamatban">folyamatban</Cimke>}
                      {f.szerep === 'segito' && <Cimke tonus="segito">segítőként</Cimke>}
                    </>}
                    jobbra={nyitott && (
                      <MegnyitGomb cim={f.cim} betolt={feladatId === f.id && !betoltottFeladat} onClick={() => setFeladatId(f.id)} />
                    )} />
                ))}
              </ul>
              {sz.csuszott.length > 0 && (
                <>
                  <SzakaszCim>Csúszott a héten</SzakaszCim>
                  <ul>
                    {sz.csuszott.map((f) => (
                      <FeladatSor key={f.id} tipus="csuszott" kicsi cim={f.cim}
                        meta={`${f.projekt} · +${String(Math.round(f.napok * 10) / 10).replace('.', ',')} nap`} />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </LepesKartya>
        </>}

        <LepesKartya
          szam={csakMegjegyzes ? 1 : 3}
          jel={sajatBejegyzesek.length > 0 ? 'kesz' : 'teendo'}
          cim={!nyitott ? 'Megjegyzéseid'
            : csakMegjegyzes ? 'Írd meg, mi történt a héten'
              : 'Írd meg, amit a feladatok nem mondanak el'}
          alcim={!nyitott ? 'Ahogy a jelentésbe bekerültek.'
            : csakMegjegyzes ? 'A jelentés ebből áll — a Projekt Map feladatai nem szerepelnek benne.'
              : 'Nem kötelező: gond, változás, fotó a helyszínről.'}
        >
          {sajatBejegyzesek.length > 0 && (
            <div className={clsx('divide-y divide-gray-100', nyitott && j.jogok.ir && 'border-b border-gray-100 mb-3')}>
              {sajatBejegyzesek.map((b) => (
                <BejegyzesKartya key={b.id} bejegyzes={b} szerkesztheto={nyitott} kezelhet={j.jogok.kezel} onValtozas={onValtozas} />
              ))}
            </div>
          )}
          {nyitott && j.jogok.ir && <div className="pt-1 pb-1"><Szerkeszto onKesz={onValtozas} /></div>}
          {nyitott && !j.jogok.ir && (
            <Ures>Megjegyzést nem írhatsz — ehhez nincs jogosultságod. Szólj egy adminisztrátornak.</Ures>
          )}
          {!nyitott && sajatBejegyzesek.length === 0 && <Ures>Ezen a héten nem írtál megjegyzést.</Ures>}
        </LepesKartya>
      </div>

      <IgyKerulBele jelentes={j} szemely={sz} megjegyzesek={sajatBejegyzesek.length} />

      {/* A feladat a „Mai napom" paneljén nyílik meg: ott elindítható, lezárható,
          hozzászólható — az oldal elhagyása nélkül. Lezárás után a jelentés
          újraszámol, és a feladat átkerül az elvégzettek közé. */}
      <TaskDrawer
        task={betoltottFeladat}
        onClose={() => setFeladatId(null)}
        onMutated={async () => {
          await feladatFrissit();
          onValtozas();
        }}
      />
    </div>
  );
}

type LepesJelTipus = 'kesz' | 'figyelem' | 'teendo';

function LepesKartya({ szam, jel, cim, alcim, jelveny, lab, mobilonOsszecsukhato, children }: {
  szam: number;
  jel: LepesJelTipus;
  cim: string;
  alcim: string;
  jelveny?: React.ReactNode;
  lab?: React.ReactNode;
  /** Mobilon alapból csak a fejléc látszik (a kész lépés ne foglalja a képernyőt). */
  mobilonOsszecsukhato?: boolean;
  children: React.ReactNode;
}) {
  const [nyitva, setNyitva] = useState(false);
  const rejtett = mobilonOsszecsukhato && !nyitva;
  return (
    <Kartya>
      <header className={clsx('flex items-center gap-3 px-4 sm:px-5 py-3.5 border-gray-100', rejtett ? 'border-b-0 sm:border-b' : 'border-b')}>
        <span className={clsx('w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold', {
          'bg-green-50 text-green-600': jel === 'kesz',
          'bg-amber-100 text-amber-700': jel === 'figyelem',
          'bg-gray-100 text-gray-600': jel === 'teendo',
        })}>
          {jel === 'kesz' ? <><Check className="w-4 h-4" /><span className="sr-only">{szam}. lépés, kész</span></> : szam}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">{cim}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{alcim}</p>
        </div>
        {jelveny && <span className="hidden sm:inline-flex">{jelveny}</span>}
        {mobilonOsszecsukhato && (
          <button type="button" onClick={() => setNyitva((v) => !v)} aria-expanded={nyitva}
            aria-label={nyitva ? 'Lista összecsukása' : 'Lista kinyitása'}
            className="sm:hidden w-9 h-9 -mr-2 flex items-center justify-center text-gray-400">
            <ChevronDown className={clsx('w-4 h-4 transition-transform', nyitva && 'rotate-180')} />
          </button>
        )}
      </header>
      <div className={clsx('px-4 sm:px-5 py-1.5', rejtett && 'hidden sm:block')}>{children}</div>
      {lab && (
        <div className={clsx('px-4 sm:px-5 py-2.5 border-t border-gray-100 text-xs text-gray-500 flex items-start gap-2', rejtett && 'hidden sm:flex')}>
          {lab}
        </div>
      )}
    </Kartya>
  );
}

function Ures({ children }: { children: React.ReactNode }) {
  return <p className="py-2.5 text-sm text-gray-500">{children}</p>;
}

function MegnyitGomb({ cim, betolt, onClick }: { cim: string; betolt: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={betolt} aria-label={`${cim} megnyitása`}
      className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white
                 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60">
      {betolt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5 text-gray-500" />}
      <span className="hidden sm:inline">Megnyitás</span>
    </button>
  );
}

function IgyKerulBele({ jelentes: j, szemely: sz, megjegyzesek }: {
  jelentes: HetiJelentes; szemely: SzemelyTevekenyseg; megjegyzesek: number;
}) {
  const csakMegjegyzes = j.forras === 'notes_only';
  const sor = (kulcs: string, tipus: 'kesz' | 'nyitott' | 'jovo', cim: React.ReactNode, meta: string) => (
    <li key={kulcs} className="flex gap-2 items-start">
      <span className="mt-px shrink-0" aria-hidden>
        {tipus === 'kesz' && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
        {tipus === 'nyitott' && <Circle className="w-3.5 h-3.5 text-gray-400" />}
        {tipus === 'jovo' && <ArrowRight className="w-3.5 h-3.5 text-brand-700" />}
      </span>
      <div className="min-w-0">
        <div className="text-xs text-gray-800 break-words">{cim}</div>
        <div className="text-[11px] leading-[14px] text-gray-500 break-words">{meta}</div>
      </div>
    </li>
  );
  const szakasz = (cim: string, elemek: React.ReactNode[], max = 6) => elemek.length > 0 && (
    <div className="space-y-2">
      <h3 className="text-[11px] leading-4 font-semibold uppercase tracking-wide text-gray-500">{cim}</h3>
      <ul className="space-y-2">{elemek.slice(0, max)}</ul>
      {elemek.length > max && <p className="text-[11px] text-gray-500">+ még {elemek.length - max}</p>}
    </div>
  );

  return (
    <Kartya className="lg:sticky lg:top-4">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Eye className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">Így kerül a jelentésbe</h2>
      </header>
      <div className="px-4 py-3.5 space-y-3.5">
        <div>
          <div className="text-sm font-semibold text-gray-900">{sz.nev}</div>
          <div className="text-xs text-gray-500">
            {csakMegjegyzes
              ? `${megjegyzesek} megjegyzés`
              : `${sz.elvegezve.length} elvégzett · ${sz.nyitva.length} nyitott · jövő hét: ${sz.jovoHet.length}${megjegyzesek > 0 ? ` · ${megjegyzesek} megjegyzés` : ''}`}
          </div>
          {sz.tavollet.length > 0 && <div className="text-xs text-sky-700 mt-0.5">Távollét: {tavolletSzoveg(sz.tavollet)}</div>}
        </div>
        {szakasz('Elvégezve', sz.elvegezve.map((f) => sor(f.id, 'kesz',
          <>{f.cim}{f.szerep === 'segito' && <span className="text-brand-700"> (segítőként)</span>}</>,
          `${f.projekt} · ${datum(f.kesz)}`)))}
        {szakasz('Nyitva', sz.nyitva.map((f) => sor(f.id, 'nyitott',
          <>{f.cim}{f.lejart && <span className="text-red-700"> (lejárt)</span>}</>,
          `${f.projekt}${f.hatarido ? ` · ${datum(f.hatarido)}` : ''}`)))}
        {szakasz('Jövő hét', sz.jovoHet.map((f) => sor(f.id, 'jovo', f.cim, `${f.projekt} · ${datum(f.kezdes)}`)))}
        {!sz.elvegezve.length && !sz.nyitva.length && !sz.jovoHet.length && (
          <p className="text-xs text-gray-500">
            {csakMegjegyzes ? 'A jelentésbe csak a megjegyzéseid kerülnek.' : 'Még nincs benne feladat.'}
          </p>
        )}
      </div>
      <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-500 flex items-center gap-1.5">
        <Snowflake className="w-3.5 h-3.5 text-gray-400" />
        {j.befagyasztva
          ? <>Befagyasztva{j.elkuldve ? `: ${rovidIdo.format(new Date(j.elkuldve))}` : ''}</>
          : <>Élő — {napEsIdo(j.kuldesIdeje)}-kor befagy.</>}
      </div>
    </Kartya>
  );
}
