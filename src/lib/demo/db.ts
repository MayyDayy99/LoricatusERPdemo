/**
 * Memóriában tárolt demó-adatbázis. Determinisztikus, magyar építőipari
 * seed-adat. A runtime-módosítások (create/update/delete) ezt a store-t
 * mutálják, de nem perzisztálódnak — reload = friss seed.
 */

import { DEMO_TENANT_ID } from './config';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Row = Record<string, any>;
export type Store = Record<string, Row[]>;

const T = DEMO_TENANT_ID;

/** Napokat ad/kivon a mai naptól, ISO-datestringként (YYYY-MM-DD). */
function day(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
/** Teljes ISO timestamp az adott nap-offsettel. */
function ts(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString();
}
let _seq = 1000;
export function nextId(prefix = 'id'): string {
  _seq += 1;
  return `${prefix}-${_seq}`;
}

const HU_FIRST = ['Kovács', 'Nagy', 'Tóth', 'Szabó', 'Horváth', 'Varga', 'Kiss', 'Molnár', 'Németh', 'Farkas'];
const HU_LAST = ['Gábor', 'Péter', 'Anna', 'Zoltán', 'Katalin', 'László', 'Eszter', 'Tamás', 'Judit', 'Balázs'];
const COMPANIES = [
  'Loricatus Group Kft.', 'Magyar Építő Zrt.', 'BIM General Kft.', 'Dombóvár Belváros Kft.',
  'Tettye Forrásház Kft.', 'MATE Egyetem', 'EHE Beruházó Kft.', 'Törökbálint Önkormányzat',
  'Mátyás Templom Alapítvány', 'Béla Király úti Társasház',
];
const CITIES = ['Budapest', 'Dombóvár', 'Pécs', 'Törökbálint', 'Gödöllő', 'Ároktő', 'Miskolc', 'Szeged'];

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }
function huf(n: number): number { return Math.round(n); }

