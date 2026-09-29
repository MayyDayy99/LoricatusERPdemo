import useSWR from 'swr';
import { apiClient } from '../api-client';

/**
 * Procurement Intelligence — a Pályázatok oldal adatai. A szerver a
 * `/procurement/*` végpontokon adja; a döntés és a draft-jóváhagyás csak
 * bejelentkezett embertől fogadható el (tokennel/MCP-vel nem).
 */

export type Sav = 'archive' | 'review' | 'qualified' | 'priority';
/** Hol tart az eljárás: fut · lejárt, eredményre vár · eredményt hirdettek · eredménytelen. */
export type Fazis = 'open' | 'closed' | 'awarded' | 'unsuccessful';
export type OppAllapot = 'new' | 'relevant' | 'dismissed' | 'watching' | 'bidding' | 'submitted' | 'won' | 'lost';

export interface Opportunity {
  id: string;
  title: string;
  buyer: string | null;
  buyerCountry: string | null;
  source: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  deadlineAt: string | null;
  daysLeft: number | null;
  estimatedValue: number | null;
  currency: string | null;
  cpvCodes: string[];
  status: OppAllapot;
  assignedTo: string | null;
  score: number | null;
  tier: Sav | null;
  scoreReason: string | null;
  scoreSource: 'rule' | 'ai' | 'claude' | 'human' | null;
  ruleScore: number | null;
  matchedCompetences: string[];
  bidRecommendation: 'bid' | 'review' | 'low_priority' | 'no_bid' | null;
  bidDecision: 'bid' | 'no_bid' | null;
  winProbability: number | null;
  nextStep: string | null;
  nextStepAt: string | null;
  outreachStatus: 'none' | 'planned' | 'in_progress' | 'engaged' | 'stalled';
  analysedAt: string | null;
  procurementSource: { id: string; name: string } | null;
  noticeType: string | null;
  /** request: csak jelentkezési (részvételi) határidő van. */
  deadlineKind: 'tender' | 'request' | null;
  phase: Fazis;
  result: {
    winners: string[]; value: number | null; currency: string | null; offersCount: number | null;
    publishedAt: string | null; ownWin: boolean;
  } | null;
  place: string | null;
  submissionUrl: string | null;
  previousDeadlineAt: string | null;
}

/** A TED-hirdetmény részletei (a szerver `TedReszletek` alakja). */
export interface KiirasReszletek {
  hirdetmenyTipus: string | null;
  szerzodesTipus: string | null;
  ajanlatHatarido: string | null;
  reszvetelHatarido: string | null;
  bontas: string | null;
  teljesitesHelye: { varosok: string[]; nuts: string[]; orszagok: string[] };
  idotartam: { ertek: number; egyseg: string } | null;
  kezdes: string | null;
  befejezes: string | null;
  ajanlatiKotottseg: { ertek: number; egyseg: string } | null;
  biralatiSzempontok: Array<{ nev: string; tipus: string | null; suly: number | null }>;
  alkalmassag: string | null;
  dokumentumUrl: string | null;
  benyujtasUrl: string | null;
  ajanlatkero: {
    email: string | null; web: string | null; varos: string | null; kapcsolattarto: string | null;
    jogiForma: string | null; fotevekenyseg: string | null;
  };
  euForras: string[] | null;
  kkv: boolean | null;
  keretmegallapodas: boolean;
  fenntartott: boolean;
  alvallalkozasEngedett: boolean | null;
  nyelvek: string[];
  reszekSzama: number;
  hirdetmenyek?: Array<{ publicationNumber: string; noticeType: string | null; publishedAt: string | null; url: string | null }>;
  korabbiHatarido?: string | null;
}

export interface Nyertes {
  name: string; country: string | null; city: string | null; size: string | null;
  identifier: string | null; email: string | null; web: string | null; own: boolean;
}

export interface Eredmeny {
  id: string;
  publicationNumber: string;
  procedureId: string | null;
  noticeType: string;
  noticeTypeName: string;
  publishedAt: string | null;
  title: string | null;
  buyer: string | null;
  buyerCountry: string | null;
  value: number | null;
  currency: string | null;
  lowestOffer: number | null;
  highestOffer: number | null;
  offersCount: number | null;
  estimatedValue: number | null;
  valueToEstimate: number | null;
  decisionDate: string | null;
  contractDate: string | null;
  unsuccessful: boolean;
  nonAwardReason: string | null;
  documentUrl: string | null;
  winners: Nyertes[];
}

