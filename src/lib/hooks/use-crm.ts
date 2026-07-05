import useSWR, { mutate as swrMutate } from 'swr';
import { apiClient } from '../api-client';

// Egy task-művelet (create/update/complete/checklist) audit-log-ot ír a backenden,
// amit a projekt Newsfeed `/projects/{id}/activity` SWR-kulcson keresztül olvas.
// A frontend SWR-cache-ét NEM frissíti a hálózati válasz önmagában — explicit
// revalidate kell, különben a timeline csak F5 után frissül.
function revalidateProjectScope(projectId?: string | null) {
  if (!projectId) return;
  void swrMutate(`/projects/${projectId}/activity`);
  void swrMutate(`/activities/project/${projectId}`);
  // A useCrmTasks SWR-kulcsai dinamikusak (buildKey), ezért prefix-match-tel
  // invalidáljuk az összes /crm-tasks?... kulcsot.
  void swrMutate(
    (key) => typeof key === 'string' && key.startsWith('/crm-tasks'),
    undefined,
    { revalidate: true },
  );
}

// A "Mai napom" forrás-kulcsait FELTÉTEL NÉLKÜL revalidálja. A
// revalidateProjectScope `if(!projectId)return`-je miatt projekt nélküli
// (orphan) teendő pipálása/indítása után a my-today/my listák nem frissülnének.
export function revalidateMyScope() {
  void swrMutate('/crm-tasks/my-today');
  void swrMutate('/crm-tasks/my');
}

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface CrmTask {
  id: string;
  title: string;
  description?: string;
  taskType?: string;
  priority: 'low' | 'medium' | 'high';
  /** 'draft' (PISZKOZAT) — árazógép-importból a /quotes/:id/import-to-project endpoint
   *  hozza létre; a Teendők-listákból szűrve, csak a Map-en jelenik meg szaggatott
   *  PISZKOZAT-sávval, amíg a user nem véglegesíti (draft → pending). */
  status: 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled';
  startDate?: string;
  dueDate?: string;
  reminderAt?: string;
  completedAt?: string;
  customerId?: string;
  customerName?: string;
  dealId?: string;
  dealTitle?: string;
  projectId?: string;
  projectName?: string;
  assignedTo: string;
  assignedToName?: string;
  /** További érintettek (helper user-id-k). A "Mai napom" minden helper-nél megjeleníti. */
  helpers?: string[];
  createdBy: string;
  createdAt: string;
  // SLA
  ticketCategory?: string;
  slaDeadline?: string;
  slaStatus?: 'ok' | 'at_risk' | 'breached';
  customerSatisfaction?: number;
  // MiniCRM-style "Becsült időtartam" (perc)
  estimatedMinutes?: number;
}

export interface CrmActivity {
  id: string;
  activityType: 'CALL' | 'EMAIL' | 'MEETING' | 'NOTE' | 'SITE_VISIT' | 'TASK_COMPLETED' | 'SYSTEM';
  subject?: string;
  body?: string;
  direction?: string;
  durationMinutes?: number;
  occurredAt: string;
  customerId?: string;
  customerName?: string;
  dealId?: string;
  dealTitle?: string;
  projectId?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
}

export interface Deal {
  id: string;
  title: string;
  stage: 'lead' | 'qualified' | 'proposal_sent' | 'negotiation' | 'won' | 'lost';
  value?: number;
  currency?: string;
  probability?: number;
  expectedCloseDate?: string;
  pipelineId: string;
  position: number;
  customerId?: string;
  customerName?: string;
  projectId?: string;
  assignedTo?: string;
  createdAt: string;
}

export interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  stages: Array<{ name: string; order: number; probability?: number; color?: string }>;
  createdAt: string;
}

export interface Quote {
  id: string;
  quoteNumber?: string;
  title: string;
  state: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  totalAmount?: number;
  currency?: string;
  validUntil?: string;
  customerId?: string;
  customerName?: string;
  dealId?: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber?: string;
  state: 'DRAFT' | 'ISSUED' | 'SENT' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED' | 'CREDITED';
  totalAmount?: number;
  paidAmount?: number;
  currency?: string;
  dueDate?: string;
  customerId?: string;
  customerName?: string;
  quoteId?: string;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  taskId: string;
  text: string;
  done: boolean;
  sortIndex: number;
  createdAt: string;
  updatedAt: string;
}

