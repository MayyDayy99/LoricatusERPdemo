/**
 * Demó mock-router: (metódus, path, query, body) → { status, data }.
 *
 * Két rétegű:
 *  1) Speciális handlerek — nem-REST végpontok (auth/me, analytics, meeting…).
 *  2) Generikus resource-CRUD — a REST-mintás gyűjtemények felett a store-ban.
 * Ismeretlen végpont: graceful fallback (üres lista / echo), hogy egyetlen
 * oldal se dőljön el.
 */

import { buildSeed, nextId, Store, Row } from './db';

/* eslint-disable @typescript-eslint/no-explicit-any */

let store: Store = buildSeed();

/** Teljes újraseedelés (a "Demó visszaállítása" gombhoz). */
export function resetStore(): void { store = buildSeed(); }

export interface MockResponse { status: number; data: any; }

const ok = (data: any = {}): MockResponse => ({ status: 200, data });
const created = (data: any = {}): MockResponse => ({ status: 201, data });

/** Id-szerű szegmens: UUID, prefixelt id (proj-1), vagy szám. Sima szó NEM az. */
function isIdLike(s: string): boolean {
  return /\d/.test(s) || /^[0-9a-f]{8}-/i.test(s) || s.length > 24;
}

function paginate(rows: Row[], query: URLSearchParams, key: string): any {
  const take = Number(query.get('take') ?? query.get('limit') ?? '0');
  const skip = Number(query.get('skip') ?? query.get('offset') ?? '0');
  const total = rows.length;
  let out = rows;
  if (take > 0) out = rows.slice(skip, skip + take);
  else if (skip > 0) out = rows.slice(skip);
  // A lista-hookok defenzíven tömböt is elfogadnak (`Array.isArray(data) ? data
  // : data.items`), a nyers fogyasztók (pl. finances) viszont TÖMBÖT várnak.
  // Ezért mindig tömböt adunk — ez mindkét oldalt kiszolgálja.
  void total; void key;
  return out;
}

/** Egyszerű query-szűrés a leggyakoribb mezőkre. */
function applyFilters(rows: Row[], query: URLSearchParams): Row[] {
  let out = rows;
  const eq = (field: string, val: string | null) => {
    if (val == null || val === '') return;
    out = out.filter((r) => String(r[field]) === val);
  };
  eq('customerId', query.get('customerId'));
  eq('projectId', query.get('projectId'));
  eq('state', query.get('state'));
  eq('status', query.get('status'));
  eq('stage', query.get('stage'));
  eq('userId', query.get('userId'));
  // Szoba-szűrés a /rooms-hoz: a kliens a "Besorolatlan"-hoz a 'null' sztringet küldi.
  const cat = query.get('categoryId');
  if (cat != null && cat !== '') {
    if (cat === 'null') out = out.filter((r) => r.categoryId == null);
    else out = out.filter((r) => String(r.categoryId) === cat);
  }
  const search = (query.get('search') ?? query.get('q') ?? '').toLowerCase();
  if (search) {
    out = out.filter((r) => JSON.stringify(r).toLowerCase().includes(search));
  }
  return out;
}

// ── Speciális handlerek ────────────────────────────────────────────
type Handler = (m: string, parts: string[], query: URLSearchParams, body: any) => MockResponse | null;

