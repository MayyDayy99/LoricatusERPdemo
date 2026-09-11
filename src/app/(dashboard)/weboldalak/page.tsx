'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Globe, RefreshCw, BarChart2, AlertTriangle, Users, Eye, Clock,
  MousePointer, Monitor, Smartphone, MapPin, Link2, Chrome, Compass,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useWebsitesLatest,
  useWebsitesSyncStatus,
  triggerWebsitesSync,
  useWebsitesSummary,
  type ClarityMetric,
  type ClarityDaySnapshot,
  type ClaritySummary,
} from '@/lib/hooks/use-websites';

/* ────────────────────────────────────────────────────────────────
   Segéd-formázók
   ──────────────────────────────────────────────────────────────── */

function fmtNumber(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(Math.round(n));
}

function fmtSeconds(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 60) return `${Math.round(n)}s`;
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60);
  return `${m}p ${s}s`;
}

function fmtPct(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('hu-HU');
}

/** hh:mm:ss visszaszámláló egy másodperc-számból. */
function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Első info-sor egy metrikatömbből (Clarity Traffic-metrikák jellemzően 1-elemesek). */
function firstInfo(metrics: ClarityMetric[] | null | undefined, name: string): Record<string, unknown> | null {
  if (!Array.isArray(metrics)) return null;
  const m = metrics.find((x) => x.metricName?.toLowerCase() === name.toLowerCase());
  return m?.information?.[0] ?? null;
}

/** A dimenzió-adatokat "címke → érték" bontásra hozza. Robusztus a Clarity mezőneveire. */
function extractBars(metrics: ClarityMetric[] | null | undefined): Array<{ label: string; value: number }> {
  if (!Array.isArray(metrics) || metrics.length === 0) return [];
  const rows = metrics[0]?.information ?? [];
  const result: Array<{ label: string; value: number }> = [];
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    // Több lehetséges kulcs-forma: { name, sessions } | { name, value } | { Country, count } stb.
    const labelKey = ['name', 'dimension', 'title', 'value', 'key'].find((k) => typeof r[k] === 'string')
      ?? Object.keys(r).find((k) => typeof r[k] === 'string');
    const numKey = Object.keys(r).find((k) => k !== labelKey && Number.isFinite(Number(r[k])));
    if (labelKey && numKey) {
      result.push({ label: String(r[labelKey]), value: Number(r[numKey]) });
    }
  }
  return result.sort((a, b) => b.value - a.value).slice(0, 10);
}

/* ────────────────────────────────────────────────────────────────
   UI részek — KPI kártya, Bar-lista, Tab-nav
   ──────────────────────────────────────────────────────────────── */

