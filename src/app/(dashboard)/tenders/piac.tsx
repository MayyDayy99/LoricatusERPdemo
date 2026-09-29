'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { Building2, Loader2, RefreshCw, Search, Star, Trophy, Users } from 'lucide-react';

import { useTenderWatchProfiles } from '@/lib/hooks/use-tenders';
import { MERET_FELIRAT, procurementApi, usePiac, usePiacEredmenyek } from '@/lib/hooks/use-procurement';
import { EredmenyKartya, datum, penz } from './ui';
import { SajatAdatbazis } from './sajat-eredmeny';

/**
 * ── PIACI KÉP ───────────────────────────────────────────────────────────────
 *
 * A TED eredményhirdetéseiből: kik nyernek a mi piacunkon (a figyelőprofilok
 * országai és CPV-kódjai), hányszor, mennyiért, hány ajánlattevő mellett — és
 * kik a legtöbbet kiíró ajánlatkérők. Ez az ár- és a BID/No BID döntés alapja.
 */

const IDOSZAKOK = [12, 24, 36];

function ertekek(v: Record<string, number>): string {
  const r = Object.entries(v ?? {}).filter(([, x]) => x > 0).map(([c, x]) => penz(x, c)).filter(Boolean);
  return r.length ? r.join(' + ') : '—';
}