const special: Handler = (m, parts, query, body) => {
  const path = parts.join('/');

  // Auth
  if (path === 'auth/login' && m === 'post') return ok({ accessToken: 'demo-access-token', user: store.__me[0] });
  if (path === 'auth/refresh' && m === 'post') return ok({ accessToken: 'demo-access-token' });
  if (path === 'auth/logout' && m === 'post') return ok({ success: true });
  if (path === 'auth/change-password' && m === 'post') return ok({ success: true });
  if (path.startsWith('auth/2fa')) return ok({ success: true, recoveryCodes: ['DEMO-1111', 'DEMO-2222'] });
  if (path === 'auth/oauth/providers') return ok([]);

  // Current user / me
  if (path === 'users/me' || path === 'auth/me') return ok(store.__me[0]);
  if (path === 'users/me/permissions') return ok({ permissions: ['*'], role: 'admin' });
  if (path === 'users/me/settings' && m === 'get') return ok({});
  if (path.startsWith('users/me/settings/')) return ok({ value: null });
  if (path === 'users/me/preferences') return ok(store.__me[0].preferences ?? {});
  if (path.startsWith('users/me/avatar')) return ok({ success: true });

  // Tenant self-service
  if (path === 'tenants/me' && m === 'get') return ok(store.tenants[0]);
  // Projekt-map task-típusok — a hook { taskTypes, isCustom } alakot vár.
  if (path === 'tenants/me/task-types') {
    if (m === 'put') store['tenants/me/task-types'] = body?.taskTypes ?? store['tenants/me/task-types'];
    return ok({ taskTypes: store['tenants/me/task-types'] ?? [], isCustom: m !== 'delete' });
  }
  if (path.startsWith('tenants/me/')) {
    const sub = path.replace('tenants/me/', '');
    if (m === 'get') return ok(store[`tenants/me/${sub}`] ?? store.tenants[0][sub] ?? {});
    // branding / company-profile / sidebar-policies / weather-thresholds patch
    if (sub === 'branding' && body) store.tenants[0].branding = { ...store.tenants[0].branding, ...body };
    if (sub === 'company-profile' && body) store.tenants[0].companyProfile = { ...store.tenants[0].companyProfile, ...body };
    return ok({ ...store.tenants[0], ...(body ?? {}) });
  }

  // Analytics / dashboard
  if (path === 'analytics/dashboard') return ok(dashboardKpis());
  if (path.startsWith('analytics/crm-dashboard')) return ok(crmDashboard());
  if (path === 'dashboard/overview') return ok(meetingOverview());   // Gantt/meeting overview
  if (path.startsWith('analytics/')) return ok(dashboardKpis());
  if (path === 'dashboard/tasks' && m === 'get') return ok(store['crm-tasks']);
  // "Mai teendőim" — pár mai határidős, nem kész feladat
  if (path === 'crm-tasks/my-today' && m === 'get') {
    const today = new Date().toISOString().slice(0, 10);
    const rows = store['crm-tasks'].slice(0, 6).map((t, i) => ({ ...t, dueDate: today, status: i === 0 ? 'completed' : (i % 2 ? 'pending' : 'in_progress') }));
    return ok(rows);
  }
  if (path.startsWith('dashboard/projects/') && path.endsWith('/report')) return ok(projectReport(parts[2]));
  if (path.startsWith('dashboard/tasks/') && path.endsWith('/duration-revisions')) return ok([]);
  if (path === 'dashboard/task-chain' && m === 'get') return ok([]);

  // Meeting / standup
  if (path === 'meeting/today' || path === 'meeting/today/tasks') return ok(store.__meetingToday[0]);
  if (path === 'meeting/start' && m === 'post') return ok(store.__meetingToday[0]);
  if (path === 'meeting/today/close' && m === 'post') { store.__meetingToday[0].state = 'closed'; return ok(store.__meetingToday[0]); }
  if (path.startsWith('meeting/')) return ok(store.__meetingToday[0]);

  // Commission
  if (path === 'commission/settings') {
    if (m === 'get') return ok(commissionSettings());
    return ok({ ...commissionSettings(), ...(body ?? {}) });   // PUT/PATCH echo
  }
  if (path === 'commission/list' && m === 'get') return ok(store.commission);
  if (path.startsWith('commission/monthly-summary') && m === 'get') return ok(commissionMonthly());
  if (path.startsWith('commission/projects/') && m === 'get') {
    return ok({ projectId: parts[2], records: store.commission.slice(0, 4), total: 480_000, breakdown: [] });
  }
  if (path === 'commission' && m === 'get') return ok(store.commission);
  if (path.startsWith('commission/') && m === 'get') return ok(store.commission);
  if (path.startsWith('commission/')) return ok({ success: true });

  // Notifications
  if (path === 'notifications' && m === 'get') {
    const unread = query.get('unreadOnly') === 'true';
    const rows = unread ? store.notifications.filter((n) => !n.isRead) : store.notifications;
    return ok(rows);
  }
  if (path === 'notifications/read-all' && m === 'post') { store.notifications.forEach((n) => { n.isRead = true; n.read = true; }); return ok({ success: true }); }
  if (path.match(/^notifications\/[^/]+\/read$/)) {
    const id = parts[1]; const n = store.notifications.find((x) => x.id === id); if (n) { n.isRead = true; n.read = true; }
    return ok({ success: true });
  }

  // Quote/invoice line-items
  if (path.match(/^quotes\/[^/]+\/line-items$/) && m === 'get') return ok((store.__quoteLineItems as any)[parts[1]] ?? []);
  if (path.match(/^invoices\/[^/]+\/line-items$/) && m === 'get') return ok((store.__invoiceLineItems as any)[parts[1]] ?? []);

  // Customer-360 összegzés
  if (path.match(/^customers\/[^/]+\/summary$/) && m === 'get') return ok(customerSummary(parts[1]));

  // Munkalap task-statisztika (a work-order detail fejlécéhez)
  if (path.match(/^work-orders\/[^/]+\/task-stats$/) && m === 'get') {
    const wo = store['work-orders'].find((w) => w.id === parts[1]);
    const its = (wo?.items as Row[] | undefined) ?? [];
    return ok({ taskCount: its.length, draftCount: its.filter((it) => it.status !== 'done').length });
  }

  // Szoftver ↔ PC mátrix (Projekt map → admin → „Szoftver mátrix")
  if (path === 'equipment/software-pc/list' && m === 'get') return ok(store['equipment/software-pc'] ?? []);
  if (path === 'equipment/software-pc' && m === 'post') {
    const list = store['equipment/software-pc'] ?? (store['equipment/software-pc'] = []);
    if (body?.softwareId && body?.pcId && !list.some((l) => l.softwareId === body.softwareId && l.pcId === body.pcId)) {
      list.push({ softwareId: body.softwareId, pcId: body.pcId });
    }
    return ok({ success: true });
  }
  if (parts[0] === 'equipment' && parts[1] === 'software-pc' && parts.length === 4 && m === 'delete') {
    store['equipment/software-pc'] = (store['equipment/software-pc'] ?? []).filter((l) => !(l.softwareId === parts[2] && l.pcId === parts[3]));
    return ok({ success: true });
  }

  // PDF / file urls — demó-placeholder
  if (path.endsWith('/pdf') || path.endsWith('/pdf-url') || path.endsWith('/url') || path.endsWith('/download')) {
    return ok({ url: 'about:blank', message: 'Demó — a PDF-generálás valós backenden működik.' });
  }
  if (path.endsWith('/generate-pdf') || path.endsWith('/generate') || path.endsWith('/send')) {
    return ok({ success: true, message: 'Demó — nem küldünk valódi e-mailt / PDF-et.' });
  }

  // Notam / weather / maps — külső szolgáltatások, demó-üres
  if (path.startsWith('notam/')) return ok(path.includes('quota') ? { used: 3, limit: 100 } : []);
  if (path.startsWith('weather')) return ok({ temperature: 18, wind: 12, condition: 'Napos', forecast: [] });
  if (path.startsWith('maps/')) return ok([]);
  if (path === 'minicrm/import' || path.startsWith('minicrm/')) return ok({ success: true, imported: 0, message: 'Demó — nincs valódi import.' });

  // Search
  if (path === 'search') return ok({ results: [], total: 0 });

  return null;
}