function KpiCard({
  icon: Icon, label, value, sublabel, color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sublabel?: string;
  color: 'blue' | 'purple' | 'emerald' | 'amber' | 'rose' | 'sky';
}) {
  const palette: Record<string, { bg: string; text: string; ring: string }> = {
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    ring: 'ring-blue-100' },
    purple:  { bg: 'bg-purple-50',  text: 'text-purple-600',  ring: 'ring-purple-100' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   ring: 'ring-amber-100' },
    rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',    ring: 'ring-rose-100' },
    sky:     { bg: 'bg-sky-50',     text: 'text-sky-600',     ring: 'ring-sky-100' },
  };
  const p = palette[color];
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition ring-1 ${p.ring}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</div>
          <div className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{value}</div>
          {sublabel && <div className="text-xs text-gray-400 mt-1">{sublabel}</div>}
        </div>
        <div className={`w-11 h-11 rounded-xl ${p.bg} ${p.text} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function BarList({
  title, icon: Icon, items, color,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Array<{ label: string; value: number }>;
  color: 'blue' | 'purple' | 'emerald' | 'amber' | 'sky' | 'rose';
}) {
  const barColor: Record<string, string> = {
    blue: 'bg-blue-500', purple: 'bg-purple-500', emerald: 'bg-emerald-500',
    amber: 'bg-amber-500', sky: 'bg-sky-500', rose: 'bg-rose-500',
  };
  const max = items.reduce((m, x) => Math.max(m, x.value), 0) || 1;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">Nincs adat.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it, i) => (
            <li key={`${it.label}-${i}`}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-700 font-medium truncate max-w-[70%]" title={it.label}>{it.label}</span>
                <span className="text-gray-500 tabular-nums">{fmtNumber(it.value)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColor[color]} rounded-full transition-all`}
                  style={{ width: `${(it.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type TabKey = 'overview' | 'audience' | 'geo' | 'pages';
const TABS: ReadonlyArray<{ key: TabKey; label: string; short: string }> = [
  { key: 'overview', label: 'Áttekintés', short: 'Fő számok' },
  { key: 'audience', label: 'Közönség',   short: 'Böngésző, eszköz' },
  { key: 'geo',      label: 'Földrajz',   short: 'Országok' },
  { key: 'pages',    label: 'Tartalom',   short: 'Népszerű oldalak' },
];

function TabNav({ current, onChange }: { current: TabKey; onChange: (k: TabKey) => void }) {
  return (
    <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl w-fit">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            current === t.key
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="block">{t.label}</span>
          <span className="block text-[10px] font-normal text-gray-400 leading-tight">{t.short}</span>
        </button>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Sync-gomb + rate-limit-badge + visszaszámláló
   ──────────────────────────────────────────────────────────────── */

function SyncButton({ onSynced }: { onSynced: () => void }) {
  const { status, mutate: refreshStatus } = useWebsitesSyncStatus();
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = useMemo(() => {
    if (!status) return 0;
    if (status.canSyncNow) return 0;
    return Math.max(0, status.secondsUntilAllowed - tick);
  }, [status, tick]);

  const canClick = !!status?.canSyncNow || remaining <= 0;

  async function handleClick() {
    if (busy || !canClick) return;
    setBusy(true);
    try {
      const result = await triggerWebsitesSync();
      toast.success(`Szinkron kész — nap: ${result.capturedDate}`);
      await refreshStatus();
      onSynced();
      setTick(0);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'A szinkront most nem futtathatod.';
      toast.error(msg);
      await refreshStatus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={handleClick}
        disabled={busy || !canClick}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition shadow-sm hover:shadow"
      >
        <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
        {busy ? 'Szinkronizálás…' : 'Szinkronizálás most'}
      </button>

      {remaining > 0 && (
        <div className="flex items-center gap-2 text-sm bg-white border border-gray-200 rounded-xl px-3 py-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-gray-500">Következő:</span>
          <span className="font-mono font-semibold text-gray-900 tabular-nums">{formatCountdown(remaining)}</span>
        </div>
      )}

      {status?.limit && (
        <span
          className="inline-flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1"
          title={`Clarity Data Export API: ${status.limit.dailyApiLimit} kérés/nap tokenenként. Egy szinkron ${status.limit.requestsPerSync} kérést használ. Cooldown: ${status.limit.cooldownHours} óra.`}
        >
          <AlertTriangle className="w-3 h-3" />
          Napi limit — {status.limit.cooldownHours}h cooldown
        </span>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Summed payload builder — historikus import + minden napi rekord aggregátuma
   ──────────────────────────────────────────────────────────────── */

/** Egy overview-metrika információs objektumát összeadja több forrásból. Szám
 *  mezőket összegez; string / non-numeric mezőket az elsőt tartja meg. */
function sumInformation(sources: Array<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const src of sources) {
    for (const [k, v] of Object.entries(src)) {
      const num = Number(v);
      if (Number.isFinite(num) && typeof v !== 'boolean') {
        out[k] = (Number(out[k]) || 0) + num;
      } else if (out[k] === undefined) {
        out[k] = v;
      }
    }
  }
  return out;
}

/** Bar-lista (byBrowser / byUrl / byReferrer / …) label-alapon összeadja több forrásból. */
function mergeBars(sources: Array<ClarityMetric[] | null | undefined>): ClarityMetric[] | null {
  const map = new Map<string, number>();
  let anyMetricName: string | null = null;
  for (const src of sources) {
    if (!Array.isArray(src) || src.length === 0) continue;
    const rows = src[0]?.information ?? [];
    anyMetricName = anyMetricName ?? src[0]?.metricName ?? null;
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const labelKey = ['name', 'dimension', 'title', 'key'].find((k) => typeof r[k] === 'string')
        ?? Object.keys(r).find((k) => typeof r[k] === 'string');
      const numKey = Object.keys(r).find((k) => k !== labelKey && Number.isFinite(Number(r[k])));
      if (labelKey && numKey) {
        const label = String(r[labelKey]);
        map.set(label, (map.get(label) ?? 0) + Number(r[numKey]));
      }
    }
  }
  if (map.size === 0) return null;
  const information = Array.from(map, ([name, sessions]) => ({ name, sessions }))
    .sort((a, b) => b.sessions - a.sessions);
  return [{ metricName: anyMetricName ?? 'Merged', information }];
}

/** Az összesített payload: historikus import + napi rekordok szumma-view-je.
 *  A meglévő tab-render (OverviewTab, AudienceTab, GeoTab, PagesTab) sertétlenül
 *  használhatja, mert ugyanolyan alakú mint egy napi rekord. */
function buildSummedPayload(summary: ClaritySummary): Record<string, ClarityMetric[] | null> {
  const allPayloads: Array<Record<string, ClarityMetric[] | null>> = [];
  if (summary.historicalImport) allPayloads.push(summary.historicalImport.payload);
  for (const d of summary.dailySnapshots) allPayloads.push(d.payload as Record<string, ClarityMetric[] | null>);

  // overview: metric-name-enkénti sum. A Traffic/EngagementTime/ScrollDepth etc.
  // information[0] mezőit összeadjuk numerikusan.
  const overviewByName = new Map<string, Array<Record<string, unknown>>>();
  for (const p of allPayloads) {
    if (!Array.isArray(p.overview)) continue;
    for (const m of p.overview) {
      const name = m?.metricName;
      if (!name) continue;
      const info = m.information?.[0];
      if (!info) continue;
      const arr = overviewByName.get(name) ?? [];
      arr.push(info);
      overviewByName.set(name, arr);
    }
  }
  const overview: ClarityMetric[] = Array.from(overviewByName, ([metricName, infos]) => ({
    metricName,
    information: [sumInformation(infos)],
  }));

  return {
    overview: overview.length ? overview : null,
    byBrowser: mergeBars(allPayloads.map(p => p.byBrowser)),
    byOS: mergeBars(allPayloads.map(p => p.byOS)),
    byDevice: mergeBars(allPayloads.map(p => p.byDevice)),
    byCountry: mergeBars(allPayloads.map(p => p.byCountry)),
    byUrl: mergeBars(allPayloads.map(p => p.byUrl)),
  };
}

/* ────────────────────────────────────────────────────────────────
   Fő komponensek — Tabok
   ──────────────────────────────────────────────────────────────── */

function OverviewTab({ payload, isSummary }: { payload: Record<string, ClarityMetric[] | null>; isSummary?: boolean }) {
  const traffic = firstInfo(payload.overview, 'Traffic');
  const engagement = firstInfo(payload.overview, 'EngagementTime') ?? firstInfo(payload.overview, 'Engagement Time');
  const scroll = firstInfo(payload.overview, 'ScrollDepth') ?? firstInfo(payload.overview, 'Scroll Depth');
  const popular = firstInfo(payload.overview, 'PopularPages') ?? firstInfo(payload.overview, 'Popular Pages');

  const sessions = traffic?.totalSessionCount ?? traffic?.sessions ?? traffic?.totalSessions;
  const users = traffic?.totalUsers ?? traffic?.users ?? traffic?.uniqueUsers;
  const pageViews = traffic?.totalPageViews ?? traffic?.pageViews ?? popular?.totalPageViews;
  const avgTime = engagement?.averageSessionTime ?? engagement?.avgSessionDuration ?? engagement?.totalTime;
  const avgScroll = scroll?.averageScrollDepth ?? scroll?.avgScrollDepth;

  const anyKpi = [sessions, users, pageViews, avgTime, avgScroll].some((x) => x !== undefined && x !== null);
  const sublabel = isSummary ? 'Az összesített időszakra' : 'Az utolsó napon';

  return (
    <div className="space-y-6">
      {anyKpi ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={Users}         label="Munkamenetek" value={fmtNumber(sessions)}  color="blue"    sublabel={sublabel} />
          <KpiCard icon={Users}         label="Egyedi látogatók" value={fmtNumber(users)} color="purple"  sublabel={sublabel} />
          <KpiCard icon={Eye}           label="Oldalmegtekintések" value={fmtNumber(pageViews)} color="emerald" sublabel={sublabel} />
          <KpiCard icon={Clock}         label="Átlagos idő" value={fmtSeconds(avgTime)} color="amber" sublabel="Egy munkameneten" />
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-4 text-sm">
          A Clarity még nem küldött összesített adatokat. Ez normál, ha most kötötted be az integrációt — a Clarity ~24 órát is igényelhet a first-data-hoz.
        </div>
      )}

      {avgScroll !== undefined && avgScroll !== null && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <MousePointer className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Átlagos görgetési mélység</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-sky-400 to-blue-600 rounded-full" style={{ width: fmtPct(avgScroll) }} />
            </div>
            <span className="text-lg font-bold text-gray-900 tabular-nums">{fmtPct(avgScroll)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">Milyen mélyre gördültek átlagosan a látogatóid az oldalon.</p>
        </div>
      )}
    </div>
  );
}

function AudienceTab({ payload }: { payload: Record<string, ClarityMetric[] | null> }) {
  const browsers = extractBars(payload.byBrowser);
  const os = extractBars(payload.byOS);
  const devices = extractBars(payload.byDevice);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      <BarList title="Böngészők"      icon={Chrome}     items={browsers} color="blue" />
      <BarList title="Operációs rendszer" icon={Monitor} items={os}       color="purple" />
      <BarList title="Eszközök"       icon={Smartphone} items={devices}  color="emerald" />
    </div>
  );
}

function GeoTab({ payload }: { payload: Record<string, ClarityMetric[] | null> }) {
  const countries = extractBars(payload.byCountry);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <BarList title="Országok — látogatók" icon={MapPin} items={countries} color="sky" />
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Compass className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Nyelvi tipp</h3>
        </div>
        <p className="text-sm text-gray-600">
          Ha a látogatóid többsége nem magyar, érdemes megfontolni az angol / német nyelvű nyitólap-verziót.
        </p>
      </div>
    </div>
  );
}

function PagesTab({ payload }: { payload: Record<string, ClarityMetric[] | null> }) {
  const pages = extractBars(payload.byUrl);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <BarList title="Legnépszerűbb oldalak" icon={Link2} items={pages} color="rose" />
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Mit jelent?</h3>
        </div>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>• A látogatók által legtöbbször megnyitott oldalak.</li>
          <li>• Ha a főoldalad nincs az első helyen, valamilyen kampány / hirdetés terelheti a forgalmat egy másik URL-re.</li>
          <li>• A / és a /home különálló oldalnak számít, ha a router két külön útvonalat kezel.</li>
        </ul>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Fő page
   ──────────────────────────────────────────────────────────────── */

type ViewMode = 'summary' | 'latest';

export default function WeboldalakPage() {
  const { latest, isLoading, error, mutate: refreshLatest } = useWebsitesLatest();
  const { summary, mutate: refreshSummary } = useWebsitesSummary();
  const [tab, setTab] = useState<TabKey>('overview');
  // Alap-nézet: ha van historikus import VAGY több napi rekord, akkor összesítve
  // (ez amit a felhasználó akar). Csak 1 nap → mindig latest.
  const hasMultiple = !!summary && (summary.historicalImport || summary.dailySnapshots.length > 1);
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  useEffect(() => {
    // Ha az adatszerkezet nem enged összesítést, kényszerítsük latest-re.
    if (!hasMultiple && viewMode === 'summary') setViewMode('latest');
  }, [hasMultiple, viewMode]);

  // A tabokba beadott payload — attól függ mit választott a user
  const summedPayload = useMemo(
    () => (summary ? buildSummedPayload(summary) : null),
    [summary],
  );
  const displayPayload = viewMode === 'summary' && summedPayload ? summedPayload : latest?.payload ?? null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-gradient-to-b from-gray-50 to-white min-h-screen">
      {/* ── Fejléc ─────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-md">
            <Globe className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Weboldalak</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Weboldalad látogatói-statisztikák a Microsoft Clarity-ből
            </p>
          </div>
        </div>
        <SyncButton onSynced={() => { refreshLatest(); refreshSummary(); }} />
      </header>

      {/* ── View toggle: Összesített időszak / Legutóbbi nap ─────── */}
      {hasMultiple && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex bg-gray-100 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setViewMode('summary')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                viewMode === 'summary'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Összesített időszak
            </button>
            <button
              type="button"
              onClick={() => setViewMode('latest')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                viewMode === 'latest'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Legutóbbi nap
            </button>
          </div>
          {viewMode === 'summary' && summary?.totalPeriodStart && (
            <span className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">{summary.totalPeriodStart}</span>
              {' '}óta
              {summary.totalPeriodEnd && summary.totalPeriodEnd !== summary.totalPeriodStart && (
                <> — <span className="font-medium text-gray-700">{summary.totalPeriodEnd}</span></>
              )}
              {' '}(historikus import + minden napi rekord)
            </span>
          )}
        </div>
      )}

      {/* ── Meta-sor: adatnap + frissítve (csak latest-modban) ────── */}
      {latest && viewMode === 'latest' && (
        <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
          <span>
            📅 Adat napja:{' '}
            <span className="font-semibold text-gray-800">{latest.capturedDate}</span>
          </span>
          <span className="text-gray-300">·</span>
          <span>
            🕒 Frissítve:{' '}
            <span className="font-medium text-gray-700">{fmtDateTime(latest.fetchedAt)}</span>
          </span>
        </div>
      )}

      {/* ── Betöltés / hiba / üres ─────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" /> Betöltés…
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          Nem sikerült betölteni a weboldal-adatokat.
        </div>
      )}

      {!isLoading && !error && !latest && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 flex items-center justify-center mx-auto mb-4">
            <BarChart2 className="w-8 h-8" />
          </div>
          <p className="text-lg font-semibold text-gray-800">Még nincs adat</p>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
            A napi szinkron még nem futott le, vagy nincs Microsoft Clarity token bekötve az{' '}
            <a href="/settings/integrations" className="text-brand-600 hover:underline font-medium">
              Integrációk
            </a>{' '}
            fülön. A token megadása után nyomd meg a "Szinkronizálás most" gombot, vagy várj a napi automatikus lehívásra.
          </p>
        </div>
      )}

      {/* ── Tabok + tartalom ───────────────────────────────────── */}
      {displayPayload && (
        <>
          <TabNav current={tab} onChange={setTab} />
          <div className="pt-2">
            {tab === 'overview' && <OverviewTab payload={displayPayload} isSummary={viewMode === 'summary'} />}
            {tab === 'audience' && <AudienceTab payload={displayPayload} />}
            {tab === 'geo'      && <GeoTab      payload={displayPayload} />}
            {tab === 'pages'    && <PagesTab    payload={displayPayload} />}
          </div>
        </>
      )}
    </div>
  );
}