export interface PiaciKep {
  buyerHistory: Eredmeny[];
  similar: {
    cpvGroups: string[];
    count: number;
    unsuccessful: number;
    avgOffers: number | null;
    value: { currency: string; count: number; p25: number; median: number; p75: number } | null;
    valueToEstimate: { median: number; count: number } | null;
    topWinners: Array<{ name: string; country: string | null; wins: number; lastWin: string | null; own: boolean }>;
  } | null;
}

export interface Piac {
  filter: { countries: string[]; cpvPrefixes: string[] };
  period: { from: string | null; to: string | null; months: number };
  results: number;
  unsuccessful: number;
  avgOffers: number | null;
  buyers: number;
  valueToEstimate: { median: number; count: number } | null;
  valueByCurrency: Array<{ currency: string; count: number; total: number; median: number }>;
  competitors: Array<{
    name: string; country: string | null; city: string | null; size: string | null; wins: number; buyers: number;
    avgOffers: number | null; lastWin: string | null; sampleBuyers: string[]; valueByCurrency: Record<string, number>; own: boolean;
    valueToEstimate: number | null;
  }>;
  topBuyers: Array<{
    name: string; country: string | null; results: number; avgOffers: number | null; lastResult: string | null;
    valueByCurrency: Record<string, number>;
  }>;
  /** Ki indul rendszeresen: az összes ajánlattevő (vesztesek is) a TED-ből. */
  frequentBidders?: Array<{ name: string; bids: number; wins: number; winRate: number | null; avgOffers: number | null; lastSeen: string | null; own: boolean }>;
}

export interface Stakeholder {
  id: string;
  companyName: string;
  companyRole: string;
  personName: string | null;
  position: string | null;
  personRole: string | null;
  influence: string;
  weight: number | null;
  priority: number | null;
  rationale: string | null;
  linkedinUrl: string | null;
  infoSourceUrl: string | null;
  createdVia: 'human' | 'claude' | 'ai';
}

export interface OutreachLepes {
  id: string;
  stakeholderId: string | null;
  sequence: number;
  strategy: string;
  channel: string;
  draft: string | null;
  plannedAt: string | null;
  status: 'draft' | 'approved' | 'sent' | 'replied' | 'no_response' | 'declined' | 'cancelled';
  approvedAt: string | null;
  sentAt: string | null;
  outcome: string | null;
  createdVia: 'human' | 'claude' | 'ai';
}

export interface OpportunityReszletek extends Opportunity {
  /** A pályázatból importált Projekt Map projekt. */
  project: { id: string; name: string } | null;
  noticeTypeName: string | null;
  procedureId: string | null;
  details: KiirasReszletek | null;
  results: Eredmeny[];
  market: PiaciKep | null;
  /** Hasonló saját munkáink (referencia-jelöltek) a rögzített eredményekből / projektekből. */
  references?: Array<{ tipus: 'eredmeny' | 'projekt' | 'palyazat'; id: string; cim: string; ev: number | null; ertek: number | null; penznem: string | null; pont: number; miert: string[] }>;
  /** Kalibrált nyerési esély: saját múlt + piaci alap (1 / ajánlatszám). */
  winEstimate?: {
    szazalek: number; forras: 'piac' | 'sajat' | 'kevert'; sajat: { db: number; nyert: number };
    szegmens: { nev: string; db: number; nyert: number } | null; ajanlatszam: number | null; magyarazat: string;
  } | null;
  description: string | null;
  analysis: Record<string, any> | null;
  analysisModel: string | null;
  bidFactors: Record<string, { ertek: number; megjegyzes: string | null }> | null;
  stakeholders: Stakeholder[];
  outreach: OutreachLepes[];
  capabilityGaps: Array<{ id: string; gapType: string; competence: string | null; description: string; severity: number; source: string }>;
  decisions: Array<{ id: string; kind: string; fromValue: string | null; toValue: string | null; reasonCodes: string[]; note: string | null; via: string; createdAt: string }>;
}

