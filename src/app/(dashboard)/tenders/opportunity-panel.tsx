'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import Link from 'next/link';
import { CalendarPlus, ExternalLink, FolderPlus, Linkedin, Loader2, Sparkles, Trash2, X } from 'lucide-react';

import {
  ALLAPOT_FELIRAT, CEG_SZEREP_FELIRAT, DONTES_OKOK, EGYSEG_FELIRAT, HIANY_FELIRAT, KOMPETENCIA_FELIRAT,
  PONT_FORRASA, STRATEGIA_FELIRAT, SZERZODES_FELIRAT, procurementApi, useElemzoAllapot, useOpportunity,
  type OpportunityReszletek, type OutreachLepes, type ProjektElokeszites, type ProjektHatarido,
} from '@/lib/hooks/use-procurement';
import { useProjectCategories } from '@/lib/hooks/use-projects';
import { EredmenyKartya, FazisJelveny, INPUT, Modal, Mezo, ModalGombok, PontJelveny, datum, penz } from './ui';
import { PalyazatEredmenyBlokk } from './sajat-eredmeny';

/**
 * Egy opportunity részletei, jobb oldali panelben.
 *
 * A DÖNTÉS (BID / No BID / elvetés / eredmény) és a draft JÓVÁHAGYÁSA itt, és
 * csak itt történik — ember által. Claude (MCP) ezeket nem tudja megtenni,
 * csak előkészíteni.
 */

const SZEMPONT_FELIRAT: Record<string, string> = {
  technical_fit: 'Műszaki illeszkedés', commercial_fit: 'Üzleti illeszkedés', reference_fit: 'Referencia',
  geography: 'Földrajz', qualification: 'Alkalmassági feltételek', deadline_feasibility: 'Határidő',
  local_partner: 'Helyi partner', capacity: 'Kapacitás', competition: 'Verseny', relationship: 'Kapcsolat',
};

/** Ha a kiírás nem nevezi meg a szempontot, csak a típusát adja. */
const SZEMPONT_TIPUS: Record<string, string> = { price: 'Ár', quality: 'Minőség', cost: 'Költség' };

