'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { MapPin, PenSquare, Eye, RefreshCw, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';

import type { MapMode } from '@/components/map/project-map';
import { useProject, updateProject, type ProjectLocation } from '@/lib/hooks/use-projects';
import { useCanAccess } from '@/lib/hooks/use-access';
import { describeApiError } from '@/lib/error-messages';
import { sokszogTeruletM2, m2Hektarba, hektarSzoveg, type SzelHossz } from '@/lib/geo';

/**
 * ── HELYSZÍN PANEL ──────────────────────────────────────────────────────────
 *
 * A Projekt map projekt-ablakának „Helyszín" fülébe kerül. Nem új képesség:
 * a térkép már tudott pint letenni és területet rajzolni — csak a Térkép
 * oldalon, ahol a napi munka NEM zajlik. Ez a panel odaviszi a funkciót, ahol
 * a projekt amúgy is nyitva van.
 *
 * ── MIÉRT A TELJES PROJEKTET TÖLTI ÚJRA ────────────────────────────────────
 *
 * A Projekt map `DashboardProject` objektuma nem hordozza a `location`-t és a
 * `metadata.polygon`-t (a meeting-áttekintő szűken adja vissza a projekteket).
 * Ahelyett, hogy azt a végpontot szélesítenénk — ami MINDEN projektre
 * ráterhelné az adatot, 3600+ soron —, itt egyetlen projektet kérünk le,
 * akkor, amikor tényleg kell: a fül megnyitásakor.
 *
 * ── MIÉRT KÜLDJÜK VISSZA A TELJES HELYSZÍNT ────────────────────────────────
 *
 * A `PATCH /projects/:id` a `location`-t EGYBEN cseréli, nem mezőnként fésüli
 * össze. Aki csak a várost írja át, annak a koordinátát is vissza kell
 * küldenie — különben a pin csendben eltűnne a térképről.
 */

const ProjectMap = dynamic(
  () => import('@/components/map/project-map').then((m) => m.ProjectMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full rounded-lg bg-gray-100 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
      </div>
    ),
  },
);

/** Üres string helyett `undefined` — így nem mentünk el „üres" mezőket. */
function tisztit(ertek: string): string | undefined {
  const t = ertek.trim();
  return t.length > 0 ? t : undefined;
}