export function buildSeed(): Store {
  // Determinisztikus id-k: minden buildSeed() hívás ugyanazokat az id-ket adja
  // (a build-idejű generateStaticParams és a kliens-runtime store egyezzen).
  _seq = 1000;
  const store: Store = {};

  // ── Tenant / branding ─────────────────────────────────────────────
  store.tenants = [{
    id: T, name: 'Loricatus Group', slug: 'loricatus',
    companyProfile: {
      legalName: 'Loricatus Group Kft.', taxNumber: '12345678-2-42',
      address: '1111 Budapest, Bartók Béla út 12.', bankAccount: '12345678-12345678-12345678',
      email: 'info@loricatus.hu', phone: '+36 1 234 5678',
    },
    branding: { primaryColor: '#c8a24a', logoUrl: null },
    // Demóban MINDEN modul be van kapcsolva, hogy a teljes sidebar látszódjon
    // (a menüpontok requiredFeature-flaggel vannak kapuzva — pl. Projekt map =
    // meetingEnabled).
    featureFlags: {
      notamEnabled: true, threeDEnabled: true, pdfAdvancedEnabled: true,
      crmEnabled: true, crmWorkflowsEnabled: true, crmInvoicingEnabled: true,
      crmExternalIntegrations: true, workOrdersEnabled: true, droneEnabled: true,
      internalTasksEnabled: true, meetingEnabled: true, fieldReportsEnabled: true,
      miniCrmImportEnabled: true, commissionEnabled: true,
    },
    metadata: { sidebarPoliciesByRole: {} },
  }];

  // ── Users / current user ─────────────────────────────────────────
  const roles = [
    { id: 'role-admin', tenantId: T, name: 'Adminisztrátor', key: 'admin', isSystem: true, permissions: ['*'] },
    { id: 'role-ceo', tenantId: T, name: 'Ügyvezető', key: 'ceo', isSystem: true, permissions: ['*'] },
    { id: 'role-manager', tenantId: T, name: 'Projektvezető', key: 'manager', isSystem: true, permissions: [] },
    { id: 'role-operative', tenantId: T, name: 'Operatív', key: 'operative', isSystem: true, permissions: [] },
    { id: 'role-client', tenantId: T, name: 'Megrendelő', key: 'client', isSystem: true, permissions: [] },
  ];
  store.roles = roles;

  const users: Row[] = Array.from({ length: 8 }).map((_, i) => ({
    id: i === 0 ? 'user-demo' : nextId('user'),
    tenantId: T,
    email: i === 0 ? 'demo@loricatus.hu' : `${pick(HU_FIRST, i).toLowerCase()}.${pick(HU_LAST, i).toLowerCase()}@loricatus.hu`,
    firstName: pick(HU_LAST, i), lastName: pick(HU_FIRST, i),
    fullName: `${pick(HU_FIRST, i)} ${pick(HU_LAST, i)}`,
    name: `${pick(HU_FIRST, i)} ${pick(HU_LAST, i)}`,
    role: i === 0 ? 'admin' : pick(['ceo', 'manager', 'operative', 'operative'], i),
    roleType: i === 0 ? 'admin' : pick(['ceo', 'manager', 'operative', 'operative'], i),
    status: 'active', isActive: true,
    phone: `+36 30 ${100 + i} ${1000 + i}`,
    lastLoginAt: ts(-i), createdAt: ts(-120 + i),
  }));
  users[0].firstName = 'Demó'; users[0].lastName = 'Felhasználó';
  users[0].fullName = 'Demó Felhasználó'; users[0].name = 'Demó Felhasználó';
  store.users = users;
  store.__me = [{
    ...users[0],
    permissions: ['*'],
    tenant: store.tenants[0],
  }];

  // ── Accounts (cégek) ─────────────────────────────────────────────
  store.accounts = COMPANIES.map((c, i) => ({
    id: nextId('acc'), tenantId: T, name: c, industry: 'Építőipar',
    website: `https://www.${c.toLowerCase().replace(/[^a-z]/g, '')}.hu`,
    city: pick(CITIES, i), employeeCount: (i + 1) * 12,
    createdAt: ts(-100 + i),
  }));

  // ── Customers ────────────────────────────────────────────────────
  const lifecycles = ['lead', 'prospect', 'customer', 'churned'];
  store.customers = Array.from({ length: 24 }).map((_, i) => ({
    id: i < 3 ? `cust-${i + 1}` : nextId('cust'),
    tenantId: T,
    firstName: pick(HU_LAST, i), lastName: pick(HU_FIRST, i),
    name: `${pick(HU_FIRST, i)} ${pick(HU_LAST, i)}`,
    companyName: pick(COMPANIES, i),
    email: `${pick(HU_FIRST, i).toLowerCase()}${i}@ugyfel.hu`,
    phone: `+36 20 ${200 + i} ${2000 + i}`,
    city: pick(CITIES, i), address: `${pick(CITIES, i)}, Fő utca ${i + 1}.`,
    lifecycleStage: pick(lifecycles, i), leadScore: (i * 7) % 100,
    isActive: true, accountId: null, tags: i % 3 === 0 ? ['VIP'] : [],
    source: pick(['minicrm', 'weboldal', 'ajánlás', 'kiállítás'], i),
    createdAt: ts(-90 + i), updatedAt: ts(-i),
  }));

  // ── Rooms (projekt-kategóriák) ───────────────────────────────────
  // A "Szobák" (/rooms) modul szobái = projekt-kategóriák. Minden szobának
  // van típusa (a projekt-detail jobb sávját és a Projekt map szűrését vezérli)
  // és showInProjectMap flag-je (az "Iroda" szoba pl. NEM jelenik meg a mapen).
  const ROOMS: Array<{ id: string; name: string; color: string; icon: string; categoryType: string; showInProjectMap: boolean }> = [
    { id: 'cat-drone',  name: 'Drónos felmérés',        color: '#4f9d69', icon: 'Plane',        categoryType: 'Implementation',    showInProjectMap: true },
    { id: 'cat-bim',    name: 'BIM-modellezés',         color: '#c8a24a', icon: 'Building2',     categoryType: 'Implementation',    showInProjectMap: true },
    { id: 'cat-facade', name: 'Homlokzat-felújítás',    color: '#6b8cae', icon: 'Building',      categoryType: 'ProjectManagement', showInProjectMap: true },
    { id: 'cat-geo',    name: 'Geodézia & pontfelhő',   color: '#8b5cf6', icon: 'Wrench',        categoryType: 'Implementation',    showInProjectMap: true },
    { id: 'cat-sales',  name: 'Értékesítés & ajánlat',  color: '#ec4899', icon: 'Briefcase',    categoryType: 'Sales',             showInProjectMap: true },
    { id: 'cat-office', name: 'Iroda & adminisztráció', color: '#6b7280', icon: 'ClipboardList', categoryType: 'OfficeAdmin',       showInProjectMap: false },
  ];

  // ── Projects (szobánként elosztva) ───────────────────────────────
  const PROJECT_DEFS: Array<{ cat: string; name: string; state: string; desc: string }> = [
    { cat: 'cat-drone',  name: 'Bartók udvar — drónos állapotfelmérés',    state: 'active',    desc: 'Homlokzat-ortofotó és tetőfelmérés drónnal, 1,5 cm GSD.' },
    { cat: 'cat-drone',  name: 'Avas kilátó — negyedéves monitoring',      state: 'draft',     desc: 'Ismétlődő állapotrögzítés, repülési terv egyeztetés alatt.' },
    { cat: 'cat-drone',  name: 'Tisza-part — támfal inspekció',            state: 'active',    desc: 'Vízparti támfal repedés-térképezése drónfotóból.' },
    { cat: 'cat-bim',    name: 'Zsolnay negyed — BIM LOD300 modell',       state: 'active',    desc: 'Meglévő állapot BIM-modell Revitben, LOD300.' },
    { cat: 'cat-bim',    name: 'Kastély keleti szárny — HBIM',             state: 'draft',     desc: 'Műemléki HBIM pontfelhőből, jóváhagyásra vár.' },
    { cat: 'cat-bim',    name: 'Irodaház — MEP koordináció',               state: 'active',    desc: 'Gépészet-elektromos ütközésvizsgálat Navisworksben.' },
    { cat: 'cat-facade', name: 'Klotild palota — homlokzat-restaurálás',   state: 'active',    desc: 'Díszes homlokzat felmérése és restaurálási terve.' },
    { cat: 'cat-facade', name: 'Törökbálint — utólagos hőszigetelés',      state: 'draft',     desc: 'Társasházi homlokzati hőszigetelés tervezése.' },
    { cat: 'cat-facade', name: 'Ároktői iskola — vakolatfelújítás',        state: 'completed', desc: 'Vakolatjavítás és festés, sikeresen átadva.' },
    { cat: 'cat-geo',    name: 'Dombóvár belváros — digitális alaptérkép', state: 'active',    desc: 'Alaptérkép GNSS + mérőállomás bemérésből.' },
    { cat: 'cat-geo',    name: 'Ipari csarnok — as-built pontfelhő',       state: 'active',    desc: 'Lézerszkennelt as-built, Cyclone regisztrációval.' },
    { cat: 'cat-geo',    name: 'Közúti híd — deformáció-mérés',            state: 'completed', desc: 'Alapállapot-mérés a negyedéves mozgásvizsgálathoz.' },
    { cat: 'cat-sales',  name: 'MATE Egyetem — keretszerződés ajánlat',    state: 'active',    desc: 'Campus-felmérési keretszerződés árajánlata.' },
    { cat: 'cat-sales',  name: 'Városi drón-monitoring pályázat',          state: 'draft',     desc: 'Önkormányzati monitoring pályázati ajánlat.' },
    { cat: 'cat-office', name: 'Eszközpark — éves kalibráció',             state: 'active',    desc: 'Drónok és szkennerek éves kalibrációja + adminisztráció.' },
    { cat: 'cat-office', name: '2026 Q1 — pénzügyi zárás',                 state: 'archived',  desc: 'Negyedéves számlázás és zárás, lezárva.' },
  ];
  // Térkép-koordináták magyar városokhoz (a Térkép modul projekt-helyszínei).
  const CITY_GEO: Record<string, [number, number]> = {
    'Budapest': [47.4979, 19.0402], 'Miskolc': [48.1035, 20.7784], 'Szeged': [46.2530, 20.1414],
    'Pécs': [46.0727, 18.2323], 'Gödöllő': [47.5960, 19.3560], 'Törökbálint': [47.4306, 18.9110],
    'Ároktő': [47.7495, 20.9346], 'Dombóvár': [46.3767, 18.1386],
  };
  // A projektekhez tartozó városok (PROJECT_DEFS sorrendjében; '' = nincs helyszín, pl. iroda).
  const PROJECT_CITY = ['Budapest', 'Miskolc', 'Szeged', 'Pécs', 'Gödöllő', 'Budapest', 'Budapest', 'Törökbálint', 'Ároktő', 'Dombóvár', 'Pécs', 'Miskolc', 'Gödöllő', 'Szeged', '', ''];
  store.projects = PROJECT_DEFS.map((d, i) => {
    const room = ROOMS.find((r) => r.id === d.cat)!;
    const cust = store.customers[i % store.customers.length];
    const city = PROJECT_CITY[i];
    const geo = city ? CITY_GEO[city] : null;
    const location = geo ? {
      latitude: geo[0] + ((i % 3) - 1) * 0.008,
      longitude: geo[1] + ((i % 4) - 1.5) * 0.010,
      address: `${city}, Fő utca ${i + 1}.`, city, country: 'Magyarország',
    } : null;
    // Néhány projektnél kirajzolt területkijelölés (polygon = [lat,lng][]).
    const polygon: [number, number][] | null = (geo && (i === 0 || i === 3)) ? [
      [geo[0] + 0.006, geo[1] - 0.008], [geo[0] + 0.007, geo[1] + 0.009],
      [geo[0] - 0.006, geo[1] + 0.007], [geo[0] - 0.007, geo[1] - 0.006],
    ] : null;
    return {
      id: i < 3 ? `proj-${i + 1}` : nextId('proj'),
      tenantId: T,
      name: d.name,
      description: d.desc,
      code: `PRJ-2026-${String(i + 1).padStart(3, '0')}`,
      state: d.state, status: d.state,
      categoryId: d.cat, categoryType: room.categoryType,
      color: room.color, showInProjectMap: room.showInProjectMap,
      customerId: cust.id, customerName: cust.name,
      managerId: users[1 + (i % 4)].id,
      budget: huf(2_000_000 + i * 850_000), currency: 'HUF',
      progress: (i * 13) % 100,
      startDate: day(-30 + i), endDate: day(20 + i * 4),
      ...(location ? { location } : {}),
      ...(polygon ? { metadata: { polygon } } : {}),
      createdAt: ts(-40 + i), updatedAt: ts(-i),
    };
  });
  store['projects/categories'] = ROOMS.map((r, i) => ({
    id: r.id, tenantId: T, name: r.name, color: r.color, icon: r.icon,
    sortIndex: i, sortOrder: i, categoryType: r.categoryType,
    showInProjectMap: r.showInProjectMap,
    projectCount: store.projects.filter((p) => p.categoryId === r.id).length,
  }));
  store['projects/statuses'] = [
    { id: 'pst-1', tenantId: T, name: 'Tervezés', key: 'planning', color: '#6b8cae', sortOrder: 0 },
    { id: 'pst-2', tenantId: T, name: 'Aktív', key: 'active', color: '#4f9d69', sortOrder: 1 },
    { id: 'pst-3', tenantId: T, name: 'Felfüggesztve', key: 'on_hold', color: '#c8a24a', sortOrder: 2 },
    { id: 'pst-4', tenantId: T, name: 'Lezárva', key: 'completed', color: '#8a8f98', sortOrder: 3 },
  ];
  store['projects/custom-fields'] = [];
  store['projects/field-boxes'] = [];
  store['projects/task-templates'] = [];

  // ── Deals (pipeline) ─────────────────────────────────────────────
  const stages = ['lead', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost'];
  store.deals = Array.from({ length: 18 }).map((_, i) => ({
    id: nextId('deal'), tenantId: T,
    title: `${pick(COMPANIES, i)} — ${pick(['ajánlatkérés', 'keretszerződés', 'bővítés', 'új projekt'], i)}`,
    stage: pick(stages, i),
    value: huf(1_200_000 + i * 640_000), amount: huf(1_200_000 + i * 640_000), currency: 'HUF',
    customerId: store.customers[i % store.customers.length].id,
    customerName: store.customers[i % store.customers.length].name,
    ownerId: users[1 + (i % 4)].id,
    probability: [10, 30, 50, 70, 100, 0][i % 6],
    expectedCloseDate: day(10 + i * 2),
    createdAt: ts(-30 + i), updatedAt: ts(-i),
  }));

  // ── Quotes (árajánlatok) ─────────────────────────────────────────
  const qStates = ['draft', 'sent', 'accepted', 'rejected', 'expired'];
  store.quotes = Array.from({ length: 20 }).map((_, i) => {
    const subtotal = huf(800_000 + i * 320_000);
    const taxRate = 27;
    const taxAmount = huf(subtotal * taxRate / 100);
    return {
      id: i < 3 ? `quote-${i + 1}` : nextId('quote'),
      tenantId: T,
      quoteNumber: `Q-2026-${String(i + 1).padStart(4, '0')}`,
      title: `Árajánlat — ${pick(CITIES, i)}`,
      state: pick(qStates, i), status: pick(qStates, i),
      customerId: store.customers[i % store.customers.length].id,
      customerName: store.customers[i % store.customers.length].name,
      projectId: store.projects[i % store.projects.length].id,
      subtotal, taxRate, taxAmount, totalAmount: subtotal + taxAmount, currency: 'HUF',
      validUntil: day(20 - i), createdAt: ts(-25 + i), updatedAt: ts(-i),
    };
  });
  // quote line-items (id-nként)
  store.__quoteLineItems = {} as any;
  store.quotes.forEach((q, qi) => {
    (store.__quoteLineItems as any)[q.id] = Array.from({ length: 3 + (qi % 3) }).map((_, i) => {
      const qty = 1 + i; const unitPrice = huf(80_000 + i * 45_000);
      return {
        id: nextId('qli'), quoteId: q.id,
        description: pick(['Drónos ortofotó', 'Pontfelhő-feldolgozás', 'BIM-modell (LOD300)', 'Homlokzati felmérés', 'Riport-készítés'], i),
        quantity: qty, unit: 'db', unitPrice, lineTotal: qty * unitPrice,
        sortOrder: i,
      };
    });
  });

  // ── Invoices (számlák) ───────────────────────────────────────────
  const invStates = ['draft', 'sent', 'partially_paid', 'paid', 'overdue'];
  store.invoices = Array.from({ length: 22 }).map((_, i) => {
    const subtotal = huf(700_000 + i * 280_000);
    const taxAmount = huf(subtotal * 0.27);
    return {
      id: i < 3 ? `inv-${i + 1}` : nextId('inv'),
      tenantId: T,
      invoiceNumber: `INV-2026-${String(i + 1).padStart(4, '0')}`,
      state: pick(invStates, i), status: pick(invStates, i),
      customerId: store.customers[i % store.customers.length].id,
      customerName: store.customers[i % store.customers.length].name,
      subtotal, taxRate: 27, taxAmount, totalAmount: subtotal + taxAmount,
      paidAmount: pick(invStates, i) === 'paid' ? subtotal + taxAmount : (pick(invStates, i) === 'partially_paid' ? huf((subtotal + taxAmount) / 2) : 0),
      currency: 'HUF', issueDate: day(-15 + i), dueDate: day(15 + i),
      createdAt: ts(-15 + i), updatedAt: ts(-i),
    };
  });
  store.__invoiceLineItems = {} as any;
  store.invoices.forEach((inv) => {
    (store.__invoiceLineItems as any)[inv.id] = [
      { id: nextId('ili'), invoiceId: inv.id, description: 'Drónos felmérés', quantity: 1, unit: 'db', unitPrice: inv.subtotal, lineTotal: inv.subtotal },
    ];
  });

  // ── Contracts (szerződések) ──────────────────────────────────────
  const cStates = ['draft', 'active', 'active', 'terminated', 'expired'];
  store.contracts = Array.from({ length: 12 }).map((_, i) => ({
    id: i < 2 ? `contract-${i + 1}` : nextId('contract'),
    tenantId: T,
    contractNumber: `CNT-2026-${String(i + 1).padStart(3, '0')}`,
    title: `Vállalkozási szerződés — ${pick(COMPANIES, i)}`,
    state: pick(cStates, i), status: pick(cStates, i),
    customerId: store.customers[i % store.customers.length].id,
    customerName: store.customers[i % store.customers.length].name,
    value: huf(3_000_000 + i * 1_200_000), currency: 'HUF',
    startDate: day(-20 + i), endDate: day(180 + i),
    createdAt: ts(-20 + i), updatedAt: ts(-i),
  }));

  // ── Work-orders (munkalapok) ─────────────────────────────────────
  const woStates = ['draft', 'active', 'completed', 'signed_off', 'active'];
  // Munkalap-sablon: szekciók + tételek (a detail-nézet szekciónként csoportosít).
  const WO_SECTIONS: Array<{ code: string; title: string; rows: Array<[string, string, string]> }> = [
    { code: 'ELO', title: 'Előkészítés', rows: [
      ['Helyszíni bejárás és kockázatfelmérés', '—', '—'],
      ['Légtér-engedély ellenőrzése (NOTAM)', '—', '—'],
      ['Eszközök kalibrálása', 'Leica RTC360', '—'],
    ] },
    { code: 'TEREP', title: 'Terepi munka', rows: [
      ['Drónrepülés – homlokzat ortofotó', 'DJI Mavic 3E', 'Pix4Dcapture'],
      ['Lézerszkennelés – belső terek', 'Leica RTC360', 'Cyclone FIELD'],
      ['GNSS alappontok bemérése', 'Emlid Reach RS2+', '—'],
    ] },
    { code: 'FELD', title: 'Feldolgozás', rows: [
      ['Pontfelhő regisztráció', 'Cyclone REGISTER 360', '—'],
      ['Ortofotó és DTM generálás', 'Agisoft Metashape', '—'],
      ['BIM-modell építés (LOD300)', 'Autodesk Revit', '—'],
    ] },
    { code: 'ATAD', title: 'Átadás', rows: [
      ['Riport összeállítása', '—', '—'],
      ['Adatátadás a megrendelőnek', '—', '—'],
    ] },
  ];
  store['work-orders'] = Array.from({ length: 14 }).map((_, i) => {
    const st = pick(woStates, i);
    const proj = store.projects[i % store.projects.length];
    const cust = store.customers[i % store.customers.length];
    const resp = users[1 + (i % 4)];
    const woId = i < 2 ? `wo-${i + 1}` : nextId('wo');
    const city = (proj.location && proj.location.city) || pick(CITIES, i);
    // Munkalap-tételek szekciónként; a tétel státusza a munkalap állapotától függ.
    let sort = 0;
    const items: Row[] = [];
    WO_SECTIONS.forEach((sec, si) => {
      sec.rows.forEach((r, ri) => {
        const done = (st === 'completed' || st === 'signed_off') ? true
          : st === 'active' ? (si * 3 + ri) < 5 : false;
        items.push({
          id: nextId('woi'), workOrderId: woId,
          sectionCode: sec.code, sectionTitle: sec.title,
          code: `${si + 1}.${ri + 1}`, task: r[0],
          tool1: r[1] === '—' ? null : r[1], tool2: r[2] === '—' ? null : r[2],
          owner: users[1 + ((si + ri) % 4)].fullName,
          status: done ? 'done' : 'todo',
          unitPrice: null, quantity: null, unit: null,
          sortIndex: sort++,
        });
      });
    });
    return {
      id: woId, tenantId: T,
      workOrderNumber: `WO-2026-${String(i + 1).padStart(4, '0')}`,
      title: `Munkalap — ${proj.name}`,
      state: st, status: st,
      customerId: cust.id, customerName: cust.name, clientCompany: pick(COMPANIES, i),
      projectId: proj.id, projectName: proj.name,
      location: `${city} – munkaterület`,
      locationAddress: (proj.location && proj.location.address) || `${city}, Fő utca ${i + 1}.`,
      locationGps: proj.location ? { lat: proj.location.latitude, lng: proj.location.longitude } : undefined,
      deadline: day(8 + i), workDates: [day(-2 + i), day(-1 + i)],
      contacts: [
        { name: `${pick(HU_FIRST, i)} ${pick(HU_LAST, i)}`, phone: `+36 30 ${200 + i} ${3000 + i}`, email: `kapcsolat${i}@ugyfel.hu`, role: 'Kapcsolattartó' },
      ],
      accessInfo: 'Kulcs a portán, munkaidőben (7:00–16:00). Emelőkosár igényelhető.',
      requiredDocuments: 'Belépési engedély, munkavédelmi oktatás igazolása.',
      priorAdministration: 'Légtér-engedély beszerezve (NOTAM), tulajdonosi hozzájárulás megvan.',
      projectGoal: 'Meglévő állapot digitális rögzítése drónnal és lézerszkennerrel, majd BIM-modell készítése.',
      scanningTasks: 'Belső terek és homlokzat lézerszkennelése, alappont-hálózat kiépítése.',
      droneTasks: 'Homlokzati ortofotó és tetőfelmérés, GSD 1,5 cm.',
      processingTasks: 'Pontfelhő-regisztráció, ortofotó és DTM generálás.',
      modelingTasks: 'BIM LOD300 modell, metszetek és alaprajzok.',
      consultationDate: day(4 + i), consultationPrepTime: '2 óra',
      isExtraWork: i % 7 === 0,
      deliverableFormats: ['PDF riport', 'RCP pontfelhő', 'IFC / RVT modell', 'DWG alaprajz'],
      responsiblePerson: resp.fullName,
      notes: i % 4 === 0 ? 'Az ügyfél kérte a keleti szárny kiemelt felmérését.' : '',
      customFields: st === 'signed_off' ? { signedBy: cust.name, signedAt: ts(-i) } : {},
      items,
      createdBy: 'user-demo', createdAt: ts(-10 + i), updatedAt: ts(-i),
      scheduledDate: day(-5 + i),
    };
  });

  // ── CRM-tasks / internal-tasks / activities ──────────────────────
  const taskStatuses = ['pending', 'in_progress', 'completed', 'draft'];
  // Projektenként 2–4 teendő, PROJEKTHEZ KÖTVE (projectId) — így a szoba
  // projekt-detail „Teendők" füle és a CRM feladatlista is megtelik.
  const CRM_TASK_POOL: Array<{ title: string; taskType: string; est: number }> = [
    { title: 'Helyszíni bejárás',               taskType: 'terep',       est: 180 },
    { title: 'Drónrepülés ütemezése',           taskType: 'terep',       est: 120 },
    { title: 'Pontfelhő regisztráció',          taskType: 'feldolgozas', est: 240 },
    { title: 'Modell-egyeztetés megrendelővel', taskType: 'iroda',       est: 90 },
    { title: 'Árajánlat összeállítása',         taskType: 'sales',       est: 120 },
    { title: 'Riport véglegesítése',            taskType: 'iroda',       est: 150 },
    { title: 'Számla kiállítása',               taskType: 'szamlazas',   est: 30 },
    { title: 'Minőségellenőrzés',               taskType: 'feldolgozas', est: 120 },
  ];
  store['crm-tasks'] = [];
  store.projects.forEach((p, pi) => {
    const count = 2 + (pi % 3);
    for (let k = 0; k < count; k++) {
      const tp = CRM_TASK_POOL[(pi + k) % CRM_TASK_POOL.length];
      const u = users[1 + ((pi + k) % 4)];
      store['crm-tasks'].push({
        id: nextId('task'), tenantId: T,
        title: tp.title,
        description: `${p.name} — ${tp.title.toLowerCase()}.`,
        taskType: tp.taskType,
        status: pick(taskStatuses, pi + k), priority: pick(['low', 'medium', 'high'], pi + k),
        assignedTo: u.id, assignedToName: u.fullName,
        customerId: p.customerId,
        projectId: p.id, projectName: p.name,
        startDate: day(-4 + k), dueDate: day(2 + k * 2 + (pi % 5)),
        estimatedMinutes: tp.est,
        createdAt: ts(-6 + pi),
      });
    }
  });
  store['internal-tasks'] = Array.from({ length: 14 }).map((_, i) => ({
    id: nextId('itask'), tenantId: T,
    title: pick(['Eszköz-karbantartás', 'Riport összeállítás', 'Számlázás ellenőrzés', 'Csapat-meeting'], i),
    status: pick(taskStatuses, i), priority: pick(['low', 'medium', 'high'], i),
    assignedTo: users[1 + (i % 4)].id, dueDate: day(i % 10), createdAt: ts(-6 + i),
  }));
  store.activities = Array.from({ length: 30 }).map((_, i) => ({
    id: nextId('act'), tenantId: T,
    type: pick(['call', 'email', 'meeting', 'note'], i),
    subject: pick(['Telefonhívás', 'E-mail egyeztetés', 'Személyes találkozó', 'Feljegyzés'], i),
    description: 'Ügyfél-kommunikáció a projekt kapcsán.',
    customerId: store.customers[i % store.customers.length].id,
    userId: users[1 + (i % 4)].id, createdAt: ts(-i),
  }));

  // ── Timesheets ───────────────────────────────────────────────────
  store.timesheets = Array.from({ length: 40 }).map((_, i) => ({
    id: nextId('ts'), tenantId: T,
    userId: users[1 + (i % 4)].id, userName: users[1 + (i % 4)].fullName,
    projectId: store.projects[i % store.projects.length].id,
    projectName: store.projects[i % store.projects.length].name,
    workDate: day(-(i % 20)), plannedHours: 8, actualHours: 6 + (i % 4),
    description: 'Terepi felmérés és feldolgozás.', createdAt: ts(-(i % 20)),
  }));

  // ── Documents / uploads ──────────────────────────────────────────
  store.documents = Array.from({ length: 16 }).map((_, i) => ({
    id: i < 2 ? `doc-${i + 1}` : nextId('doc'),
    tenantId: T,
    title: pick(['Árajánlat.pdf', 'Munkalap.pdf', 'Szerződés.pdf', 'Riport.pdf'], i),
    type: pick(['quote', 'work_order', 'contract', 'report'], i),
    status: pick(['draft', 'generated', 'sent'], i),
    resourceType: pick(['quote', 'work_order', 'contract', 'project'], i),
    resourceId: store.projects[i % store.projects.length].id,
    createdAt: ts(-i),
  }));
  store.uploads = Array.from({ length: 18 }).map((_, i) => ({
    id: i < 2 ? `upl-${i + 1}` : nextId('upl'),
    tenantId: T,
    fileName: `felmeres_${i + 1}.${pick(['jpg', 'pdf', 'png', 'dwg'], i)}`,
    mimeType: pick(['image/jpeg', 'application/pdf', 'image/png', 'application/octet-stream'], i),
    fileSize: (i + 1) * 245_000, state: 'available',
    resourceType: 'project', resourceId: store.projects[i % store.projects.length].id,
    createdAt: ts(-i),
  }));

  // ── Equipment / subcontractors / drone ──────────────────────────
  // Terepi eszközök + SZOFTVEREK + PC-k (a Projekt map admin „Szoftver mátrix"
  // füle a category==='software' és category==='pc' eszközökből építi a mátrixot).
  const FIELD_EQUIP: Array<{ name: string; type: string; category: string }> = [
    { name: 'DJI Mavic 3 Enterprise', type: 'drone',         category: 'drone' },
    { name: 'DJI Matrice 350 RTK',    type: 'drone',         category: 'drone' },
    { name: 'Leica RTC360',           type: 'scanner',       category: 'laser_scanner' },
    { name: 'Faro Focus Premium',     type: 'scanner',       category: 'laser_scanner' },
    { name: 'Trimble X7',             type: 'scanner',       category: 'laser_scanner' },
    { name: 'Leica TS16 mérőállomás', type: 'total_station', category: 'total_station' },
    { name: 'Emlid Reach RS2+ GNSS',  type: 'gnss',          category: 'gnss_receiver' },
  ];
  const SOFTWARE: Array<{ id: string; name: string }> = [
    { id: 'sw-revit',     name: 'Autodesk Revit 2025' },
    { id: 'sw-recap',     name: 'Autodesk ReCap Pro' },
    { id: 'sw-cyclone',   name: 'Leica Cyclone REGISTER 360' },
    { id: 'sw-metashape', name: 'Agisoft Metashape Pro' },
    { id: 'sw-pix4d',     name: 'Pix4Dmapper' },
    { id: 'sw-navis',     name: 'Autodesk Navisworks' },
    { id: 'sw-qgis',      name: 'QGIS' },
  ];
  const PCS: Array<{ id: string; name: string }> = [
    { id: 'pc-ws01',    name: 'Workstation-01 (Ryzen 9 / RTX 4080)' },
    { id: 'pc-ws02',    name: 'Workstation-02 (i9 / RTX 4090)' },
    { id: 'pc-field01', name: 'Field-Laptop-01 (mobil)' },
    { id: 'pc-render',  name: 'Render-Node-01' },
  ];
  store.equipment = [
    ...FIELD_EQUIP.map((e, i) => ({
      id: nextId('eq'), tenantId: T, name: e.name, type: e.type, category: e.category,
      status: pick(['available', 'in_use', 'maintenance'], i),
      serialNumber: `SN-${10000 + i}`, createdAt: ts(-60 + i),
    })),
    ...SOFTWARE.map((s, i) => ({
      id: s.id, tenantId: T, name: s.name, type: 'software', category: 'software',
      status: 'available', licenseSeats: 2 + (i % 4), createdAt: ts(-200 + i),
    })),
    ...PCS.map((pc, i) => ({
      id: pc.id, tenantId: T, name: pc.name, type: 'pc', category: 'pc',
      status: pick(['available', 'in_use'], i), createdAt: ts(-300 + i),
    })),
  ];
  // Szoftver ↔ PC install-mátrix (Projekt map → admin → „Szoftver mátrix").
  store['equipment/software-pc'] = [
    { softwareId: 'sw-revit',     pcId: 'pc-ws01' },
    { softwareId: 'sw-revit',     pcId: 'pc-ws02' },
    { softwareId: 'sw-recap',     pcId: 'pc-ws01' },
    { softwareId: 'sw-recap',     pcId: 'pc-ws02' },
    { softwareId: 'sw-cyclone',   pcId: 'pc-ws02' },
    { softwareId: 'sw-metashape', pcId: 'pc-ws01' },
    { softwareId: 'sw-metashape', pcId: 'pc-render' },
    { softwareId: 'sw-pix4d',     pcId: 'pc-render' },
    { softwareId: 'sw-navis',     pcId: 'pc-ws02' },
    { softwareId: 'sw-qgis',      pcId: 'pc-field01' },
    { softwareId: 'sw-qgis',      pcId: 'pc-ws01' },
  ];
  store.subcontractors = Array.from({ length: 8 }).map((_, i) => ({
    id: nextId('sub'), tenantId: T, name: pick(COMPANIES, i + 2),
    specialty: pick(['drónpilóta', 'BIM-modellező', 'geodéta', 'statikus'], i),
    hourlyRate: huf(12_000 + i * 2_000), isActive: true, createdAt: ts(-70 + i),
  }));
  store['drone/assets'] = store.equipment.filter((e) => e.type === 'drone');
  store['drone/pilots'] = Array.from({ length: 4 }).map((_, i) => ({
    id: nextId('pilot'), tenantId: T, name: users[1 + i].fullName,
    licenseNumber: `HU-DRONE-${2000 + i}`, licenseExpiry: day(200 + i), isActive: true,
  }));
  store['drone/operations'] = Array.from({ length: 6 }).map((_, i) => ({
    id: nextId('dop'), tenantId: T,
    name: `Repülés — ${pick(CITIES, i)}`, state: pick(['planned', 'approved', 'completed'], i),
    date: day(-5 + i), airspacePermitAcquired: i % 2 === 0, createdAt: ts(-5 + i),
  }));

  // ── Pricing ──────────────────────────────────────────────────────
  store.pricing = Array.from({ length: 14 }).map((_, i) => ({
    id: nextId('price'), tenantId: T,
    code: `SVC-${100 + i}`,
    name: pick(['Drónos ortofotó', 'Pontfelhő-feldolgozás', 'BIM LOD200', 'BIM LOD300', 'Homlokzat-felmérés', 'Riport'], i),
    unit: pick(['m2', 'db', 'óra', 'nap'], i), unitPrice: huf(15_000 + i * 8_000),
    groupId: `pgroup-${(i % 3) + 1}`, sortOrder: i, currency: 'HUF',
  }));
  store['pricing/groups'] = [
    { id: 'pgroup-1', tenantId: T, name: 'Drónos szolgáltatások', sortOrder: 0 },
    { id: 'pgroup-2', tenantId: T, name: 'BIM-modellezés', sortOrder: 1 },
    { id: 'pgroup-3', tenantId: T, name: 'Felmérés & riport', sortOrder: 2 },
  ];
  store['pricing/catalog'] = store.pricing;

  // ── Commission ───────────────────────────────────────────────────
  store.commission = Array.from({ length: 10 }).map((_, i) => ({
    id: nextId('comm'), tenantId: T,
    userId: users[1 + (i % 4)].id, userName: users[1 + (i % 4)].fullName,
    projectId: store.projects[i % store.projects.length].id,
    projectName: store.projects[i % store.projects.length].name,
    amount: huf(120_000 + i * 45_000), status: pick(['pending', 'earned', 'payable', 'paid'], i),
    month: day(-(i * 30)).slice(0, 7), createdAt: ts(-(i * 30)),
  }));

  // ── Notifications ────────────────────────────────────────────────
  store.notifications = Array.from({ length: 8 }).map((_, i) => ({
    id: nextId('notif'), tenantId: T, userId: 'user-demo',
    title: pick(['Új ajánlat elfogadva', 'Lejáró határidő', 'Számla kifizetve', 'Új feladat'], i),
    body: 'Kattints a részletekért.', type: pick(['deal_won', 'task_due', 'invoice_paid', 'task_assigned'], i),
    isRead: i > 2, read: i > 2, createdAt: ts(-i),
  }));

  // ── Pipelines ────────────────────────────────────────────────────
  store.pipelines = [{
    id: 'pipeline-1', tenantId: T, name: 'Értékesítési pipeline', isDefault: true,
    stages: stages.map((s, i) => ({ id: `stage-${i}`, key: s, name: s, sortOrder: i })),
  }];

  // ── Referrals ────────────────────────────────────────────────────
  store.referrals = Array.from({ length: 6 }).map((_, i) => ({
    id: nextId('ref'), tenantId: T,
    referrerUserId: users[1 + (i % 4)].id, referrerName: users[1 + (i % 4)].fullName,
    status: pick(['pending', 'converted', 'expired'], i),
    recipientName: `${pick(HU_FIRST, i)} ${pick(HU_LAST, i)}`,
    recipientEmail: `meghivott${i}@example.hu`,
    token: nextId('reftok'), expiresAt: ts(30 - i), createdAt: ts(-i),
  }));

  // ── Meeting / standup ────────────────────────────────────────────
  store.__meetingToday = [{
    id: 'meeting-today', tenantId: T, date: day(0), state: 'open',
    tasks: store['crm-tasks'].slice(0, 8).map((t) => ({ ...t })),
  }];

  // ── Webhooks / integrations / tenant sub-config ─────────────────
  store.webhooks = [{
    id: 'wh-1', tenantId: T, url: 'https://n8n.example.hu/webhook/demo',
    events: ['deal.won', 'invoice.paid'], isActive: true, secret: '••••••••', createdAt: ts(-30),
  }];
  // Projekt map task-típusok — a hook a { value, label, color, sortIndex, icon,
  // isUnassigned } sémát várja; ezek színezik a Gantt-oszlopokat és a legendet.
  store['tenants/me/task-types'] = [
    { value: 'drone',       label: 'Drónrepülés',           color: '#4f9d69', sortIndex: 0, icon: '🚁' },
    { value: 'feldolgozas', label: 'Pontfelhő-feldolgozás', color: '#0ea5e9', sortIndex: 1, icon: '🧩' },
    { value: 'modellezes',  label: 'BIM-modellezés',        color: '#c8a24a', sortIndex: 2, icon: '🏗️' },
    { value: 'geodezia',    label: 'Geodéziai bemérés',     color: '#8b5cf6', sortIndex: 3, icon: '📐' },
    { value: 'helyszin',    label: 'Helyszíni bejárás',     color: '#f59e0b', sortIndex: 4, icon: '🥾' },
    { value: 'egyeztetes',  label: 'Ügyfél-egyeztetés',     color: '#6366f1', sortIndex: 5, icon: '📞' },
    { value: 'qa',          label: 'Minőségellenőrzés',     color: '#ef4444', sortIndex: 6, icon: '✅' },
    { value: 'atadas',      label: 'Átadás-átvétel',        color: '#10b981', sortIndex: 7, icon: '📦' },
    { value: 'szamlazas',   label: 'Számlázás',             color: '#64748b', sortIndex: 8, icon: '🧾', isUnassigned: true },
    { value: 'gepido',      label: 'Gépidő (render)',       color: '#94a3b8', sortIndex: 9, icon: '⚙️', isUnassigned: true },
  ];

  return store;
}