export interface BeszerzesiForras {
  id: string;
  slug: string | null;
  name: string;
  subtitle: string | null;
  kind: 'buyer_portal' | 'supplier_network' | 'public_portal' | 'aggregator' | 'other';
  platform: string | null;
  url: string | null;
  countries: string[];
  sectors: string[];
  registrationStatus: 'registered' | 'in_progress' | 'candidate' | 'not_available' | 'rejected';
  supplierRegistration: 'yes' | 'no' | 'unknown';
  accessMethods: string[];
  mfa: string;
  automation: string;
  cost: string;
  costNote: string | null;
  sourceScore: number | null;
  scoreReason: string | null;
  monitoring: 'monitor' | 'undecided' | 'ignore';
  notes: string | null;
  lastCheckedAt: string | null;
  discoveredVia: 'manual' | 'radar' | 'claude' | 'ai' | 'import';
  performance: { opportunities: number; qualified: number; bid: number; won: number; wonValue: number };
}

export interface Osszefoglalo {
  since: string;
  results: Array<{
    id: string; title: string; buyer: string | null; status: OppAllapot; score: number | null; winners: string[];
    value: number | null; currency: string | null; offersCount: number | null; unsuccessful: boolean;
    publishedAt: string | null; url: string | null;
  }>;
  deadlineChanges: Array<{
    id: string; title: string; status: OppAllapot; score: number | null; deadlineAt: string;
    previousDeadlineAt: string; daysLeft: number | null;
  }>;
  newOpportunities: {
    total: number;
    byTier: Record<Sav, number>;
    top: Array<{ id: string; title: string; buyer: string | null; country: string | null; score: number; tier: Sav; reason: string | null; daysLeft: number | null }>;
  };
  bySource: Array<{ source: string; count: number; relevant: number }>;
  critical: Array<{ id: string; title: string; buyer: string | null; status: string; score: number | null; tier: Sav | null; daysLeft: number | null }>;
  newSources: { total: number; withSupplierRegistration: number; items: Array<{ id: string; name: string; sourceScore: number | null; via: string }> };
  outreachAwaitingApproval: number;
  analysis: { pending: number; completedInPeriod: number };
  capabilityGapAlerts: Array<{ gapType: string; competence: string | null; competenceName: string | null; count: number; examples: string[]; windowDays: number }>;
}

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

export function useOpportunities(p: {
  tier?: Sav[]; status?: string; search?: string; sort?: string; page?: number; sourceId?: string; includeExpired?: boolean;
  profileId?: string; phase?: Fazis[];
  /** Kompetencia-címke szerinti szűrés (pl. `alvallalkozoi`). */
  competence?: string;
}) {
  const qs = new URLSearchParams();
  if (p.competence) qs.set('competence', p.competence);
  if (p.phase?.length) qs.set('phase', p.phase.join(','));
  if (p.tier?.length) qs.set('tier', p.tier.join(','));
  if (p.status) qs.set('status', p.status);
  if (p.search) qs.set('search', p.search);
  if (p.sort) qs.set('sort', p.sort);
  if (p.page) qs.set('page', String(p.page));
  if (p.sourceId) qs.set('sourceId', p.sourceId);
  if (p.profileId) qs.set('profileId', p.profileId);
  if (p.includeExpired) qs.set('includeExpired', 'true');
  const { data, error, isLoading, mutate } = useSWR<{ items: Opportunity[]; total: number; page: number; limit: number }>(
    `/procurement/opportunities?${qs.toString()}`, fetcher, { keepPreviousData: true },
  );
  return { items: data?.items ?? [], total: data?.total ?? 0, limit: data?.limit ?? 25, error, isLoading, mutate };
}

export function useOpportunity(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<OpportunityReszletek>(id ? `/procurement/opportunities/${id}` : null, fetcher);
  return { opp: data ?? null, error, isLoading, mutate };
}

function piacQs(p: { profileId?: string | null; months?: number; search?: string; page?: number }) {
  const qs = new URLSearchParams();
  if (p.profileId) qs.set('profileId', p.profileId);
  if (p.months) qs.set('months', String(p.months));
  if (p.search) qs.set('search', p.search);
  if (p.page) qs.set('page', String(p.page));
  return qs.toString();
}

/** Versenytárs-térkép: kik nyernek a piacunkon (a profilok országai és CPV-i). */
export function usePiac(p: { profileId?: string | null; months?: number }) {
  const { data, error, isLoading, mutate } = useSWR<Piac>(`/procurement/market?${piacQs(p)}`, fetcher, { keepPreviousData: true });
  return { piac: data ?? null, error, isLoading, mutate };
}

export function usePiacEredmenyek(p: { profileId?: string | null; months?: number; search?: string; page?: number }) {
  const { data, error, isLoading, mutate } = useSWR<{ items: Eredmeny[]; total: number; page: number; limit: number }>(
    `/procurement/market/results?${piacQs(p)}`, fetcher, { keepPreviousData: true },
  );
  return { items: data?.items ?? [], total: data?.total ?? 0, limit: data?.limit ?? 25, error, isLoading, mutate };
}

