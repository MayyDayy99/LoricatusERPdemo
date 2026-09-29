'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import {
  ArrowRight, ExternalLink, Eye, Loader2, Pause, Play, Plus, RefreshCw, RotateCcw, Save, SlidersHorizontal,
  Star, Trash2, X,
} from 'lucide-react';

import {
  createWatchProfile, deleteWatchProfile, syncTenders, updateWatchProfile, useTenderWatchProfiles,
  type TenderWatchProfile,
} from '@/lib/hooks/use-tenders';
import {
  KOMPETENCIA_FELIRAT, SAV_FELIRAT, procurementApi, usePontozas, useProfilStatisztika,
  type PontozasElonezet, type PontozasiElteresek, type ProfilElonezet, type Sav, type Terulet, type TeruletElteres,
} from '@/lib/hooks/use-procurement';
import { INPUT, Mezo, PontJelveny, SAV_SZIN, datum } from './ui';

/**
 * ── FIGYELŐPROFILOK ÉS RELEVANCIA-PONTOZÁS ─────────────────────────────────
 *
 * Két kérdés, két rész:
 *   Profilok   — MIT hozzon le a rendszer (ország, CPV, kulcsszó) — élő
 *                előnézettel: hány TED-kiírás felelne meg, és milyen pontot kapna.
 *   Pontozás   — HOGYAN pontozza, amit lehozott: területenkénti súly, kulcsszavak,
 *                CPV-k, saját területek, csapda- és kizáró szavak, kiemelt és
 *                kizárt ajánlatkérők. Mentés előtt a hatás látszik.
 */

/** A nyilvános API-források: a kiírások forrás-kulcsa, az ország és az alap-URL. */
const API_FORRAS = {
  ekr: { nev: 'EKR — magyar nemzeti eljárások', kulcs: 'ekr', orszag: 'HU', url: 'https://ekr.gov.hu/portal/kozbeszerzes/hirdetmenyek' },
  anac: { nev: 'ANAC — olasz országos (Pubblicità a Valore Legale)', kulcs: 'anac', orszag: 'IT', url: 'https://pubblicitalegale.anticorruzione.it/api/v0/avvisi' },
  ocds_de: { nev: 'öffentlichevergabe.de — német országos (napi export)', kulcs: 'oeffentlichevergabe', orszag: 'DE', url: 'https://oeffentlichevergabe.de/api/notice-exports' },
  plone: { nev: 'Plone REST lista (pl. Intercent-ER)', kulcs: 'plone', orszag: 'IT', url: '' },
} as const;

const ORSZAGOK: Array<[string, string]> = [
  ['HU', 'Magyarország'], ['DE', 'Németország'], ['AT', 'Ausztria'], ['IT', 'Olaszország'], ['SK', 'Szlovákia'],
  ['RO', 'Románia'], ['HR', 'Horvátország'], ['SI', 'Szlovénia'], ['CZ', 'Csehország'], ['PL', 'Lengyelország'],
  ['FR', 'Franciaország'], ['NL', 'Hollandia'], ['BE', 'Belgium'], ['ES', 'Spanyolország'], ['PT', 'Portugália'],
  ['DK', 'Dánia'], ['SE', 'Svédország'], ['FI', 'Finnország'], ['NO', 'Norvégia'], ['BG', 'Bulgária'],
];

const CPV_JAVASLAT: Array<[string, string]> = [
  ['7135', 'Mérnöki felmérés, földmérés (7135x)'],
  ['71351', 'Geológiai, geofizikai felmérés'],
  ['71352', 'Felszín alatti felmérés'],
  ['71353', 'Felszíni felmérés'],
  ['71354', 'Térképészet'],
  ['713542', 'Légi fotogrammetria'],
  ['713543', 'Közműtérképezés'],
  ['71355', 'Földmérés'],
  ['71250', 'Építészeti, mérnöki és földmérési szolgáltatás'],
  ['38221', 'Térinformatikai rendszer (GIS)'],
  ['77231', 'Erdőgazdálkodás (fakataszter)'],
  ['71631', 'Műszaki ellenőrzés (pl. PV-hőkamera)'],
  ['90711', 'Környezeti hatásvizsgálat'],
  ['90712', 'Környezetvédelmi tervezés'],
  ['71241', 'Megvalósíthatósági tanulmány'],
];
const CPV_NEV = Object.fromEntries(CPV_JAVASLAT);

const TIPUS_FELIRAT: Record<string, string> = {
  ted: 'TED', rss: 'RSS', crawl: 'Weboldal (crawl4AI)', api: 'Nyilvános API', email: 'E-mail riasztások', http: 'HTTP / JSON', n8n_webhook: 'n8n',
};

const TIPUS_LEIRAS: Record<string, string> = {
  rss: 'Hivatalos RSS- vagy Atom-csatorna. A service.bund.de csatornájából az ajánlatkérőt, a helyszínt és a határidőt is kiolvassa.',
  crawl: 'Nyilvános lista-oldal, ahol nincs API vagy RSS (pl. olasz regionális platformok). A crawl4AI letölti az oldalt, és kiválogatja a kiírás-linkeket.',
  email: 'A belépéses portálok (SAP Ariba, E.ON, Mercell, DTVP, Oracle, Jaggaer…) e-mail riasztásai egy dedikált Microsoft 365 postafiókba — a levelekből kiírás lesz. A postafiókot a Beállítások → Integrációk → „Microsoft 365 értesítő-postafiók" alatt kell bekötni; a portálokon a riasztást erre a címre kell kérni.',
  api: 'Nyilvános hirdetmény-API: EKR (HU nemzeti felhívások és eredmények), ANAC (IT országos), öffentlichevergabe.de (DE országos, a küszöb alattiak és az eredmények is), Plone REST (pl. Intercent-ER).',
  http: 'JSON-lista (pl. egy n8n-folyamat kimenete): { items: [{ title, link, deadline, buyer, … }] }.',
};

function hoszt(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; }
}