export function Piac() {
  const { profiles } = useTenderWatchProfiles();
  const tedProfilok = profiles.filter((p) => (p.sourceType ?? 'ted') === 'ted');
  const [profil, setProfil] = useState<string | null>(null);
  const [honap, setHonap] = useState(24);
  const [kereses, setKereses] = useState('');
  const [oldal, setOldal] = useState(1);
  const [frissul, setFrissul] = useState(false);

  useEffect(() => { setOldal(1); }, [profil, honap, kereses]);

  const { piac, isLoading, mutate } = usePiac({ profileId: profil, months: honap });
  const eredmenyek = usePiacEredmenyek({ profileId: profil, months: honap, search: kereses || undefined, page: oldal });
  const oldalak = Math.max(1, Math.ceil(eredmenyek.total / eredmenyek.limit));

  async function frissites() {
    setFrissul(true);
    try {
      const r = await procurementApi.piacFrissites();
      toast.success(`Az eredmények letöltése elindult (${r.profiles} profil). Az első letöltés pár percig tart — utána frissítsd az oldalt.`);
      setTimeout(() => { mutate(); eredmenyek.mutate(); }, 30_000);
    } catch (err: any) {
      toast.error(err?.response?.status === 429 ? 'Nemrég indítottad — pár perc múlva újra.' : 'Nem sikerült elindítani.');
    } finally {
      setFrissul(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500 max-w-2xl">
          A TED eredményhirdetéseiből: ki nyer a figyelőprofilok piacán, mennyiért és hány ajánlattevő mellett.
          Az adatok 12 óránként frissülnek.
        </p>
        <button type="button" onClick={frissites} disabled={frissul}
          className="flex items-center gap-2 border border-gray-300 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
          {frissul ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Eredmények frissítése
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Piac">
          <button type="button" aria-pressed={!profil} onClick={() => setProfil(null)}
            className={clsx('text-xs rounded-full px-3 py-1.5 border font-medium',
              !profil ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50')}>
            Minden aktív profil
          </button>
          {tedProfilok.map((p) => (
            <button key={p.id} type="button" aria-pressed={profil === p.id} onClick={() => setProfil(profil === p.id ? null : p.id)}
              className={clsx('text-xs rounded-full px-3 py-1.5 border inline-flex items-center gap-1',
                profil === p.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100')}>
              <Star className="w-3 h-3" /> {p.name}
            </button>
          ))}
        </div>
        <select value={honap} onChange={(e) => setHonap(Number(e.target.value))} aria-label="Időszak"
          className="ml-auto px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
          {IDOSZAKOK.map((h) => <option key={h} value={h}>Utolsó {h} hónap</option>)}
        </select>
      </div>

      <SajatAdatbazis />

      {isLoading && !piac ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
      ) : !piac || piac.results === 0 ? (
        <div className="text-center py-12 space-y-2 bg-white border border-gray-200 rounded-xl">
          <Trophy className="w-10 h-10 text-gray-300 mx-auto" />
          <p className="text-gray-600 text-sm font-medium">Még nincs eredményadat ehhez a piachoz.</p>
          <p className="text-gray-400 text-xs">Az első letöltés profilonként két év eredményhirdetését hozza — indítsd el fent az „Eredmények frissítése” gombbal.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Kpi cimke="Eredményhirdetés" ertek={piac.results.toLocaleString('hu-HU')} al={`${datum(piac.period.from)} – ${datum(piac.period.to)}`} />
            <Kpi cimke="Átlagos ajánlatszám" ertek={piac.avgOffers != null ? String(piac.avgOffers) : '—'} al="ajánlattevő eljárásonként" />
            <Kpi cimke="Ajánlatkérő" ertek={piac.buyers.toLocaleString('hu-HU')} al={`${piac.unsuccessful} lezárult nyertes nélkül`} />
            <Kpi cimke="Nyertes ár / becsült érték"
              ertek={piac.valueToEstimate ? `${Math.round(piac.valueToEstimate.median * 100)}%` : '—'}
              al={piac.valueToEstimate ? `medián, ${piac.valueToEstimate.count} eljárás alapján` : 'nincs összevethető adat'} />
            <Kpi cimke="Nyertes ár (medián)"
              ertek={piac.valueByCurrency[0] ? penz(piac.valueByCurrency[0].median, piac.valueByCurrency[0].currency) ?? '—' : '—'}
              al={piac.valueByCurrency.map((v) => `${v.count} adat ${v.currency}`).join(' · ') || 'nincs nyilvános ár'} />
          </div>

          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <h2 className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" /> Versenytársak — kik nyernek
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-gray-400 bg-gray-50">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Cég</th>
                    <th className="text-right font-medium px-3 py-2">Nyert</th>
                    <th className="text-right font-medium px-3 py-2">Ajánlatkérő</th>
                    <th className="text-right font-medium px-3 py-2">Átl. ajánlat</th>
                    <th className="text-right font-medium px-3 py-2" title="A nyertes ár a becsült érték hány százaléka (medián)">Ár / becsült</th>
                    <th className="text-right font-medium px-3 py-2">Nyert érték</th>
                    <th className="text-right font-medium px-4 py-2">Utoljára</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {piac.competitors.map((c) => (
                    <tr key={c.name} className={clsx(c.own && 'bg-green-50/60')}>
                      <td className="px-4 py-2 min-w-[220px]">
                        <button type="button" onClick={() => setKereses(c.name)} title="Az eredményei"
                          className={clsx('font-medium text-left hover:underline', c.own ? 'text-green-800' : 'text-gray-900')}>
                          {c.name}
                        </button>
                        <div className="text-xs text-gray-500">
                          {[c.city, c.country, c.size ? MERET_FELIRAT[c.size] ?? c.size : null].filter(Boolean).join(' · ')}
                        </div>
                        {c.sampleBuyers.length > 0 && <div className="text-[11px] text-gray-400 truncate max-w-[340px]">pl. {c.sampleBuyers.join(', ')}</div>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{c.wins}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.buyers}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.avgOffers ?? '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.valueToEstimate != null ? `${Math.round(c.valueToEstimate * 100)}%` : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{ertekek(c.valueByCurrency)}</td>
                      <td className="px-4 py-2 text-right text-xs text-gray-500 whitespace-nowrap">{datum(c.lastWin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100">
              A nyert érték csak az egyedüli nyertessel zárult, nyilvános árú eljárásokat számolja — a közös (konzorciumi / több részes) nyeréseket nem osztjuk szét.
            </p>
          </section>

          {(piac.frequentBidders?.length ?? 0) > 0 && (
            <section className="bg-white border border-gray-200 rounded-xl" data-testid="gyakori-indulok">
              <h2 className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" /> Ki indul rendszeresen — nyertesek és vesztesek
              </h2>
              <ul className="divide-y divide-gray-100">
                {piac.frequentBidders!.map((b) => (
                  <li key={b.name} className={clsx('px-4 py-2 flex items-center gap-3 text-sm', b.own && 'bg-green-50/60')}>
                    <button type="button" onClick={() => setKereses(b.name)} className="flex-1 min-w-0 text-left hover:underline text-gray-900 truncate">{b.name}</button>
                    <span className="tabular-nums text-gray-700 shrink-0">{b.bids} indulás</span>
                    <span className="tabular-nums text-gray-700 shrink-0">{b.wins} nyerés</span>
                    <span className="tabular-nums text-gray-500 shrink-0 w-24 text-right">{b.winRate != null ? `${Math.round(b.winRate * 100)}% nyerési arány` : 'arány: kevés adat'}</span>
                  </li>
                ))}
              </ul>
              <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100">
                A TED eredményhirdetéseinek ajánlattevő-listájából. Sok hirdetmény csak a nyertest sorolja fel — a nyerési arányt ezért csak azokból számoljuk, ahol a vesztesek is szerepelnek (legalább 3 ilyen eljárás kell). A vesztesek árát csak az összegezés adja — ezt a saját eredményeknél lehet rögzíteni.
              </p>
            </section>
          )}

          <section className="bg-white border border-gray-200 rounded-xl">
            <h2 className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" /> A legtöbbet kiíró ajánlatkérők
            </h2>
            <ul className="divide-y divide-gray-100">
              {piac.topBuyers.map((b) => (
                <li key={b.name} className="px-4 py-2 flex items-center gap-3 text-sm">
                  <button type="button" onClick={() => setKereses(b.name)} className="flex-1 min-w-0 text-left hover:underline text-gray-900 truncate">
                    {b.name}{b.country ? <span className="text-gray-400"> · {b.country}</span> : null}
                  </button>
                  <span className="tabular-nums text-gray-700 shrink-0">{b.results} eljárás</span>
                  <span className="tabular-nums text-gray-500 shrink-0 hidden sm:inline">{b.avgOffers != null ? `átl. ${b.avgOffers} ajánlat` : ''}</span>
                  <span className="tabular-nums text-gray-500 shrink-0 hidden md:inline">{ertekek(b.valueByCurrency)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-900">Legutóbbi eredmények ({eredmenyek.total.toLocaleString('hu-HU')})</h2>
          <div className="relative flex-1 min-w-[220px] max-w-md ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={kereses} onChange={(e) => setKereses(e.target.value)}
              placeholder="Keresés: cím, ajánlatkérő vagy nyertes…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        </div>
        {eredmenyek.items.length === 0 ? (
          <p className="text-sm text-gray-400">{eredmenyek.isLoading ? 'Betöltés…' : 'Nincs találat.'}</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {eredmenyek.items.map((e) => <EredmenyKartya key={e.id} e={e} cimmel />)}
          </div>
        )}
        {oldalak > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button type="button" onClick={() => setOldal((p) => Math.max(1, p - 1))} disabled={oldal <= 1}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40">Előző</button>
            <span className="text-sm text-gray-500">{oldal} / {oldalak}</span>
            <button type="button" onClick={() => setOldal((p) => Math.min(oldalak, p + 1))} disabled={oldal >= oldalak}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40">Következő</button>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ cimke, ertek, al }: { cimke: string; ertek: string; al?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{cimke}</div>
      <div className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">{ertek}</div>
      {al && <div className="text-[11px] text-gray-500 mt-0.5 truncate">{al}</div>}
    </div>
  );
}