/* ── Relevancia-pontozás ─────────────────────────────────────────────── */

export interface Terulet {
  kulcs: string;
  nev: string;
  suly: number;
  kulcsszavak: string[];
  cpv: string[];
}

export interface TeruletElteres {
  suly?: number; aktiv?: boolean;
  pluszSzavak?: string[]; torolSzavak?: string[]; pluszCpv?: string[]; torolCpv?: string[];
}

export interface PontozasiElteresek {
  kompetenciak?: Record<string, TeruletElteres>;
  /** CPV-előtag → relevancia 0–100 (preferenciamátrix). */
  cpvSulyok?: Record<string, number>;
  /** A CPV-preferencia aránya a pontszámban (%). */
  cpvArany?: number;
  sajatKompetenciak?: Array<{ kulcs: string; nev: string; suly: number; aktiv?: boolean; kulcsszavak: string[]; cpv: string[] }>;
  csapdaSzavak?: { plusz?: string[]; torol?: string[] };
  csapdaPlafon?: number;
  kizaroSzavak?: { plusz?: string[]; torol?: string[] };
  kizaroPlafon?: number;
  kiemeltAjanlatkerok?: string[];
  kiemeltPont?: number;
  kizartAjanlatkerok?: string[];
  /** Alvállalkozói lehetőség: tervezési / kivitelezési fővállalkozói munka jelölése. */
  alvallalkozoiBe?: boolean;
  alvallalkozoiPont?: number;
}

export interface PontozasBeallitas {
  alap: {
    kompetenciak: Terulet[]; csapdaSzavak: string[]; csapdaPlafon: number; kizaroSzavak: string[];
    kizaroPlafon: number; kiemeltPont: number; kizartPlafon: number; cpvArany: number;
    alvallalkozoiBe: boolean; alvallalkozoiPont: number;
  };
  elteresek: PontozasiElteresek;
  verzio: number;
  modositva: string | null;
  modositotta: string | null;
}

export interface PontozasElonezet {
  kiirasok: number;
  valtozott: number;
  savValtas: number;
  elotte: Array<{ sav: Sav; db: number }>;
  utana: Array<{ sav: Sav; db: number }>;
  legnagyobbValtozasok: Array<{ id: string; title: string; buyer: string | null; elotte: number; utana: number; indoklas: string }>;
  proba: { pont: number; sav: Sav; indoklas: string; kompetenciak: string[] } | null;
}

export function usePontozas() {
  const { data, error, isLoading, mutate } = useSWR<PontozasBeallitas>('/procurement/scoring', fetcher, { revalidateOnFocus: false });
  return { beallitas: data ?? null, error, isLoading, mutate };
}

/* ── Pályázat → Projekt Map ────────────────────────────────────────── */

export interface ProjektHatarido {
  kulcs: string;
  datum: string;
  cimke: string;
  tipus: 'hatarido' | 'resz_hatarido';
  kijelolt: boolean;
  forras: string;
}

export interface ProjektElokeszites {
  /** A következő szabad sorszám („ÉÉÉÉ-N"), a meglévő projektnevekből. */
  javasoltSorszam: string;
  javasoltNev: string;
  hataridok: ProjektHatarido[];
  projekt: { id: string; nev: string } | null;
}

export interface ProjektImportAdat {
  sorszam?: string;
  nev: string;
  categoryId?: string;
  hataridok: Array<{ datum: string; cimke: string; tipus: 'hatarido' | 'resz_hatarido' }>;
}

export interface ProjektImportEredmeny {
  projekt: { id: string; nev: string };
  hataridok: number;
  kihagyva: Array<{ cimke: string; datum: string; ok: string }>;
}

/* ── Figyelőprofilok ───────────────────────────────────────────────── */

export interface ProfilStat {
  id: string; elo: number; osszes: number; priority: number; qualified: number; review: number; archive: number;
}

export function useProfilStatisztika() {
  const { data, mutate } = useSWR<ProfilStat[]>('/procurement/watch-profiles/stats', fetcher, { revalidateOnFocus: false });
  return { stat: data ?? [], mutate };
}