function dashboardKpis(): any {
  const sum = (rows: Row[], f: string) => rows.reduce((a, r) => a + (Number(r[f]) || 0), 0);
  const paid = store.invoices.filter((i) => i.state === 'paid');
  const openInv = store.invoices.filter((i) => !['paid', 'draft'].includes(i.state));
  const won = store.deals.filter((d) => d.stage === 'won').length;
  const lost = store.deals.filter((d) => d.stage === 'lost').length;
  const openDeals = store.deals.filter((d) => !['won', 'lost'].includes(d.stage));
  const revenue = sum(paid, 'totalAmount');
  const today = new Date().toISOString().slice(0, 10);
  const byStage = (s: string) => store.deals.filter((d) => d.stage === s);
  return {
    revenue,
    monthlyRevenue: revenue,
    pipelineValue: sum(openDeals, 'value'),
    winRate: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0,
    activeProjects: store.projects.filter((p) => p.state === 'active').length,
    openDeals: openDeals.length,
    openDealsCount: openDeals.length,
    wonDealsCount: won,
    lostDealsCount: lost,
    openQuotesCount: store.quotes.filter((q) => q.state === 'sent').length,
    totalCustomers: store.customers.length,
    paidInvoicesValue: revenue,
    openInvoicesValue: sum(openInv, 'totalAmount'),
    overdueInvoicesCount: store.invoices.filter((i) => i.state === 'overdue').length,
    overdueTasksCount: store['crm-tasks'].filter((t) => t.status !== 'completed' && t.dueDate < today).length,
    pendingTasks: store['crm-tasks'].filter((t) => t.status === 'pending').length,
    pendingQuotesCount: store.quotes.filter((q) => q.state === 'sent').length,
    // Évfüggetlen: az utolsó 6 hónap a mai hónapig (a látogatás napjához igazodva).
    revenueByMonth: Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (5 - i));
      return { month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, value: 2_000_000 + i * 640_000 };
    }),
    dealsByStage: ['lead', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost'].map((s) => ({
      stage: s, count: byStage(s).length, value: byStage(s).reduce((a, d) => a + d.value, 0),
    })),
    funnel: ['lead', 'qualified', 'proposal_sent', 'negotiation', 'won'].map((s) => ({
      stage: s, count: byStage(s).length, value: byStage(s).reduce((a, d) => a + d.value, 0),
    })),
  };
}

