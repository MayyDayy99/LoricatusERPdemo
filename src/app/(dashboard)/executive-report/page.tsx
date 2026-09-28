'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ClipboardCopy, Download, Info, Loader2, MailCheck, Plus, Printer, RefreshCw, Save, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { useCanAccess } from '@/lib/hooks/use-access';
import {
  beallitasMentes, riportKezzelElkuldve, riportLevelFajl, riportUjraszamolas, useCimzettJeloltek, useRiport,
  useRiportBeallitas, useRiportLevel, useRiportLista, type Cimzett, type RiportAllapot, type Szakasz,
} from '@/lib/hooks/use-executive-report';

/**
 * ── HETI VEZETŐI RIPORT ─────────────────────────────────────────────────────
 *
 * Egy e-mail oldalnyi kép a hétről, két blokkban: Iroda (új munka, ajánlatok,
 * pénz) és Művelet (haladás, elakadás, terhelés). Minden hétfőn 8:00-kor
 * elkészül és kimegy a beállított címzetteknek — címzettenként a nekik
 * szóló blokkokkal. Amíg a levelezés nem működik, innen menthető és küldhető
 * kézzel.
 *
 * A számok a Projekt Map-ből jönnek: a projektsorokban az Iroda/Művelet
 * kapcsoló, az érték és a státusz, a Számlázás / Várható kifizetés taskokon
 * az összeg.
 */

const NAPOK = ['hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat', 'vasárnap'];
const ALLAPOT: Record<RiportAllapot, { szoveg: string; szin: string }> = {
  kesz: { szoveg: 'elkészült, kiküldésre vár', szin: 'bg-amber-50 text-amber-800 border-amber-200' },
  kuldes: { szoveg: 'kiküldés alatt', szin: 'bg-amber-50 text-amber-800 border-amber-200' },
  elkuldve: { szoveg: 'kiküldve', szin: 'bg-green-50 text-green-800 border-green-200' },
  reszben: { szoveg: 'nem ment ki mindenkinek', szin: 'bg-red-50 text-red-800 border-red-200' },
};
const SZAKASZ_NEV: Record<Szakasz, string> = { iroda: 'Iroda', muvelet: 'Művelet' };

function hibaSzoveg(err: unknown): string {
  const e = err as { response?: { data?: { message?: string | string[] } }; message?: string };
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : m ?? e?.message ?? 'Ismeretlen hiba';
}