export interface ProfilElonezet {
  elerheto: boolean;
  osszes: number;
  /** Nem-TED forrásnál: hány maradt a relevancia-szűrés után, és hányat szűrt ki. */
  relevans?: number;
  kiszurve?: number;
  megjegyzes?: string;
  hiba?: string;
  mintaMerete?: number;
  savok: Array<{ sav: Sav; db: number }>;
  minta: Array<{
    cim: string; ajanlatkero: string | null; orszag: string | null; hatarido: string | null;
    pont: number; sav: Sav; kompetenciak: string[]; url: string | null;
  }>;
}

export function useBeszerzesiForrasok() {
  const { data, error, isLoading, mutate } = useSWR<BeszerzesiForras[]>('/procurement/sources', fetcher);
  return { forrasok: data ?? [], error, isLoading, mutate };
}

export function useOsszefoglalo(orak: number) {
  const { data, error, isLoading, mutate } = useSWR<Osszefoglalo>(`/procurement/summary?sinceHours=${orak}`, fetcher);
  return { osszefoglalo: data ?? null, error, isLoading, mutate };
}

export function useElemzoAllapot() {
  const { data } = useSWR<{ configured: boolean; model: string | null; pending: number; failed: number }>(
    '/procurement/analysis/status', fetcher, { revalidateOnFocus: false },
  );
  return data ?? { configured: false, model: null, pending: 0, failed: 0 };
}

export const procurementApi = {
  modosit: (id: string, adat: Record<string, unknown>) => apiClient.patch(`/procurement/opportunities/${id}`, adat).then((r) => r.data),
  dont: (id: string, adat: { decision: string; reasonCodes?: string[]; note?: string }) =>
    apiClient.post(`/procurement/opportunities/${id}/decision`, adat).then((r) => r.data),
  elemez: (id: string) => apiClient.post(`/procurement/opportunities/${id}/analyse`, undefined, { timeout: 180_000 }).then((r) => r.data),
  felvesz: (adat: Record<string, unknown>) => apiClient.post('/procurement/opportunities', adat).then((r) => r.data),
  jovahagy: (id: string) => apiClient.post(`/procurement/outreach/${id}/approve`).then((r) => r.data),
  naploz: (id: string, adat: { status: string; outcome?: string }) => apiClient.post(`/procurement/outreach/${id}/log`, adat).then((r) => r.data),
  draftModosit: (id: string, draft: string) => apiClient.patch(`/procurement/outreach/${id}`, { draft }).then((r) => r.data),
  szereploTorles: (id: string) => apiClient.delete(`/procurement/stakeholders/${id}`),
  szereplokFelvetele: (id: string, items: Array<{ companyName: string; companyRole: string; rationale?: string }>) =>
    apiClient.post(`/procurement/opportunities/${id}/stakeholders`, { items }).then((r) => r.data),
  forrasFelvesz: (adat: Record<string, unknown>) => apiClient.post('/procurement/sources', adat).then((r) => r.data),
  forrasModosit: (id: string, adat: Record<string, unknown>) => apiClient.patch(`/procurement/sources/${id}`, adat).then((r) => r.data),
  forrasAtnezve: (id: string) => apiClient.post(`/procurement/sources/${id}/checked`).then((r) => r.data),
  pontozasElonezet: (adat: { elteresek: PontozasiElteresek | null; probaCim?: string }) =>
    apiClient.post('/procurement/scoring/preview', adat, { timeout: 120_000 }).then((r) => r.data as PontozasElonezet),
  pontozasMentes: (elteresek: PontozasiElteresek | null) =>
    apiClient.post('/procurement/scoring', { elteresek }).then((r) => r.data as PontozasBeallitas),
  profilElonezet: (adat: {
    countries?: string[]; cpvPrefixes?: string[]; keywords?: string[];
    sourceType?: string; sourceUrl?: string; sourceConfig?: Record<string, unknown>;
  }) =>
    apiClient.post('/procurement/watch-profiles/preview', adat, { timeout: 120_000 }).then((r) => r.data as ProfilElonezet),
  projektElokeszites: (id: string) =>
    apiClient.get(`/procurement/opportunities/${id}/project`).then((r) => r.data as ProjektElokeszites),
  projektImport: (id: string, adat: ProjektImportAdat) =>
    apiClient.post(`/procurement/opportunities/${id}/project`, adat, { timeout: 60_000 }).then((r) => r.data as ProjektImportEredmeny),
  piacFrissites: () => apiClient.post('/procurement/market/refresh').then((r) => r.data as { started: boolean; profiles: number }),
};

/* ── Feliratok ─────────────────────────────────────────────────────── */