const DONTESEK: Array<{ kod: string; felirat: string; okKell?: boolean; szin: string }> = [
  { kod: 'bid', felirat: 'BID — indulunk', szin: 'bg-purple-600 text-white hover:bg-purple-700' },
  { kod: 'no_bid', felirat: 'No BID', okKell: true, szin: 'bg-white border border-red-200 text-red-700 hover:bg-red-50' },
  { kod: 'priority', felirat: 'Kiemelt', szin: 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50' },
  { kod: 'dismiss', felirat: 'Érdektelen', okKell: true, szin: 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50' },
  { kod: 'submitted', felirat: 'Beadtuk', szin: 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50' },
  { kod: 'won', felirat: 'Nyertünk', szin: 'bg-white border border-green-200 text-green-700 hover:bg-green-50' },
  { kod: 'lost', felirat: 'Vesztettünk', okKell: true, szin: 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50' },
];

export function OpportunityPanel({ id, onBezar, onValtozott }: { id: string; onBezar: () => void; onValtozott: () => void }) {
  const { opp, isLoading, mutate } = useOpportunity(id);
  const elemzo = useElemzoAllapot();
  const [elemez, setElemez] = useState(false);
  const [dontes, setDontes] = useState<string | null>(null);
  const [importAblak, setImportAblak] = useState(false);

  const frissit = async () => { await mutate(); onValtozott(); };

  async function elemzesMost() {
    setElemez(true);
    try {
      await procurementApi.elemez(id);
      toast.success('Elemzés kész.');
      await frissit();
    } catch (err: any) {
      toast.error(err?.response?.data?.technicalMessage ?? err?.response?.data?.message ?? 'Az elemzés nem sikerült.');
    } finally {
      setElemez(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onBezar}>
      <aside className="h-full w-full max-w-2xl bg-white shadow-xl overflow-y-auto" onClick={(e) => e.stopPropagation()}
        aria-label="Opportunity részletei">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-gray-400">Opportunity</div>
            <h2 className="text-base font-bold text-gray-900 break-words">{opp?.title ?? '…'}</h2>
          </div>
          <button type="button" onClick={onBezar} aria-label="Bezárás" className="p-1.5 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        {isLoading || !opp ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
        ) : (
          <div className="p-5 space-y-6">
            <Tenyek opp={opp} />

            <EljarasEredmenye opp={opp} />

            {opp.matchedCompetences.includes('alvallalkozoi') && <AlvallalkozoiBlokk opp={opp} onValtozas={frissit} />}

            <PalyazatEredmenyBlokk tenderId={opp.id} cim={opp.title} statusz={opp.status} />

            {opp.details && <KiirasReszletei opp={opp} />}

            <Blokk cim="Loricatus Score">
              <div className="flex items-start gap-3">
                <PontJelveny score={opp.score} tier={opp.tier} />
                <div className="flex-1 min-w-0 text-sm text-gray-700">
                  <p>{opp.scoreReason ?? '—'}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Forrás: {PONT_FORRASA[opp.scoreSource ?? 'rule']}
                    {opp.ruleScore != null && opp.scoreSource !== 'rule' ? ` · szabály szerint: ${opp.ruleScore}` : ''}
                    {opp.winProbability != null ? ` · nyerési esély: ${opp.winProbability}%` : ''}
                    {opp.bidRecommendation ? ` · javaslat: ${opp.bidRecommendation.replace('_', ' ')}` : ''}
                  </p>
                </div>
              </div>
              {opp.matchedCompetences.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {opp.matchedCompetences.map((k) => (
                    <span key={k} className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${k === 'alvallalkozoi' ? 'text-violet-800 bg-violet-100' : 'text-brand-800 bg-brand-50'}`}>{KOMPETENCIA_FELIRAT[k] ?? k}</span>
                  ))}
                </div>
              )}
              {elemzo.configured ? (
                <button type="button" onClick={elemzesMost} disabled={elemez}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">
                  {elemez ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {opp.analysedAt ? 'Újraelemzés' : 'Elemzés most'} ({elemzo.model})
                </button>
              ) : (
                <p className="mt-2 text-xs text-gray-400">
                  A szerver oldali elemző nincs bekapcsolva — a pontszám szabályalapú. Claude-dal (MCP) is elemeztetheted.
                </p>
              )}
            </Blokk>

            {opp.analysis && <Elemzes opp={opp} />}

            {opp.market && (opp.market.buyerHistory.length > 0 || (opp.market.similar?.count ?? 0) > 0) && <PiaciKepBlokk opp={opp} />}
            {(opp.winEstimate || (opp.references?.length ?? 0) > 0) && <TampontBlokk opp={opp} />}

            <Blokk cim="Döntés">
              <p className="text-xs text-gray-500 mb-2">
                Jelenleg: <b>{ALLAPOT_FELIRAT[opp.status]}</b>
                {opp.bidDecision ? ` · ${opp.bidDecision === 'bid' ? 'BID' : 'No BID'}` : ''}. A döntést ember hozza; az elvetés okát
                is rögzítsd — ebből tanul a pontozás.
              </p>
              <div className="flex flex-wrap gap-2">
                {DONTESEK.map((d) => (
                  <button key={d.kod} type="button" onClick={() => setDontes(d.kod)}
                    className={clsx('rounded-lg px-3 py-1.5 text-xs font-semibold', d.szin)}>{d.felirat}</button>
                ))}
              </div>
            </Blokk>

            <KovetkezoLepes opp={opp} onMentve={frissit} />

            <Blokk cim={`Szereplők — Account Entry Map (${opp.stakeholders.length})`}>
              {opp.stakeholders.length === 0 ? (
                <p className="text-xs text-gray-500">Még nincs rögzített szereplő. Claude-dal készíttethetsz térképet (MCP: „Kikkel építsünk kapcsolatot?").</p>
              ) : (
                <ul className="space-y-2">
                  {opp.stakeholders.map((s) => (
                    <li key={s.id} className="border border-gray-100 rounded-lg p-2.5 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900">
                            {s.priority ? <span className="text-gray-400 mr-1">{s.priority}.</span> : null}
                            {s.personName ?? s.position ?? '—'}
                            {s.personName && s.position ? <span className="font-normal text-gray-500"> · {s.position}</span> : null}
                          </div>
                          <div className="text-xs text-gray-500">
                            {s.companyName} · {CEG_SZEREP_FELIRAT[s.companyRole] ?? s.companyRole}
                            {s.influence !== 'unknown' ? ` · ${s.influence.replace('_', ' ')}` : ''}
                            {s.weight ? ` · súly ${s.weight}/5` : ''}
                            {s.createdVia !== 'human' ? ` · ${s.createdVia === 'claude' ? 'Claude' : 'AI'} vette fel` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {s.linkedinUrl && <a href={s.linkedinUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-gray-100 text-gray-500" title="LinkedIn"><Linkedin className="w-3.5 h-3.5" /></a>}
                          {s.infoSourceUrl && <a href={s.infoSourceUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-gray-100 text-gray-500" title="Az adat forrása"><ExternalLink className="w-3.5 h-3.5" /></a>}
                          <button type="button" title="Törlés" className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600"
                            onClick={async () => {
                              if (!confirm('Törlöd ezt a szereplőt?')) return;
                              await procurementApi.szereploTorles(s.id); await frissit();
                            }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {s.rationale && <p className="text-xs text-gray-600 mt-1">{s.rationale}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Blokk>

            <Blokk cim={`Kapcsolatfelvétel (${opp.outreach.length})`}>
              {opp.outreach.length === 0 ? (
                <p className="text-xs text-gray-500">Nincs még kapcsolatfelvételi lépés.</p>
              ) : (
                <ul className="space-y-2">
                  {opp.outreach.map((l) => (
                    <OutreachSor key={l.id} l={l} szemely={opp.stakeholders.find((s) => s.id === l.stakeholderId)} onValtozott={frissit} />
                  ))}
                </ul>
              )}
            </Blokk>

            {opp.capabilityGaps.length > 0 && (
              <Blokk cim="Képességhiányok">
                <ul className="space-y-1">
                  {opp.capabilityGaps.map((g) => (
                    <li key={g.id} className="text-sm text-gray-700 flex gap-2">
                      <span className={clsx('shrink-0 text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 h-fit',
                        g.severity >= 3 ? 'bg-red-50 text-red-700' : g.severity === 2 ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-600')}>
                        {HIANY_FELIRAT[g.gapType] ?? g.gapType}
                      </span>
                      <span>{g.description}{g.competence ? <span className="text-gray-400"> · {KOMPETENCIA_FELIRAT[g.competence] ?? g.competence}</span> : null}</span>
                    </li>
                  ))}
                </ul>
              </Blokk>
            )}

            {opp.decisions.length > 0 && (
              <Blokk cim="Döntésnapló">
                <ul className="space-y-1 text-xs text-gray-600">
                  {opp.decisions.map((d) => (
                    <li key={d.id}>
                      <span className="text-gray-400">{new Date(d.createdAt).toLocaleString('hu-HU')}</span>{' '}
                      {d.kind === 'score_override' ? `pontszám: ${d.fromValue ?? '—'} → ${d.toValue}` : `${d.kind}: ${d.fromValue ?? '—'} → ${d.toValue ?? '—'}`}
                      {d.reasonCodes.length ? ` (${d.reasonCodes.map((k) => DONTES_OKOK.find((o) => o.kod === k)?.felirat ?? k).join(', ')})` : ''}
                      {d.via !== 'human' ? ` · ${d.via}` : ''}
                    </li>
                  ))}
                </ul>
              </Blokk>
            )}

            {/* Importálás a Projekt Mapbe — a panel alján, jól látható helyen.
                Egy pályázat csak egyszer importálható: ha már van projekt, csak a link. */}
            <section className="pt-2 border-t border-gray-100 space-y-2" data-testid="projekt-import">
              {opp.project ? (
                <p className="text-sm text-gray-700 rounded-xl bg-green-50 border border-green-100 px-4 py-3" data-testid="mar-importalva">
                  <FolderPlus className="inline w-4 h-4 mr-1.5 text-green-700 -mt-0.5" />
                  Már importálva a Projekt Mapbe:{' '}
                  <Link href={`/projects/${opp.project.id}`} className="font-semibold text-brand-700 hover:underline">{opp.project.name}</Link>
                  {' · '}<Link href="/meeting" className="text-brand-700 hover:underline">Projekt Map</Link>
                  <span className="block text-[11px] text-gray-500 mt-1">
                    Egy pályázat csak egyszer importálható. Ha a projektet törlik, újra importálható.
                  </span>
                </p>
              ) : (
                <>
                  <button type="button" onClick={() => setImportAblak(true)} data-testid="import-gomb"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-base font-semibold px-5 py-3.5 shadow-sm">
                    <FolderPlus className="w-5 h-5" />
                    Importálás a Projekt Mapbe
                  </button>
                  <p className="text-[11px] text-gray-400 text-center">
                    Új projekt sorszámmal és névvel; a kiírás határidői a Projekt Mapen (beadás = határidő, a többi részhatáridő).
                  </p>
                </>
              )}
            </section>
          </div>
        )}
      </aside>
      {importAblak && opp && !opp.project && (
        <ProjektImportAblak tenderId={opp.id} onBezar={() => setImportAblak(false)}
          onKesz={async () => { setImportAblak(false); await frissit(); }} />
      )}
      {dontes && opp && (
        <DontesModal id={id} dontes={dontes} onBezar={() => setDontes(null)} onKesz={async () => { setDontes(null); await frissit(); }} />
      )}
    </div>
  );
}

function Blokk({ cim, children }: { cim: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{cim}</h3>
      {children}
    </section>
  );
}

function Tenyek({ opp }: { opp: OpportunityReszletek }) {
  const ertek = penz(opp.estimatedValue, opp.currency);
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <Teny cimke="Ajánlatkérő" ertek={`${opp.buyer ?? '—'}${opp.buyerCountry ? ` (${opp.buyerCountry})` : ''}`} />
      <Teny cimke="Forrás" ertek={opp.procurementSource?.name ?? opp.source.toUpperCase()} />
      <Teny cimke={opp.deadlineKind === 'request' ? 'Jelentkezési határidő' : 'Beadási határidő'} ertek={opp.deadlineAt
        ? `${new Date(opp.deadlineAt).toLocaleString('hu-HU', { dateStyle: 'medium', timeStyle: 'short' })}${opp.daysLeft != null ? (opp.daysLeft < 0 ? ' (lejárt)' : ` (${opp.daysLeft} nap)`) : ''}`
        : '—'} kiemelt={opp.daysLeft != null && opp.daysLeft >= 0 && opp.daysLeft <= 5} />
      <Teny cimke="Becsült érték" ertek={ertek ?? '—'} />
      {opp.cpvCodes.length > 0 && <Teny cimke="CPV" ertek={opp.cpvCodes.slice(0, 6).join(', ')} />}
      {opp.sourceUrl && (
        <div>
          <div className="text-[11px] text-gray-400">Hirdetmény</div>
          <a href={opp.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline inline-flex items-center gap-1">
            Megnyitás <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
      {opp.deadlineKind === 'request' && opp.phase === 'open' && (
        <p className="col-span-2 text-xs text-blue-800 bg-blue-50 rounded-lg px-3 py-2">
          Kétlépcsős eljárás: ez a <b>jelentkezési (részvételi)</b> határidő. Az ajánlattételi határidőt a kiválasztott
          jelentkezőknek küldött felhívás adja meg.
        </p>
      )}
      {opp.previousDeadlineAt && (
        <p className="col-span-2 text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
          A határidő módosult — korábban: {new Date(opp.previousDeadlineAt).toLocaleDateString('hu-HU')}.
        </p>
      )}
      {opp.daysLeft != null && opp.daysLeft >= 0 && opp.daysLeft <= 5 && (
        <p className="col-span-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
          A határidő {opp.daysLeft} napon belül van: a specifikáció befolyásolására már nincs idő — gyors BID / No BID, és a következő
          hasonló projektre építkezzetek.
        </p>
      )}
      {opp.description && (
        <details className="col-span-2">
          <summary className="text-xs text-gray-500 cursor-pointer">Leírás</summary>
          <p className="text-xs text-gray-600 whitespace-pre-line mt-1 max-h-60 overflow-auto">{opp.description}</p>
        </details>
      )}
    </div>
  );
}

function Teny({ cimke, ertek, kiemelt }: { cimke: string; ertek: string; kiemelt?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-gray-400">{cimke}</div>
      <div className={clsx('break-words', kiemelt ? 'text-red-600 font-semibold' : 'text-gray-900')}>{ertek}</div>
    </div>
  );
}

function Elemzes({ opp }: { opp: OpportunityReszletek }) {
  const a = opp.analysis ?? {};
  if (a.hiba) {
    return <Blokk cim="Elemzés"><p className="text-xs text-red-700">Az elemzés nem sikerült: {String(a.hiba)}</p></Blokk>;
  }
  const lista = (x: unknown) => (Array.isArray(x) ? (x as string[]) : []);
  const igenNem = (v: unknown) => (v === true ? 'igen' : v === false ? 'nem' : 'nem derül ki');
  return (
    <Blokk cim="Elemzés">
      <div className="space-y-2 text-sm text-gray-700">
        {a.osszefoglalo && <p>{a.osszefoglalo}</p>}
        {a.scope && <p className="text-xs text-gray-600"><b>Scope:</b> {a.scope}</p>}
        {lista(a.deliverables).length > 0 && <Felsorolas cim="Leszállítandó" elemek={lista(a.deliverables)} />}
        {lista(a.technikaiKovetelmenyek).length > 0 && <Felsorolas cim="Technikai követelmények" elemek={lista(a.technikaiKovetelmenyek)} />}
        {lista(a.tanusitvanyok).length > 0 && <Felsorolas cim="Tanúsítványok" elemek={lista(a.tanusitvanyok)} />}
        <p className="text-xs text-gray-500">Helyi jelenlét kell: {igenNem(a.helyiJelenletKell)} · partner kell: {igenNem(a.partnerKell)}</p>
        {a.kapcsolatepitesiJavaslat && <p className="text-xs text-gray-600"><b>Kapcsolatépítés:</b> {a.kapcsolatepitesiJavaslat}</p>}
        {opp.bidFactors && Object.keys(opp.bidFactors).length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pt-1">
            {Object.entries(opp.bidFactors).map(([k, v]) => (
              <div key={k} className="text-xs" title={v?.megjegyzes ?? undefined}>
                <div className="flex justify-between"><span className="text-gray-500">{SZEMPONT_FELIRAT[k] ?? k}</span><span className="tabular-nums">{v?.ertek}/5</span></div>
                <div className="h-1.5 bg-gray-100 rounded"><div className="h-1.5 bg-brand-600 rounded" style={{ width: `${((v?.ertek ?? 0) / 5) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        )}
        {opp.analysisModel && <p className="text-[11px] text-gray-400">Modell: {opp.analysisModel}</p>}
      </div>
    </Blokk>
  );
}

function Felsorolas({ cim, elemek }: { cim: string; elemek: string[] }) {
  return (
    <div className="text-xs">
      <div className="text-gray-500">{cim}</div>
      <ul className="list-disc pl-4 text-gray-700">{elemek.map((e) => <li key={e}>{e}</li>)}</ul>
    </div>
  );
}

function KovetkezoLepes({ opp, onMentve }: { opp: OpportunityReszletek; onMentve: () => Promise<void> }) {
  const [szoveg, setSzoveg] = useState(opp.nextStep ?? '');
  const [datum, setDatum] = useState(opp.nextStepAt ?? '');
  useEffect(() => { setSzoveg(opp.nextStep ?? ''); setDatum(opp.nextStepAt ?? ''); }, [opp.nextStep, opp.nextStepAt]);
  const valtozott = szoveg !== (opp.nextStep ?? '') || datum !== (opp.nextStepAt ?? '');
  return (
    <Blokk cim="Következő lépés">
      <div className="flex gap-2 flex-wrap">
        <input value={szoveg} onChange={(e) => setSzoveg(e.target.value)} className={clsx(INPUT, 'flex-1 min-w-[200px]')} placeholder="Mi a következő sales lépés?" />
        <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className={clsx(INPUT, 'w-40')} />
        <button type="button" disabled={!valtozott}
          onClick={async () => {
            try {
              await procurementApi.modosit(opp.id, { nextStep: szoveg || null, nextStepAt: datum || null });
              toast.success('Mentve.'); await onMentve();
            } catch { toast.error('Nem sikerült menteni.'); }
          }}
          className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium disabled:opacity-40">Mentés</button>
      </div>
    </Blokk>
  );
}

const OUTREACH_FELIRAT: Record<OutreachLepes['status'], string> = {
  draft: 'Draft — jóváhagyásra vár', approved: 'Jóváhagyva — küldhető', sent: 'Elküldve', replied: 'Válasz jött',
  no_response: 'Nincs válasz', declined: 'Elutasítva', cancelled: 'Mégsem',
};

function OutreachSor({ l, szemely, onValtozott }: {
  l: OutreachLepes; szemely?: { personName: string | null; position: string | null; companyName: string }; onValtozott: () => Promise<void>;
}) {
  const [szoveg, setSzoveg] = useState(l.draft ?? '');
  const [dolgozik, setDolgozik] = useState(false);
  useEffect(() => { setSzoveg(l.draft ?? ''); }, [l.draft]);

  const muvelet = async (fn: () => Promise<unknown>, ok: string) => {
    setDolgozik(true);
    try { await fn(); toast.success(ok); await onValtozott(); } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Nem sikerült.');
    } finally { setDolgozik(false); }
  };

  const szerkesztheto = l.status === 'draft' || l.status === 'approved';
  return (
    <li className="border border-gray-100 rounded-lg p-3 text-sm space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs text-gray-500">
          <b className="text-gray-800">{l.sequence}. {STRATEGIA_FELIRAT[l.strategy] ?? l.strategy}</b> · {l.channel}
          {szemely ? ` · ${szemely.personName ?? szemely.position ?? ''} (${szemely.companyName})` : ''}
          {l.plannedAt ? ` · tervezett: ${l.plannedAt}` : ''}
          {l.createdVia === 'claude' ? ' · Claude draftja' : ''}
        </div>
        <span className={clsx('text-[11px] rounded-full px-2 py-0.5 font-medium whitespace-nowrap', {
          'bg-amber-100 text-amber-800': l.status === 'draft',
          'bg-blue-100 text-blue-800': l.status === 'approved',
          'bg-purple-100 text-purple-800': l.status === 'sent',
          'bg-green-100 text-green-800': l.status === 'replied',
          'bg-gray-100 text-gray-600': ['no_response', 'declined', 'cancelled'].includes(l.status),
        })}>{OUTREACH_FELIRAT[l.status]}</span>
      </div>
      {szerkesztheto ? (
        <textarea value={szoveg} onChange={(e) => setSzoveg(e.target.value)} rows={4} className={clsx(INPUT, 'text-xs')} />
      ) : (
        l.draft && <p className="text-xs text-gray-600 whitespace-pre-line">{l.draft}</p>
      )}
      {l.outcome && <p className="text-xs text-gray-600"><b>Eredmény:</b> {l.outcome}</p>}
      <div className="flex flex-wrap gap-2">
        {szerkesztheto && szoveg !== (l.draft ?? '') && (
          <button type="button" disabled={dolgozik} onClick={() => muvelet(() => procurementApi.draftModosit(l.id, szoveg), 'Szöveg mentve.')}
            className="text-xs rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50">Szöveg mentése</button>
        )}
        {l.status === 'draft' && szoveg === (l.draft ?? '') && (
          <button type="button" disabled={dolgozik} onClick={() => muvelet(() => procurementApi.jovahagy(l.id), 'Jóváhagyva — most már elküldheted.')}
            className="text-xs rounded-lg bg-blue-600 text-white px-3 py-1.5 font-semibold hover:bg-blue-700">Jóváhagyom</button>
        )}
        {l.status === 'approved' && (
          <button type="button" disabled={dolgozik} onClick={() => muvelet(() => procurementApi.naploz(l.id, { status: 'sent' }), 'Rögzítve: elküldve.')}
            className="text-xs rounded-lg bg-purple-600 text-white px-3 py-1.5 font-semibold hover:bg-purple-700">Elküldtem</button>
        )}
        {(l.status === 'sent' || l.status === 'no_response') && (
          <>
            <button type="button" disabled={dolgozik} onClick={() => {
              const e = prompt('Mi volt a válasz? (röviden)') ?? undefined;
              void muvelet(() => procurementApi.naploz(l.id, { status: 'replied', outcome: e }), 'Rögzítve: válasz jött.');
            }} className="text-xs rounded-lg border border-green-200 text-green-700 px-3 py-1.5 hover:bg-green-50">Válasz jött</button>
            {l.status === 'sent' && (
              <button type="button" disabled={dolgozik} onClick={() => muvelet(() => procurementApi.naploz(l.id, { status: 'no_response' }), 'Rögzítve.')}
                className="text-xs rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50">Nincs válasz</button>
            )}
            <button type="button" disabled={dolgozik} onClick={() => muvelet(() => procurementApi.naploz(l.id, { status: 'declined' }), 'Rögzítve.')}
              className="text-xs rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50">Elutasította</button>
          </>
        )}
        {szerkesztheto && (
          <button type="button" disabled={dolgozik} onClick={() => muvelet(() => procurementApi.naploz(l.id, { status: 'cancelled' }), 'Lépés törölve a tervből.')}
            className="text-xs rounded-lg px-3 py-1.5 text-gray-500 hover:bg-gray-50">Mégsem</button>
        )}
      </div>
    </li>
  );
}

function DontesModal({ id, dontes, onBezar, onKesz }: { id: string; dontes: string; onBezar: () => void; onKesz: () => Promise<void> }) {
  const d = DONTESEK.find((x) => x.kod === dontes)!;
  const [okok, setOkok] = useState<string[]>([]);
  const [megj, setMegj] = useState('');
  const [dolgozik, setDolgozik] = useState(false);
  const hianyzikOk = !!d.okKell && okok.length === 0 && !megj.trim();

  async function ment() {
    setDolgozik(true);
    try {
      await procurementApi.dont(id, { decision: dontes, reasonCodes: okok, note: megj.trim() || undefined });
      toast.success('Döntés rögzítve.');
      await onKesz();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Nem sikerült rögzíteni.');
    } finally {
      setDolgozik(false);
    }
  }

  return (
    <Modal cim={`Döntés: ${d.felirat}`} onBezar={onBezar}>
      <p className="text-sm text-gray-500">
        {d.okKell ? 'Miért? Az ok alapján tanul a pontozás, és ebből épül a képességhiány-riport.' : 'Megjegyzés (opcionális).'}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {DONTES_OKOK.map((o) => (
          <button key={o.kod} type="button" aria-pressed={okok.includes(o.kod)}
            onClick={() => setOkok((r) => (r.includes(o.kod) ? r.filter((x) => x !== o.kod) : [...r, o.kod]))}
            className={clsx('text-xs rounded-full px-2.5 py-1 border',
              okok.includes(o.kod) ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
            {o.felirat}
          </button>
        ))}
      </div>
      <Mezo cimke="Megjegyzés"><textarea value={megj} onChange={(e) => setMegj(e.target.value)} rows={3} className={INPUT} /></Mezo>
      <ModalGombok onMegse={onBezar} onOk={ment} ok={dolgozik ? '…' : 'Rögzítés'} tiltva={dolgozik || hianyzikOk} />
    </Modal>
  );
}

/* ── Eljárás: állapot, eredmény, részletek, piaci kép ─────────────────── */

/**
 * Alvállalkozói lehetőség: tervezési / kivitelezési fővállalkozói munka. Mi
 * nem indulunk, de a nyertesnek felmérés kellhet — az eredmény után a nyertes
 * egy kattintással fővállalkozó-szereplőként felvehető (onnan a kapcsolatfelvétel).
 */
function AlvallalkozoiBlokk({ opp, onValtozas }: { opp: OpportunityReszletek; onValtozas: () => Promise<void> }) {
  const [dolgozik, setDolgozik] = useState<string | null>(null);
  const nyertesek = [...new Set(opp.results.flatMap((r) => r.winners.map((w) => w.name)))];
  const felvettek = new Set(opp.stakeholders.map((s) => s.companyName.toLowerCase()));
  async function felvesz(nev: string) {
    setDolgozik(nev);
    try {
      await procurementApi.szereplokFelvetele(opp.id, [{
        companyName: nev, companyRole: 'prime_contractor',
        rationale: 'Alvállalkozói lehetőség: a nyertes fővállalkozónak felmérés (geodézia, lézerszkennelés, drón, georadar) kellhet.',
      }]);
      toast.success(`${nev} felvéve fővállalkozóként — a Szereplők között megírható a kapcsolatfelvétel.`);
      await onValtozas();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'A felvétel nem sikerült.');
    } finally {
      setDolgozik(null);
    }
  }
  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-sm space-y-2" data-testid="alv-blokk">
      <h3 className="font-semibold text-violet-900">Alvállalkozói lehetőség</h3>
      <p className="text-violet-900/80 text-xs">
        Tervezési / kivitelezési fővállalkozói munka — magunk nem indulnánk, de a nyertesnek felmérés (geodézia,
        lézerszkennelés, drón, georadar) kellhet. Az eredmény után érdemes megkeresni a nyertest.
      </p>
      {nyertesek.length ? (
        <ul className="space-y-1">
          {nyertesek.map((n) => (
            <li key={n} className="flex items-center gap-2">
              <span className="flex-1 min-w-0 truncate font-medium text-gray-900">{n}</span>
              {felvettek.has(n.toLowerCase()) ? (
                <span className="text-xs text-violet-800">felvéve szereplőként</span>
              ) : (
                <button type="button" onClick={() => void felvesz(n)} disabled={dolgozik === n}
                  className="text-xs rounded-lg px-2.5 py-1 bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">
                  {dolgozik === n ? 'Felvétel…' : 'Felvétel fővállalkozóként'}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">Még nincs eredmény — ha kihirdetik a nyertest, itt jelenik meg, és egy kattintással felvehető.</p>
      )}
    </section>
  );
}

function EljarasEredmenye({ opp }: { opp: OpportunityReszletek }) {
  const tobbi = opp.results.slice(1);
  return (
    <Blokk cim="Eljárás">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <FazisJelveny fazis={opp.phase} />
        {opp.noticeTypeName && <span className="text-xs text-gray-500">{opp.noticeTypeName}</span>}
      </div>
      {opp.results.length > 0 ? (
        <div className="space-y-2">
          <EredmenyKartya e={opp.results[0]} />
          {tobbi.length > 0 && (
            <details>
              <summary className="text-xs text-gray-500 cursor-pointer">További eredményhirdetések ({tobbi.length})</summary>
              <div className="space-y-2 mt-2">{tobbi.map((e) => <EredmenyKartya key={e.id} e={e} />)}</div>
            </details>
          )}
          {opp.results[0].winners.some((w) => w.own) && !['won', 'lost'].includes(opp.status) && (
            <p className="text-xs text-green-800 bg-green-50 rounded-lg px-3 py-2">
              A nyertesek között a cégetek nevét látjuk. Ha valóban ti nyertetek, rögzítsétek a döntésnél: <b>Nyertünk</b>.
            </p>
          )}
        </div>
      ) : opp.phase === 'closed' ? (
        <p className="text-xs text-gray-500">
          A határidő lejárt, eredményhirdetés még nem jelent meg a TED-en. A rendszer kétnaponta rákérdez, és értesít, ha megjelenik.
        </p>
      ) : opp.procedureId ? (
        <p className="text-xs text-gray-500">Fut. Ha megjelenik az eredményhirdetés, itt látszik a nyertes, az ár és az ajánlatok száma.</p>
      ) : (
        <p className="text-xs text-gray-400">Az eredményt ennél a forrásnál nem tudjuk automatikusan követni.</p>
      )}
      {!!opp.details?.hirdetmenyek?.length && (
        <details className="mt-2">
          <summary className="text-xs text-gray-500 cursor-pointer">Az eljárás további hirdetményei ({opp.details.hirdetmenyek.length})</summary>
          <ul className="mt-1 space-y-0.5 text-xs">
            {opp.details.hirdetmenyek.map((h) => (
              <li key={h.publicationNumber}>
                {h.url ? <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">{h.publicationNumber}</a> : h.publicationNumber}
                <span className="text-gray-400"> · {datum(h.publishedAt)}{h.noticeType ? ` · ${h.noticeType}` : ''}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Blokk>
  );
}

function KiirasReszletei({ opp }: { opp: OpportunityReszletek }) {
  const d = opp.details!;
  const hely = [...(d.teljesitesHelye?.varosok ?? []), ...(d.teljesitesHelye?.nuts ?? [])];
  const kontakt = d.ajanlatkero ?? ({} as NonNullable<typeof d.ajanlatkero>);
  const benyujtas = d.benyujtasUrl ?? d.dokumentumUrl;
  return (
    <Blokk cim="A kiírás részletei">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {d.szerzodesTipus && <Teny cimke="Szerződés" ertek={SZERZODES_FELIRAT[d.szerzodesTipus] ?? d.szerzodesTipus} />}
        {hely.length > 0 && <Teny cimke="Teljesítés helye" ertek={hely.join(', ')} />}
        {d.idotartam && <Teny cimke="Időtartam" ertek={`${d.idotartam.ertek} ${EGYSEG_FELIRAT[d.idotartam.egyseg] ?? d.idotartam.egyseg}`} />}
        {(d.kezdes || d.befejezes) && <Teny cimke="Teljesítési időszak" ertek={`${datum(d.kezdes) || '?'} – ${datum(d.befejezes) || '?'}`} />}
        {d.reszvetelHatarido && d.ajanlatHatarido && <Teny cimke="Részvételi határidő" ertek={datum(d.reszvetelHatarido)} />}
        {d.bontas && <Teny cimke="Bontás" ertek={datum(d.bontas)} />}
        {d.ajanlatiKotottseg && <Teny cimke="Ajánlati kötöttség" ertek={`${d.ajanlatiKotottseg.ertek} ${EGYSEG_FELIRAT[d.ajanlatiKotottseg.egyseg] ?? ''}`} />}
        {d.reszekSzama > 1 && <Teny cimke="Részek" ertek={String(d.reszekSzama)} />}
        {d.nyelvek?.length > 0 && <Teny cimke="Ajánlat nyelve" ertek={d.nyelvek.join(', ')} />}
        <Teny cimke="Jellemzők" ertek={[
          d.keretmegallapodas ? 'keretmegállapodás' : null,
          d.euForras?.length ? `EU-forrás (${d.euForras.join(', ')})` : null,
          d.kkv ? 'KKV-nak alkalmas' : null,
          d.alvallalkozasEngedett ? 'alvállalkozó bevonható' : null,
          d.fenntartott ? 'fenntartott' : null,
        ].filter(Boolean).join(' · ') || '—'} />
      </div>

      {d.biralatiSzempontok?.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] text-gray-400 mb-1">Bírálati szempontok</div>
          <ul className="space-y-1">
            {d.biralatiSzempontok.map((b, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                {b.suly != null && (
                  <span className="w-20 shrink-0 h-1.5 rounded bg-gray-100 overflow-hidden" aria-hidden>
                    <span className={clsx('block h-full', b.tipus === 'price' ? 'bg-amber-500' : 'bg-brand-600')} style={{ width: `${Math.min(b.suly, 100)}%` }} />
                  </span>
                )}
                <span className="tabular-nums text-xs text-gray-500 w-8 shrink-0">{b.suly != null ? b.suly : ''}</span>
                <span className="text-gray-800 min-w-0 break-words">
                  {b.nev === b.tipus ? SZEMPONT_TIPUS[b.tipus ?? ''] ?? b.nev : b.nev}
                  {b.tipus === 'price' && b.nev !== b.tipus && !/preis|ár|price|prezzo|kosten/i.test(b.nev) ? ' (ár)' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(kontakt.email || kontakt.web || kontakt.kapcsolattarto || benyujtas) && (
        <div className="mt-3 text-sm space-y-1">
          <div className="text-[11px] text-gray-400">Ajánlatkérő elérhetősége</div>
          {kontakt.kapcsolattarto && <div className="text-gray-800">{kontakt.kapcsolattarto}{kontakt.varos ? ` · ${kontakt.varos}` : ''}</div>}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {kontakt.email && <a href={`mailto:${kontakt.email}`} className="text-brand-700 hover:underline break-all">{kontakt.email}</a>}
            {kontakt.web && <a href={kontakt.web} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline break-all">{kontakt.web}</a>}
          </div>
          {benyujtas && (
            <a href={benyujtas} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-1 text-xs font-medium border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
              Dokumentáció és beadás <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {d.alkalmassag && (
        <details className="mt-3">
          <summary className="text-xs text-gray-500 cursor-pointer">Alkalmassági feltételek</summary>
          <p className="text-xs text-gray-600 whitespace-pre-line mt-1 max-h-60 overflow-auto">{d.alkalmassag}</p>
        </details>
      )}
    </Blokk>
  );
}

const REF_TIPUS: Record<string, string> = { eredmeny: 'nyert pályázat', projekt: 'projekt', palyazat: 'nyert pályázat' };

/** Referenciáink (a rögzített munkákból) és a kalibrált nyerési esély. */
function TampontBlokk({ opp }: { opp: OpportunityReszletek }) {
  const e = opp.winEstimate;
  return (
    <Blokk cim="Referenciáink és nyerési esély">
      <div className="space-y-3 text-sm" data-testid="tampont-blokk">
        {e && (
          <div className="flex items-start gap-3">
            <div className="text-2xl font-bold tabular-nums text-gray-900 w-16 shrink-0">{e.szazalek}%</div>
            <div className="text-xs text-gray-600">
              <div className="font-medium text-gray-800">
                Becsült nyerési esély {e.forras === 'piac' ? '(piaci alap)' : e.forras === 'kevert' ? '(saját múlt + piac)' : '(saját múlt alapján)'}
              </div>
              {e.magyarazat}
            </div>
          </div>
        )}
        {(opp.references?.length ?? 0) > 0 ? (
          <div>
            <div className="text-xs text-gray-500 mb-1">Hasonló korábbi munkáink — referencia-jelöltek:</div>
            <ul className="space-y-1">
              {opp.references!.map((r) => (
                <li key={`${r.tipus}-${r.id}`} className="text-sm">
                  <span className="text-gray-900">{r.cim}</span>
                  <span className="text-xs text-gray-500"> · {REF_TIPUS[r.tipus] ?? r.tipus}{r.ev ? `, ${r.ev}` : ''}{r.ertek ? `, ${penz(r.ertek, r.penznem)}` : ''} — {r.miert.join(', ')}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-gray-500">Nincs rögzített hasonló munkánk — ha van, a Piaci kép → Saját piaci adatbázisban vehető fel.</p>
        )}
      </div>
    </Blokk>
  );
}

function PiaciKepBlokk({ opp }: { opp: OpportunityReszletek }) {
  const m = opp.market!;
  const h = m.similar;
  return (
    <Blokk cim="Piaci kép — ki nyer, mennyiért">
      {h && h.count > 0 && (
        <div className="rounded-lg border border-gray-100 p-3 text-sm space-y-2">
          <div className="text-xs text-gray-500">
            Hasonló eljárások ({opp.buyerCountry}, CPV {h.cpvGroups.join(', ')}, 3 év): <b className="text-gray-800">{h.count}</b> eredmény
            {h.avgOffers != null && <> · átlag <b className="text-gray-800">{h.avgOffers}</b> ajánlat</>}
            {h.unsuccessful > 0 && <> · {h.unsuccessful} eredménytelen</>}
          </div>
          {h.value && (
            <div className="text-xs text-gray-600">
              Nyertes ár (medián): <b className="text-gray-900">{penz(h.value.median, h.value.currency)}</b>
              <span className="text-gray-400"> · középső fele {penz(h.value.p25, h.value.currency)} – {penz(h.value.p75, h.value.currency)} ({h.value.count} adat)</span>
            </div>
          )}
          {h.valueToEstimate && (
            <div className="text-xs text-gray-600">
              A nyertes ár jellemzően a becsült érték <b className="text-gray-900">{Math.round(h.valueToEstimate.median * 100)}%-a</b>
              <span className="text-gray-400"> ({h.valueToEstimate.count} adat)</span>
              {opp.estimatedValue ? <> — ennél a kiírásnál ez kb. <b className="text-gray-900">{penz(opp.estimatedValue * h.valueToEstimate.median, opp.currency)}</b></> : null}
            </div>
          )}
          {h.topWinners.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {h.topWinners.map((w) => (
                <span key={w.name} className={clsx('text-xs rounded-full px-2 py-0.5 border',
                  w.own ? 'bg-green-50 border-green-200 text-green-800' : 'bg-gray-50 border-gray-200 text-gray-700')}>
                  {w.name} <b>{w.wins}×</b>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {m.buyerHistory.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] text-gray-400 mb-1">Ennél az ajánlatkérőnél korábban</div>
          <div className="space-y-2">{m.buyerHistory.map((e) => <EredmenyKartya key={e.id} e={e} cimmel />)}</div>
        </div>
      )}
    </Blokk>
  );
}

/* ── Importálás a Projekt Mapbe ─────────────────────────────────────── */

function ProjektImportAblak({ tenderId, onBezar, onKesz }: {
  tenderId: string; onBezar: () => void; onKesz: () => void;
}) {
  const { categories } = useProjectCategories();
  const [elo, setElo] = useState<ProjektElokeszites | null>(null);
  const [sorszam, setSorszam] = useState('');
  const [nev, setNev] = useState('');
  const [sorszamANevben, setSorszamANevben] = useState(true);
  const [kategoria, setKategoria] = useState('');
  const [hataridok, setHataridok] = useState<Array<ProjektHatarido & { be: boolean }>>([]);
  const [ment, setMent] = useState(false);

  useEffect(() => {
    procurementApi.projektElokeszites(tenderId)
      .then((d) => {
        setElo(d);
        setSorszam(d.javasoltSorszam);
        setNev(d.javasoltNev);
        setHataridok(d.hataridok.map((h) => ({ ...h, be: h.kijelolt })));
      })
      .catch((err: any) => {
        toast.error(err?.response?.status === 403 ? 'Projektet létrehozni nincs jogosultságod.' : 'Az import előkészítése nem sikerült.');
        onBezar();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenderId]);

  // A cég szokása szerint: „2026-85 Fa tábla" — sorszám, szóköz, név.
  const vegsoNev = (sorszamANevben && sorszam.trim() ? `${sorszam.trim()} ${nev.trim()}` : nev.trim()).slice(0, 200);
  const mapKategoriak = categories.filter((c) => c.showInProjectMap !== false);
  const kijelolve = hataridok.filter((h) => h.be);

  async function importal() {
    if (!nev.trim()) { toast.error('Add meg a projekt nevét.'); return; }
    setMent(true);
    try {
      const r = await procurementApi.projektImport(tenderId, {
        sorszam: sorszam.trim() || undefined,
        nev: vegsoNev,
        categoryId: kategoria || undefined,
        hataridok: kijelolve.map((h) => ({ datum: h.datum, cimke: h.cimke, tipus: h.tipus })),
      });
      toast.success(`Projekt létrehozva: „${r.projekt.nev}" — ${r.hataridok} határidő a Projekt Mapen.`);
      if (r.kihagyva.length) {
        toast.warning(`${r.kihagyva.length} határidő nem került fel: ${r.kihagyva.map((k) => `${k.datum} (${k.ok})`).join('; ')}`);
      }
      onKesz();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'A projekt létrehozása nem sikerült.');
      // Időközben más már importálta: a panel frissüljön, hogy a projekt linkje látsszon.
      if (err?.response?.status === 409) onKesz();
    } finally {
      setMent(false);
    }
  }

  return (
    <Modal cim="Importálás a Projekt Mapbe" onBezar={onBezar} szeles>
      {!elo ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <div className="space-y-4">
          {elo.projekt && (
            <p className="text-sm text-amber-900 bg-amber-50 rounded-lg px-3 py-2">
              Ebből a pályázatból már van projekt: <b>{elo.projekt.nev}</b>. Egy pályázat csak egyszer importálható.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <Mezo cimke="Sorszám">
              <input value={sorszam} onChange={(e) => setSorszam(e.target.value)} className={INPUT} placeholder="pl. 2026-86" />
            </Mezo>
            <Mezo cimke="Projekt neve">
              <input value={nev} onChange={(e) => setNev(e.target.value)} className={INPUT} maxLength={180} autoFocus />
            </Mezo>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
            <label className="inline-flex items-center gap-2 text-gray-700">
              <input type="checkbox" checked={sorszamANevben} onChange={(e) => setSorszamANevben(e.target.checked)} />
              A sorszám a név elejére is (így látszik a Projekt Mapen)
            </label>
            <span className="text-gray-500">A Projekt Mapen: <b className="text-gray-900">{vegsoNev || '—'}</b></span>
          </div>
          {mapKategoriak.length > 0 && (
            <Mezo cimke="Szoba (nem kötelező)">
              <select value={kategoria} onChange={(e) => setKategoria(e.target.value)} className={INPUT}>
                <option value="">— nincs (a Projekt Mapen látszik) —</option>
                {mapKategoriak.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Mezo>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-600 inline-flex items-center gap-1.5"><CalendarPlus className="w-4 h-4" /> Határidők a Projekt Mapen</span>
              <span className="text-[11px] text-gray-400">{kijelolve.length} kijelölve</span>
            </div>
            {hataridok.length === 0 ? (
              <p className="text-xs text-gray-500">A kiírásban nincs ismert határidő — a projekt határidők nélkül jön létre.</p>
            ) : (
              <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                {hataridok.map((h, i) => (
                  <li key={h.kulcs} className={clsx('flex items-center gap-2 px-3 py-2', !h.be && 'opacity-60')}>
                    <input type="checkbox" checked={h.be} aria-label={`${h.cimke} felvétele`}
                      onChange={(e) => setHataridok((xs) => xs.map((x, j) => (j === i ? { ...x, be: e.target.checked } : x)))} />
                    <span className="tabular-nums text-sm text-gray-700 w-24 shrink-0">{h.datum.replace(/-/g, '.')}.</span>
                    <span className={clsx('shrink-0 text-[10px] font-semibold uppercase rounded px-1.5 py-0.5',
                      h.tipus === 'hatarido' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800')}>
                      {h.tipus === 'hatarido' ? 'határidő' : 'részhatáridő'}
                    </span>
                    <input value={h.cimke} maxLength={200} aria-label="Megnevezés"
                      onChange={(e) => setHataridok((xs) => xs.map((x, j) => (j === i ? { ...x, cimke: e.target.value } : x)))}
                      className="flex-1 min-w-0 px-2 py-1 border border-transparent hover:border-gray-200 focus:border-gray-300 rounded text-sm" />
                    <span className="hidden md:inline text-[11px] text-gray-400 shrink-0 max-w-[10rem] truncate" title={h.forras}>{h.forras}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-gray-400 mt-1">A múltbeli dátumok és a belső javaslat alapból nincsenek kijelölve. A megnevezés átírható.</p>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onBezar} className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50">Mégse</button>
            <button type="button" onClick={importal} disabled={ment || !nev.trim() || !!elo.projekt}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5">
              {ment ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
              Projekt létrehozása{kijelolve.length ? ` ${kijelolve.length} határidővel` : ''}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