const idoSzoveg = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export default function VezetoiRiportOldal() {
  const olvashat = useCanAccess('executive-report.view');
  const kezelhet = useCanAccess('executive-report.manage');
  const router = useRouter();
  const params = useSearchParams();
  const het = params.get('het');
  const [ful, setFul] = useState<'riport' | 'beallitasok'>('riport');

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">Heti vezetői riport</h1>
          <p className="text-sm text-gray-500">Iroda és Művelet egy oldalon — a Projekt Map adataiból, minden héten ugyanabban a szerkezetben.</p>
        </div>
        {kezelhet && (
          <div className="flex rounded-lg border border-gray-200 p-0.5 bg-white">
            {(['riport', 'beallitasok'] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFul(f)}
                className={`px-3 py-1.5 text-sm rounded-md ${ful === f ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}>
                {f === 'riport' ? 'Riport' : 'Címzettek és időzítés'}
              </button>
            ))}
          </div>
        )}
      </div>
      {!olvashat ? (
        <p className="text-sm text-gray-500">A riportot a projektvezető és a fölötte lévő szintek látják.</p>
      ) : ful === 'riport' ? (
        <RiportFul het={het} kezelhet={kezelhet} onHet={(h) => router.replace(h ? `?het=${h}` : '?')} />
      ) : (
        <BeallitasFul />
      )}
    </div>
  );
}

function RiportFul({ het, kezelhet, onHet }: { het: string | null; kezelhet: boolean; onHet: (h: string | null) => void }) {
  const [szakaszok, setSzakaszok] = useState<Szakasz[]>(['iroda', 'muvelet']);
  const { data: lista, mutate: listaFrissit } = useRiportLista();
  const { data: nezet, mutate: nezetFrissit } = useRiport(het);
  const { data: level, isLoading, mutate: levelFrissit } = useRiportLevel(het, szakaszok);
  const [dolgozik, setDolgozik] = useState<string | null>(null);
  const [magassag, setMagassag] = useState(1500);
  const keret = useRef<HTMLIFrameElement>(null);

  const frissit = async () => { await Promise.all([listaFrissit(), nezetFrissit(), levelFrissit()]); };

  async function futtat(kulcs: string, fn: () => Promise<unknown>, siker?: string) {
    setDolgozik(kulcs);
    try {
      await fn();
      if (siker) toast.success(siker);
    } catch (e) {
      toast.error(hibaSzoveg(e));
    } finally {
      setDolgozik(null);
    }
  }

  async function masolas() {
    if (!level) return;
    try {
      const szoveg = new DOMParser().parseFromString(level.html, 'text/html').body.innerText;
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([level.html], { type: 'text/html' }),
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

  function nyomtatas() {
    if (!level) return;
    const ablak = window.open('', '_blank');
    if (!ablak) { toast.error('A böngésző letiltotta az új ablakot.'); return; }
    ablak.document.open();
    ablak.document.write(level.html);
    ablak.document.title = level.subject;
    ablak.document.close();
    ablak.focus();
    setTimeout(() => ablak.print(), 500);
  }

  const archivalt = nezet && !nezet.elonezet;
  const aktualisHet = nezet?.adat.het.hetKezdete ?? het;
  const allapot = nezet?.allapot ? ALLAPOT[nezet.allapot] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={het ?? ''} onChange={(e) => onHet(e.target.value || null)} data-testid="het-valaszto"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white">
          <option value="">Folyó hét — élő előnézet</option>
          {(lista ?? []).map((r) => (
            <option key={r.hetKezdete} value={r.hetKezdete}>{r.megjeloles}</option>
          ))}
        </select>
        <div className="flex rounded-lg border border-gray-200 p-0.5 bg-white text-sm" title="Így kapja az, akinek csak ez a blokk megy">
          {([['iroda', 'muvelet'], ['iroda'], ['muvelet']] as Szakasz[][]).map((sz) => {
            const aktiv = sz.join() === szakaszok.join();
            return (
              <button key={sz.join()} type="button" onClick={() => setSzakaszok(sz)}
                className={`px-2.5 py-1 rounded-md ${aktiv ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-800'}`}>
                {sz.length === 2 ? 'Mindkét blokk' : SZAKASZ_NEV[sz[0]]}
              </button>
            );
          })}
        </div>
        {nezet && (
          <span className={`text-xs border rounded-full px-2 py-0.5 ${nezet.elonezet ? 'bg-gray-50 text-gray-600 border-gray-200' : allapot?.szin ?? ''}`}>
            {nezet.elonezet
              ? 'élő előnézet — a hét még nincs lezárva'
              : `${allapot?.szoveg ?? ''}${nezet.elkuldve ? ` · ${idoSzoveg(nezet.elkuldve)}` : ''}${nezet.keziKuldes ? ` · kézzel elküldve ${idoSzoveg(nezet.keziKuldes)}` : ''}`}
          </span>
        )}
      </div>

      {nezet?.hiba && (
        <div className="text-sm rounded-lg border border-red-200 bg-red-50 text-red-800 px-3 py-2">
          Az e-mail nem ment ki mindenkinek: {nezet.hiba}. Letöltheted vagy átmásolhatod, és elküldheted kézzel.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2">
        <span className="text-xs text-gray-500 mr-1">Mentés / kézi küldés:</span>
        <Gomb onClick={() => futtat('eml', () => riportLevelFajl(het), 'Letöltve — Outlookban küldésre kész levélként nyílik meg.')}
          tolt={dolgozik === 'eml'} ikon={<Download className="w-4 h-4" />}>Letöltés (.eml)</Gomb>
        <Gomb onClick={masolas} ikon={<ClipboardCopy className="w-4 h-4" />}>Másolás</Gomb>
        <Gomb onClick={nyomtatas} ikon={<Printer className="w-4 h-4" />}>Nyomtatás / PDF</Gomb>
        {kezelhet && archivalt && !nezet?.keziKuldes && nezet?.allapot !== 'elkuldve' && aktualisHet && (
          <Gomb kiemelt tolt={dolgozik === 'kezi'} ikon={<MailCheck className="w-4 h-4" />}
            onClick={() => futtat('kezi', async () => { await riportKezzelElkuldve(aktualisHet); await frissit(); }, 'Megjelölve: kézzel elküldve.')}>
            Kézzel elküldtem
          </Gomb>
        )}
        {kezelhet && het && (
          <Gomb tolt={dolgozik === 'ujra'} ikon={<RefreshCw className="w-4 h-4" />}
            onClick={() => futtat('ujra', async () => { await riportUjraszamolas(het); await frissit(); }, 'Újraszámolva a mostani adatokból.')}>
            Újraszámolás
          </Gomb>
        )}
      </div>

      <details className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700">
        <summary className="cursor-pointer font-medium text-gray-900 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-gray-400" /> Honnan jönnek a számok?
        </summary>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-600">
          <li><b>Iroda / Művelet</b>: a Projekt Map-en a projekt neve melletti kapcsoló. Amikor a Művelet elkezdi, átkapcsolja — ettől szerződött pipeline.</li>
          <li><b>Érték és státusz</b>: a kapcsoló melletti összegre kattintva (Árazás → Ajánlat kint → Nyert / Elveszett). Az ajánlattételi határidő lejártával az árazás magától „Ajánlat kint” lesz.</li>
          <li><b>Pénz</b>: a Számlázás és a Várható kifizetés taskokon az Összeg mező. A Számlázás lezárása = kiment a számla; a Várható kifizetés dátuma a fizetési határidő, a lezárása = megjött a pénz.</li>
          <li><b>Új lehetőség</b>: a pályázatfigyelő ≥ 75 pontos találatai a héten. <b>Terhelés</b>: a jövő heti taskok napjai az elérhető napokhoz (szabadság és munkaszünet nélkül).</li>
        </ul>
      </details>

      <div className="rounded-xl border border-gray-200 overflow-hidden bg-[#F2F1ED]">
        {level && !isLoading ? (
          <iframe ref={keret} title="A vezetői riport" data-testid="riport-keret"
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcDoc={level.html}
            className="w-full block" style={{ height: magassag }}
            onLoad={() => {
              const h = keret.current?.contentDocument?.documentElement.scrollHeight;
              if (h) setMagassag(h + 8);
            }} />
        ) : (
          <div className="h-64 flex items-center justify-center text-sm text-gray-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> A riport készül…
          </div>
        )}
      </div>
    </div>
  );
}

function Gomb({ onClick, ikon, children, tolt, kiemelt }: {
  onClick: () => void; ikon: React.ReactNode; children: React.ReactNode; tolt?: boolean; kiemelt?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={tolt}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm border disabled:opacity-60 ${
        kiemelt ? 'bg-green-600 text-white border-green-600 hover:bg-green-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
      {tolt ? <Loader2 className="w-4 h-4 animate-spin" /> : ikon}
      {children}
    </button>
  );
}

/* ── Címzettek és időzítés ───────────────────────────────────────────────── */

type SzerkesztettCimzett = Cimzett & { kulcs: string };

function BeallitasFul() {
  const { data, mutate } = useRiportBeallitas();
  const { data: jeloltek } = useCimzettJeloltek(true);
  const [enabled, setEnabled] = useState(true);
  const [nap, setNap] = useState(1);
  const [ido, setIdo] = useState('08:00');
  const [cimzettek, setCimzettek] = useState<SzerkesztettCimzett[]>([]);
  const [ment, setMent] = useState(false);

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setNap(data.nap);
    setIdo(`${String(Math.floor(data.perc / 60)).padStart(2, '0')}:${String(data.perc % 60).padStart(2, '0')}`);
    setCimzettek(data.cimzettek.map((c, i) => ({
      kulcs: `${i}-${c.userId ?? c.email}`, userId: c.userId, email: c.email, nev: c.nev, szakaszok: c.szakaszok,
    })));
  }, [data]);

  const hasznaltUserek = useMemo(() => new Set(cimzettek.map((c) => c.userId).filter(Boolean)), [cimzettek]);

  const modosit = (kulcs: string, v: Partial<SzerkesztettCimzett>) =>
    setCimzettek((cs) => cs.map((c) => (c.kulcs === kulcs ? { ...c, ...v } : c)));

  async function mentes() {
    const [o, p] = ido.split(':').map(Number);
    const hibas = cimzettek.find((c) => !c.szakaszok.length || (!c.userId && !c.email?.trim()));
    if (hibas) { toast.error('Minden címzettnél válassz felhasználót (vagy írj e-mail-címet), és legalább egy blokkot.'); return; }
    setMent(true);
    try {
      await mutate(await beallitasMentes({
        enabled, nap, perc: o * 60 + p,
        cimzettek: cimzettek.map((c) => (c.userId
          ? { userId: c.userId, szakaszok: c.szakaszok }
          : { email: c.email?.trim(), nev: c.nev?.trim() || undefined, szakaszok: c.szakaszok })),
      }), { revalidate: false });
      toast.success('Mentve.');
    } catch (e) {
      toast.error(hibaSzoveg(e));
    } finally {
      setMent(false);
    }
  }

  if (!data) return <div className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Betöltés…</div>;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Időzítés</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Automatikus riport bekapcsolva
          </label>
          <span className="text-gray-400">·</span>
          <label className="inline-flex items-center gap-2">
            Minden
            <select value={nap} onChange={(e) => setNap(Number(e.target.value))} className="rounded-md border border-gray-300 px-2 py-1">
              {NAPOK.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
            </select>
            <input type="time" value={ido} min="06:00" max="20:59" onChange={(e) => setIdo(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1" />
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Hétfő–szerdai küldésnél a riport az előző hétről szól; a „jövő hét” (határidők, terhelés) a küldés hete.
        </p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Címzettek</h2>
        <p className="text-xs text-gray-500 mb-3">Ki melyik blokkot kapja. A rendszerbeli felhasználóknak az appban is szól értesítés, amikor elkészül.</p>
        <div className="space-y-2">
          {cimzettek.map((c) => {
            const feloldott = data.cimzettek.find((d) => (d.userId ?? d.email) === (c.userId ?? c.email));
            return (
              <div key={c.kulcs} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2" data-testid="cimzett-sor">
                <select value={c.userId ?? '__kulso'} className="rounded-md border border-gray-300 px-2 py-1 text-sm min-w-[200px]"
                  onChange={(e) => modosit(c.kulcs, e.target.value === '__kulso'
                    ? { userId: undefined, email: c.email ?? '' }
                    : { userId: e.target.value, email: undefined, nev: undefined })}>
                  <option value="__kulso">Külső e-mail-cím…</option>
                  {(jeloltek ?? []).filter((j) => j.id === c.userId || !hasznaltUserek.has(j.id)).map((j) => (
                    <option key={j.id} value={j.id}>{j.nev}</option>
                  ))}
                </select>
                {!c.userId && (
                  <>
                    <input value={c.email ?? ''} placeholder="nev@ceg.hu" onChange={(e) => modosit(c.kulcs, { email: e.target.value })}
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm w-52" />
                    <input value={c.nev ?? ''} placeholder="Név (nem kötelező)" onChange={(e) => modosit(c.kulcs, { nev: e.target.value })}
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm w-40" />
                  </>
                )}
                {c.userId && feloldott && !feloldott.feloldottEmail && (
                  <span className="text-xs text-red-600">inaktív felhasználó — nem kap levelet</span>
                )}
                <div className="flex items-center gap-3 ml-auto text-sm">
                  {(['iroda', 'muvelet'] as Szakasz[]).map((sz) => (
                    <label key={sz} className="inline-flex items-center gap-1.5">
                      <input type="checkbox" checked={c.szakaszok.includes(sz)}
                        onChange={(e) => modosit(c.kulcs, {
                          szakaszok: e.target.checked ? [...c.szakaszok, sz].sort() as Szakasz[] : c.szakaszok.filter((x) => x !== sz),
                        })} />
                      {SZAKASZ_NEV[sz]}
                    </label>
                  ))}
                  <button type="button" aria-label="Címzett törlése" className="text-gray-400 hover:text-red-600"
                    onClick={() => setCimzettek((cs) => cs.filter((x) => x.kulcs !== c.kulcs))}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {!cimzettek.length && <p className="text-sm text-gray-500">Még nincs címzett — amíg nincs, a riport nem megy ki automatikusan.</p>}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button type="button" data-testid="cimzett-hozzaadas"
            onClick={() => setCimzettek((cs) => [...cs, { kulcs: `uj-${Date.now()}`, userId: (jeloltek ?? []).find((j) => !hasznaltUserek.has(j.id))?.id, szakaszok: ['iroda', 'muvelet'] }])}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm border border-gray-200 bg-white hover:bg-gray-50">
            <Plus className="w-4 h-4" /> Címzett hozzáadása
          </button>
          <button type="button" onClick={() => void mentes()} disabled={ment} data-testid="beallitas-mentes"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 ml-auto">
            {ment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Mentés
          </button>
        </div>
      </section>
    </div>
  );
}