/** A tárolt hivatalos terület (`metadata.teruletHa`) — csak véges, nem negatív szám számít. */
function tarolTerulet(metadata: Record<string, unknown> | undefined): number | null {
  const v = metadata?.teruletHa;
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

/** Hektár a mezőben: magyar tizedesvesszővel, felesleges nullák nélkül. */
function hektarMezobe(ha: number | null): string {
  if (ha === null) return '';
  return String(Math.round(ha * 100) / 100).replace('.', ',');
}

/**
 * A beírt szöveg értelmezése. Vesszőt ÉS pontot is elfogad („12,5" és „12.5"),
 * a szóközöket elhagyja („1 250"). Üres mező = a hivatalos terület törlése.
 *
 * `undefined` = érvénytelen bevitel — a hívó hibaként jelzi, és NEM ment.
 */
function hektarErtelmez(szoveg: string): number | null | undefined {
  const tiszta = szoveg.replace(/\s/g, '').replace(',', '.');
  if (tiszta === '') return null;
  if (!/^\d+(\.\d+)?$/.test(tiszta)) return undefined;
  const n = Number(tiszta);
  // Felső korlát: Magyarország területe ~9,3 millió ha. Ennél nagyobb szám
  // biztosan elütés (pl. négyzetméter hektár helyett).
  return Number.isFinite(n) && n <= 10_000_000 ? n : undefined;
}

export function ProjectLocationPanel({ projectId }: { projectId: string }) {
  const { project, isLoading, mutate } = useProject(projectId);
  const szerkeszthet = useCanAccess('project.location.write');

  const [mod, setMod] = useState<MapMode>('view');
  const [ment, setMent] = useState(false);
  const [urlap, setUrlap] = useState({ address: '', city: '', country: '', teruletHa: '' });

  // A szerverről érkező értékek átvétele — de csak amíg nem gépel a felhasználó
  // (mentés közben ne írjuk felül a saját, még el nem küldött szövegét).
  useEffect(() => {
    if (ment || !project) return;
    setUrlap({
      address: project.location?.address ?? '',
      city: project.location?.city ?? '',
      country: project.location?.country ?? '',
      teruletHa: hektarMezobe(tarolTerulet(project.metadata)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    project?.location?.address, project?.location?.city, project?.location?.country,
    (project?.metadata as Record<string, unknown> | undefined)?.teruletHa,
  ]);

  if (isLoading) {
    return <p className="text-sm text-gray-500 p-4">Helyszín betöltése…</p>;
  }
  if (!project) {
    return <p className="text-sm text-gray-500 p-4">A projekt adatai nem érhetők el.</p>;
  }

  const lat = project.location?.latitude;
  const lng = project.location?.longitude;
  const vanPin = typeof lat === 'number';
  const metadata = project.metadata as Record<string, unknown> | undefined;
  const sokszog = metadata?.polygon as SzelHossz[] | undefined;
  const vanTerulet = Array.isArray(sokszog);

  // A berajzolt sokszögből számolt terület. Mindig friss: a rajzolás mentése
  // után a `mutate()` újratölti a projektet, és ez újraszámolódik.
  const rajzoltHa = vanTerulet ? m2Hektarba(sokszogTeruletM2(sokszog)) : 0;
  const taroltHa = tarolTerulet(metadata);

  const cimValtozott =
    (tisztit(urlap.address) ?? '') !== (project.location?.address ?? '') ||
    (tisztit(urlap.city) ?? '') !== (project.location?.city ?? '') ||
    (tisztit(urlap.country) ?? '') !== (project.location?.country ?? '');
  const beirtHa = hektarErtelmez(urlap.teruletHa);
  const haHibas = beirtHa === undefined;
  const haValtozott = !haHibas && beirtHa !== taroltHa;
  const valtozott = cimValtozott || haValtozott || haHibas;

  async function mentesCim() {
    if (!project) return;
    if (haHibas) {
      toast.error('A terület nem értelmezhető. Hektárban add meg, pl. 12,5');
      return;
    }
    setMent(true);
    try {
      // CSAK azt küldjük, ami változott.
      //
      // A helyszínt a szerver EGYBEN cseréli, ezért ha küldjük, a koordinátát
      // változatlanul vissza kell adni — különben a pin eltűnne. A `metadata`
      // viszont ÖSSZEFÉSÜLŐDIK, tehát ott elég a hektár: a sokszög megmarad.
      const modositas: Parameters<typeof updateProject>[1] = {};
      if (cimValtozott) {
        const uj: ProjectLocation = {
          latitude: project.location?.latitude,
          longitude: project.location?.longitude,
          address: tisztit(urlap.address),
          city: tisztit(urlap.city),
          country: tisztit(urlap.country),
        };
        modositas.location = uj;
      }
      if (haValtozott) {
        // `null` = törlés; a szerver sekély összefésülése ezt is felülírja.
        modositas.metadata = { teruletHa: beirtHa };
      }
      await updateProject(project.id, modositas);
      await mutate();
      toast.success('Helyszín mentve');
    } catch (err) {
      toast.error(describeApiError(err).message);
    } finally {
      setMent(false);
    }
  }

  const mezo = (kulcs: keyof typeof urlap) => ({
    value: urlap[kulcs],
    disabled: !szerkeszthet || ment,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setUrlap((f) => ({ ...f, [kulcs]: e.target.value })),
    className:
      'w-full px-2.5 py-1.5 rounded border border-gray-300 dark:border-gray-600 ' +
      'bg-transparent text-sm disabled:opacity-60',
  });

  const modGomb = (cel: MapMode, Ikon: typeof Eye, cimke: string) => (
    <button
      type="button"
      onClick={() => setMod(cel)}
      className={clsx(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm border transition',
        mod === cel
          ? 'bg-brand-50 border-brand-200 text-brand-700'
          : 'bg-white border-gray-200 hover:bg-gray-50 dark:bg-transparent dark:border-gray-700',
      )}
    >
      <Ikon className="w-3.5 h-3.5" />
      {cimke}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Állapot egy sorban — a kérdés, amire a felhasználó választ keres:
          „meg van-e már jelölve?" */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={clsx(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs',
            vanPin ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
          )}
        >
          <MapPin className="w-3 h-3" />
          {vanPin ? 'Helyszín megjelölve' : 'Nincs helyszín'}
        </span>
        <span
          className={clsx(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs',
            vanTerulet ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
          )}
        >
          <PenSquare className="w-3 h-3" />
          {vanTerulet ? 'Terület berajzolva' : 'Nincs terület'}
        </span>
        {vanPin && (
          <span className="text-xs text-gray-500 font-mono">
            {lat?.toFixed(5)}, {lng?.toFixed(5)}
          </span>
        )}
      </div>

      {szerkeszthet && (
        <div className="flex flex-wrap gap-2">
          {modGomb('view', Eye, 'Megtekintés')}
          {modGomb('set-location', MapPin, vanPin ? 'Helyszín áthelyezése' : 'Helyszín kijelölése')}
          {modGomb('draw-polygon', PenSquare, vanTerulet ? 'Terület újrarajzolása' : 'Terület rajzolása')}
        </div>
      )}

      <div className="h-[320px] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <ProjectMap
          projects={[project]}
          selectedProjectId={project.id}
          mode={szerkeszthet ? mod : 'view'}
          onProjectSelect={() => { /* egyetlen projekt van — nincs mit választani */ }}
          onLocationSaved={() => {
            void mutate();
            // A kijelölés egyszeri aktus: utána visszaállunk nézetre, hogy egy
            // véletlen kattintás ne helyezze át rögtön újra a pint.
            setMod('view');
          }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm sm:col-span-2">
          <span className="block mb-1 text-gray-600 dark:text-gray-400">Cím</span>
          <input maxLength={500} placeholder="pl. Fő utca 12." {...mezo('address')} />
        </label>
        <div className="text-sm">
          <label>
            <span className="block mb-1 text-gray-600 dark:text-gray-400">Terület (ha)</span>
            <input
              inputMode="decimal"
              placeholder={vanTerulet ? hektarMezobe(rajzoltHa) : 'pl. 12,5'}
              {...mezo('teruletHa')}
              className={clsx(mezo('teruletHa').className, haHibas && 'border-red-400 dark:border-red-500')}
            />
          </label>
          {/* A berajzolt érték SOHA nem íródik be magától: a szerződéses vagy
              földhivatali szám gyakran eltér egy kézzel kattintott sokszögtől,
              és a kettő csendes összekeverése az árazásban okozna hibát. */}
          {vanTerulet && (
            <span className="flex flex-wrap items-center gap-x-1.5 mt-1 text-xs text-gray-500">
              Berajzolva: {hektarSzoveg(rajzoltHa)}
              {szerkeszthet && hektarMezobe(rajzoltHa) !== urlap.teruletHa && (
                <button
                  type="button"
                  onClick={() => setUrlap((f) => ({ ...f, teruletHa: hektarMezobe(rajzoltHa) }))}
                  disabled={ment}
                  className="underline underline-offset-2 hover:no-underline text-brand-700"
                >
                  átvétel
                </button>
              )}
            </span>
          )}
          {haHibas && <span className="block mt-1 text-xs text-red-600">Hektárban, pl. 12,5</span>}
        </div>
        <label className="text-sm">
          <span className="block mb-1 text-gray-600 dark:text-gray-400">Település</span>
          <input maxLength={100} {...mezo('city')} />
        </label>
        <label className="text-sm">
          <span className="block mb-1 text-gray-600 dark:text-gray-400">Ország</span>
          <input maxLength={100} placeholder="Magyarország" {...mezo('country')} />
        </label>
        {szerkeszthet && (
          <div className="flex items-end">
            <button
              type="button"
              onClick={mentesCim}
              disabled={!valtozott || ment}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-brand-600
                         text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {ment ? 'Mentés…' : 'Mentés'}
            </button>
          </div>
        )}
      </div>

      {!szerkeszthet && (
        <p className="text-xs text-gray-500">
          A helyszín módosításához projekt-szerkesztési jogosultság szükséges.
        </p>
      )}
    </div>
  );
}
