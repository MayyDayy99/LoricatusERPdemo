'use client';

import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { ClipboardPaste, Database, Loader2, Pencil, Plus, Search, Trash2, Trophy } from 'lucide-react';

import { apiClient } from '@/lib/api-client';
import { useCanAccess } from '@/lib/hooks/use-access';
import { DONTES_OKOK } from '@/lib/hooks/use-procurement';
import {
  KIMENET_FELIRAT, piaciAdatbazisApi, useHianyzoEredmenyek, usePalyazatEredmeny, useSajatEredmenyek,
  type Ajanlattevo, type Kimenet, type SajatEredmeny,
} from '@/lib/hooks/use-piaci-adatbazis';
import { INPUT, Mezo, Modal, penz } from './ui';

/**
 * ── SAJÁT EREDMÉNY ──────────────────────────────────────────────────────────
 *
 * Amit a TED nem tud: mennyiért adtunk be, hányadikak lettünk, ki nyert
 * mennyiért, kik indultak még és miért vesztettünk. A legjobb forrás az
 * „összegezés az ajánlatok elbírálásáról": a PDF szövegét beillesztve a
 * rendszer kitölti az ajánlattevők táblázatát — ellenőrizni kell, de nem kell
 * begépelni. Ebből épül a havi piaci jelentés és az árazási támpont.
 */

const hibaUzenet = (e: unknown) => {
  const m = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : m ?? 'A mentés nem sikerült.';
};

/** „12 500 000", „12,5M" → szám; üres → null; hibás → NaN. */
export function osszegErtelmez(s: string): number | null {
  const t = s.trim().toLowerCase().replace(/ft$|huf$|eur$|€$/, '').trim();
  if (!t) return null;
  const m = /^(\d+(?:[.,]\d+)?)\s*(m|e)$/.exec(t);
  if (m) return Math.round(Number(m[1].replace(',', '.')) * (m[2] === 'm' ? 1_000_000 : 1_000));
  const c = t.replace(/[\s.]/g, '').replace(/,-?$/, '');
  return /^\d+$/.test(c) ? Number(c) : NaN;
}

const osszegSzoveg = (v: number | null | undefined) => (v == null ? '' : Math.round(v).toLocaleString('hu-HU'));

type Sor = { kulcs: string; name: string; price: string; rank: string; winner: boolean; own: boolean };

