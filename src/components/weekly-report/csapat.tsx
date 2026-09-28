'use client';

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import {
  AlertTriangle, Check, CheckCircle2, ChevronDown, CircleDot, Clock, ClipboardCopy, Download, Eye, Loader2, Mail, MailCheck,
  Pencil, Printer, Send, Snowflake, UserPlus, X,
} from 'lucide-react';

import {
  jelentesElonezet,
  jelentesKezzelElkuldve,
  jelentesKuldeseMost,
  jelentesLevelFajl,
  tagHozzaadas,
  type HetiBejegyzes,
  type HetiJelentes,
  type JelentesElonezet,
  type SzemelyTevekenyseg,
} from '@/lib/hooks/use-weekly-reports';
import { BejegyzesKartya } from './bejegyzesek';
import {
  Cimke, datum, FeladatSor, hibaSzoveg, Kartya, Monogram, projektNeve, rovidIdo, SzakaszCim, tavolletSzoveg,
} from './kozos';

/**
 * ── CSAPAT ──────────────────────────────────────────────────────────────────
 *
 * Egy pillantásra: hány feladat készült el, mi maradt nyitva, és KINÉL
 * hiányzik még valami a kiküldés előtt. Emberenként lenyitható sor, benne
 * ugyanaz, ami a levélbe kerül.
 */
