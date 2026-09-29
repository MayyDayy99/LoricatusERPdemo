'use client';

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Pencil, Plus, Search, Sparkles } from 'lucide-react';

import { procurementApi, useBeszerzesiForrasok, type BeszerzesiForras } from '@/lib/hooks/use-procurement';
import { INPUT, Modal, Mezo, ModalGombok } from './ui';

/**
 * ── BESZERZÉSI RADAR ────────────────────────────────────────────────────────
 *
 * Hol tartunk a beszállítói felületeken: mely együttműködések élnek, hol fut
 * regisztráció, melyik jelölt, és mikor néztük át utoljára. 2026-09-23 óta
 * az ADATBÁZISBÓL (Procurement Source), szerkeszthetően — Claude is vehet fel
 * új forrást (MCP: `register_procurement_source`).
 *
 * Az „átnéztem" jelölés közös: a `last_checked_at` mező, nem a böngésző tárolója
 * — így mindenki ugyanazt látja.
 */

const ALLAPOT_NEVEK: Record<BeszerzesiForras['registrationStatus'], string> = {
  registered: 'Aktív beszállító',
  in_progress: 'Regisztráció folyamatban',
  candidate: 'Jelölt',
  not_available: 'Nincs online felület',
  rejected: 'Elvetve',
};

const KATEGORIA_NEVEK: Record<string, string> = {
  energia: 'Energia', tavkozles: 'Távközlés', penzugy: 'Pénzügy', ipar: 'Ipar',
  kozlekedes: 'Közlekedés / infrastruktúra', epitoipar: 'Építőipar', vizugy: 'Vízügy',
  kozbeszerzes: 'Állami közbeszerzés', logisztika: 'Logisztika', platform: 'Platform / supplier network',
};

const HOZZAFERES: Record<string, string> = {
  api: 'API', rss: 'RSS', export: 'Export', email_alert: 'E-mail értesítő', search: 'Kereső', login: 'Belépés',
};

function kategoria(f: BeszerzesiForras): string {
  if (f.kind === 'supplier_network' || f.kind === 'aggregator') return 'platform';
  return f.sectors[0] ?? 'egyeb';
}

/** Ugyanazon az ISO-héten (hétfőtől) van-e a dátum, mint ma. */
function ezenAHeten(datum: string | null): boolean {
  if (!datum) return false;
  const hetfo = (d: Date) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x.getTime();
  };
  return hetfo(new Date(`${datum}T12:00:00`)) === hetfo(new Date());
}

