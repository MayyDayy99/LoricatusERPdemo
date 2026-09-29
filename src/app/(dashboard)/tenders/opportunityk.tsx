'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import {
  ExternalLink, FileText, Loader2, MapPin, Plus, RefreshCw, Search, Star, Trophy, X,
} from 'lucide-react';

import {
  mindenSzinkron, useTenderWatchProfiles,
} from '@/lib/hooks/use-tenders';
import {
  ALLAPOT_FELIRAT, FAZIS_FELIRAT, KOMPETENCIA_FELIRAT, PONT_FORRASA, SAV_FELIRAT, procurementApi, useOpportunities,
  type Fazis, type Opportunity, type Sav,
} from '@/lib/hooks/use-procurement';
import { OpportunityPanel } from './opportunity-panel';
import { FazisJelveny, INPUT, Modal, Mezo, ModalGombok, PontJelveny, SAV_SZIN, penz } from './ui';

/**
 * ── OPPORTUNITYK ────────────────────────────────────────────────────────────
 *
 * A TED-ből, a figyelt forrásokból és kézzel (vagy Claude által) felvett
 * kiírások, Loricatus Score szerint rangsorolva. Egy sorra kattintva nyílik a
 * részletpanel: elemzés, döntés, szereplők, kapcsolatfelvétel.
 */

const SAVOK: Sav[] = ['priority', 'qualified', 'review', 'archive'];