export function useTaskChecklist(taskId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ChecklistItem[]>(
    taskId ? `/crm-tasks/${taskId}/checklist` : null,
    fetcher,
  );
  return { items: data ?? [], error, isLoading, mutate };
}

export async function addChecklistItem(taskId: string, text: string): Promise<ChecklistItem> {
  const res = await apiClient.post(`/crm-tasks/${taskId}/checklist`, { text });
  revalidateProjectScope(res.data?.projectId);
  return res.data;
}

export async function updateChecklistItem(
  itemId: string,
  patch: { text?: string; done?: boolean; sortIndex?: number },
): Promise<ChecklistItem> {
  const res = await apiClient.patch(`/crm-tasks/checklist-items/${itemId}`, patch);
  // A ChecklistItem-en nincs projectId — minden projekt-activity-t revalidálunk.
  void swrMutate(
    (key) => typeof key === 'string' && key.startsWith('/projects/') && key.endsWith('/activity'),
  );
  return res.data;
}

export async function deleteChecklistItem(itemId: string): Promise<void> {
  await apiClient.delete(`/crm-tasks/checklist-items/${itemId}`);
  void swrMutate(
    (key) => typeof key === 'string' && key.startsWith('/projects/') && key.endsWith('/activity'),
  );
}

export interface CreateCrmTaskDto {
  title: string;
  assignedTo?: string;
  description?: string;
  taskType?: string;
  priority?: 'low' | 'medium' | 'high';
  startDate?: string;
  dueDate?: string;
  customerId?: string;
  dealId?: string;
  projectId?: string;
  ticketCategory?: string;
  slaDeadline?: string;
  estimatedMinutes?: number;
}

export interface CreateActivityDto {
  activityType: CrmActivity['activityType'];
  subject?: string;
  body?: string;
  customerId?: string;
  dealId?: string;
  projectId?: string;
  occurredAt?: string;
  durationMinutes?: number;
}

// ─── Fetcher ─────────────────────────────────────────────────────────────────

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

function buildKey(base: string, filters?: Record<string, string | undefined>): string | null {
  if (!filters) return base;
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== undefined) as [string, string][],
  );
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useMyTasks() {
  const { data, error, isLoading, mutate } = useSWR<CrmTask[]>('/crm-tasks/my', fetcher);
  return { tasks: data ?? [], error, isLoading, mutate };
}

export function useMyTodayTasks() {
  const { data, error, isLoading, mutate } = useSWR<CrmTask[]>('/crm-tasks/my-today', fetcher);
  return { tasks: data ?? [], error, isLoading, mutate };
}

export function useOverdueTasks() {
  const { data, error, isLoading, mutate } = useSWR<CrmTask[]>('/crm-tasks/overdue', fetcher);
  return { tasks: data ?? [], error, isLoading, mutate };
}

export function useCrmTasks(
  filters?: { assignedTo?: string; status?: string; projectId?: string },
  skip?: boolean,
) {
  const key = skip ? null : buildKey('/crm-tasks', filters);
  const { data, error, isLoading, mutate } = useSWR<CrmTask[]>(key, fetcher);
  return { tasks: data ?? [], error, isLoading, mutate };
}

export function useActivities(filters?: { activityType?: string; customerId?: string; dealId?: string }) {
  const key = buildKey('/activities', filters);
  const { data, error, isLoading, mutate } = useSWR<CrmActivity[]>(key, fetcher);
  return { activities: data ?? [], error, isLoading, mutate };
}

/** Egy projekthez (szobához) kötött CRM-aktivitások (email/jegyzet/hívás) —
 *  a Hírfolyamba olvasztva. A MiniCRM-migrált előzmény ezen jelenik meg. */
export function useProjectActivities(projectId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<CrmActivity[]>(
    projectId ? `/activities/project/${projectId}` : null,
    fetcher,
  );
  return { activities: data ?? [], error, isLoading, mutate };
}

export function useDeals(filters?: { stage?: string; pipelineId?: string; customerId?: string }) {
  const key = buildKey('/deals', filters);
  const { data, error, isLoading, mutate } = useSWR<Deal[]>(key, fetcher);
  return { deals: data ?? [], error, isLoading, mutate };
}

