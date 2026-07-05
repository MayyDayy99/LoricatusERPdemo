import useSWR, { mutate as globalMutate } from 'swr';
import { useEffect, useRef } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { apiClient } from '../api-client';
import { useAuthStore } from '../auth-store';
import { IS_DEMO } from '../demo/config';

/**
 * Az SSE-stream-en érkező események típusai. A backend
 * (dashboard-events.service.ts) emittálja, a frontend a callback-ben
 * fogadja és cache-invalidation döntéseket hoz alapján.
 */
export type DashboardStreamEventType =
  | 'plan_task.created' | 'plan_task.updated' | 'plan_task.deleted'
  | 'day_annotation.created' | 'day_annotation.updated' | 'day_annotation.deleted'
  | 'project.created' | 'project.updated' | 'project.deleted'
  | 'comment.created' | 'comment.updated' | 'comment.deleted'
  | 'crm-task.created' | 'crm-task.updated' | 'crm-task.deleted'
  | 'commission.changed';

const fetcher = (url: string) => apiClient.get(url).then(r => r.data);

/** A meeting Map task-státuszai. A 'draft' (PISZKOZAT — árazógép-importból
 *  származó, még nem véglegesített) a /quotes/import-to-project endpoint
 *  hozza létre; külön szaggatott render a Gantt-on, nem csúszik. */
export type DashboardTaskStatus = 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface DashboardTask {
  id: string;
  projectId?: string;
  title: string;
  taskType: string;
  status: DashboardTaskStatus;
  assignedTo?: string;
  /** További érintettek — a busyMap és warning-számítás ezeket is foglaltnak veszi. */
  helpers?: string[];
  startDate?: string;
  duration?: number;
  endDate?: string;
  dueDate?: string;
  dependsOnId?: string;
  equipmentIds: string[];
  /** Gantt párhuzamos sáv-index (0 = alapsáv). A user vertikális drag-eléssel
   *  emeli/csökkenti — alapból 0, ekkor 2 időben átfedő task egymáson lóg
   *  (push-physics ezt drag során szétpasszolja). */
  laneIndex?: number;
}

export interface TaskDurationRevision {
  id: string;
  taskId: string;
  oldDurationDays: number | null;
  newDurationDays: number;
  deltaDays: number;
  reason?: string;
  changedBy: string;
  changedAt: string;
}

export interface DashboardProject {
  id: string;
  name: string;
  state: string;
  color?: string;
  metadata?: Record<string, unknown>;
  /** A projekt szoba-besorolása (project_category.id) — a /rooms-on a
   *  Gantt-tab ez alapján szűri a projektek halmazát egy szobán belülre. */
  categoryId?: string;
  /** A project_category.categoryType (`'Generic' | 'OfficeAdmin' | ...`).
   *  A `/meeting` scope a NEM-`'OfficeAdmin'` projekteket mutatja,
   *  a `/office-admin` scope csak a `'OfficeAdmin'` kategóriájúakat. */
  categoryType?: string;
  /** Megjelenjen-e a Projekt map (/meeting Gantt) nézetben. A "Drón ügyintézés"
   *  szoba false — azok csak a /rooms szobában látszanak. Default true. */
  showInProjectMap?: boolean;
  /** A megrendelő-customer FK — a ProjectModal Áttekintés tab-on a customer-
   *  adatokat ezen az ID-n keresztül fetcheli. */
  customerId?: string;
}

export interface DashboardPerson {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  roleType: 'operativ' | 'irodai' | 'mixed';
  displayColor?: string;
}

export interface DashboardEquipment {
  id: string;
  name: string;
  category: string;
  status: string;
  holderId?: string;
  note?: string;
}

export type DayAnnotationType = 'munkaszunet' | 'szabadsag' | 'szerviz' | 'hatarido' | 'legter';

export interface DashboardDayAnnotation {
  id: string;
  date: string;
  endDate?: string;
  type: DayAnnotationType;
  label: string;
  personId?: string;
  equipmentId?: string;
  projectId?: string;
}

/**
 * Időzített, még el-nem-küldött ping (notification / reminder) — a Gantt-on a
 * recipient sorában, a `scheduledFor` napon megjelenik egy kis sárga ikon
 * (Kit / Mikor / Üzenet). Forrása: projektsablon `notification` és `reminder`
 * lépések instantiationkor készülnek el.
 */
export interface DashboardScheduledPing {
  id: string;
  userId: string;
  scheduledFor: string;
  type: string;
  title: string;
  body?: string;
  projectId?: string;
}

export interface DashboardOverview {
  generatedAt: string;
  windowFrom: string;
  windowTo: string;
  projects: DashboardProject[];
  tasks: DashboardTask[];
  people: DashboardPerson[];
  equipment: DashboardEquipment[];
  dayAnnotations: DashboardDayAnnotation[];
  softwarePc: Array<{ softwareId: string; pcId: string }>;
  scheduledPings?: DashboardScheduledPing[];
}