export const SAV_FELIRAT: Record<Sav, string> = {
  priority: 'Priority', qualified: 'Qualified', review: 'Review', archive: 'Archive',
};

export const ALLAPOT_FELIRAT: Record<OppAllapot, string> = {
  new: 'Új', relevant: 'Kiemelt', dismissed: 'Elvetve', watching: 'Figyelt', bidding: 'Ajánlat készül',
  submitted: 'Beadva', won: 'Megnyerve', lost: 'Elvesztve',
};

export const FAZIS_FELIRAT: Record<Fazis, string> = {
  open: 'Fut', closed: 'Lezárult, eredményre vár', awarded: 'Eredményt hirdettek', unsuccessful: 'Lezárult, nyertes nélkül',
};

export const MERET_FELIRAT: Record<string, string> = {
  micro: 'mikrovállalkozás', small: 'kisvállalkozás', medium: 'középvállalkozás', large: 'nagyvállalat',
};

export const EGYSEG_FELIRAT: Record<string, string> = { DAY: 'nap', WEEK: 'hét', MONTH: 'hónap', YEAR: 'év' };

export const SZERZODES_FELIRAT: Record<string, string> = { services: 'Szolgáltatás', works: 'Építés', supplies: 'Árubeszerzés' };

export const PONT_FORRASA: Record<string, string> = {
  rule: 'szabály', ai: 'AI-elemzés', claude: 'Claude', human: 'ember',
};

export const KOMPETENCIA_FELIRAT: Record<string, string> = {
  geodezia: 'Geodézia', gis: 'GIS / térkép', kataszter: 'Kataszter', dron_foto: 'Drón / fotogrammetria',
  lidar: 'LiDAR', bim: 'BIM / digitális iker', banyaszat: 'Bánya / térfogat', fakataszter_zold: 'Fakataszter / zöld',
  kornyezet: 'Környezet', infrastruktura: 'Infrastruktúra',
  pv_termografia: 'PV-hőkamera', allapot_dok: 'Állapotdokumentáció',
  alvallalkozoi: 'Alvállalkozói lehetőség',
};

export const HIANY_FELIRAT: Record<string, string> = {
  reference: 'Referencia', local_partner: 'Helyi partner', certification: 'Tanúsítvány', capacity: 'Kapacitás',
  geography: 'Földrajz', expertise: 'Szakértelem', technology: 'Technológia', language: 'Nyelv', other: 'Egyéb',
};

export const DONTES_OKOK: Array<{ kod: string; felirat: string }> = [
  { kod: 'not_our_scope', felirat: 'Nem a mi profilunk' },
  { kod: 'too_small', felirat: 'Túl kicsi' },
  { kod: 'too_large', felirat: 'Túl nagy' },
  { kod: 'geography', felirat: 'Földrajz' },
  { kod: 'deadline', felirat: 'Nincs idő' },
  { kod: 'missing_reference', felirat: 'Hiányzó referencia' },
  { kod: 'missing_certification', felirat: 'Hiányzó tanúsítvány' },
  { kod: 'missing_partner', felirat: 'Nincs partner' },
  { kod: 'capacity', felirat: 'Kapacitás' },
  { kod: 'price', felirat: 'Ár' },
  { kod: 'competition', felirat: 'Erős verseny' },
  { kod: 'strategic', felirat: 'Stratégiai ok' },
  { kod: 'other', felirat: 'Egyéb' },
];

export const STRATEGIA_FELIRAT: Record<string, string> = {
  direct_technical: 'Műszaki döntéshozó', procurement: 'Beszerzés', prime_contractor: 'Fővállalkozó',
  local_partner: 'Helyi partner', consortium: 'Konzorcium', pre_tender_intro: 'Bemutatkozás kiírás előtt',
  supplier_registration: 'Beszállítói regisztráció', vendor_onboarding: 'Vendor onboarding', event: 'Esemény',
  warm_intro: 'Közös ismerős', reference: 'Referencia küldése', capability_statement: 'Capability statement', other: 'Egyéb',
};

export const CEG_SZEREP_FELIRAT: Record<string, string> = {
  buyer: 'Kiíró', project_owner: 'Projekttulajdonos', prime_contractor: 'Fővállalkozó',
  consortium_partner: 'Konzorciumi partner', local_partner: 'Helyi partner', previous_winner: 'Korábbi nyertes',
  previous_supplier: 'Korábbi beszállító', consultant: 'Tanácsadó', association: 'Szakmai szervezet', other: 'Egyéb',
};
