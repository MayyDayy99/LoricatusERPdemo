// Demó szimulált adat a Pályázatfigyelő (tenders / procurement) modulhoz.
// A valódi rendszerben ez élő közbeszerzési feed-ekből (TED, EKR, Közbeszerzési
// Értesítő) + AI-elemzésből áll össze; a demóban realisztikus, statikus mintát adunk.

function daysFromNow(n: number): string { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); }
function ymd(n: number): string { return daysFromNow(n).slice(0, 10); }

interface OppSpec {
  id: string; title: string; buyer: string; place: string;
  publishedDays: number; deadlineDays: number; value: number | null;
  cpv: string[]; status: string; score: number; tier: string; reason: string;
  rec: string; win: number | null; comp: string[]; source: string; phase?: string;
  assignedTo?: string | null; nextStep?: string | null;
}

const SPECS: OppSpec[] = [
  { id: 'opp-1', title: 'Miskolc MJV — középületek drónos állapotfelmérése és tetődiagnosztika', buyer: 'Miskolc Megyei Jogú Város Önkormányzata', place: 'Miskolc', publishedDays: -4, deadlineDays: 11, value: 34_000_000, cpv: ['71351810', '71355000'], status: 'relevant', score: 92, tier: 'priority', reason: 'Pontos egyezés a drónos felmérés + tetődiagnosztika kompetenciával; érték a sávban.', rec: 'bid', win: 0.62, comp: ['Drónos felmérés', 'Tetődiagnosztika'], source: 'EKR', assignedTo: 'Nagy Péter', nextStep: 'Ajánlati dokumentáció letöltése' },
  { id: 'opp-2', title: 'MÁV Zrt. — vasúti műtárgyak geodéziai bemérése és deformációmérése', buyer: 'MÁV Magyar Államvasutak Zrt.', place: 'országos', publishedDays: -2, deadlineDays: 18, value: 78_000_000, cpv: ['71351000', '71355000'], status: 'watching', score: 88, tier: 'priority', reason: 'Geodéziai deformációmérés referencia illeszkedik; nagy értékű keretszerződés.', rec: 'bid', win: 0.48, comp: ['Geodézia', 'Deformációmérés'], source: 'TED', assignedTo: 'Szabó Zoltán', nextStep: 'Alkalmassági feltételek ellenőrzése' },
  { id: 'opp-3', title: 'Zsolnay Kulturális Negyed — épületállomány HBIM modellezése (LOD300)', buyer: 'Pécs MJV Önkormányzata', place: 'Pécs', publishedDays: -6, deadlineDays: 6, value: 52_000_000, cpv: ['71354300', '71351914'], status: 'bidding', score: 85, tier: 'qualified', reason: 'HBIM/pontfelhő kompetencia erős; szűk határidő.', rec: 'bid', win: 0.55, comp: ['BIM-modellezés', 'Lézerszkennelés'], source: 'Közbeszerzési Értesítő', assignedTo: 'Varga László', nextStep: 'Ajánlat véglegesítése' },
  { id: 'opp-4', title: 'Szeged — Tisza-parti támfal repedés-térképezése drónfotogrammetriával', buyer: 'Szeged MJV Önkormányzata', place: 'Szeged', publishedDays: -1, deadlineDays: 14, value: 18_500_000, cpv: ['71351810'], status: 'new', score: 79, tier: 'qualified', reason: 'Drónfotogrammetria + repedés-térképezés illeszkedik.', rec: 'review', win: 0.4, comp: ['Drónos felmérés', 'Fotogrammetria'], source: 'EKR', assignedTo: null, nextStep: 'Elemzés kérése' },
  { id: 'opp-5', title: 'BKK — közúti hidak pontfelhő-alapú felmérése és állapotrögzítés', buyer: 'BKK Budapesti Közlekedési Központ Zrt.', place: 'Budapest', publishedDays: -3, deadlineDays: 9, value: 41_000_000, cpv: ['71351000', '71631450'], status: 'relevant', score: 74, tier: 'qualified', reason: 'Hídfelmérés pontfelhővel; közepesen erős verseny.', rec: 'review', win: 0.35, comp: ['Lézerszkennelés', 'Hídvizsgálat'], source: 'TED', assignedTo: null, nextStep: null },
  { id: 'opp-6', title: 'NIF Zrt. — autópálya-szakasz digitális ikertérkép (BIM) készítése', buyer: 'NIF Nemzeti Infrastruktúra Fejlesztő Zrt.', place: 'M3 autópálya', publishedDays: -8, deadlineDays: 21, value: 145_000_000, cpv: ['71354300'], status: 'watching', score: 68, tier: 'review', reason: 'Nagy értékű, de fővállalkozói kapacitás kérdéses — alvállalkozói lehetőség.', rec: 'low_priority', win: 0.22, comp: ['BIM-modellezés'], source: 'TED', assignedTo: 'Nagy Péter', nextStep: 'Alvállalkozói egyeztetés' },
  { id: 'opp-7', title: 'Gödöllő — kastély keleti szárny örökségvédelmi felmérése', buyer: 'MNV Zrt. (Magyar Nemzeti Vagyonkezelő)', place: 'Gödöllő', publishedDays: -5, deadlineDays: 4, value: 26_000_000, cpv: ['71351914', '71354300'], status: 'relevant', score: 66, tier: 'review', reason: 'Örökségvédelmi HBIM; szűk határidő, referencia szükséges.', rec: 'review', win: 0.3, comp: ['HBIM', 'Örökségvédelem'], source: 'Közbeszerzési Értesítő', assignedTo: null, nextStep: null },
  { id: 'opp-8', title: 'Debrecen — ipari park közműhálózat geodéziai felmérése', buyer: 'Debrecen MJV Önkormányzata', place: 'Debrecen', publishedDays: -2, deadlineDays: 16, value: 12_000_000, cpv: ['71355000'], status: 'new', score: 58, tier: 'review', reason: 'Alap geodézia; alacsonyabb érték, de gyors átfutás.', rec: 'review', win: 0.28, comp: ['Geodézia'], source: 'EKR', assignedTo: null, nextStep: null },
  { id: 'opp-9', title: 'Győr — belvárosi közterület-rekonstrukció kivitelezői közbeszerzés', buyer: 'Győr MJV Önkormányzata', place: 'Győr', publishedDays: -7, deadlineDays: 24, value: 890_000_000, cpv: ['45233000'], status: 'dismissed', score: 24, tier: 'archive', reason: 'Kivitelezői fővállalkozás — nem illeszkedik a felmérési profilhoz.', rec: 'no_bid', win: null, comp: [], source: 'TED' },
  { id: 'opp-10', title: 'ELTE — kampusz-épületek energetikai és állapotfelmérése', buyer: 'Eötvös Loránd Tudományegyetem', place: 'Budapest', publishedDays: -3, deadlineDays: 13, value: 22_000_000, cpv: ['71314300', '71351810'], status: 'relevant', score: 71, tier: 'qualified', reason: 'Energetikai + drónos állapotfelmérés kombináció; jó illeszkedés.', rec: 'review', win: 0.33, comp: ['Drónos felmérés', 'Energetika'], source: 'EKR', assignedTo: null, nextStep: null },
];