function dayOff(offset: number): string {
  const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10);
}

/** A meeting/Gantt-nézet gazdag overview-ja (/dashboard/overview). */
function meetingOverview(): any {
  const people = store.users.map((u) => ({
    id: u.id, name: u.fullName, fullName: u.fullName,
    firstName: u.firstName ?? 'N', lastName: u.lastName ?? 'N',
    role: u.role, roleType: u.roleType, avatarUrl: null, pcId: null,
  }));
  const projects = store.projects.map((p) => ({ ...p }));
  // A Gantt-oszlopok a task-típusból színeződnek; a legenda ugyanezt a listát kapja.
  const ttList = (store['tenants/me/task-types'] ?? []) as Row[];
  const planTypes = ['drone', 'geodezia', 'feldolgozas', 'modellezes', 'qa', 'atadas', 'helyszin', 'egyeztetes'];
  const ttLabel = (v: string): string => (ttList.find((t) => t.value === v)?.label as string) ?? v;
  const firstPc = store.equipment.find((e) => e.category === 'pc')?.id ?? null;
  const tasks: Row[] = [];
  store.projects.forEach((p, pi) => {
    const n = 2 + (pi % 3);
    let prevId: string | null = null;
    for (let k = 0; k < n; k++) {
      const start = -6 + pi + k * 4;
      const person = people[(pi + k) % people.length];
      const tt = planTypes[(pi + k) % planTypes.length];
      const id = nextId('plan');
      const usesSoftware = tt === 'modellezes' || tt === 'feldolgozas';
      tasks.push({
        id, tenantId: 'demo-tenant-0001',
        projectId: p.id, projectName: p.name,
        title: ttLabel(tt),
        startDate: dayOff(start), endDate: dayOff(start + 3), duration: 3,
        status: pick(['pending', 'in_progress', 'completed'], k),
        assignedTo: person.id, assignedToName: person.name,
        taskType: tt, lane: k,
        equipmentIds: [], pilotIds: [], assigneeIds: [person.id],
        softwarePcIds: usesSoftware && firstPc ? [firstPc] : [],
        ...(prevId ? { dependsOnId: prevId, dependencies: [prevId] } : { dependencies: [] }),
      });
      prevId = id;
    }
  });
  const typeToCategory: Record<string, string> = { drone: 'drone', scanner: 'laser_scanner', total_station: 'total_station', camera: 'camera' };
  const equipment = store.equipment.map((e) => ({ ...e, category: e.category ?? typeToCategory[e.type] ?? 'misc' }));
  return {
    tasks, people, projects,
    equipment, softwarePcs: [], softwarePc: store['equipment/software-pc'] ?? [],
    dayAnnotations: [], scheduledPings: [], vacations: [], leaves: [],
    from: dayOff(-30), to: dayOff(730),
  };
}

