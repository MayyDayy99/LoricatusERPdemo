'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, CalendarClock, Clock, Loader2, MessageSquare, Radar, Sparkles, Trophy } from 'lucide-react';

import { ALLAPOT_FELIRAT, HIANY_FELIRAT, SAV_FELIRAT, useOsszefoglalo, type Sav } from '@/lib/hooks/use-procurement';
import { PontJelveny, SAV_SZIN, penz } from './ui';

/**
 * ── ÁTTEKINTÉS — „MI TÖRTÉNT TEGNAP ÓTA?" ──────────────────────────────────
 *
 * Ugyanazok a számok, amiket Claude a `get_procurement_summary` eszközzel lát
 * — egy helyről jönnek, ezért nem mondhatnak mást.
 */

const IDOSZAKOK = [
  { orak: 24, felirat: 'Tegnap óta' },
  { orak: 24 * 7, felirat: 'Egy hét' },
  { orak: 24 * 30, felirat: 'Egy hónap' },
];

export function Attekintes({ onNyit, onForrasok }: { onNyit: (id: string) => void; onForrasok: () => void }) {
  const [orak, setOrak] = useState(24);
  const { osszefoglalo: o, isLoading } = useOsszefoglalo(orak);

  return (
    <div className="space-y-5">
      <div className="flex gap-1" role="group" aria-label="Időszak">
        {IDOSZAKOK.map((i) => (
          <button key={i.orak} type="button" onClick={() => setOrak(i.orak)} aria-pressed={orak === i.orak}
            className={clsx('px-3 py-1.5 rounded-lg border text-xs font-medium',
              orak === i.orak ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-gray-200 text-gray-600')}>
            {i.felirat}
          </button>
        ))}
      </div>

      {isLoading || !o ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Szamlalo ertek={o.newOpportunities.total} felirat="Új opportunity" />
            {(['priority', 'qualified', 'review', 'archive'] as Sav[]).map((s) => (
              <div key={s} className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                <div className="text-xl font-bold text-gray-900 tabular-nums leading-none">{o.newOpportunities.byTier[s]}</div>
                <div className="mt-1"><span className={clsx('text-[11px] rounded px-1.5 py-0.5 font-medium', SAV_SZIN[s])}>{SAV_FELIRAT[s]}</span></div>
              </div>
            ))}
          </div>

          {o.critical.length > 0 && (
            <Kartya ikon={<AlertTriangle className="w-4 h-4 text-red-600" />} cim={`Kritikus: ${o.critical.length} határidő 5 napon belül`}>
              <ul className="divide-y divide-gray-100">
                {o.critical.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => onNyit(c.id)} className="w-full text-left py-2 flex items-center gap-3 hover:bg-gray-50 rounded">
                      <span className="text-sm font-semibold text-red-600 tabular-nums w-14 shrink-0">{c.daysLeft} nap</span>
                      <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">{c.title}</span>
                      <PontJelveny score={c.score} tier={c.tier} />
                    </button>
                  </li>
                ))}
              </ul>
            </Kartya>
          )}

          {o.results.length > 0 && (
            <Kartya ikon={<Trophy className="w-4 h-4 text-violet-600" />} cim={`Eredményt hirdettek: ${o.results.length} követett kiírás`}>
              <ul className="divide-y divide-gray-100">
                {o.results.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => onNyit(r.id)} className="w-full text-left py-2 flex items-start gap-3 hover:bg-gray-50 rounded">
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-gray-900 truncate">{r.title}</span>
                        <span className="block text-xs text-violet-800">
                          {r.unsuccessful ? 'Lezárult, nyertes nélkül' : r.winners.length ? `Nyertes: ${r.winners.join(', ')}` : 'A nyertes neve nem nyilvános'}
                          {r.value ? ` · ${penz(r.value, r.currency)}` : ''}
                          {r.offersCount != null ? ` · ${r.offersCount} ajánlat` : ''}
                        </span>
                      </span>
                      <span className="text-[11px] text-gray-500 shrink-0">{ALLAPOT_FELIRAT[r.status]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Kartya>
          )}

          {o.deadlineChanges.length > 0 && (
            <Kartya ikon={<CalendarClock className="w-4 h-4 text-amber-600" />} cim={`Módosult határidő: ${o.deadlineChanges.length}`}>
              <ul className="divide-y divide-gray-100">
                {o.deadlineChanges.map((d) => (
                  <li key={d.id}>
                    <button type="button" onClick={() => onNyit(d.id)} className="w-full text-left py-2 flex items-center gap-3 hover:bg-gray-50 rounded">
                      <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">{d.title}</span>
                      <span className="text-xs text-gray-500 shrink-0 tabular-nums">
                        <s>{new Date(d.previousDeadlineAt).toLocaleDateString('hu-HU')}</s> → <b className="text-gray-900">{new Date(d.deadlineAt).toLocaleDateString('hu-HU')}</b>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Kartya>
          )}

          <Kartya ikon={<Sparkles className="w-4 h-4 text-brand-700" />} cim="A legjobb új lehetőségek">
            {o.newOpportunities.top.length === 0 ? (
              <p className="text-sm text-gray-500">Ebben az időszakban nem jött Review-nál jobb kiírás.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {o.newOpportunities.top.map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={() => onNyit(t.id)} className="w-full text-left py-2.5 flex items-start gap-3 hover:bg-gray-50 rounded">
                      <PontJelveny score={t.score} tier={t.tier} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-gray-900">{t.title}</span>
                        <span className="block text-xs text-gray-500">
                          {t.buyer ?? '—'}{t.country ? ` · ${t.country}` : ''}{t.daysLeft != null ? ` · ${t.daysLeft} nap a határidőig` : ''}
                        </span>
                        {t.reason && <span className="block text-xs text-gray-500 mt-0.5 line-clamp-2">{t.reason}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Kartya>

          <div className="grid gap-4 md:grid-cols-2">
            <Kartya ikon={<Clock className="w-4 h-4 text-gray-500" />} cim="Forrásonként">
              {o.bySource.length === 0 ? <p className="text-sm text-gray-500">Nem jött új kiírás.</p> : (
                <ul className="text-sm space-y-1">
                  {o.bySource.map((b) => (
                    <li key={b.source} className="flex justify-between gap-2">
                      <span className="text-gray-700 truncate">{b.source}</span>
                      <span className="tabular-nums text-gray-500">{b.count} új · {b.relevant} releváns</span>
                    </li>
                  ))}
                </ul>
              )}
            </Kartya>

            <Kartya ikon={<MessageSquare className="w-4 h-4 text-blue-600" />} cim="Kapcsolatépítés és források">
              <ul className="text-sm space-y-1.5 text-gray-700">
                <li><b className="tabular-nums">{o.outreachAwaitingApproval}</b> kapcsolatfelvételi draft vár jóváhagyásra</li>
                <li>
                  <b className="tabular-nums">{o.newSources.total}</b> új beszerzési forrás
                  {o.newSources.total > 0 ? `, ebből ${o.newSources.withSupplierRegistration} enged beszállítói regisztrációt` : ''}
                  {o.newSources.total > 0 && (
                    <button type="button" onClick={onForrasok} className="ml-1 text-brand-700 hover:underline inline-flex items-center gap-1">
                      <Radar className="w-3.5 h-3.5" /> megnézem
                    </button>
                  )}
                </li>
                <li className="text-xs text-gray-500">
                  Elemzésre vár: {o.analysis.pending} · ebben az időszakban elemezve: {o.analysis.completedInPeriod}
                </li>
              </ul>
            </Kartya>
          </div>

          {o.capabilityGapAlerts.length > 0 && (
            <Kartya ikon={<AlertTriangle className="w-4 h-4 text-amber-600" />} cim="Capability Gap figyelmeztetés">
              <ul className="space-y-2">
                {o.capabilityGapAlerts.map((g) => (
                  <li key={`${g.gapType}-${g.competence}`} className="text-sm text-gray-700">
                    Az elmúlt {Math.round(g.windowDays / 30)} hónapban <b>{g.count}</b> olyan kiírás volt
                    {g.competenceName ? <> a(z) <b>{g.competenceName}</b> területen</> : null}, ahol a pontot ez vitte le:{' '}
                    <b>{HIANY_FELIRAT[g.gapType] ?? g.gapType}</b>.
                    {g.examples.length > 0 && <span className="block text-xs text-gray-500">Pl.: {g.examples.slice(0, 2).join(' · ')}</span>}
                  </li>
                ))}
              </ul>
            </Kartya>
          )}
        </>
      )}
    </div>
  );
}

function Szamlalo({ ertek, felirat }: { ertek: React.ReactNode; felirat: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
      <div className="text-xl font-bold text-gray-900 tabular-nums leading-none">{ertek}</div>
      <div className="text-xs text-gray-500 mt-1">{felirat}</div>
    </div>
  );
}

function Kartya({ ikon, cim, children }: { ikon: React.ReactNode; cim: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2">{ikon}{cim}</h2>
      {children}
    </section>
  );
}