const SRC_ID: Record<string, string> = { 'EKR': 'src-ekr', 'TED': 'src-ted', 'Közbeszerzési Értesítő': 'src-kozbesz' };

function toOpportunity(s: OppSpec): any {
  const dl = new Date(daysFromNow(s.deadlineDays));
  const daysLeft = Math.max(0, Math.round((dl.getTime() - Date.now()) / 86400000));
  return {
    id: s.id, title: s.title, buyer: s.buyer, buyerCountry: 'HU', source: s.source,
    sourceUrl: 'https://ekr.gov.hu/', publishedAt: daysFromNow(s.publishedDays), deadlineAt: daysFromNow(s.deadlineDays),
    daysLeft, estimatedValue: s.value, currency: s.value ? 'HUF' : null, cpvCodes: s.cpv,
    status: s.status, assignedTo: s.assignedTo ?? null, score: s.score, tier: s.tier, scoreReason: s.reason,
    scoreSource: s.score >= 80 ? 'claude' : 'rule', ruleScore: Math.max(0, s.score - 8),
    matchedCompetences: s.comp, bidRecommendation: s.rec, bidDecision: s.status === 'bidding' ? 'bid' : null,
    winProbability: s.win, nextStep: s.nextStep ?? null, nextStepAt: s.nextStep ? daysFromNow(2) : null,
    outreachStatus: s.status === 'bidding' ? 'in_progress' : (s.assignedTo ? 'planned' : 'none'),
    analysedAt: s.score >= 70 ? daysFromNow(s.publishedDays + 1) : null,
    procurementSource: { id: SRC_ID[s.source] ?? 'src-x', name: s.source },
    noticeType: 'CN', deadlineKind: 'tender', phase: s.phase ?? 'open', result: null,
    place: s.place, submissionUrl: 'https://ekr.gov.hu/', previousDeadlineAt: s.id === 'opp-3' ? daysFromNow(s.deadlineDays - 3) : null,
  };
}