export function Figyeles({ onTalalatok }: { onTalalatok: (profilId: string, nev: string) => void }) {
  const [resz, setResz] = useState<'profilok' | 'pontozas'>('profilok');
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5" role="tablist" aria-label="Figyelés">
        {([['profilok', 'Profilok — mit hozzon le'], ['pontozas', 'Relevancia-pontozás — hogyan pontozza']] as const).map(([k, f]) => (
          <button key={k} type="button" role="tab" aria-selected={resz === k} onClick={() => setResz(k)}
            className={clsx('px-3 py-1.5 rounded-md text-sm font-medium',
              resz === k ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50')}>
            {f}
          </button>
        ))}
      </div>
      {resz === 'profilok' ? <Profilok onTalalatok={onTalalatok} /> : <Pontozas />}
    </div>
  );
}

/* ══ PROFILOK ═════════════════════════════════════════════════════════════ */

function Profilok({ onTalalatok }: { onTalalatok: (profilId: string, nev: string) => void }) {
  const { profiles, mutate } = useTenderWatchProfiles();
  const { stat, mutate: mutateStat } = useProfilStatisztika();
  const [szerkesztett, setSzerkesztett] = useState<TenderWatchProfile | 'uj' | null>(null);
  const [fut, setFut] = useState<string | null>(null);
  const statja = (id: string) => stat.find((s) => s.id === id);

  async function futtat(p: TenderWatchProfile) {
    setFut(p.id);
    try {
      const r = await syncTenders(p.id);
      toast.success(`${p.name}: ${r.added} új kiírás. A pontozás pár másodperc múlva frissül.`);
      setTimeout(() => { mutate(); mutateStat(); }, 4000);
    } catch {
      toast.error('A futtatás nem sikerült.');
    } finally {
      setFut(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500 max-w-3xl">
          A figyelőprofil mondja meg, milyen kiírásokat hozzon le a rendszer a TED-ről (ország, CPV-kód, kulcsszó).
          Szerkesztés közben az <b>Előnézet</b> megmutatja, hány élő kiírás felelne meg, és milyen pontot kapnának.
          Az aktív profilok 12 óránként futnak.
        </p>
        <button type="button" onClick={() => setSzerkesztett('uj')}
          className="flex items-center gap-2 bg-brand-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-brand-700">
          <Plus className="w-4 h-4" /> Új figyelőprofil
        </button>
      </div>

      {profiles.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl p-6 text-center">Még nincs figyelőprofil.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {profiles.map((p) => {
            const s = statja(p.id);
            return (
              <section key={p.id} className={clsx('bg-white border rounded-xl p-4 space-y-3', p.isActive ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-80')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-1.5"><Star className="w-4 h-4 text-blue-600 shrink-0" /> {p.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {TIPUS_FELIRAT[p.sourceType ?? 'ted'] ?? (p.sourceType ?? 'ted').toUpperCase()}
                      {p.sourceUrl && (p.sourceType ?? 'ted') !== 'ted' && p.sourceType !== 'api' ? ` · ${hoszt(p.sourceUrl)}` : ''}
                      {p.isActive ? ' · aktív' : ' · szünetel'}
                      {p.lastRunAt ? ` · utoljára futott: ${datum(p.lastRunAt)}` : ' · még nem futott'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <IkonGomb cim={p.isActive ? 'Szüneteltetés' : 'Folytatás'} onClick={async () => {
                      try { await updateWatchProfile(p.id, { isActive: !p.isActive }); await mutate(); }
                      catch { toast.error('Nem sikerült módosítani.'); }
                    }}>{p.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</IkonGomb>
                    <IkonGomb cim="Szerkesztés" onClick={() => setSzerkesztett(p)}><SlidersHorizontal className="w-4 h-4" /></IkonGomb>
                    <IkonGomb cim="Törlés" veszely onClick={async () => {
                      if (!confirm(`Törlöd a „${p.name}" figyelőprofilt? A már lehozott kiírások megmaradnak.`)) return;
                      try { await deleteWatchProfile(p.id); await mutate(); mutateStat(); }
                      catch { toast.error('Nem sikerült törölni.'); }
                    }}><Trash2 className="w-4 h-4" /></IkonGomb>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  {!!p.countries?.length && (
                    <div className="flex flex-wrap gap-1">
                      {p.countries.map((c) => <span key={c} className="rounded bg-gray-100 text-gray-700 px-1.5 py-0.5">{c}</span>)}
                    </div>
                  )}
                  {!!p.cpvPrefixes?.length && (
                    <div className="flex flex-wrap gap-1">
                      {p.cpvPrefixes.map((c) => (
                        <span key={c} className="rounded bg-blue-50 text-blue-800 px-1.5 py-0.5" title={CPV_NEV[c] ?? ''}>
                          {c}{CPV_NEV[c] ? <span className="opacity-70"> · {CPV_NEV[c]}</span> : null}
                        </span>
                      ))}
                    </div>
                  )}
                  {!!p.keywords?.length && <div className="text-gray-600">Kulcsszavak: {p.keywords.join(', ')}</div>}
                </div>

                <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-gray-100">
                  {s ? (
                    <div className="flex items-center gap-1.5 flex-wrap text-xs text-gray-600">
                      <b className="text-gray-900 tabular-nums">{s.elo}</b> élő kiírás
                      <span className="text-gray-400">({s.osszes} összesen)</span>
                      {(['priority', 'qualified', 'review'] as Sav[]).map((sv) => s[sv] > 0 && (
                        <span key={sv} className={clsx('rounded px-1.5 py-0.5 font-medium tabular-nums', SAV_SZIN[sv])}>{s[sv]} {SAV_FELIRAT[sv]}</span>
                      ))}
                    </div>
                  ) : <span className="text-xs text-gray-400">…</span>}
                  <div className="ml-auto flex items-center gap-2">
                    {(p.sourceType ?? 'ted') !== 'n8n_webhook' && (
                      <button type="button" onClick={() => futtat(p)} disabled={fut === p.id}
                        className="inline-flex items-center gap-1.5 text-xs font-medium border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 disabled:opacity-50">
                        {fut === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Futtatás most
                      </button>
                    )}
                    <button type="button" onClick={() => onTalalatok(p.id, p.name)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                      Találatok <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {szerkesztett && (
        <ProfilSzerkeszto
          profil={szerkesztett === 'uj' ? null : szerkesztett}
          onBezar={() => setSzerkesztett(null)}
          onMentve={async () => { setSzerkesztett(null); await mutate(); mutateStat(); }}
        />
      )}
    </div>
  );
}

function IkonGomb({ cim, onClick, children, veszely }: { cim: string; onClick: () => void; children: React.ReactNode; veszely?: boolean }) {
  return (
    <button type="button" title={cim} aria-label={cim} onClick={onClick}
      className={clsx('p-1.5 rounded hover:bg-gray-100', veszely ? 'text-gray-400 hover:text-red-600' : 'text-gray-500')}>
      {children}
    </button>
  );
}

function ProfilSzerkeszto({ profil, onBezar, onMentve }: { profil: TenderWatchProfile | null; onBezar: () => void; onMentve: () => void }) {
  const { beallitas } = usePontozas();
  const cpvSulyok = beallitas?.elteresek?.cpvSulyok ?? {};
  const [nev, setNev] = useState(profil?.name ?? '');
  const [tipus, setTipus] = useState<string>(profil?.sourceType ?? 'ted');
  const [url, setUrl] = useState(profil?.sourceUrl ?? '');
  const [orszagok, setOrszagok] = useState<string[]>(profil?.countries?.length ? profil.countries : (profil ? [] : ['HU']));
  const [cpv, setCpv] = useState<string[]>(profil?.cpvPrefixes ?? []);
  const [ujCpv, setUjCpv] = useState('');
  const [kulcsszavak, setKulcsszavak] = useState((profil?.keywords ?? []).join(', '));
  const [cfg, setCfg] = useState<NonNullable<TenderWatchProfile['sourceConfig']>>(profil?.sourceConfig ?? { szures: 'relevans', reszletek: true });
  const [elonezet, setElonezet] = useState<ProfilElonezet | null>(null);
  const [tolt, setTolt] = useState(false);
  const [ment, setMent] = useState(false);
  const ted = tipus === 'ted';
  const lista = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
  const valt = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

  async function elonez() {
    setTolt(true);
    try {
      setElonezet(await procurementApi.profilElonezet(ted
        ? { countries: orszagok, cpvPrefixes: cpv, keywords: lista(kulcsszavak) }
        : { sourceType: tipus, sourceUrl: url.trim() || undefined, sourceConfig: forrasCfg(), keywords: lista(kulcsszavak) }));
    } catch (err: any) {
      toast.error(err?.response?.status === 429 ? 'Túl sok előnézet egymás után — várj egy percet.' : 'Az előnézet nem sikerült.');
    } finally {
      setTolt(false);
    }
  }

  // Meglévő profilnál azonnal megmutatjuk, mit hoz most.
  useEffect(() => { if (profil && (ted || tipus === 'rss' || tipus === 'api' || tipus === 'email')) void elonez(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  /** A nem-TED forrás beállítása a mentéshez / előnézethez. */
  function forrasCfg(): Record<string, unknown> {
    const orszag = cfg.orszag ?? orszagok[0];
    return {
      ...cfg,
      orszag,
      // A meglévő API-választást megtartjuk (egy ANAC-profil mentése ne váltson EKR-re).
      api: tipus === 'api' ? cfg.api ?? 'ekr' : undefined,
      forrasKulcs: cfg.forrasKulcs || (tipus === 'api' ? API_FORRAS[cfg.api ?? 'ekr'].kulcs : tipus === 'email' ? 'email_riasztas' : undefined),
      linkMinta: tipus === 'crawl' ? cfg.linkMinta || undefined : undefined,
      lapozasMinta: tipus === 'crawl' ? cfg.lapozasMinta || undefined : undefined,
      maxOldal: tipus === 'crawl' ? cfg.maxOldal : undefined,
    };
  }

  async function mentes() {
    if (!nev.trim()) { toast.error('Adj nevet a profilnak.'); return; }
    if (!ted && tipus !== 'api' && tipus !== 'email' && !url.trim()) { toast.error('Add meg a forrás URL-jét.'); return; }
    setMent(true);
    try {
      const adat = {
        name: nev.trim(), sourceType: tipus, sourceUrl: ted ? undefined : (url.trim() || (tipus === 'api' ? API_FORRAS[cfg.api ?? 'ekr'].url : undefined)),
        keywords: lista(kulcsszavak), cpvPrefixes: ted ? cpv : [],
        countries: ted ? orszagok : (cfg.orszag ? [cfg.orszag] : orszagok.slice(0, 1)),
        sourceConfig: ted ? null : forrasCfg(),
      };
      if (profil) await updateWatchProfile(profil.id, adat);
      else await createWatchProfile(adat);
      toast.success(profil ? 'Profil mentve.' : 'Profil létrehozva — a „Futtatás most” gombbal azonnal lehozhatod a kiírásait.');
      onMentve();
    } catch (err: any) {
      toast.error(err?.response?.status === 403 ? 'Profilt csak admin / vezető szerkeszthet.' : 'A mentés nem sikerült.');
    } finally {
      setMent(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onBezar}>
      <aside className="h-full w-full max-w-3xl bg-white shadow-xl overflow-y-auto" onClick={(e) => e.stopPropagation()} aria-label="Figyelőprofil szerkesztése">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between gap-3 z-10">
          <h2 className="text-base font-bold text-gray-900">{profil ? 'Figyelőprofil szerkesztése' : 'Új figyelőprofil'}</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={mentes} disabled={ment}
              className="inline-flex items-center gap-1.5 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
              {ment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Mentés
            </button>
            <button type="button" onClick={onBezar} aria-label="Bezárás" className="p-1.5 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Mezo cimke="Név"><input value={nev} onChange={(e) => setNev(e.target.value)} className={INPUT} placeholder="pl. Olasz önkormányzati GIS" /></Mezo>
            <Mezo cimke="Forrás">
              <select value={tipus} onChange={(e) => { setTipus(e.target.value); setElonezet(null); }} className={INPUT}>
                <option value="ted">TED (EU közbeszerzés)</option>
                <option value="api">Nyilvános API (EKR, ANAC, öffentlichevergabe.de…)</option>
                <option value="rss">RSS-csatorna (pl. service.bund.de)</option>
                <option value="crawl">Weboldal (crawl4AI)</option>
                <option value="email">E-mail riasztások (értesítő-postafiók)</option>
                <option value="http">HTTP / JSON (n8n)</option>
              </select>
            </Mezo>
          </div>

          {!ted && (
            <section className="rounded-xl border border-gray-200 p-4 space-y-3">
              <p className="text-xs text-gray-500">{TIPUS_LEIRAS[tipus]}</p>
              {tipus === 'api' && (
                <Mezo cimke="Melyik API">
                  <select value={cfg.api ?? 'ekr'} className={INPUT}
                    onChange={(e) => {
                      const api = e.target.value as keyof typeof API_FORRAS;
                      setCfg((c) => ({ ...c, api, forrasKulcs: API_FORRAS[api].kulcs, orszag: API_FORRAS[api].orszag }));
                      setUrl(API_FORRAS[api].url);
                    }}>
                    {(Object.keys(API_FORRAS) as Array<keyof typeof API_FORRAS>).map((k) => <option key={k} value={k}>{API_FORRAS[k].nev}</option>)}
                  </select>
                </Mezo>
              )}
              {tipus !== 'email' && (tipus !== 'api' || cfg.api === 'plone') && (
                <Mezo cimke={tipus === 'crawl' ? 'A lista-oldal címe (ahol a kiírások felsorolva vannak)' : 'Forrás URL'}>
                  <input value={url} onChange={(e) => setUrl(e.target.value)} className={INPUT} placeholder="https://…" />
                </Mezo>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Mezo cimke="Ország (ha a forrás nem mondja meg)">
                  <select value={cfg.orszag ?? (tipus === 'api' ? 'HU' : '')} onChange={(e) => setCfg((c) => ({ ...c, orszag: e.target.value || undefined }))} className={INPUT}>
                    <option value="">—</option>
                    {ORSZAGOK.map(([k, n]) => <option key={k} value={k}>{k} · {n}</option>)}
                  </select>
                </Mezo>
                <Mezo cimke="Mi kerüljön be?">
                  <select value={cfg.szures ?? 'relevans'} onChange={(e) => setCfg((c) => ({ ...c, szures: e.target.value as 'relevans' | 'mind' }))} className={INPUT}>
                    <option value="relevans">Csak ami a Loricatus-területekre illik (ajánlott)</option>
                    <option value="mind">Minden tétel</option>
                  </select>
                </Mezo>
              </div>
              {tipus === 'crawl' && (
                <>
                  <Mezo cimke="Linkminta — a kiírások linkjeire illő reguláris kifejezés (nem kötelező, de pontosabb)">
                    <input value={cfg.linkMinta ?? ''} onChange={(e) => setCfg((c) => ({ ...c, linkMinta: e.target.value }))} className={`${INPUT} font-mono text-xs`}
                      placeholder="pl. /sourcing/tenders/resume/id/\d+" />
                  </Mezo>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <Mezo cimke="Lapozás — a további lista-oldalak címe, {n} az oldalszám (nem kötelező)">
                      <input value={cfg.lapozasMinta ?? ''} onChange={(e) => setCfg((c) => ({ ...c, lapozasMinta: e.target.value || undefined }))}
                        className={`${INPUT} font-mono text-xs`} placeholder="pl. https://start.toscana.it/initiatives/list/page/{n}" />
                    </Mezo>
                    <Mezo cimke="Oldalak száma">
                      <input type="number" min={1} max={10} value={cfg.maxOldal ?? 1} onChange={(e) => setCfg((c) => ({ ...c, maxOldal: Number(e.target.value) || 1 }))}
                        className={`${INPUT} w-24`} />
                    </Mezo>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={cfg.reszletek !== false} onChange={(e) => setCfg((c) => ({ ...c, reszletek: e.target.checked }))} />
                    A kiírások saját oldalát is letölti (leírás, határidő) — futásonként legfeljebb
                    <input type="number" min={1} max={50} value={cfg.maxReszlet ?? 15} onChange={(e) => setCfg((c) => ({ ...c, maxReszlet: Number(e.target.value) || 15 }))}
                      className="w-16 px-2 py-0.5 border border-gray-300 rounded text-sm" /> darabot
                  </label>
                  <p className="text-[11px] text-gray-400">A crawl4AI a robots.txt-t betartja: ahol a webhely tiltja, nem tölt le semmit. Belépést igénylő oldalt nem tud olvasni.</p>
                </>
              )}
            </section>
          )}

          {ted && (
            <>
              <div>
                <div className="text-xs font-medium text-gray-600 mb-1.5">Országok <span className="font-normal text-gray-400">(az ajánlatkérő országa)</span></div>
                <div className="flex flex-wrap gap-1.5">
                  {ORSZAGOK.map(([k, n]) => (
                    <button key={k} type="button" aria-pressed={orszagok.includes(k)} onClick={() => setOrszagok((xs) => valt(xs, k))}
                      className={clsx('text-xs rounded-full px-2.5 py-1 border',
                        orszagok.includes(k) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}>
                      {k} · {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-gray-600 mb-1.5">
                  CPV-kódok <span className="font-normal text-gray-400">(előtag: a „7135” minden 7135x kódot lefed · a súlyuk a
                  Relevancia-pontozás fül CPV-preferenciamátrixában állítható)</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[...CPV_JAVASLAT, ...cpv.filter((c) => !CPV_NEV[c]).map((c) => [c, 'saját'] as [string, string])].map(([k, n]) => (
                    <button key={k} type="button" aria-pressed={cpv.includes(k)} onClick={() => setCpv((xs) => valt(xs, k))}
                      className={clsx('text-xs rounded-full px-2.5 py-1 border',
                        cpv.includes(k) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}>
                      <b className="tabular-nums">{k}</b> · {n}
                      {cpvSulyok[k] !== undefined && (
                        <span className={clsx('ml-1.5 rounded px-1 text-[10px] font-semibold',
                          cpv.includes(k) ? 'bg-white/25' : 'bg-gray-100 text-gray-600')} title="CPV-súly (Relevancia-pontozás fül)">
                          {SZINT_NEV(cpvSulyok[k])} {cpvSulyok[k]}
                        </span>
                      )}
                    </button>
                  ))}
                  <span className="inline-flex items-center gap-1">
                    <input value={ujCpv} onChange={(e) => setUjCpv(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="további kód"
                      className="w-28 px-2 py-1 border border-gray-300 rounded-full text-xs"
                      onKeyDown={(e) => { if (e.key === 'Enter' && ujCpv.length >= 2) { setCpv((xs) => [...new Set([...xs, ujCpv])]); setUjCpv(''); } }} />
                    <button type="button" disabled={ujCpv.length < 2} onClick={() => { setCpv((xs) => [...new Set([...xs, ujCpv])]); setUjCpv(''); }}
                      className="p-1 rounded-full border border-gray-200 hover:bg-gray-50 disabled:opacity-40" aria-label="CPV hozzáadása"><Plus className="w-3.5 h-3.5" /></button>
                  </span>
                </div>
              </div>
            </>
          )}

          <Mezo cimke="Kulcsszavak — vesszővel (nem kötelező; szűkít: csak az jön, amiben valamelyik szerepel)">
            <input value={kulcsszavak} onChange={(e) => setKulcsszavak(e.target.value)} className={INPUT} placeholder="pl. catasto, GIS, rilievo" />
          </Mezo>

          {(
            <section className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-gray-900">Mit hozna ez a profil most?</h3>
                <button type="button" onClick={elonez} disabled={tolt}
                  className="inline-flex items-center gap-1.5 text-sm font-medium border border-gray-300 bg-white rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">
                  {tolt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} Előnézet
                </button>
              </div>
              {!elonezet ? (
                <p className="text-xs text-gray-500">Állítsd be az országokat és a CPV-ket, majd nyomd meg az Előnézetet: a TED-ről élőben megnézzük, hány kiírás felelne meg, és a cég pontozásával mennyit érnének.</p>
              ) : !elonezet.elerheto ? (
                <p className="text-xs text-red-700">{elonezet.hiba ?? 'A TED most nem válaszolt — próbáld újra pár perc múlva.'}</p>
              ) : (
                <>
                  {!ted && (
                    <p className="text-sm text-gray-700">
                      A forrásban most <b className="tabular-nums">{elonezet.osszes}</b> tétel van; ebből <b className="tabular-nums">{elonezet.relevans ?? 0}</b> kerülne be
                      {elonezet.kiszurve ? <span className="text-gray-500"> ({elonezet.kiszurve} nem illik a Loricatus-területekre — kiszűrve)</span> : null}.
                      {elonezet.megjegyzes && <span className="block text-xs text-gray-500 mt-0.5">{elonezet.megjegyzes}</span>}
                    </p>
                  )}
                  <div className={clsx('flex items-center gap-2 flex-wrap text-sm', !ted && 'hidden')}>
                    <b className="text-gray-900 text-lg tabular-nums">{elonezet.osszes.toLocaleString('hu-HU')}</b>
                    <span className="text-gray-600">élő TED-kiírás felel meg.</span>
                    {!!elonezet.mintaMerete && (
                      <span className="text-xs text-gray-500">
                        Az első {elonezet.mintaMerete} pontozva:
                        {elonezet.savok.map((s) => (
                          <span key={s.sav} className={clsx('ml-1 rounded px-1.5 py-0.5 font-medium tabular-nums', SAV_SZIN[s.sav])}>{s.db} {SAV_FELIRAT[s.sav]}</span>
                        ))}
                      </span>
                    )}
                  </div>
                  {ted && elonezet.osszes > 1500 && (
                    <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
                      Ez sok — a lista nagy része valószínűleg Archive lesz. Szűkíts CPV-kóddal vagy kulcsszóval.
                    </p>
                  )}
                  <ul className="divide-y divide-gray-100 bg-white rounded-lg border border-gray-100">
                    {elonezet.minta.map((m, i) => (
                      <li key={i} className="px-3 py-2 flex items-start gap-2 text-sm">
                        <PontJelveny score={m.pont} tier={m.sav} />
                        <div className="min-w-0 flex-1">
                          <div className="text-gray-900 line-clamp-2">{m.cim}</div>
                          <div className="text-xs text-gray-500">
                            {[m.ajanlatkero, m.orszag, m.hatarido ? `határidő ${datum(m.hatarido)}` : null].filter(Boolean).join(' · ')}
                            {m.kompetenciak.length > 0 && <> · {m.kompetenciak.map((k) => KOMPETENCIA_FELIRAT[k] ?? k).join(', ')}</>}
                          </div>
                        </div>
                        {m.url && <a href={m.url} target="_blank" rel="noopener noreferrer" className="p-1 text-gray-400 hover:text-gray-700" title="Hirdetmény"><ExternalLink className="w-3.5 h-3.5" /></a>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ══ RELEVANCIA-PONTOZÁS ══════════════════════════════════════════════════ */

const MOD_FELIRAT: Record<string, string> = { to: 'szótő', egesz: 'egész szó', belul: 'szón belül' };

function szoMod(kw: string): { szo: string; mod: 'to' | 'egesz' | 'belul' } {
  if (kw.startsWith('=')) return { szo: kw.slice(1), mod: 'egesz' };
  if (kw.startsWith('~')) return { szo: kw.slice(1), mod: 'belul' };
  return { szo: kw, mod: 'to' };
}

function klon<T>(x: T): T { return JSON.parse(JSON.stringify(x ?? {})); }

function Pontozas() {
  const { beallitas, isLoading, mutate } = usePontozas();
  const [piszkozat, setPiszkozat] = useState<PontozasiElteresek>({});
  const [elonezet, setElonezet] = useState<PontozasElonezet | null>(null);
  const [probaCim, setProbaCim] = useState('');
  const [szamol, setSzamol] = useState(false);
  const [ment, setMent] = useState(false);
  const [nyitott, setNyitott] = useState<string | null>(null);
  const idozito = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (beallitas) setPiszkozat(klon(beallitas.elteresek)); }, [beallitas]);

  const valtozott = useMemo(
    () => !!beallitas && JSON.stringify(piszkozat) !== JSON.stringify(beallitas.elteresek ?? {}),
    [piszkozat, beallitas],
  );

  async function szamolj(p = piszkozat, cim = probaCim) {
    setSzamol(true);
    try {
      setElonezet(await procurementApi.pontozasElonezet({ elteresek: p, probaCim: cim || undefined }));
    } catch {
      toast.error('A hatás kiszámítása nem sikerült.');
    } finally {
      setSzamol(false);
    }
  }

  // Minden módosítás után (kis késleltetéssel) újraszámoljuk a hatást.
  function modosit(f: (p: PontozasiElteresek) => void) {
    setPiszkozat((regi) => {
      const uj = klon(regi);
      f(uj);
      if (idozito.current) clearTimeout(idozito.current);
      idozito.current = setTimeout(() => void szamolj(uj), 700);
      return uj;
    });
  }

  useEffect(() => {
    if (!beallitas) return;
    if (idozito.current) clearTimeout(idozito.current);
    idozito.current = setTimeout(() => void szamolj(piszkozat, probaCim), probaCim ? 600 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probaCim, beallitas]);

  async function mentes(elteresek: PontozasiElteresek | null) {
    setMent(true);
    try {
      await procurementApi.pontozasMentes(elteresek);
      toast.success('Pontozás mentve. A kiírások szabály szerinti pontja a háttérben újraszámolódik (pár másodperc – egy perc).');
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.status === 403 ? 'A pontozást csak admin / vezető állíthatja.' : 'A mentés nem sikerült.');
    } finally {
      setMent(false);
    }
  }

  if (isLoading || !beallitas) return <div className="flex items-center justify-center h-40"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>;
  const a = beallitas.alap;

  const komp = (k: string): TeruletElteres => piszkozat.kompetenciak?.[k] ?? {};
  const kompModosit = (k: string, f: (x: TeruletElteres) => void) => modosit((p) => {
    p.kompetenciak = p.kompetenciak ?? {};
    const x = p.kompetenciak[k] ?? {};
    f(x);
    for (const m of ['pluszSzavak', 'torolSzavak', 'pluszCpv', 'torolCpv'] as const) if (x[m] && !x[m]!.length) delete x[m];
    if (Object.keys(x).length) p.kompetenciak[k] = x; else delete p.kompetenciak[k];
    if (!Object.keys(p.kompetenciak).length) delete p.kompetenciak;
  });

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-gray-50/95 backdrop-blur flex items-center gap-2 flex-wrap">
        <p className="text-sm text-gray-600 flex-1 min-w-[240px]">
          {valtozott ? <b className="text-amber-700">Nem mentett változtatás.</b> : 'A mentett beállítás él.'}{' '}
          <span className="text-gray-400">
            {beallitas.modositva ? `Utoljára: ${datum(beallitas.modositva)}${beallitas.modositotta ? `, ${beallitas.modositotta}` : ''}.` : 'Az alap Loricatus-pontozás él.'}
          </span>
        </p>
        <button type="button" disabled={!valtozott || ment} onClick={() => { setPiszkozat(klon(beallitas.elteresek)); void szamolj(klon(beallitas.elteresek)); }}
          className="inline-flex items-center gap-1.5 text-sm border border-gray-300 bg-white rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40">Elvetés</button>
        <button type="button" disabled={ment || (!Object.keys(beallitas.elteresek ?? {}).length && !Object.keys(piszkozat).length)}
          onClick={() => { if (confirm('Visszaállítod az alap Loricatus-pontozást? Minden egyéni beállítás törlődik.')) void mentes(null); }}
          className="inline-flex items-center gap-1.5 text-sm border border-gray-300 bg-white rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40">
          <RotateCcw className="w-4 h-4" /> Alapra
        </button>
        <button type="button" disabled={!valtozott || ment} onClick={() => void mentes(piszkozat)}
          className="inline-flex items-center gap-1.5 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
          {ment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Mentés
          {elonezet && valtozott ? ` (${elonezet.valtozott} kiírás pontja változik)` : ''}
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] items-start">
        <div className="space-y-4 min-w-0">
          <section className="bg-white border border-gray-200 rounded-xl">
            <h3 className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Területek és súlyok</h3>
            <p className="px-4 pt-3 text-xs text-gray-500">
              A kiírás a legerősebb illeszkedő terület súlyát kapja teljesen, a másodikét 70%-ban, a többiét 40%-ban (alap 20 pont).
              Kulcsszó vagy CPV-kód jelzi az illeszkedést. Az alap szavak elvehetők, újak hozzáadhatók.
            </p>
            <ul className="divide-y divide-gray-100 mt-2">
              {a.kompetenciak.map((k) => (
                <TeruletSor key={k.kulcs} alap={k} elteres={komp(k.kulcs)} nyitva={nyitott === k.kulcs}
                  onNyit={() => setNyitott(nyitott === k.kulcs ? null : k.kulcs)}
                  onValt={(f) => kompModosit(k.kulcs, f)} />
              ))}
              {(piszkozat.sajatKompetenciak ?? []).map((s, i) => (
                <SajatTeruletSor key={i} terulet={s} nyitva={nyitott === `s${i}`} onNyit={() => setNyitott(nyitott === `s${i}` ? null : `s${i}`)}
                  onValt={(f) => modosit((p) => { f(p.sajatKompetenciak![i]); })}
                  onTorol={() => modosit((p) => { p.sajatKompetenciak!.splice(i, 1); if (!p.sajatKompetenciak!.length) delete p.sajatKompetenciak; })} />
              ))}
            </ul>
            <div className="px-4 py-3 border-t border-gray-100">
              <button type="button" onClick={() => {
                const nev = prompt('Az új terület neve (pl. „Épületenergetika”):')?.trim();
                if (!nev) return;
                if (a.kompetenciak.some((k) => k.kulcs === nev || k.nev === nev)) { toast.error('Ilyen nevű terület már van.'); return; }
                modosit((p) => { p.sajatKompetenciak = [...(p.sajatKompetenciak ?? []), { kulcs: nev, nev, suly: 20, aktiv: true, kulcsszavak: [], cpv: [] }]; });
                setNyitott(`s${(piszkozat.sajatKompetenciak ?? []).length}`);
              }} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
                <Plus className="w-4 h-4" /> Saját terület hozzáadása
              </button>
            </div>
          </section>

          <CpvMatrix
            sulyok={piszkozat.cpvSulyok ?? {}}
            arany={piszkozat.cpvArany ?? a.cpvArany}
            onArany={(v) => modosit((p) => { if (v === a.cpvArany) delete p.cpvArany; else p.cpvArany = v; })}
            onSuly={(kod, v) => modosit((p) => {
              const s = { ...(p.cpvSulyok ?? {}) };
              if (v === null) delete s[kod]; else s[kod] = v;
              if (Object.keys(s).length) p.cpvSulyok = s; else delete p.cpvSulyok;
            })}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <SzolistaKartya cim="Csapdaszavak" leiras="Ha a CÍMBEN ilyen szó van (és felmérési szó nincs), a kiírás legfeljebb a plafonig kap pontot — pl. fenntartás, kivitelezés."
              alap={a.csapdaSzavak} elteres={piszkozat.csapdaSzavak} plafon={piszkozat.csapdaPlafon ?? a.csapdaPlafon}
              onPlafon={(v) => modosit((p) => { if (v === a.csapdaPlafon) delete p.csapdaPlafon; else p.csapdaPlafon = v; })}
              onValt={(e) => modosit((p) => { if (e) p.csapdaSzavak = e; else delete p.csapdaSzavak; })} />
            <SzolistaKartya cim="Kizáró szavak" leiras="Ha a kiírás BÁRHOL ilyen szót tartalmaz, legfeljebb a plafonig kap pontot — pl. amire nem indulhatunk."
              alap={a.kizaroSzavak} elteres={piszkozat.kizaroSzavak} plafon={piszkozat.kizaroPlafon ?? a.kizaroPlafon}
              onPlafon={(v) => modosit((p) => { if (v === a.kizaroPlafon) delete p.kizaroPlafon; else p.kizaroPlafon = v; })}
              onValt={(e) => modosit((p) => { if (e) p.kizaroSzavak = e; else delete p.kizaroSzavak; })} />
            <AjanlatkeroKartya cim="Kiemelt ajánlatkérők" leiras="Stratégiai ügyfél: ha illeszkedő kiírást ír ki, pluszpontot kap. Elég a név egy jellegzetes része."
              lista={piszkozat.kiemeltAjanlatkerok ?? []} pont={piszkozat.kiemeltPont ?? a.kiemeltPont} pontCimke="pluszpont"
              onPont={(v) => modosit((p) => { if (v === a.kiemeltPont) delete p.kiemeltPont; else p.kiemeltPont = v; })}
              onValt={(xs) => modosit((p) => { if (xs.length) p.kiemeltAjanlatkerok = xs; else delete p.kiemeltAjanlatkerok; })} />
            <AjanlatkeroKartya cim="Kizárt ajánlatkérők" leiras={`Akikkel nem dolgozunk: legfeljebb ${a.kizartPlafon} pont.`}
              lista={piszkozat.kizartAjanlatkerok ?? []}
              onValt={(xs) => modosit((p) => { if (xs.length) p.kizartAjanlatkerok = xs; else delete p.kizartAjanlatkerok; })} />
            <section className="bg-white border border-violet-200 rounded-xl p-4 space-y-2 md:col-span-2" data-testid="alv-beallitas">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <input type="checkbox" checked={piszkozat.alvallalkozoiBe ?? a.alvallalkozoiBe}
                    onChange={(e) => modosit((p) => { if (e.target.checked === a.alvallalkozoiBe) delete p.alvallalkozoiBe; else p.alvallalkozoiBe = e.target.checked; })} />
                  Alvállalkozói lehetőség
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 ml-auto">
                  pont:
                  <input type="number" min={0} max={100} value={piszkozat.alvallalkozoiPont ?? a.alvallalkozoiPont}
                    disabled={!(piszkozat.alvallalkozoiBe ?? a.alvallalkozoiBe)}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      modosit((p) => { if (v === a.alvallalkozoiPont) delete p.alvallalkozoiPont; else p.alvallalkozoiPont = v; });
                    }}
                    className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm" />
                </label>
              </div>
              <p className="text-xs text-gray-500">
                Tervezési / kivitelezési fővállalkozói munka vasúton, hídon, úton, állomáson, épületen (pl. „Veszprém állomás
                átépítésének tervezése", „Ersatzneubau der Brücke", „progettazione del ponte") — magunk nem indulnánk, de a
                nyertesnek felmérés kellhet. Bekapcsolva ezek nem esnek ki, hanem „Alvállalkozói lehetőség" címkét és legalább
                ennyi pontot kapnak (50–69: Review); a Opportunityk listában külön szűrhetők.
              </p>
            </section>
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-14">
          <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Próba</h3>
            <input value={probaCim} onChange={(e) => setProbaCim(e.target.value)} className={INPUT}
              placeholder="Írj be egy kiírás-címet, pl. „Catasto del verde e censimento arboreo”" />
            {elonezet?.proba && (
              <div className="flex items-start gap-2 text-xs text-gray-600">
                <PontJelveny score={elonezet.proba.pont} tier={elonezet.proba.sav} />
                <span>{elonezet.proba.indoklas}</span>
              </div>
            )}
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Hatás az élő kiírásokra</h3>
              {szamol && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            </div>
            {!elonezet ? <p className="text-xs text-gray-400">Számolás…</p> : (
              <>
                <SavSav cim="Most" savok={elonezet.elotte} osszes={elonezet.kiirasok} />
                <SavSav cim="Módosítva" savok={elonezet.utana} osszes={elonezet.kiirasok} />
                <p className="text-xs text-gray-600">
                  {elonezet.kiirasok} élő kiírásból <b>{elonezet.valtozott}</b> pontja változna, <b>{elonezet.savValtas}</b> kerülne másik sávba.
                  <span className="block text-gray-400 mt-0.5">Az AI, Claude vagy ember által pontozott kiírások nem változnak.</span>
                </p>
                {elonezet.legnagyobbValtozasok.length > 0 && (
                  <ul className="divide-y divide-gray-100 max-h-80 overflow-auto -mx-1">
                    {elonezet.legnagyobbValtozasok.map((v) => (
                      <li key={v.id} className="px-1 py-1.5 flex items-center gap-2 text-xs" title={v.indoklas}>
                        <span className="tabular-nums text-gray-500 w-6 text-right">{v.elotte}</span>
                        <ArrowRight className="w-3 h-3 text-gray-300" />
                        <span className={clsx('tabular-nums font-semibold w-6', v.utana > v.elotte ? 'text-emerald-700' : 'text-red-600')}>{v.utana}</span>
                        <span className="flex-1 min-w-0 truncate text-gray-700">{v.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function SavSav({ cim, savok, osszes }: { cim: string; savok: Array<{ sav: Sav; db: number }>; osszes: number }) {
  const SZIN: Record<Sav, string> = { priority: 'bg-green-600', qualified: 'bg-emerald-300', review: 'bg-amber-300', archive: 'bg-gray-200' };
  return (
    <div>
      <div className="flex justify-between text-[11px] text-gray-500 mb-0.5">
        <span>{cim}</span>
        <span className="tabular-nums">{savok.filter((s) => s.sav !== 'archive').map((s) => `${s.db} ${SAV_FELIRAT[s.sav]}`).join(' · ')}</span>
      </div>
      <div className="flex h-2.5 rounded overflow-hidden bg-gray-100">
        {savok.map((s) => <span key={s.sav} className={SZIN[s.sav]} style={{ width: `${osszes ? (s.db / osszes) * 100 : 0}%` }} title={`${SAV_FELIRAT[s.sav]}: ${s.db}`} />)}
      </div>
    </div>
  );
}

function SzoChip({ kw, allapot, onClick }: { kw: string; allapot: 'alap' | 'uj' | 'torolt'; onClick: () => void }) {
  const { szo, mod } = szoMod(kw);
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border',
      allapot === 'uj' ? 'bg-blue-50 border-blue-200 text-blue-800'
        : allapot === 'torolt' ? 'bg-white border-dashed border-gray-300 text-gray-400 line-through'
          : 'bg-gray-50 border-gray-200 text-gray-700')}>
      {szo}{mod !== 'to' && <span className="text-[10px] opacity-60 no-underline">({MOD_FELIRAT[mod]})</span>}
      <button type="button" onClick={onClick} aria-label={allapot === 'torolt' ? `${szo} visszaállítása` : `${szo} eltávolítása`}
        className="opacity-60 hover:opacity-100">
        {allapot === 'torolt' ? <RotateCcw className="w-3 h-3" /> : <X className="w-3 h-3" />}
      </button>
    </span>
  );
}

function SzoHozzaado({ onAdd, cpv, csakSzo }: { onAdd: (kw: string) => void; cpv?: boolean; csakSzo?: boolean }) {
  const [szo, setSzo] = useState('');
  const [mod, setMod] = useState<'to' | 'egesz' | 'belul'>('to');
  const add = () => {
    const s = cpv ? szo.replace(/\D/g, '') : szo.trim();
    if (s.length < 2) return;
    onAdd(cpv ? s : mod === 'egesz' ? `=${s}` : mod === 'belul' ? `~${s}` : s);
    setSzo('');
  };
  return (
    <span className="inline-flex items-center gap-1">
      <input value={szo} onChange={(e) => setSzo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        placeholder={cpv ? 'CPV-előtag' : 'új kulcsszó'} className="w-32 px-2 py-0.5 border border-gray-300 rounded-full text-xs" />
      {!cpv && !csakSzo && (
        <select value={mod} onChange={(e) => setMod(e.target.value as typeof mod)} aria-label="Egyezés módja"
          className="px-1.5 py-0.5 border border-gray-300 rounded-full text-xs bg-white" title="szótő: a szó eleje egyezzen (ragozva is); egész szó: pontosan; szón belül: összetett szó közepén is">
          <option value="to">szótő</option><option value="egesz">egész szó</option><option value="belul">szón belül</option>
        </select>
      )}
      <button type="button" onClick={add} aria-label="Hozzáadás" className="p-0.5 rounded-full border border-gray-200 hover:bg-gray-50"><Plus className="w-3.5 h-3.5" /></button>
    </span>
  );
}

function SulyCsuszka({ ertek, alap, onValt }: { ertek: number; alap?: number; onValt: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-2">
      <input type="range" min={0} max={50} value={ertek} onChange={(e) => onValt(Number(e.target.value))} className="w-28 accent-brand-600" aria-label="Súly" />
      <span className={clsx('tabular-nums text-sm w-7 text-right font-semibold', alap !== undefined && ertek !== alap ? 'text-brand-700' : 'text-gray-800')}>{ertek}</span>
    </span>
  );
}

function TeruletSor({ alap, elteres, nyitva, onNyit, onValt }: {
  alap: Terulet; elteres: TeruletElteres; nyitva: boolean; onNyit: () => void; onValt: (f: (x: TeruletElteres) => void) => void;
}) {
  const aktiv = elteres.aktiv !== false;
  const suly = elteres.suly ?? alap.suly;
  const torolt = new Set(elteres.torolSzavak ?? []);
  const toroltCpv = new Set(elteres.torolCpv ?? []);
  const modosult = Object.keys(elteres).length > 0;
  return (
    <li className={clsx('px-4 py-2.5', !aktiv && 'bg-gray-50')}>
      <div className="flex items-center gap-3 flex-wrap">
        <label className="inline-flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
          <input type="checkbox" checked={aktiv} onChange={(e) => onValt((x) => { if (e.target.checked) delete x.aktiv; else x.aktiv = false; })} />
          <span className={clsx('text-sm font-medium truncate', aktiv ? 'text-gray-900' : 'text-gray-400 line-through')}>{alap.nev}</span>
          {modosult && <span className="text-[10px] uppercase tracking-wide text-brand-700 bg-brand-50 rounded px-1.5 py-0.5">módosítva</span>}
        </label>
        <SulyCsuszka ertek={suly} alap={alap.suly} onValt={(v) => onValt((x) => { if (v === alap.suly) delete x.suly; else x.suly = v; })} />
        <button type="button" onClick={onNyit} className="text-xs text-brand-700 hover:underline w-24 text-right">
          {nyitva ? 'Bezárás' : `${alap.kulcsszavak.length - torolt.size + (elteres.pluszSzavak?.length ?? 0)} szó, ${alap.cpv.length - toroltCpv.size + (elteres.pluszCpv?.length ?? 0)} CPV`}
        </button>
      </div>
      {nyitva && (
        <div className="mt-2 space-y-2 pl-6">
          <div className="flex flex-wrap gap-1 items-center">
            {alap.kulcsszavak.map((kw) => (
              <SzoChip key={kw} kw={kw} allapot={torolt.has(kw) ? 'torolt' : 'alap'}
                onClick={() => onValt((x) => { const t = new Set(x.torolSzavak ?? []); if (t.has(kw)) t.delete(kw); else t.add(kw); x.torolSzavak = [...t]; })} />
            ))}
            {(elteres.pluszSzavak ?? []).map((kw) => (
              <SzoChip key={`+${kw}`} kw={kw} allapot="uj" onClick={() => onValt((x) => { x.pluszSzavak = (x.pluszSzavak ?? []).filter((y) => y !== kw); })} />
            ))}
            <SzoHozzaado onAdd={(kw) => onValt((x) => { x.pluszSzavak = [...new Set([...(x.pluszSzavak ?? []), kw])]; })} />
          </div>
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-[11px] text-gray-400 mr-1">CPV:</span>
            {alap.cpv.map((c) => (
              <SzoChip key={c} kw={c} allapot={toroltCpv.has(c) ? 'torolt' : 'alap'}
                onClick={() => onValt((x) => { const t = new Set(x.torolCpv ?? []); if (t.has(c)) t.delete(c); else t.add(c); x.torolCpv = [...t]; })} />
            ))}
            {(elteres.pluszCpv ?? []).map((c) => (
              <SzoChip key={`+${c}`} kw={c} allapot="uj" onClick={() => onValt((x) => { x.pluszCpv = (x.pluszCpv ?? []).filter((y) => y !== c); })} />
            ))}
            <SzoHozzaado cpv onAdd={(c) => onValt((x) => { x.pluszCpv = [...new Set([...(x.pluszCpv ?? []), c])]; })} />
          </div>
        </div>
      )}
    </li>
  );
}

function SajatTeruletSor({ terulet, nyitva, onNyit, onValt, onTorol }: {
  terulet: NonNullable<PontozasiElteresek['sajatKompetenciak']>[number]; nyitva: boolean; onNyit: () => void;
  onValt: (f: (x: NonNullable<PontozasiElteresek['sajatKompetenciak']>[number]) => void) => void; onTorol: () => void;
}) {
  const aktiv = terulet.aktiv !== false;
  return (
    <li className={clsx('px-4 py-2.5 bg-blue-50/30', !aktiv && 'opacity-70')}>
      <div className="flex items-center gap-3 flex-wrap">
        <label className="inline-flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
          <input type="checkbox" checked={aktiv} onChange={(e) => onValt((x) => { x.aktiv = e.target.checked; })} />
          <span className="text-sm font-medium text-gray-900 truncate">{terulet.nev}</span>
          <span className="text-[10px] uppercase tracking-wide text-blue-800 bg-blue-100 rounded px-1.5 py-0.5">saját</span>
        </label>
        <SulyCsuszka ertek={terulet.suly} onValt={(v) => onValt((x) => { x.suly = v; })} />
        <button type="button" onClick={onNyit} className="text-xs text-brand-700 hover:underline w-24 text-right">
          {nyitva ? 'Bezárás' : `${terulet.kulcsszavak.length} szó, ${terulet.cpv.length} CPV`}
        </button>
        <IkonGomb cim="Terület törlése" veszely onClick={onTorol}><Trash2 className="w-4 h-4" /></IkonGomb>
      </div>
      {(nyitva || terulet.kulcsszavak.length === 0) && (
        <div className="mt-2 space-y-2 pl-6">
          {terulet.kulcsszavak.length === 0 && <p className="text-xs text-amber-700">Adj meg legalább egy kulcsszót vagy CPV-t — enélkül a terület semmire nem illeszkedik.</p>}
          <div className="flex flex-wrap gap-1 items-center">
            {terulet.kulcsszavak.map((kw) => (
              <SzoChip key={kw} kw={kw} allapot="uj" onClick={() => onValt((x) => { x.kulcsszavak = x.kulcsszavak.filter((y) => y !== kw); })} />
            ))}
            <SzoHozzaado onAdd={(kw) => onValt((x) => { x.kulcsszavak = [...new Set([...x.kulcsszavak, kw])]; })} />
          </div>
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-[11px] text-gray-400 mr-1">CPV:</span>
            {terulet.cpv.map((c) => (
              <SzoChip key={c} kw={c} allapot="uj" onClick={() => onValt((x) => { x.cpv = x.cpv.filter((y) => y !== c); })} />
            ))}
            <SzoHozzaado cpv onAdd={(c) => onValt((x) => { x.cpv = [...new Set([...x.cpv, c])]; })} />
          </div>
        </div>
      )}
    </li>
  );
}

function SzolistaKartya({ cim, leiras, alap, elteres, plafon, onPlafon, onValt }: {
  cim: string; leiras: string; alap: string[]; elteres?: { plusz?: string[]; torol?: string[] }; plafon: number;
  onPlafon: (v: number) => void; onValt: (e: { plusz?: string[]; torol?: string[] } | undefined) => void;
}) {
  const torol = new Set(elteres?.torol ?? []);
  const plusz = elteres?.plusz ?? [];
  const ment = (t: Set<string>, p: string[]) => onValt(t.size || p.length ? { plusz: p, torol: [...t] } : undefined);
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{cim}</h3>
        <label className="text-xs text-gray-600 inline-flex items-center gap-1.5">
          plafon
          <input type="number" min={0} max={100} value={plafon} onChange={(e) => onPlafon(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            className="w-16 px-2 py-0.5 border border-gray-300 rounded text-sm tabular-nums" />
        </label>
      </div>
      <p className="text-xs text-gray-500">{leiras}</p>
      <div className="flex flex-wrap gap-1 items-center">
        {alap.map((kw) => (
          <SzoChip key={kw} kw={kw} allapot={torol.has(kw) ? 'torolt' : 'alap'}
            onClick={() => { const t = new Set(torol); if (t.has(kw)) t.delete(kw); else t.add(kw); ment(t, plusz); }} />
        ))}
        {plusz.map((kw) => <SzoChip key={`+${kw}`} kw={kw} allapot="uj" onClick={() => ment(torol, plusz.filter((y) => y !== kw))} />)}
        <SzoHozzaado csakSzo onAdd={(kw) => ment(torol, [...new Set([...plusz, kw])])} />
      </div>
    </section>
  );
}

function AjanlatkeroKartya({ cim, leiras, lista, pont, pontCimke, onPont, onValt }: {
  cim: string; leiras: string; lista: string[]; pont?: number; pontCimke?: string; onPont?: (v: number) => void; onValt: (xs: string[]) => void;
}) {
  const [uj, setUj] = useState('');
  const add = () => { const s = uj.trim(); if (s.length < 2) return; onValt([...new Set([...lista, s])]); setUj(''); };
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{cim}</h3>
        {onPont && pont !== undefined && (
          <label className="text-xs text-gray-600 inline-flex items-center gap-1.5">
            {pontCimke}
            <input type="number" min={0} max={30} value={pont} onChange={(e) => onPont(Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
              className="w-16 px-2 py-0.5 border border-gray-300 rounded text-sm tabular-nums" />
          </label>
        )}
      </div>
      <p className="text-xs text-gray-500">{leiras}</p>
      <div className="flex flex-wrap gap-1 items-center">
        {lista.map((x) => <SzoChip key={x} kw={x} allapot="uj" onClick={() => onValt(lista.filter((y) => y !== x))} />)}
        <span className="inline-flex items-center gap-1">
          <input value={uj} onChange={(e) => setUj(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder="pl. MÁV, Deutsche Bahn" className="w-44 px-2 py-0.5 border border-gray-300 rounded-full text-xs" />
          <button type="button" onClick={add} aria-label="Hozzáadás" className="p-0.5 rounded-full border border-gray-200 hover:bg-gray-50"><Plus className="w-3.5 h-3.5" /></button>
        </span>
      </div>
    </section>
  );
}

/* ══ CPV-PREFERENCIAMÁTRIX ════════════════════════════════════════════════ */

const SZINTEK: Array<{ nev: string; ertek: number; szin: string }> = [
  { nev: 'Kizárt', ertek: 0, szin: 'bg-red-600 border-red-600 text-white' },
  { nev: 'Alacsony', ertek: 30, szin: 'bg-gray-500 border-gray-500 text-white' },
  { nev: 'Közepes', ertek: 60, szin: 'bg-amber-500 border-amber-500 text-white' },
  { nev: 'Magas', ertek: 80, szin: 'bg-emerald-600 border-emerald-600 text-white' },
  { nev: 'Kiemelt', ertek: 100, szin: 'bg-green-700 border-green-700 text-white' },
];

function SZINT_NEV(v: number): string {
  return [...SZINTEK].reverse().find((s) => v >= s.ertek)?.nev ?? 'Kizárt';
}

function CpvMatrix({ sulyok, arany, onArany, onSuly }: {
  sulyok: Record<string, number>; arany: number; onArany: (v: number) => void; onSuly: (kod: string, v: number | null) => void;
}) {
  const { profiles } = useTenderWatchProfiles();
  const [uj, setUj] = useState('');
  // Sorok: a súlyozott kódok + a profilokban használt kódok (súly nélkül is).
  const profilKodok = [...new Set(profiles.flatMap((p) => p.cpvPrefixes ?? []))];
  const sorok = [...new Set([...Object.keys(sulyok), ...profilKodok])].sort();
  const vanSuly = Object.keys(sulyok).length > 0;
  const javaslat = CPV_JAVASLAT.filter(([k]) => !sorok.includes(k));
  const hozzaad = (kod: string) => { const k = kod.replace(/\D/g, ''); if (k.length >= 2 && !(k in sulyok)) onSuly(k, 60); setUj(''); };

  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-900">CPV-preferenciamátrix</h3>
        <label className="text-xs text-gray-600 inline-flex items-center gap-2" title="0% = csak a kulcsszavas elemzés; 100% = csak a CPV × súly">
          A CPV-súly aránya a pontszámban
          <input type="range" min={0} max={100} step={5} value={arany} onChange={(e) => onArany(Number(e.target.value))} className="w-28 accent-brand-600" aria-label="CPV-súly aránya" />
          <b className="tabular-nums w-10 text-right text-gray-900">{arany}%</b>
        </label>
      </div>
      <p className="px-4 pt-3 text-xs text-gray-500">
        Minden kódhoz egy relevancia (0–100). A kiírás a <b>legpontosabban illeszkedő</b> súlyozott kódja szerint kapja a CPV-pontot
        (a „71355” sor felülírja a „7135”-öt; több kódnál a legjobb számít), és ez {arany}%-ban, a kulcsszavas elemzés {100 - arany}%-ban adja a
        Loricatus Score-t. A <b>Kizárt</b> kód legfeljebb 30 pontot enged. {!vanSuly && 'Amíg egy kód sincs súlyozva, a pontozás a régi.'}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm mt-2">
          <thead className="text-[11px] uppercase tracking-wide text-gray-400">
            <tr>
              <th className="text-left font-medium px-4 py-1.5">CPV</th>
              {SZINTEK.map((s) => <th key={s.nev} className="font-medium px-1 py-1.5 text-center">{s.nev}<div className="normal-case tracking-normal text-[10px] text-gray-300">{s.ertek}</div></th>)}
              <th className="font-medium px-2 py-1.5 text-center">Pontos</th>
              <th className="px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorok.map((kod) => {
              const v = sulyok[kod];
              const nincs = v === undefined;
              return (
                <tr key={kod} className={clsx(nincs && 'text-gray-400')}>
                  <td className="px-4 py-1.5">
                    <b className="tabular-nums">{kod}</b> <span className="text-xs">{CPV_NEV[kod] ?? ''}</span>
                    {profilKodok.includes(kod) && <span className="ml-1 text-[10px] text-blue-700 bg-blue-50 rounded px-1">profilban</span>}
                  </td>
                  {SZINTEK.map((s) => (
                    <td key={s.nev} className="px-1 py-1.5 text-center">
                      <button type="button" onClick={() => onSuly(kod, s.ertek)} aria-pressed={v === s.ertek}
                        aria-label={`${kod}: ${s.nev}`}
                        className={clsx('w-6 h-6 rounded-full border transition',
                          v === s.ertek ? s.szin : 'bg-white border-gray-300 hover:border-gray-500')} />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center">
                    <input type="number" min={0} max={100} value={nincs ? '' : v} placeholder="—"
                      onChange={(e) => onSuly(kod, e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      className="w-16 px-2 py-0.5 border border-gray-300 rounded text-sm tabular-nums text-center" aria-label={`${kod} súlya`} />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {!nincs && <IkonGomb cim="Súly törlése" veszely onClick={() => onSuly(kod, null)}><X className="w-4 h-4" /></IkonGomb>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2 flex-wrap text-xs">
        <span className="text-gray-500">Kód hozzáadása:</span>
        {javaslat.slice(0, 8).map(([k, n]) => (
          <button key={k} type="button" onClick={() => hozzaad(k)} className="rounded-full border border-gray-200 px-2 py-0.5 hover:bg-gray-50" title={n}>
            + <b className="tabular-nums">{k}</b> {n}
          </button>
        ))}
        <span className="inline-flex items-center gap-1">
          <input value={uj} onChange={(e) => setUj(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="egyéb kód"
            onKeyDown={(e) => { if (e.key === 'Enter') hozzaad(uj); }} className="w-24 px-2 py-0.5 border border-gray-300 rounded-full" />
          <button type="button" onClick={() => hozzaad(uj)} disabled={uj.length < 2} aria-label="Kód hozzáadása"
            className="p-0.5 rounded-full border border-gray-200 hover:bg-gray-50 disabled:opacity-40"><Plus className="w-3.5 h-3.5" /></button>
        </span>
      </div>
    </section>
  );
}