function pick<T>(arr: T[], i: number): T { return arr[((i % arr.length) + arr.length) % arr.length]; }

function crmDashboard(): any {
  const k = dashboardKpis();
  const sum = (rows: Row[], f: string) => rows.reduce((a, r) => a + (Number(r[f]) || 0), 0);
  return {
    pipelineValue: k.pipelineValue,
    weightedPipelineValue: Math.round(k.pipelineValue * 0.45),
    openDealsCount: k.openDealsCount, wonDealsCount: k.wonDealsCount, lostDealsCount: k.lostDealsCount,
    winRate: k.winRate,
    avgDealSize: store.deals.length ? Math.round(sum(store.deals, 'value') / store.deals.length) : 0,
    monthlyRevenue: k.monthlyRevenue,
    openQuotesCount: k.openQuotesCount,
    openQuotesValue: sum(store.quotes.filter((q) => q.state === 'sent'), 'totalAmount'),
    acceptedQuotesCount: store.quotes.filter((q) => q.state === 'accepted').length,
    overdueTasksCount: k.overdueTasksCount,
    openInvoicesValue: k.openInvoicesValue, paidInvoicesValue: k.paidInvoicesValue,
    pipelineFunnel: k.funnel,
    pendingQuotesCount: k.pendingQuotesCount,
    overdueInvoicesCount: k.overdueInvoicesCount,
    overdueInvoicesValue: sum(store.invoices.filter((i) => i.state === 'overdue'), 'totalAmount'),
    expiringContractsCount: store.contracts.filter((c) => c.state === 'active').length,
    overdueWorkOrdersCount: 2,
    stagnantDealsCount: 3,
  };
}

function commissionSettings(): any {
  return {
    dailyRateHuf: 45000, workforceSize: 6, monthlyBaseSalaryHuf: 400000,
    ratioCost: 0.55, ratioProfit: 0.20, ratioCommission: 0.05, commissionRatio: 0.05,
    ratioOverhead: 0.20, subcontractorMarkup: 1.20,
    customerPaymentOffsetMonths: 1, commissionPayoutOffsetMonths: 2,
  };
}

function commissionMonthly(): any {
  return {
    month: new Date().toISOString().slice(0, 7),
    total: store.commission.reduce((a, c) => a + c.amount, 0),
    paid: store.commission.filter((c) => c.status === 'paid').reduce((a, c) => a + c.amount, 0),
    records: store.commission,
    byUser: store.users.slice(1, 5).map((u) => ({ userId: u.id, userName: u.fullName, amount: 180000 })),
  };
}

function customerSummary(id: string): any {
  const c = store.customers.find((x) => x.id === id) ?? store.customers[0];
  // Ha kevés a saját sor, adjunk néhány általánosat, hogy a fülek ne legyenek üresek.
  const mine = (rows: Row[]) => {
    const own = rows.filter((r) => r.customerId === c.id);
    return own.length ? own.slice(0, 10) : rows.slice(0, 3);
  };
  return {
    ...c,
    customer: c,
    lifecycleStage: c.lifecycleStage, leadScore: c.leadScore,
    totalRevenue: 4_800_000, openDealsValue: 2_100_000,
    recentProjects: mine(store.projects),
    recentDeals: mine(store.deals),
    recentActivities: mine(store.activities),
    recentContracts: mine(store.contracts),
    recentInvoices: mine(store.invoices),
    recentWorkOrders: mine(store['work-orders']),
    recentQuotes: mine(store.quotes),
    stats: { projects: mine(store.projects).length, deals: mine(store.deals).length, wonDeals: 2, openDeals: 1 },
  };
}

function projectReport(id: string): any {
  const p = store.projects.find((x) => x.id === id) ?? store.projects[0];
  return { project: p, tasks: store['crm-tasks'].slice(0, 6), timesheets: store.timesheets.slice(0, 6), progress: p?.progress ?? 0 };
}