const OPPS = SPECS.map(toOpportunity);

export function opportunitiesList(query: URLSearchParams): any {
  const tier = query.get('tier'); const status = query.get('status');
  const phase = query.get('phase'); const comp = query.get('competence');
  const search = (query.get('search') || '').toLowerCase();
  const csv = (v: string | null) => (v ? new Set(v.split(',').filter(Boolean)) : null);
  const tierSet = csv(tier); const statusSet = csv(status); const phaseSet = csv(phase);
  let items = OPPS.slice();
  if (tierSet) items = items.filter((o) => o.tier && tierSet.has(o.tier));
  if (statusSet) items = items.filter((o) => statusSet.has(o.status));
  if (phaseSet) items = items.filter((o) => phaseSet.has(o.phase));
  if (comp === 'alvallalkozoi') items = items.filter((o) => o.bidRecommendation === 'low_priority');
  if (search) items = items.filter((o) => o.title.toLowerCase().includes(search) || (o.buyer || '').toLowerCase().includes(search));
  // Loricatus Score szerint csökkenő
  items = items.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return { items, total: items.length, page: 1, limit: 50 };
}

export function opportunityDetail(id: string): any {
  const base = OPPS.find((o) => o.id === id) ?? OPPS[0];
  return {
    ...base,
    project: base.status === 'bidding' ? { id: 'proj-4', name: 'Zsolnay negyed — BIM LOD300 modell' } : null,
    noticeTypeName: 'Ajánlati/részvételi felhívás', procedureId: 'EKR' + base.id.replace('opp-', '00042'),
    details: {
      hirdetmenyTipus: 'Ajánlati felhívás', szerzodesTipus: 'Szolgáltatás', ajanlatHatarido: base.deadlineAt,
      reszvetelHatarido: null, bontas: base.deadlineAt, teljesitesHelye: { varosok: [base.place], nuts: ['HU'], orszagok: ['Magyarország'] },
      idotartam: { ertek: 6, egyseg: 'hónap' }, kezdes: daysFromNow(30), befejezes: daysFromNow(210),
      ajanlatiKotottseg: { ertek: 60, egyseg: 'nap' },
      biralatiSzempontok: [{ nev: 'Ár', tipus: 'ár', suly: 70 }, { nev: 'Szakmai minőség', tipus: 'minőség', suly: 30 }],
      alkalmassag: 'Legalább 3 referencia az elmúlt 3 évből, hasonló felmérési munkából.',
      dokumentumUrl: 'https://ekr.gov.hu/', benyujtasUrl: 'https://ekr.gov.hu/',
      ajanlatkero: { email: 'kozbeszerzes@' + (base.place || 'onkormanyzat') + '.hu', web: null, varos: base.place, kapcsolattarto: 'Közbeszerzési referens', jogiForma: 'Önkormányzat', fotevekenyseg: 'Közigazgatás' },
      euForras: base.estimatedValue && base.estimatedValue > 50_000_000 ? ['EU Kohéziós Alap'] : null,
      kkv: true, keretmegallapodas: base.id === 'opp-2', fenntartott: false, alvallalkozasEngedett: true,
      nyelvek: ['HU'], reszekSzama: 1, hirdetmenyek: [], korabbiHatarido: base.previousDeadlineAt,
    },
    results: [], market: null,
    references: [
      { tipus: 'projekt', id: 'proj-1', cim: 'Bartók udvar — drónos állapotfelmérés', ev: 2026, ertek: 8_500_000, penznem: 'HUF', pont: 88, miert: ['azonos CPV', 'drónos felmérés'] },
      { tipus: 'projekt', id: 'proj-3', cim: 'Tisza-part — támfal inspekció', ev: 2026, ertek: 6_200_000, penznem: 'HUF', pont: 74, miert: ['hasonló feladat'] },
    ],
  };
}