export function CsapatNezet({ jelentes: j, onValtozas }: { jelentes: HetiJelentes; onValtozas: () => void }) {
  const szemelyek = j.tevekenyseg.szemelyek;
  const [nyitva, setNyitva] = useState<Set<string>>(() => new Set(szemelyek.length === 1 ? [szemelyek[0].userId] : []));
  const [elonezet, setElonezet] = useState(false);

  const osszes = (f: (sz: SzemelyTevekenyseg) => number) => szemelyek.reduce((n, sz) => n + f(sz), 0);
  // „Csak a megjegyzések": nincsenek feladatok, a feladat-számlálóknak sincs mit mutatniuk.
  const csakMegjegyzes = j.forras === 'notes_only';
  const irtak = szemelyek.filter((sz) => j.bejegyzesek.some((b) => b.szerzoId === sz.userId)).length;
  const tagIdk = new Set(szemelyek.map((sz) => sz.userId));
  const kimaradt = j.bejegyzesek.filter((b) => !tagIdk.has(b.szerzoId));

  const valt = (id: string) => setNyitva((regi) => {
    const uj = new Set(regi);
    if (uj.has(id)) uj.delete(id); else uj.add(id);
    return uj;
  });

  return (
    <div className="space-y-4">
      {j.szerkesztheto && !j.jogok.tag && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <span className="min-w-[14rem] flex-1">
            A jelentés a hozzáadott emberekről szól — te nem vagy közöttük, ezért megjegyzést sem írhatsz bele.
          </span>
          {/* Egy kattintás: a vezető magát is felveheti, különben a Beállítások
              fülön kellene megkeresnie a saját nevét a hozzáadható emberek közt. */}
          {j.jogok.kezel && <MagamHozzaadasa userId={j.nezoId} onKesz={onValtozas} />}
        </div>
      )}

      {szemelyek.length > 0 && (
        <div className={clsx('grid gap-3', csakMegjegyzes ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4')}>
          {!csakMegjegyzes && <>
            <Szamlalo ikon={<CheckCircle2 className="w-5 h-5 text-green-600" />} tint="bg-green-50"
              ertek={osszes((sz) => sz.elvegezve.length)} felirat="Elvégzett feladat" />
            <Szamlalo ikon={<CircleDot className="w-5 h-5 text-amber-600" />} tint="bg-amber-50"
              ertek={osszes((sz) => sz.nyitva.length)} felirat="Nyitva maradt" />
            <Szamlalo ikon={<AlertTriangle className="w-5 h-5 text-red-600" />} tint="bg-red-50"
              ertek={osszes((sz) => sz.nyitva.filter((f) => f.lejart).length)} felirat="Ebből lejárt" />
          </>}
          {csakMegjegyzes && (
            <Szamlalo ikon={<Pencil className="w-5 h-5 text-gray-600" />} tint="bg-gray-100"
              ertek={j.bejegyzesek.length} felirat="Beszámoló" />
          )}
          <Szamlalo ikon={<Pencil className="w-5 h-5 text-brand-700" />} tint="bg-brand-50"
            ertek={`${irtak} / ${szemelyek.length}`} felirat="Írt megjegyzést" />
        </div>
      )}

      <Kartya>
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Tagok</h2>
          <span className="text-xs text-gray-400 tabular-nums">{szemelyek.length}</span>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {j.befagyasztva && (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                <Snowflake className="w-3.5 h-3.5 text-gray-400" />
                Befagyasztva{j.elkuldve ? `: ${rovidIdo.format(new Date(j.elkuldve))}` : ''}
              </span>
            )}
            {j.jogok.kezel && (
              <button type="button" onClick={() => setElonezet(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                <Eye className="w-4 h-4 text-gray-500" />
                {j.cimzett ? `Előnézet: így kapja ${j.cimzett}` : 'Előnézet'}
              </button>
            )}
            {j.jogok.kezel && (
              <button type="button" onClick={() => setElonezet(true)} title="Letöltés levélként, másolás, nyomtatás — ha a rendszer nem tud levelet küldeni"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                <Download className="w-4 h-4 text-gray-500" />
                Mentés / kézi küldés
              </button>
            )}
            {/* Pótlás: egy kimaradt hét másképp nem küldhető el. Csak lezárt,
                még ki nem ment jelentésnél van értelme — ezért csak akkor látszik. */}
            {j.jogok.kezel && j.allapot !== 'sent' && Date.parse(j.kuldesIdeje) <= Date.now() && (
              <KuldesMost hetKezdete={j.hetKezdete} cimzett={j.cimzett} onKuldve={onValtozas} />
            )}
          </div>
        </header>

        {szemelyek.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 text-center">
            A jelentésnek még nincsenek tagjai.
            {j.jogok.kezel ? ' A Beállítások fülön adhatod hozzá őket.' : ' Az ügyvezető vagy egy adminisztrátor adhatja hozzá őket.'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {szemelyek.map((sz) => (
              <SzemelySor key={sz.userId} szemely={sz} jelentes={j} nyitva={nyitva.has(sz.userId)} csakMegjegyzes={csakMegjegyzes}
                onValt={() => valt(sz.userId)} onValtozas={onValtozas}
                bejegyzesek={j.bejegyzesek.filter((b) => b.szerzoId === sz.userId)} />
            ))}
          </ul>
        )}
      </Kartya>

      {/* Aki a hét közben írt, de azóta kikerült a tagok közül: a megjegyzése
          nem tűnhet el csendben (a kiküldött levélben is benne marad). */}
      {kimaradt.length > 0 && (
        <Kartya>
          <header className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Már nem tag emberek megjegyzései</h2>
            <p className="text-xs text-gray-500 mt-0.5">A levélben ezek is benne vannak.</p>
          </header>
          <div className="px-5 py-1 divide-y divide-gray-100">
            {kimaradt.map((b) => (
              <BejegyzesKartya key={b.id} bejegyzes={b} nevvel szerkesztheto={j.szerkesztheto}
                kezelhet={j.jogok.kezel} onValtozas={onValtozas} />
            ))}
          </div>
        </Kartya>
      )}

      {elonezet && (
        <ElonezetAblak hetKezdete={j.hetKezdete} onBezar={() => setElonezet(false)}
          elkuldve={j.allapot === 'sent'} onValtozas={onValtozas} />
      )}
    </div>
  );
}

/** „Vegyél fel engem is" — a vezető a saját nevét egy kattintással teszi be. */
/**
 * „Küldés most" — egy kimaradt hét pótlása.
 *
 * KÉT KOPPINTÁS, nem natív `confirm()`: a levél kimegy a vezetőnek, ezt nem
 * szabad egyetlen véletlen kattintással kiváltani. A második koppintásig a gomb
 * megmondja, mi fog történni és kinek.
 */
function KuldesMost({ hetKezdete, cimzett, onKuldve }: {
  hetKezdete: string;
  cimzett: string | null;
  onKuldve: () => void;
}) {
  const [megerosit, setMegerosit] = useState(false);
  const [dolgozik, setDolgozik] = useState(false);

  // A megerősítő állapot ne ragadjon be: ha nem kattint rá, 6 mp múlva visszaáll.
  useEffect(() => {
    if (!megerosit) return;
    const id = setTimeout(() => setMegerosit(false), 6000);
    return () => clearTimeout(id);
  }, [megerosit]);

  const kuld = async () => {
    if (!megerosit) { setMegerosit(true); return; }
    setDolgozik(true);
    try {
      const v = await jelentesKuldeseMost(hetKezdete);
      if (v.allapot === 'elkuldve') toast.success(v.uzenet);
      else toast.error(v.uzenet);
      onKuldve();
    } catch (err) {
      toast.error(hibaSzoveg(err));
    } finally {
      setDolgozik(false);
      setMegerosit(false);
    }
  };

  return (
    <button type="button" onClick={kuld} disabled={dolgozik}
      className={clsx(
        'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-60',
        megerosit
          ? 'bg-brand-600 text-white hover:bg-brand-700'
          : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
      )}>
      {dolgozik ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      {dolgozik ? 'Küldés…'
        : megerosit ? `Biztosan? Kimegy${cimzett ? ` ${cimzett} címére` : ''}`
        : 'Küldés most'}
    </button>
  );
}

function MagamHozzaadasa({ userId, onKesz }: { userId: string; onKesz: () => void }) {
  const [dolgozik, setDolgozik] = useState(false);
  const hozzaad = async () => {
    setDolgozik(true);
    try {
      await tagHozzaadas(userId);
      onKesz();
      toast.success('Felvettünk a jelentésbe — mostantól te is írhatsz bele.');
    } catch (err) {
      toast.error(hibaSzoveg(err));
    } finally {
      setDolgozik(false);
    }
  };
  return (
    <button type="button" onClick={hozzaad} disabled={dolgozik}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium
                 text-gray-700 shadow-sm hover:border-brand-500 hover:bg-brand-50 hover:text-brand-800 disabled:opacity-50">
      {dolgozik ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
      Vegyél fel engem is
    </button>
  );
}

function Szamlalo({ ikon, tint, ertek, felirat }: { ikon: React.ReactNode; tint: string; ertek: React.ReactNode; felirat: string }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
      <span className={clsx('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', tint)}>{ikon}</span>
      <div className="min-w-0">
        <div className="text-xl font-bold text-gray-900 tabular-nums leading-none">{ertek}</div>
        <div className="text-xs text-gray-500 mt-1">{felirat}</div>
      </div>
    </div>
  );
}

function SzemelySor({ szemely: sz, jelentes: j, bejegyzesek, nyitva, csakMegjegyzes, onValt, onValtozas }: {
  szemely: SzemelyTevekenyseg;
  jelentes: HetiJelentes;
  bejegyzesek: HetiBejegyzes[];
  nyitva: boolean;
  csakMegjegyzes: boolean;
  onValt: () => void;
  onValtozas: () => void;
}) {
  const lejart = sz.nyitva.filter((f) => f.lejart).length;
  const ures = csakMegjegyzes
    ? !bejegyzesek.length && !sz.tavollet.length
    : !sz.elvegezve.length && !sz.nyitva.length && !sz.csuszott.length && !sz.jovoHet.length && !bejegyzesek.length;
  const reszletId = `szemely-${sz.userId}-reszlet`;

  // Állapotjelzés csak amíg van mit pótolni — egy lezárt hétnél már nincs teendő.
  const statusz = !j.szerkesztheto ? null
    : bejegyzesek.length > 0 ? 'megirva'
      : csakMegjegyzes ? 'hianyzik'
        : sz.elvegezve.length === 0 ? 'ures' : 'hianyzik';

  return (
    <li id={`szemely-${sz.userId}`} className="scroll-mt-20">
      <button type="button" onClick={onValt} aria-expanded={nyitva} aria-controls={reszletId}
        className={clsx('w-full flex items-center gap-3 px-4 sm:px-5 py-3 text-left hover:bg-gray-50', nyitva && 'bg-gray-50')}>
        <Monogram nev={sz.nev} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900">{sz.nev}</div>
          <div className="text-xs text-gray-500">
            {csakMegjegyzes
              ? `${bejegyzesek.length} megjegyzés`
              : `${sz.elvegezve.length} elvégzett · ${sz.nyitva.length} nyitott${lejart > 0 ? `, ebből ${lejart} lejárt` : ''}`}
            {sz.tavollet.length > 0 && ` · távol: ${tavolletSzoveg(sz.tavollet)}`}
          </div>
        </div>
        {statusz && <StatuszCimke tipus={statusz} />}
        <ChevronDown className={clsx('w-4 h-4 text-gray-400 shrink-0 transition-transform', nyitva ? 'rotate-0' : '-rotate-90')} />
      </button>

      {nyitva && (
        <div id={reszletId} className="bg-gray-50 px-4 sm:px-5 md:pl-[68px] pb-4">
          {ures ? (
            <p className="pt-1 text-sm text-gray-500">
              {csakMegjegyzes ? 'Ezen a héten nem írt beszámolót.' : 'Ezen a héten nem volt rögzített tevékenység.'}
            </p>
          ) : (
            <div className={clsx('grid gap-x-6', !csakMegjegyzes && 'md:grid-cols-2')}>
              <div>
                {sz.elvegezve.length > 0 && (
                  <>
                    <SzakaszCim>Elvégezve</SzakaszCim>
                    <ul>{sz.elvegezve.map((f) => (
                      <FeladatSor key={f.id} kicsi tipus="kesz" cim={f.cim}
                        meta={`${projektNeve(f.projekt, f.projektMap ? null : f.szoba)} · ${datum(f.kesz)}`}
                        cimkek={f.szerep === 'segito' && <Cimke tonus="segito">segítőként</Cimke>} />
                    ))}</ul>
                  </>
                )}
                {sz.jovoHet.length > 0 && (
                  <>
                    <SzakaszCim>Jövő hét</SzakaszCim>
                    <ul>{sz.jovoHet.map((f) => (
                      <FeladatSor key={f.id} kicsi tipus="jovo" cim={f.cim} meta={`${f.projekt} · ${datum(f.kezdes)}`}
                        cimkek={f.szerep === 'segito' && <Cimke tonus="segito">segítőként</Cimke>} />
                    ))}</ul>
                  </>
                )}
              </div>
              <div>
                {sz.nyitva.length > 0 && (
                  <>
                    <SzakaszCim>Nyitva</SzakaszCim>
                    <ul>{sz.nyitva.map((f) => (
                      <FeladatSor key={f.id} kicsi tipus="nyitott" cim={f.cim}
                        meta={`${f.projekt}${f.hatarido ? ` · határidő: ${datum(f.hatarido)}` : ''}`}
                        cimkek={<>
                          {f.lejart && <Cimke tonus="lejart">lejárt</Cimke>}
                          {f.folyamatban && <Cimke tonus="folyamatban">folyamatban</Cimke>}
                          {f.szerep === 'segito' && <Cimke tonus="segito">segítőként</Cimke>}
                        </>} />
                    ))}</ul>
                  </>
                )}
                {sz.csuszott.length > 0 && (
                  <>
                    <SzakaszCim>Csúszott a héten</SzakaszCim>
                    <ul>{sz.csuszott.map((f) => (
                      <FeladatSor key={f.id} kicsi tipus="csuszott" cim={f.cim}
                        meta={`${f.projekt} · +${String(Math.round(f.napok * 10) / 10).replace('.', ',')} nap`} />
                    ))}</ul>
                  </>
                )}
                {bejegyzesek.length > 0 && (
                  <>
                    <SzakaszCim>Megjegyzés</SzakaszCim>
                    <div className="divide-y divide-gray-200/70">
                      {bejegyzesek.map((b) => (
                        <BejegyzesKartya key={b.id} bejegyzes={b} szerkesztheto={j.szerkesztheto}
                          kezelhet={j.jogok.kezel} onValtozas={onValtozas} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function StatuszCimke({ tipus }: { tipus: 'megirva' | 'hianyzik' | 'ures' }) {
  const adat = {
    megirva: { ikon: <Check className="w-3 h-3 text-green-600" />, szoveg: 'Megjegyzés megírva', osztaly: 'bg-green-50 text-green-700' },
    hianyzik: { ikon: <Clock className="w-3 h-3 text-amber-600" />, szoveg: 'Nincs megjegyzés', osztaly: 'bg-amber-50 text-amber-800' },
    ures: { ikon: <AlertTriangle className="w-3 h-3 text-red-600" />, szoveg: 'Nincs rögzített tevékenység', osztaly: 'bg-red-50 text-red-700' },
  }[tipus];
  return (
    <span className={clsx('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0', adat.osztaly)}
      title={adat.szoveg}>
      {adat.ikon}
      <span className="hidden sm:inline">{adat.szoveg}</span>
      <span className="sr-only sm:hidden">{adat.szoveg}</span>
    </span>
  );
}

/**
 * A levél pontosan úgy, ahogy a címzett megkapja. Elszigetelt keretben
 * (`sandbox`, szkript nélkül) jelenik meg: a levél a csapat által írt
 * szöveget tartalmaz, ami ne futhasson az alkalmazás oldalán.
 *
 * `allow-popups`: enélkül a keretben SEMMI link nem működik — a képre vagy a
 * gombra kattintva néma maradt a felület. A felugró ablak kilép a keretből
 * (`-to-escape-sandbox`), így a kép rendes lapon nyílik meg; szkriptfuttatás
 * és azonos eredet továbbra sincs.
 */
function ElonezetAblak({ hetKezdete, onBezar, elkuldve, onValtozas }: {
  hetKezdete: string; onBezar: () => void; elkuldve: boolean; onValtozas: () => void;
}) {
  const [adat, setAdat] = useState<JelentesElonezet | null>(null);
  const [dolgozik, setDolgozik] = useState<string | null>(null);

  const cimzettEmail = adat?.cimzett ? (/<([^>]+)>/.exec(adat.cimzett)?.[1] ?? adat.cimzett) : '';

  async function letoltes() {
    setDolgozik('eml');
    try {
      await jelentesLevelFajl(hetKezdete);
      toast.success('Letöltve. Nyisd meg: Outlookban küldésre kész levélként nyílik meg — csak a Küldés gomb kell.');
    } catch (err) {
      toast.error(hibaSzoveg(err));
    } finally {
      setDolgozik(null);
    }
  }

  async function masolas() {
    if (!adat) return;
    try {
      const szoveg = new DOMParser().parseFromString(adat.html, 'text/html').body.innerText;
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([adat.html], { type: 'text/html' }),
          'text/plain': new Blob([szoveg], { type: 'text/plain' }),
        })]);
      } else {
        await navigator.clipboard.writeText(szoveg);
      }
      toast.success('Vágólapra másolva, formázva. Illeszd be egy új levélbe (Ctrl+V).');
    } catch {
      toast.error('A böngésző nem engedte a másolást — használd a letöltést.');
    }
  }

  function levelezo() {
    if (!adat) return;
    const url = `mailto:${encodeURIComponent(cimzettEmail)}?subject=${encodeURIComponent(adat.targy)}`;
    window.location.href = url;
    toast.info('Megnyílt a levelező a címzettel és a tárggyal — a levél törzsét a „Másolás” gombbal illeszd be.');
  }

  function nyomtatas() {
    if (!adat) return;
    const ablak = window.open('', '_blank');
    if (!ablak) { toast.error('A böngésző letiltotta az új ablakot.'); return; }
    ablak.document.open();
    ablak.document.write(adat.html);
    ablak.document.title = adat.targy;
    ablak.document.close();
    ablak.focus();
    setTimeout(() => ablak.print(), 500);
  }

  async function kezzelElkuldve() {
    if (!confirm('Elküldted a heti jelentést kézzel? A hét lezárul, és a rendszer nem próbálja újra kiküldeni.')) return;
    setDolgozik('kezi');
    try {
      const r = await jelentesKezzelElkuldve(hetKezdete);
      toast.success(r.uzenet);
      onValtozas();
      onBezar();
    } catch (err) {
      toast.error(hibaSzoveg(err));
    } finally {
      setDolgozik(null);
    }
  }
  // A szülő minden rendereléskor új függvényt ad — ne kérjük le miatta újra a levelet.
  const bezar = useRef(onBezar);
  bezar.current = onBezar;

  useEffect(() => {
    let el = false;
    jelentesElonezet(hetKezdete)
      .then((d) => { if (!el) setAdat(d); })
      .catch((err) => { if (!el) { toast.error(hibaSzoveg(err)); bezar.current(); } });
    return () => { el = true; };
  }, [hetKezdete]);

  useEffect(() => {
    const billentyu = (e: KeyboardEvent) => { if (e.key === 'Escape') bezar.current(); };
    window.addEventListener('keydown', billentyu);
    return () => window.removeEventListener('keydown', billentyu);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onBezar} aria-hidden />
      <div role="dialog" aria-modal="true" aria-labelledby="elonezet-cim"
        className="relative w-full max-w-3xl h-full max-h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden">
        <header className="flex items-start gap-3 px-5 py-3.5 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <h2 id="elonezet-cim" className="text-sm font-semibold text-gray-900">Előnézet — így kapja a címzett</h2>
            {adat && (
              <p className="text-xs text-gray-500 mt-0.5 break-words">
                Tárgy: {adat.targy} · Címzett: {adat.cimzett ?? 'nincs beállítva'}
                {!adat.befagyasztva && ' · a feladatok élő állapota — a kiküldéskor ez fagy be'}
              </p>
            )}
          </div>
          <button type="button" onClick={onBezar} aria-label="Bezárás" className="text-gray-400 hover:text-gray-700 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </header>
        {adat && (
          <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b border-gray-100 bg-gray-50/70">
            <span className="text-xs text-gray-500 mr-1">Mentés / kézi küldés:</span>
            <EszkozGomb onClick={letoltes} tolt={dolgozik === 'eml'} ikon={<Download className="w-4 h-4" />}
              cim="Kész levél fájlként: Outlookban küldésre kész piszkozatként nyílik meg, képekkel">
              Letöltés levélként (.eml)
            </EszkozGomb>
            <EszkozGomb onClick={masolas} ikon={<ClipboardCopy className="w-4 h-4" />} cim="Formázva a vágólapra — beilleszthető Gmailbe, Outlookba">
              Másolás
            </EszkozGomb>
            <EszkozGomb onClick={levelezo} ikon={<Mail className="w-4 h-4" />} cim="Új levél a címzettel és a tárggyal">
              Levelező megnyitása
            </EszkozGomb>
            <EszkozGomb onClick={nyomtatas} ikon={<Printer className="w-4 h-4" />} cim="Nyomtatás vagy mentés PDF-ként">
              Nyomtatás / PDF
            </EszkozGomb>
            {!elkuldve && (
              <EszkozGomb onClick={kezzelElkuldve} tolt={dolgozik === 'kezi'} ikon={<MailCheck className="w-4 h-4" />} kiemelt
                cim="Ha kézzel elküldted: a hét lezárul, a rendszer nem próbálja újra">
                Kézzel elküldtem
              </EszkozGomb>
            )}
          </div>
        )}
        {adat ? (
          <iframe title="A heti levél előnézete" sandbox="allow-popups allow-popups-to-escape-sandbox"
            srcDoc={adat.html} className="flex-1 w-full bg-white" />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Előnézet készítése…
          </div>
        )}
      </div>
    </div>
  );
}

function EszkozGomb({ onClick, ikon, children, cim, tolt, kiemelt }: {
  onClick: () => void; ikon: React.ReactNode; children: React.ReactNode; cim: string; tolt?: boolean; kiemelt?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={tolt} title={cim}
      className={clsx('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium disabled:opacity-50',
        kiemelt ? 'bg-brand-600 text-white hover:bg-brand-700' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50')}>
      {tolt ? <Loader2 className="w-4 h-4 animate-spin" /> : ikon}
      {children}
    </button>
  );
}