export function usePipelines() {
  const { data, error, isLoading, mutate } = useSWR<Pipeline[]>('/pipelines', fetcher);
  return { pipelines: data ?? [], error, isLoading, mutate };
}

export function useQuotes(filters?: { state?: string; customerId?: string }) {
  const key = buildKey('/quotes', filters);
  const { data, error, isLoading, mutate } = useSWR<Quote[]>(key, fetcher);
  return { quotes: data ?? [], error, isLoading, mutate };
}

export function useInvoices(filters?: { state?: string; customerId?: string }) {
  const key = buildKey('/invoices', filters);
  const { data, error, isLoading, mutate } = useSWR<Invoice[]>(key, fetcher);
  return { invoices: data ?? [], error, isLoading, mutate };
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function completeCrmTask(id: string): Promise<CrmTask> {
  const res = await apiClient.post(`/crm-tasks/${id}/complete`);
  revalidateProjectScope(res.data?.projectId);
  revalidateMyScope();
  return res.data;
}

export async function startCrmTask(id: string): Promise<CrmTask> {
  const res = await apiClient.post(`/crm-tasks/${id}/start`);
  revalidateProjectScope(res.data?.projectId);
  revalidateMyScope();
  return res.data;
}

export async function createCrmTask(dto: CreateCrmTaskDto): Promise<CrmTask> {
  const res = await apiClient.post('/crm-tasks', dto);
  revalidateProjectScope(res.data?.projectId ?? dto.projectId);
  return res.data;
}

export async function createActivity(dto: CreateActivityDto): Promise<CrmActivity> {
  const res = await apiClient.post('/activities', dto);
  return res.data;
}

export async function transitionDeal(id: string, transition: string): Promise<Deal> {
  const res = await apiClient.post(`/deals/${id}/transition`, { transition });
  return res.data;
}

export async function createPipeline(dto: { name: string; stages?: Pipeline['stages'] }): Promise<Pipeline> {
  const res = await apiClient.post('/pipelines', dto);
  return res.data;
}

// ─── Quote mutations ──────────────────────────────────────────────────────────

export interface QuoteLineItem {
  id: string;
  description: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  unit?: string;
  position: number;
}

export interface CreateQuoteDto {
  title: string;
  customerId?: string;
  dealId?: string;
  projectId?: string;
  validUntil?: string;
  taxRate?: number;
  currency?: string;
  notes?: string;
  paymentTerms?: string;
}

export async function createQuote(dto: CreateQuoteDto): Promise<Quote> {
  const res = await apiClient.post('/quotes', dto);
  return res.data;
}

export async function sendQuote(id: string): Promise<Quote> {
  const res = await apiClient.post(`/quotes/${id}/send`);
  return res.data;
}

export async function acceptQuote(id: string): Promise<Quote> {
  const res = await apiClient.post(`/quotes/${id}/accept`);
  return res.data;
}

export async function rejectQuote(id: string): Promise<Quote> {
  const res = await apiClient.post(`/quotes/${id}/reject`);
  return res.data;
}

export async function createInvoiceFromQuote(quoteId: string, dto?: { dueDate?: string; notes?: string }): Promise<Invoice> {
  const res = await apiClient.post(`/invoices/from-quote/${quoteId}`, dto ?? {});
  return res.data;
}

export async function fetchQuoteLineItems(quoteId: string): Promise<QuoteLineItem[]> {
  const res = await apiClient.get(`/quotes/${quoteId}/line-items`);
  return res.data;
}

export async function addQuoteLineItem(quoteId: string, dto: { description: string; unitPrice: number; quantity: number; unit?: string }): Promise<QuoteLineItem> {
  const res = await apiClient.post(`/quotes/${quoteId}/line-items`, dto);
  return res.data;
}

export async function deleteQuoteLineItem(quoteId: string, itemId: string): Promise<void> {
  await apiClient.delete(`/quotes/${quoteId}/line-items/${itemId}`);
}

// ─── Invoice mutations ────────────────────────────────────────────────────────

export interface InvoiceLineItem {
  id: string;
  description: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  unit?: string;
  position: number;
}

export async function issueInvoice(id: string): Promise<Invoice> {
  const res = await apiClient.post(`/invoices/${id}/issue`);
  return res.data;
}

export async function sendInvoice(id: string): Promise<Invoice> {
  const res = await apiClient.post(`/invoices/${id}/send`);
  return res.data;
}

export async function recordPayment(id: string, dto: { amount: number; paymentMethod?: string; notes?: string }): Promise<Invoice> {
  const res = await apiClient.post(`/invoices/${id}/record-payment`, dto);
  return res.data;
}

export async function cancelInvoice(id: string): Promise<Invoice> {
  const res = await apiClient.post(`/invoices/${id}/cancel`);
  return res.data;
}

export async function fetchInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]> {
  const res = await apiClient.get(`/invoices/${invoiceId}/line-items`);
  return res.data;
}