export function procurementSummary(): any {
  const tierCount = (t: string) => OPPS.filter((o) => o.tier === t).length;
  const top = OPPS.filter((o) => o.score >= 70).sort((a, b) => b.score - a.score).slice(0, 5)
    .map((o) => ({ id: o.id, title: o.title, buyer: o.buyer, country: 'HU', score: o.score, tier: o.tier, reason: o.scoreReason, daysLeft: o.daysLeft }));
  const critical = OPPS.filter((o) => o.daysLeft <= 7 && o.tier !== 'archive')
    .map((o) => ({ id: o.id, title: o.title, buyer: o.buyer, status: o.status, score: o.score, tier: o.tier, daysLeft: o.daysLeft }));
  return {
    since: daysFromNow(-7),
    results: [], deadlineChanges: OPPS.filter((o) => o.previousDeadlineAt).map((o) => ({ id: o.id, title: o.title, status: o.status, score: o.score, deadlineAt: o.deadlineAt, previousDeadlineAt: o.previousDeadlineAt, daysLeft: o.daysLeft })),
    newOpportunities: { total: OPPS.length, byTier: { priority: tierCount('priority'), qualified: tierCount('qualified'), review: tierCount('review'), archive: tierCount('archive') }, top },
    bySource: [
      { source: 'EKR', count: OPPS.filter((o) => o.source === 'EKR').length, relevant: OPPS.filter((o) => o.source === 'EKR' && o.score >= 60).length },
      { source: 'TED', count: OPPS.filter((o) => o.source === 'TED').length, relevant: OPPS.filter((o) => o.source === 'TED' && o.score >= 60).length },
      { source: 'Közbeszerzési Értesítő', count: OPPS.filter((o) => o.source === 'Közbeszerzési Értesítő').length, relevant: 2 },
    ],
    critical,
    newSources: { total: 1, withSupplierRegistration: 0, items: [{ id: 'src-new-1', name: 'Városüzemeltető Kft. beszállítói portál', sourceScore: 62, via: 'radar' }] },
    outreachAwaitingApproval: 2,
    analysis: { pending: 1, completedInPeriod: 7 },
    capabilityGapAlerts: [{ gapType: 'competence', competence: 'lidar', competenceName: 'Mobil LiDAR', count: 2, examples: ['NIF autópálya ikertérkép'], windowDays: 30 }],
  };
}

export function watchProfilesTenders(): any[] {
  return [
    { id: 'wp-1', name: 'Drónos felmérés & diagnosztika', keywords: ['drón', 'fotogrammetria', 'állapotfelmérés', 'tetődiagnosztika'], cpvPrefixes: ['71351', '71314'], minValue: 5_000_000, isActive: true, lastRunAt: daysFromNow(-1), sourceType: 'ted', countries: ['HU'], sourceConfig: null },
    { id: 'wp-2', name: 'Geodézia & BIM', keywords: ['geodézia', 'bemérés', 'BIM', 'pontfelhő', 'lézerszkennelés'], cpvPrefixes: ['71355', '71354'], minValue: 8_000_000, isActive: true, lastRunAt: daysFromNow(-1), sourceType: 'ted', countries: ['HU'], sourceConfig: null },
    { id: 'wp-3', name: 'Infrastruktúra (híd, út, vasút)', keywords: ['híd', 'vasút', 'műtárgy', 'deformáció'], cpvPrefixes: ['71631', '71351'], minValue: 20_000_000, isActive: false, lastRunAt: daysFromNow(-4), sourceType: 'ekr', countries: ['HU'], sourceConfig: { forrasKulcs: 'ekr', orszag: 'HU', api: 'ekr' } },
  ];
}

export function watchProfileStats(): any[] {
  return [
    { id: 'wp-1', elo: 1, osszes: 4, priority: 1, qualified: 2, review: 1, archive: 0 },
    { id: 'wp-2', elo: 1, osszes: 4, priority: 1, qualified: 1, review: 2, archive: 0 },
    { id: 'wp-3', elo: 0, osszes: 3, priority: 0, qualified: 0, review: 2, archive: 1 },
  ];
}

