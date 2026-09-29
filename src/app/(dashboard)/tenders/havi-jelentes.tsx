'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ClipboardCopy, Download, Loader2, MailCheck, Plus, Printer, RefreshCw, Save, Trash2 } from 'lucide-react';

import { apiClient } from '@/lib/api-client';
import { useCanAccess } from '@/lib/hooks/use-access';
import {
  haviJelentesApi, useHaviBeallitas, useHaviJelentes, useHaviLevel, useHaviLista, type HaviCimzett,
} from '@/lib/hooks/use-piaci-adatbazis';

/**
 * ── HAVI PIACI JELENTÉS ─────────────────────────────────────────────────────
 *
 * Havonta (alapból 1-jén 8:00) elkészül az előző hónap jelentése: hogyan áraz
 * a piac, mi hogyan szerepeltünk, kik a versenytársak és ki indul
 * rendszeresen. Az appban értesítés jön; amíg a levelezés nem működik, innen
 * menthető (.eml), másolható, nyomtatható, és jelölhető kézzel elküldöttnek.
 */

const hiba = (e: unknown) => {
  const m = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : m ?? 'Ismeretlen hiba';
};

export function HaviJelentes({ kezdoHonap }: { kezdoHonap?: string | null }) {
  const olvashat = useCanAccess('market-report.view');
  const kezelhet = useCanAccess('market-report.manage');
  const [honap, setHonap] = useState<string | null>(kezdoHonap ?? null);
  const [ful, setFul] = useState<'jelentes' | 'beallitas'>('jelentes');
  const { data: lista, mutate: listaFrissit } = useHaviLista();
  const { data: nezet, mutate: nezetFrissit } = useHaviJelentes(honap);
  const { data: level, isLoading, mutate: levelFrissit } = useHaviLevel(honap);
  const [dolgozik, setDolgozik] = useState<string | null>(null);
  const [magassag, setMagassag] = useState(1600);
  const keret = useRef<HTMLIFrameElement>(null);

  if (!olvashat) return <p className="text-sm text-gray-500">A havi piaci jelentést a projektvezető és a fölötte lévő szintek látják.</p>;

  const futtat = async (k: string, fn: () => Promise<unknown>, siker?: string) => {
    setDolgozik(k);
    try { await fn(); if (siker) toast.success(siker); } catch (e) { toast.error(hiba(e)); } finally { setDolgozik(null); }
  };
  const frissit = async () => { await Promise.all([listaFrissit(), nezetFrissit(), levelFrissit()]); };

  async function masolas() {
    if (!level) return;
    try {
      const szoveg = new DOMParser().parseFromString(level.html, 'text/html').body.innerText;
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([level.html], { type: 'text/html' }), 'text/plain': new Blob([szoveg], { type: 'text/plain' }),
        })]);
      } else {
        await navigator.clipboard.writeText(szoveg);
      }
      toast.success('Vágólapra másolva, formázva.');
    } catch { toast.error('A böngésző nem engedte a másolást — használd a letöltést.'); }
  }
  function nyomtatas() {
    if (!level) return;
    const w = window.open('', '_blank');
    if (!w) { toast.error('A böngésző letiltotta az új ablakot.'); return; }
    w.document.open(); w.document.write(level.html); w.document.title = level.subject; w.document.close(); w.focus();
    setTimeout(() => w.print(), 500);
  }
  const aktualis = nezet?.adat.honap ?? honap;

  return (
    <div className="space-y-3" data-testid="havi-jelentes">
      <div className="flex flex-wrap items-center gap-2">
        <select value={honap ?? ''} onChange={(e) => setHonap(e.target.value || null)} data-testid="honap-valaszto"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white">
          <option value="">Folyó hónap — élő előnézet</option>
          {(lista ?? []).map((r) => <option key={r.honap} value={r.honap}>{r.megjeloles}</option>)}
        </select>
        {nezet && (
          <span className="text-xs border rounded-full px-2 py-0.5 bg-gray-50 text-gray-600 border-gray-200">
            {nezet.elonezet ? 'élő előnézet' : nezet.allapot === 'elkuldve' ? 'kiküldve' : nezet.keziKuldes ? 'kézzel elküldve' : 'elkészült'}
          </span>
        )}
        {kezelhet && (
          <div className="ml-auto flex rounded-lg border border-gray-200 p-0.5 bg-white text-sm">
            {(['jelentes', 'beallitas'] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFul(f)}
                className={`px-3 py-1 rounded-md ${ful === f ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>
                {f === 'jelentes' ? 'Jelentés' : 'Címzettek és időzítés'}
              </button>
            ))}
          </div>
        )}
      </div>

      {ful === 'beallitas' && kezelhet ? <HaviBeallitasok /> : (
        <>
          {nezet?.hiba && <div className="text-sm rounded-lg border border-red-200 bg-red-50 text-red-800 px-3 py-2">Nem ment ki mindenkinek: {nezet.hiba}</div>}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2">
            <span className="text-xs text-gray-500 mr-1">Mentés / kézi küldés:</span>
            <Gomb ikon={<Download className="w-4 h-4" />} tolt={dolgozik === 'eml'} onClick={() => futtat('eml', () => haviJelentesApi.letoltes(honap), 'Letöltve.')}>Letöltés (.eml)</Gomb>
            <Gomb ikon={<ClipboardCopy className="w-4 h-4" />} onClick={masolas}>Másolás</Gomb>
            <Gomb ikon={<Printer className="w-4 h-4" />} onClick={nyomtatas}>Nyomtatás / PDF</Gomb>
            {kezelhet && aktualis && nezet && !nezet.elonezet && !nezet.keziKuldes && nezet.allapot !== 'elkuldve' && (
              <Gomb kiemelt ikon={<MailCheck className="w-4 h-4" />} tolt={dolgozik === 'kezi'}
                onClick={() => futtat('kezi', async () => { await haviJelentesApi.keziElkuldve(aktualis); await frissit(); }, 'Megjelölve.')}>Kézzel elküldtem</Gomb>
            )}
            {kezelhet && aktualis && (
              <Gomb ikon={<RefreshCw className="w-4 h-4" />} tolt={dolgozik === 'ujra'}
                onClick={() => futtat('ujra', async () => { await haviJelentesApi.ujra(aktualis); setHonap(aktualis); await frissit(); }, 'Elkészült és archiválva.')}>
                {nezet?.elonezet ? 'Archiválás most' : 'Újraszámolás'}
              </Gomb>
            )}
          </div>
          <div className="rounded-xl border border-gray-200 overflow-hidden bg-[#F2F1ED]">
            {level && !isLoading ? (
              <iframe ref={keret} title="Havi piaci jelentés" data-testid="havi-keret"
                sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcDoc={level.html}
                className="w-full block" style={{ height: magassag }}
                onLoad={() => { const h = keret.current?.contentDocument?.documentElement.scrollHeight; if (h) setMagassag(h + 8); }} />
            ) : (
              <div className="h-64 flex items-center justify-center text-sm text-gray-500 gap-2"><Loader2 className="w-4 h-4 animate-spin" /> A jelentés készül…</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Gomb({ onClick, ikon, children, tolt, kiemelt }: { onClick: () => void; ikon: React.ReactNode; children: React.ReactNode; tolt?: boolean; kiemelt?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={tolt}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm border disabled:opacity-60 ${kiemelt ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
      {tolt ? <Loader2 className="w-4 h-4 animate-spin" /> : ikon}{children}
    </button>
  );
}

function HaviBeallitasok() {
  const { data, mutate } = useHaviBeallitas();
  const [jeloltek, setJeloltek] = useState<Array<{ id: string; nev: string }>>([]);
  const [enabled, setEnabled] = useState(true);
  const [nap, setNap] = useState(1);
  const [ido, setIdo] = useState('08:00');
  const [cimzettek, setCimzettek] = useState<Array<HaviCimzett & { kulcs: string }>>([]);
  const [ment, setMent] = useState(false);

  useEffect(() => {
    apiClient.get('/executive-report/settings/candidates').then((r) => setJeloltek(r.data)).catch(() => setJeloltek([]));
  }, []);
  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled); setNap(data.nap);
    setIdo(`${String(Math.floor(data.perc / 60)).padStart(2, '0')}:${String(data.perc % 60).padStart(2, '0')}`);
    setCimzettek(data.cimzettek.map((c, i) => ({ kulcs: `${i}`, userId: c.userId, email: c.email, nev: c.nev })));
  }, [data]);

  async function mentes() {
    const [o, p] = ido.split(':').map(Number);
    setMent(true);
    try {
      await mutate(await haviJelentesApi.beallitas({
        enabled, nap, perc: o * 60 + p,
        cimzettek: cimzettek.map((c) => (c.userId ? { userId: c.userId } : { email: c.email?.trim(), nev: c.nev?.trim() || undefined })),
      }), { revalidate: false });
      toast.success('Mentve.');
    } catch (e) { toast.error(hiba(e)); } finally { setMent(false); }
  }
  if (!data) return <Loader2 className="w-5 h-5 animate-spin text-gray-400" />;
  const hasznalt = new Set(cimzettek.map((c) => c.userId).filter(Boolean));

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Havi jelentés bekapcsolva</label>
        <label className="inline-flex items-center gap-2">Minden hónap
          <select value={nap} onChange={(e) => setNap(Number(e.target.value))} className="rounded-md border border-gray-300 px-2 py-1">
            {Array.from({ length: 28 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}.</option>)}
          </select> napján
          <input type="time" value={ido} min="06:00" max="20:59" onChange={(e) => setIdo(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1" />
        </label>
      </div>
      <div className="space-y-2">
        {cimzettek.map((c) => (
          <div key={c.kulcs} className="flex flex-wrap items-center gap-2" data-testid="havi-cimzett">
            <select value={c.userId ?? '__k'} className="rounded-md border border-gray-300 px-2 py-1 min-w-[200px]"
              onChange={(e) => setCimzettek((cs) => cs.map((x) => (x.kulcs === c.kulcs ? (e.target.value === '__k' ? { kulcs: x.kulcs, email: '' } : { kulcs: x.kulcs, userId: e.target.value }) : x)))}>
              <option value="__k">Külső e-mail-cím…</option>
              {jeloltek.filter((j) => j.id === c.userId || !hasznalt.has(j.id)).map((j) => <option key={j.id} value={j.id}>{j.nev}</option>)}
            </select>
            {!c.userId && <input value={c.email ?? ''} placeholder="nev@ceg.hu" className="rounded-md border border-gray-300 px-2 py-1 w-56"
              onChange={(e) => setCimzettek((cs) => cs.map((x) => (x.kulcs === c.kulcs ? { ...x, email: e.target.value } : x)))} />}
            <button type="button" aria-label="Törlés" className="text-gray-400 hover:text-red-600" onClick={() => setCimzettek((cs) => cs.filter((x) => x.kulcs !== c.kulcs))}><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {!cimzettek.length && <p className="text-gray-500">Még nincs címzett — amíg nincs, a jelentés nem megy ki automatikusan (az appban akkor is elkészíthető).</p>}
      </div>
      <div className="flex gap-2">
        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border border-gray-200"
          onClick={() => setCimzettek((cs) => [...cs, { kulcs: `u${Date.now()}`, userId: jeloltek.find((j) => !hasznalt.has(j.id))?.id }])}>
          <Plus className="w-4 h-4" /> Címzett
        </button>
        <button type="button" onClick={() => void mentes()} disabled={ment} data-testid="havi-mentes"
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 bg-green-600 text-white disabled:opacity-60">
          {ment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Mentés
        </button>
      </div>
    </section>
  );
}