// ── Generikus resource-CRUD ─────────────────────────────────────────
/** A path első szegmense a gyűjtemény-kulcs; néhány kétszegmensű alkulcs. */
function collectionKey(parts: string[]): string | null {
  const two = parts.slice(0, 2).join('/');
  if (store[two]) return two;              // pl. projects/categories, pricing/groups, drone/assets
  if (store[parts[0]]) return parts[0];
  return null;
}

function generic(m: string, parts: string[], query: URLSearchParams, body: any): MockResponse {
  const key = collectionKey(parts);

  // Ismeretlen gyűjtemény → graceful fallback
  if (!key) {
    if (m === 'get') return ok([]);
    return ok({ success: true, ...(body ?? {}) });
  }

  const keyDepth = key.split('/').length;
  const rest = parts.slice(keyDepth);       // [] | [id] | [id, sub] ...
  const rows = store[key];

  // Kollekció szint
  if (rest.length === 0) {
    if (m === 'get') return ok(paginate(applyFilters(rows, query), query, key));
    if (m === 'post') {
      const row: Row = { id: nextId(key.replace(/\W/g, '')), tenantId: 'demo-tenant-0001', createdAt: new Date().toISOString(), ...body };
      rows.unshift(row);
      return created(row);
    }
  }

  // Elem szint: /:id
  if (rest.length === 1) {
    const id = rest[0];
    // Ha a szegmens NEM id-szerű (sima szó, pl. "statuses", "catalog",
    // "summary", "list"), akkor ez egy al-gyűjtemény/aggregátum, nem elem →
    // GET-nél tömböt adunk, hogy a .map/.filter ne dőljön el.
    if (m === 'get' && !isIdLike(id) && !store[`${key}/${id}`]) return ok([]);
    const idx = rows.findIndex((r) => r.id === id);
    if (m === 'get') return idx >= 0 ? ok(rows[idx]) : ok({});
    if ((m === 'patch' || m === 'put') && idx >= 0) { rows[idx] = { ...rows[idx], ...body, updatedAt: new Date().toISOString() }; return ok(rows[idx]); }
    if (m === 'delete') { if (idx >= 0) rows.splice(idx, 1); return ok({ success: true }); }
  }

  // Al-erőforrás / akció: /:id/valami — demó-echo
  if (rest.length >= 2) {
    const id = rest[0];
    const idx = rows.findIndex((r) => r.id === id);
    // state-transition jellegű akciók: frissítsük a state-et, ha értelmes
    const action = rest[1];
    if (m === 'post' && idx >= 0 && ['transition', 'issue', 'send', 'activate', 'complete', 'cancel', 'terminate', 'expire', 'restore', 'record-payment', 'mark-paid', 'start', 'finalize', 'reactivate'].includes(action)) {
      const map: Record<string, string> = { issue: 'sent', activate: 'active', complete: 'completed', cancel: 'cancelled', terminate: 'terminated', expire: 'expired', start: 'in_progress', finalize: 'pending', reactivate: 'active' };
      if (body?.transition) rows[idx].state = body.transition;
      else if (map[action]) rows[idx].state = rows[idx].status = map[action];
      return ok(rows[idx]);
    }
    if (m === 'get') return ok([]);
    return ok({ success: true, ...(body ?? {}) });
  }

  // Fallback
  return m === 'get' ? ok([]) : ok({ success: true });
}

// ── Belépési pont ──────────────────────────────────────────────────
export function handle(method: string, url: string, body: any): MockResponse {
  const m = method.toLowerCase();
  // url: pl. "/projects/123/transition?take=50" (baseURL /api/v1 már levágva)
  const [rawPath, rawQuery] = url.split('?');
  const query = new URLSearchParams(rawQuery ?? '');
  const parts = rawPath.replace(/^\/+/, '').replace(/\/+$/, '').split('/').filter(Boolean);

  try {
    const s = special(m, parts, query, body);
    if (s) return s;
    return generic(m, parts, query, body);
  } catch (err) {
    // Demóban soha ne dőljön el egy oldal egy hiányzó handler miatt.
    // eslint-disable-next-line no-console
    console.warn('[demo] handler error', method, url, err);
    return m === 'get' ? ok([]) : ok({ success: true });
  }
}