export interface UseDashboardOverviewOptions {
  /** Ha true: kikapcsolja a focus/poll/SSE-revalidate-et — a drag-drop alatti
   *  „bar összeugrik mid-drop" race elkerülésére. A hívó (meeting _view.tsx)
   *  drag-aktív flag-gel hívja, így amíg a user az egérgombot lenyomva tartja
   *  egy task fölött, NEM jön be SSE-újra-fetch, ami visszaírná a stale értéket. */
  pauseRevalidation?: boolean;
}

export function useDashboardOverview(from?: string, to?: string, options: UseDashboardOverviewOptions = {}) {
  const { pauseRevalidation = false } = options;
  // Explicit from/to: ha a hívó nem ad, default 30 nap vissza + 730 nap előre.
  // Cél: a Gantt fejléc + jelölések (határidő, légtér) ne tűnjenek el a 3.
  // hónap után. A backend default ugyanezt teszi, csak biztos legyünk.
  const defaultFrom = new Date(Date.now() - 30 * 86400 * 1000).toISOString().slice(0, 10);
  const defaultTo = new Date(Date.now() + 730 * 86400 * 1000).toISOString().slice(0, 10);
  const qs = new URLSearchParams();
  qs.set('from', from ?? defaultFrom);
  qs.set('to', to ?? defaultTo);
  const url = `/dashboard/overview?${qs.toString()}`;
  // A pauseRevalidation-t ref-be is mentjük, hogy az SSE-callback (zárt
  // closure) is el tudja olvasni a friss értéket, ne csak a render-kori
  // snapshot-ot. Drag közben az SSE event nem hív mutate()-et.
  const pauseRef = useRef(pauseRevalidation);
  pauseRef.current = pauseRevalidation;

  const { data, error, isLoading, mutate } = useSWR<DashboardOverview>(url, fetcher, {
    // SSE pushes trigger sub-second refresh; 60s polling is a cheap safety net
    // if the stream drops (network hiccup, proxy timeout). Drag közben (pauseRevalidation)
    // mindhárom kikapcsolva, hogy a bar ne ugorjon vissza stale DB-értékre mid-drop.
    refreshInterval: pauseRevalidation ? 0 : 60_000,
    keepPreviousData: true,
    revalidateOnFocus: !pauseRevalidation,
    revalidateIfStale: !pauseRevalidation,
  });

  // Live SSE: bármilyen non-ping event → mutate() újrahúzza az overview-t.
  // Plus cross-cache invalidation: a /rooms List/Kanban a useProjects()-et
  // használja, a Gantt-tab pedig az overview-t — ha a Gantt-on task vagy
  // project változik, a List/Kanban tabok /projects cache-ét is invalidálni
  // kell, hogy a 3 nézet szinkron maradjon.
  useDashboardStream((type) => {
    // Drag közben skip — különben a saját optimistic update-ünket overrideolná
    // a stale DB-állapotot mutató SSE-trigger refetch.
    if (pauseRef.current) return;
    mutate();
    if (type.startsWith('plan_task.') || type.startsWith('project.') || type.startsWith('crm-task.')) {
      void globalMutate(key => typeof key === 'string' && key.startsWith('/projects'));
    }
    if (type.startsWith('plan_task.') || type.startsWith('crm-task.')) {
      void globalMutate(key => typeof key === 'string' && key.startsWith('/crm-tasks'));
    }
    if (type.startsWith('comment.')) {
      // /comments?targetType=...&targetId=... cache-ek + project-activity feed
      void globalMutate(key => typeof key === 'string' && key.startsWith('/comments'));
      void globalMutate(key => typeof key === 'string' && key.startsWith('/projects'));
    }
  });

  return { overview: data ?? null, error, isLoading, mutate };
}

/**
 * Subscribes to GET /dashboard/stream via fetch-event-source
 * (needed because the browser's native EventSource can't set auth headers).
 * Reconnects automatically on drop. `onEvent` fires for every non-ping event.
 */
export function useDashboardStream(onEvent: (type: DashboardStreamEventType) => void) {
  const { accessToken, tenantId } = useAuthStore();
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!accessToken) return;
    // Demó módban nincs valós SSE-backend — a stream-et kihagyjuk (a dashboard
    // adatai a normál SWR-lekérésekből jönnek).
    if (IS_DEMO) return;
    const controller = new AbortController();
    const baseUrl = '/api/v1/dashboard/stream';
    const tid = tenantId || process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '';

    fetchEventSource(baseUrl, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(tid ? { 'x-tenant-id': tid } : {}),
      },
      // fetch-event-source re-connects automatically on drop.
      openWhenHidden: true,
      onopen: async (res) => {
        if (res.status >= 400) {
          // Don't throw — just give up silently, SWR polling still covers us.
          controller.abort();
        }
      },
      onmessage: (ev) => {
        if (!ev.data) return;
        try {
          const parsed = JSON.parse(ev.data);
          if (parsed.type && parsed.type !== 'ping') {
            onEventRef.current(parsed.type as DashboardStreamEventType);
          }
        } catch {
          /* ignore malformed */
        }
      },
      onerror: () => {
        // Let fetch-event-source handle reconnect; returning nothing = retry.
      },
    }).catch(() => { /* final give-up, SWR still polls */ });

    return () => controller.abort();
  }, [accessToken, tenantId]);
}

