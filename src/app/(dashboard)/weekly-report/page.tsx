'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, ChevronDown, ListChecks, Settings, Users } from 'lucide-react';

import { describeApiError } from '@/lib/error-messages';
import {
  useHetiJelentes,
  useJelentesLista,
  type JelentesAllapot,
  type SzemelyTevekenyseg,
} from '@/lib/hooks/use-weekly-reports';
import { AzEnHetem } from '@/components/weekly-report/az-en-hetem';
import { BeallitasokFul, BeallitasVarazslo } from '@/components/weekly-report/beallitasok';
import { CsapatNezet } from '@/components/weekly-report/csapat';
import { HetMenete } from '@/components/weekly-report/het-menete';
import { Fulek } from '@/components/weekly-report/kozos';

/**
 * ── HETI JELENTÉS ───────────────────────────────────────────────────────────
 *
 * A műveleti csoport közös beszámolója. Egész héten gyűlik a Projekt Map
 * feladataiból és a tagok megjegyzéseiből. A küldés napja és ideje cégenként
 * állítható (alapból péntek 13:50); előtte egy nappal emlékeztető megy, a
 * küldés után a jelentés zárolva.
 *
 * Az oldal végigvezet a folyamaton:
 *   - felül mindig a hét menete (hol tartunk, mi a teendő);
 *   - első alkalommal a vezető egy háromlépéses beállításon megy végig;
 *   - utána fülek: „Az én hetem" (a tag teendői), „Csapat" (ki hol tart),
 *     „Beállítások" (csak a vezetőnek).
 */

type Ful = 'sajat' | 'csapat' | 'beallitasok';

const ALLAPOT_FELIRAT: Record<JelentesAllapot, string> = {
  draft: 'nyitott', sending: 'kiküldés alatt', sent: 'kiküldve', skipped: 'nem ment ki', failed: 'sikertelen',
};

export default function HetiJelentesOldal() {
  const router = useRouter();
  const kereses = useSearchParams();
  const het = kereses.get('het');
  const { jelentes, hiba, betolt, frissit } = useHetiJelentes(het);
  const { lista } = useJelentesLista();
  const [ful, setFul] = useState<Ful | null>(null);
  // A varázsló az ELSŐ betöltéskor dől el, és csak a „Kész" gombra tűnik el —
  // nem akkor, amikor az első tag bekerül (a vezető épp a többit adná hozzá).
  const [varazslo, setVarazslo] = useState<boolean | null>(null);

  const ujratolt = useCallback(() => { void frissit(); }, [frissit]);

  useEffect(() => {
    if (!jelentes || varazslo !== null) return;
    setVarazslo(jelentes.jogok.kezel && jelentes.szerkesztheto
      && (jelentes.tevekenyseg.szemelyek.length === 0 || !jelentes.cimzettBeallitva));
  }, [jelentes, varazslo]);

  const hetValtas = (uj: string) => {
    router.replace(uj ? `?het=${uj}` : '?', { scroll: false });
  };

  if (betolt) {
    return <p className="text-sm text-gray-500">Heti jelentés betöltése…</p>;
  }
  if (hiba || !jelentes) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Heti jelentés</h1>
        <p className="text-sm text-gray-600">{hiba ? describeApiError(hiba).message : 'A jelentés nem érhető el.'}</p>
        {het && (
          <button type="button" onClick={() => hetValtas('')} className="mt-3 text-sm text-brand-700 hover:underline">
            Vissza az aktuális héthez
          </button>
        )}
      </div>
    );
  }

  const j = jelentes;
  const szemelyek = j.tevekenyseg.szemelyek;
  // Lezárt hétnél a befagyasztott névsor számít; nyitott hétnél a tagság.
  const hianyzik = [
    szemelyek.length === 0 && 'nincsenek tagok',
    !j.cimzettBeallitva && 'nincs címzett',
  ].filter((x): x is string => !!x);
  const beallitva = hianyzik.length === 0;

  const sajat: SzemelyTevekenyseg | null = szemelyek.find((sz) => sz.userId === j.nezoId)
    ?? (j.jogok.tag && j.szerkesztheto
      ? { userId: j.nezoId, nev: 'Te', elvegezve: [], nyitva: [], csuszott: [], jovoHet: [], tavollet: [] }
      : null);

  const fulek: Array<{ kulcs: Ful; cimke: string; ikon: React.ReactNode }> = [
    ...(sajat ? [{ kulcs: 'sajat' as const, cimke: 'Az én hetem', ikon: <ListChecks className="w-4 h-4" /> }] : []),
    { kulcs: 'csapat', cimke: 'Csapat', ikon: <Users className="w-4 h-4" /> },
    ...(j.jogok.kezel ? [{ kulcs: 'beallitasok' as const, cimke: 'Beállítások', ikon: <Settings className="w-4 h-4" /> }] : []),
  ];
  const alapFul: Ful = sajat && j.szerkesztheto ? 'sajat' : 'csapat';
  const aktivFul: Ful = ful && fulek.some((f) => f.kulcs === ful) ? ful : alapFul;
  const varazsloLatszik = !!varazslo && j.jogok.kezel && j.szerkesztheto;

  return (
    <div className="max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Heti jelentés</h1>
          <p className="text-gray-500 mt-1">{j.megjeloles}</p>
        </div>
        <label className="relative inline-flex items-center">
          <span className="sr-only">Hét kiválasztása</span>
          <CalendarDays className="absolute left-3 w-4 h-4 text-gray-500 pointer-events-none" />
          <select
            value={het ?? ''}
            onChange={(e) => hetValtas(e.target.value)}
            className="appearance-none rounded-xl border border-gray-200 bg-white pl-9 pr-8 py-2 text-sm font-medium text-gray-600
                       hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 max-w-[16rem] sm:max-w-none"
          >
            <option value="">Aktuális hét</option>
            {lista
              .filter((l) => l.hetKezdete !== j.hetKezdete || het)
              .map((l) => (
                <option key={l.id} value={l.hetKezdete}>
                  {l.megjeloles} · {ALLAPOT_FELIRAT[l.allapot]}
                </option>
              ))}
          </select>
          <ChevronDown className="absolute right-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
        </label>
      </header>

      <HetMenete jelentes={j} beallitva={beallitva} hianyzik={hianyzik} onIdopontAtlepve={ujratolt} />

      {varazsloLatszik ? (
        <BeallitasVarazslo jelentes={j} onValtozas={ujratolt} onKesz={() => { setVarazslo(false); setFul('csapat'); }} />
      ) : (
        <>
          <Fulek lista={fulek} aktiv={aktivFul} onValt={setFul} />
          {aktivFul === 'sajat' && sajat && <AzEnHetem jelentes={j} szemely={sajat} onValtozas={ujratolt} />}
          {aktivFul === 'csapat' && <CsapatNezet jelentes={j} onValtozas={ujratolt} />}
          {aktivFul === 'beallitasok' && <BeallitasokFul jelentes={j} onValtozas={ujratolt} />}
        </>
      )}
    </div>
  );
}