export function BeszerzesiRadar({ onKiirasok }: { onKiirasok: (f: { id: string; nev: string }) => void }) {
  const { forrasok, isLoading, mutate } = useBeszerzesiForrasok();
  const [kereses, setKereses] = useState('');
  const [kat, setKat] = useState<string>('mind');
  const [szerkesztett, setSzerkesztett] = useState<BeszerzesiForras | 'uj' | null>(null);

  const elo = forrasok.filter((f) => f.registrationStatus === 'registered' || f.registrationStatus === 'in_progress');
  const tobbi = forrasok.filter((f) => !elo.includes(f) && f.registrationStatus !== 'rejected');
  const jeloltek = useMemo(() => {
    const q = kereses.trim().toLowerCase();
    return tobbi
      .filter((f) => kat === 'mind' || kategoria(f) === kat)
      .filter((f) => !q || f.name.toLowerCase().includes(q) || (f.platform ?? '').toLowerCase().includes(q));
  }, [tobbi, kereses, kat]);
  const kategoriak = useMemo(() => ['mind', ...Array.from(new Set(tobbi.map(kategoria)))], [tobbi]);

  const atnezve = forrasok.filter((f) => ezenAHeten(f.lastCheckedAt)).length;
  const kiirasok = forrasok.reduce((n, f) => n + f.performance.opportunities, 0);

  async function atneztem(f: BeszerzesiForras) {
    try {
      await procurementApi.forrasAtnezve(f.id);
      await mutate();
    } catch {
      toast.error('Nem sikerült rögzíteni.');
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-40"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Szamlalo ertek={elo.length} felirat="Élő kapcsolat" />
        <Szamlalo ertek={jeloltek.length} felirat={kat === 'mind' && !kereses ? 'Jelölt és feltérképezendő' : 'Szűrt találat'} />
        <Szamlalo ertek={kiirasok} felirat="Hozzájuk kötött kiírás" />
        <Szamlalo ertek={`${atnezve} / ${forrasok.length}`} felirat="Átnézve ezen a héten" />
      </div>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <header className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Aktív együttműködések</h2>
            <p className="text-xs text-gray-500 mt-0.5">A már működő és az épp induló beszállítói kapcsolatok.</p>
          </div>
          <button type="button" onClick={() => setSzerkesztett('uj')}
            className="inline-flex items-center gap-1.5 text-xs font-medium border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
            <Plus className="w-3.5 h-3.5" /> Új forrás
          </button>
        </header>
        <ul className="divide-y divide-gray-100">
          {elo.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-5 py-3">
              <AtneztemPipa f={f} onPipa={() => atneztem(f)} />
              <div className="min-w-[12rem] flex-1">
                <div className="text-sm font-semibold text-gray-900">{f.name}</div>
                {f.subtitle && <div className="text-xs text-gray-500">{f.subtitle}</div>}
              </div>
              <AllapotCimke allapot={f.registrationStatus} />
              <div className="text-xs text-gray-500 min-w-[9rem]">{f.platform}</div>
              <KiirasGomb f={f} onKiirasok={onKiirasok} />
              <SzerkesztGomb onClick={() => setSzerkesztett(f)} />
              <MegnyitasGomb link={f.url} />
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-3">
        <label className="relative block max-w-md">
          <span className="sr-only">Keresés név vagy rendszer szerint</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input value={kereses} onChange={(e) => setKereses(e.target.value)} placeholder="Keresés név vagy rendszer szerint…"
            className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </label>
        <div className="flex flex-wrap gap-2">
          {kategoriak.map((k) => (
            <button key={k} type="button" onClick={() => setKat(k)}
              className={clsx('px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                k === kat ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900')}>
              {k === 'mind' ? 'Mind' : KATEGORIA_NEVEK[k] ?? k}
            </button>
          ))}
        </div>
      </div>

      {jeloltek.length === 0 ? (
        <p className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-10 text-center text-sm text-gray-500">
          Nincs találat — próbálj más keresőszót vagy kategóriát.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {jeloltek.map((f) => (
            <ForrasKartya key={f.id} f={f} onPipa={() => atneztem(f)} onSzerkeszt={() => setSzerkesztett(f)} onKiirasok={onKiirasok} />
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">
        Claude-dal új forrásokat is kerestethetsz („Keress új leadforrásokat Olaszországban") — amit felvesz, itt jelenik meg,
        „Claude találta" jelöléssel. A regisztrációról mindig ember dönt.
      </p>

      {szerkesztett && (
        <ForrasModal f={szerkesztett === 'uj' ? null : szerkesztett} onBezar={() => setSzerkesztett(null)}
          onKesz={async () => { setSzerkesztett(null); await mutate(); }} />
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

function AllapotCimke({ allapot }: { allapot: BeszerzesiForras['registrationStatus'] }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap', {
      'bg-green-50 text-green-700': allapot === 'registered',
      'bg-amber-50 text-amber-800': allapot === 'in_progress',
      'bg-brand-50 text-brand-800': allapot === 'candidate',
      'bg-gray-100 text-gray-600': allapot === 'not_available' || allapot === 'rejected',
    })}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', {
        'bg-green-600': allapot === 'registered',
        'bg-amber-500': allapot === 'in_progress',
        'bg-brand-600': allapot === 'candidate',
        'bg-gray-400': allapot === 'not_available' || allapot === 'rejected',
      })} />
      {ALLAPOT_NEVEK[allapot]}
    </span>
  );
}

function MegnyitasGomb({ link }: { link: string | null }) {
  if (!link) return <span className="text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg px-3 py-1.5">Nincs link</span>;
  return (
    <a href={link} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-800">
      <ExternalLink className="w-3.5 h-3.5" /> Megnyitás
    </a>
  );
}

function SzerkesztGomb({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title="Szerkesztés"
      className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 hover:bg-gray-50">
      <Pencil className="w-3.5 h-3.5" />
    </button>
  );
}

function KiirasGomb({ f, onKiirasok }: { f: BeszerzesiForras; onKiirasok: (f: { id: string; nev: string }) => void }) {
  if (f.performance.opportunities === 0) return null;
  return (
    <button type="button" onClick={() => onKiirasok({ id: f.id, nev: f.name })}
      className="text-xs font-medium text-brand-700 hover:underline">
      {f.performance.opportunities} kiírás{f.performance.qualified ? ` · ${f.performance.qualified} minősített` : ''}
    </button>
  );
}

function AtneztemPipa({ f, onPipa }: { f: BeszerzesiForras; onPipa: () => void }) {
  const kesz = ezenAHeten(f.lastCheckedAt);
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer" title={kesz ? 'Ezen a héten átnézve' : 'Átnéztem — most'}>
      <input type="checkbox" checked={kesz} disabled={kesz} onChange={onPipa} aria-label={`${f.name} — ezen a héten átnéztem`}
        className="w-4 h-4 rounded border-gray-300 accent-brand-700 cursor-pointer" />
    </label>
  );
}

function EllenorzesCimke({ datum }: { datum: string | null }) {
  if (ezenAHeten(datum)) {
    return <span className="inline-flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="w-3.5 h-3.5" /> Ezen a héten átnézve</span>;
  }
  if (!datum) {
    return <span className="inline-flex items-center gap-1 text-xs text-amber-700"><AlertTriangle className="w-3.5 h-3.5" /> Még nem ellenőrizve</span>;
  }
  const napok = Math.floor((Date.now() - new Date(`${datum}T12:00:00`).getTime()) / 86400000);
  if (napok > 7) {
    return <span className="inline-flex items-center gap-1 text-xs text-amber-700"><AlertTriangle className="w-3.5 h-3.5" /> Frissítsd — {napok} napja</span>;
  }
  return <span className="text-xs text-gray-500">Ellenőrizve: {napok <= 0 ? 'ma' : `${napok} napja`}</span>;
}

function ForrasKartya({ f, onPipa, onSzerkeszt, onKiirasok }: {
  f: BeszerzesiForras; onPipa: () => void; onSzerkeszt: () => void; onKiirasok: (f: { id: string; nev: string }) => void;
}) {
  return (
    <article className="flex flex-col gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">
            {KATEGORIA_NEVEK[kategoria(f)] ?? kategoria(f)}{f.countries.length ? ` · ${f.countries.join(', ')}` : ''}
          </div>
          <h3 className="text-base font-semibold text-gray-900 mt-0.5 break-words">{f.name}</h3>
          {f.subtitle && <div className="text-xs text-gray-500">{f.subtitle}</div>}
        </div>
        <AtneztemPipa f={f} onPipa={onPipa} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <AllapotCimke allapot={f.registrationStatus} />
        {f.platform && <span className="text-[11px] text-gray-500 border border-gray-200 rounded-full px-2 py-0.5">{f.platform}</span>}
        {f.sourceScore != null && (
          <span className="text-[11px] font-semibold text-brand-800 bg-brand-50 rounded-full px-2 py-0.5" title={f.scoreReason ?? undefined}>
            Source Score {f.sourceScore}
          </span>
        )}
        {f.discoveredVia === 'claude' && (
          <span className="inline-flex items-center gap-1 text-[11px] text-purple-700 bg-purple-50 rounded-full px-2 py-0.5">
            <Sparkles className="w-3 h-3" /> Claude találta
          </span>
        )}
      </div>

      {f.notes && <p className="text-sm text-gray-600 leading-relaxed">{f.notes}</p>}

      <div className="text-xs text-gray-500 space-y-0.5">
        <div>
          Beszállítói regisztráció: <b>{f.supplierRegistration === 'yes' ? 'van' : f.supplierRegistration === 'no' ? 'nincs' : 'nem tudjuk'}</b>
          {f.mfa !== 'unknown' && f.mfa !== 'none' ? ` · MFA: ${f.mfa}` : ''}
          {f.cost !== 'unknown' ? ` · ${f.cost === 'free' ? 'ingyenes' : 'fizetős'}` : ''}
        </div>
        {f.accessMethods.length > 0 && <div>Hozzáférés: {f.accessMethods.map((a) => HOZZAFERES[a] ?? a).join(', ')}</div>}
      </div>

      <div className="mt-auto pt-2 flex items-center justify-between gap-2 flex-wrap">
        <EllenorzesCimke datum={f.lastCheckedAt} />
        <div className="flex items-center gap-2">
          <KiirasGomb f={f} onKiirasok={onKiirasok} />
          <SzerkesztGomb onClick={onSzerkeszt} />
          <MegnyitasGomb link={f.url} />
        </div>
      </div>
    </article>
  );
}

function ForrasModal({ f, onBezar, onKesz }: { f: BeszerzesiForras | null; onBezar: () => void; onKesz: () => Promise<void> }) {
  const [adat, setAdat] = useState({
    name: f?.name ?? '',
    platform: f?.platform ?? '',
    url: f?.url ?? '',
    countries: (f?.countries ?? ['HU']).join(', '),
    registrationStatus: f?.registrationStatus ?? 'candidate',
    supplierRegistration: f?.supplierRegistration ?? 'unknown',
    monitoring: f?.monitoring ?? 'undecided',
    sourceScore: f?.sourceScore != null ? String(f.sourceScore) : '',
    notes: f?.notes ?? '',
  });
  const [dolgozik, setDolgozik] = useState(false);
  const allit = (k: keyof typeof adat) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setAdat((r) => ({ ...r, [k]: e.target.value }));

  async function ment() {
    setDolgozik(true);
    const torzs = {
      name: adat.name.trim(),
      platform: adat.platform.trim() || undefined,
      url: adat.url.trim() || undefined,
      countries: adat.countries.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean),
      registrationStatus: adat.registrationStatus,
      supplierRegistration: adat.supplierRegistration,
      monitoring: adat.monitoring,
      sourceScore: adat.sourceScore === '' ? undefined : Math.max(0, Math.min(100, Number(adat.sourceScore))),
      notes: adat.notes.trim() || undefined,
    };
    try {
      if (f) await procurementApi.forrasModosit(f.id, torzs);
      else await procurementApi.forrasFelvesz(torzs);
      toast.success('Mentve.');
      await onKesz();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Nem sikerült menteni.');
    } finally {
      setDolgozik(false);
    }
  }

  return (
    <Modal cim={f ? f.name : 'Új beszerzési forrás'} onBezar={onBezar} szeles>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Mezo cimke="Név"><input value={adat.name} onChange={allit('name')} className={INPUT} /></Mezo>
        <Mezo cimke="Rendszer / platform"><input value={adat.platform} onChange={allit('platform')} className={INPUT} placeholder="SAP Ariba, EKR…" /></Mezo>
        <Mezo cimke="Link"><input value={adat.url} onChange={allit('url')} className={INPUT} placeholder="https://…" /></Mezo>
        <Mezo cimke="Országok (vesszővel)"><input value={adat.countries} onChange={allit('countries')} className={INPUT} /></Mezo>
        <Mezo cimke="A Loricatus állapota">
          <select value={adat.registrationStatus} onChange={allit('registrationStatus')} className={INPUT}>
            {Object.entries(ALLAPOT_NEVEK).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Mezo>
        <Mezo cimke="Beszállítói regisztráció lehetséges?">
          <select value={adat.supplierRegistration} onChange={allit('supplierRegistration')} className={INPUT}>
            <option value="yes">Igen</option><option value="no">Nem</option><option value="unknown">Nem tudjuk</option>
          </select>
        </Mezo>
        <Mezo cimke="Figyeljük?">
          <select value={adat.monitoring} onChange={allit('monitoring')} className={INPUT}>
            <option value="monitor">Igen, figyeljük</option><option value="undecided">Még nem döntöttük el</option><option value="ignore">Nem</option>
          </select>
        </Mezo>
        <Mezo cimke="Source Score (0–100)"><input value={adat.sourceScore} onChange={allit('sourceScore')} inputMode="numeric" className={INPUT} /></Mezo>
      </div>
      <Mezo cimke="Tudnivalók"><textarea value={adat.notes} onChange={allit('notes')} rows={4} className={INPUT} /></Mezo>
      <ModalGombok onMegse={onBezar} onOk={ment} ok={dolgozik ? '…' : 'Mentés'} tiltva={dolgozik || adat.name.trim().length < 2} />
    </Modal>
  );
}