export function SajatEredmenyAblak({ kotes, meglevo, alapCim, onBezar, onKesz }: {
  /** Pályázathoz kötve (a panelből) — a cím, ajánlatkérő, becsült érték onnan jön. */
  kotes?: { tenderId?: string };
  meglevo?: SajatEredmeny | null;
  alapCim?: string;
  onBezar: () => void;
  /** `null`: a rögzített eredményt törölték. */
  onKesz: (e: SajatEredmeny | null) => void;
}) {
  const [kimenet, setKimenet] = useState<Kimenet>(meglevo?.outcome ?? 'lost');
  const [cim, setCim] = useState(meglevo?.title ?? alapCim ?? '');
  const [ajanlatkero, setAjanlatkero] = useState(meglevo?.buyer ?? '');
  const [datum, setDatum] = useState(meglevo?.decisionDate ?? '');
  const [penznem, setPenznem] = useState(meglevo?.currency ?? 'HUF');
  const [sajatAr, setSajatAr] = useState(osszegSzoveg(meglevo?.ourPrice));
  const [helyezes, setHelyezes] = useState(meglevo?.ourRank ? String(meglevo.ourRank) : '');
  const [letszam, setLetszam] = useState(meglevo?.biddersCount ? String(meglevo.biddersCount) : '');
  const [nyertes, setNyertes] = useState(meglevo?.winnerName ?? '');
  const [nyertesAr, setNyertesAr] = useState(osszegSzoveg(meglevo?.winnerPrice));
  const [becsult, setBecsult] = useState(osszegSzoveg(meglevo?.estimatedValue));
  const [okok, setOkok] = useState<string[]>(meglevo?.lossReasons ?? []);
  const [megjegyzes, setMegjegyzes] = useState(meglevo?.note ?? '');
  const [projekt, setProjekt] = useState<{ id: string; name: string } | null>(
    meglevo?.projectId ? { id: meglevo.projectId, name: meglevo.title } : null,
  );
  const [sorok, setSorok] = useState<Sor[]>(
    (meglevo?.bidders ?? []).map((b, i) => ({
      kulcs: `m${i}`, name: b.name, price: osszegSzoveg(b.price), rank: b.rank ? String(b.rank) : '', winner: b.winner, own: b.own,
    })),
  );
  const [forras, setForras] = useState<'kezi' | 'osszegezes'>((meglevo?.source as 'kezi' | 'osszegezes') === 'osszegezes' ? 'osszegezes' : 'kezi');
  const [beillesztes, setBeillesztes] = useState('');
  const [figyelmeztetes, setFigyelmeztetes] = useState<string[]>([]);
  const [ertelmez, setErtelmez] = useState(false);
  const [ment, setMent] = useState(false);

  const onallo = !kotes?.tenderId;

  async function osszegezesBeolvasas() {
    if (!beillesztes.trim()) return;
    setErtelmez(true);
    try {
      const j = await piaciAdatbazisApi.osszegezes(beillesztes);
      setSorok(j.bidders.filter((b) => !b.invalid).map((b, i) => ({
        kulcs: `o${i}`, name: b.name, price: osszegSzoveg(b.price), rank: b.rank ? String(b.rank) : '', winner: b.winner, own: b.own,
      })));
      if (j.winnerName) setNyertes(j.winnerName);
      if (j.winnerPrice) setNyertesAr(osszegSzoveg(j.winnerPrice));
      if (j.estimatedValue && !becsult) setBecsult(osszegSzoveg(j.estimatedValue));
      setPenznem(j.currency);
      const sajat = j.bidders.find((b) => b.own);
      if (sajat?.price) setSajatAr(osszegSzoveg(sajat.price));
      if (sajat?.rank) setHelyezes(String(sajat.rank));
      setLetszam(String(j.bidders.filter((b) => !b.invalid).length || ''));
      if (sajat && j.winnerName) setKimenet(sajat.winner ? 'won' : 'lost');
      setFigyelmeztetes([
        ...j.warnings,
        ...(j.bidders.some((b) => b.invalid) ? [`Érvénytelen ajánlat (kihagyva): ${j.bidders.filter((b) => b.invalid).map((b) => b.name).join(', ')}`] : []),
        ...(!sajat ? ['A saját cégünket nem találtam a listában — jelöld be a „mi" oszlopban.'] : []),
      ]);
      setForras('osszegezes');
      setBeillesztes('');
      toast.success(`${j.bidders.length} ajánlattevő beolvasva — ellenőrizd a táblázatot.`);
    } catch (e) {
      toast.error(hibaUzenet(e));
    } finally {
      setErtelmez(false);
    }
  }

  const szamok = useMemo(() => ({
    sajatAr: osszegErtelmez(sajatAr), nyertesAr: osszegErtelmez(nyertesAr), becsult: osszegErtelmez(becsult),
    sorok: sorok.map((s) => osszegErtelmez(s.price)),
  }), [sajatAr, nyertesAr, becsult, sorok]);
  const hibasSzam = [szamok.sajatAr, szamok.nyertesAr, szamok.becsult, ...szamok.sorok].some((v) => Number.isNaN(v));

  async function mentes() {
    if (hibasSzam) { toast.error('Egy összeg nem szám (pl. 12 500 000 vagy 12,5M).'); return; }
    if (onallo && !projekt && !cim.trim()) { toast.error('Adj meg címet, vagy válassz projektet.'); return; }
    setMent(true);
    try {
      const e = await piaciAdatbazisApi.ment({
        tenderId: kotes?.tenderId ?? null,
        projectId: onallo ? projekt?.id ?? null : null,
        title: cim.trim() || undefined,
        buyer: ajanlatkero.trim() || null,
        outcome: kimenet,
        currency: penznem,
        ourPrice: szamok.sajatAr,
        ourRank: helyezes ? Number(helyezes) : null,
        biddersCount: letszam ? Number(letszam) : null,
        winnerName: nyertes.trim() || null,
        winnerPrice: szamok.nyertesAr,
        estimatedValue: szamok.becsult,
        decisionDate: datum || null,
        lossReasons: kimenet === 'lost' ? okok : [],
        note: megjegyzes.trim() || null,
        source: forras,
        bidders: sorok.filter((s) => s.name.trim()).map((s, i) => ({
          name: s.name.trim(), price: szamok.sorok[i], rank: s.rank ? Number(s.rank) : null, winner: s.winner, own: s.own,
        })),
      }, meglevo?.id);
      toast.success('Saját eredmény mentve — bekerült a piaci adatbázisba.');
      onKesz(e);
    } catch (e) {
      toast.error(hibaUzenet(e));
    } finally {
      setMent(false);
    }
  }

  const modSor = (kulcs: string, v: Partial<Sor>) => setSorok((ss) => ss.map((s) => (s.kulcs === kulcs ? { ...s, ...v } : s)));

  return (
    <Modal cim={meglevo ? 'Saját eredmény módosítása' : 'Saját eredmény rögzítése'} onBezar={onBezar} szeles>
      <div className="space-y-4" data-testid="sajat-eredmeny-ablak">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(KIMENET_FELIRAT) as Kimenet[]).map((k) => (
            <button key={k} type="button" onClick={() => setKimenet(k)}
              className={clsx('px-3 py-1.5 rounded-lg text-sm border', kimenet === k
                ? k === 'won' ? 'bg-green-600 border-green-600 text-white' : k === 'lost' ? 'bg-red-600 border-red-600 text-white' : 'bg-gray-800 border-gray-800 text-white'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50')}>
              {KIMENET_FELIRAT[k]}
            </button>
          ))}
        </div>

        {onallo && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Mezo cimke="Régi projekt (Projekt Map) — nem kötelező">
              <ProjektValaszto ertek={projekt} onValaszt={(p) => { setProjekt(p); if (p && !cim) setCim(p.name); }} />
            </Mezo>
            <Mezo cimke="Megnevezés">
              <input value={cim} onChange={(e) => setCim(e.target.value)} className={INPUT} maxLength={500} placeholder="pl. Józsefváros fakataszter 2025" />
            </Mezo>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          {onallo && (
            <Mezo cimke="Ajánlatkérő">
              <input value={ajanlatkero} onChange={(e) => setAjanlatkero(e.target.value)} className={INPUT} maxLength={300} />
            </Mezo>
          )}
          <Mezo cimke="Döntés napja">
            <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className={INPUT} />
          </Mezo>
          <Mezo cimke="Pénznem">
            <select value={penznem} onChange={(e) => setPenznem(e.target.value)} className={INPUT}>
              <option value="HUF">HUF</option><option value="EUR">EUR</option>
            </select>
          </Mezo>
        </div>

        <details className="rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2" open={!meglevo && sorok.length === 0}>
          <summary className="cursor-pointer text-sm font-medium text-blue-900 flex items-center gap-1.5">
            <ClipboardPaste className="w-4 h-4" /> Összegezés beillesztése — a táblázat magától kitöltődik
          </summary>
          <p className="text-xs text-blue-900/80 mt-1.5">
            Nyisd meg az „Összegezés az ajánlatok elbírálásáról” PDF-et, jelölj ki mindent (Ctrl+A), másold (Ctrl+C), és illeszd ide.
          </p>
          <textarea value={beillesztes} onChange={(e) => setBeillesztes(e.target.value)} rows={4} data-testid="osszegezes-mezo"
            className={clsx(INPUT, 'mt-2 font-mono text-xs')} placeholder="Az összegezés szövege…" />
          <button type="button" onClick={() => void osszegezesBeolvasas()} disabled={!beillesztes.trim() || ertelmez} data-testid="osszegezes-beolvas"
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm bg-blue-600 text-white disabled:opacity-50">
            {ertelmez ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardPaste className="w-4 h-4" />} Beolvasás
          </button>
        </details>
        {figyelmeztetes.length > 0 && (
          <ul className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 list-disc pl-5 space-y-0.5">
            {figyelmeztetes.map((f) => <li key={f}>{f}</li>)}
          </ul>
        )}

        <div className="grid gap-3 sm:grid-cols-4">
          <Mezo cimke="A mi árunk (nettó)">
            <input value={sajatAr} onChange={(e) => setSajatAr(e.target.value)} className={INPUT} placeholder="pl. 27 400 000" data-testid="sajat-ar" />
          </Mezo>
          <Mezo cimke="Helyezésünk">
            <input value={helyezes} onChange={(e) => setHelyezes(e.target.value.replace(/\D/g, ''))} className={INPUT} placeholder="pl. 2" />
          </Mezo>
          <Mezo cimke="Ajánlattevők száma">
            <input value={letszam} onChange={(e) => setLetszam(e.target.value.replace(/\D/g, ''))} className={INPUT} placeholder="pl. 3" />
          </Mezo>
          <Mezo cimke="Becsült érték">
            <input value={becsult} onChange={(e) => setBecsult(e.target.value)} className={INPUT} placeholder="ha ismert" />
          </Mezo>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <Mezo cimke="Nyertes">
            <input value={nyertes} onChange={(e) => setNyertes(e.target.value)} className={INPUT} maxLength={300} data-testid="nyertes-nev" />
          </Mezo>
          <Mezo cimke="Nyertes ára">
            <input value={nyertesAr} onChange={(e) => setNyertesAr(e.target.value)} className={INPUT} />
          </Mezo>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-600">Ajánlattevők (az összegezésből)</span>
            <button type="button" className="text-xs text-blue-700 hover:underline inline-flex items-center gap-1"
              onClick={() => setSorok((ss) => [...ss, { kulcs: `u${Date.now()}`, name: '', price: '', rank: '', winner: false, own: false }])}>
              <Plus className="w-3 h-3" /> sor
            </button>
          </div>
          {sorok.length === 0 ? (
            <p className="text-xs text-gray-400">Nincs még ajánlattevő — illeszd be az összegezést, vagy adj hozzá sort.</p>
          ) : (
            <table className="w-full text-sm" data-testid="ajanlattevok-tabla">
              <thead className="text-[11px] text-gray-400">
                <tr><th className="text-left font-medium">Cég</th><th className="text-left font-medium w-36">Ár</th><th className="w-14 font-medium">Hely</th><th className="w-14 font-medium">Nyert</th><th className="w-10 font-medium">Mi</th><th className="w-8" /></tr>
              </thead>
              <tbody>
                {sorok.map((s, i) => (
                  <tr key={s.kulcs} className={clsx(s.own && 'bg-green-50', s.winner && 'font-medium')}>
                    <td className="pr-1 py-0.5"><input value={s.name} onChange={(e) => modSor(s.kulcs, { name: e.target.value })} className={clsx(INPUT, 'py-1')} /></td>
                    <td className="pr-1"><input value={s.price} onChange={(e) => modSor(s.kulcs, { price: e.target.value })}
                      className={clsx(INPUT, 'py-1', Number.isNaN(szamok.sorok[i]) && 'border-red-500')} /></td>
                    <td className="pr-1"><input value={s.rank} onChange={(e) => modSor(s.kulcs, { rank: e.target.value.replace(/\D/g, '') })} className={clsx(INPUT, 'py-1 text-center')} /></td>
                    <td className="text-center"><input type="radio" name="nyertes" checked={s.winner}
                      onChange={() => { setSorok((ss) => ss.map((x) => ({ ...x, winner: x.kulcs === s.kulcs }))); setNyertes(s.name); const ar = osszegErtelmez(s.price); if (ar && !Number.isNaN(ar)) setNyertesAr(osszegSzoveg(ar)); }} /></td>
                    <td className="text-center"><input type="checkbox" checked={s.own}
                      onChange={(e) => { setSorok((ss) => ss.map((x) => ({ ...x, own: x.kulcs === s.kulcs ? e.target.checked : false }))); if (e.target.checked) { if (s.price) setSajatAr(s.price); if (s.rank) setHelyezes(s.rank); } }} /></td>
                    <td className="text-center"><button type="button" aria-label="Sor törlése" onClick={() => setSorok((ss) => ss.filter((x) => x.kulcs !== s.kulcs))}
                      className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {kimenet === 'lost' && (
          <Mezo cimke="Miért vesztettünk?">
            <div className="flex flex-wrap gap-1.5">
              {DONTES_OKOK.map((o) => (
                <button key={o.kod} type="button" aria-pressed={okok.includes(o.kod)}
                  onClick={() => setOkok((x) => (x.includes(o.kod) ? x.filter((y) => y !== o.kod) : [...x, o.kod]))}
                  className={clsx('text-xs rounded-full px-2.5 py-1 border', okok.includes(o.kod) ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-gray-200 text-gray-700')}>
                  {o.felirat}
                </button>
              ))}
            </div>
          </Mezo>
        )}
        <Mezo cimke="Megjegyzés (tanulság, amit legközelebb másképp csinálnánk)">
          <textarea value={megjegyzes} onChange={(e) => setMegjegyzes(e.target.value)} rows={2} className={INPUT} maxLength={4000} />
        </Mezo>

        <div className="flex justify-end gap-2 pt-1">
          {meglevo && (
            <button type="button" className="mr-auto px-3 py-2 text-sm rounded-lg text-red-700 hover:bg-red-50"
              onClick={async () => {
                if (!confirm('Törlöd ezt a saját eredményt a piaci adatbázisból?')) return;
                try { await piaciAdatbazisApi.torol(meglevo.id); toast.success('Törölve.'); onKesz(null); } catch (e) { toast.error(hibaUzenet(e)); }
              }}>
              Törlés
            </button>
          )}
          <button type="button" onClick={onBezar} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Mégse</button>
          <button type="button" onClick={() => void mentes()} disabled={ment || hibasSzam} data-testid="sajat-eredmeny-mentes"
            className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-1.5">
            {ment && <Loader2 className="w-4 h-4 animate-spin" />} Mentés
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ProjektValaszto({ ertek, onValaszt }: { ertek: { id: string; name: string } | null; onValaszt: (p: { id: string; name: string } | null) => void }) {
  const [q, setQ] = useState('');
  const [talalat, setTalalat] = useState<Array<{ id: string; name: string; state: string; recorded: boolean }>>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setTalalat([]); return; }
    const t = setTimeout(() => {
      apiClient.get('/procurement/outcomes/project-search', { params: { q } }).then((r) => setTalalat(r.data)).catch(() => setTalalat([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  if (ertek) {
    return (
      <div className="flex items-center gap-2 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
        <span className="flex-1 truncate">{ertek.name}</span>
        <button type="button" onClick={() => onValaszt(null)} className="text-xs text-gray-500 hover:text-gray-800">csere</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input value={q} onChange={(e) => setQ(e.target.value)} className={clsx(INPUT, 'pl-9')} placeholder="Keresés a projektek között…" />
      {talalat.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto text-sm">
          {talalat.map((p) => (
            <li key={p.id}>
              <button type="button" disabled={p.recorded} onClick={() => { onValaszt({ id: p.id, name: p.name }); setQ(''); }}
                className="w-full text-left px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">
                {p.name} {p.recorded && <span className="text-xs text-gray-400">— már rögzítve</span>}
                {p.state === 'archived' && <span className="text-xs text-gray-400"> · archivált</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Sor a listákban: kimenet, árak, arány. */
function EredmenySor({ e, onSzerkeszt }: { e: SajatEredmeny; onSzerkeszt?: () => void }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className={clsx('text-[11px] font-semibold rounded-full px-2 py-0.5 mt-0.5 shrink-0',
        e.outcome === 'won' ? 'bg-green-100 text-green-800' : e.outcome === 'lost' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600')}>
        {KIMENET_FELIRAT[e.outcome]}
      </span>
      <div className="flex-1 min-w-0 text-sm">
        <div className="font-medium text-gray-900 truncate">{e.title}</div>
        <div className="text-xs text-gray-500">
          {[
            e.ourPrice ? `mi: ${penz(e.ourPrice, e.currency)}${e.ourRank ? ` (${e.ourRank}.${e.biddersCount ? `/${e.biddersCount}` : ''})` : ''}` : 'a mi árunk hiányzik',
            e.winnerName ? `nyertes: ${e.winnerName}${e.winnerPrice ? ` — ${penz(e.winnerPrice, e.currency)}` : ''}` : null,
            e.priceToWinner && e.outcome === 'lost' ? `${Math.round((e.priceToWinner - 1) * 100) >= 0 ? '+' : ''}${Math.round((e.priceToWinner - 1) * 100)}% a nyerteshez` : null,
            e.lossReasons.length ? e.lossReasons.map((o) => DONTES_OKOK.find((x) => x.kod === o)?.felirat ?? o).join(', ') : null,
          ].filter(Boolean).join(' · ')}
        </div>
      </div>
      {onSzerkeszt && (
        <button type="button" onClick={onSzerkeszt} aria-label="Szerkesztés" className="text-gray-400 hover:text-gray-800 shrink-0">
          <Pencil className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/** A pályázat oldalpaneljén: a rögzített eredmény vagy a „Rögzítsd" gomb. */
export function PalyazatEredmenyBlokk({ tenderId, cim, statusz }: { tenderId: string; cim: string; statusz: string }) {
  const irhat = useCanAccess('project.commercial');
  const { data, mutate } = usePalyazatEredmeny(tenderId);
  const [nyitva, setNyitva] = useState(false);
  const lezart = statusz === 'won' || statusz === 'lost';
  if (!data && !lezart) return null;
  return (
    <section className="border border-gray-200 rounded-xl p-3" data-testid="sajat-eredmeny-blokk">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 mb-1"><Trophy className="w-4 h-4 text-gray-400" /> Saját eredményünk</h3>
      {data ? (
        <EredmenySor e={data} onSzerkeszt={irhat ? () => setNyitva(true) : undefined} />
      ) : (
        <div className="text-sm text-gray-600 space-y-2">
          <p>A pályázat {statusz === 'won' ? 'nyert' : 'elveszett'} — rögzítsd az árunkat, a nyertest és a többi ajánlattevőt (az összegezésből). Ebből épül a piaci adatbázis.</p>
          {irhat && (
            <button type="button" onClick={() => setNyitva(true)} data-testid="sajat-eredmeny-rogzites"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Eredmény rögzítése
            </button>
          )}
        </div>
      )}
      {nyitva && (
        <SajatEredmenyAblak kotes={{ tenderId }} meglevo={data ?? null} alapCim={cim}
          onBezar={() => setNyitva(false)} onKesz={() => { setNyitva(false); void mutate(); }} />
      )}
    </section>
  );
}

/** A Piaci kép fülön: a saját adatbázis — lista, hiányzók, új (régi projekt) felvétele. */
export function SajatAdatbazis() {
  const irhat = useCanAccess('project.commercial');
  const [kimenet, setKimenet] = useState<Kimenet | null>(null);
  const [kereses, setKereses] = useState('');
  const { items, total, mutate } = useSajatEredmenyek({ outcome: kimenet, search: kereses || undefined });
  const { data: hianyzo, mutate: hianyzoFrissit } = useHianyzoEredmenyek();
  const [szerkesztett, setSzerkesztett] = useState<SajatEredmeny | 'uj' | null>(null);
  const [palyazatbol, setPalyazatbol] = useState<{ tenderId: string; title: string } | null>(null);

  const frissit = () => { void mutate(); void hianyzoFrissit(); };
  const nyert = items.filter((i) => i.outcome === 'won').length;
  const vesztett = items.filter((i) => i.outcome === 'lost').length;

  return (
    <section className="bg-white border border-gray-200 rounded-xl" data-testid="sajat-adatbazis">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Database className="w-4 h-4 text-gray-400" /> Saját piaci adatbázis ({total})</h2>
        <span className="text-xs text-gray-500">{nyert} nyert · {vesztett} vesztett a listában</span>
        <div className="ml-auto flex items-center gap-2">
          <select value={kimenet ?? ''} onChange={(e) => setKimenet((e.target.value || null) as Kimenet | null)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
            <option value="">Mind</option>
            {(Object.keys(KIMENET_FELIRAT) as Kimenet[]).map((k) => <option key={k} value={k}>{KIMENET_FELIRAT[k]}</option>)}
          </select>
          <input value={kereses} onChange={(e) => setKereses(e.target.value)} placeholder="Keresés…" className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-44" />
          {irhat && (
            <button type="button" onClick={() => setSzerkesztett('uj')} data-testid="uj-sajat-eredmeny"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Régi projekt / eredmény
            </button>
          )}
        </div>
      </div>
      {hianyzo && (hianyzo.tendersWithoutOutcome.length > 0 || hianyzo.outcomesWithoutPrice.length > 0) && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-900 space-y-1">
          <div className="font-medium">Hiányzó adatok — ezekkel lesz pontos az árazási támpont:</div>
          {hianyzo.tendersWithoutOutcome.slice(0, 5).map((t) => (
            <div key={t.tenderId} className="flex items-center gap-2">
              <span className="truncate">• {t.title} — {t.status === 'won' ? 'nyert' : 'vesztett'}, nincs rögzítve</span>
              {irhat && <button type="button" onClick={() => setPalyazatbol({ tenderId: t.tenderId, title: t.title })} className="underline shrink-0">rögzítés</button>}
            </div>
          ))}
          {hianyzo.outcomesWithoutPrice.slice(0, 5).map((o) => <div key={o.id} className="truncate">• {o.title} — hiányzik a saját ár</div>)}
        </div>
      )}
      <div className="px-4 divide-y divide-gray-100">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            Még nincs saját eredmény. Egy nyert / vesztett pályázat oldalpaneljén, vagy itt a „Régi projekt / eredmény” gombbal rögzíthetsz.
          </p>
        ) : items.map((e) => (
          <EredmenySor key={e.id} e={e} onSzerkeszt={irhat ? () => setSzerkesztett(e) : undefined} />
        ))}
      </div>
      {szerkesztett && (
        <SajatEredmenyAblak meglevo={szerkesztett === 'uj' ? null : szerkesztett}
          kotes={szerkesztett !== 'uj' && szerkesztett.tenderId ? { tenderId: szerkesztett.tenderId } : undefined}
          onBezar={() => setSzerkesztett(null)} onKesz={() => { setSzerkesztett(null); frissit(); }} />
      )}
      {palyazatbol && (
        <SajatEredmenyAblak kotes={{ tenderId: palyazatbol.tenderId }} alapCim={palyazatbol.title}
          onBezar={() => setPalyazatbol(null)} onKesz={() => { setPalyazatbol(null); frissit(); }} />
      )}
    </section>
  );
}

export type { Ajanlattevo };