export function procurementSources(): any[] {
  const mk = (id: string, name: string, subtitle: string, kind: string, platform: string, reg: string, score: number, opp: number, won: number) => ({
    id, slug: id, name, subtitle, kind, platform, url: 'https://ekr.gov.hu/', countries: ['HU'], sectors: ['építőipar', 'felmérés'],
    registrationStatus: reg, supplierRegistration: reg === 'registered' ? 'yes' : 'unknown', accessMethods: ['portál', 'e-mail'],
    mfa: 'nincs', automation: 'napi szinkron', cost: 'ingyenes', costNote: null, sourceScore: score, scoreReason: 'Rendszeres releváns kiírás',
    monitoring: score >= 60 ? 'monitor' : 'undecided', notes: null, lastCheckedAt: daysFromNow(-1), discoveredVia: 'manual',
    performance: { opportunities: opp, qualified: Math.round(opp * 0.5), bid: Math.round(opp * 0.2), won, wonValue: won * 30_000_000 },
  });
  return [
    mk('src-ekr', 'EKR — Elektronikus Közbeszerzési Rendszer', 'Hazai közbeszerzések', 'public_portal', 'EKR', 'registered', 84, 5, 2),
    mk('src-ted', 'TED — Tenders Electronic Daily', 'EU-s közbeszerzési feed', 'aggregator', 'TED', 'registered', 78, 3, 1),
    mk('src-kozbesz', 'Közbeszerzési Értesítő', 'KÉ hivatalos lap', 'public_portal', 'KÉ', 'registered', 71, 2, 0),
    mk('src-new-1', 'Városüzemeltető Kft. beszállítói portál', 'Önkormányzati beszállítói hálózat', 'supplier_network', 'egyedi', 'candidate', 62, 1, 0),
  ];
}

export function procurementMarket(): any {
  return {
    filter: { countries: ['HU'], cpvPrefixes: ['7135'] },
    period: { from: ymd(-365), to: ymd(0), months: 12 },
    results: 128, unsuccessful: 14, avgOffers: 3.4, buyers: 46,
    valueToEstimate: { median: 0.94, count: 88 },
    valueByCurrency: [{ currency: 'HUF', count: 118, total: 4_200_000_000, median: 28_000_000 }],
    competitors: [
      { name: 'Geoplan Mérnöki Kft.', country: 'HU', city: 'Budapest', size: 'kkv', wins: 14, buyers: 9, avgOffers: 3.1, lastWin: ymd(-22), sampleBuyers: ['MÁV Zrt.', 'NIF Zrt.'], valueByCurrency: { HUF: 620_000_000 }, own: false, valueToEstimate: 0.91 },
      { name: 'DroneSurvey Hungary Zrt.', country: 'HU', city: 'Debrecen', size: 'kkv', wins: 9, buyers: 7, avgOffers: 2.8, lastWin: ymd(-40), sampleBuyers: ['Debrecen MJV', 'ELTE'], valueByCurrency: { HUF: 310_000_000 }, own: false, valueToEstimate: 0.97 },
      { name: 'Loricatus Group Kft.', country: 'HU', city: 'Budapest', size: 'kkv', wins: 6, buyers: 5, avgOffers: 3.0, lastWin: ymd(-15), sampleBuyers: ['Miskolc MJV', 'Pécs MJV'], valueByCurrency: { HUF: 180_000_000 }, own: true, valueToEstimate: 0.95 },
      { name: 'BIM Studio Kft.', country: 'HU', city: 'Szeged', size: 'kkv', wins: 5, buyers: 4, avgOffers: 3.5, lastWin: ymd(-60), sampleBuyers: ['Szeged MJV'], valueByCurrency: { HUF: 150_000_000 }, own: false, valueToEstimate: 0.99 },
    ],
    topBuyers: [
      { name: 'MÁV Zrt.', country: 'HU', results: 18, avgOffers: 3.6, lastResult: ymd(-12), valueByCurrency: { HUF: 980_000_000 } },
      { name: 'NIF Zrt.', country: 'HU', results: 11, avgOffers: 2.9, lastResult: ymd(-25), valueByCurrency: { HUF: 1_400_000_000 } },
      { name: 'Miskolc MJV', country: 'HU', results: 7, avgOffers: 3.2, lastResult: ymd(-30), valueByCurrency: { HUF: 210_000_000 } },
    ],
    frequentBidders: [
      { name: 'Geoplan Mérnöki Kft.', bids: 31, wins: 14, winRate: 0.45, avgOffers: 3.1, lastSeen: ymd(-8), own: false },
      { name: 'Loricatus Group Kft.', bids: 17, wins: 6, winRate: 0.35, avgOffers: 3.0, lastSeen: ymd(-3), own: true },
      { name: 'DroneSurvey Hungary Zrt.', bids: 15, wins: 9, winRate: 0.6, avgOffers: 2.8, lastSeen: ymd(-11), own: false },
    ],
  };
}

