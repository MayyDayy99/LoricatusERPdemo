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

  // ── Projects ─────────────────────────────────────────────────────
  const projStates = ['planning', 'active', 'active', 'on_hold', 'completed'];
  store.projects = Array.from({ length: 16 }).map((_, i) => ({
    id: i < 3 ? `proj-${i + 1}` : nextId('proj'),
    tenantId: T,
    name: `${pick(CITIES, i)} — ${pick(['Homlokzat-felújítás', 'Drónos állapotrögzítés', 'BIM-modellezés', 'Belső felmérés', 'Tetőszerkezet'], i)}`,
    code: `PRJ-2026-${String(i + 1).padStart(3, '0')}`,
    state: pick(projStates, i), status: pick(projStates, i),
    customerId: store.customers[i % store.customers.length].id,
    customerName: store.customers[i % store.customers.length].name,
    managerId: users[1 + (i % 4)].id,
    categoryId: null,
    budget: huf(2_000_000 + i * 850_000), currency: 'HUF',
    progress: (i * 13) % 100,
    startDate: day(-30 + i), endDate: day(15 + i * 3),
    createdAt: ts(-40 + i), updatedAt: ts(-i),
  }));
  store['projects/categories'] = [
    { id: 'cat-1', tenantId: T, name: 'Drónos felmérés', color: '#4f9d69', sortOrder: 0 },
    { id: 'cat-2', tenantId: T, name: 'BIM-modellezés', color: '#c8a24a', sortOrder: 1 },
    { id: 'cat-3', tenantId: T, name: 'Homlokzat', color: '#6b8cae', sortOrder: 2 },
  ];
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
  const woStates = ['draft', 'active', 'completed', 'signed_off', 'archived'];
  store['work-orders'] = Array.from({ length: 14 }).map((_, i) => ({
    id: i < 2 ? `wo-${i + 1}` : nextId('wo'),
    tenantId: T,
    workOrderNumber: `WO-2026-${String(i + 1).padStart(4, '0')}`,
    title: `Munkalap — ${pick(CITIES, i)}`,
    state: pick(woStates, i), status: pick(woStates, i),
    customerId: store.customers[i % store.customers.length].id,
    customerName: store.customers[i % store.customers.length].name,
    projectId: store.projects[i % store.projects.length].id,
    location: `${pick(CITIES, i)}, munkaterület ${i + 1}.`,
    scheduledDate: day(-5 + i), createdAt: ts(-10 + i), updatedAt: ts(-i),
  }));

  // ── CRM-tasks / internal-tasks / activities ──────────────────────
  const taskStatuses = ['pending', 'in_progress', 'completed', 'draft'];
  store['crm-tasks'] = Array.from({ length: 26 }).map((_, i) => ({
    id: nextId('task'), tenantId: T,
    title: pick(['Ügyfél visszahívása', 'Ajánlat kiküldése', 'Helyszíni bejárás', 'Szerződés egyeztetés', 'Drón-repülés ütemezése'], i),
    status: pick(taskStatuses, i), priority: pick(['low', 'medium', 'high'], i),
    assignedTo: users[1 + (i % 4)].id, assignedToName: users[1 + (i % 4)].fullName,
    customerId: store.customers[i % store.customers.length].id,
    dueDate: day(-3 + (i % 12)), createdAt: ts(-8 + i),
  }));
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
  store.equipment = Array.from({ length: 10 }).map((_, i) => ({
    id: nextId('eq'), tenantId: T,
    name: pick(['DJI Mavic 3 Enterprise', 'Leica RTC360', 'GeoSLAM ZEB', 'Trimble X7', 'Faro Focus'], i),
    type: pick(['drone', 'scanner', 'scanner', 'total_station'], i),
    status: pick(['available', 'in_use', 'maintenance'], i),
    serialNumber: `SN-${10000 + i}`, createdAt: ts(-60 + i),
  }));
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
  store['tenants/me/task-types'] = [
    { id: 'tt-1', name: 'Drónrepülés', color: '#4f9d69' },
    { id: 'tt-2', name: 'Feldolgozás', color: '#c8a24a' },
    { id: 'tt-3', name: 'Modellezés', color: '#6b8cae' },
  ];

  return store;
}
