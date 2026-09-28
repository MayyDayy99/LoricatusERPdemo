'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { Camera, Download, ImagePlus, Loader2, Pencil, Trash2, X } from 'lucide-react';

import { apiClient } from '@/lib/api-client';
import {
  bejegyzesModositas,
  bejegyzesTorles,
  kepFeltoltes,
  kepTorles,
  ujBejegyzes,
  useKepLink,
  type HetiBejegyzes,
} from '@/lib/hooks/use-weekly-reports';
import { hibaSzoveg, MAX_KEP_BEJEGYZESENKENT, MAX_SZOVEG, rovidIdo } from './kozos';

/** Új megjegyzés a nyitott heti jelentésbe — szöveg és fotók. */
export function Szerkeszto({ onKesz }: { onKesz: () => void }) {
  const [szoveg, setSzoveg] = useState('');
  const [fajlok, setFajlok] = useState<File[]>([]);
  const [folyamat, setFolyamat] = useState<string | null>(null);
  const valaszto = useRef<HTMLInputElement>(null);

  const elonezetek = useMemo(() => fajlok.map((f) => URL.createObjectURL(f)), [fajlok]);
  useEffect(() => () => elonezetek.forEach((u) => URL.revokeObjectURL(u)), [elonezetek]);

  const hozzaad = (lista: FileList | null) => {
    if (!lista) return;
    const kepek = Array.from(lista).filter((f) => f.type.startsWith('image/'));
    if (kepek.length < lista.length) toast.error('Csak képet lehet csatolni.');
    setFajlok((regi) => {
      const uj = [...regi, ...kepek];
      if (uj.length > MAX_KEP_BEJEGYZESENKENT) {
        toast.error(`Egy megjegyzéshez legfeljebb ${MAX_KEP_BEJEGYZESENKENT} kép tartozhat.`);
        return uj.slice(0, MAX_KEP_BEJEGYZESENKENT);
      }
      return uj;
    });
    if (valaszto.current) valaszto.current.value = '';
  };

  const kuld = async () => {
    const tiszta = szoveg.trim();
    if (!tiszta) {
      toast.error('Írd le, mi történt — üres megjegyzés nem menthető.');
      return;
    }
    setFolyamat('Mentés…');
    try {
      const { id } = await ujBejegyzes(tiszta);
      // A megjegyzés már ELMENTETT. Ha innen egy kép elakad, a szöveg akkor
      // is megmarad — ezért a képek hibáit külön jelezzük, nem dobjuk el az
      // egészet.
      const hibak: string[] = [];
      for (let i = 0; i < fajlok.length; i++) {
        setFolyamat(`Kép feltöltése (${i + 1}/${fajlok.length})…`);
        try {
          await kepFeltoltes(id, fajlok[i]);
        } catch (err) {
          hibak.push(hibaSzoveg(err));
        }
      }
      setSzoveg('');
      setFajlok([]);
      onKesz();
      if (hibak.length) {
        toast.error(`A megjegyzés elmentve, de ${hibak.length} kép nem ment fel: ${hibak[0]}`);
      } else {
        toast.success('Megjegyzés hozzáadva');
      }
    } catch (err) {
      toast.error(hibaSzoveg(err));
      onKesz(); // pl. 409: a jelentés közben lezárult — a felület frissüljön
    } finally {
      setFolyamat(null);
    }
  };

  return (
    <div className="space-y-2.5">
      <label className="block">
        <span className="sr-only">Új megjegyzés</span>
        <textarea
          value={szoveg}
          onChange={(e) => setSzoveg(e.target.value)}
          maxLength={MAX_SZOVEG}
          rows={3}
          disabled={!!folyamat}
          placeholder="Pl. a keleti sávon vízállás van, a gépek csütörtökön visszaértek…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white placeholder:text-gray-400
                     focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y disabled:opacity-60"
        />
      </label>

      {fajlok.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {fajlok.map((f, i) => (
            <li key={`${f.name}-${i}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={elonezetek[i]} alt={f.name} className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
              {!folyamat && (
                <button
                  type="button"
                  onClick={() => setFajlok((l) => l.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 bg-white border border-gray-300 rounded-full p-0.5 shadow"
                  aria-label={`${f.name} eltávolítása`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <input ref={valaszto} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => hozzaad(e.target.files)} />
        <button
          type="button"
          onClick={() => valaszto.current?.click()}
          disabled={!!folyamat || fajlok.length >= MAX_KEP_BEJEGYZESENKENT}
          className="flex items-center justify-center gap-2 px-3 py-2.5 sm:py-2 rounded-lg text-sm font-medium border border-gray-200
                     text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          <Camera className="w-4 h-4 text-gray-500 sm:hidden" />
          <ImagePlus className="w-4 h-4 text-gray-500 hidden sm:block" />
          <span className="sm:hidden">Fotó készítése vagy választása</span>
          <span className="hidden sm:inline">Fotó</span>
        </button>
        <span className="hidden sm:inline text-xs text-gray-400">
          {szoveg.length > MAX_SZOVEG * 0.8 ? `${szoveg.length}/${MAX_SZOVEG}` : 'A fotók helyadata nem kerül tárolásra.'}
        </span>
        <button
          type="button"
          onClick={kuld}
          disabled={!!folyamat || !szoveg.trim()}
          className="sm:ml-auto flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium
                     bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {folyamat ? <><Loader2 className="w-4 h-4 animate-spin" /> {folyamat}</> : 'Hozzáadás'}
        </button>
      </div>
    </div>
  );
}

/** Egy megírt megjegyzés. `nevvel`: a szerző neve is látszik (csapatnézet). */
export function BejegyzesKartya({ bejegyzes: b, szerkesztheto, kezelhet, onValtozas, nevvel }: {
  bejegyzes: HetiBejegyzes;
  szerkesztheto: boolean;
  kezelhet: boolean;
  onValtozas: () => void;
  nevvel?: boolean;
}) {
  const [szerkeszt, setSzerkeszt] = useState(false);
  const [szoveg, setSzoveg] = useState(b.szoveg);
  const [dolgozik, setDolgozik] = useState(false);
  const valaszto = useRef<HTMLInputElement>(null);

  const sajatSzerkeszt = szerkesztheto && b.sajat;
  const torolhet = szerkesztheto && (b.sajat || kezelhet);
  const modositva = new Date(b.modositva).getTime() - new Date(b.letrehozva).getTime() > 60_000;

  const ment = async () => {
    setDolgozik(true);
    try {
      await bejegyzesModositas(b.id, szoveg);
      setSzerkeszt(false);
      onValtozas();
    } catch (err) {
      toast.error(hibaSzoveg(err));
      onValtozas();
    } finally {
      setDolgozik(false);
    }
  };

  const torol = async () => {
    const kerdes = b.sajat
      ? 'Törlöd ezt a megjegyzést a képeivel együtt?'
      : `Törlöd ${b.szerzo} megjegyzését a képeivel együtt?`;
    if (!confirm(kerdes)) return;
    setDolgozik(true);
    try {
      await bejegyzesTorles(b.id);
      onValtozas();
    } catch (err) {
      toast.error(hibaSzoveg(err));
    } finally {
      setDolgozik(false);
    }
  };

  const kepekHozzaadasa = async (lista: FileList | null) => {
    if (!lista?.length) return;
    const kepek = Array.from(lista).slice(0, MAX_KEP_BEJEGYZESENKENT - b.kepek.length);
    setDolgozik(true);
    let hibas = 0;
    for (const f of kepek) {
      try {
        await kepFeltoltes(b.id, f);
      } catch (err) {
        hibas++;
        toast.error(hibaSzoveg(err));
      }
    }
    if (valaszto.current) valaszto.current.value = '';
    setDolgozik(false);
    onValtozas();
    if (!hibas) toast.success(kepek.length === 1 ? 'Kép hozzáadva' : `${kepek.length} kép hozzáadva`);
  };

  return (
    <article className="py-2.5">
      <div className="flex items-center gap-2 min-h-[32px]">
        {nevvel && <span className="font-medium text-xs text-gray-900">{b.szerzo}</span>}
        <span className="text-xs text-gray-500">
          {rovidIdo.format(new Date(b.letrehozva))}
          {modositva && ' · módosítva'}
        </span>
        {(sajatSzerkeszt || torolhet) && !szerkeszt && (
          <div className="ml-auto flex items-center gap-0.5">
            {sajatSzerkeszt && (
              <IkonGomb cimke="Szerkesztés" onClick={() => { setSzoveg(b.szoveg); setSzerkeszt(true); }} disabled={dolgozik}>
                <Pencil className="w-4 h-4" />
              </IkonGomb>
            )}
            {sajatSzerkeszt && b.kepek.length < MAX_KEP_BEJEGYZESENKENT && (
              <IkonGomb cimke="Kép hozzáadása" onClick={() => valaszto.current?.click()} disabled={dolgozik}>
                <ImagePlus className="w-4 h-4" />
              </IkonGomb>
            )}
            {torolhet && (
              <IkonGomb cimke="Törlés" onClick={torol} disabled={dolgozik} veszelyes>
                <Trash2 className="w-4 h-4" />
              </IkonGomb>
            )}
            <input ref={valaszto} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => kepekHozzaadasa(e.target.files)} />
          </div>
        )}
      </div>

      {szerkeszt ? (
        <div className="space-y-2 mt-1">
          <textarea
            value={szoveg}
            onChange={(e) => setSzoveg(e.target.value)}
            maxLength={MAX_SZOVEG}
            rows={4}
            disabled={dolgozik}
            aria-label="Megjegyzés szövege"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setSzerkeszt(false)} disabled={dolgozik}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white">Mégsem</button>
            <button type="button" onClick={ment} disabled={dolgozik || !szoveg.trim() || szoveg === b.szoveg}
              className="px-3 py-1.5 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
              {dolgozik ? 'Mentés…' : 'Mentés'}
            </button>
          </div>
        </div>
      ) : (
        // A szöveg React-szövegként jelenik meg, soha nem HTML-ként: a beírt
        // „<b>" betű szerint látszik, nem formázásként.
        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{b.szoveg}</p>
      )}

      {b.kepek.length > 0 && (
        <ul className="flex flex-wrap gap-2 mt-2">
          {b.kepek.map((k) => (
            <KepBelyeg key={k.id} id={k.id} nev={k.nev} torolheto={sajatSzerkeszt || (szerkesztheto && kezelhet)}
              onTorolve={onValtozas} />
          ))}
        </ul>
      )}
    </article>
  );
}

function KepBelyeg({ id, nev, torolheto, onTorolve }: {
  id: string; nev: string; torolheto: boolean; onTorolve: () => void;
}) {
  const url = useKepLink(id, 'elonezet');
  const [hibas, setHibas] = useState(false);

  // A teljes méret linkje csak kattintásra kell. Az ablakot SZINKRON nyitjuk
  // meg, és utána töltjük be a címet — különben a böngésző a várakozás miatt
  // felugró ablaknak minősítené, és letiltaná.
  //
  // `nezet`: a kép megnyílik a lapon · `letoltes`: a tároló fájlként adja
  // vissza, így a megnyitott lap magától letöltéssé válik.
  const teljesMeret = (mod: 'nezet' | 'letoltes') => async () => {
    const ablak = window.open('', '_blank');
    try {
      const { data } = await apiClient.get<{ url: string }>(`/weekly-reports/images/${id}/url?meret=teljes&mod=${mod}`);
      if (ablak) ablak.location.href = data.url;
    } catch (err) {
      ablak?.close();
      toast.error(hibaSzoveg(err));
    }
  };

  const torol = async () => {
    if (!confirm(`Törlöd a képet (${nev})?`)) return;
    try {
      await kepTorles(id);
      onTorolve();
    } catch (err) {
      toast.error(hibaSzoveg(err));
    }
  };

  return (
    <li className="relative group">
      <button type="button" onClick={teljesMeret('nezet')} title={`${nev} — megnyitás teljes méretben`}
        className="block w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
        {url && !hibas ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={nev} onError={() => setHibas(true)} className="w-full h-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-[11px] text-gray-400 p-2 text-center">
            {hibas ? 'Előnézet nem tölthető be' : 'Betöltés…'}
          </span>
        )}
      </button>
      <button type="button" onClick={teljesMeret('letoltes')} aria-label={`${nev} letöltése`}
        title={`${nev} letöltése`}
        className="absolute -bottom-1.5 -right-1.5 bg-white border border-gray-300 rounded-full p-1 shadow
                   sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition">
        <Download className="w-3 h-3" />
      </button>
      {torolheto && (
        <button type="button" onClick={torol} aria-label={`${nev} törlése`}
          className="absolute -top-1.5 -right-1.5 bg-white border border-gray-300 rounded-full p-0.5 shadow
                     sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition">
          <X className="w-3 h-3" />
        </button>
      )}
    </li>
  );
}

function IkonGomb({ cimke, onClick, disabled, veszelyes, children }: {
  cimke: string; onClick: () => void; disabled?: boolean; veszelyes?: boolean; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={cimke} aria-label={cimke}
      className={clsx(
        'w-9 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40',
        veszelyes && 'hover:text-red-600',
      )}>
      {children}
    </button>
  );
}