export function procurementScoring(): any {
  const ter = (kulcs: string, nev: string, suly: number, kulcsszavak: string[], cpv: string[]) => ({ kulcs, nev, suly, kulcsszavak, cpv });
  return {
    alap: {
      kompetenciak: [
        ter('dron', 'Drónos felmérés', 30, ['drón', 'fotogrammetria', 'UAV'], ['71351810']),
        ter('geodezia', 'Geodézia', 25, ['geodézia', 'bemérés', 'GNSS'], ['71355000']),
        ter('bim', 'BIM-modellezés', 25, ['BIM', 'HBIM', 'pontfelhő'], ['71354300']),
        ter('lezer', 'Lézerszkennelés', 20, ['lézerszkenner', 'pontfelhő', 'LiDAR'], ['71351914']),
      ],
      csapdaSzavak: ['kivitelezés', 'építés'], csapdaPlafon: 40, kizaroSzavak: ['takarítás', 'őrzés-védelem'], kizaroPlafon: 0,
      kiemeltPont: 15, kizartPlafon: 10, cpvArany: 0.4, alvallalkozoiBe: true, alvallalkozoiPont: 10,
    },
    elteresek: {}, verzio: 3, modositva: daysFromNow(-20), modositotta: 'Demó Felhasználó',
  };
}

export function analysisStatus(): any {
  return { configured: true, model: 'claude-sonnet-4', pending: 1, failed: 0 };
}

export function tendersList(): any {
  return { items: OPPS.map((o) => ({ id: o.id, title: o.title, buyer: o.buyer, deadlineAt: o.deadlineAt, status: o.status, score: o.score })), total: OPPS.length, page: 1, limit: 50 };
}

export function haviBeallitas(): any {
  return { enabled: true, nap: 1, perc: 480, cimzettek: [{ email: 'vezetoseg@loricatus.hu', nev: 'Vezetőség', feloldottEmail: 'vezetoseg@loricatus.hu', feloldottNev: 'Vezetőség' }] };
}

export function marketResults(): any { return { items: [], total: 0, page: 1, limit: 25 }; }
export function outcomesList(): any { return { items: [], total: 0, page: 1, limit: 25 }; }
export function marketReport(): any {
  const ho = ymd(0).slice(0, 7);
  return {
    adat: { honap: ho, megjeloles: new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' }) },
    elonezet: true, allapot: 'kesz', elkuldve: null, keziKuldes: null, hiba: null,
  };
}

export function marketReportEmail(): any {
  const html = '<div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;color:#111">'
    + '<div style="background:#12331f;color:#fff;padding:20px 26px;border-radius:12px 12px 0 0"><div style="font-size:13px;letter-spacing:.14em;opacity:.8">LORICATUS · HAVI PIACI JELENTÉS</div><h1 style="margin:6px 0 0;font-size:22px">Közbeszerzési piac — havi összefoglaló</h1></div>'
    + '<div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px">'
    + '<p style="color:#4b5563;line-height:1.55">A hónapban <b>128 lezárult eljárás</b> a figyelt CPV-körben, 46 kiírótól, átlag 3,4 ajánlattevővel. A Loricatus <b>6 nyertes</b> eljárással zárt (180 M Ft).</p>'
    + '<h3 style="margin:18px 0 8px">Legaktívabb kiírók</h3><p style="color:#4b5563">MÁV Zrt. (18 eljárás), NIF Zrt. (11), Miskolc MJV (7).</p>'
    + '<h3 style="margin:18px 0 8px">Fő versenytársak</h3><p style="color:#4b5563">Geoplan Mérnöki Kft. (14 nyerés), DroneSurvey Hungary Zrt. (9).</p>'
    + '<p style="color:#9ca3af;font-size:12px;margin-top:22px;border-top:1px solid #f3f4f6;padding-top:14px">Loricatus Group Kft. · Automatikus havi piaci jelentés.</p></div></div>';
  return { subject: 'Loricatus — havi közbeszerzési piaci jelentés', html, text: 'Havi piaci jelentés: 128 lezárult eljárás, 46 kiíró, a Loricatus 6 nyertes eljárással.' };
}

export function marketReportArchive(): any[] {
  return [1, 2, 3].map((m) => {
    const d = new Date(); d.setMonth(d.getMonth() - m);
    const ho = d.toISOString().slice(0, 7);
    return { honap: ho, megjeloles: d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' }), allapot: 'elkuldve', elkuldve: d.toISOString(), keziKuldes: null };
  });
}