// ─── Deal mutations ───────────────────────────────────────────────────────────

export interface CreateDealDto {
  title: string;
  pipelineId: string;
  stage?: string;
  value?: number;
  currency?: string;
  probability?: number;
  expectedCloseDate?: string;
  customerId?: string;
  projectId?: string;
  assignedTo?: string;
}

export async function createDeal(dto: CreateDealDto): Promise<Deal> {
  const res = await apiClient.post('/deals', dto);
  return res.data;
}

export async function updateDeal(id: string, dto: Partial<CreateDealDto>): Promise<Deal> {
  const res = await apiClient.patch(`/deals/${id}`, dto);
  return res.data;
}

export async function deleteDeal(id: string): Promise<void> {
  await apiClient.delete(`/deals/${id}`);
}

// ─── CRM Task mutations ───────────────────────────────────────────────────────

export async function updateCrmTask(id: string, dto: Partial<CreateCrmTaskDto>): Promise<CrmTask> {
  const res = await apiClient.patch(`/crm-tasks/${id}`, dto);
  revalidateProjectScope(res.data?.projectId);
  return res.data;
}

export async function deleteCrmTask(id: string): Promise<void> {
  await apiClient.delete(`/crm-tasks/${id}`);
  // A delete válasz nem ad vissza projectId-t — minden projekt-activity-t
  // revalidálunk. SWR csak a mountolt kulcsokat fetcheli újra, így ez OK.
  void swrMutate(
    (key) => typeof key === 'string' && key.startsWith('/projects/') && key.endsWith('/activity'),
  );
}

// ─── Activity mutations ───────────────────────────────────────────────────────

export async function updateActivity(id: string, dto: Partial<Omit<CreateActivityDto, 'activityType'>>): Promise<CrmActivity> {
  const res = await apiClient.patch(`/activities/${id}`, dto);
  return res.data;
}

export async function deleteActivity(id: string): Promise<void> {
  await apiClient.delete(`/activities/${id}`);
}

// ─── Quote / Invoice update mutations ────────────────────────────────────────

export async function updateQuote(id: string, dto: Partial<CreateQuoteDto>): Promise<Quote> {
  const res = await apiClient.patch(`/quotes/${id}`, dto);
  return res.data;
}