export function Opportunityk({ nyitott, onNyit, forrasSzuro, onForrasSzuroTorles, kezdoProfil, onProfilok }: {
  nyitott: string | null;
  onNyit: (id: string | null) => void;
  forrasSzuro?: { id: string; nev: string } | null;
  onForrasSzuroTorles?: () => void;
  /** A Figyelőprofilok fül „Találatok" gombjáról: ezzel a profillal szűrve nyílik. */
  kezdoProfil?: string | null;
  onProfilok?: () => void;
}) {
  const [kereses, setKereses] = useState('');
  const [savok, setSavok] = useState<Sav[]>(['priority', 'qualified', 'review']);
  const [allapot, setAllapot] = useState('');
  const [rendezes, setRendezes] = useState<'score' | 'deadline' | 'new'>('score');
  const [oldal, setOldal] = useState(1);
  const [lejartIs, setLejartIs] = useState(false);
  const [szinkron, setSzinkron] = useState(false);
  const [ujOpp, setUjOpp] = useState(false);
  const [profilSzuro, setProfilSzuro] = useState<string | null>(kezdoProfil ?? null);
  useEffect(() => { if (kezdoProfil !== undefined) setProfilSzuro(kezdoProfil); }, [kezdoProfil]);
  const [fazis, setFazis] = useState<Fazis | ''>('');
  // Csak az alvállalkozói lehetőségek (tervezési / kivitelezési fővállalkozói munka).
  const [csakAlv, setCsakAlv] = useState(false);

  useEffect(() => { setOldal(1); }, [forrasSzuro?.id, profilSzuro, fazis, csakAlv]);

  const { items, total, limit, isLoading, mutate } = useOpportunities({
    tier: savok, status: allapot || undefined, search: kereses || undefined, sort: rendezes, page: oldal,
    sourceId: forrasSzuro?.id, includeExpired: lejartIs, profileId: profilSzuro ?? undefined,
    phase: fazis ? [fazis] : undefined,
    competence: csakAlv ? 'alvallalkozoi' : undefined,
  });
  const { profiles } = useTenderWatchProfiles();
  const oldalak = Math.max(1, Math.ceil(total / limit));

  /** Minden aktív figyelőprofil (TED, RSS, API, weboldal, e-mail) — a háttérben. */
  async function szinkronMinden() {
    setSzinkron(true);
    try {
      const r = await mindenSzinkron();
      if (r.marFut) {
        toast.info('A szinkron már fut — ha kész, értesítés jön róla.');
      } else {
        toast.success(`Szinkron elindult: ${r.profiles} forrás (TED, RSS, API, weboldalak). Pár perc; ha kész, értesítés jön az összesítővel.`);
        // A gyors (TED, API) források hamar beérnek — frissítjük a listát menet közben is.
        setTimeout(() => mutate(), 30_000);
        setTimeout(() => mutate(), 120_000);
      }
    } catch (err: any) {
      toast.error(err?.response?.status === 403 ? 'A szinkronhoz admin / vezető jogosultság kell.' : 'A szinkron nem indult el.');
    } finally {
      setSzinkron(false);
    }
  }

  const savValt = (s: Sav) => {
    setSavok((r) => (r.includes(s) ? r.filter((x) => x !== s) : [...r, s]));
    setOldal(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-500">
          {total} opportunity · Loricatus Score szerint
          {forrasSzuro && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-800 px-2 py-0.5 text-xs">
              Forrás: {forrasSzuro.nev}
              <button type="button" onClick={onForrasSzuroTorles} aria-label="Forrásszűrő törlése"><X className="w-3 h-3" /></button>
            </span>
          )}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => setUjOpp(true)}
            className="flex items-center gap-2 border border-gray-300 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
            <Plus className="w-4 h-4" /> Kiírás felvétele
          </button>
          {onProfilok && (
            <button type="button" onClick={onProfilok}
              className="flex items-center gap-2 border border-gray-300 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
              <Star className="w-4 h-4" /> Figyelőprofilok
            </button>
          )}
          <button type="button" onClick={szinkronMinden} disabled={szinkron}
            title="Minden aktív figyelőprofil lekérése: TED, RSS, nyilvános API-k, weboldalak, e-mail riasztások"
            className="flex items-center gap-2 bg-brand-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {szinkron ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Szinkron
          </button>
        </div>
      </div>

      {profiles.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Figyelőprofilok">
            {profiles.map((p) => {
              const valasztott = profilSzuro === p.id;
              return (
                <div key={p.id}
                  className={clsx('flex items-center gap-2 text-xs pl-1 pr-2 py-1 rounded-full border',
                    valasztott ? 'bg-blue-600 border-blue-600 text-white'
                      : p.isActive ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-gray-50 border-gray-200 text-gray-500')}>
                  <button type="button" aria-pressed={valasztott} title="Csak ennek a profilnak a kiírásai"
                    onClick={() => setProfilSzuro(valasztott ? null : p.id)}
                    className="flex items-center gap-1.5 rounded-full px-2 py-0.5 hover:bg-black/5">
                    <Star className="w-3 h-3" />
                    <span className="font-medium">{p.name}</span>
                    {!!p.countries?.length && <span className="opacity-70">{p.countries.join(', ')}</span>}
                    {!!p.cpvPrefixes?.length && <span className="opacity-70">CPV {p.cpvPrefixes.join(', ')}</span>}
                    {!!p.keywords?.length && <span className="opacity-70">({p.keywords.join(', ')})</span>}
                    {!p.isActive && <span className="italic">szünetel</span>}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-400">Kattints egy profilra, és a lista csak az ő kiírásait mutatja. Profilt összerakni és finomhangolni a Figyelőprofilok fülön lehet.</p>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={kereses} onChange={(e) => { setKereses(e.target.value); setOldal(1); }}
            placeholder="Keresés cím vagy ajánlatkérő alapján…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="flex gap-1" role="group" aria-label="Sávok">
          {SAVOK.map((s) => (
            <button key={s} type="button" onClick={() => savValt(s)} aria-pressed={savok.includes(s)}
              className={clsx('px-2.5 py-1.5 rounded-lg border text-xs font-medium',
                savok.includes(s) ? `${SAV_SZIN[s]} border-transparent` : 'border-gray-200 text-gray-400 bg-white')}>
              {SAV_FELIRAT[s]}
            </button>
          ))}
        </div>
        <select value={allapot} onChange={(e) => { setAllapot(e.target.value); setOldal(1); }} aria-label="Állapot"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">Minden állapot</option>
          {Object.entries(ALLAPOT_FELIRAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={fazis} aria-label="Eljárás"
          onChange={(e) => {
            const f = e.target.value as Fazis | '';
            setFazis(f);
            // A lezárult kiírások pontja a lejárt határidő miatt többnyire Archive —
            // eredményre szűrve ezért minden sávot mutatunk.
            if (f && f !== 'open') setSavok(SAVOK);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">Minden eljárás</option>
          {(Object.keys(FAZIS_FELIRAT) as Fazis[]).map((k) => <option key={k} value={k}>{FAZIS_FELIRAT[k]}</option>)}
        </select>
        <select value={rendezes} onChange={(e) => setRendezes(e.target.value as typeof rendezes)} aria-label="Rendezés"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="score">Pontszám szerint</option>
          <option value="deadline">Határidő szerint</option>
          <option value="new">Legújabb elöl</option>
        </select>
        <button type="button" aria-pressed={csakAlv} data-testid="alv-szuro"
          title="Tervezési / kivitelezési fővállalkozói munka (vasút, híd, út, épület) — a nyertesnek felmérés kellhet"
          onClick={() => setCsakAlv((x) => !x)}
          className={clsx('px-2.5 py-1.5 rounded-lg border text-xs font-medium',
            csakAlv ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-violet-200 text-violet-800 hover:bg-violet-50')}>
          Alvállalkozói lehetőség
        </button>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={lejartIs} onChange={(e) => setLejartIs(e.target.checked)} /> lejártak is
        </label>
      </div>

      {isLoading && items.length === 0 ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-14 space-y-2">
          <FileText className="w-10 h-10 text-gray-300 mx-auto" />
          <p className="text-gray-500 text-sm">Nincs találat ezekkel a szűrőkkel.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((o) => <OpportunitySor key={o.id} o={o} aktiv={o.id === nyitott} onNyit={() => onNyit(o.id)} />)}
        </ul>
      )}

      {oldalak > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button type="button" onClick={() => setOldal((p) => Math.max(1, p - 1))} disabled={oldal <= 1}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40">Előző</button>
          <span className="text-sm text-gray-500">{oldal} / {oldalak}</span>
          <button type="button" onClick={() => setOldal((p) => Math.min(oldalak, p + 1))} disabled={oldal >= oldalak}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40">Következő</button>
        </div>
      )}

      {nyitott && <OpportunityPanel id={nyitott} onBezar={() => onNyit(null)} onValtozott={() => mutate()} />}
      {ujOpp && <UjOpportunityModal onBezar={() => setUjOpp(false)} onKesz={(id) => { setUjOpp(false); mutate(); onNyit(id); }} />}
    </div>
  );
}

function OpportunitySor({ o, aktiv, onNyit }: { o: Opportunity; aktiv: boolean; onNyit: () => void }) {
  const ertek = penz(o.estimatedValue, o.currency);
  return (
    <li>
      <button type="button" onClick={onNyit}
        className={clsx('w-full text-left bg-white border rounded-xl p-3 sm:p-4 hover:shadow-sm transition flex gap-3 items-start',
          aktiv ? 'border-brand-500 ring-1 ring-brand-500' : 'border-gray-200')}>
        <div className="shrink-0 pt-0.5"><PontJelveny score={o.score} tier={o.tier} /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 leading-snug text-sm sm:text-base break-words">{o.title}</h3>
            {o.status !== 'new' && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">{ALLAPOT_FELIRAT[o.status]}</span>
            )}
            {o.bidDecision && (
              <span className={clsx('text-[11px] px-2 py-0.5 rounded-full font-semibold',
                o.bidDecision === 'bid' ? 'bg-purple-100 text-purple-700' : 'bg-red-50 text-red-600')}>
                {o.bidDecision === 'bid' ? 'BID' : 'No BID'}
              </span>
            )}
            {o.phase !== 'open' && <FazisJelveny fazis={o.phase} />}
            {o.noticeType?.startsWith('pin-') && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-medium" title="Előzetes tájékoztató: a felhívás később jön — most lehet kapcsolatot építeni">
                Előzetes
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
            {o.buyer ?? 'Ismeretlen ajánlatkérő'}{o.buyerCountry ? ` · ${o.buyerCountry}` : ''} · {o.procurementSource?.name ?? o.source.toUpperCase()}
            {ertek ? ` · ${ertek}` : ''}
            {o.place && <span className="inline-flex items-center gap-0.5 ml-1 text-gray-500"><MapPin className="w-3 h-3" />{o.place}</span>}
          </p>
          {o.result && (
            <p className={clsx('text-xs mt-1 flex items-start gap-1', o.result.ownWin ? 'text-green-800' : 'text-violet-800')}>
              <Trophy className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>
                {o.phase === 'unsuccessful' ? 'Lezárult, nyertes nélkül'
                  : o.result.winners.length ? o.result.winners.join(', ') : 'Nyertes nem nyilvános'}
                {o.result.value ? ` · ${penz(o.result.value, o.result.currency)}` : ''}
                {o.result.offersCount === 0 ? ' · nem érkezett ajánlat' : o.result.offersCount != null ? ` · ${o.result.offersCount} ajánlat` : ''}
              </span>
            </p>
          )}
          {o.scoreReason && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {o.scoreReason} <span className="text-gray-400">({PONT_FORRASA[o.scoreSource ?? 'rule']})</span>
            </p>
          )}
          {o.matchedCompetences.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {o.matchedCompetences.map((k) => (
                <span key={k} className={clsx('text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5',
                  k === 'alvallalkozoi' ? 'text-violet-800 bg-violet-100' : 'text-brand-800 bg-brand-50')}>
                  {KOMPETENCIA_FELIRAT[k] ?? k}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[11px] text-gray-500" title={o.deadlineKind === 'request' ? 'Kétlépcsős eljárás: jelentkezési (részvételi) határidő' : undefined}>
            {o.deadlineKind === 'request' ? 'Jelentkezés' : 'Határidő'}
            {o.previousDeadlineAt && <span className="text-amber-600" title={`Módosult — korábban ${new Date(o.previousDeadlineAt).toLocaleDateString('hu-HU')}`}> ✎</span>}
          </div>
          <div className={clsx('text-sm font-semibold tabular-nums',
            o.daysLeft != null && o.daysLeft < 0 ? 'text-gray-400'
              : o.daysLeft != null && o.daysLeft <= 5 ? 'text-red-600'
                : o.daysLeft != null && o.daysLeft <= 14 ? 'text-amber-600' : 'text-gray-900')}>
            {o.deadlineAt ? new Date(o.deadlineAt).toLocaleDateString('hu-HU') : '—'}
          </div>
          {o.daysLeft != null && <div className="text-[11px] text-gray-500">{o.daysLeft < 0 ? 'lejárt' : `${o.daysLeft} nap`}</div>}
          {o.sourceUrl && (
            <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              className="inline-flex mt-1 p-1 rounded hover:bg-gray-100 text-gray-500" title="Hirdetmény megnyitása">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </button>
    </li>
  );
}

function UjOpportunityModal({ onBezar, onKesz }: { onBezar: () => void; onKesz: (id: string) => void }) {
  const [cim, setCim] = useState('');
  const [ajanlatkero, setAjanlatkero] = useState('');
  const [url, setUrl] = useState('');
  const [hatarido, setHatarido] = useState('');
  const [leiras, setLeiras] = useState('');
  const [dolgozik, setDolgozik] = useState(false);

  async function ment() {
    if (cim.trim().length < 3) return;
    setDolgozik(true);
    try {
      const r = await procurementApi.felvesz({
        title: cim.trim(),
        buyer: ajanlatkero.trim() || undefined,
        sourceUrl: url.trim() || undefined,
        deadlineAt: hatarido ? new Date(`${hatarido}T12:00:00`).toISOString() : undefined,
        description: leiras.trim() || undefined,
      });
      toast.success(r.created ? 'Felvéve és pontozva.' : 'Ez a kiírás már szerepelt — azt nyitom meg.');
      onKesz(r.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Nem sikerült felvenni.');
    } finally {
      setDolgozik(false);
    }
  }

  return (
    <Modal cim="Kiírás felvétele" onBezar={onBezar}>
      <p className="text-sm text-gray-500">EKR-ből, Aribából, egy vevői portálról — amit nem a DIMOP gyűjt automatikusan.</p>
      <Mezo cimke="Cím"><input value={cim} onChange={(e) => setCim(e.target.value)} className={INPUT} autoFocus /></Mezo>
      <Mezo cimke="Ajánlatkérő"><input value={ajanlatkero} onChange={(e) => setAjanlatkero(e.target.value)} className={INPUT} /></Mezo>
      <Mezo cimke="Link"><input value={url} onChange={(e) => setUrl(e.target.value)} className={INPUT} placeholder="https://…" /></Mezo>
      <Mezo cimke="Beadási határidő"><input type="date" value={hatarido} onChange={(e) => setHatarido(e.target.value)} className={INPUT} /></Mezo>
      <Mezo cimke="Leírás (a pontozás ebből is dolgozik)">
        <textarea value={leiras} onChange={(e) => setLeiras(e.target.value)} rows={4} className={INPUT} />
      </Mezo>
      <ModalGombok onMegse={onBezar} onOk={ment} ok={dolgozik ? '…' : 'Felvétel'} tiltva={dolgozik || cim.trim().length < 3} />
    </Modal>
  );
}
