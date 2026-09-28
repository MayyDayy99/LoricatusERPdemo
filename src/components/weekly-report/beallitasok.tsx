'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { ArrowRight, Bell, Check, ListChecks, Loader2, Lock, Send, UserPlus, X } from 'lucide-react';

import {
  beallitasMentese,
  tagEltavolitas,
  tagHozzaadas,
  useJelentesBeallitas,
  useJelentesTagok,
  type FeladatForras,
  type HetiJelentes,
} from '@/lib/hooks/use-weekly-reports';
import { datum, hibaSzoveg, Kartya, Monogram, napEsIdo, napNeve, oraPerc } from './kozos';

/**
 * ── BEÁLLÍTÁS ───────────────────────────────────────────────────────────────
 *
 * Három kérdés, ebben a sorrendben: KIKRŐL szól a jelentés, HONNAN jönnek az
 * elvégzett feladatok, KINEK és MIKOR megy. Első alkalommal lépésenként vezetjük végig
 * (varázsló), utána ugyanez a „Beállítások" fülön, egyben szerkeszthető.
 */

// ── Tagok ─────────────────────────────────────────────────────────────────

export function TagokSzerkesztese({ sajatId, onValtozas }: { sajatId: string; onValtozas: () => void }) {
  const { tagok, jeloltek, frissit } = useJelentesTagok(true);
  const [valaszt, setValaszt] = useState(false);
  const [dolgozik, setDolgozik] = useState(false);

  const hozzaad = async (userId: string) => {
    if (!userId) return;
    setDolgozik(true);
    try {
      await tagHozzaadas(userId);
      await frissit();
      onValtozas();
    } catch (err) {
      toast.error(hibaSzoveg(err));
    } finally {
      setDolgozik(false);
      // Vissza a gombra: a következő embert ugyanúgy lehessen hozzáadni.
      setValaszt(false);
    }
  };

  const eltavolit = async (userId: string, nev: string) => {
    if (!confirm(`Kiveszed a jelentésből: ${nev}?

A Projekt Map-tevékenysége többé nem kerül bele, és nem kap emlékeztetőt. A már megírt megjegyzései megmaradnak.`)) return;
    setDolgozik(true);
    try {
      await tagEltavolitas(userId);
      await frissit();
      onValtozas();
    } catch (err) {
      toast.error(hibaSzoveg(err));
    } finally {
      setDolgozik(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tagok.map((t) => (
        <span key={t.userId} title={t.email}
          className="inline-flex items-center gap-2 py-1 pl-1 pr-1.5 rounded-full border border-gray-200 bg-white">
          <Monogram nev={t.nev} kicsi />
          <span className="text-sm text-gray-800">{t.nev}</span>
          <button type="button" onClick={() => eltavolit(t.userId, t.nev)} disabled={dolgozik}
            aria-label={`${t.nev} eltávolítása`}
            className="w-6 h-6 -my-1 flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 hover:bg-gray-100 disabled:opacity-40">
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      ))}
      {/* A vezető jellemzően magát is szeretné felvenni — a hosszú legördülőben
          a saját nevét keresgélni fölösleges lépés. Megjegyzést csak tag írhat. */}
      {!tagok.some((t) => t.userId === sajatId) && (
        <button type="button" onClick={() => { void hozzaad(sajatId); }} disabled={dolgozik}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-sm
                     text-gray-700 shadow-sm hover:border-brand-500 hover:text-brand-800 disabled:opacity-50">
          <UserPlus className="w-3.5 h-3.5" />
          Vegyél fel engem is
        </button>
      )}
      {valaszt ? (
        <select
          autoFocus
          value=""
          disabled={dolgozik}
          aria-label="Hozzáadandó ember"
          onChange={(e) => { void hozzaad(e.target.value); }}
          onBlur={() => setValaszt(false)}
          className="min-w-0 max-w-full border border-gray-300 rounded-full px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">{jeloltek.length ? 'Válassz embert…' : 'Mindenki tag már'}</option>
          {jeloltek.map((j) => <option key={j.userId} value={j.userId}>{j.nev} — {j.email}</option>)}
        </select>
      ) : (
        <button type="button" onClick={() => setValaszt(true)} disabled={dolgozik}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-gray-300 text-sm text-gray-600 hover:border-brand-500 hover:text-brand-700 disabled:opacity-50">
          {dolgozik ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
          Ember hozzáadása
        </button>
      )}
    </div>
  );
}

// ── Forrás ────────────────────────────────────────────────────────────────

export function ForrasValaszto({ onMentve }: { onMentve: () => void }) {
  const { beallitas, frissit } = useJelentesBeallitas(true);
  // OPTIMISTA kijelölés: a rádiógomb azonnal átáll, nem várja a szervert.
  // Enélkül a vezérelt gomb a kattintás után visszaugrik, és csak a válasz
  // után áll át — a felhasználó azt hiszi, nem is kattintott.
  const [helyi, setHelyi] = useState<FeladatForras | null>(null);
  const jelenlegi: FeladatForras = helyi ?? beallitas?.forras ?? 'project_map';

  const valt = async (forras: FeladatForras) => {
    if (forras === jelenlegi) return;
    const elozo = jelenlegi;
    setHelyi(forras);
    try {
      // Csak a forrást küldjük: a mentés RÉSZLEGES, a címzett érintetlen marad.
      await beallitasMentese({ forras });
      await frissit();
      // Mentés után a SZERVER állapota az igazság — egy gyors dupla kattintásnál
      // se maradjon a felületen egy olyan kijelölés, ami nem az elmentett.
      setHelyi(null);
      onMentve();
    } catch (err) {
      setHelyi(elozo); // a mentés nem sikerült — vissza a korábbira
      toast.error(hibaSzoveg(err));
    }
  };

  const opcio = (ertek: FeladatForras, cim: string, leiras: string) => (
    <label className={clsx('flex gap-2.5 items-start rounded-lg border px-3 py-2.5 cursor-pointer transition-colors',
      jelenlegi === ertek ? 'border-brand-300 bg-brand-50' : 'border-gray-200 bg-white hover:bg-gray-50')}>
      <input type="radio" name="forras" checked={jelenlegi === ertek} disabled={!beallitas}
        onChange={() => valt(ertek)} className="mt-1 accent-brand-700" />
      <span>
        <span className="block text-sm font-medium text-gray-900">{cim}</span>
        <span className="block text-xs text-gray-500">{leiras}</span>
      </span>
    </label>
  );

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {opcio('project_map', 'Csak a Projekt Map', 'Ami a Projekt Mapen látszik.')}
        {opcio('project_map_and_rooms', 'Projekt Map és a szobák', 'A szobákban lezárt feladatok is (pl. Iroda).')}
      </div>
      {opcio('notes_only', 'Csak a megjegyzések — feladatok nélkül',
        'A jelentésbe egyáltalán nem kerül feladat, csak amit a tagok beírnak. Akkor jó, ha a munka nincs mindig vezetve a Projekt Mapen.')}
    </div>
  );
}

// ── Címzett ───────────────────────────────────────────────────────────────

export function CimzettUrlap({ onMentve }: { onMentve: () => void }) {
  const { beallitas, frissit } = useJelentesBeallitas(true);
  const [email, setEmail] = useState('');
  const [nev, setNev] = useState('');
  const [ment, setMent] = useState(false);

  // Csak akkor töltjük újra, ha az ELMENTETT címzett változott — egy másik
  // mező (pl. a küldési idő) mentése ne törölje a még be nem mentett gépelést.
  const mentettEmail = beallitas?.cimzettEmail;
  const mentettNev = beallitas?.cimzettNev;
  useEffect(() => {
    if (mentettEmail === undefined) return;
    setEmail(mentettEmail ?? '');
    setNev(mentettNev ?? '');
  }, [mentettEmail, mentettNev]);

  const valtozott = email.trim() !== (beallitas?.cimzettEmail ?? '') || nev.trim() !== (beallitas?.cimzettNev ?? '');

  const mentes = async () => {
    setMent(true);
    try {
      await beallitasMentese({ cimzettEmail: email.trim() || null, cimzettNev: nev.trim() || null });
      await frissit();
      onMentve();
      toast.success(email.trim() ? 'Címzett mentve' : 'Címzett törölve — a jelentés nem fog kimenni');
    } catch (err) {
      toast.error(hibaSzoveg(err));
    } finally {
      setMent(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block mb-1 text-gray-600">Név</span>
          <input value={nev} onChange={(e) => setNev(e.target.value)} maxLength={200} disabled={ment || !beallitas}
            placeholder="Pl. Ágoston"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </label>
        <label className="text-sm">
          <span className="block mb-1 text-gray-600">E-mail-cím</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={320} disabled={ment || !beallitas}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </label>
      </div>
      <button type="button" onClick={mentes} disabled={ment || !valtozott}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
        {ment ? 'Mentés…' : 'Címzett mentése'}
      </button>
    </div>
  );
}

// ── Kiküldés ideje ────────────────────────────────────────────────────────

const NAPOK = ['hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat', 'vasárnap'];
const NAPONKENT = ['hétfőnként', 'keddenként', 'szerdánként', 'csütörtökönként', 'péntekenként', 'szombatonként', 'vasárnaponként'];
const IDO_MINTA = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * A küldés napja és időpontja. Az emlékeztető ebből következik (előtte egy
 * nappal, ugyanakkor) — külön nem állítható, hogy ne lehessen ellentmondó
 * beállítást csinálni. A korlátokat a szerver is ellenőrzi.
 */
export function KuldesIdoUrlap({ onMentve }: { onMentve: () => void }) {
  const { beallitas, frissit } = useJelentesBeallitas(true);
  const [nap, setNap] = useState(5);
  const [ido, setIdo] = useState('13:50');
  const [ment, setMent] = useState(false);

  // Csak akkor töltjük újra, ha az ELMENTETT menetrend változott (lásd a címzett-űrlapot).
  const mentettNap = beallitas?.kuldesNap;
  const mentettIdo = beallitas?.kuldesIdo;
  useEffect(() => {
    if (mentettNap === undefined || mentettIdo === undefined) return;
    setNap(mentettNap);
    setIdo(mentettIdo);
  }, [mentettNap, mentettIdo]);

  const valtozott = !!beallitas && (nap !== beallitas.kuldesNap || ido !== beallitas.kuldesIdo);
  // Az „ÓÓ:PP" alak szövegként is jól rendezhető, ezért elég a karakterlánc-összevetés.
  const idoRendben = IDO_MINTA.test(ido) && ido >= '06:00' && ido <= '20:59';

  const mentes = async () => {
    setMent(true);
    try {
      // Csak a menetrendet küldjük: a mentés RÉSZLEGES, a címzett érintetlen marad.
      const uj = await beallitasMentese({ kuldesNap: nap, kuldesIdo: ido });
      await frissit(uj, { revalidate: false });
      onMentve();
      toast.success(`Mentve: ${NAPONKENT[nap - 1]} ${ido.replace(/^0/, '')}-kor megy ki`);
    } catch (err) {
      toast.error(hibaSzoveg(err));
    } finally {
      setMent(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block mb-1 text-gray-600">Nap</span>
          <select value={nap} onChange={(e) => setNap(Number(e.target.value))} disabled={ment || !beallitas}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
            {NAPOK.map((n, i) => <option key={n} value={i + 1}>{cap(n)}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="block mb-1 text-gray-600">Időpont</span>
          <input type="time" value={ido} min="06:00" max="20:59" step={60} required
            onChange={(e) => setIdo(e.target.value)} disabled={ment || !beallitas}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </label>
        <button type="button" onClick={mentes} disabled={ment || !valtozott || !idoRendben}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
          {ment ? 'Mentés…' : 'Időpont mentése'}
        </button>
      </div>
      {!idoRendben && <p className="text-xs text-red-600">Az időpont 6:00 és 20:59 között lehet.</p>}
      {nap <= 3 && (
        <p className="text-xs text-gray-500">
          Hétfői, keddi vagy szerdai küldésnél a jelentés a következő hét elején megy ki, és az előző hétről szól.
        </p>
      )}
      {valtozott ? (
        <p className="text-xs text-amber-700">
          Ha az új időpont erre a hétre már elmúlt, az e heti jelentés a mentés után néhány percen belül kimegy.
        </p>
      ) : beallitas && (
        <p className="text-xs text-gray-500">
          Következő kiküldés: <strong className="font-semibold text-gray-700">{datum(beallitas.kovetkezoKuldes)}, {napEsIdo(beallitas.kovetkezoKuldes)}</strong>
          {' '}· emlékeztető: {datum(beallitas.kovetkezoEmlekezteto)}, {napEsIdo(beallitas.kovetkezoEmlekezteto)}
        </p>
      )}
    </div>
  );
}

// ── Így működik ───────────────────────────────────────────────────────────

export function IgyMukodik({ jelentes: j }: { jelentes: HetiJelentes }) {
  const emlek = new Date(j.emlekeztetoIdeje);
  const kuld = new Date(j.kuldesIdeje);
  const sor = (ikon: React.ReactNode, tint: string, cim: string, leiras: string) => (
    <li className="flex gap-3 items-start">
      <span className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', tint)}>{ikon}</span>
      <div>
        <div className="text-sm font-semibold text-gray-900">{cim}</div>
        <div className="text-xs text-gray-500 mt-0.5">{leiras}</div>
      </div>
    </li>
  );
  return (
    <Kartya>
      <header className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Így működik</h2>
      </header>
      <ol className="p-4 space-y-4">
        {sor(<ListChecks className="w-4 h-4" />, 'bg-brand-50 text-brand-700', 'A hét során',
          'A tagok lezárják a feladataikat a Projekt Mapen, és megírják, amit a feladatok nem mondanak el.')}
        {sor(<Bell className="w-4 h-4" />, 'bg-amber-50 text-amber-600', `${cap(napNeve.format(emlek))} ${oraPerc.format(emlek)}`,
          'Emlékeztető a tagoknak. A Csapat fülön látod, kinél hiányzik még valami.')}
        {sor(<Send className="w-4 h-4" />, 'bg-sky-50 text-sky-700', `${cap(napNeve.format(kuld))} ${oraPerc.format(kuld)}`,
          'A rendszer elküldi a jelentést e-mailben, emberenként összesítve.')}
        {sor(<Lock className="w-4 h-4" />, 'bg-gray-100 text-gray-600', 'Utána',
          'A jelentés lezárul, és a kiküldés pillanatának állapotát őrzi.')}
      </ol>
    </Kartya>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ── Varázsló (első alkalom) ───────────────────────────────────────────────

type LepesAllapot = 'kesz' | 'most' | 'jon';

export function BeallitasVarazslo({ jelentes: j, onValtozas, onKesz }: {
  jelentes: HetiJelentes;
  onValtozas: () => void;
  /** A „Kész" gomb — utána a megszokott fülek jelennek meg. */
  onKesz: () => void;
}) {
  const { tagok } = useJelentesTagok(true);
  const [forrasJovahagyva, setForrasJovahagyva] = useState(false);

  const tagokKesz = tagok.length > 0;
  const cimzettKesz = j.cimzettBeallitva;
  const forrasKesz = forrasJovahagyva || (tagokKesz && cimzettKesz);
  const allapot = (kesz: boolean, elozoKesz: boolean): LepesAllapot => (kesz ? 'kesz' : elozoKesz ? 'most' : 'jon');
  const lepes1 = allapot(tagokKesz, true);
  const lepes2 = allapot(forrasKesz, tagokKesz);
  const lepes3 = allapot(cimzettKesz, tagokKesz && forrasKesz);
  const keszDb = [tagokKesz, forrasKesz, cimzettKesz].filter(Boolean).length;
  const minden = tagokKesz && cimzettKesz;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
      <Kartya>
        <header className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900 flex-1">A heti jelentés beállítása</h2>
          <span className="text-xs text-gray-500 tabular-nums">{keszDb} / 3 kész</span>
        </header>
        <ol className="pt-5">
          <VarazsloLepes szam={1} allapot={lepes1} cim="Kik szerepelnek a jelentésben?"
            alcim="Csak az ő munkájuk kerül bele, csak ők írhatnak megjegyzést, és csak ők kapnak emlékeztetőt.">
            <TagokSzerkesztese sajatId={j.nezoId} onValtozas={onValtozas} />
          </VarazsloLepes>
          <VarazsloLepes szam={2} allapot={lepes2} cim="Mi kerüljön a jelentésbe?"
            alcim="A feladatok a Projekt Mapről jönnek — vagy maradhatnak ki teljesen, és akkor a jelentés a beírt beszámolókból áll.">
            <ForrasValaszto onMentve={onValtozas} />
            {lepes2 === 'most' && (
              <button type="button" onClick={() => setForrasJovahagyva(true)}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700">
                <ArrowRight className="w-4 h-4" /> Tovább
              </button>
            )}
          </VarazsloLepes>
          <VarazsloLepes szam={3} allapot={lepes3} cim="Kinek és mikor menjen a jelentés?"
            alcim={`Egy címzett kapja meg e-mailben, ${napNeve.format(new Date(j.kuldesIdeje))} ${oraPerc.format(new Date(j.kuldesIdeje))}-kor.`}
            utolso>
            <CimzettUrlap onMentve={onValtozas} />
            <div className="mt-5 pt-4 border-t border-gray-100">
              <KuldesIdoUrlap onMentve={onValtozas} />
            </div>
          </VarazsloLepes>
        </ol>
        <footer className="flex flex-wrap items-center gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <span className="text-xs text-gray-500 flex-1 min-w-[12rem]">
            {minden
              ? 'Minden kész. Később a Beállítások fülön bármikor módosíthatod.'
              : `Még hiányzik: ${[!tagokKesz && 'legalább egy tag', !cimzettKesz && 'a címzett'].filter(Boolean).join(' és ')}.`}
          </span>
          <button type="button" onClick={onKesz} disabled={!minden}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
            <Check className="w-4 h-4" /> Kész
          </button>
        </footer>
      </Kartya>
      <IgyMukodik jelentes={j} />
    </div>
  );
}

function VarazsloLepes({ szam, allapot, cim, alcim, utolso, children }: {
  szam: number;
  allapot: LepesAllapot;
  cim: string;
  alcim: string;
  utolso?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 px-5" aria-current={allapot === 'most' ? 'step' : undefined}>
      <div className="flex flex-col items-center">
        <span className={clsx('w-7 h-7 rounded-full flex items-center justify-center shrink-0', {
          'bg-green-600 text-white': allapot === 'kesz',
          'bg-brand-600 text-white text-sm font-bold ring-4 ring-brand-100': allapot === 'most',
          'bg-white border-2 border-gray-200 text-gray-400 text-xs font-semibold': allapot === 'jon',
        })}>
          {allapot === 'kesz' ? <Check className="w-4 h-4" /> : szam}
        </span>
        {!utolso && <span aria-hidden className={clsx('flex-1 w-0.5 my-1.5', allapot === 'kesz' ? 'bg-green-600' : 'bg-gray-200')} />}
      </div>
      <div className={clsx('flex-1 min-w-0 pt-0.5', utolso ? 'pb-5' : 'pb-6')}>
        <h3 className={clsx('text-sm font-semibold', allapot === 'jon' ? 'text-gray-500' : 'text-gray-900')}>{cim}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{alcim}</p>
        {allapot !== 'jon' && <div className="mt-3">{children}</div>}
      </div>
    </li>
  );
}

// ── Beállítások fül ───────────────────────────────────────────────────────

export function BeallitasokFul({ jelentes: j, onValtozas }: { jelentes: HetiJelentes; onValtozas: () => void }) {
  const blokk = (cim: string, leiras: string, tartalom: React.ReactNode) => (
    <Kartya>
      <header className="px-5 py-3.5 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">{cim}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{leiras}</p>
      </header>
      <div className="px-5 py-4">{tartalom}</div>
    </Kartya>
  );
  const kuld = new Date(j.kuldesIdeje);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
      <div className="space-y-4 min-w-0">
        {blokk('Tagok',
          'A jelentés csak az ő tevékenységüket mutatja. Csak ők írhatnak bele megjegyzést, és csak ők kapnak emlékeztetőt.',
          <TagokSzerkesztese sajatId={j.nezoId} onValtozas={onValtozas} />)}
        {blokk('Mi kerüljön a jelentésbe',
          'A nyitott és a jövő heti feladatok mindig csak a Projekt Mapről jönnek — a szobákban sok régi, importált nyitott feladat van. Ha a feladatok inkább félrevezetnek, válaszd a „Csak a megjegyzések" lehetőséget.',
          <ForrasValaszto onMentve={onValtozas} />)}
        {blokk('Címzett',
          `${cap(napNeve.format(kuld))} ${oraPerc.format(kuld)}-kor ide megy a jelentés.`,
          <CimzettUrlap onMentve={onValtozas} />)}
        {blokk('Kiküldés ideje',
          'Az emlékeztető a küldés előtti napon, ugyanebben az időpontban megy a tagoknak. Budapesti idő szerint.',
          <KuldesIdoUrlap onMentve={onValtozas} />)}
        <p className="text-xs text-gray-500 px-1">Ezt a fület csak az ügyvezető és az adminisztrátor látja.</p>
      </div>
      <IgyMukodik jelentes={j} />
    </div>
  );
}