export async function updateInvoice(id: string, dto: { dueDate?: string; notes?: string; currency?: string }): Promise<Invoice> {
  const res = await apiClient.patch(`/invoices/${id}`, dto);
  return res.data;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  relatedEntity?: string;
  relatedEntityId?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export function useNotifications(params?: { limit?: number; unreadOnly?: boolean }) {
  const qs = params?.unreadOnly ? '?unreadOnly=true' : '';
  const { data, error, isLoading, mutate } = useSWR<{ data: Notification[]; total: number }>(
    `/notifications${qs}`,
    fetcher,
    { refreshInterval: 30_000 },
  );
  return { notifications: data?.data ?? [], total: data?.total ?? 0, error, isLoading, mutate };
}

export function useUnreadNotificationCount() {
  const { data, mutate } = useSWR<{ count: number }>(
    '/notifications/unread-count',
    fetcher,
    { refreshInterval: 30_000 },
  );
  return { count: data?.count ?? 0, mutate };
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post('/notifications/read-all');
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export interface Account {
  id: string;
  name: string;
  accountType?: string;
  industry?: string;
  website?: string;
  phone?: string;
  email?: string;
  taxNumber?: string;
  assignedTo?: string;
  tags?: string[];
  createdAt: string;
}

export interface CreateAccountDto {
  name: string;
  accountType?: string;
  industry?: string;
  website?: string;
  phone?: string;
  email?: string;
  taxNumber?: string;
  euTaxNumber?: string;
  assignedTo?: string;
  tags?: string[];
}

// A backend `GET /accounts` `{ data: Account[]; total: number }`-t ad vissza
// (AccountsService.findAll:88). Egy korábbi mega-refactor tévedett, és nyers
// tömbként kezelte — ami runtime `TypeError: g.find is not a function`-t okozott
// minden customer-page-en (a hidratáció bukott a fallback `data ?? []`-on, mert
// a NEM-nullish objektumot is array-nak tekintette).
//
// Defenzív: a backend bármelyik shape-jét elfogadjuk (Array vagy {data,total}).
export function useAccounts() {
  const { data, error, isLoading, mutate } = useSWR<Account[] | { data: Account[]; total: number }>(
    '/accounts?limit=1000',
    fetcher,
  );
  const accounts: Account[] = Array.isArray(data)
    ? data
    : (data?.data ?? []);
  const total: number = Array.isArray(data)
    ? data.length
    : (data?.total ?? accounts.length);
  return { accounts, total, error, isLoading, mutate };
}

export async function createAccount(dto: CreateAccountDto): Promise<Account> {
  const res = await apiClient.post('/accounts', dto);
  return res.data;
}

export async function updateAccount(id: string, dto: Partial<CreateAccountDto>): Promise<Account> {
  const res = await apiClient.patch(`/accounts/${id}`, dto);
  return res.data;
}

export async function deleteAccount(id: string): Promise<void> {
  await apiClient.delete(`/accounts/${id}`);
}

// ─── Customer list hook (SWR) ─────────────────────────────────────────────────

export interface CustomerListItem {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  isActive: boolean;
  lifecycleStage?: string;
  leadScore?: number;
  tags?: string[];
  accountId?: string;
}

interface UseCustomersOptions {
  includeInactive?: boolean;
  take?: number;
  skip?: number;
  search?: string;
  // F-feladat: szerver-oldali szegmens-szűrők. A lifecycleStage stringként megy,
  // a többi szám/UUID; mind opcionális.
  lifecycleStage?: string;
  scoreMin?: number;
  scoreMax?: number;
  tag?: string;
  accountId?: string;
  lastActivityWithinDays?: number;
  /** Stagnált-szegmens: NEM volt activity X napon belül. */
  staleDaysMin?: number;
  createdWithinDays?: number;
  wonDealsMin?: number;
}

interface CustomerListResponse {
  items: CustomerListItem[];
  total: number;
  take: number;
  skip: number;
}

/**
 * Server-side paginated customer-lista.
 * - Backwards-compatible: a régi `useCustomers(showInactive: boolean)` hívás
 *   továbbra is működik — ilyenkor a fallback take=500 (a régi alapértelmezés)
 *   adja vissza az ügyfeleket, így a project-customer-card / meeting-view nem
 *   töredezik.
 * - Új mód: `useCustomers({ includeInactive, take, skip, search })` — a list-page
 *   használja a lapozó + debounce-olt kereső köteggel.
 * - A backend response objektum-paginated; az `items`/`total` mező közvetlenül
 *   elérhető. A `customers` alias a régi callerek miatt marad.
 */
export function useCustomers(
  optsOrBool: UseCustomersOptions | boolean = false,
) {
  const opts: UseCustomersOptions = typeof optsOrBool === 'boolean'
    ? { includeInactive: optsOrBool, take: 500 }
    : { take: 500, ...optsOrBool };

  const params = new URLSearchParams();
  params.set('includeInactive', String(opts.includeInactive ?? false));
  if (opts.take != null) params.set('take', String(opts.take));
  if (opts.skip != null) params.set('skip', String(opts.skip));
  if (opts.search && opts.search.trim()) params.set('search', opts.search.trim());
  // F-feladat: szerver-oldali szegmens-szűrők. Csak akkor küldjük, ha értelmes
  // értékük van — különben a URLSearchParams üres `?lifecycleStage=&...` zajt
  // generálna, és a SWR-kulcs felesleges variánsokba töredezne.
  if (opts.lifecycleStage) params.set('lifecycleStage', opts.lifecycleStage);
  if (opts.scoreMin != null) params.set('scoreMin', String(opts.scoreMin));
  if (opts.scoreMax != null) params.set('scoreMax', String(opts.scoreMax));
  if (opts.tag) params.set('tag', opts.tag);
  if (opts.accountId) params.set('accountId', opts.accountId);
  if (opts.lastActivityWithinDays) params.set('lastActivityWithinDays', String(opts.lastActivityWithinDays));
  if (opts.staleDaysMin) params.set('staleDaysMin', String(opts.staleDaysMin));
  if (opts.createdWithinDays) params.set('createdWithinDays', String(opts.createdWithinDays));
  if (opts.wonDealsMin) params.set('wonDealsMin', String(opts.wonDealsMin));

  const key = `/customers?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<
    CustomerListResponse | CustomerListItem[]
  >(
    key,
    fetcher,
    {
      // POST/PATCH után az `mutate()` azonnal kapjon új DB-snapshotot —
      // dedupingInterval+revalidateOnFocus konfig nélkül a stale-cache
      // miatt új customer NEM jelenik meg a Ctrl+F5-ön sem.
      dedupingInterval: 0,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );

  // Defensive: ha a backend-en a régi tömb-shape jönne vissza (pl. egy
  // proxy/CDN köztes verzió), akkor is helyesen működjünk.
  const items: CustomerListItem[] = Array.isArray(data)
    ? data
    : (data?.items ?? []);
  const total: number = Array.isArray(data)
    ? data.length
    : (data?.total ?? 0);

  return {
    customers: items,
    items,
    total,
    error,
    isLoading,
    mutate,
  };
}


export interface CustomerDetail {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  taxNumber?: string;
  notes?: string;
  isActive: boolean;
  lifecycleStage: string;
  leadScore: number;
  source?: string;
  assignedTo?: string;
  tags: string[];
  website?: string;
  linkedinUrl?: string;
  contactType: string;
  lastContactedAt?: string;
  createdAt: string;
  // H-feladat: B2B parent-Account FK. Ha jelen van, a customer egy szervezethez
  // (Account) tartozik — a detail-oldal Meta-szekciójában ezzel link-elünk.
  accountId?: string;
}

// H-feladat: a `useAccounts` hook a fájl korábbi szekciójában már létezik —
// a B2B-Account-link dropdown azt használja (Account[] shape, name+accountType).

// D-feladat: Customer-360 bővítés — projects/contracts/invoices/work-orders
// top-10 a summary-ből, plusz count-statisztikák a meglévő stats-szel egy
// shape-ben (a Number?.(stat.projectCount ?? 0) hívásokat a frontend kódja
// védelmezőn olvassa, mert régebbi cache-elt válasz nem tartalmazza).
export interface CustomerSummaryProject {
  id: string;
  name: string;
  state: string;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
}

export interface CustomerSummaryContract {
  id: string;
  contractNumber: string;
  title: string;
  state: string;
  value?: number | null;
  currency?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
}

export interface CustomerSummaryInvoice {
  id: string;
  invoiceNumber: string;
  state: string;
  totalAmount?: number | null;
  paidAmount?: number | null;
  currency?: string | null;
  dueDate?: string | null;
  issueDate?: string | null;
  createdAt: string;
}

export interface CustomerSummaryWorkOrder {
  id: string;
  workOrderNumber: string;
  state: string;
  location?: string | null;
  deadline?: string | null;
  responsiblePerson?: string | null;
  createdAt: string;
}

export interface CustomerSummary {
  customer: CustomerDetail;
  stats: {
    totalDeals: number;
    wonDeals: number;
    openDeals: number;
    totalPaid: number;
    totalOutstanding: number;
    invoiceCount: number;
    projectCount?: number;
    contractCount?: number;
    workOrderCount?: number;
  };
  recentDeals: Deal[];
  recentQuotes: Quote[];
  recentActivities: CrmActivity[];
  recentProjects?: CustomerSummaryProject[];
  recentContracts?: CustomerSummaryContract[];
  recentInvoices?: CustomerSummaryInvoice[];
  recentWorkOrders?: CustomerSummaryWorkOrder[];
}

export function useCustomerSummary(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<CustomerSummary>(
    id ? `/customers/${id}/summary` : null,
    fetcher,
  );
  return { summary: data ?? null, error, isLoading, mutate };
}

// ─── Customer duplicates / merge ──────────────────────────────────────────────
//
// E-feladat: a 6451 customer-en időről időre futtatott duplicate-check; egy
// csoport email/name/company-egyezés mentén áll össze. A merge primary-t + max
// 10 mergeIds-t fogad.

export interface CustomerDuplicateMember {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  lifecycleStage?: string;
  leadScore?: number;
  isActive: boolean;
  createdAt: string;
}

export interface CustomerDuplicateGroup {
  key: string;
  keyType: 'email' | 'name' | 'company';
  customers: CustomerDuplicateMember[];
}

export function useCustomerDuplicates() {
  const { data, error, isLoading, mutate } = useSWR<CustomerDuplicateGroup[]>(
    '/customers/duplicates',
    fetcher,
    {
      // 6000+ customer-es scan-t ne dedup-eljük — minden mutate() friss listát hozzon.
      dedupingInterval: 0,
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  );
  return { groups: data ?? [], error, isLoading, mutate };
}

export interface MergeCustomersResult {
  primaryId: string;
  mergedCount: number;
  reassigned: Record<string, number>;
}

export async function mergeCustomers(
  primaryId: string,
  mergeIds: string[],
): Promise<MergeCustomersResult> {
  const res = await apiClient.post('/customers/merge', { primaryId, mergeIds });
  // Egy merge után a customer-lista és a duplicates-lista is elavult.
  void swrMutate(
    (key) => typeof key === 'string' && key.startsWith('/customers'),
    undefined,
    { revalidate: true },
  );
  return res.data;
}

// F-feladat: bulk-update — egy patch alkalmazása N customer-re. A patch shape
// 1-az-1 a backend BulkPatchDto-val (lifecycleStage / leadScore / tag / isActive).
export interface CustomerBulkPatch {
  lifecycleStage?: string;
  leadScore?: { mode: 'set' | 'add'; value: number };
  tag?: { mode: 'add' | 'remove'; value: string };
  isActive?: boolean;
}

export interface BulkUpdateResult {
  affected: number;
}

export async function bulkUpdateCustomers(
  ids: string[],
  patch: CustomerBulkPatch,
): Promise<BulkUpdateResult> {
  const res = await apiClient.post('/customers/bulk-update', { ids, patch });
  // Minden customers-kulcs (lista + duplicates + summary) elavult.
  void swrMutate(
    (key) => typeof key === 'string' && key.startsWith('/customers'),
    undefined,
    { revalidate: true },
  );
  return res.data;
}

/** Egy customer minimális adatai — a ProjectModal-on a megrendelő-blokkhoz. */
export function useCustomer(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<CustomerDetail>(
    id ? `/customers/${id}` : null,
    fetcher,
  );
  return { customer: data ?? null, error, isLoading, mutate };
}

// ─── CRM Analytics ────────────────────────────────────────────────────────────

export interface CrmDashboard {
  pipelineValue: number;
  weightedPipelineValue: number;
  openDealsCount: number;
  wonDealsCount: number;
  lostDealsCount: number;
  winRate: number;
  avgDealSize: number;
  monthlyRevenue: number;
  openQuotesCount: number;
  openQuotesValue: number;
  acceptedQuotesCount: number;
  overdueTasksCount: number;
  openInvoicesValue: number;
  paidInvoicesValue: number;
  pipelineFunnel: Array<{ stage: string; count: number; value: number }>;
  pendingQuotesCount: number;
  overdueInvoicesCount: number;
  overdueInvoicesValue: number;
  expiringContractsCount: number;
  overdueWorkOrdersCount: number;
  stagnantDealsCount: number;
}

export function useCrmDashboard(currency = 'HUF') {
  const { data, error, isLoading, mutate } = useSWR<CrmDashboard>(
    `/analytics/crm-dashboard?currency=${currency}`,
    fetcher,
    {
      refreshInterval: 60_000,
      keepPreviousData: true,
      revalidateOnFocus: false,
      errorRetryCount: 2,
      errorRetryInterval: 5_000,
    },
  );
  // Surface `stale: true` when the last fetch failed but we still have data
  const stale = !!error && !!data;
  return { dashboard: data ?? null, error, isLoading, mutate, stale };
}