export interface CreatePlanTaskInput {
  projectId: string;
  title: string;
  taskType: string;
  assignedTo?: string | null;
  helpers?: string[];
  startDate: string;
  duration: number;
  dependsOnId?: string | null;
  equipmentIds?: string[];
  description?: string;
  priority?: string;
  laneIndex?: number;
}

export async function createPlanTask(input: CreatePlanTaskInput) {
  const res = await apiClient.post('/dashboard/tasks', input);
  return res.data;
}

export async function updatePlanTask(
  id: string,
  patch: Partial<CreatePlanTaskInput> & { status?: DashboardTaskStatus; durationChangeReason?: string },
) {
  const res = await apiClient.patch(`/dashboard/tasks/${id}`, patch);
  return res.data;
}

export async function fetchTaskDurationRevisions(taskId: string): Promise<TaskDurationRevision[]> {
  const res = await apiClient.get(`/dashboard/tasks/${taskId}/duration-revisions`);
  return res.data;
}

export async function deletePlanTask(id: string) {
  const res = await apiClient.delete(`/dashboard/tasks/${id}`);
  return res.data;
}

export interface CreateDayAnnotationInput {
  date: string;
  endDate?: string;
  type: DayAnnotationType;
  label: string;
  personId?: string;
  equipmentId?: string;
  projectId?: string;
}

export async function createDayAnnotation(input: CreateDayAnnotationInput) {
  const res = await apiClient.post('/day-annotations', input);
  return res.data;
}

// ── Bulk-create ──────────────────────────────────────────────────────────────
// Egy POST-tal több day-annotation. Throttle-friendly: 1 request = 1 limit-fogyás.
// A backend per-item try/catch-eli: partial-error response esetén a `created`
// elemek létrejöttek, az `errors` tömb pedig az item-indexenkénti hibákat
// tartalmazza (pl. UNIQUE-ütközés ugyanarra a (date, personId, type) párra).
export interface BulkDayAnnotationError {
  index: number;
  item: CreateDayAnnotationInput;
  message: string;
}

export interface BulkDayAnnotationResponse {
  created: DashboardDayAnnotation[];
  errors: BulkDayAnnotationError[];
}

export async function createDayAnnotationsBulk(
  items: CreateDayAnnotationInput[],
): Promise<BulkDayAnnotationResponse> {
  const res = await apiClient.post('/day-annotations/bulk', { items });
  return res.data;
}

export async function updateDayAnnotation(id: string, patch: Partial<CreateDayAnnotationInput>) {
  const res = await apiClient.patch(`/day-annotations/${id}`, patch);
  return res.data;
}

export async function deleteDayAnnotation(id: string) {
  const res = await apiClient.delete(`/day-annotations/${id}`);
  return res.data;
}

// ── Task chain templates ─────────────────────────────────────────────────────

export interface TaskChainTemplate {
  id: string;
  fromKey: string;
  nextTitle: string;
  nextTaskType: string;
  nextDuration: number;
  offsetDays: number;
  keepAssignee: boolean;
  notes?: string;
  sortIndex: number;
}

export interface ChainTemplateInput {
  id?: string;
  fromKey: string;
  nextTitle: string;
  nextTaskType: string;
  nextDuration: number;
  offsetDays: number;
  keepAssignee?: boolean;
  notes?: string;
  sortIndex?: number;
}

export function useTaskChainTemplates() {
  const fetcher = (url: string) => apiClient.get(url).then(r => r.data);
  const swr = useSWR<TaskChainTemplate[]>('/dashboard/task-chain', fetcher);
  return {
    templates: swr.data ?? [],
    loading: !swr.data && !swr.error,
    error: swr.error,
    mutate: swr.mutate,
  };
}

export async function upsertTaskChainTemplate(input: ChainTemplateInput): Promise<TaskChainTemplate> {
  const res = await apiClient.post('/dashboard/task-chain', input);
  return res.data;
}

export async function deleteTaskChainTemplate(id: string): Promise<void> {
  await apiClient.delete(`/dashboard/task-chain/${id}`);
}

export async function generateNextFromTemplate(taskId: string): Promise<{
  created: { id: string; title: string } | null;
  reason?: string;
}> {
  const res = await apiClient.post(`/dashboard/tasks/${taskId}/next-from-template`);
  return res.data;
}
