'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { CalendarRange, LayoutDashboard, ListChecks, Radar, SlidersHorizontal, Trophy } from 'lucide-react';

import { useTenant } from '@/lib/hooks/use-tenants';
import { Attekintes } from './attekintes';
import { BeszerzesiRadar } from './beszerzesi-radar';
import { Figyeles } from './figyeles';
import { HaviJelentes } from './havi-jelentes';
import { Opportunityk } from './opportunityk';
import { Piac } from './piac';

/**
 * ── PÁLYÁZATOK — PROCUREMENT INTELLIGENCE ──────────────────────────────────
 *
 * Három nézet:
 *   Áttekintés        — „Mi történt tegnap óta?": új lehetőségek sávonként,
 *                       kritikus határidők, váró draftok, képességhiány;
 *   Opportunityk      — a kiírások Loricatus Score szerint, részletpanellel
 *                       (elemzés, döntés, szereplők, kapcsolatfelvétel);
 *   Figyelőprofilok   — mit hozzon le a rendszer (profilok, élő előnézettel) és
 *                       hogyan pontozza (cégenként állítható relevancia);
 *   Piaci kép         — a TED eredményhirdetéseiből: ki nyer, mennyiért, hány
 *                       ajánlattevő mellett; a legtöbbet kiíró ajánlatkérők;
 *   Beszerzési radar  — hol tartunk a beszállítói felületeken (Procurement Source).
 *
 * A `?opportunity=<id>` cím (az MCP-válaszok linkje) közvetlenül a részletpanelt nyitja.
 */

type Nezet = 'attekintes' | 'opportunityk' | 'figyeles' | 'piac' | 'havi' | 'radar';

const FULEK: Array<{ kulcs: Nezet; cimke: string; ikon: React.ReactNode }> = [
  { kulcs: 'attekintes', cimke: 'Áttekintés', ikon: <LayoutDashboard className="w-4 h-4" /> },
  { kulcs: 'opportunityk', cimke: 'Opportunityk', ikon: <ListChecks className="w-4 h-4" /> },
  { kulcs: 'figyeles', cimke: 'Figyelőprofilok', ikon: <SlidersHorizontal className="w-4 h-4" /> },
  { kulcs: 'piac', cimke: 'Piaci kép', ikon: <Trophy className="w-4 h-4" /> },
  { kulcs: 'havi', cimke: 'Havi jelentés', ikon: <CalendarRange className="w-4 h-4" /> },
  { kulcs: 'radar', cimke: 'Beszerzési radar', ikon: <Radar className="w-4 h-4" /> },
];

function cimFrissites(opportunity: string | null) {
  try {
    const url = new URL(window.location.href);
    if (opportunity) url.searchParams.set('opportunity', opportunity);
    else url.searchParams.delete('opportunity');
    window.history.replaceState(null, '', url.toString());
  } catch {
    /* a cím frissítése kényelmi funkció — ha nem megy, nem baj */
  }
}

export default function PalyazatokOldal() {
  const [nezet, setNezet] = useState<Nezet>('attekintes');
  const [nyitott, setNyitott] = useState<string | null>(null);
  const [forrasSzuro, setForrasSzuro] = useState<{ id: string; nev: string } | null>(null);
  const [profilSzuro, setProfilSzuro] = useState<string | null | undefined>(undefined);
  const [kezdoHonap, setKezdoHonap] = useState<string | null>(null);
  const { tenant, isLoading } = useTenant();

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get('opportunity');
    if (id) {
      setNezet('opportunityk');
      setNyitott(id);
    } else if (q.get('tab') === 'havi') {
      // A havi jelentés értesítéséből / leveléből jövő link.
      setNezet('havi');
      setKezdoHonap(q.get('honap'));
    }
  }, []);

  const nyit = (id: string | null) => {
    setNyitott(id);
    cimFrissites(id);
    if (id) setNezet('opportunityk');
  };

  // A menüpont kikapcsolt modulnál el sem jelenik, de a cím beírható kézzel.
  // A Kiírásfigyelő ilyenkor úgyis 403-at kapna; a radar viszont API nélkül is
  // kirajzolódna — ezért itt, egy helyen mondjuk meg, mi a helyzet.
  if (isLoading) return null;
  if (tenant && tenant.featureFlags?.tendersEnabled !== true) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900">Pályázatok</h1>
        <p className="text-gray-500 mt-2">
          A Pályázatok modul ennél a cégnél nincs bekapcsolva.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Pályázatok</h1>
        <p className="text-gray-500 mt-1">
          Mi jött, mennyire illik hozzánk, kikkel érdemes kapcsolatot építeni — és hol vagyunk regisztrálva.
        </p>
      </header>

      <div role="tablist" className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {FULEK.map((f) => (
          <button
            key={f.kulcs}
            type="button"
            role="tab"
            aria-selected={nezet === f.kulcs}
            onClick={() => setNezet(f.kulcs)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
              nezet === f.kulcs ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {f.ikon}
            {f.cimke}
          </button>
        ))}
      </div>

      {nezet === 'attekintes' && <Attekintes onNyit={nyit} onForrasok={() => setNezet('radar')} />}
      {nezet === 'opportunityk' && (
        <Opportunityk nyitott={nyitott} onNyit={nyit} forrasSzuro={forrasSzuro} onForrasSzuroTorles={() => setForrasSzuro(null)}
          kezdoProfil={profilSzuro} onProfilok={() => setNezet('figyeles')} />
      )}
      {nezet === 'figyeles' && <Figyeles onTalalatok={(id) => { setProfilSzuro(id); setNezet('opportunityk'); }} />}
      {nezet === 'piac' && <Piac />}
      {nezet === 'havi' && <HaviJelentes kezdoHonap={kezdoHonap} />}
      {nezet === 'radar' && (
        <BeszerzesiRadar onKiirasok={(f) => { setForrasSzuro(f); setNezet('opportunityk'); }} />
      )}
    </div>
  );
}
