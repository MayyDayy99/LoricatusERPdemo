'use client';

import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { Plus, Maximize2, Minimize2, ZoomIn, ZoomOut, Map as MapIcon, PanelRight, Sun, CloudSun, CloudFog, CloudRain, CloudSnow, CloudRainWind, CloudLightning, Cloud, Wind, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useCurrentUser } from '@/lib/hooks/use-users';
import { useProjectTemplates } from '@/lib/hooks/use-project-templates';
import { useTaskTypes, getTaskTypeColor, getTaskTypeLabel, isUnassignedTaskType, type TaskType } from '@/lib/hooks/use-task-types';
import {
  useWeatherForecast,
  useWeatherThresholds,
  useWeatherCity,
  WEATHER_CITIES,
  evaluateDroneRisk,
  type WeatherForecast,
  type WeatherDayData,
  type WeatherThresholds,
  type DroneRiskLevel,
} from '@/lib/hooks/use-weather';
import {
  useDashboardOverview,
  createPlanTask,
  updatePlanTask,
  deletePlanTask,
  createDayAnnotation,
  createDayAnnotationsBulk,
  updateDayAnnotation,
  deleteDayAnnotation,
  generateNextFromTemplate,
  upsertTaskChainTemplate,
  fetchTaskDurationRevisions,
  type DashboardOverview,
  type DashboardTask,
  type DashboardProject,
  type DashboardPerson,
  type DashboardEquipment,
  type DashboardDayAnnotation,
  type DayAnnotationType,
  type DashboardTaskStatus,
  type TaskDurationRevision,
} from '@/lib/hooks/use-dashboard';
import {
  createPing as apiCreatePing,
  createAndSendNow as apiCreateAndSendNow,
  sendNowPing as apiSendNowPing,
  cancelPing as apiCancelPing,
} from '@/lib/hooks/use-scheduled-notifications';
import { useCustomer, useCustomers } from '@/lib/hooks/use-crm';
import { useProjectWorkflowState } from '@/lib/hooks/use-project-workflow';
import { WorkflowStatusPanel } from '@/components/projects/workflow-status-panel';
import {
  useProjectQuickDocs, uploadProjectQuickDoc, getProjectQuickDocDownloadUrl,
  deleteProjectQuickDoc, hasQuickDoc, filterQuickDocs,
  type ProjectQuickDocKind, type ProjectQuickDoc,
} from '@/lib/hooks/use-project-quick-docs';
import styles from './tv-dashboard.module.css';
import { useT } from '@/lib/hooks/use-t';

/* ── CONFIG ───────────────────────────────────────────────────── */
const DAYS_AHEAD_DEFAULT = 730;      // 2 years forward by default
const DAYS_AHEAD_INCREMENT = 180;    // "Load more →" step (6 months)
const DAY_W_DEFAULT = 36;
const DAY_W_MIN = 12;
const DAY_W_MAX = 96;
const LANE_H = 42;
const MS_PER_DAY = 86400000;
const MAX_LANE_INDEX = 20;
const MONTHS_HU = ['Jan', 'Febr', 'Márc', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szept', 'Okt', 'Nov', 'Dec'];
const DOW_HU = ['Vas', 'H', 'K', 'Sz', 'Cs', 'P', 'Szo'];

// A task-típusok listája admin-konfigolható tenant-szinten — `useTaskTypes()` hook
// (`/tenants/me/task-types` endpoint) szolgáltatja. Defaults a backend-ben.
// `useTaskTypes()` használata: a MeetingPage lekéri, prop-ként továbbadja a TaskBar/Modal-okba.

/* ── HELPERS ──────────────────────────────────────────────────── */
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function offsetDate(days: number, from: Date): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}
function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseDate(s: string): Date {
  // Időkomponens-megőrző parser. A drop-rángatás végleges fix-e: ha a backend
  // T12:00:00.000Z-zel mentett fél-napos commit-ot, a re-render is fél-napon
  // legyen (különben a CSS transition átanimálja a 0.5 cellányi eltérést).
  // A toStartDatePayload konvenciójával egyezően az UTC időt lokál-időként
  // interpretáljuk — round-trip exact.
  const datePart = s.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (s.length < 11 || s[10] !== 'T') return new Date(y, m - 1, d);
  const tm = s.slice(11).match(/^(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?/);
  if (!tm) return new Date(y, m - 1, d);
  const h = Number(tm[1]);
  const min = Number(tm[2]);
  const sec = tm[3] ? Number(tm[3]) : 0;
  const ms = tm[4] ? Number(tm[4].padEnd(3, '0')) : 0;
  return new Date(y, m - 1, d, h, min, sec, ms);
}
function diffDays(a: Date, b: Date): number {
  // Fractional érték — a fél-napos és órás precíziók megőrzéséhez. A drop
  // után a bar pontosan ott marad ahol elengedted, nincs Math.round-os
  // 0.5 cellányi visszacsúszás.
  return (a.getTime() - b.getTime()) / 86400000;
}

// WMO weather_code → lucide ikon. Részletek: https://open-meteo.com/en/docs
function weatherCodeToIcon(code: number | undefined) {
  if (code === undefined || code === null) return null;
  if (code === 0) return Sun;
  if (code <= 3) return CloudSun;
  if (code <= 48) return CloudFog;
  if (code <= 67) return CloudRain;
  if (code <= 77) return CloudSnow;
  if (code <= 86) return CloudRainWind;
  if (code >= 95) return CloudLightning;
  return Cloud;
}

/* ── MUNKANAP-ARITMETIKA ────────────────────────────────────
   A duration mező (nem-gepido task-okra) MUNKANAPOKBAN van. A hétvégi
   napokat nem számolja. A backend ugyanezt csinálja a working-days.util.ts-
   ben — a két oldal időzóna-eltérése a napi rácson elhanyagolható.
*/
function isWeekendDate(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

function addWorkingDays(start: Date, workingDays: number): Date {
  const d = new Date(start);
  while (isWeekendDate(d)) d.setDate(d.getDate() + 1);
  let remaining = workingDays;
  while (remaining > 0) {
    if (isWeekendDate(d)) {
      d.setDate(d.getDate() + 1);
      continue;
    }
    if (remaining >= 1) {
      d.setDate(d.getDate() + 1);
      remaining -= 1;
    } else {
      d.setTime(d.getTime() + remaining * 86400000);
      remaining = 0;
    }
  }
  return d;
}

/** Hány NAPTÁRI nap kell vizuálisan, hogy `workingDays` munkanap beleférjen.
 *  Pl. péntek + 2 munkanap = 4 naptári nap (P/Sz/V/H).
 *  Hétvégén induló task: a kezdő hétvége is a vizuális szélességbe tartozik. */
function visualWidthDays(start: Date, workingDays: number): number {
  if (workingDays <= 0) return workingDays;
  const cur = new Date(start);
  let remaining = workingDays;
  let visual = 0;
  while (remaining > 0) {
    if (isWeekendDate(cur)) {
      visual += 1;
      cur.setDate(cur.getDate() + 1);
    } else {
      const consume = Math.min(1, remaining);
      visual += consume;
      remaining -= consume;
      cur.setTime(cur.getTime() + consume * 86400000);
    }
  }
  return visual;
}

/** Inverze: adott `start` ponttól `calCells` naptári napot lefedve hány
 *  munkanap fér bele (frakció megengedett). Resize commit-ban használjuk:
 *  a mouse-1:1 húzás végén a látható szélességet visszaképezzük munkanapra. */
function inverseVisualWidthDays(start: Date, calCells: number): number {
  if (calCells <= 0) return 0;
  const cur = new Date(start);
  let remaining = calCells;
  let working = 0;
  while (remaining > 0) {
    const advance = Math.min(1, remaining);
    if (!isWeekendDate(cur)) {
      working += advance;
    }
    cur.setTime(cur.getTime() + advance * 86400000);
    remaining -= advance;
  }
  return working;
}

/** Tört órás precisiont megőrző Date → ISO konverter. A backendre
 *  `T12:00:00.000Z`-ig kerül, hogy a fél napos snap ne vesszen el. */
function toIsoUtc(d: Date): string {
  return d.toISOString();
}

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#ec4899', '#06b6d4', '#f97316', '#a78bfa'];
function projectColor(p: DashboardProject, idx: number): string {
  return p.color ?? PALETTE[idx % PALETTE.length];
}

function avatarColor(p?: DashboardPerson): string {
  if (!p) return '#6b7280';
  return p.displayColor ?? PALETTE[p.id.charCodeAt(0) % PALETTE.length];
}
function isWorkstation(p: DashboardPerson): boolean {
  return p.role === 'Munkaállomás';
}
function personInitial(p: DashboardPerson): string {
  if (isWorkstation(p)) return '💻';
  return (p.firstName[0] ?? '?').toUpperCase();
}
function personName(p: DashboardPerson): string {
  if (isWorkstation(p)) return p.firstName;
  return `${p.firstName} ${p.lastName}`.trim();
}

type TaskVisualStatus = 'normal' | 'slipping' | 'done' | 'danger' | 'draft';
function computeVisualStatus(t: DashboardTask, today: Date, slippingIds: Set<string>): TaskVisualStatus {
  // Draft (PISZKOZAT — árazógép-importból) NEM csúszik, NEM számít a commission
  // planned_days-be, NEM dob piros sávot. Külön rendering (szaggatott keret + halvány).
  if (t.status === 'draft') return 'draft';
  if (t.status === 'completed') return 'done';
  const end = t.endDate ? parseDate(t.endDate) : t.startDate ? parseDate(t.startDate) : null;
  if (end && end < today) return 'slipping';
  if (t.dependsOnId && slippingIds.has(t.dependsOnId)) return 'danger';
  return 'normal';
}

function getTaskWarnings(
  task: DashboardTask,
  people: DashboardPerson[],
  equipment: DashboardEquipment[],
  tasks: DashboardTask[],
  annotations: DashboardDayAnnotation[],
  projects: DashboardProject[] = [],
): string[] {
  const warnings: string[] = [];
  if (!task.startDate) return warnings;
  const start = parseDate(task.startDate);
  const end = task.endDate ? parseDate(task.endDate) : new Date(start.getTime() + (task.duration ?? 1) * 86400000);

  // Archív projektek task-jai már nem aktívak — ne okozzanak ütközést.
  const inactiveProjectIds = new Set(
    projects.filter(p => p.state === 'archived' || p.state === 'cancelled').map(p => p.id),
  );

  // Ember-figyelmeztetések (overlap + szabadság + role-mismatch) szándékosan
  // KIVÉVE — a user explicit kérése: ne legyen ember-warning a warning-boxban
  // vagy a TaskBar-on. A foglaltság egyetlen jelzése a felelős-dropdown
  // mellett megjelenő diszkrét sárga háromszög (busyMap alapján). A `people`
  // és `annotations` paramétereket meghagyjuk a függvény szignatúrájában a
  // hívók kompatibilitásáért, de itt nem használjuk őket — ha később vissza
  // kell hozni, a régi blokk a git history-ban (ae9502c előtti).
  void people; void annotations;

  // Equipment conflicts
  for (const eqId of task.equipmentIds) {
    const eq = equipment.find(e => e.id === eqId);
    if (!eq) continue;
    if (eq.status === 'maintenance') {
      warnings.push(`${eq.name} szervizben van`);
      continue;
    }
    for (const other of tasks) {
      if (other.id === task.id || other.status === 'completed' || other.status === 'cancelled') continue;
      if (other.projectId && inactiveProjectIds.has(other.projectId)) continue;
      if (!other.equipmentIds.includes(eqId) || !other.startDate) continue;
      const os = parseDate(other.startDate);
      const oe = other.endDate ? parseDate(other.endDate) : new Date(os.getTime() + (other.duration ?? 1) * 86400000);
      if (start < oe && end > os) {
        warnings.push(`${eq.name} ugyanekkor: "${other.title}"`);
      }
    }
  }

  // Dependency check
  if (task.dependsOnId) {
    const dep = tasks.find(t => t.id === task.dependsOnId);
    if (dep && dep.endDate) {
      const depEnd = parseDate(dep.endDate);
      if (start < depEnd) warnings.push(`Előtte lévő task még tart: "${dep.title}"`);
    }
  }

  return warnings;
}

/* ── CLOCK ─────────────────────────────────────────────────── */
function useLiveClock(): { time: string; date: string } {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return {
    time: now.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    date: now.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
  };
}

/* ── DAYS ─────────────────────────────────────────────────── */
interface DayInfo {
  date: Date; iso: string; dow: number;
  isWeekend: boolean; isToday: boolean; isPast: boolean;
  annotations: DashboardDayAnnotation[];
  primary?: DashboardDayAnnotation;     // first annotation, used for the coloured dot
  hasHatarido: boolean;                  // deadline marker — red right edge
  hasMunkaszunet: boolean;               // diagonal hatch background
  hasLegterStart: boolean;               // airspace permit window starts here — blue left edge
  hasLegterEnd: boolean;                 // airspace permit window ends here   — blue right edge
}
function buildDays(today: Date, annotations: DashboardDayAnnotation[], daysAhead: number, daysBehind: number = 0): DayInfo[] {
  const byDate = new Map<string, DashboardDayAnnotation[]>();
  const push = (key: string, a: DashboardDayAnnotation) => {
    const arr = byDate.get(key) ?? [];
    arr.push(a);
    byDate.set(key, arr);
  };
  // Per-day start/end flags so the renderer can paint the two endpoint edges
  // without re-walking each annotation.
  const startSet = new Set<string>();
  const endSet   = new Set<string>();
  for (const a of annotations) {
    const start = a.date.slice(0, 10);
    push(start, a);
    if (a.type === 'legter') {
      startSet.add(start);
      const end = a.endDate?.slice(0, 10);
      if (end && end !== start) {
        push(end, a);
        endSet.add(end);
      } else {
        // Single-day permit window — same-day start/end.
        endSet.add(start);
      }
    }
  }
  const out: DayInfo[] = [];
  // Múlt napokat először, aztán a jelen + jövő. Az "isToday" most a daysBehind
  // index oszlopa, hogy a user vissza tudjon tekinteni.
  for (let i = -daysBehind; i < daysAhead; i++) {
    const date = offsetDate(i, today);
    const iso = dateStr(date);
    const dow = date.getDay();
    const anns = byDate.get(iso) ?? [];
    out.push({
      date, iso, dow,
      isWeekend: dow === 0 || dow === 6,
      isToday: i === 0,
      isPast: i < 0,
      annotations: anns,
      primary: anns[0],
      hasHatarido:    anns.some(a => a.type === 'hatarido'),
      hasMunkaszunet: anns.some(a => a.type === 'munkaszunet'),
      hasLegterStart: startSet.has(iso),
      hasLegterEnd:   endSet.has(iso),
    });
  }
  return out;
}
interface ProjectLane { project: DashboardProject; color: string; lanes: DashboardTask[][]; numLanes: number; }

/** Két task időben átfed-e (zárt intervallumok). */
function tasksOverlap(a: DashboardTask, b: DashboardTask): boolean {
  if (!a.startDate || !b.startDate) return false;
  const aStart = new Date(a.startDate).getTime();
  const bStart = new Date(b.startDate).getTime();
  const aDur = Math.max(1, (a.duration ?? 1));
  const bDur = Math.max(1, (b.duration ?? 1));
  const aEnd = aStart + aDur * MS_PER_DAY;
  const bEnd = bStart + bDur * MS_PER_DAY;
  return aStart < bEnd && bStart < aEnd;
}

function buildProjectLanes(overview: DashboardOverview, _today: Date): ProjectLane[] {
  return overview.projects.map((project, idx) => {
    const color = projectColor(project, idx);
    const tasks = overview.tasks.filter(t => t.projectId === project.id && t.startDate);

    // HIBRID lane-allokáció: a manuálisan beállított laneIndex>0 abszolút prioritást
    // élvez (a user explicit döntése). A laneIndex=0 (vagy null) task-okat
    // greedy-overlap-detect-tel automatikusan szétrendezzük: minden task kapja
    // a legalacsonyabb szabad sávot, ahol nem fed át manuálisan beállított
    // VAGY már automatikusan elhelyezett task-tal. Új lane-eket szükség szerint
    // hozzáadunk MAX_LANE_INDEX-ig.
    const manualTasks: DashboardTask[] = [];
    const autoTasks: DashboardTask[] = [];
    for (const t of tasks) {
      const li = Math.floor(t.laneIndex ?? 0);
      if (li > 0) manualTasks.push(t);
      else autoTasks.push(t);
    }

    const lanesMap = new Map<number, DashboardTask[]>();
    // 1. lépés: a manuálisok a saját laneIndex-ükre.
    for (const t of manualTasks) {
      const li = Math.min(MAX_LANE_INDEX, Math.floor(t.laneIndex ?? 0));
      const arr = lanesMap.get(li) ?? [];
      arr.push(t);
      lanesMap.set(li, arr);
    }
    // 2. lépés: az auto task-okat startDate szerint sorbarendezve greedy
    // módon helyezzük a legalacsonyabb szabad lane-re.
    autoTasks.sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
    for (const t of autoTasks) {
      let placed = false;
      for (let li = 0; li <= MAX_LANE_INDEX; li++) {
        const occupants = lanesMap.get(li) ?? [];
        if (!occupants.some(o => tasksOverlap(t, o))) {
          occupants.push(t);
          lanesMap.set(li, occupants);
          placed = true;
          break;
        }
      }
      // Ha még MAX_LANE_INDEX-en sincs hely, a 0. sávra esik vissza
      // (override-eljük az ütközést — extrém eset, manuális kezelés kell).
      if (!placed) {
        const arr = lanesMap.get(0) ?? [];
        arr.push(t);
        lanesMap.set(0, arr);
      }
    }

    const maxLane = Math.max(0, ...lanesMap.keys());
    const lanes: DashboardTask[][] = Array.from({ length: maxLane + 1 }, (_, laneIdx) =>
      (lanesMap.get(laneIdx) ?? []).sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '')),
    );
    return { project, color, lanes, numLanes: Math.max(1, lanes.length) };
  });
}

/* ── TASK BAR BACKGROUND (vasúti-pálya alakzat: hétvégén 20% magasság) ─── */
function TaskBarBackground({
  startDate, widthDays, dayWidth, height, bgColor, isGepido,
}: {
  startDate: Date;
  widthDays: number;
  dayWidth: number;
  height: number;
  bgColor: string;
  isGepido: boolean;
}) {
  // Path-számolás useMemo-ban: drag közben (mikor csak a tartalmazó div
  // width-je / left-je változik) NEM számoljuk újra. Elkerüli a
  // pointermove-render-storm okozta döcögést.
  const startMs = startDate.getTime();
  const path = useMemo(() => {
    if (isGepido || widthDays < 1) return null; // div fallback gepidő-re
    const totalWidth = widthDays * dayWidth;
    const days: Array<{ isWeekend: boolean }> = [];
    let cursor = 0;
    let dayIdx = 0;
    while (cursor < widthDays) {
      const dayDate = new Date(startMs + dayIdx * 86400000);
      const dow = dayDate.getDay();
      days.push({ isWeekend: dow === 0 || dow === 6 });
      cursor += Math.min(1, widthDays - cursor);
      dayIdx++;
    }
    const tallH = height;
    const shortH = Math.max(4, Math.round(height * 0.22));
    const shortY = (height - shortH) / 2;
    const N = days.length;
    const cx = (i: number) => (i + 0.5) * dayWidth;
    const topY = (i: number) => (days[i].isWeekend ? shortY : 0);
    const botY = (i: number) => (days[i].isWeekend ? shortY + shortH : tallH);
    let d = `M 0 ${topY(0)} L ${cx(0)} ${topY(0)} `;
    for (let i = 0; i < N - 1; i++) {
      const mid = (cx(i) + cx(i + 1)) / 2;
      d += `C ${mid} ${topY(i)}, ${mid} ${topY(i + 1)}, ${cx(i + 1)} ${topY(i + 1)} `;
    }
    d += `L ${totalWidth} ${topY(N - 1)} L ${totalWidth} ${botY(N - 1)} `;
    for (let i = N - 1; i > 0; i--) {
      const mid = (cx(i) + cx(i - 1)) / 2;
      d += `C ${mid} ${botY(i)}, ${mid} ${botY(i - 1)}, ${cx(i - 1)} ${botY(i - 1)} `;
    }
    d += `L 0 ${botY(0)} Z`;
    return { d, totalWidth };
  }, [startMs, widthDays, dayWidth, height, isGepido]);

  if (!path) {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        background: bgColor,
        borderRadius: 4,
        zIndex: 1,
      }} />
    );
  }

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${path.totalWidth} ${height}`}
      preserveAspectRatio="none"
      style={{ position: 'absolute', left: 0, top: 0, zIndex: 1, pointerEvents: 'none' }}
    >
      <path d={path.d} fill={bgColor} />
    </svg>
  );
}

/* ── TASK BAR ─────────────────────────────────────────────── */
function TaskBar({
  task,
  project,
  people,
  equipment: _equipment,
  today,
  laneIdx,
  laneOffsetPx = 0,
  onClick,
  onToggleDone,
  status,
  warnings,
  dayWidth,
  daysAhead,
  daysBehind,
  dragOffsetDays,
  dragMode,
  onMoveDown,
  onResizeDown,
  isDragging,
  isPushed,
  taskTypes,
  recentlyDropped,
}: {
  task: DashboardTask;
  project: DashboardProject;
  people: DashboardPerson[];
  equipment: DashboardEquipment[];
  today: Date;
  laneIdx: number;
  /** Vertikális drag-eltolás px-ben — csak amikor ezt a kártyát húzzák lift-be. */
  laneOffsetPx?: number;
  onClick: () => void;
  /** Avatár-hover overlay: ha a task NEM completed, ✓ jelenik meg
   *  („készre jelölés"); ha completed, ↺ jelenik meg („visszaállítás
   *  folyamatban-ra"). A callback maga dönt a megfelelő status-update-ről
   *  (a TaskBar csak a `task.status`-t adja át vizuálisan). */
  onToggleDone?: () => void;
  status: TaskVisualStatus;
  warnings: number;
  dayWidth: number;
  daysAhead: number;
  daysBehind: number;
  /** Aktív drag delta nap; csak ha ez a kártya van drag-elve (egyébként 0). */
  dragOffsetDays: number;
  dragMode: 'move' | 'resize' | null;
  onMoveDown: (e: React.PointerEvent) => void;
  onResizeDown: (e: React.PointerEvent) => void;
  isDragging?: boolean;
  isPushed?: boolean;
  /** Task-típus lista (admin-konfigolható) — színt és label-t innen veszi a bar. */
  taskTypes: TaskType[] | null;
  /** A drop pillanata utáni ~250ms-os ablak: transition: none, hogy a backend
   *  lossy weekend-cross fixup ne rezegjen. */
  recentlyDropped?: boolean;
}) {
  const t = useT();
  // Click vs drag elkülönítés: a hookoknak a korai return előtt kell futniuk,
  // különben a production build react-hooks/rules-of-hooks hibát dob.
  const downXRef = useRef<number | null>(null);
  const downYRef = useRef<number | null>(null);

  if (!task.startDate) return null;
  const taskStart = parseDate(task.startDate);
  // leftDays a today-tól, de a Gantt origója today - daysBehind. Az actual oszlop = leftDays + daysBehind.
  let leftDays = diffDays(taskStart, today);
  // Új modell: a duration MUNKANAPOKBAN van (gepido kivétel: 1/24 nap = óra).
  // A vizuális szélesség minden napot lefed (hétvégi vékonyítva is) — így a
  // 2 munkanap péntek-induló task vizuálisan 4 nap (P/Sz/V/H) széles.
  const isGepido = task.taskType === 'gepido';
  const workingDays = Number(task.duration ?? 1);
  let widthDays = isGepido ? workingDays : visualWidthDays(taskStart, workingDays);

  // Slipping: a bar megőrzi az eredeti munka-méretét (nem nyúlik a today-ig).
  // A csúszás mértékét egy kis számláló-badge mutatja a bar jobb szélén.
  const slipDays = status === 'slipping' ? Math.max(1, Math.ceil(diffDays(today, taskStart))) : 0;
  // Drag-időszakban a kártya pontosan az egeret követi (mouse-1:1 calendar):
  // - move: az X-eltolást `transform: translateX(...)` adja → GPU-composited
  //   layer, layout-trigger nélkül (a `left` változatlan). A pushed szomszéd
  //   is ugyanezt használja.
  // - resize: a width valós `width` style-on változik (méret-változás CSS-ben
  //   nem composite-only, de a frekvencia alacsony — drop-pillanaton kívül
  //   semmi nem mozog).
  // A commit szemantikát ELENGEDÉSKOR alkalmazzuk, NEM élőben. Így a bar
  // soha nem "rángat" weekend-határoknál.
  const cellLeft = leftDays + daysBehind;
  const visualWidth = dragMode === 'resize'
    ? Math.max(0.5, widthDays + dragOffsetDays)
    : widthDays;
  // Drag-induced offsetek — `transform` style-on érvényesítjük.
  const transformOffsetX = dragMode === 'move' ? dragOffsetDays * dayWidth : 0;
  const transformOffsetY = laneOffsetPx;

  // Off-screen culling: a transform-offsetet IS bele kell venni, különben a
  // jobb felé húzott bar középről eltűnne ha a static cellLeft már kiment a
  // látható ablakból.
  const effectiveLeftDays = cellLeft + (dragMode === 'move' ? dragOffsetDays : 0);
  if (effectiveLeftDays + visualWidth < 0 || effectiveLeftDays > daysAhead + daysBehind) return null;
  const clampedLeft = Math.max(0, cellLeft);
  const clampedRight = Math.min(daysAhead + daysBehind, cellLeft + visualWidth);
  const actualWidth = (clampedRight - clampedLeft) * dayWidth - 4;
  const left = clampedLeft * dayWidth + 2;
  const top = laneIdx * LANE_H + 6;

  const person = task.assignedTo ? people.find(p => p.id === task.assignedTo) : undefined;
  // Task-bar szín: elsődlegesen a task-type szín (admin-konfig), fallback a projektszín.
  const taskTypeColor = getTaskTypeColor(taskTypes, task.taskType);
  const bgColor = status === 'slipping' ? undefined : (taskTypeColor ?? projectColor(project, 0));

  const typeLabel = getTaskTypeLabel(taskTypes, task.taskType);
  // Esemény-szerű task-típusok (gepido, számlázás, TIG, várható kifizetés stb.):
  // a bar-on az admin által beállított emoji látszik az avatar helyett, és a
  // tooltip a típus-label-t mutatja (nem person-nevet, mert nincs assignee).
  const taskTypeMeta = taskTypes?.find(t => t.value === task.taskType);
  const isEventTask = taskTypeMeta?.isUnassigned ?? isGepido;
  const emojiIcon = taskTypeMeta?.icon ?? (isGepido ? '⚙' : null);
  const tooltip = [
    person ? personName(person) : (isEventTask ? typeLabel : '—'),
    typeLabel,
    task.title,
  ].filter(Boolean).join(' · ');

  return (
    <div
      title={tooltip}
      onPointerDown={e => { downXRef.current = e.clientX; downYRef.current = e.clientY; onMoveDown(e); }}
      onClick={e => {
        const dx = downXRef.current != null ? Math.abs(e.clientX - downXRef.current) : 0;
        const dy = downYRef.current != null ? Math.abs(e.clientY - downYRef.current) : 0;
        if (dx > 5 || dy > 5) { e.stopPropagation(); return; }
        onClick();
      }}
      className={clsx(
        styles.task,
        status === 'slipping' && styles.slipping,
        status === 'done' && styles.done,
        status === 'danger' && styles.danger,
        status === 'draft' && styles.draft,
        isDragging && styles.dragging,
        isPushed && styles.pushed,
      )}
      style={{
        left, top, width: actualWidth,
        // X-eltolást (drag/push) transform-on visszük, hogy GPU-composited
        // legyen — nincs layout-trigger pointermove-onként. translate3d a 3D-
        // accelerated path, ami biztosan külön rétegre teszi a bart.
        transform: `translate3d(${transformOffsetX}px, ${transformOffsetY}px, 0)`,
        willChange: dragMode || transformOffsetY !== 0 ? 'transform' : undefined,
        // Háttér át-helyezve a SVG layer-re (lentebb), hogy a hétvégi szegmenseket
        // formálni lehessen. Itt csak transparent, kivéve gepido (rövid task, nem kell szegmens).
        background: 'transparent',
        cursor: dragMode === 'move' ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
        // Smooth transition amikor NINCS aktív drag — a drop utáni snap nem ugrik.
        // A `recentlyDropped` ~250ms-os ablakban szintén transition: none, hogy
        // a backend-fixup (weekend-cross 1 cella) ne rezegjen utórezgést.
        transition: dragMode || recentlyDropped
          ? 'none'
          : 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), width 0.18s cubic-bezier(0.22, 1, 0.36, 1), left 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* Háttér-szegmensek SVG-ként: minden napi szegmens külön rect, hétvége
          ~20% magasságú (centrálva), munkanap teljes magasságú. CSS transition
          lágyítja a magasság- és Y-ugrást — vasúti-pálya-szerű alakzat.
          Belső wrapper `overflow:hidden + border-radius`-szal, hogy az SVG
          path éles bal/jobb széle szépen lekerekített legyen (a `.task`-on
          `overflow:visible`, hogy az avatar `left:-6px`-tel kilóghasson). */}
      <div style={{
        position: 'absolute', inset: 0,
        overflow: 'hidden', borderRadius: 6,
        zIndex: 1, pointerEvents: 'none',
      }}>
        <TaskBarBackground
          startDate={taskStart}
          widthDays={visualWidth}
          dayWidth={dayWidth}
          height={LANE_H - 12}
          bgColor={status === 'slipping' ? '#dc2626' : bgColor || '#9ca3af'}
          isGepido={task.taskType === 'gepido'}
        />
      </div>
      {(() => {
        const isCompleted = task.status === 'completed';
        const overlayIcon = isCompleted ? '↺' : '✓';
        const overlayBg = isCompleted ? '#6366f1' : '#16a34a';
        const overlayTitle = onToggleDone
          ? (isCompleted
              ? (person ? t.meeting.taskBar.revertTooltip(personName(person)) : t.meeting.taskBar.revertTooltipNoName)
              : (person ? t.meeting.taskBar.markDoneTooltip(personName(person)) : t.meeting.taskBar.markDoneTooltipNoName))
          : (person ? personName(person) : '');
        if (person) {
          return (
            <span
              className={clsx(styles.taskAvatar, onToggleDone && styles.taskAvatarClickable)}
              style={{ background: avatarColor(person) }}
              title={overlayTitle}
              onPointerDown={e => e.stopPropagation()}
              onClick={onToggleDone ? (e) => { e.stopPropagation(); onToggleDone(); } : undefined}
            >
              <span className={styles.taskAvatarInitial}>{personInitial(person)}</span>
              {onToggleDone && (
                <span className={styles.taskAvatarCheck} style={{ background: overlayBg }} aria-hidden="true">
                  {overlayIcon}
                </span>
              )}
            </span>
          );
        }
        if (isEventTask && emojiIcon) {
          return (
            <span
              className={clsx(styles.taskAvatar, onToggleDone && styles.taskAvatarClickable)}
              style={{ background: bgColor ?? '#6b7280', color: '#fff' }}
              title={overlayTitle}
              onPointerDown={e => e.stopPropagation()}
              onClick={onToggleDone ? (e) => { e.stopPropagation(); onToggleDone(); } : undefined}
            >
              <span className={styles.taskAvatarInitial}>{emojiIcon}</span>
              {onToggleDone && (
                <span className={styles.taskAvatarCheck} style={{ background: overlayBg }} aria-hidden="true">
                  {overlayIcon}
                </span>
              )}
            </span>
          );
        }
        return null;
      })()}
      {actualWidth > 60 && (
        <span className={styles.taskTitle} style={{ position: 'relative', zIndex: 2 }}>
          {person ? personName(person) : isEventTask ? (task.title || typeLabel) : task.title}
        </span>
      )}
      {warnings > 0 && actualWidth > 30 && (
        <span className={styles.warnIcon} style={{ background: '#f59e0b', zIndex: 2 }}>!</span>
      )}
      {/* Slipping-counter: a bar JOBB SZÉLÉN, a kárán kívül kicsi piros badge,
          ami a csúszás napjait számlálja. A bar mérete az eredeti duration —
          NEM nyúlik a today-ig. */}
      {slipDays > 0 && (
        <span
          title={t.meeting.taskBar.slipBadgeTooltip(slipDays)}
          style={{
            position: 'absolute',
            left: '100%',
            marginLeft: 4,
            top: '50%',
            transform: 'translateY(-50%)',
            background: '#dc2626',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 10,
            whiteSpace: 'nowrap',
            zIndex: 3,
            boxShadow: '0 1px 3px rgba(220, 38, 38, 0.4)',
          }}
        >
          {t.meeting.taskBar.slipBadgeFmt(slipDays)}
        </span>
      )}
      {/* Resize handle a kártya jobb szélén — csak akkor látszik, ha actualWidth > 14 */}
      {actualWidth > 14 && (
        <span
          onPointerDown={e => { e.stopPropagation(); onResizeDown(e); }}
          className={clsx(styles.resizeHandle, dragMode === 'resize' && styles.activeResizeHandle)}
          title={t.meeting.taskBar.resizeHandleTitle}
        />
      )}
    </div>
  );
}

/* ── HEADER ROW ───────────────────────────────────────────── */
function GanttHeader({
  days,
  dayWidth,
  onDayClick,
  onLoadMore: _onLoadMore,
  forecast,
  thresholds,
  onWeatherClick,
  weatherCityKey,
  onWeatherCityChange,
}: {
  days: DayInfo[];
  dayWidth: number;
  onDayClick: (iso: string) => void;
  onLoadMore?: () => void;
  forecast: WeatherForecast | null;
  thresholds: WeatherThresholds | null;
  onWeatherClick: (iso: string) => void;
  weatherCityKey: string;
  onWeatherCityChange: (key: string) => void;
}) {
  const months = useMemo(() => {
    const out: Array<{ key: string; label: string; count: number }> = [];
    for (const d of days) {
      const key = `${d.date.getFullYear()}-${d.date.getMonth()}`;
      if (!out.length || out[out.length - 1].key !== key) {
        out.push({ key, label: MONTHS_HU[d.date.getMonth()], count: 1 });
      } else out[out.length - 1].count++;
    }
    return out;
  }, [days]);

  // Indexelés napra: O(1) lookup a forecast.daily-ban
  const weatherByDate = useMemo(() => {
    const m = new Map<string, WeatherDayData>();
    for (const d of forecast?.daily ?? []) m.set(d.date, d);
    return m;
  }, [forecast]);

  return (
    <div className={styles.hdr}>
      <div className={styles.hdrRow}>
        <div className={styles.hdrCorner} style={{ height: 26 }} />
        {months.map(m => (
          <div key={m.key} className={styles.monthCell} style={{ width: m.count * dayWidth }}>{m.label}</div>
        ))}
      </div>
      <div className={styles.hdrRow}>
        <div className={styles.hdrCorner} style={{ height: 28, display: 'flex', alignItems: 'center', paddingLeft: 14, fontSize: 9, color: 'var(--muted)', letterSpacing: 1, fontWeight: 600, textTransform: 'uppercase', gap: 6 }}>
          <span>Időjárás</span>
          <select
            value={weatherCityKey}
            onChange={e => onWeatherCityChange(e.target.value)}
            title="Város választás"
            style={{
              fontSize: 9, padding: '1px 4px', border: '1px solid var(--border)',
              borderRadius: 3, background: 'var(--bg)', color: 'var(--fg)',
              textTransform: 'none', letterSpacing: 0, fontWeight: 500,
            }}
          >
            {WEATHER_CITIES.map(c => (
              <option key={c.key} value={c.key}>{c.name}</option>
            ))}
          </select>
        </div>
        {days.map(d => {
          const wd = weatherByDate.get(d.iso);
          const Icon = weatherCodeToIcon(wd?.weather_code);
          const risk = evaluateDroneRisk(wd, thresholds);
          const tip = wd
            ? `${Math.round(wd.temp_min)}° / ${Math.round(wd.temp_max)}° · ${wd.precip_prob_max}% csapadék · max szél ${Math.round(wd.wind_speed_max)} m/s`
            : 'Nincs előrejelzés';
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => onWeatherClick(d.iso)}
              className={clsx(
                styles.weatherCell,
                d.isWeekend && styles.weatherCellWeekend,
                risk === 'caution' && styles.weatherCellCaution,
                risk === 'danger' && styles.weatherCellDanger,
              )}
              style={{ width: dayWidth }}
              title={tip}
            >
              {Icon ? <Icon className="w-3.5 h-3.5" strokeWidth={1.6} /> : <span style={{ opacity: 0.25, fontSize: 10 }}>—</span>}
            </button>
          );
        })}
      </div>
      <div className={styles.hdrRow}>
        <div className={styles.hdrCorner} style={{ height: 34, display: 'flex', alignItems: 'center', paddingLeft: 14, fontSize: 10, color: 'var(--muted)', letterSpacing: 1, fontWeight: 600, textTransform: 'uppercase' }}>
          Projekt
        </div>
        {days.map(d => (
          <button
            key={d.iso}
            type="button"
            onClick={() => onDayClick(d.iso)}
            className={clsx(
              styles.dayCell,
              d.isWeekend && styles.weekend,
              d.isToday && styles.today,
              // Légtér jelzés ugyanúgy mint a határidő: csak a megfelelő projekt-soron
              // jelenik meg (lásd ProjectRow). A header-en csak a kis annotationDot mutatja.
            )}
            title={d.annotations.map(a => a.label).join(' · ')}
          >
            <span className={styles.dow}>{DOW_HU[d.dow]}</span>
            <span>{d.date.getDate()}</span>
            {d.primary && (
              <span
                className={styles.annotationDot}
                style={{
                  background:
                    d.primary.type === 'munkaszunet' ? '#dc2626' :
                    d.primary.type === 'szabadsag'   ? '#3b82f6' :
                    d.primary.type === 'szerviz'     ? '#f97316' :
                    d.primary.type === 'legter'      ? '#0284c7' :
                                                       '#dc2626',
                }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── PROJECT ROW ───────────────────────────────────────────── */
type DragMode = 'move' | 'resize';
interface DragState {
  taskId: string;
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  origStartIso: string;
  origEndIso: string;
  origDurationDays: number;
  origTaskType: string;
  origLaneIndex: number;
  targetLaneIndex: number;
  // Aktív vizuális delta — pointermove során frissül.
  deltaDays: number;
  // Nyers (NEM-snappelt) delta — a húzott bar EZT követi vizuálisan, hogy
  // 1:1-ben az egeret kövesse lépcsőzés nélkül. A snap/push/commit a
  // `deltaDays`-re épül továbbra is.
  rawDeltaDays: number;
  // 5px threshold: csak akkor jelölünk dragnek, ha a user már elmozdította.
  activated: boolean;
  // Kaszkád-tolt szomszédok: taskId → deltaDays (vízszintes shift munkanapban
  // értelmezett, de a render-számolás naptári napban viszi tovább).
  pushed: Record<string, number>;
}

const LANE_H_FOR_LIFT = LANE_H;
const LIFT_THRESHOLD_PX = 24;     // ennyit kell felhúzni vertikálisan a lift-aktiváláshoz

function ProjectRow({
  plane,
  days,
  today,
  overview,
  onTaskClick,
  onProjectClick,
  onEmptyClick,
  onTaskMutate,
  onOptimisticMutate,
  onDragActiveChange,
  slippingIds,
  dayWidth,
  daysAhead,
  daysBehind,
  draggable: rowDraggable,
  draggingProjectId,
  onProjectDragStart,
  onProjectDragEnd,
  onProjectDragOver,
  taskTypes,
  isCollapsed,
  onToggleCollapse,
  openPingId,
  onOpenPing,
}: {
  plane: ProjectLane;
  days: DayInfo[];
  today: Date;
  overview: DashboardOverview;
  onTaskClick: (t: DashboardTask) => void;
  onProjectClick: (p: DashboardProject) => void;
  onEmptyClick: (projectId: string, startDate: string) => void;
  onTaskMutate: () => Promise<unknown>;
  /** Optimistic-UI cache-mutate: a drop pillanatában a célállapotot beírjuk
   *  a SWR cache-be (revalidate: false) — különben a setDrag(null) UTÁN egy
   *  rendering frame-ben a stale DB-érték villanna (régi origStartIso),
   *  és csak a backend-RTT után állna helyre. Az így átírt cache-érték a
   *  következő `await onTaskMutate()`-tel revalidálódik. */
  onOptimisticMutate: (
    draggedTaskId: string,
    patch: {
      newStartIso: string | null;
      newDuration: number | null;
      newLaneIndex: number | null;
      pushedStartIso: Map<string, string>;
    },
  ) => Promise<void>;
  /** Drag-aktív flag jelzése a parent-nek (MeetingView) — addig kikapcsolja
   *  az SWR-revalidate-et, hogy mid-drop a stale érték ne dobja vissza a bar-t. */
  onDragActiveChange?: (active: boolean) => void;
  slippingIds: Set<string>;
  dayWidth: number;
  daysAhead: number;
  daysBehind: number;
  draggable: boolean;
  draggingProjectId: string | null;
  onProjectDragStart: (id: string) => void;
  onProjectDragEnd: () => void;
  onProjectDragOver: (overId: string, mouseY: number, rowTop: number, rowHeight: number) => void;
  taskTypes: TaskType[] | null;
  /** Ha true és numLanes > 1, csak a 0. sáv tasks-jai látszanak; a többi rejtve.
   *  A drag-aktív állapot ezt felülírja (akkor minden látszik). */
  isCollapsed: boolean;
  onToggleCollapse: (projectId: string) => void;
  /** Globális open-ping id (csak egy popover egyszerre nyitva) + setter. */
  openPingId: string | null;
  onOpenPing: (id: string | null) => void;
}) {
  const allFlatTasks = plane.lanes.flatMap((lane, idx) => lane.map(t => ({ ...t, _laneIdx: idx })));
  const totalDays = daysAhead + daysBehind;

  // ── Drag state (pointer events) ───────────────────────────────
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  // tasksById gyors lookup-hoz (pushUpdates + draggedTask kereséshez O(1)),
  // a régi flatTasks.find lineáris keresés helyett. Csak akkor változik újra,
  // ha a flatTasks array referenciája megváltozik.
  const tasksById = useMemo(() => {
    const m = new Map<string, typeof allFlatTasks[number]>();
    for (const t of allFlatTasks) m.set(t.id, t);
    return m;
  }, [allFlatTasks]);
  // A drag-aktiválást felfelé propagáljuk: amíg aktív, az SWR-revalidate ki van
  // kapcsolva (lásd useDashboardOverview pauseRevalidation), különben az SSE/focus
  // event egy stale értékre cserélné a bar-t mid-drop, és „rugózna vissza".
  const dragActiveSignal = drag?.activated === true;
  useEffect(() => {
    if (!onDragActiveChange) return;
    onDragActiveChange(dragActiveSignal);
    if (!dragActiveSignal) return;
    return () => onDragActiveChange(false);
  }, [dragActiveSignal, onDragActiveChange]);
  const activeTargetLane = drag?.mode === 'move' ? drag.targetLaneIndex : -1;
  // Drag aktív → minden lane látszik (még akkor is, ha collapsed). Egyébként
  // a collapsed projekt csak a 0. sávot mutatja.
  const dragActive = drag?.activated === true;
  const effectiveCollapsed = isCollapsed && plane.numLanes > 1 && !dragActive;
  const flatTasks = effectiveCollapsed
    ? allFlatTasks.filter(t => t._laneIdx === 0)
    : allFlatTasks;
  // Rejtett task-ok (lane > 0) — collapsed-ban NEM renderelődnek, de a
  // hely-jelölő csíkjuk igen, az alsó sáv aljához igazítva.
  const hiddenTasks = effectiveCollapsed
    ? allFlatTasks.filter(t => t._laneIdx > 0)
    : [];
  const visibleLaneCount = effectiveCollapsed
    ? 1
    : Math.max(plane.numLanes, activeTargetLane + 1);
  const rowH = visibleLaneCount * LANE_H;
  const hiddenLaneCount = plane.numLanes - 1; // 0 ha 1-sávos
  const hiddenTaskCount = hiddenTasks.length;
  // A drag aktivált pointerup után a böngésző még küld egy `click` event-et —
  // ezt capture-fázisban elnyeljük, hogy ne nyíljon meg a TaskModal.
  const justDraggedRef = useRef(false);

  useEffect(() => {
    function captureClick(e: MouseEvent) {
      if (justDraggedRef.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    }
    window.addEventListener('click', captureClick, true);
    return () => window.removeEventListener('click', captureClick, true);
  }, []);

  // Snap segédek a task TÍPUSA + HOSSZA alapján:
  //   • gepido → óránkénti (1/24 nap),
  //   • fél napos vagy rövidebb (origDurationDays < 1) → fél napos lépés,
  //   • 1+ napos → egész napos lépés.
  // Indok: a 0.5-napos task egész napos snap-pel "saját hosszán túl" mozdulna,
  // emiatt a < 0.5 napos drag 0-ra round-olt → visszaugrott. A duration-arányos
  // lépés mindkét esetet kezeli (csütörtök→péntek 1-naposnál; fél nap arrébb
  // a fél napos task-nál).
  const snapForType = (raw: number, taskType: string, origDurationDays?: number) => {
    if (taskType === 'gepido') return Math.round(raw * 24) / 24;
    const step = origDurationDays != null && origDurationDays > 0 && origDurationDays < 1 ? 0.5 : 1;
    return Math.round(raw / step) * step;
  };

  const clampLaneIndex = (laneIndex: number) =>
    Math.max(0, Math.min(MAX_LANE_INDEX, Math.round(laneIndex)));

  const dateForTask = (iso: string, taskType: string): Date =>
    taskType === 'gepido' ? new Date(iso) : parseDate(iso);

  const computeEndMsFrom = (startIso: string, taskType: string, durationDays: number): number => {
    const start = dateForTask(startIso, taskType);
    if (taskType === 'gepido') return start.getTime() + durationDays * MS_PER_DAY;
    return addWorkingDays(start, durationDays).getTime();
  };

  const taskRangeMs = (task: DashboardTask): { startMs: number; endMs: number } | null => {
    if (!task.startDate) return null;
    const start = dateForTask(task.startDate, task.taskType);
    const startMs = start.getTime();
    const endMs = task.endDate
      ? dateForTask(task.endDate, task.taskType).getTime()
      : computeEndMsFrom(task.startDate, task.taskType, Number(task.duration ?? 1));
    return { startMs, endMs: Math.max(startMs, endMs) };
  };

  const shiftedStartDate = (iso: string, taskType: string, days: number): Date => {
    const orig = dateForTask(iso, taskType);
    // Literálisan oda mozgatjuk, ahol elengedte a felhasználó — nincs
    // post-hoc skipWeekend, ami "kirúgna" 1-2 cellával. A backend
    // (addWorkingDays) a hétvége-induló task-ot is helyesen kezeli:
    // a duration munkanapokban van, az endDate ennek alapján számol.
    return new Date(orig.getTime() + days * MS_PER_DAY);
  };

  const toStartDatePayload = (d: Date, taskType: string): string => {
    if (taskType === 'gepido') return toIsoUtc(d);
    return new Date(Date.UTC(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      d.getHours(),
      d.getMinutes(),
      d.getSeconds(),
      d.getMilliseconds(),
    )).toISOString();
  };

  const durationForResize = (cur: DragState, deltaDays = cur.deltaDays): number => {
    const minDur = cur.origTaskType === 'gepido' ? 1 / 24 : 0.5;
    if (cur.origTaskType === 'gepido') {
      return Math.max(minDur, cur.origDurationDays + deltaDays);
    }
    const startDate = parseDate(cur.origStartIso);
    const oldVisualCal = visualWidthDays(startDate, cur.origDurationDays);
    const newCalSpan = Math.max(0.5, oldVisualCal + deltaDays);
    return Math.max(minDur, inverseVisualWidthDays(startDate, newCalSpan));
  };

  function startDrag(e: React.PointerEvent, task: DashboardTask, mode: DragMode) {
    if (!task.startDate) return;
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // Some browsers can throw if capture is already owned; window listeners still cover the drag.
    }
    const origLane = clampLaneIndex(task.laneIndex ?? 0);
    const computedOrigEnd = new Date(computeEndMsFrom(
      task.startDate,
      task.taskType,
      Number(task.duration ?? 1),
    ));
    const origEndIso = task.endDate ?? (task.taskType === 'gepido' ? toIsoUtc(computedOrigEnd) : dateStr(computedOrigEnd));
    const state: DragState = {
      taskId: task.id,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origStartIso: task.startDate,
      origEndIso,
      origDurationDays: Number(task.duration ?? 1),
      origTaskType: task.taskType,
      origLaneIndex: origLane,
      targetLaneIndex: origLane,
      deltaDays: 0,
      rawDeltaDays: 0,
      activated: false,
      pushed: {},
    };
    setDrag(state);
    dragRef.current = state;
  }

  /** Kaszkád-push: az érintett sávban sorban eltolja az útban lévő taskokat. */
  function computePushOffsetsFromRange(
    laneTasks: DashboardTask[],
    draggedId: string,
    newStartMs: number,
    newEndMs: number,
    direction: 'left' | 'right',
  ): Record<string, number> {
    const result: Record<string, number> = {};
    const sorted = laneTasks
      .map(task => {
        const range = taskRangeMs(task);
        return range ? { task, ...range } : null;
      })
      .filter((entry): entry is { task: DashboardTask; startMs: number; endMs: number } => Boolean(entry))
      .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
    const draggedIdx = sorted.findIndex(entry => entry.task.id === draggedId);
    if (draggedIdx === -1) return result;

    if (direction === 'right') {
      let cursorEnd = newEndMs;
      for (let i = draggedIdx + 1; i < sorted.length; i++) {
        const next = sorted[i];
        if (cursorEnd > next.startMs) {
          const pushDays = (cursorEnd - next.startMs) / MS_PER_DAY;
          result[next.task.id] = pushDays;
          cursorEnd = next.endMs + pushDays * MS_PER_DAY;
        } else {
          break;
        }
      }
    } else {
      let cursorStart = newStartMs;
      for (let i = draggedIdx - 1; i >= 0; i--) {
        const prev = sorted[i];
        if (prev.endMs > cursorStart) {
          const pushDays = (cursorStart - prev.endMs) / MS_PER_DAY;
          result[prev.task.id] = pushDays;
          cursorStart = prev.startMs + pushDays * MS_PER_DAY;
        } else {
          break;
        }
      }
    }

    return result;
  }

  // recentlyDroppedId: a drop pillanatában felvesszük ide a task-id-t, és a
  // TaskBar `transition` style-ja ezalatt 'none' lesz — így a backend lossy
  // weekend-cross fixup nem rángat utórezgést. 250ms után automatikusan null.
  // State, mert re-renderelnünk kell, hogy a TaskBar tudjon róla.
  const [recentlyDroppedId, setRecentlyDroppedId] = useState<string | null>(null);
  const recentlyDroppedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markRecentlyDropped = useCallback((taskId: string) => {
    setRecentlyDroppedId(taskId);
    if (recentlyDroppedTimerRef.current) clearTimeout(recentlyDroppedTimerRef.current);
    recentlyDroppedTimerRef.current = setTimeout(() => {
      setRecentlyDroppedId(null);
    }, 250);
  }, []);
  useEffect(() => {
    return () => {
      if (recentlyDroppedTimerRef.current) clearTimeout(recentlyDroppedTimerRef.current);
    };
  }, []);

  // Globális pointermove + pointerup, csak amíg drag aktív.
  // RAF-coalescing: a pointermove eseményeket NEM commit-oljuk minden alkalommal
  // React-state-be. A legutóbbi event-et pendingEvRef-be tesszük; a következő
  // animation frame-en a flush() olvassa, kiszámolja a snapped delta-t és a
  // push-cascade-et — majd csak akkor setDrag-el, ha tényleg változott
  // (deltaDays/targetLane/pushed). 240Hz-es egéren is max ~60 commit/s,
  // a köztes szubpixeles mozgások nem render-elnek.
  useEffect(() => {
    if (!drag) return;

    let rafId: number | null = null;
    let pendingEv: PointerEvent | null = null;

    function flush() {
      rafId = null;
      const ev = pendingEv;
      pendingEv = null;
      const cur = dragRef.current;
      if (!cur || !ev) return;
      const dx = ev.clientX - cur.startClientX;
      const dy = ev.clientY - cur.startClientY;
      const rawDays = dx / dayWidth;
      const activated = cur.activated || Math.abs(dx) > 5 || Math.abs(dy) > 5;
      const snapped = snapForType(rawDays, cur.origTaskType, cur.origDurationDays);

      let targetLaneIndex = cur.origLaneIndex;
      if (cur.mode === 'move' && Math.abs(dy) >= LIFT_THRESHOLD_PX) {
        targetLaneIndex = clampLaneIndex(cur.origLaneIndex + Math.round(dy / LANE_H_FOR_LIFT));
      }

      let pushed: Record<string, number> = {};
      const laneChanged = cur.mode === 'move' && targetLaneIndex !== cur.origLaneIndex;
      if (cur.mode === 'move' && !laneChanged && snapped !== 0) {
        const laneTasks = plane.lanes[cur.origLaneIndex] ?? [];
        const origStartMs = dateForTask(cur.origStartIso, cur.origTaskType).getTime();
        const origEndMs = dateForTask(cur.origEndIso, cur.origTaskType).getTime();
        pushed = computePushOffsetsFromRange(
          laneTasks,
          cur.taskId,
          origStartMs + snapped * MS_PER_DAY,
          origEndMs + snapped * MS_PER_DAY,
          snapped > 0 ? 'right' : 'left',
        );
      } else if (cur.mode === 'resize' && snapped > 0) {
        const laneTasks = plane.lanes[cur.origLaneIndex] ?? [];
        const newDur = durationForResize(cur, snapped);
        pushed = computePushOffsetsFromRange(
          laneTasks,
          cur.taskId,
          dateForTask(cur.origStartIso, cur.origTaskType).getTime(),
          computeEndMsFrom(cur.origStartIso, cur.origTaskType, newDur),
          'right',
        );
      }

      // Dedup: ha minden olvasható mező változatlan, ne setDrag (ne re-render).
      // dragRef-en azért updateljük, hogy az aktuális olvasások (pl. onUp) a
      // legfrissebb pointer-pozícióból induljanak — de a React-state-et nem
      // koszoljuk, ha nincs vizuális változás.
      const pushedKeys = Object.keys(pushed);
      const curPushedKeys = Object.keys(cur.pushed);
      const pushedEqual = pushedKeys.length === curPushedKeys.length
        && pushedKeys.every(k => Math.abs((cur.pushed[k] ?? 0) - pushed[k]) < 1e-9);
      // A húzott bar VIZUÁLISAN a nyers (nem-snappelt) deltát követi → 1:1
      // kurzorkövetés, lépcsőzés nélkül. A raw-t csak akkor vesszük figyelembe a
      // re-renderhez, ha legalább ~0.5px-et mozdult (sub-pixel zaj kiszűrése).
      const rawChanged = Math.abs((cur.rawDeltaDays - rawDays) * dayWidth) >= 0.5;
      const unchanged =
        !rawChanged
        && cur.deltaDays === snapped
        && cur.activated === activated
        && cur.targetLaneIndex === targetLaneIndex
        && pushedEqual;

      const next: DragState = unchanged
        ? cur
        : { ...cur, rawDeltaDays: rawDays, deltaDays: snapped, activated, pushed, targetLaneIndex };
      dragRef.current = next;
      if (!unchanged) setDrag(next);
    }

    function onMove(ev: PointerEvent) {
      pendingEv = ev;
      if (rafId == null) rafId = requestAnimationFrame(flush);
    }

    async function onUp() {
      // Cancel pending RAF, de ELŐTTE szinkron flush-oljunk egyet, hogy a
      // legutolsó pointermove (ami már RAF-ra várt, de még nem flushelt) a
      // dragRef.current-be kerüljön — különben akár 8-16 px-nyi sub-frame
      // pozíció elveszne a drop helyén.
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
        if (pendingEv) flush();
      }
      const cur = dragRef.current;
      if (!cur) return;
      const hasHorizontalChange = Math.abs(cur.deltaDays) > 1e-9;
      const hasLaneChange = cur.mode === 'move' && cur.targetLaneIndex !== cur.origLaneIndex;
      // Ha sosem aktiválódott (csak click), ne mentsünk; click handler fut le helyette.
      if (!cur.activated || (!hasHorizontalChange && !hasLaneChange)) {
        setDrag(null);
        dragRef.current = null;
        return;
      }
      // A drag aktivált — a böngésző mindjárt egy `click` event-et fog küldeni,
      // amit el kell nyelnünk, különben megnyílik a TaskModal.
      justDraggedRef.current = true;
      setTimeout(() => { justDraggedRef.current = false; }, 50);

      // Pre-compute az új start/duration/lane-t, hogy az optimistic SWR-mutate
      // a backend-hívás ELŐTT alkalmazza — így a setDrag(null) NEM teszi vissza
      // a bar-t a régi helyére, mert a cache már a célállapotot mutatja.
      const newStartIsoForDragged = hasHorizontalChange
        ? toStartDatePayload(
            shiftedStartDate(cur.origStartIso, cur.origTaskType, cur.deltaDays),
            cur.origTaskType,
          )
        : null;
      const newDurForDragged = cur.mode === 'resize' ? durationForResize(cur) : null;
      const newLaneForDragged = hasLaneChange ? cur.targetLaneIndex : null;

      // Push-cascade: szomszéd task-ok új startDate-jei előre kiszámolva
      const pushedStartIsoMap = new Map<string, string>();
      for (const [id, days] of Object.entries(cur.pushed)) {
        const target = tasksById.get(id);
        if (!target?.startDate) continue;
        pushedStartIsoMap.set(
          id,
          toStartDatePayload(shiftedStartDate(target.startDate, target.taskType, days), target.taskType),
        );
      }

      // Optimistic SWR-mutate: a cache-be írjuk a célállapotot, revalidate=false.
      // Ez a kulcs ahhoz, hogy a setDrag(null) UTÁN a bar a célhelyén álljon,
      // ne a régi origStartIso-n. A backend-hívás ezután fut, a `mutate()` a
      // végén pedig revalidálja — ha eltér, finom snap-transition igazítja.
      try {
        await onOptimisticMutate(cur.taskId, {
          newStartIso: newStartIsoForDragged,
          newDuration: newDurForDragged,
          newLaneIndex: newLaneForDragged,
          pushedStartIso: pushedStartIsoMap,
        });
      } catch {
        // Optimistic-mutate hibája nem fatális — fallback a mostani UI marad,
        // a backend-hívás úgyis még fut, és a végén `await onTaskMutate()`
        // mindenképp re-fetch-eli a friss állapotot.
      }

      // recentlyDropped guard: a drop UTÁN 250ms-ig transition: none, hogy
      // a backend lossy weekend-cross fixup ne rezegjen (lásd CSS / inline style).
      markRecentlyDropped(cur.taskId);

      // Most már nyugodtan null-ozhatjuk a drag-et — a cache a célállapotot adja.
      setDrag(null);
      dragRef.current = null;

      try {
        const pushUpdates = Object.entries(cur.pushed).map(([id, days]) => {
          const target = tasksById.get(id);
          if (!target?.startDate) return null;
          return updatePlanTask(id, {
            startDate: toStartDatePayload(shiftedStartDate(target.startDate, target.taskType, days), target.taskType),
          });
        }).filter(Boolean) as Promise<unknown>[];

        if (cur.mode === 'move') {
          const draggedPatch: Parameters<typeof updatePlanTask>[1] = {};
          if (hasHorizontalChange && newStartIsoForDragged) {
            draggedPatch.startDate = newStartIsoForDragged;
          }
          if (hasLaneChange) {
            draggedPatch.laneIndex = cur.targetLaneIndex;
          }
          const draggedUpdate = Object.keys(draggedPatch).length
            ? [updatePlanTask(cur.taskId, draggedPatch)]
            : [];
          await Promise.all([
            ...draggedUpdate,
            ...pushUpdates,
          ]);
        } else {
          // Resize. Pure inverseVisualWidthDays — semmi kerekítés, semmi
          // +0.5 fudge. Mid-week az inverz egzakt → round-trip exact, a
          // bar pontosan ott marad ahol elengedted. Weekend-keresztezésnél
          // a (cal_span ↔ working) mapping lossy, de ott is a legközelebbi
          // visszaképezhető működik (≤1 cella eltérés).
          const newDur = newDurForDragged ?? durationForResize(cur);
          await Promise.all([
            updatePlanTask(cur.taskId, {
              duration: newDur,
              durationChangeReason: 'Drag-átméretezés a Gantt-on',
            }),
            ...pushUpdates,
          ]);
        }
        await onTaskMutate();
      } catch (err: any) {
        toast.error(err?.response?.data?.message ?? 'Mozgatás sikertelen');
        // Ha mentés-hiba → re-fetch hogy a vizuális pozíció valódi DB-állapotot mutasson.
        // Az optimistic-mutate ezzel rollback-elődik a friss DB-állapotra.
        void onTaskMutate();
      }
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.taskId, drag?.mode, dayWidth]);

  // Click on empty track area (not on a task bar) → open new-task modal with
  // project + start date pre-filled. A vízszintes pozíció a daysBehind-tól indul.
  function handleTrackClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const cellIdx = Math.floor(x / dayWidth);
    const dayIdx = cellIdx - daysBehind; // today-tól számítva
    const clicked = offsetDate(dayIdx, today);
    onEmptyClick(plane.project.id, dateStr(clicked));
  }

  // Deadlines marked specifically for THIS project → red edge only on this row.
  const projectDeadlineDates = useMemo(() => {
    const set = new Set<string>();
    for (const a of overview.dayAnnotations) {
      if (a.type === 'hatarido' && a.projectId === plane.project.id) {
        set.add(a.date.slice(0, 10));
      }
    }
    return set;
  }, [overview.dayAnnotations, plane.project.id]);

  // Same logic for légtér: each project has its own permit windows in its own
  // location, so the start/end edges are only painted on the matching row.
  const projectLegterStartDates = useMemo(() => {
    const set = new Set<string>();
    for (const a of overview.dayAnnotations) {
      if (a.type === 'legter' && a.projectId === plane.project.id) {
        set.add(a.date.slice(0, 10));
      }
    }
    return set;
  }, [overview.dayAnnotations, plane.project.id]);
  const projectLegterEndDates = useMemo(() => {
    const set = new Set<string>();
    for (const a of overview.dayAnnotations) {
      if (a.type === 'legter' && a.projectId === plane.project.id) {
        const end = a.endDate?.slice(0, 10);
        // Single-day permit ⇒ start === end; range ⇒ end is the closing day.
        if (end) set.add(end);
        else set.add(a.date.slice(0, 10));
      }
    }
    return set;
  }, [overview.dayAnnotations, plane.project.id]);

  // Scheduled ping-ek erre a projektre (időzített értesítés/emlékeztető).
  // A Gantt-on a `scheduledFor` napon kis 🔔 ikon jelenik meg, kattintásra
  // a `PingPopover` mutatja a címzettet + üzenetet.
  const projectPings = useMemo(() => {
    const arr = (overview.scheduledPings ?? []).filter(p => p.projectId === plane.project.id);
    return arr;
  }, [overview.scheduledPings, plane.project.id]);

  // Subtle project-colour wash — the eye can trace a bar back to its row name.
  // ~10% opacity on white keeps it visible without competing with the task bars.
  const rowTint = plane.color + '1a'; // 1a = 26/255 ≈ 10%

  const isBeingDragged = draggingProjectId === plane.project.id;

  return (
    <div className={styles.row} style={{ height: rowH }} data-flip-key={plane.project.id}>
      <button
        type="button"
        className={clsx(styles.rowLabel, isBeingDragged && styles.dragging)}
        style={{ height: rowH, backgroundColor: rowTint }}
        onClick={() => onProjectClick(plane.project)}
        draggable={rowDraggable}
        onDragStart={(e) => {
          if (!rowDraggable) return;
          e.dataTransfer.setData('text/plain', plane.project.id);
          e.dataTransfer.effectAllowed = 'move';
          onProjectDragStart(plane.project.id);
        }}
        onDragOver={(e) => {
          if (draggingProjectId && draggingProjectId !== plane.project.id) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            // Élő reorder midpoint-alapú insertion-nel: a kurzor Y-pozícióját
            // a sor felső/alsó feléhez viszonyítjuk → stabil insertion-target,
            // nincs vissza-oszcilláció többsávos projekteknél.
            const rect = e.currentTarget.getBoundingClientRect();
            onProjectDragOver(plane.project.id, e.clientY, rect.top, rect.height);
          }
        }}
        onDrop={(e) => {
          if (!rowDraggable) return;
          e.preventDefault();
          // Drop nem közvetlenül kommitál — az onDragEnd kezelő küldi
          // el a backendnek a végleges sorrendet (ami a pendingOrderIds-ben
          // van addigra élőben felépítve).
        }}
        onDragEnd={() => onProjectDragEnd()}
        title={rowDraggable ? `${plane.project.name} — húzd fel/le a sorrendezéshez` : plane.project.name}
      >
        <div className={styles.rowColor} style={{ height: 28, background: plane.color }} />
        <span className={styles.rowName}>{plane.project.name}</span>
      </button>
      {/* Dedikált chevron-oszlop: fix hely a rowLabel és a rowTracks között, hogy
          a hover-expand miatti rowLabel-szélesedés ne mozgassa a gombot. */}
      <button
        type="button"
        className={clsx(
          styles.chevronColumn,
          plane.numLanes <= 1 && styles.chevronDisabled,
        )}
        style={{ height: rowH }}
        onClick={() => {
          if (plane.numLanes <= 1) return;
          onToggleCollapse(plane.project.id);
        }}
        disabled={plane.numLanes <= 1}
        title={
          plane.numLanes <= 1
            ? 'Egysávos projekt — nincs mit becsukni'
            : effectiveCollapsed
              ? `Kinyitás (+${hiddenLaneCount} rejtett sáv, ${hiddenTaskCount} task)`
              : 'Sávok becsukása'
        }
        aria-label="Sávok kinyitása/becsukása"
      >
        {effectiveCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      <div
        className={styles.rowTracks}
        data-project-id={plane.project.id}
        style={{ width: totalDays * dayWidth, height: rowH, backgroundColor: rowTint }}
        onClick={handleTrackClick}
        title="Kattints üres helyre új task hozzáadásához"
      >
        {days.map((d, i) => (
          <div
            key={d.iso}
            className={clsx(
              styles.colBg,
              d.isWeekend && styles.weekend,
              d.isToday && styles.today,
              d.isPast && styles.past,
              d.hasMunkaszunet && styles.munkaszunet,
              projectDeadlineDates.has(d.iso) && styles.hatarido,
              projectLegterStartDates.has(d.iso) && styles.legterStart,
              projectLegterEndDates.has(d.iso) && styles.legterEnd,
            )}
            style={{ left: i * dayWidth }}
          />
        ))}
        {drag?.activated && drag.mode === 'move' && Array.from({ length: visibleLaneCount }).map((_, laneIdx) => (
          <div
            key={`lane-guide-${laneIdx}`}
            className={clsx(styles.laneGuide, laneIdx === drag.targetLaneIndex && styles.laneGuideActive)}
            style={{ top: laneIdx * LANE_H, height: LANE_H }}
          />
        ))}
        {/* Rejtett task-ok időintervallum-csíkja a látható sáv ALATT.
            Ha a projekt collapsed és vannak további lane-ek, minden rejtett
            task egy keskeny csíkként jelölődik az intervallumában a 0. sáv
            alján — vizuális emlékeztető, hogy a kinyitás után pontosan hol
            lesz párhuzamos task. A szín a task-type szerint, fallback amber. */}
        {effectiveCollapsed && hiddenTasks.map(t => {
          if (!t.startDate) return null;
          const taskStart = parseDate(t.startDate);
          const isGepido = t.taskType === 'gepido';
          const workingDays = Number(t.duration ?? 1);
          const widthDays = isGepido ? workingDays : visualWidthDays(taskStart, workingDays);
          const cellLeft = diffDays(taskStart, today) + daysBehind;
          if (cellLeft + widthDays < 0 || cellLeft > daysAhead + daysBehind) return null;
          const clampedLeft = Math.max(0, cellLeft);
          const clampedRight = Math.min(daysAhead + daysBehind, cellLeft + widthDays);
          const widthPx = (clampedRight - clampedLeft) * dayWidth - 2;
          if (widthPx <= 0) return null;
          const stripColor = getTaskTypeColor(taskTypes, t.taskType) ?? '#f59e0b';
          return (
            <div
              key={`hint-${t.id}`}
              className={styles.hiddenTaskHint}
              style={{
                left: clampedLeft * dayWidth + 1,
                width: widthPx,
                top: LANE_H - 4,
                background: stripColor,
              }}
              title={`${t.title || '(cím nélkül)'} — rejtett ${(t._laneIdx ?? 0) + 1}. sávban. Kattints a chevronra a kinyitáshoz.`}
            />
          );
        })}
        {/* Drop-rángatás végleges fix: ha a SWR refresh már beérkezett
            (a dragged task startDate/duration-je már a céllá változott
            az adatban), NE alkalmazzuk a drag-offsetet — különben a bar
            duplázza az eltolást és visszaanimálódik. A push-cascade-et
            ugyanígy semmibe vesszük, hogy a szomszédok is ne duplázzanak. */}
        {(() => {
          const draggedTask = drag ? tasksById.get(drag.taskId) : null;
          const dataAlreadyApplied = !!(drag && draggedTask && (
            draggedTask.startDate !== drag.origStartIso ||
            Number(draggedTask.duration ?? 1) !== drag.origDurationDays
          ));
          return flatTasks.map(task => {
          const status = computeVisualStatus(task, today, slippingIds);
          const warnings = getTaskWarnings(task, overview.people, overview.equipment, overview.tasks, overview.dayAnnotations, overview.projects).length;
          const isDragged = drag?.taskId === task.id && drag.activated && !dataAlreadyApplied;
          const isPushed = !isDragged && drag?.activated && !dataAlreadyApplied && drag.pushed[task.id] != null;
          // A húzott bar a nyers deltát követi (sima 1:1), a tolt szomszédok a
          // snappelt push-értéket (diszkrét lépés — vizuális snap-visszajelzés).
          const dragOffsetForThis = isDragged ? drag!.rawDeltaDays : isPushed ? drag!.pushed[task.id] : 0;
          const dragModeForThis = isDragged ? drag!.mode : null;
          const laneOffsetPx = isDragged ? (drag!.targetLaneIndex - drag!.origLaneIndex) * LANE_H : 0;
          return (
            <TaskBar
              key={task.id}
              task={task}
              project={plane.project}
              people={overview.people}
              equipment={overview.equipment}
              today={today}
              laneIdx={task._laneIdx}
              laneOffsetPx={laneOffsetPx}
              status={status}
              warnings={warnings}
              dayWidth={dayWidth}
              daysAhead={daysAhead}
              daysBehind={daysBehind}
              dragOffsetDays={dragOffsetForThis}
              dragMode={dragModeForThis}
              onMoveDown={e => startDrag(e, task, 'move')}
              onResizeDown={e => startDrag(e, task, 'resize')}
              onClick={() => onTaskClick(task)}
              onToggleDone={async () => {
                const next = task.status === 'completed' ? 'in_progress' : 'completed';
                try {
                  await updatePlanTask(task.id, { status: next });
                  await onTaskMutate();
                  toast.success(next === 'completed' ? 'Task késznek jelölve' : 'Task visszaállítva folyamatban-ra');
                } catch (err: any) {
                  toast.error(err?.response?.data?.message ?? 'Mentés sikertelen');
                }
              }}
              isDragging={isDragged}
              isPushed={isPushed}
              taskTypes={taskTypes}
              recentlyDropped={recentlyDroppedId === task.id}
            />
          );
        });
        })()}
        {/* Időzített ping-ek a projekt során. Egy kis sárga csengő-ikon a
            scheduledFor napján; kattintásra popover Kit / Mikor / Üzenettel. */}
        {projectPings.map(ping => {
          const pingDate = new Date(ping.scheduledFor);
          const cellLeft = diffDays(pingDate, today) + daysBehind;
          if (cellLeft < 0 || cellLeft > daysAhead + daysBehind) return null;
          return (
            <PingMarker
              key={ping.id}
              ping={ping}
              people={overview.people}
              left={cellLeft * dayWidth + dayWidth / 2 - 9}
              top={2}
              isOpen={openPingId === ping.id}
              onOpen={() => onOpenPing(ping.id)}
              onClose={() => onOpenPing(null)}
              onSendNow={async (id) => { await apiSendNowPing(id); await onTaskMutate(); }}
              onCancel={async (id) => { await apiCancelPing(id); await onTaskMutate(); }}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Időzített ping ikon a Gantt projekt-soron. Hover-en tooltip (cím),
 * kattintáskor a teljes üzenet egy kis popoverben.
 */
function PingMarker({
  ping, people, left, top, isOpen, onOpen, onClose, onSendNow, onCancel,
}: {
  ping: { id: string; userId: string; scheduledFor: string; title: string; body?: string };
  people: DashboardPerson[];
  left: number;
  top: number;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSendNow: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Outside-click + ESC bezárás. A button-ra való kattintás NEM számít
  // outside-nak (különben a saját triggerünk azonnal záraná).
  useEffect(() => {
    if (!isOpen) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);
  const recipient = people.find(p => p.id === ping.userId);
  const recipientName = recipient ? `${recipient.firstName} ${recipient.lastName}` : '(ismeretlen)';
  const dateStr = new Date(ping.scheduledFor).toLocaleString('hu-HU', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  async function handleSendNow() {
    setBusy(true);
    try {
      await onSendNow(ping.id);
      toast.success('Értesítés elküldve');
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      const status = err?.response?.status;
      if (status === 409) {
        onClose();
      } else {
        toast.error(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Küldés sikertelen'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    try {
      await onCancel(ping.id);
      toast.success('Harang törölve');
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Törlés sikertelen'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        title={`🔔 ${recipientName} — ${ping.title}`}
        style={{
          position: 'absolute', left, top, width: 18, height: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%', background: '#fbbf24', color: '#78350f',
          border: '1.5px solid #d97706', cursor: 'pointer', fontSize: 11,
          padding: 0, zIndex: 5,
        }}
        aria-label={`Időzített értesítés: ${ping.title}`}
      >
        🔔
      </button>
      {isOpen && (
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', left: Math.max(8, left - 120), top: top + 22,
            background: '#fff', border: '1px solid #d1d5db',
            borderRadius: 8, padding: 12, minWidth: 280, maxWidth: 360,
            boxShadow: '0 8px 20px rgba(0,0,0,0.15)', zIndex: 50,
            fontSize: 13, color: '#111827',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <strong style={{ fontSize: 14 }}>🔔 Időzített értesítés</strong>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 0, fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>Kinek</div>
          <div>{recipientName}</div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>Mikor</div>
          <div>{dateStr}</div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>Üzenet</div>
          <div style={{ fontWeight: 600 }}>{ping.title}</div>
          {ping.body && <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', color: '#374151' }}>{ping.body}</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <button
              type="button"
              onClick={handleSendNow}
              disabled={busy}
              style={{
                flex: 1, padding: '6px 10px', borderRadius: 6,
                background: '#16a34a', color: '#fff', border: 'none',
                cursor: busy ? 'default' : 'pointer', fontSize: 12, fontWeight: 600,
                opacity: busy ? 0.6 : 1,
              }}
              title="Küldd most (azonnal aktiválja az értesítést)"
            >
              📨 Küldd most
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy}
              style={{
                padding: '6px 10px', borderRadius: 6,
                background: '#fee2e2', color: '#991b1b',
                border: '1px solid #fca5a5', cursor: busy ? 'default' : 'pointer',
                fontSize: 12, fontWeight: 600, opacity: busy ? 0.6 : 1,
              }}
              title="Töröld (a cron sem fogja kiküldeni)"
            >
              🗑 Töröld
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ── TASK MODAL ────────────────────────────────────────────── */
function TaskModal({
  task,
  overview,
  onClose,
  onSaved,
  onNavigate,
  onContinue,
  onTemplateFallback,
}: {
  task: DashboardTask | null;
  overview: DashboardOverview;
  onClose: () => void;
  onSaved: () => void;
  onNavigate: (t: DashboardTask) => void;
  onContinue: (projectId: string, startDate: string) => void;
  /** Ha a "+ Sablon-task" megnyomásakor nincs még template-szabály a current
   *  task title-jéhez, e helyett egy üres NewTaskModal nyílik sárga kerettel
   *  + 'Mentés sablonként' gombbal — így a felhasználók a gyakorlatból tudnak
   *  sablon-szabályt felvenni, nem csak az admin felületen. */
  onTemplateFallback: (projectId: string, startDate: string, fromTaskTitle: string, offsetDays: number) => void;
}) {
  const t = useT();
  const tm = t.meeting.taskModal;
  const { taskTypes } = useTaskTypes();
  const [form, setForm] = useState({
    title: '',
    taskType: 'terep',
    assignedTo: '',
    helpers: [] as string[],
    startDate: '',
    duration: 1,
    equipmentIds: [] as string[],
    status: 'pending' as DashboardTaskStatus,
    dependsOnId: '',
    durationChangeReason: '',
  });
  const [saving, setSaving] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);

  useEffect(() => {
    if (!task) return;
    setForm({
      title: task.title,
      taskType: task.taskType,
      assignedTo: task.assignedTo ?? '',
      helpers: task.helpers ?? [],
      startDate: task.startDate?.slice(0, 10) ?? dateStr(startOfToday()),
      duration: task.duration ?? 1,
      equipmentIds: task.equipmentIds ?? [],
      status: task.status,
      dependsOnId: task.dependsOnId ?? '',
      durationChangeReason: '',
    });
  }, [task]);

  // Hooks MUST be called unconditionally (rules-of-hooks). Compute task-derived
  // values via optional chaining; the early return below skips render only.
  const taskProjectId = task?.projectId;
  const taskId = task?.id;

  const siblings = useMemo(
    () => taskProjectId
      ? overview.tasks
          .filter(t => t.projectId === taskProjectId && t.startDate)
          .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))
      : [],
    [overview.tasks, taskProjectId],
  );

  const busyMap = useMemo(() => {
    const m = new Map<string, string>(); // personId -> reason
    if (!form.startDate || !taskId) return m;
    const day = form.startDate.slice(0, 10);
    const inactiveProjectIds = new Set(
      overview.projects.filter(p => p.state === 'archived' || p.state === 'cancelled').map(p => p.id),
    );
    for (const t of overview.tasks) {
      if (t.id === taskId) continue;
      if (t.status === 'completed' || t.status === 'cancelled') continue;
      if (t.projectId && inactiveProjectIds.has(t.projectId)) continue;
      const s = (t.startDate ?? '').slice(0, 10);
      const e = (t.endDate   ?? s).slice(0, 10);
      if (!s) continue;
      if (day >= s && day <= e) {
        const involved = [
          ...(t.assignedTo ? [t.assignedTo] : []),
          ...(t.helpers ?? []),
        ];
        for (const pid of involved) {
          if (!m.has(pid)) m.set(pid, t.title || 'más task');
        }
      }
    }
    for (const a of overview.dayAnnotations) {
      if (a.type === 'szabadsag' && a.personId && a.date.slice(0, 10) === day) {
        m.set(a.personId, 'szabadságon');
      }
    }
    return m;
  }, [form.startDate, overview.tasks, overview.dayAnnotations, overview.projects, taskId]);

  if (!task) return null;
  const currentTask = task;
  const project = overview.projects.find(p => p.id === currentTask.projectId);

  const currentIdx = siblings.findIndex(t => t.id === currentTask.id);
  const prevTask = currentIdx > 0 ? siblings[currentIdx - 1] : null;
  const nextTask = currentIdx >= 0 && currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;

  const warnings = getTaskWarnings(
    { ...task, ...form, equipmentIds: form.equipmentIds, assignedTo: form.assignedTo || undefined, dependsOnId: form.dependsOnId || undefined },
    overview.people, overview.equipment, overview.tasks, overview.dayAnnotations, overview.projects,
  );

  function toggleEquipment(id: string) {
    setForm(f => ({
      ...f,
      equipmentIds: f.equipmentIds.includes(id) ? f.equipmentIds.filter(x => x !== id) : [...f.equipmentIds, id],
    }));
  }

  async function save(continueChain: boolean = false) {
    // Hétvége szabály: csak gepido task lehet hétvégén.
    const startDow = parseDate(form.startDate).getDay();
    if ((startDow === 0 || startDow === 6) && form.taskType !== 'gepido') {
      alert(tm.weekendAlert);
      return;
    }
    setSaving(true);
    try {
      await updatePlanTask(currentTask.id, {
        title: form.title,
        taskType: form.taskType,
        assignedTo: form.assignedTo || null,
        helpers: form.helpers,
        startDate: new Date(form.startDate).toISOString(),
        duration: form.duration,
        durationChangeReason: form.durationChangeReason || undefined,
        equipmentIds: form.equipmentIds,
        dependsOnId: form.dependsOnId || null,
        status: form.status,
      });
      onSaved();
      if (continueChain && currentTask.projectId) {
        // Folytatás: bezárjuk a modalt, és a parent megnyit egy NewTaskModal-t
        // ugyanazon a projekten, az aktuális task vége utáni napon.
        const next = parseDate(form.startDate);
        const days = Math.max(1, Math.ceil(form.duration));
        next.setDate(next.getDate() + days);
        if (form.taskType !== 'gepido') {
          while (next.getDay() === 0 || next.getDay() === 6) {
            next.setDate(next.getDate() + 1);
          }
        }
        onContinue(currentTask.projectId, dateStr(next));
      } else {
        onClose();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? tm.saveFail);
    } finally {
      setSaving(false);
    }
  }

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  async function handleDelete() {
    // Inline-confirm pattern: az első kattintáskor a gomb állapotot vált
    // (deleteConfirm=true), a második kattintás a tényleges törlést indítja.
    // Ez univerzálisan működik, mert nem natív `confirm()`-dialógusra alapoz,
    // amit egyes deployment-környezetek (HTTPS+szigorú CSP) blokkolhatnak.
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 4000);
      return;
    }
    setSaving(true);
    try {
      await deletePlanTask(currentTask.id);
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? tm.deleteFail);
    } finally {
      setSaving(false);
      setDeleteConfirm(false);
    }
  }

  return (
    <div className={styles.modalBg} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <div style={{ flex: 1 }}>
            <div className={styles.modalSub}>{tm.projectLabel}</div>
            <div className={styles.modalTitle} style={{ fontSize: 20 }}>{project?.name ?? '—'}</div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {warnings.length > 0 && (
          <div className={styles.warningsBox}>
            <div className={styles.warningsTitle}>{tm.warnings(warnings.length)}</div>
            {warnings.map((w, i) => <div key={i} className={styles.warningItem}>{w}</div>)}
          </div>
        )}

        {/* Ki — emberek + PC munkaállomások egy listában. Esemény-szerű task-típusoknál
            (gepido, számlázás, TIG, várható kifizetés) opcionális — a placeholder
            jelzi, hogy nem kötelező, de mégis választható személy. */}
        <div className={styles.formRow}>
          <div className={styles.formLabel}>
            {tm.whoLabel}{isUnassignedTaskType(taskTypes, form.taskType) && (
              <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>
                {tm.whoOptionalHint}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <select
              className={styles.formSelect}
              value={form.assignedTo}
              onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
              style={{ flex: 1 }}
            >
              <option value="">
                {isUnassignedTaskType(taskTypes, form.taskType)
                  ? tm.whoEventPlaceholder
                  : tm.whoFreePlaceholder}
              </option>
              <optgroup label={tm.groupPeople}>
                {/* Ember-opciók: csak a név (a rang/aktuális foglaltság szándékosan kihagyva — a user
                    explicit kérése: kevesebb zaj). Eszköz-mezőket (Munkaállomások) NEM érintünk. */}
                {overview.people.filter(p => p.role !== 'Munkaállomás').map(p => (
                  <option key={p.id} value={p.id}>{personName(p)}</option>
                ))}
              </optgroup>
              <optgroup label={tm.groupStations}>
                {overview.people.filter(p => p.role === 'Munkaállomás').map(p => {
                  const busy = busyMap.get(p.id);
                  return (
                    <option key={p.id} value={p.id}>
                      {busy ? '⚠️ ' : ''}💻 {p.firstName}{busy ? ` (${busy})` : ''}
                    </option>
                  );
                })}
              </optgroup>
            </select>
            {form.assignedTo && busyMap.has(form.assignedTo) && (
              <span
                title={tm.busyTitle(busyMap.get(form.assignedTo) ?? '')}
                aria-label={tm.busyAria}
                style={{ display: 'inline-flex', flexShrink: 0 }}
              >
                <AlertTriangle size={14} color="#f59e0b" />
              </span>
            )}
          </div>
        </div>

        {/* Mit */}
        <div className={styles.formRow}>
          <div className={styles.formLabel}>{tm.whatLabel}</div>
          <select className={styles.formSelect} value={form.taskType} onChange={e => setForm(f => ({ ...f, taskType: e.target.value, assignedTo: isUnassignedTaskType(taskTypes, e.target.value) ? '' : f.assignedTo }))}>
            {(taskTypes ?? []).map(tt => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
            {/* Fallback: ha a task taskType-ja már nincs a listában, ne tűnjön el a value */}
            {form.taskType && !taskTypes?.some(tt => tt.value === form.taskType) && (
              <option value={form.taskType}>{form.taskType} {tm.deletedSuffix}</option>
            )}
          </select>
        </div>

        {/* További érintettek (helpers) — collapse-olható szekció */}
        <HelpersField
          assignedTo={form.assignedTo}
          helpers={form.helpers}
          people={overview.people}
          busyMap={busyMap}
          onChange={hs => setForm(f => ({ ...f, helpers: hs }))}
        />

        {/* Mivel (eszközök) — collapse-olható szekció. Default: Semmivel.
            Lenyitva: chip-mátrix; visszacsukva: csak az aktívak látszanak. */}
        <EquipmentField
          equipmentIds={form.equipmentIds}
          equipment={overview.equipment}
          onToggle={toggleEquipment}
        />

        {/* Időpont */}
        <div className={styles.formRow}>
          <div className={styles.formLabel}>{tm.whenLabel}</div>
          <div className={styles.formRowInline}>
            <input
              type="date"
              className={styles.formInput}
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              style={{ flex: 2 }}
            />
            {form.taskType === 'gepido' ? (
              <input
                type="number" step={1} min={1}
                className={styles.formInput}
                value={Math.round((form.duration ?? 0) * 24)}
                onChange={e => setForm(f => ({ ...f, duration: (parseInt(e.target.value, 10) || 1) / 24 }))}
                title={tm.hoursTitle}
              />
            ) : (
              <input
                type="number" step={0.5} min={0.5}
                className={styles.formInput}
                value={form.duration}
                onChange={e => setForm(f => ({ ...f, duration: parseFloat(e.target.value) || 0.5 }))}
                title={tm.workdaysTitle}
              />
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>
              {form.taskType === 'gepido'
                ? tm.hoursSummary(Math.round((form.duration ?? 0) * 24))
                : tm.workdaysSummary(form.duration, form.startDate ? fmtEndDate(form.startDate, form.duration) : '—')}
            </span>
            <button
              type="button"
              onClick={() => setShowRevisions(true)}
              style={{
                marginLeft: 'auto', fontSize: 11, color: 'var(--today)',
                background: 'none', border: 'none', cursor: 'pointer',
                textDecoration: 'underline', padding: 0,
              }}
              title={tm.historyTitle}
            >
              {tm.historyButton}
            </button>
          </div>
          {form.duration !== currentTask.duration && (
            <input
              type="text"
              value={form.durationChangeReason}
              onChange={e => setForm(f => ({ ...f, durationChangeReason: e.target.value }))}
              placeholder={tm.durationReasonPh}
              maxLength={500}
              style={{
                width: '100%', marginTop: 6, padding: '6px 8px',
                fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6,
              }}
            />
          )}
        </div>

        {showRevisions && (
          <DurationRevisionHistory
            taskId={currentTask.id}
            isGepido={form.taskType === 'gepido'}
            onClose={() => setShowRevisions(false)}
          />
        )}

        {/* Kapcsolódó task */}
        <div className={styles.formRow}>
          <div className={styles.formLabel}>{tm.relatedTaskLabel}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={styles.switchBtn}
              disabled={!prevTask}
              onClick={() => prevTask && onNavigate(prevTask)}
              title={prevTask ? prevTask.title : tm.noPrevTask}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              {tm.prevTaskBtn} {prevTask && <span style={{ opacity: 0.6, marginLeft: 4 }}>· {prevTask.title}</span>}
            </button>
            {nextTask ? (
              <button
                type="button"
                className={styles.switchBtn}
                onClick={() => onNavigate(nextTask)}
                title={nextTask.title}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {tm.nextTaskBtn} <span style={{ opacity: 0.6, marginLeft: 4 }}>· {nextTask.title}</span>
              </button>
            ) : (
              <button
                type="button"
                className={styles.switchBtn}
                onClick={async () => {
                  try {
                    const res = await generateNextFromTemplate(currentTask.id);
                    if (res.created) {
                      onSaved();
                      onClose();
                      return;
                    }
                    // Nincs még szabály — fallback: sárga keretes üres task a következő munkanapra,
                    // 'Mentés sablonként' gombbal. A user a gyakorlatból veszi fel a szabályt.
                    if (currentTask.projectId) {
                      const baseEndIso = currentTask.endDate ?? currentTask.startDate ?? new Date().toISOString();
                      const next = new Date(baseEndIso);
                      next.setDate(next.getDate() + 1);
                      // Ha gépidő, marad ahol van; egyébként ugrik hétfőre.
                      if (currentTask.taskType !== 'gepido') {
                        while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
                      }
                      onTemplateFallback(
                        currentTask.projectId,
                        dateStr(next),
                        currentTask.title,
                        1, // offsetDays — egy nap default; az admin kézzel finomíthatja
                      );
                    }
                  } catch (err: any) {
                    alert(err?.response?.data?.message ?? tm.templateCreateFail);
                  }
                }}
                title={tm.templateTaskTitle}
                style={{ flex: 1, justifyContent: 'center', borderStyle: 'dashed' }}
              >
                {tm.templateTaskBtn}
              </button>
            )}
          </div>
          {siblings.length > 1 && (
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, textAlign: 'center' }}>
              {tm.siblingsCounter(currentIdx + 1, siblings.length)}
            </div>
          )}
        </div>

        {/* Konkrétum */}
        <div className={styles.formRow}>
          <div className={styles.formLabel}>{tm.konkretumLabel}</div>
          <input
            className={styles.formInput}
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder={tm.konkretumPh}
          />
        </div>

        {/* Status hidden chip row: only show when not default, or "Kész" marker */}
        {(form.status === 'completed' || form.status === 'cancelled') && (
          <div className={styles.formRow}>
            <div className={styles.formLabel}>{tm.statusLabel}</div>
            <div className={styles.chipList}>
              {(['pending', 'in_progress', 'completed', 'cancelled'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  className={clsx(styles.chip, form.status === s && styles.on)}
                  onClick={() => setForm(f => ({ ...f, status: s }))}
                >{s === 'pending' ? tm.statusPending : s === 'in_progress' ? tm.statusInProgress : s === 'completed' ? tm.statusDone : tm.statusCancelled}</button>
              ))}
            </div>
          </div>
        )}
        {form.status !== 'completed' && form.status !== 'cancelled' && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, status: 'completed' }))}
              className={styles.switchBtn}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              {tm.markDoneBtn}
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={() => save(true)}
            disabled={saving}
            title={tm.saveAndContinueTitle}
            style={{ flex: 1, background: '#0284c7' }}
          >
            {saving ? tm.savingShort : tm.saveAndContinueBtn}
          </button>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={() => save(false)}
            disabled={saving}
            style={{ flex: 1 }}
          >
            {saving ? tm.saving : tm.save}
          </button>
        </div>
        {task?.status === 'draft' && (
          <button
            type="button"
            onClick={async () => {
              if (!task) return;
              setSaving(true);
              try {
                await apiClient.post(`/crm-tasks/${task.id}/finalize`);
                toast.success(tm.finalizeSuccess);
                onSaved();
                onClose();
              } catch (err: any) {
                toast.error(err?.response?.data?.message ?? tm.finalizeFail);
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            style={{
              padding: '8px 12px', borderRadius: 6, marginTop: 8,
              background: '#f59e0b', color: 'white', border: 'none',
              fontWeight: 600, cursor: 'pointer', width: '100%',
            }}
            title={tm.finalizeTitle}
          >
            {tm.finalizeBtn}
          </button>
        )}
        <button
          className={styles.deleteBtn}
          onClick={handleDelete}
          disabled={saving}
          style={deleteConfirm ? { background: 'rgba(220, 38, 38, 0.12)', borderColor: 'var(--red)', fontWeight: 700 } : undefined}
        >
          {deleteConfirm ? tm.deleteConfirm : tm.deleteBtn}
        </button>
      </div>
    </div>
  );
}

function fmtEndDate(startIso: string, workingDays: number): string {
  const start = parseDate(startIso);
  const end = addWorkingDays(start, workingDays);
  return `${end.getFullYear()}.${String(end.getMonth() + 1).padStart(2, '0')}.${String(end.getDate()).padStart(2, '0')}`;
}

/* ── EQUIPMENT FIELD (collapse-able) ──────────────────────── */
function EquipmentField({
  equipmentIds, equipment, onToggle,
}: {
  equipmentIds: string[];
  equipment: DashboardEquipment[];
  onToggle: (id: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const selected = equipment.filter(e => equipmentIds.includes(e.id));
  const summary = selected.length === 0
    ? t.meeting.equipmentField.summaryNone
    : selected.length <= 2
      ? selected.map(e => e.name).join(', ')
      : t.meeting.equipmentField.summaryCountMany(selected.length);

  return (
    <div className={styles.formRow}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', padding: 0,
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span className={styles.formLabel} style={{ marginBottom: 0 }}>
          {t.meeting.equipmentField.label} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {summary}</span>
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)', transition: 'transform 0.15s' }}>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {!open && selected.length > 0 && (
        <div className={styles.chipList} style={{ marginTop: 6 }}>
          {selected.map(eq => (
            <span key={eq.id} className={clsx(styles.chip, styles.on)} style={{ pointerEvents: 'none' }}>
              {eq.name}
            </span>
          ))}
        </div>
      )}
      {open && (
        <div
          style={{
            marginTop: 6, padding: '8px',
            background: 'rgba(0,0,0,0.02)', borderRadius: 6,
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {equipment.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
              {t.meeting.equipmentField.noEquipmentPrefix} <Link href="/meeting/admin" style={{ color: 'var(--today)' }}>{t.meeting.equipmentField.noEquipmentLinkText}</Link>{t.meeting.equipmentField.noEquipmentSuffix}
            </div>
          ) : (
            <div className={styles.chipList}>
              {equipment.map(eq => {
                const isSelected = equipmentIds.includes(eq.id);
                return (
                  <button
                    key={eq.id}
                    type="button"
                    className={clsx(styles.chip, isSelected && styles.on)}
                    onClick={() => onToggle(eq.id)}
                  >{eq.name}</button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── HELPERS FIELD (collapse-able) ──────────────────────── */
function HelpersField({
  assignedTo, helpers, people, busyMap, onChange,
}: {
  assignedTo: string;
  helpers: string[];
  people: DashboardPerson[];
  busyMap: Map<string, string>;
  onChange: (h: string[]) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const summary = helpers.length === 0
    ? t.meeting.helpersField.summaryNone
    : helpers.length <= 2
      ? helpers.map(id => people.find(p => p.id === id)).filter(Boolean).map(p => personName(p!)).join(', ')
      : t.meeting.helpersField.summaryCountMany(helpers.length);

  return (
    <div className={styles.formRow}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', padding: 0,
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span className={styles.formLabel} style={{ marginBottom: 0 }}>
          {t.meeting.helpersField.label} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {summary}</span>
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)', transition: 'transform 0.15s' }}>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', gap: 4,
            marginTop: 6, padding: '8px',
            background: 'rgba(0,0,0,0.02)', borderRadius: 6,
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {people.map(p => {
            const checked = helpers.includes(p.id);
            const isAssignee = assignedTo === p.id;
            const busy = busyMap.get(p.id);
            return (
              <button
                key={p.id}
                type="button"
                disabled={isAssignee}
                onClick={() => onChange(checked ? helpers.filter(x => x !== p.id) : [...helpers, p.id])}
                title={isAssignee ? t.meeting.helpersField.alreadyAssignee : busy ? t.meeting.helpersField.busyTooltip(busy) : ''}
                className={clsx(styles.chip, checked && styles.on)}
                style={isAssignee ? { opacity: 0.4, cursor: 'not-allowed' } : busy ? { borderColor: 'var(--yellow)' } : undefined}
              >
                {personName(p)}
              </button>
            );
          })}
          {helpers.length > 0 && (
            <div style={{ flexBasis: '100%', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              {t.meeting.helpersField.helpersHint(helpers.length)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── DURATION REVISION HISTORY ───────────────────────────── */
function DurationRevisionHistory({
  taskId, isGepido, onClose,
}: {
  taskId: string;
  isGepido: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const [items, setItems] = useState<TaskDurationRevision[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    fetchTaskDurationRevisions(taskId)
      .then(d => { if (!aborted) setItems(d); })
      .catch(e => { if (!aborted) setError(e?.response?.data?.message ?? t.meeting.durationHistory.loadFailDefault); });
    return () => { aborted = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const fmt = (days: number | null | undefined) => {
    if (days == null) return t.meeting.durationHistory.dash;
    return isGepido
      ? t.meeting.durationHistory.hoursUnit((days * 24).toFixed(1))
      : t.meeting.durationHistory.daysUnit(Number(days).toFixed(2));
  };

  const sumDelta = items
    ? items.reduce((s, r) => s + Number(r.deltaDays), 0)
    : 0;

  return (
    <div className={styles.modalBg} onClick={onClose} style={{ zIndex: 60 }}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className={styles.modalHead}>
          <div>
            <div className={styles.modalSub}>{t.meeting.durationHistory.subTitle}</div>
            <div className={styles.modalTitle}>{isGepido ? t.meeting.durationHistory.gepidoTitle : t.meeting.durationHistory.durationTitle}</div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {error && <div style={{ color: '#dc2626', fontSize: 12, padding: 12 }}>{error}</div>}
        {!items && !error && <div style={{ fontSize: 12, color: 'var(--muted)', padding: 12 }}>{t.meeting.durationHistory.loading}</div>}

        {items && items.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--muted)', padding: 16, textAlign: 'center' }}>
            {t.meeting.durationHistory.empty}
          </div>
        )}

        {items && items.length > 0 && (
          <>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
              padding: '12px 0', borderBottom: '1px solid #e5e7eb',
            }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t.meeting.durationHistory.statRevisions}</div>
                <div style={{ fontSize: 22, fontWeight: 600 }}>{items.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t.meeting.durationHistory.statTotalDelta}</div>
                <div style={{
                  fontSize: 22, fontWeight: 600,
                  color: sumDelta > 0 ? '#dc2626' : sumDelta < 0 ? '#10b981' : 'inherit',
                }}>
                  {sumDelta > 0 ? '+' : ''}{fmt(sumDelta)}
                </div>
              </div>
            </div>

            <ol style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 320, overflowY: 'auto' }}>
              {items.map(r => {
                const delta = Number(r.deltaDays);
                const dir = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
                const color = delta > 0 ? '#dc2626' : delta < 0 ? '#10b981' : 'var(--muted)';
                return (
                  <li key={r.id} style={{
                    padding: '10px 0', borderBottom: '1px solid #f3f4f6',
                    fontSize: 13,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ color, fontWeight: 600, fontFamily: 'monospace' }}>
                        {dir} {delta > 0 ? '+' : ''}{fmt(delta)}
                      </span>
                      <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                        {fmt(r.oldDurationDays)} → {fmt(r.newDurationDays)}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
                        {new Date(r.changedAt).toLocaleString('hu-HU')}
                      </span>
                    </div>
                    {r.reason && (
                      <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                        „{r.reason}”
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

/* ── DAY MODAL ──────────────────────────────────────────────
 *  A DAY_TYPE_LABEL típus-cimkék i18n-elve a `t.meeting.dayModal.dayTypeLabels`
 *  alatt — helyettesítettük a statikus konstanst egy hook-on belüli
 *  számítással. (Komponensen kívülről nincs használat.) */
const DAY_TYPE_COLOR: Record<DayAnnotationType, string> = {
  munkaszunet: '#dc2626',
  szabadsag:   '#3b82f6',
  szerviz:     '#f97316',
  hatarido:    '#dc2626',
  legter:      '#0284c7', // sky-600 — kék
};

function DayModal({
  date,
  overview,
  onClose,
  onSaved,
}: {
  date: string | null;
  overview: DashboardOverview;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const dayTypeLabels = t.meeting.dayModal.dayTypeLabels;
  const { taskTypes } = useTaskTypes();
  const safeDate = date ?? '';
  // Annotations belonging to *this exact day* — start day, end day of a LEGTER range,
  // or a single-day annotation. The Légtér is the only type where `date` may be just one
  // endpoint; the matching record is highlighted as "kezdő" or "záró" in the summary.
  const sameDay = (a: typeof overview.dayAnnotations[number]) => {
    const start = a.date.slice(0, 10);
    const end   = (a.endDate ?? '').slice(0, 10);
    return start === safeDate || end === safeDate;
  };
  const dayAnns = safeDate ? overview.dayAnnotations.filter(sameDay) : [];
  const isMunkaszunet = dayAnns.some(a => a.type === 'munkaszunet');

  type Tab = DayAnnotationType | 'workplan';
  // Default tab: workplan (ki dolgozik) — a felhasználók leggyakrabban azért
  // kattintanak egy napra, hogy lássák, ki van bent. Ha a nap munkaszünet,
  // a workplan amúgy se elérhető (csak a munkaszünet tab).
  const [tab, setTab] = useState<Tab>(isMunkaszunet ? 'munkaszunet' : 'workplan');
  const [label, setLabel] = useState<string>(t.meeting.dayModal.defaultMunkaszunetLabel);
  // Szabadság-tabon több embert is fel lehet venni egy napra (külön rekord/fő).
  // Edit-módban (existing) csak egy fő van — a state akkor [existing.personId].
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [equipmentId, setEquipmentId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  // Hatarido/legter: a user explicit kattintással szerkeszt egy meglévőt.
  // editingId === null → minden mentés új rekord (nincs limit egy napra).
  const [editingId, setEditingId] = useState<string | null>(null);

  // Currently editable record. Munkaszunet/szerviz: 1 rekord/nap (auto-find).
  // Hatarido/legter/szabadsag: csak ha a user explicit edit-elt egyet (editingId set).
  // Szabadság: egy napra több ember vehető fel — list-of-existing + new-form.
  const existing = (() => {
    if (tab === 'hatarido' || tab === 'legter' || tab === 'szabadsag') {
      return editingId ? dayAnns.find(a => a.id === editingId) ?? null : null;
    }
    return dayAnns.find(a => a.type === tab) ?? null;
  })();

  const vacationRecords = useMemo(
    () => dayAnns.filter(a => a.type === 'szabadsag'),
    [dayAnns],
  );
  const peopleAlreadyOnVacation = useMemo(() => {
    const ids = new Set<string>();
    for (const r of vacationRecords) if (r.personId && r.id !== editingId) ids.add(r.personId);
    return ids;
  }, [vacationRecords, editingId]);

  // Bootstrap form values: explicit edit-nél (editingId) tölti be a meglévő rekord
  // értékeit; egyébként reset.
  useEffect(() => {
    if (existing) {
      setLabel(existing.label);
      setPersonIds(existing.personId ? [existing.personId] : []);
      setEquipmentId(existing.equipmentId ?? '');
      setProjectId(existing.projectId ?? '');
      setEndDate(existing.endDate?.slice(0, 10) ?? '');
    } else {
      setLabel(
        tab === 'munkaszunet' ? t.meeting.dayModal.defaultMunkaszunetLabel :
        tab === 'legter'      ? t.meeting.dayModal.defaultLegterLabel : '',
      );
      setPersonIds([]);
      setEquipmentId('');
      setProjectId('');
      setEndDate('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, tab, safeDate]);

  // Tab váltáskor reset editingId (ne maradjon árva).
  useEffect(() => { setEditingId(null); }, [tab, safeDate]);

  if (!date) return null;
  const currentDate = date;

  // Public-holiday lock — only the munkaszunet tab is editable when the day is already
  // marked as one. Everything else is hidden ("nem lehet még munkaszünetibb nap").
  const tabsAvailable: Tab[] = isMunkaszunet
    ? ['munkaszunet']
    : ['workplan', 'munkaszunet', 'szabadsag', 'szerviz', 'hatarido', 'legter'];

  async function save() {
    if (tab === 'szabadsag' && personIds.length === 0) { alert(t.meeting.dayModal.validateVacationPerson); return; }
    if (tab === 'szerviz'   && !equipmentId)           { alert(t.meeting.dayModal.validateEquipment); return; }
    if (tab === 'hatarido'  && !projectId)             { alert(t.meeting.dayModal.validateProject); return; }
    if (tab === 'legter') {
      if (!projectId) { alert(t.meeting.dayModal.validateLegterProject); return; }
      if (!endDate) { alert(t.meeting.dayModal.validateLegterEnd); return; }
      if (endDate < currentDate) { alert(t.meeting.dayModal.validateLegterRange); return; }
    }

    let finalLabel = label;
    if (tab === 'szerviz') {
      const e = overview.equipment.find(x => x.id === equipmentId);
      finalLabel = e ? t.meeting.dayModal.equipmentLabelWith(e.name) : t.meeting.dayModal.equipmentLabelFallback;
    } else if (tab === 'hatarido') {
      const p = overview.projects.find(x => x.id === projectId);
      finalLabel = p ? t.meeting.dayModal.hataridoLabelWith(p.name) : t.meeting.dayModal.hataridoLabelFallback;
    } else if (tab === 'legter') {
      const p = overview.projects.find(x => x.id === projectId);
      const base = label.trim() || t.meeting.dayModal.defaultLegterLabel;
      finalLabel = p ? t.meeting.dayModal.legterLabelWith(p.name, base) : base;
    }

    setSaving(true);
    try {
      if (tab === 'szabadsag') {
        // Multi-person: minden kiválasztotthoz külön rekord (per-person label).
        // Edit-módban (existing) csak az adott rekordot frissítjük.
        if (existing) {
          const pid = personIds[0] ?? existing.personId;
          const p = overview.people.find(x => x.id === pid);
          const lbl = p ? t.meeting.dayModal.vacationLabelWith(personName(p)) : t.meeting.dayModal.vacationLabelFallback;
          await updateDayAnnotation(existing.id, {
            date: currentDate, type: 'szabadsag', label: lbl, personId: pid,
          });
        } else {
          // Tól-ig kiterjesztés: ha `endDate` ki van töltve és későbbi (vagy egyenlő)
          // a kezdő-napnál, a tartomány MINDEN napjára létrehozzuk a rekordot per
          // személy. Üres `endDate` → csak az aktuális nap (visszafelé-kompat).
          const dates: string[] = [];
          if (endDate && endDate >= currentDate) {
            const start = new Date(currentDate + 'T00:00:00');
            const end = new Date(endDate + 'T00:00:00');
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              dates.push(d.toISOString().slice(0, 10));
            }
          } else {
            dates.push(currentDate);
          }

          // Bulk-create: egyetlen POST minden (person × nap) párra. Throttle-
          // friendly (1 request = 1 limit-fogyás), és a backend per-item
          // try/catch-eli, így egy duplikátum nem öli az egész tranzakciót.
          const items: Array<{ date: string; type: 'szabadsag'; label: string; personId: string }> = [];
          for (const pid of personIds) {
            const p = overview.people.find(x => x.id === pid);
            const lbl = p ? t.meeting.dayModal.vacationLabelWith(personName(p)) : t.meeting.dayModal.vacationLabelFallback;
            for (const d of dates) {
              items.push({ date: d, type: 'szabadsag', label: lbl, personId: pid });
            }
          }

          const errors: string[] = [];
          // Chunking: ha sok rekord (pl. 10+ fő × 1+ hónap = 300+ item), egyetlen
          // request túl nagy lehet a body-size-limit-re (413 Request Entity Too
          // Large). A backend max 500/chunk-ot fogad (BulkCreateDayAnnotationDto
          // @ArrayMaxSize(500)). A throttle továbbra is friendly: 1 chunk = 1 hívás.
          const CHUNK_SIZE = 200;
          for (let i = 0; i < items.length; i += CHUNK_SIZE) {
            const chunk = items.slice(i, i + CHUNK_SIZE);
            try {
              const res = await createDayAnnotationsBulk(chunk);
              for (const e of res.errors ?? []) {
                const pid = e.item?.personId;
                const p = pid ? overview.people.find(x => x.id === pid) : undefined;
                const who = p ? personName(p) : (pid ?? '?');
                const when = e.item?.date ?? '?';
                errors.push(`${who} (${when}): ${e.message ?? t.meeting.dayModal.vacationErrorFallback}`);
              }
            } catch (err: any) {
              // Teljes-fail az adott chunk-on (413 / 4xx): minden item-hez
              // egyetlen sor — a többi chunk attól még átmegy.
              const msg = err?.response?.data?.message ?? t.meeting.dayModal.vacationErrorFallback;
              for (const it of chunk) {
                const p = overview.people.find(x => x.id === it.personId);
                const who = p ? personName(p) : it.personId;
                errors.push(`${who} (${it.date}): ${msg}`);
              }
            }
          }
          if (errors.length) alert(t.meeting.dayModal.vacationPartialErrors(errors.join('\n')));
        }
        onSaved();
        onClose();
        return;
      }

      const payload: any = {
        date: currentDate, type: tab, label: finalLabel,
        equipmentId: tab === 'szerviz'   ? equipmentId : undefined,
        projectId:   tab === 'hatarido' || tab === 'legter' ? projectId : undefined,
        endDate:     tab === 'legter'    ? endDate     : undefined,
      };
      if (existing) {
        await updateDayAnnotation(existing.id, payload);
      } else {
        await createDayAnnotation(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? t.meeting.dayModal.saveFailGeneric);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!existing) return;
    if (!confirm(t.meeting.dayModal.deleteMarkingConfirm)) return;
    setSaving(true);
    try {
      await deleteDayAnnotation(existing.id);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const parsed = parseDate(date);
  const dispDate = parsed.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <div className={styles.modalBg} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <div>
            <div className={styles.modalSub}>{t.meeting.dayModal.subTitle}</div>
            <div className={styles.modalTitle}>{dispDate}</div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* ── Top fix info: minden aznapi adat ────────────────────────── */}
        <div className={styles.formRow}>
          <div className={styles.formLabel}>{t.meeting.dayModal.dayMarkingsLabel}</div>
          {dayAnns.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t.meeting.dayModal.noMarkingsForDay}</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {dayAnns.map(a => {
                const start = a.date.slice(0, 10);
                const end   = a.endDate?.slice(0, 10);
                const role  =
                  a.type === 'legter' && start === safeDate && end && end !== safeDate ? t.meeting.dayModal.roleStart :
                  a.type === 'legter' && end === safeDate   && start !== safeDate      ? t.meeting.dayModal.roleEnd   : '';
                return (
                  <li key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: DAY_TYPE_COLOR[a.type], flexShrink: 0,
                    }} />
                    <span style={{ color: 'var(--muted)', minWidth: 80 }}>
                      {dayTypeLabels[a.type]}{role}
                    </span>
                    <span style={{ color: 'var(--text)' }}>{a.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Tab selector ────────────────────────────────────────────── */}
        <div className={styles.formRow}>
          <div className={styles.formLabel}>{isMunkaszunet ? t.meeting.dayModal.tabsLockedLabel : t.meeting.dayModal.tabsLabel}</div>
          <div className={styles.chipList}>
            {tabsAvailable.map(tabKey => {
              const tabLabel = tabKey === 'workplan' ? t.meeting.dayModal.workplanTab : dayTypeLabels[tabKey];
              const color = tabKey === 'workplan' ? '#0f766e' : DAY_TYPE_COLOR[tabKey];
              return (
                <button
                  key={tabKey}
                  type="button"
                  className={clsx(styles.chip, tab === tabKey && styles.on)}
                  style={tab === tabKey ? { background: color, borderColor: color, color: '#fff' } : undefined}
                  onClick={() => setTab(tabKey)}
                >
                  {tabLabel}
                </button>
              );
            })}
          </div>
        </div>

        {tab === 'workplan' && (
          <WorkPlanView overview={overview} dateIso={safeDate} taskTypes={taskTypes} />
        )}

        {tab === 'munkaszunet' && (
          <div className={styles.formRow}>
            <div className={styles.formLabel}>{t.meeting.dayModal.munkaszunetField}</div>
            <input className={styles.formInput} value={label} onChange={e => setLabel(e.target.value)} placeholder={t.meeting.dayModal.munkaszunetPlaceholder} />
          </div>
        )}

        {tab === 'szabadsag' && (
          <>
            {/* Már felvett szabadságok ezen a napon (per-person törlés). */}
            {vacationRecords.length > 0 && (
              <div style={{
                marginBottom: 12, padding: 8, background: '#f9fafb',
                border: '1px solid #e5e7eb', borderRadius: 6,
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  marginBottom: 6,
                }}>
                  {t.meeting.dayModal.alreadyOnVacation(vacationRecords.length)}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {vacationRecords.map(r => {
                    const p = r.personId ? overview.people.find(x => x.id === r.personId) : null;
                    return (
                      <li key={r.id} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 6px', borderRadius: 4,
                        background: editingId === r.id ? '#fef3c7' : 'transparent',
                      }}>
                        <span style={{ flex: 1, fontSize: 12 }}>{p ? personName(p) : (r.label || '—')}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            const confirmMsg = p
                              ? t.meeting.dayModal.vacationDeleteConfirmNamed(personName(p))
                              : t.meeting.dayModal.vacationDeleteConfirmAnon;
                            if (!confirm(confirmMsg)) return;
                            try {
                              await deleteDayAnnotation(r.id);
                              onSaved();
                            } catch (err: any) {
                              alert(err?.response?.data?.message ?? t.meeting.dayModal.vacationDeleteFail);
                            }
                          }}
                          title={t.meeting.dayModal.deleteIconTitle}
                          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                        >×</button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Új szabadság(ok) felvétele — multi-select chip-list + opcionális
                tól-ig dátumtartomány. Üres végdátum esetén csak az aktuális nap;
                kitöltött + későbbi/egyenlő esetén minden közbeeső napra
                létrejön a rekord per kiválasztott személy. Edit-módban (existing)
                a tartomány-mező rejtve van, mert az egyszerre 1 rekordot frissít. */}
            {!existing && (
              <div className={styles.formRow}>
                <div className={styles.formLabel}>{t.meeting.dayModal.vacationEndDateLabel}</div>
                <input
                  type="date"
                  className={styles.formInput}
                  value={endDate}
                  min={currentDate}
                  onChange={e => setEndDate(e.target.value)}
                />
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  {t.meeting.dayModal.vacationEndDateHint}
                </div>
              </div>
            )}
            <div className={styles.formRow}>
              <div className={styles.formLabel}>
                {t.meeting.dayModal.peoplePickerLabel} {personIds.length > 0 && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {t.meeting.dayModal.selectedCount(personIds.length)}</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 6, background: 'rgba(0,0,0,0.02)', borderRadius: 6 }}>
                {overview.people.filter(p => p.role !== 'Munkaállomás').map(p => {
                  const selected = personIds.includes(p.id);
                  const alreadyBooked = peopleAlreadyOnVacation.has(p.id);
                  const disabled = alreadyBooked && !selected;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setPersonIds(ids => selected ? ids.filter(x => x !== p.id) : [...ids, p.id]);
                      }}
                      title={alreadyBooked ? t.meeting.dayModal.vacationAlreadyTip : undefined}
                      style={{
                        padding: '4px 10px', borderRadius: 999, fontSize: 12,
                        border: selected ? '1.5px solid var(--today)' : '1px solid var(--border)',
                        background: selected ? 'var(--today-bg, #fef3c7)' : disabled ? '#f3f4f6' : 'white',
                        color: disabled ? '#9ca3af' : selected ? 'var(--today)' : 'var(--fg)',
                        fontWeight: selected ? 600 : 400,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.6 : 1,
                      }}
                    >
                      {personName(p)}{alreadyBooked && !selected ? ' ✓' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
        {tab === 'szerviz' && (
          <div className={styles.formRow}>
            <div className={styles.formLabel}>{t.meeting.dayModal.equipmentTab}</div>
            <select className={styles.formSelect} value={equipmentId} onChange={e => setEquipmentId(e.target.value)}>
              <option value="">—</option>
              {overview.equipment.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        )}
        {tab === 'hatarido' && (
          <>
            <ExistingAnnotationsList
              kind="hatarido"
              records={dayAnns.filter(a => a.type === 'hatarido')}
              projects={overview.projects}
              editingId={editingId}
              onEdit={id => setEditingId(id)}
              onNewClick={() => setEditingId(null)}
              onDelete={async id => {
                try { await deleteDayAnnotation(id); onSaved(); }
                catch (e: any) { alert(e?.response?.data?.message ?? t.meeting.existingList.deleteFailGeneric); }
              }}
            />
            <div className={styles.formRow}>
              <div className={styles.formLabel}>{t.meeting.dayModal.hataridoProjectLabel}</div>
              <select className={styles.formSelect} value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">—</option>
                {overview.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </>
        )}
        {tab === 'legter' && (
          <>
            <ExistingAnnotationsList
              kind="legter"
              records={dayAnns.filter(a => a.type === 'legter')}
              projects={overview.projects}
              editingId={editingId}
              onEdit={id => setEditingId(id)}
              onNewClick={() => setEditingId(null)}
              onDelete={async id => {
                try { await deleteDayAnnotation(id); onSaved(); }
                catch (e: any) { alert(e?.response?.data?.message ?? t.meeting.existingList.deleteFailGeneric); }
              }}
            />
            <div className={styles.formRow}>
              <div className={styles.formLabel}>{t.meeting.dayModal.legterProjectLabel}</div>
              <select className={styles.formSelect} value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">—</option>
                {overview.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formLabel}>{t.meeting.dayModal.legterLabelField}</div>
              <input
                className={styles.formInput}
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder={t.meeting.dayModal.legterPlaceholder}
              />
            </div>
            <div className={styles.formRow}>
              <div className={styles.formLabel}>{t.meeting.dayModal.legterEndLabel}</div>
              <input
                className={styles.formInput}
                type="date"
                value={endDate}
                min={currentDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: -4 }}>
              {t.meeting.dayModal.legterFootnote(currentDate)}
            </div>
          </>
        )}

        {tab !== 'workplan' && (
          <button className={styles.saveBtn} onClick={save} disabled={saving}>
            {saving ? t.meeting.dayModal.saving :
              existing ? t.meeting.dayModal.saveModify :
              (tab === 'hatarido' || tab === 'legter') ? t.meeting.dayModal.saveAddNew : t.meeting.dayModal.saveSimple}
          </button>
        )}
        {tab !== 'workplan' && existing && (
          <button className={styles.deleteBtn} onClick={handleDelete} disabled={saving}>{t.meeting.dayModal.deleteMarkingBtn}</button>
        )}
      </div>
    </div>
  );
}

/* ── EXISTING ANNOTATIONS LIST (hatarido / legter — több is lehet egy napon) ── */
function ExistingAnnotationsList({
  kind, records, projects, editingId, onEdit, onNewClick, onDelete,
}: {
  kind: 'hatarido' | 'legter';
  records: DashboardDayAnnotation[];
  projects: DashboardProject[];
  editingId: string | null;
  onEdit: (id: string) => void;
  onNewClick: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const t = useT();
  if (records.length === 0) return null;
  return (
    <div style={{
      marginBottom: 12, padding: 8, background: '#f9fafb',
      border: '1px solid #e5e7eb', borderRadius: 6,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>{kind === 'hatarido' ? t.meeting.existingList.hataridoHeader(records.length) : t.meeting.existingList.legterHeader(records.length)}</span>
        {editingId !== null && (
          <button
            type="button"
            onClick={onNewClick}
            style={{
              fontSize: 11, color: 'var(--today)', background: 'none', border: 'none',
              cursor: 'pointer', textDecoration: 'underline', padding: 0,
            }}
          >
            {t.meeting.existingList.newInstead}
          </button>
        )}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {records.map(r => {
          const p = r.projectId ? projects.find(x => x.id === r.projectId) : null;
          const isEditing = editingId === r.id;
          return (
            <li key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 6px', borderRadius: 4,
              background: isEditing ? '#fef3c7' : 'transparent',
            }}>
              <span style={{ flex: 1, fontSize: 12 }}>
                {p ? p.name : '—'}
                {kind === 'legter' && r.endDate && r.endDate.slice(0, 10) !== r.date.slice(0, 10) && (
                  <span style={{ color: 'var(--muted)', marginLeft: 4 }}>· {r.date.slice(0, 10)} → {r.endDate.slice(0, 10)}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onEdit(r.id)}
                disabled={isEditing}
                title={t.meeting.existingList.editTooltip}
                style={{
                  fontSize: 11, padding: '2px 8px',
                  background: isEditing ? '#fde68a' : '#fff',
                  border: '1px solid #d1d5db', borderRadius: 4,
                  cursor: isEditing ? 'default' : 'pointer',
                }}
              >{isEditing ? t.meeting.existingList.editingState : '✎'}</button>
              <button
                type="button"
                onClick={() => onDelete(r.id)}
                title={t.meeting.existingList.deleteTooltip}
                style={{
                  fontSize: 11, padding: '2px 8px',
                  background: '#fff', border: '1px solid #fecaca',
                  color: '#dc2626', borderRadius: 4, cursor: 'pointer',
                }}
              >🗑</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── WEATHER DAY MODAL ───────────────────────────────────── */
function WeatherDayModal({
  dateIso,
  forecast,
  thresholds,
  overview,
  onClose,
}: {
  dateIso: string;
  forecast: WeatherForecast | null;
  thresholds: WeatherThresholds | null;
  overview: DashboardOverview | null;
  onClose: () => void;
}) {
  const day = forecast?.daily.find(d => d.date === dateIso) ?? null;
  const Icon = weatherCodeToIcon(day?.weather_code);

  // Aznapi 24 óra a hourly tömből (timezone Europe/Budapest, 'YYYY-MM-DDTHH:00')
  const hours = useMemo(() => {
    if (!forecast) return [];
    return forecast.hourly.filter(h => h.time.slice(0, 10) === dateIso);
  }, [forecast, dateIso]);

  // Aznapra eső drón-task-ok kockázat-jelzéssel. Drón = task.equipmentIds-ben
  // van olyan equipment, aminek category === 'drone'.
  const droneTasks = useMemo(() => {
    if (!overview) return [];
    const droneIds = new Set(overview.equipment.filter(e => e.category === 'drone').map(e => e.id));
    if (droneIds.size === 0) return [];
    return overview.tasks.filter(t => {
      if (!t.startDate) return false;
      if (!t.equipmentIds.some(id => droneIds.has(id))) return false;
      // Aznap kezdődik VAGY aznap fut (start ≤ date ≤ end).
      const start = t.startDate.slice(0, 10);
      const end = (t.endDate ?? t.dueDate ?? t.startDate).slice(0, 10);
      return start <= dateIso && dateIso <= end;
    });
  }, [overview, dateIso]);

  const risk = evaluateDroneRisk(day ?? undefined, thresholds);

  function fmtDate(iso: string) {
    const [y, m, d] = iso.split('-').map(Number);
    return `${y}. ${MONTHS_HU[m - 1]} ${d}. (${DOW_HU[new Date(y, m - 1, d).getDay()]})`;
  }

  return (
    <div className={styles.modalBg} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ width: 960 }}>
        <div className={styles.modalHead}>
          <div>
            <div className={styles.modalSub}>Időjárás</div>
            <div className={styles.modalTitle}>{fmtDate(dateIso)}</div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {!day ? (
          <div className={styles.droneRiskEmpty}>
            Nincs előrejelzés erre a napra (16 napon túl, vagy hiányzik az adat).
          </div>
        ) : (
          <>
            <div className={styles.weatherSummary}>
              <div className={styles.weatherIconLarge}>
                {Icon ? <Icon className="w-8 h-8" strokeWidth={1.4} /> : <span style={{ opacity: 0.3 }}>—</span>}
              </div>
              <div className={styles.weatherStatList}>
                <span className={styles.weatherStatLabel}>Hőmérséklet</span>
                <span className={styles.weatherStatValue}>{Math.round(day.temp_min)}° / {Math.round(day.temp_max)}°</span>
                <span className={styles.weatherStatLabel}>Csapadék-eséllyel</span>
                <span className={styles.weatherStatValue}>{day.precip_prob_max}%</span>
                <span className={styles.weatherStatLabel}>Max szél</span>
                <span className={styles.weatherStatValue}>{Math.round(day.wind_speed_max)} m/s</span>
                <span className={styles.weatherStatLabel}>Max széllökés</span>
                <span className={styles.weatherStatValue}>{Math.round(day.wind_gusts_max)} m/s</span>
              </div>
            </div>

            <div className={styles.sectionTitle}>Óránként</div>
            <div className={styles.hourlyGrid}>
              {hours.map(h => {
                const HIcon = weatherCodeToIcon(h.weather_code);
                return (
                  <div key={h.time} className={styles.hourlyCell} title={`${h.time.slice(11, 16)} · ${h.precip_prob}% csap. · ${Math.round(h.wind_speed)} m/s`}>
                    <span className={styles.hourlyHour}>{h.time.slice(11, 13)}</span>
                    {HIcon ? <HIcon className="w-5 h-5" strokeWidth={1.5} /> : null}
                    <span className={styles.hourlyTemp}>{Math.round(h.temperature)}°</span>
                  </div>
                );
              })}
            </div>

            <div className={styles.sectionTitle}>
              Drón-kockázat
              {risk && (
                <span style={{ marginLeft: 8, textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
                  — napi átlag: {risk === 'safe' ? '🟢 biztonságos' : risk === 'caution' ? '🟡 figyelem' : '🔴 veszélyes'}
                </span>
              )}
            </div>
            {droneTasks.length === 0 ? (
              <div className={styles.droneRiskEmpty}>Nincs drón-task erre a napra.</div>
            ) : (
              <div className={styles.droneRiskList}>
                {droneTasks.map(t => {
                  const project = overview?.projects.find(p => p.id === t.projectId);
                  const taskRisk: DroneRiskLevel = risk ?? 'safe';
                  const badgeClass =
                    taskRisk === 'danger'  ? styles.droneRiskBadgeDanger  :
                    taskRisk === 'caution' ? styles.droneRiskBadgeCaution :
                                             styles.droneRiskBadgeSafe;
                  return (
                    <div key={t.id} className={styles.droneRiskItem}>
                      <span className={clsx(styles.droneRiskBadge, badgeClass)} />
                      <div style={{ flex: 1 }}>
                        <div className={styles.droneRiskTitle}>{t.title}</div>
                        <div className={styles.droneRiskMeta}>
                          {project?.name ?? 'Projekt nélkül'}
                          {t.assignedTo && overview && (() => {
                            const p = overview.people.find(x => x.id === t.assignedTo);
                            return p ? ` · ${p.firstName} ${p.lastName}` : '';
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {thresholds && !thresholds.isCustom && (
              <div style={{ marginTop: 14, fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
                Alapértékek aktívak. <Link href="/meeting/admin" style={{ color: 'var(--brand-600, #6366f1)', textDecoration: 'underline' }}>Küszöb-finomhangolás</Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── NEW TASK MODAL ─────────────────────────────────────── */
function NewTaskModal({
  overview,
  defaults,
  templateContext,
  onClose,
  onSaved,
}: {
  overview: DashboardOverview;
  defaults?: { projectId?: string; startDate?: string };
  /** Ha van: a modal "sablon-folyamat" módban van. A user az aktuális task-ot
   *  egy hiányzó sablon helyett tölti ki — sárga keret + 'Mentés sablonként' gomb,
   *  ami a kitöltést egyszerre task + chain-template-ként rögzíti. */
  templateContext?: { fromTaskTitle: string; offsetDays: number };
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const nm = t.meeting.newTaskModal;
  const { taskTypes } = useTaskTypes();
  const [form, setForm] = useState({
    projectId: defaults?.projectId ?? overview.projects[0]?.id ?? '',
    title: '',
    taskType: 'terep',
    assignedTo: '',
    helpers: [] as string[],
    startDate: defaults?.startDate ?? dateStr(startOfToday()),
    duration: 1,
    equipmentIds: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const isTemplateMode = !!templateContext;

  // Same busy-on-day map as the edit modal — flag conflicting people in the picker.
  const busyMap = useMemo(() => {
    const m = new Map<string, string>();
    if (!form.startDate) return m;
    const day = form.startDate.slice(0, 10);
    const inactiveProjectIds = new Set(
      overview.projects.filter(p => p.state === 'archived' || p.state === 'cancelled').map(p => p.id),
    );
    for (const t of overview.tasks) {
      if (t.status === 'completed' || t.status === 'cancelled') continue;
      if (t.projectId && inactiveProjectIds.has(t.projectId)) continue;
      const s = (t.startDate ?? '').slice(0, 10);
      const e = (t.endDate   ?? s).slice(0, 10);
      if (!s) continue;
      if (day >= s && day <= e) {
        const involved = [
          ...(t.assignedTo ? [t.assignedTo] : []),
          ...(t.helpers ?? []),
        ];
        for (const pid of involved) {
          if (!m.has(pid)) m.set(pid, t.title || 'más task');
        }
      }
    }
    for (const a of overview.dayAnnotations) {
      if (a.type === 'szabadsag' && a.personId && a.date.slice(0, 10) === day) {
        m.set(a.personId, 'szabadságon');
      }
    }
    return m;
  }, [form.startDate, overview.tasks, overview.dayAnnotations, overview.projects]);

  async function saveAsTemplate() {
    if (!templateContext || !form.title.trim()) return;
    // Először a task létrehozása, utána a chain-sablon felvétele.
    setSaving(true);
    try {
      await createPlanTask({
        projectId: form.projectId,
        title: form.title,
        taskType: form.taskType,
        assignedTo: form.assignedTo || null,
        helpers: form.helpers.length > 0 ? form.helpers : undefined,
        startDate: new Date(form.startDate).toISOString(),
        duration: form.duration,
        equipmentIds: form.equipmentIds.length > 0 ? form.equipmentIds : undefined,
      });
      // Task-típushoz kötött vizuális visszajelzés (Projekt map task-típusok).
      if (form.taskType === 'szamlazas') {
        void import('@/lib/animations/money-rain').then(m => m.triggerMoneyRain());
      } else if (form.taskType === 'drone' || form.taskType === 'helyszin' || form.taskType === 'geodezia') {
        void import('@/lib/animations/drone-swarm').then(m => m.triggerDroneSwarm());
      } else if (form.taskType === 'gepido' || form.taskType === 'feldolgozas' || form.taskType === 'modellezes') {
        void import('@/lib/animations/machine-time').then(m => m.triggerMachineTime());
      } else if (form.taskType === 'egyeztetes' || form.taskType === 'atadas' || form.taskType === 'qa') {
        void import('@/lib/animations/office-workflow').then(m => m.triggerOfficeWorkflow());
      }
      try {
        await upsertTaskChainTemplate({
          fromKey: templateContext.fromTaskTitle,
          nextTitle: form.title,
          nextTaskType: form.taskType,
          nextDuration: form.duration,
          offsetDays: templateContext.offsetDays,
          keepAssignee: !!form.assignedTo,
        });
      } catch (err: any) {
        alert(nm.templateSaveFail(err?.response?.data?.message ?? nm.unknownError));
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? nm.templateTaskSaveFail);
    } finally {
      setSaving(false);
    }
  }

  async function save(continueChain: boolean = false) {
    if (!form.projectId || !form.title.trim()) return;
    // Hétvége szabály: csak 'gepido' task mehet szombatra/vasárnapra.
    const startDow = parseDate(form.startDate).getDay();
    if ((startDow === 0 || startDow === 6) && form.taskType !== 'gepido') {
      alert(nm.weekendAlert);
      return;
    }
    setSaving(true);
    try {
      await createPlanTask({
        projectId: form.projectId,
        title: form.title,
        taskType: form.taskType,
        assignedTo: form.assignedTo || null,
        helpers: form.helpers.length > 0 ? form.helpers : undefined,
        startDate: new Date(form.startDate).toISOString(),
        duration: form.duration,
        equipmentIds: form.equipmentIds.length > 0 ? form.equipmentIds : undefined,
      });
      // Task-típushoz kötött vizuális visszajelzés (Projekt map task-típusok).
      if (form.taskType === 'szamlazas') {
        void import('@/lib/animations/money-rain').then(m => m.triggerMoneyRain());
      } else if (form.taskType === 'drone' || form.taskType === 'helyszin' || form.taskType === 'geodezia') {
        void import('@/lib/animations/drone-swarm').then(m => m.triggerDroneSwarm());
      } else if (form.taskType === 'gepido' || form.taskType === 'feldolgozas' || form.taskType === 'modellezes') {
        void import('@/lib/animations/machine-time').then(m => m.triggerMachineTime());
      } else if (form.taskType === 'egyeztetes' || form.taskType === 'atadas' || form.taskType === 'qa') {
        void import('@/lib/animations/office-workflow').then(m => m.triggerOfficeWorkflow());
      }
      onSaved();
      if (continueChain) {
        // Lánc: csak a title-t reseteljük, a startDate-et a most létrehozott
        // task vége utáni napra állítjuk, hétvégéket átugorva (kivéve gépidő).
        const next = parseDate(form.startDate);
        const days = Math.max(1, Math.ceil(form.duration));
        next.setDate(next.getDate() + days);
        if (form.taskType !== 'gepido') {
          while (next.getDay() === 0 || next.getDay() === 6) {
            next.setDate(next.getDate() + 1);
          }
        }
        setForm(f => ({ ...f, title: '', startDate: dateStr(next) }));
      } else {
        onClose();
      }
    } catch (err: any) {
      // Toast-visibility: ha 403/400/500 jön, a user lássa az okot, ne csak
      // azt, hogy "nem történt semmi". A modal nyitva marad hiba esetén.
      toast.error(err?.response?.data?.message ?? nm.createFail);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.modalBg} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        style={isTemplateMode ? { border: '3px solid #f59e0b', boxShadow: '0 0 0 3px rgba(245,158,11,0.15)' } : undefined}
      >
        <div className={styles.modalHead}>
          <div>
            <div className={styles.modalSub} style={isTemplateMode ? { color: '#b45309' } : undefined}>
              {isTemplateMode ? nm.headTemplateSub(templateContext!.fromTaskTitle) : nm.headNewSub}
            </div>
            <div className={styles.modalTitle}>
              {isTemplateMode ? nm.headTemplateTitle : nm.headNewTitle}
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {isTemplateMode && (
          <div style={{
            background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8,
            padding: '8px 12px', fontSize: 12, color: '#92400e', margin: '4px 12px',
          }}>
            {nm.templateInfo(templateContext!.fromTaskTitle)}
          </div>
        )}

        <div className={styles.formRow}>
          <div className={styles.formLabel}>{nm.projectLabel}</div>
          <select className={styles.formSelect} value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}>
            {overview.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formLabel}>{nm.konkretumLabel}</div>
          <input className={styles.formInput} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={nm.konkretumPh} />
        </div>

        <div className={styles.formRow}>
          <div className={styles.formLabel}>{nm.typeLabel}</div>
          <select className={styles.formSelect} value={form.taskType} onChange={e => setForm(f => ({ ...f, taskType: e.target.value, assignedTo: isUnassignedTaskType(taskTypes, e.target.value) ? '' : f.assignedTo }))}>
            {(taskTypes ?? []).map(tt => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
            {form.taskType && !taskTypes?.some(tt => tt.value === form.taskType) && (
              <option value={form.taskType}>{form.taskType} {nm.deletedSuffix}</option>
            )}
          </select>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formLabel}>
            {nm.whoLabel}{isUnassignedTaskType(taskTypes, form.taskType) && (
              <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>
                {nm.whoOptionalHint}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <select
              className={styles.formSelect}
              value={form.assignedTo}
              onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
              style={{ flex: 1 }}
            >
              <option value="">
                {isUnassignedTaskType(taskTypes, form.taskType)
                  ? nm.whoEventPlaceholder
                  : nm.whoEmptyPlaceholder}
              </option>
              <optgroup label={nm.groupPeople}>
                {/* Ember-opciók: csak a név (a foglaltság/rang szándékosan kihagyva). */}
                {overview.people.filter(p => p.role !== 'Munkaállomás').map(p => (
                  <option key={p.id} value={p.id}>{personName(p)}</option>
                ))}
              </optgroup>
              <optgroup label={nm.groupStations}>
                {overview.people.filter(p => p.role === 'Munkaállomás').map(p => {
                  const busy = busyMap.get(p.id);
                  return (
                    <option key={p.id} value={p.id}>
                      {busy ? '⚠️ ' : ''}💻 {p.firstName}{busy ? ` (${busy})` : ''}
                    </option>
                  );
                })}
              </optgroup>
            </select>
            {form.assignedTo && busyMap.has(form.assignedTo) && (
              <span
                title={nm.busyTitle(busyMap.get(form.assignedTo) ?? '')}
                aria-label={nm.busyAria}
                style={{ display: 'inline-flex', flexShrink: 0 }}
              >
                <AlertTriangle size={14} color="#f59e0b" />
              </span>
            )}
          </div>
        </div>

        {/* További érintettek — segítők (helpers). A felelős mellett további
            embereket lehet a taskhoz csatolni, akik így foglaltnak számítanak
            az adott napon. */}
        <HelpersField
          assignedTo={form.assignedTo}
          helpers={form.helpers}
          people={overview.people}
          busyMap={busyMap}
          onChange={(h) => setForm(f => ({ ...f, helpers: h }))}
        />

        {/* Mivel (eszközök) — collapse-olható szekció. Mintaként a TaskModal-ból
            áthelyezve, hogy ÚJ task hozzáadásakor is első próbálkozásra mentődjön. */}
        <EquipmentField
          equipmentIds={form.equipmentIds}
          equipment={overview.equipment}
          onToggle={(id) => setForm(f => ({
            ...f,
            equipmentIds: f.equipmentIds.includes(id) ? f.equipmentIds.filter(x => x !== id) : [...f.equipmentIds, id],
          }))}
        />

        <div className={styles.formRowInline}>
          <div className={styles.formRow} style={{ flex: 2 }}>
            <div className={styles.formLabel}>{nm.fromLabel}</div>
            <input type="date" className={styles.formInput} value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formLabel}>{form.taskType === 'gepido' ? nm.hoursLabel : nm.workdaysLabel}</div>
            {form.taskType === 'gepido' ? (
              <input type="number" step={1} min={1} className={styles.formInput}
                value={Math.round((form.duration ?? 0) * 24)}
                onChange={e => setForm(f => ({ ...f, duration: (parseInt(e.target.value, 10) || 1) / 24 }))} />
            ) : (
              <input type="number" step={0.5} min={0.5} className={styles.formInput} value={form.duration} onChange={e => setForm(f => ({ ...f, duration: parseFloat(e.target.value) || 0.5 }))} />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {isTemplateMode ? (
            <>
              <button
                type="button"
                className={styles.saveBtn}
                onClick={() => save(false)}
                disabled={saving || !form.title.trim() || !form.projectId}
                style={{ flex: 1 }}
                title={nm.onlyTaskTitle}
              >
                {saving ? nm.saving : nm.onlyTaskBtn}
              </button>
              <button
                type="button"
                className={styles.saveBtn}
                onClick={saveAsTemplate}
                disabled={saving || !form.title.trim() || !form.projectId}
                style={{ flex: 1.4, background: '#f59e0b' }}
                title={nm.saveAsTemplateTitle}
              >
                {saving ? nm.saving : nm.saveAsTemplateBtn}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.saveBtn}
                onClick={() => save(true)}
                disabled={saving || !form.title.trim() || !form.projectId}
                title={nm.createAndContinueTitle}
                style={{ flex: 1, background: '#0284c7' }}
              >
                {saving ? nm.savingShort : nm.createAndContinueBtn}
              </button>
              <button
                type="button"
                className={styles.saveBtn}
                onClick={() => save(false)}
                disabled={saving || !form.title.trim() || !form.projectId}
                style={{ flex: 1 }}
              >
                {saving ? nm.creating : nm.create}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── SIDE PANEL ────────────────────────────────────────── */
function SidePanel({
  open,
  overview,
  today,
}: {
  open: boolean;
  overview: DashboardOverview;
  today: Date;
}) {
  // Heti keret hétfő 00:00 → vasárnap 23:59:59. (today.getDay()-ban a vasárnap = 0,
  // ezért 0 esetén 6-ot vonunk, hogy egy hétfő-kezdetű hetet kapjunk.)
  const weekStart = new Date(today);
  const dow = today.getDay() === 0 ? 6 : today.getDay() - 1;
  weekStart.setDate(today.getDate() - dow);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  // 5 munkanap a "100%" — fél napos task = 0.5 munkanap, 1 napos = 1, stb.
  const WORK_DAYS = 5;

  // A személyek listáját ELŐRE legnagyobb heti terheléstől a legkisebbig
  // rendezzük, hogy a túlterhelt emberek a tetejére kerüljenek (gyors
  // áttekintéshez). Az "ma foglalt" rajzolódás a jobb oldali MA-oszlopban
  // marad — más a "ma" és más a "heti".
  const peopleWithLoad = overview.people
    .filter(p => p.role !== 'Munkaállomás')
    .map(p => {
      const todayTasks = overview.tasks.filter(t => {
        if (t.assignedTo !== p.id || t.status === 'completed' || !t.startDate) return false;
        const ts = parseDate(t.startDate);
        const te = t.endDate ? parseDate(t.endDate) : new Date(ts.getTime() + 86400000);
        return ts <= today && te > today;
      });
      const onVacation = overview.dayAnnotations.some(
        a => a.type === 'szabadsag' && a.personId === p.id && a.date.slice(0, 10) === dateStr(today),
      );
      const weekTasks = overview.tasks.filter(t => {
        if (t.assignedTo !== p.id || t.status === 'cancelled' || !t.startDate) return false;
        const ts = parseDate(t.startDate);
        const te = t.endDate ? parseDate(t.endDate) : new Date(ts.getTime() + 86400000);
        return te >= weekStart && ts < weekEnd;
      });
      const weekDays = weekTasks.reduce((acc, t) => {
        const ts = parseDate(t.startDate!);
        const te = t.endDate ? parseDate(t.endDate) : new Date(ts.getTime() + 86400000);
        const overlapStart = ts > weekStart ? ts : weekStart;
        const overlapEnd   = te < weekEnd   ? te : weekEnd;
        return acc + Math.max(0, (overlapEnd.getTime() - overlapStart.getTime()) / 86400000);
      }, 0);
      const loadPct = Math.min(100, Math.round((weekDays / WORK_DAYS) * 100));
      return { p, todayTasks, onVacation, weekTasks, weekDays, loadPct };
    })
    .sort((a, b) => {
      // Elsődleges: heti terhelés csökkenő. Másodlagos: ma-foglaltság (tegyük
      // előre azokat akiknek MA is van dolguk). Harmadlagos: név, hogy stabil
      // legyen a sorrend két azonos terheltség esetén.
      if (b.loadPct !== a.loadPct) return b.loadPct - a.loadPct;
      if (b.todayTasks.length !== a.todayTasks.length) return b.todayTasks.length - a.todayTasks.length;
      return personName(a.p).localeCompare(personName(b.p), 'hu');
    });

  return (
    <div className={clsx(styles.sidePanel, open && styles.open)}>
      <div className={styles.sideSection}>
        <div className={styles.sideTitle}>Csapat — heti leterheltség</div>
        {/* Oszlop-fejléc: bal oldal a HÉTI terheléshez, jobb oldal a MA státuszhoz */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 8px 6px',
          fontSize: 9, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600,
          borderBottom: '1px solid var(--border)',
          marginBottom: 4,
        }}>
          <div style={{ width: 28 }} />
          <div style={{ flex: 1 }}>Név · heti terhelés</div>
          <div style={{ width: 56, textAlign: 'right' }}>Ma</div>
        </div>
        {peopleWithLoad.map(({ p, todayTasks, onVacation, weekTasks, weekDays, loadPct }) => {
          const badgeBg = onVacation ? '#3b82f622' : todayTasks.length > 0 ? '#f59e0b22' : '#10b98122';
          const badgeColor = onVacation ? '#3b82f6' : todayTasks.length > 0 ? '#f59e0b' : '#10b981';
          const badgeText = onVacation
            ? 'SZABI'
            : todayTasks.length > 0
              ? `${todayTasks.length} task`
              : 'SZABAD';
          // Színskála: zöld ≤ 70%, narancs 70–100%, piros > 100%-os túltervezés.
          const loadColor = loadPct > 100 ? '#dc2626' : loadPct > 70 ? '#f97316' : '#10b981';

          return (
            <div key={p.id} className={styles.personItem}>
              <div className={styles.personAvatar} style={{ background: `${avatarColor(p)}22`, border: `1.5px solid ${avatarColor(p)}`, color: avatarColor(p) }}>
                {personInitial(p)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{personName(p)}</div>
                <div style={{ fontSize: 9, color: 'var(--dim)' }}>{p.role}</div>
                {/* Heti leterheltség — kis progress bar + szöveges összefoglaló. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <div style={{ flex: 1, height: 4, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden' }}
                       title={`Heti terhelés: ${loadPct}% (${WORK_DAYS} munkanap = 100%)`}>
                    <div style={{
                      width: `${Math.min(100, loadPct)}%`,
                      height: '100%',
                      background: loadColor,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color: loadColor, fontWeight: 600, whiteSpace: 'nowrap' }}
                        title={`${weekTasks.length} task · ${weekDays.toFixed(1)} nap`}>
                    {weekTasks.length} task · {weekDays.toFixed(1)} nap
                  </span>
                </div>
              </div>
              <div className={styles.eqStatus} style={{ background: badgeBg, color: badgeColor }}>{badgeText}</div>
            </div>
          );
        })}
      </div>
      <div className={styles.sideSection}>
        <div className={styles.sideTitle}>Eszközök</div>
        {overview.equipment.map(e => {
          const usedToday = overview.tasks.some(t => {
            if (!t.equipmentIds.includes(e.id) || t.status === 'completed' || !t.startDate) return false;
            const ts = parseDate(t.startDate);
            const te = t.endDate ? parseDate(t.endDate) : new Date(ts.getTime() + 86400000);
            return ts <= today && te > today;
          });
          const holder = e.holderId ? overview.people.find(p => p.id === e.holderId) : null;
          const typeLabel = ({ drone: 'DRÓN', car: 'AUTÓ', pc: 'PC', software: 'SW', laser_scanner: 'LASER', gnss_receiver: 'GNSS', total_station: 'TOTAL', camera: 'KAMERA', misc: 'EGYÉB', other: 'EGYÉB' } as Record<string, string>)[e.category] ?? e.category.toUpperCase();
          return (
            <div key={e.id} className={styles.eqItem}>
              <div className={styles.eqTypeLabel}>{typeLabel}</div>
              <div style={{ flex: 1 }}>
                <div>{e.name}</div>
                <div style={{ fontSize: 9, color: holder ? avatarColor(holder) : 'var(--dim)' }}>
                  {holder ? `${personName(holder)} →` : e.note ?? '—'}
                </div>
              </div>
              <div className={styles.eqStatus} style={{ background: usedToday ? '#f9731622' : '#10b98122', color: usedToday ? '#f97316' : '#10b981' }}>
                {usedToday ? 'HASZN.' : 'SZABAD'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── WORKPLAN VIEW ("Ki mit csinál" tetszőleges napra) ──────
 *  A korábbi `TodaySummaryPanel` (Gantt jobb-alsó felcsúszó panel) helyett
 *  a DayModal egy tab-ja: bármelyik napra megnézhető, ki dolgozik, kik
 *  vannak szabin, kik szabadok, és a munkaállomások kihasználtsága.
 */
interface WorkPlanData {
  inWork: Array<{ person: DashboardPerson; tasks: DashboardTask[] }>;
  onVacation: DashboardPerson[];
  free: DashboardPerson[];
  stationTasks: Array<{ station: DashboardPerson; tasks: DashboardTask[] }>;
}

function computeWorkPlanForDay(overview: DashboardOverview, dateIso: string): WorkPlanData {
  const dayDate = parseDate(dateIso);
  // Egy task akkor "fut a napon", ha a startDate <= dateIso (24h-s értelmezés)
  // és az endDate > dateIso. A "csak aznap kezdődik" eset a jobb hozzátapad
  // (ts <= dayDate, te > dayDate).
  const dayMs = dayDate.getTime();
  const inWork: WorkPlanData['inWork'] = [];
  const onVacation: DashboardPerson[] = [];
  const free: DashboardPerson[] = [];
  const people = overview.people.filter(p => p.role !== 'Munkaállomás');
  for (const p of people) {
    const isVacation = overview.dayAnnotations.some(
      a => a.type === 'szabadsag' && a.personId === p.id && a.date.slice(0, 10) === dateIso,
    );
    if (isVacation) {
      onVacation.push(p);
      continue;
    }
    const tasks = overview.tasks.filter(t => {
      // Az assignedTo MELLETT a helpers-t is bele kell venni — különben a
      // több-érintettes task csak a felelős listájában jelenik meg, a többi
      // érintettnél a "ki mit csinál ma" üres / "szabad"-ra kerül.
      const isInvolved = t.assignedTo === p.id || (t.helpers ?? []).includes(p.id);
      if (!isInvolved || t.status === 'completed' || t.status === 'cancelled' || !t.startDate) return false;
      const ts = parseDate(t.startDate).getTime();
      const te = t.endDate ? parseDate(t.endDate).getTime() : ts + 86400000;
      return ts <= dayMs && te > dayMs;
    });
    if (tasks.length > 0) inWork.push({ person: p, tasks });
    else free.push(p);
  }
  const stationTasks: WorkPlanData['stationTasks'] = [];
  for (const station of overview.people.filter(p => p.role === 'Munkaállomás')) {
    const tasks = overview.tasks.filter(t => {
      if (t.assignedTo !== station.id || t.status === 'completed' || t.status === 'cancelled' || !t.startDate) return false;
      const ts = parseDate(t.startDate).getTime();
      const te = t.endDate ? parseDate(t.endDate).getTime() : ts + 86400000;
      return ts <= dayMs && te > dayMs;
    });
    if (tasks.length > 0) stationTasks.push({ station, tasks });
  }
  return { inWork, onVacation, free, stationTasks };
}

function WorkPlanView({
  overview,
  dateIso,
  taskTypes,
}: {
  overview: DashboardOverview;
  dateIso: string;
  taskTypes: TaskType[] | null;
}) {
  const dayDate = useMemo(() => parseDate(dateIso), [dateIso]);
  const projectsById = useMemo(() => {
    const m = new Map<string, DashboardProject>();
    for (const p of overview.projects) m.set(p.id, p);
    return m;
  }, [overview.projects]);
  const summary = useMemo(() => computeWorkPlanForDay(overview, dateIso), [overview, dateIso]);

  const fmtDuration = (t: DashboardTask) => {
    const d = Number(t.duration ?? 0);
    return t.taskType === 'gepido' ? `${(d * 24).toFixed(1)} óra` : `${d.toFixed(1)} nap`;
  };
  const typeLabel = (taskType: string) => getTaskTypeLabel(taskTypes, taskType);

  const totalTasks =
    summary.inWork.reduce((acc, r) => acc + r.tasks.length, 0)
    + summary.stationTasks.reduce((acc, r) => acc + r.tasks.length, 0);

  return (
    <div className={styles.workPlanView}>
      <div className={styles.workPlanSummary}>
        <strong>{summary.inWork.length}</strong> fő dolgozik · <strong>{totalTasks}</strong> task
        {summary.onVacation.length > 0 && <> · <strong>{summary.onVacation.length}</strong> szabin</>}
        {summary.free.length > 0 && <> · <strong>{summary.free.length}</strong> szabad</>}
      </div>

      {summary.inWork.length === 0 && summary.stationTasks.length === 0 && summary.onVacation.length === 0 && (
        <div className={styles.workPlanEmpty}>
          Ezen a napon senki sem dolgozik task-on. Vasárnap van, vagy mindenki szabin? 🌴
        </div>
      )}

      {summary.inWork.length > 0 && (
        <div className={styles.workPlanSection}>
          <div className={styles.workPlanSectionTitle}>
            👷 Munkában — {summary.inWork.length} fő
          </div>
          {summary.inWork.map(({ person, tasks }) => (
            <div key={person.id} className={styles.workPlanPersonRow}>
              <div className={styles.personAvatar} style={{ background: `${avatarColor(person)}22`, border: `1.5px solid ${avatarColor(person)}`, color: avatarColor(person), flexShrink: 0 }}>
                {personInitial(person)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{personName(person)}</div>
                <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 2 }}>{person.role}</div>
                <div className={styles.workPlanTaskList}>
                  {tasks.map(t => {
                    const project = t.projectId ? projectsById.get(t.projectId) : null;
                    const pColor = (project?.color as string | undefined) ?? '#9ca3af';
                    const isOffice = project?.categoryType === 'OfficeAdmin';
                    const isSlipping = t.status === 'in_progress' && t.startDate && parseDate(t.startDate) < dayDate
                      && (t.endDate ? parseDate(t.endDate) : dayDate) <= dayDate;
                    return (
                      <div key={t.id} className={styles.workPlanTaskItem}>
                        {project && (
                          <span
                            className={styles.workPlanProjectChip}
                            style={{ background: `${pColor}22`, color: pColor }}
                            title={isOffice ? `Iroda – ${project.name}` : project.name}
                          >
                            {isOffice ? '👔 ' : ''}{project.name}
                          </span>
                        )}
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.title || '(cím nélkül)'}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
                          {typeLabel(t.taskType)} · {fmtDuration(t)}
                        </span>
                        {isSlipping && (
                          <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600, flexShrink: 0 }}>
                            csúszik
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {summary.stationTasks.length > 0 && (
        <div className={styles.workPlanSection}>
          <div className={styles.workPlanSectionTitle}>
            💻 Munkaállomások — {summary.stationTasks.length} aktív
          </div>
          {summary.stationTasks.map(({ station, tasks }) => (
            <div key={station.id} className={styles.workPlanPersonRow}>
              <div className={styles.personAvatar} style={{ background: '#6b728022', border: '1.5px solid #6b7280', color: '#6b7280', flexShrink: 0 }}>⚙</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{station.firstName}</div>
                <div className={styles.workPlanTaskList}>
                  {tasks.map(t => {
                    const project = t.projectId ? projectsById.get(t.projectId) : null;
                    const pColor = (project?.color as string | undefined) ?? '#9ca3af';
                    return (
                      <div key={t.id} className={styles.workPlanTaskItem}>
                        {project && (
                          <span className={styles.workPlanProjectChip} style={{ background: `${pColor}22`, color: pColor }} title={project.name}>
                            {project.name}
                          </span>
                        )}
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.title || '(cím nélkül)'}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
                          {fmtDuration(t)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {summary.onVacation.length > 0 && (
        <div className={styles.workPlanSection}>
          <div className={styles.workPlanSectionTitle}>
            🌴 Szabadságon — {summary.onVacation.length} fő
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {summary.onVacation.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#3b82f622', borderRadius: 8 }}>
                <div className={styles.personAvatar} style={{ background: `${avatarColor(p)}22`, border: `1.5px solid ${avatarColor(p)}`, color: avatarColor(p), width: 24, height: 24, fontSize: 10 }}>
                  {personInitial(p)}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{personName(p)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.free.length > 0 && (
        <div className={styles.workPlanSection}>
          <div className={styles.workPlanSectionTitle}>
            ✓ Szabad — {summary.free.length} fő
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {summary.free.map(p => (
              <span key={p.id} style={{ fontSize: 12, padding: '4px 10px', background: '#10b98122', color: '#10b981', borderRadius: 6 }}>
                {personName(p)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── CUSTOMER PICKER (a ProjectModal Áttekintés-tab-jában használt segéd) ── */
function CustomerPicker({
  projectId,
  currentId,
  onAssigned,
  onCancel,
}: {
  projectId: string;
  currentId?: string;
  onAssigned: () => void;
  onCancel?: () => void;
}) {
  const { customers } = useCustomers();
  const [selected, setSelected] = useState(currentId ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await apiClient.patch(`/projects/${projectId}`, { customerId: selected });
      onAssigned();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Mentés sikertelen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={saving}
        style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, minWidth: 200 }}
      >
        <option value="">— válassz megrendelőt —</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.company || `${c.firstName} ${c.lastName}`}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={save}
        disabled={!selected || saving || selected === currentId}
        style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'var(--brand-700, #15803d)', color: '#fff', border: 0, cursor: 'pointer', opacity: (!selected || saving || selected === currentId) ? 0.5 : 1 }}
      >
        {saving ? 'Mentés…' : 'Mentés'}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer' }}
        >
          Mégse
        </button>
      )}
    </div>
  );
}

/* ── PROJECT MODAL ────────────────────────────────────── */
function ProjectModal({
  project,
  onClose,
  onArchived,
}: {
  project: DashboardProject;
  onClose: () => void;
  onArchived: () => void;
}) {
  type ProjectTab = 'overview' | 'contract' | 'worksheet' | 'quote';
  const [tab, setTab] = useState<ProjectTab>('overview');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(project.name);
  const [savingName, setSavingName] = useState(false);

  // Ha a project-név változik a backend-en (más user átnevezte, vagy mi
  // mentettünk → re-fetch → új object), és a felhasználó NEM épp szerkeszti
  // (nincs különbség a current name és a project.name között), szinkronba
  // állítjuk a state-et. A `savingName` és `name !== project.name && name`
  // védi a felhasználó saját, még nem mentett gépelését.
  useEffect(() => {
    if (savingName) return;
    setName(project.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.name]);
  // Megrendelő-adatok az Áttekintés tab-on (customer-summary blokk).
  const { customer } = useCustomer(project.customerId ?? null);
  const [editingCustomer, setEditingCustomer] = useState(false);
  // Dokumentum-pipa-státuszok és a 3 panel forrás-adata.
  const { docs: quickDocs, mutate: mutateQuickDocs } = useProjectQuickDocs(project.id);
  const hasContract = hasQuickDoc(quickDocs, 'contract');
  const hasWorksheet = hasQuickDoc(quickDocs, 'worksheet');
  const hasQuote = hasQuickDoc(quickDocs, 'quote');
  // Workflow-állapot a 5-state panelhez.
  const { state: workflowState } = useProjectWorkflowState(project.id);

  async function archive() {
    if (!confirm(`Lezárod és archiválod a(z) "${project.name}" projektet?`)) return;
    setSaving(true);
    try {
      const { apiClient } = await import('@/lib/api-client');
      await apiClient.patch(`/projects/${project.id}/transition`, { transition: 'complete' }).catch(() => {});
      await apiClient.patch(`/projects/${project.id}/transition`, { transition: 'archive' });
      onArchived();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Projekt archiválás sikertelen');
    } finally {
      setSaving(false);
    }
  }

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === project.name) return;
    setSavingName(true);
    try {
      const { apiClient } = await import('@/lib/api-client');
      await apiClient.patch(`/projects/${project.id}`, { name: trimmed });
      onArchived(); // mutate parent overview
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Mentés sikertelen');
      setName(project.name);
    } finally {
      setSavingName(false);
    }
  }

  const tabs: Array<{ id: ProjectTab; label: string }> = [
    { id: 'overview',  label: 'Áttekintés' },
    { id: 'contract', label: 'Szerződés' },
    { id: 'worksheet', label: 'Munkalap' },
    { id: 'quote',    label: 'Árajánlat' },
  ];

  return (
    <div className={styles.modalBg} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <div>
            <div className={styles.modalSub}>Projekt</div>
            <div className={styles.modalTitle}>{name}</div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.chipList} style={{ marginBottom: 12 }}>
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              className={clsx(styles.chip, tab === t.id && styles.on)}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            <WorkflowStatusPanel
              state={workflowState}
              onNavigate={href => { window.location.href = href; }}
              onGenerateTasks={() => {
                if (workflowState?.workOrder) {
                  window.location.href = `/work-orders/${workflowState.workOrder.id}?action=generate-tasks`;
                }
              }}
            />
            <div className={styles.formRow}>
              <div className={styles.formLabel}>Név</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); saveName(); }
                    if (e.key === 'Escape') setName(project.name);
                  }}
                  maxLength={200}
                  disabled={savingName}
                  style={{
                    flex: 1, padding: '6px 10px', fontSize: 13,
                    border: '1px solid #e5e7eb', borderRadius: 6,
                  }}
                />
                {savingName && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Mentés…</span>}
                {!savingName && name.trim() !== project.name && name.trim() && (
                  <button
                    type="button"
                    onClick={saveName}
                    style={{
                      padding: '6px 12px', fontSize: 12,
                      background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    Mentés
                  </button>
                )}
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formLabel}>Állapot</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{project.state}</div>
            </div>

            {/* Megrendelő-blokk — mindig megjelenik. Ha a project.customerId be van
                állítva ÉS a customer betöltött, mutatja a részleteket + "Váltás"-gombot.
                Ha nincs hozzárendelve (NULL), a CustomerPicker dropdown jelenik meg. */}
            <div className={styles.formRow}>
              <div className={styles.formLabel}>Megrendelő</div>
              {editingCustomer ? (
                <CustomerPicker
                  projectId={project.id}
                  currentId={project.customerId}
                  onAssigned={() => { onArchived(); setEditingCustomer(false); }}
                  onCancel={() => setEditingCustomer(false)}
                />
              ) : project.customerId && customer ? (
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {customer.company || `${customer.firstName} ${customer.lastName}`}
                  </div>
                  {customer.company && (
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {customer.firstName} {customer.lastName}
                    </div>
                  )}
                  {customer.email && (
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      ✉ <a href={`mailto:${customer.email}`} style={{ color: 'inherit' }}>{customer.email}</a>
                    </div>
                  )}
                  {customer.phone && (
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      ☎ <a href={`tel:${customer.phone}`} style={{ color: 'inherit' }}>{customer.phone}</a>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingCustomer(true)}
                    style={{ fontSize: 11, marginTop: 4, padding: '2px 8px', borderRadius: 4, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer' }}
                    title="Másik megrendelőre vált"
                  >
                    ✏️ Váltás
                  </button>
                </div>
              ) : project.customerId && !customer ? (
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Megrendelő-adatok betöltése…</div>
              ) : (
                <CustomerPicker
                  projectId={project.id}
                  onAssigned={() => onArchived()}
                />
              )}
            </div>

            {/* Dokumentum-pipa-blokk — a 3 tab-fájl meglétét mutatja */}
            <div className={styles.formRow}>
              <div className={styles.formLabel}>Dokumentumok</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{hasContract ? '✅' : '⬜'}</span>
                  <span>Szerződés</span>
                  {hasContract && (
                    <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>
                      feltöltve
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{hasWorksheet ? '✅' : '⬜'}</span>
                  <span>Munkalap</span>
                  {hasWorksheet && (
                    <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>
                      feltöltve
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{hasQuote ? '✅' : '⬜'}</span>
                  <span>Árajánlat</span>
                  {hasQuote && (
                    <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>
                      feltöltve
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.formRow}>
              <a
                href={`/meeting/report/${project.id}`}
                target="_blank"
                rel="noreferrer"
                className={styles.switchBtn}
                style={{ width: '100%', justifyContent: 'center', padding: '10px', display: 'flex' }}
              >
                📄 Riport megnyitása
              </a>
            </div>
            <button
              type="button"
              onClick={archive}
              disabled={saving || project.state === 'archived'}
              className={styles.deleteBtn}
            >
              {saving ? 'Lezárás…' : project.state === 'archived' ? 'Már archivált' : 'Projekt lezárása és archiválása'}
            </button>
          </>
        )}

        {tab === 'contract' && (
          <>
            <WorkflowTabHeader kind="contract" state={workflowState} />
            <DocPanelCollapsed>
              <ProjectQuickDocPanel
                projectId={project.id}
                kind="contract"
                docs={filterQuickDocs(quickDocs, 'contract')}
                onMutate={() => mutateQuickDocs()}
              />
            </DocPanelCollapsed>
          </>
        )}
        {tab === 'worksheet' && (
          <>
            <WorkflowTabHeader kind="worksheet" state={workflowState} />
            <DocPanelCollapsed>
              <ProjectQuickDocPanel
                projectId={project.id}
                kind="worksheet"
                docs={filterQuickDocs(quickDocs, 'worksheet')}
                onMutate={() => mutateQuickDocs()}
              />
            </DocPanelCollapsed>
          </>
        )}
        {tab === 'quote' && (
          <>
            <WorkflowTabHeader kind="quote" state={workflowState} />
            <DocPanelCollapsed>
              <ProjectQuickDocPanel
                projectId={project.id}
                kind="quote"
                docs={filterQuickDocs(quickDocs, 'quote')}
                onMutate={() => mutateQuickDocs()}
              />
            </DocPanelCollapsed>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Drag-and-drop fájl-feltöltő a ProjectModal Szerződés / Munkalap / Árajánlat
 * tab-jaihoz. Egy fájl / projekt / kind — új feltöltés felülírja a meglévőt.
 * Bármilyen MIME-típus elfogadható (PDF, Word, Excel, JPG, PNG, stb.).
 */
/**
 * Több fájl/kind feltöltés-panel. Az új feltöltés MINDIG hozzáad —
 * a feltöltési zóna alatt a már meglévő fájlok listája jelenik meg,
 * mindegyiknél külön Letöltés és Törlés gomb. A 25 MB limit
 * és a 3 engedélyezett kind (contract/worksheet/quote) változatlan.
 */
function ProjectQuickDocPanel({
  projectId,
  kind,
  docs,
  onMutate,
}: {
  projectId: string;
  kind: ProjectQuickDocKind;
  docs: ProjectQuickDoc[];
  onMutate: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const titles: Record<ProjectQuickDocKind, { icon: string; label: string }> = {
    contract:  { icon: '📝', label: 'Szerződés' },
    worksheet: { icon: '📋', label: 'Munkalap' },
    quote:     { icon: '💰', label: 'Árajánlat' },
  };
  const { icon, label } = titles[kind];
  const hasDocs = docs.length > 0;

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    try {
      let ok = 0;
      for (const file of list) {
        if (file.size > 25 * 1024 * 1024) {
          toast.error(`${file.name}: ${(file.size / 1024 / 1024).toFixed(1)} MB — maximum 25 MB.`);
          continue;
        }
        try {
          await uploadProjectQuickDoc(projectId, kind, file);
          ok += 1;
        } catch (err: any) {
          toast.error(`${file.name}: ${err?.response?.data?.message ?? 'Feltöltés sikertelen'}`);
        }
      }
      if (ok > 0) {
        onMutate();
        toast.success(ok === 1 ? `${label} feltöltve` : `${ok} fájl feltöltve`);
      }
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files?.length) void handleFiles(files);
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <strong style={{ fontSize: 14 }}>{label}</strong>
        {hasDocs && (
          <span style={{ fontSize: 11, color: 'var(--green)', marginLeft: 'auto' }}>
            ✅ {docs.length} fájl
          </span>
        )}
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--today)' : 'var(--border)'}`,
          borderRadius: 10,
          padding: '24px 12px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? 'rgba(77, 124, 15, 0.06)' : 'var(--bg)',
          transition: 'border-color 0.15s, background 0.15s',
          opacity: uploading ? 0.6 : 1,
          marginBottom: 12,
        }}
        role="button"
        tabIndex={0}
      >
        {uploading ? (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Feltöltés…</div>
        ) : (
          <>
            <div style={{ fontSize: 30, marginBottom: 6 }}>📤</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              {hasDocs
                ? `További ${label.toLowerCase()} feltöltése`
                : `Húzd ide a ${label.toLowerCase()}-fájl(oka)t`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              vagy kattints a tallózáshoz · max 25 MB / fájl · több fájl is választható
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={e => {
            const files = e.target.files;
            if (files?.length) void handleFiles(files);
            e.target.value = ''; // reset to allow re-upload same name
          }}
        />
      </div>

      {hasDocs && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Feltöltött dokumentumok ({docs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {docs.map(d => (
              <ProjectQuickDocListItem
                key={d.id}
                projectId={projectId}
                doc={d}
                onMutate={onMutate}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A listát egy elem-soronkénti komponens jeleníti meg: file-nev, méret,
 * feltöltés-dátum, letöltés-link, törlés-gomb (2-kattintásos megerősítéssel).
 */
function ProjectQuickDocListItem({
  projectId,
  doc,
  onMutate,
}: {
  projectId: string;
  doc: ProjectQuickDoc;
  onMutate: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  function fmtSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  async function handleDownload() {
    try {
      const { url } = await getProjectQuickDocDownloadUrl(projectId, doc.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Letöltés sikertelen');
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 4000);
      return;
    }
    setDeleting(true);
    try {
      await deleteProjectQuickDoc(projectId, doc.id);
      onMutate();
      toast.success('Dokumentum törölve');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Törlés sikertelen');
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  }

  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 8, padding: 10,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 22 }}>📎</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.fileName}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          {fmtSize(Number(doc.sizeBytes))} · feltöltve: {new Date(doc.uploadedAt).toLocaleDateString('hu-HU', { dateStyle: 'medium' })}
        </div>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        className={styles.switchBtn}
        style={{ padding: '4px 10px', fontSize: 12 }}
        title="Letöltés"
      >
        ⬇
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className={styles.deleteBtn}
        style={{
          padding: '4px 10px', fontSize: 12, marginTop: 0,
          ...(deleteConfirm ? { background: 'rgba(220, 38, 38, 0.12)', borderColor: 'var(--red)', fontWeight: 700 } : {}),
        }}
        title={deleteConfirm ? 'Kattints újra a megerősítéshez' : 'Törlés'}
      >
        {deleting ? '…' : deleteConfirm ? '⚠️' : '🗑'}
      </button>
    </div>
  );
}

function ProjectModalPlaceholder({
  kind,
  project,
}: {
  kind: 'contract' | 'worksheet' | 'quote';
  project: DashboardProject;
}) {
  const config = {
    contract:  { title: 'Szerződés', icon: '📝', desc: 'A projekthez tartozó szerződés. Hamarosan elérhetővé válik a szerkesztés és a hatósági aláíratás.' },
    worksheet: { title: 'Munkalap',  icon: '📋', desc: 'Napi tevékenységi feljegyzések, anyagfelhasználás, idő-rögzítés. A teljes funkció előkészítés alatt áll.' },
    quote:     { title: 'Árajánlat', icon: '💰', desc: 'A projekthez kapcsolódó árajánlat(ok). PDF letöltés és e-mail küldés hamarosan.' },
  }[kind];
  const url = `/${kind === 'contract' ? 'contracts' : kind === 'worksheet' ? 'work-orders' : 'quotes'}?projectId=${project.id}`;

  return (
    <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--muted)' }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>{config.icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
        {config.title} — előkészítés alatt
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 320, margin: '0 auto 14px' }}>
        {config.desc}
      </p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: 'var(--today)', textDecoration: 'none',
          padding: '6px 12px', borderRadius: 8,
          border: '1px solid var(--border)',
        }}
      >
        Megnyitás külön oldalon →
      </a>
    </div>
  );
}

/**
 * FLIP animation hook a projekt-sorok smooth átrendezéséhez. Block-flow
 * reflow-t natívan nem animál a CSS, ezért a "First, Last, Invert, Play"
 * technikát használjuk: minden re-render után captureljük az új pozíciót,
 * összehasonlítjuk a régivel, és inverz transzformot alkalmazunk +
 * 200ms-os ease transition-nel az identitásra animálunk.
 */
function useFlipAnimation(
  containerRef: React.RefObject<HTMLElement>,
  orderKey: string,  // bármilyen string ami változik mikor az order változik
) {
  const prevPositions = useRef<Map<string, number>>(new Map());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const children = Array.from(container.children) as HTMLElement[];

    const newPositions = new Map<string, number>();
    children.forEach((child) => {
      const key = child.dataset.flipKey;
      if (!key) return;
      newPositions.set(key, child.getBoundingClientRect().top);
    });

    children.forEach((child) => {
      const key = child.dataset.flipKey;
      if (!key) return;
      const oldTop = prevPositions.current.get(key);
      const newTop = newPositions.get(key);
      if (oldTop === undefined || newTop === undefined) return;
      const delta = oldTop - newTop;
      if (Math.abs(delta) < 1) return;

      // Inverz transzform alkalmazása animáció nélkül.
      child.style.transition = 'none';
      child.style.transform = `translateY(${delta}px)`;

      // Force reflow, hogy a transform érvényesüljön.
      void child.offsetHeight;

      // Identitásra animálunk smooth ease-out 200ms alatt.
      child.style.transition = 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)';
      child.style.transform = '';
    });

    prevPositions.current = newPositions;
  }, [containerRef, orderKey]);
}

/* ── MAIN PAGE ──────────────────────────────────────────── */
/**
 * Merge PCs (equipment with category=pc) into the "people" list, so the Gantt
 * can assign tasks to a workstation (e.g. Törperős) the same way as to a human.
 * The actual operator isn't tracked — the spec is "whoever sits down at the PC".
 */
function augmentWithPcs(raw: DashboardOverview): DashboardOverview {
  const pcs = raw.equipment
    .filter(e => e.category === 'pc')
    .map<DashboardPerson>(e => ({
      id: e.id,
      firstName: e.name,
      lastName: '',
      role: 'Munkaállomás',
      roleType: 'mixed',
      displayColor: '#6b7280',
    }));
  // Filter out duplicates if someone has the same UUID in both (shouldn't happen).
  const existingIds = new Set(raw.people.map(p => p.id));
  const extra = pcs.filter(p => !existingIds.has(p.id));
  return { ...raw, people: [...raw.people, ...extra] };
}

/** A `scope` prop dönti, mely projekt-kategória-típusokat mutat:
 *  - `'project'` (default, /meeting URL): NEM-`OfficeAdmin` projektek
 *  - `'office'` (/office-admin URL): csak `OfficeAdmin`-kategóriájú projektek
 *  A workplan (Ki mit csinál) SZÁNDÉKOSAN figyelembe veszi MINDKETTŐ scope task-jait,
 *  hogy az irodai feladatok is megjelenjenek a napi terhelés-számolásban.
 *
 *  A komponens `export function`-ként él, hogy a Next.js page-PageProps típus
 *  ne ütközzön a `scope` prop-pal — a default export egy paraméter-nélküli wrapper. */
export function MeetingView({
  scope = 'project',
  categoryId,
  embedded = false,
}: { scope?: 'project' | 'office'; categoryId?: string; embedded?: boolean } = {}) {
  const t = useT();
  // Back-link kontextus: ha a MeetingView embed-elt nézetből van renderelve
  // (pl. /rooms?view=gantt), akkor az admin/standup/archive aloldalakra
  // navigálva is az EREDETI helyre kell visszatérni — különben a hardcoded
  // "Vissza /meeting"-re viszi a usert, akkor is, ha /rooms-ról indult.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const adminBackHref = useMemo(() => {
    const sp = searchParams?.toString();
    const here = sp ? `${pathname}?${sp}` : pathname;
    return `?back=${encodeURIComponent(here ?? '/meeting')}`;
  }, [pathname, searchParams]);
  const today = useMemo(() => startOfToday(), []);
  // Globális drag-aktív flag (TaskBar drag-drop). A ProjectRow `onDragActiveChange`
  // callback-en jelzi vissza, hogy a user aktív drag-állapotban van. Amíg ez
  // true, az SWR-revalidate (focus/poll/SSE) ki van kapcsolva — különben
  // a backend-ből visszajövő stale érték a drop pillanata UTÁN, de a
  // mutate-elő optimistic commit ELŐTT, visszadobná a barr-t a régi helyére
  // ("rugózik vissza" effekt).
  const [isDraggingTask, setIsDraggingTask] = useState(false);
  const { overview: rawOverview, isLoading, mutate } = useDashboardOverview(undefined, undefined, {
    pauseRevalidation: isDraggingTask,
  });
  const overview = useMemo(() => rawOverview ? augmentWithPcs(rawOverview) : null, [rawOverview]);

  /**
   * Optimistic-cache patch a drag-drop drop-pillanatára. A SWR `mutate`-et
   * `revalidate: false` opcióval hívjuk: a cache-be írt új tasks-array azonnal
   * látszódik, a backend-hívás után pedig az `await onTaskMutate()` revalidál.
   * Drag közben az SWR-fetch ki van kapcsolva (pauseRevalidation), így nincs
   * ablak ahol a stale érték villanna — ez a fő gyógymód a „rugózik vissza"-ra.
   */
  const optimisticTaskMutate = useCallback(
    async (
      draggedTaskId: string,
      patch: {
        newStartIso: string | null;
        newDuration: number | null;
        newLaneIndex: number | null;
        pushedStartIso: Map<string, string>;
      },
    ) => {
      await mutate(
        (cur) => {
          if (!cur) return cur;
          const nextTasks = cur.tasks.map((t): DashboardTask => {
            if (t.id === draggedTaskId) {
              const patched: DashboardTask = { ...t };
              if (patch.newStartIso) patched.startDate = patch.newStartIso;
              if (patch.newDuration != null) patched.duration = patch.newDuration;
              if (patch.newLaneIndex != null) patched.laneIndex = patch.newLaneIndex;
              // endDate-et töröljük, mert pontos érték a backend hatásköre —
              // a render-szint a startDate+duration-ből számolja vissza, ami a
              // friss adattal egyezni fog.
              if (patch.newStartIso || patch.newDuration != null) {
                patched.endDate = undefined;
              }
              return patched;
            }
            const pushedIso = patch.pushedStartIso.get(t.id);
            if (pushedIso) {
              return { ...t, startDate: pushedIso, endDate: undefined };
            }
            return t;
          });
          return { ...cur, tasks: nextTasks };
        },
        { revalidate: false },
      );
    },
    [mutate],
  );
  const clock = useLiveClock();
  const [sideOpen, setSideOpen] = useState(false);
  const { currentUser } = useCurrentUser();
  const [viewMode, setViewMode] = useState<'shared' | 'mine'>(() => {
    if (typeof window === 'undefined') return 'shared';
    const stored = localStorage.getItem('meeting-view-mode');
    return stored === 'mine' ? 'mine' : 'shared';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('meeting-view-mode', viewMode);
  }, [viewMode]);
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  /** Drag közbeni élő sorrend — minden onDragOver eseménynél frissül, hogy
   *  a user lássa, hová kerül a húzott projekt. Drop után a backend hívás
   *  elindul, és a `mutate()` után a `null`-ra megy vissza. */
  const [pendingOrderIds, setPendingOrderIds] = useState<string[] | null>(null);
  const [taskModal, setTaskModal] = useState<DashboardTask | null>(null);
  const [dayModal, setDayModal] = useState<string | null>(null);
  const [weatherDayIso, setWeatherDayIso] = useState<string | null>(null);
  const { city: weatherCity, setCity: setWeatherCity } = useWeatherCity();
  const { forecast: weatherForecast } = useWeatherForecast(weatherCity.lat, weatherCity.lng);
  const { thresholds: weatherThresholds } = useWeatherThresholds();
  const { taskTypes } = useTaskTypes();

  // ── Lane-collapse state (multi-lane projektek) ────────────────────────────
  // Per-projekt csukva-állapot, localStorage-ben perzisztálva. Új multi-lane
  // projekt először-betöltéskor automatikusan becsukódik (kivéve ha a user
  // már explicit kinyitotta egyszer és a localStorage-ben van rekord).
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem('meeting-collapsed-projects');
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.filter((x): x is string => typeof x === 'string'));
    } catch {
      return new Set();
    }
  });
  // localStorage azonosítója annak, hogy melyik projekt-ID-kre futott már le
  // a default-collapse logika (különben minden reload-on újra-becsukná, miután
  // a user kinyitotta).
  const [seenProjects, setSeenProjects] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem('meeting-seen-projects');
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.filter((x): x is string => typeof x === 'string'));
    } catch {
      return new Set();
    }
  });
  const toggleCollapse = useCallback((projectId: string) => {
    setCollapsedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('meeting-collapsed-projects', JSON.stringify([...next]));
      }
      return next;
    });
  }, []);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskDefaults, setNewTaskDefaults] = useState<{ projectId?: string; startDate?: string }>({});
  const [newTaskTemplateContext, setNewTaskTemplateContext] = useState<{ fromTaskTitle: string; offsetDays: number } | undefined>(undefined);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newPingOpen, setNewPingOpen] = useState(false);
  // Egyszerre csak egy PingMarker popover lehet nyitva — a stack-helő
  // ablakok elkerülése + outside-click close érdekében a state itt fent
  // (MeetingView) van és propagálódik le a ProjectRow-ig.
  const [openPingId, setOpenPingId] = useState<string | null>(null);
  const [projectModal, setProjectModal] = useState<DashboardProject | null>(null);
  // A nyitva tartott ProjectModal-objektumot az overview frissülésekor szinkronizáljuk
  // a friss DashboardProject-tel (id alapján). Anélkül a modal egy SNAPSHOT-tal nyit
  // meg, és pl. customer-hozzárendelés után az új customerId nem jelenik meg,
  // amíg a user ki+újra-nem kattint a projektre.
  useEffect(() => {
    if (!projectModal || !overview) return;
    const fresh = overview.projects.find(p => p.id === projectModal.id);
    if (fresh && fresh !== projectModal) {
      setProjectModal(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview]);
  const [dayWidth, setDayWidth] = useState(DAY_W_DEFAULT);
  const [daysAhead, setDaysAhead] = useState(DAYS_AHEAD_DEFAULT);
  // Hány nappal vissza is mutassuk a múltat — admin-beállítás localStorage-ben.
  const [daysBehind] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const v = parseInt(localStorage.getItem('meetingDaysBehind') ?? '0', 10);
    return isNaN(v) ? 0 : Math.max(0, Math.min(180, v));
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const ganttWrapRef = useRef<HTMLDivElement>(null);
  const ganttContainerRef = useRef<HTMLDivElement>(null);

  // Fullscreen API
  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  // Navigáció a Gantt-on:
  //   • görgő        → függőleges scroll (alapértelmezett böngészőviselkedés)
  //   • Shift+görgő  → vízszintes scroll (deltaY → scrollLeft)
  //   • Ctrl+görgő   → zoom in/out (a Gantt-on, nem a böngészőn)
  //
  // A handler `document`-en, capture fázisban fut, hogy biztosan minden
  // gyermekelem előtt elkapja az eseményt — különben a böngésző Ctrl+görgő
  // page-zoom-ja érvényesülne.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const wrap = ganttWrapRef.current;
      if (!wrap) return;
      const target = e.target as Node | null;
      const insideGantt = !!target && wrap.contains(target);

      if (e.ctrlKey || e.metaKey) {
        // Ctrl+görgő: csak akkor zoomoljuk a Gantt-ot, ha a kurzor felette
        // van; egyébként hagyjuk a böngésző natív zoom-ját.
        if (!insideGantt) return;
        e.preventDefault();
        setDayWidth(w => {
          const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
          return Math.max(DAY_W_MIN, Math.min(DAY_W_MAX, w * factor));
        });
        return;
      }
      if (insideGantt && e.shiftKey && (e.deltaY !== 0 || e.deltaX !== 0)) {
        // Shift+görgő → vízszintes pan a Gantt wrapper-en.
        e.preventDefault();
        wrap.scrollLeft += e.deltaY !== 0 ? e.deltaY : e.deltaX;
        return;
      }
      // Egyébként a natív függőleges scroll érvényesül.
    };
    document.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => document.removeEventListener('wheel', onWheel, { capture: true } as any);
  }, []);

  const days = useMemo(
    () => overview ? buildDays(today, overview.dayAnnotations, daysAhead, daysBehind) : [],
    [overview, today, daysAhead, daysBehind],
  );
  const planes = useMemo(
    () => {
      if (!overview) return [];
      const all = buildProjectLanes(overview, today);
      // Ha categoryId meg van adva (szoba-szintű Gantt a /rooms-ban), csak az
      // adott szoba projektjeit mutatjuk — overrideolva a scope-szűrést.
      // Egyébként scope-alapján: a /meeting (project) elrejti a OfficeAdmin-
      // kategóriát; a /office-admin csak ezeket mutatja. A workplan logikája
      // SZÁNDÉKOSAN figyelembe veszi mindkettő scope task-jait, hogy a napi
      // terhelés-nézet teljes legyen — ezt a `computeWorkPlanForDay` az
      // `overview.tasks` egészével dolgozza, scope-tól függetlenül.
      if (categoryId) {
        return all.filter(p => p.project.categoryId === categoryId);
      }
      // Projekt map (scope) szűrés: a kategória-szintű `showInProjectMap=false`
      // projekteket (pl. Drón ügyintézés szoba) kihagyjuk — azok csak a /rooms
      // szobában (categoryId-override ág) látszanak.
      return all.filter(p =>
        p.project.showInProjectMap !== false &&
        (scope === 'office'
          ? p.project.categoryType === 'OfficeAdmin'
          : p.project.categoryType !== 'OfficeAdmin'),
      );
    },
    [overview, today, scope, categoryId],
  );

  // Auto-collapse logika: minden új multi-lane projektet először-bezárt
  // állapotba teszünk (egyszer, a `seenProjects` set megakadályozza, hogy
  // a user-explicit kinyitás után a következő reload-kor újra-becsukja).
  // Auto-uncollapse: ha egy projekt visszaesett 1 sávra (task delete), kivesszük
  // a collapsedProjects-ből, mert felesleges egysávos projektet "csukva" tartani.
  useEffect(() => {
    if (planes.length === 0) return;
    let collapsedChanged = false;
    let seenChanged = false;
    const nextCollapsed = new Set(collapsedProjects);
    const nextSeen = new Set(seenProjects);
    for (const p of planes) {
      const id = p.project.id;
      if (p.numLanes > 1 && !nextSeen.has(id)) {
        // Új multi-lane projekt — automatikusan becsukva
        nextCollapsed.add(id);
        nextSeen.add(id);
        collapsedChanged = true;
        seenChanged = true;
      } else if (p.numLanes <= 1 && nextCollapsed.has(id)) {
        // Visszaesett 1 sávra — fölösleges csukva tartani
        nextCollapsed.delete(id);
        collapsedChanged = true;
      }
    }
    if (collapsedChanged) {
      setCollapsedProjects(nextCollapsed);
      if (typeof window !== 'undefined') {
        localStorage.setItem('meeting-collapsed-projects', JSON.stringify([...nextCollapsed]));
      }
    }
    if (seenChanged) {
      setSeenProjects(nextSeen);
      if (typeof window !== 'undefined') {
        localStorage.setItem('meeting-seen-projects', JSON.stringify([...nextSeen]));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planes]);

  // "Saját" módban csak azok a projektek látszanak, amelyekben a current
  // user-nek (akár assignee, akár helper) van AKTÍV (nem completed/cancelled)
  // task-ja. A rendezés a leghamarabb-induló saját task szerint csökken,
  // hogy a "mit kell most csinálni" tetejére kerüljön. Közös módban nincs
  // szűrés, és a backend sortIndex-szerű sorrend érvényesül.
  const visiblePlanes = useMemo(() => {
    if (!planes.length || !overview) return planes;
    if (viewMode === 'shared' || !currentUser) return planes;

    const earliestByProject = new Map<string, number>();
    const myUserId = currentUser.id;
    const isMine = (t: DashboardTask) =>
      t.assignedTo === myUserId || (t.helpers ?? []).includes(myUserId);

    // Saját módban a projekteken belül CSAK a saját task-ok látszanak.
    // A lane-ek újraépülnek a szűrt halmazból, kompakt formában (üres lane-ek
    // kihagyva), hogy ne maradjon vizuális üres lyuk a kollégák task-jai helyén.
    const filteredPlanes: ProjectLane[] = [];
    for (const plane of planes) {
      const myTasks = plane.lanes.flat().filter(t => {
        if (t.status === 'completed' || t.status === 'cancelled') return false;
        return isMine(t);
      });
      if (myTasks.length === 0) continue;
      // Csoportosítás eredeti laneIndex szerint, üres slot-ok elhagyva, és
      // tömörítve 0..N-1-re. Így a saját task-ok mindig a sor tetején kezdődnek.
      const lanesMap = new Map<number, DashboardTask[]>();
      for (const t of myTasks) {
        const li = Math.max(0, Math.min(MAX_LANE_INDEX, Math.floor(t.laneIndex ?? 0)));
        const arr = lanesMap.get(li) ?? [];
        arr.push(t);
        lanesMap.set(li, arr);
      }
      const sortedKeys = [...lanesMap.keys()].sort((a, b) => a - b);
      const lanes = sortedKeys.map(k =>
        (lanesMap.get(k) ?? []).sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '')),
      );
      filteredPlanes.push({ ...plane, lanes, numLanes: Math.max(1, lanes.length) });
      // Sorrend: leghamarabb-induló saját task szerint
      const earliestMs = Math.min(...myTasks
        .filter(t => t.startDate)
        .map(t => parseDate(t.startDate!).getTime()));
      if (Number.isFinite(earliestMs)) {
        earliestByProject.set(plane.project.id, earliestMs);
      }
    }
    return filteredPlanes.sort((a, b) => {
      const tA = earliestByProject.get(a.project.id) ?? Infinity;
      const tB = earliestByProject.get(b.project.id) ?? Infinity;
      return tA - tB;
    });
  }, [planes, overview, viewMode, currentUser]);

  /** A render-elt projektsorrend. Ha drag közben pendingOrderIds-t állítottunk,
   *  azt használjuk, hogy élőben látszódjon az átrendeződés. Egyébként a
   *  visiblePlanes-t (Közös vagy Saját). */
  const orderedPlanes = useMemo(() => {
    if (!pendingOrderIds) return visiblePlanes;
    const map = new Map(visiblePlanes.map(p => [p.project.id, p]));
    const result: ProjectLane[] = [];
    for (const id of pendingOrderIds) {
      const p = map.get(id);
      if (p) result.push(p);
    }
    // Ha bármelyik projekt nem szerepel a pendingOrder-ben (új projekt jött
    // be SWR refresh-ből drag közben), a végére tesszük.
    for (const p of visiblePlanes) {
      if (!pendingOrderIds.includes(p.project.id)) result.push(p);
    }
    return result;
  }, [visiblePlanes, pendingOrderIds]);

  /** FLIP-animáció a projektsorok átrendezésére. A `orderKey` a sor-id-k
   *  összefűzött stringje — amikor változik (drag-drop swap), a hook
   *  smooth-csúsztatja a sorokat az új helyükre 200ms alatt. */
  const orderKey = useMemo(() => orderedPlanes.map(p => p.project.id).join('|'), [orderedPlanes]);
  useFlipAnimation(ganttContainerRef, orderKey);

  /** Animation-lock: a swap után 220ms-ig (FLIP transition + kis buffer)
   *  ignoráljuk a dragOver-eket. Ezzel gyors drag (pl. legalsó projekt →
   *  legfelülre) nem indít 10+ átfedő FLIP animációt — maximum 2-3 nagyot
   *  egymás után, és a FLIP egyszerre animálja az összes érintett sort. */
  const animationLockRef = useRef(false);

  /** Drag közbeni élő-átrendezés MIDPOINT-alapú insertion-nel + lock-kal.
   *
   *  Midpoint: a kurzor Y-pozícióját az érintett sor felső/alsó feléhez
   *  hasonlítjuk → stabil insertion-target a többsávos projekteken is.
   *  Lock: animáció közben ignoráljuk a dragOver-eket, hogy gyors drag
   *  esetén a sorok ne pattogjanak. A következő reorder a TÉNYLEGES
   *  végpozícióra ugrik (akár több sort átugorva — a FLIP egyszerre
   *  animálja mindenkit). */
  const handleProjectDragOver = useCallback((
    overId: string,
    mouseY: number,
    rowTop: number,
    rowHeight: number,
  ) => {
    if (animationLockRef.current) return;
    if (!draggingProjectId || draggingProjectId === overId) return;
    setPendingOrderIds((prev) => {
      const baseOrder = prev ?? visiblePlanes.map(p => p.project.id);
      const fromIdx = baseOrder.indexOf(draggingProjectId);
      const overIdx = baseOrder.indexOf(overId);
      if (fromIdx === -1 || overIdx === -1) return prev;

      const isUpperHalf = mouseY < rowTop + rowHeight / 2;
      const insertBeforeIdx = isUpperHalf ? overIdx : overIdx + 1;
      const actualTargetIdx = fromIdx < insertBeforeIdx ? insertBeforeIdx - 1 : insertBeforeIdx;
      if (fromIdx === actualTargetIdx) return prev;

      const next = [...baseOrder];
      next.splice(fromIdx, 1);
      next.splice(actualTargetIdx, 0, draggingProjectId);

      // Lock: 220ms = FLIP transition (200) + 20ms buffer
      animationLockRef.current = true;
      setTimeout(() => { animationLockRef.current = false; }, 220);

      return next;
    });
  }, [draggingProjectId, visiblePlanes]);

  /** Drop vagy dragEnd után: a pending sorrendet a backend-re küldjük, és
   *  vissza-szinkronizáljuk az SWR-t. Ha a user csak megfogta de nem
   *  mozdította, a pending null és nincs mentés. */
  const handleProjectDragEnd = useCallback(async () => {
    setDraggingProjectId(null);
    if (!pendingOrderIds) return;
    const order = pendingOrderIds;
    try {
      await apiClient.post('/projects/reorder', { orderedIds: order });
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t.meeting.controlbar.reorderFail);
    } finally {
      setPendingOrderIds(null);
    }
  }, [pendingOrderIds, mutate, t]);
  const slippingIds = useMemo(() => {
    if (!overview) return new Set<string>();
    const set = new Set<string>();
    for (const t of overview.tasks) {
      // Draft task-ok (árazógép-importból piszkozat) NEM csúsznak — csak
      // a véglegesítés után kezdődik a csúszás-figyelés.
      if (t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'draft' && t.endDate) {
        if (parseDate(t.endDate) < today) set.add(t.id);
      }
    }
    return set;
  }, [overview, today]);

  const statusText = useMemo(() => {
    if (!overview) return t.meeting.controlbar.statusEmpty;
    const slipping = Array.from(slippingIds).length;
    const active = overview.tasks.filter(task => task.status === 'pending' || task.status === 'in_progress').length;
    const done = overview.tasks.filter(task => task.status === 'completed').length;
    return t.meeting.controlbar.statusFmt(overview.projects.length, active, slipping, done);
  }, [overview, slippingIds, t]);

  if (isLoading && !overview) {
    return (
      <div className={clsx(styles.root, embedded && styles.embedded)}>
        <div className={styles.loading}>{t.meeting.controlbar.loading}</div>
      </div>
    );
  }
  if (!overview) {
    return (
      <div className={clsx(styles.root, embedded && styles.embedded)}>
        <div className={styles.loading}>{t.meeting.controlbar.loadFail}</div>
      </div>
    );
  }

  const zoomPct = Math.round((dayWidth / DAY_W_DEFAULT) * 100);

  return (
    <div
      ref={rootRef}
      className={clsx(styles.root, isFullscreen && styles.fullscreen, embedded && styles.embedded)}
      style={{ ['--day-w' as any]: `${dayWidth}px` }}
    >
      <div className={styles.top}>
        <div>
          <button className={styles.brand} onClick={() => setSideOpen(o => !o)} title={t.meeting.controlbar.brandTooltip}>
            <MapIcon className="w-5 h-5" style={{ color: 'var(--today)' }} />
            {scope === 'office' ? t.meeting.controlbar.brandOffice : t.meeting.controlbar.brandProject}
          </button>
          <div className={styles.subtitle}>{statusText}</div>
        </div>

        <div className={styles.switchBar}>
          {/* Közös ↔ Saját nézet toggle. Saját = csak ahol nekem aktív task-om
              van, a leghamarabb-induló task szerint sorrendezve (felül a
              soron-következő). */}
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', marginRight: 4 }}>
            <button
              type="button"
              onClick={() => setViewMode('shared')}
              style={{
                padding: '6px 12px',
                background: viewMode === 'shared' ? '#6366f1' : 'transparent',
                color: viewMode === 'shared' ? '#fff' : 'var(--text)',
                border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12,
                fontFamily: 'inherit',
              }}
              title={t.meeting.controlbar.viewModeSharedTooltip}
            >
              {t.meeting.controlbar.viewModeSharedLabel}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('mine')}
              style={{
                padding: '6px 12px',
                background: viewMode === 'mine' ? '#6366f1' : 'transparent',
                color: viewMode === 'mine' ? '#fff' : 'var(--text)',
                border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12,
                fontFamily: 'inherit',
              }}
              title={t.meeting.controlbar.viewModeMineTooltip}
            >
              {t.meeting.controlbar.viewModeMineLabel}
            </button>
          </div>
          <div className={styles.zoomBar}>
            <button type="button" className={styles.zoomBtn} onClick={() => setDayWidth(w => Math.max(DAY_W_MIN, w / 1.25))} title={t.meeting.controlbar.zoomOutTooltip}>
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className={styles.zoomLabel}>{zoomPct}%</span>
            <button type="button" className={styles.zoomBtn} onClick={() => setDayWidth(w => Math.min(DAY_W_MAX, w * 1.25))} title={t.meeting.controlbar.zoomInTooltip}>
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
          <button type="button" onClick={toggleFullscreen} className={styles.switchBtn} title={t.meeting.controlbar.fullscreenTooltip}>
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button type="button" onClick={() => setSideOpen(o => !o)} className={styles.switchBtn} title={t.meeting.controlbar.sidePanelTooltip}>
            <PanelRight className="w-3.5 h-3.5" />
          </button>
          <Link href={`/meeting/standup${adminBackHref}`} className={styles.switchBtn}>{t.meeting.controlbar.standupLink}</Link>
          <Link href={`/meeting/archive${adminBackHref}`} className={styles.switchBtn}>{t.meeting.controlbar.archiveLink}</Link>
          <Link href={`/meeting/admin${adminBackHref}`} className={styles.switchBtn}>{t.meeting.controlbar.adminLink}</Link>
        </div>

        <div>
          <div className={styles.clock}>{clock.time}</div>
          <div className={styles.date}>{clock.date}</div>
        </div>
      </div>

      <div className={styles.ganttWrap} ref={ganttWrapRef}>
        <div className={styles.gantt} ref={ganttContainerRef}>
          <GanttHeader
            days={days}
            dayWidth={dayWidth}
            onDayClick={iso => setDayModal(iso)}
            onLoadMore={() => setDaysAhead(d => d + DAYS_AHEAD_INCREMENT)}
            forecast={weatherForecast}
            thresholds={weatherThresholds}
            onWeatherClick={iso => setWeatherDayIso(iso)}
            weatherCityKey={weatherCity.key}
            onWeatherCityChange={key => {
              const c = WEATHER_CITIES.find(x => x.key === key);
              if (c) setWeatherCity(c);
            }}
          />
          {orderedPlanes.map(plane => (
            <ProjectRow
              key={plane.project.id}
              plane={plane}
              days={days}
              today={today}
              overview={overview}
              onTaskClick={t => setTaskModal(t)}
              onProjectClick={p => setProjectModal(p)}
              onEmptyClick={(projectId, startDate) => {
                setNewTaskDefaults({ projectId, startDate });
                setNewTaskOpen(true);
              }}
              onTaskMutate={mutate}
              onOptimisticMutate={optimisticTaskMutate}
              onDragActiveChange={setIsDraggingTask}
              slippingIds={slippingIds}
              dayWidth={dayWidth}
              daysAhead={daysAhead}
              daysBehind={daysBehind}
              draggable={viewMode === 'shared'}
              draggingProjectId={draggingProjectId}
              onProjectDragStart={(id) => setDraggingProjectId(id)}
              onProjectDragEnd={handleProjectDragEnd}
              onProjectDragOver={handleProjectDragOver}
              taskTypes={taskTypes}
              isCollapsed={collapsedProjects.has(plane.project.id)}
              onToggleCollapse={toggleCollapse}
              openPingId={openPingId}
              onOpenPing={setOpenPingId}
            />
          ))}
          {viewMode === 'mine' && visiblePlanes.length === 0 && planes.length > 0 && (
            <div className={styles.loading} style={{ padding: 40, textAlign: 'center' }}>
              {t.meeting.controlbar.noMineTasksPrefix} <button onClick={() => setViewMode('shared')} style={{ background: 'none', border: 'none', color: 'var(--brand-600, #6366f1)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}>{t.meeting.controlbar.switchToShared}</button> {t.meeting.controlbar.noMineTasksSuffix}
            </div>
          )}
          {planes.length === 0 && (
            <div className={styles.loading} style={{ padding: 40 }}>
              {t.meeting.controlbar.noProjects}
            </div>
          )}
          {/* Load-more affordance past the end of the current window */}
          {planes.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0', background: 'var(--bg)' }}>
              <button
                type="button"
                onClick={() => setDaysAhead(d => d + DAYS_AHEAD_INCREMENT)}
                className={styles.switchBtn}
              >
                {t.meeting.controlbar.loadMore}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.legend}>
        <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: 'var(--green)' }} />{t.meeting.controlbar.legendNormal}</div>
        <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: 'var(--red)' }} />{t.meeting.controlbar.legendSlipping}</div>
        <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: 'var(--yellow)' }} />{t.meeting.controlbar.legendCollision}</div>
        <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: 'var(--orange)' }} />{t.meeting.controlbar.legendDanger}</div>
        <div className={styles.legendItem} style={{ color: 'var(--muted)', fontSize: 11 }}>
          {t.meeting.controlbar.legendTip}
        </div>
        <div style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 11 }}>
          {t.meeting.controlbar.legendScroll}
        </div>
      </div>

      {/* Floating action buttons (bottom right) — lépcsőzetes:
          a 3 gomb bal széle igazítva, a jobb szél a tartalom hosszával lépcsőzik.
          Legkeskenyebb felül (Új harang), legszélesebb alul (Új projekt). */}
      <div className={styles.fab} style={{ alignItems: 'flex-start' }}>
        <button
          type="button"
          onClick={() => setNewPingOpen(true)}
          className={styles.fabBtn}
          style={{ background: '#fbbf24', color: '#78350f', border: '1px solid #d97706' }}
          title={t.meeting.controlbar.fabBellTooltip}
        >
          {t.meeting.controlbar.fabBellLabel}
        </button>
        <button
          type="button"
          onClick={() => setNewTaskOpen(true)}
          className={clsx(styles.fabBtn, styles.fabBtnSecondary)}
          title={t.meeting.controlbar.fabTaskTooltip}
        >
          <Plus className="w-4 h-4" /> {t.meeting.controlbar.fabTaskLabel}
        </button>
        <button
          type="button"
          onClick={() => setNewProjectOpen(true)}
          className={styles.fabBtn}
          title={t.meeting.controlbar.fabProjectTooltip}
        >
          <Plus className="w-5 h-5" /> {t.meeting.controlbar.fabProjectLabel}
        </button>
      </div>

      <SidePanel open={sideOpen} overview={overview} today={today} />

      {taskModal && (
        <TaskModal
          task={taskModal}
          overview={overview}
          onClose={() => setTaskModal(null)}
          onSaved={() => mutate()}
          onNavigate={t => setTaskModal(t)}
          onContinue={(projectId, startDate) => {
            setTaskModal(null);
            setNewTaskDefaults({ projectId, startDate });
            setNewTaskTemplateContext(undefined);
            setNewTaskOpen(true);
          }}
          onTemplateFallback={(projectId, startDate, fromTaskTitle, offsetDays) => {
            setTaskModal(null);
            setNewTaskDefaults({ projectId, startDate });
            setNewTaskTemplateContext({ fromTaskTitle, offsetDays });
            setNewTaskOpen(true);
          }}
        />
      )}
      {dayModal && <DayModal date={dayModal} overview={overview} onClose={() => setDayModal(null)} onSaved={() => mutate()} />}
      {weatherDayIso && (
        <WeatherDayModal
          dateIso={weatherDayIso}
          forecast={weatherForecast}
          thresholds={weatherThresholds}
          overview={overview}
          onClose={() => setWeatherDayIso(null)}
        />
      )}
      {newTaskOpen && (
        <NewTaskModal
          overview={overview}
          defaults={newTaskDefaults}
          templateContext={newTaskTemplateContext}
          onClose={() => { setNewTaskOpen(false); setNewTaskDefaults({}); setNewTaskTemplateContext(undefined); }}
          onSaved={() => mutate()}
        />
      )}
      {newProjectOpen && <NewProjectModal onClose={() => setNewProjectOpen(false)} onSaved={() => mutate()} />}
      {newPingOpen && (
        <NewPingModal
          overview={overview}
          defaultUserId={currentUser?.id}
          onClose={() => setNewPingOpen(false)}
          onSaved={() => mutate()}
        />
      )}
      {projectModal && <ProjectModal project={projectModal} onClose={() => setProjectModal(null)} onArchived={() => mutate()} />}
    </div>
  );
}

/* ── NEW PROJECT MODAL ──────────────────────────────────── */
function NewProjectModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { templates } = useProjectTemplates(false);
  const [mode, setMode] = useState<'empty' | 'template'>('empty');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateId, setTemplateId] = useState<string>('');
  const [templateInputs, setTemplateInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const selectedTemplate = templates.find(t => t.id === templateId);

  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find(x => x.id === id);
    if (t && !name.trim()) setName(t.name);
    const init: Record<string, string> = {};
    t?.inputs.forEach(i => { init[i.inputKey] = ''; });
    setTemplateInputs(init);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (mode === 'template') {
      if (!templateId) { toast.error('Válassz egy sablont'); return; }
      const missing = (selectedTemplate?.inputs ?? []).filter(i => i.required !== false && !templateInputs[i.inputKey]);
      if (missing.length > 0) {
        toast.error(`Hiányzó paraméter: ${missing.map(i => i.label).join(', ')}`);
        return;
      }
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || undefined,
      };
      if (mode === 'template' && templateId) {
        payload.templateId = templateId;
        payload.templateInputs = templateInputs;
      }
      await apiClient.post('/projects', payload);
      // Sablon-specifikus animáció: Zöldfelületi → leveleső.
      if (mode === 'template' && selectedTemplate?.name) {
        const tplName = selectedTemplate.name.toLowerCase();
        if (tplName.includes('zöldfelület') || tplName.includes('zoldfelulet')) {
          void import('@/lib/animations/leaf-rain').then(m => m.triggerLeafRain());
        }
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error('Nem sikerült a projekt létrehozása: ' + (err?.response?.data?.message ?? err.message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.modalBg} onClick={onClose}>
      <form className={styles.modal} onClick={e => e.stopPropagation()} onSubmit={save}>
        <div className={styles.modalHead}>
          <div>
            <div className={styles.modalSub}>Új projekt</div>
            <div className={styles.modalTitle}>Projekt létrehozása</div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Mód-választó: üres vs sablon. A sablon-flow csak akkor aktív, ha van legalább 1 aktív sablon. */}
        <div className={styles.formRow}>
          <div className={styles.formLabel}>Létrehozás módja</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setMode('empty')}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                border: mode === 'empty' ? '2px solid #16a34a' : '1px solid #d1d5db',
                background: mode === 'empty' ? '#f0fdf4' : '#fff',
                fontSize: 13, textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: 600 }}>Üres projekt</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Csak alap-adatok</div>
            </button>
            <button
              type="button"
              onClick={() => setMode('template')}
              disabled={templates.length === 0}
              title={templates.length === 0 ? 'Nincs aktív sablon' : ''}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 8, cursor: templates.length === 0 ? 'not-allowed' : 'pointer',
                border: mode === 'template' ? '2px solid #16a34a' : '1px solid #d1d5db',
                background: mode === 'template' ? '#f0fdf4' : '#fff',
                opacity: templates.length === 0 ? 0.5 : 1,
                fontSize: 13, textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: 600 }}>Sablon alapján</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{templates.length} sablon</div>
            </button>
          </div>
        </div>

        {/* Sablon-választó + paraméterek */}
        {mode === 'template' && (
          <>
            <div className={styles.formRow}>
              <div className={styles.formLabel}>Sablon</div>
              <select
                className={styles.formInput}
                value={templateId}
                onChange={e => pickTemplate(e.target.value)}
              >
                <option value="">— válassz sablont —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.steps.length} lépés)</option>
                ))}
              </select>
            </div>
            {selectedTemplate?.description && (
              <div style={{ fontSize: 12, color: '#6b7280', padding: '0 0 8px' }}>
                {selectedTemplate.description}
              </div>
            )}
            {selectedTemplate && selectedTemplate.inputs.length > 0 && (
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Paraméterek
                </div>
                {selectedTemplate.inputs.map(inp => (
                  <div key={inp.inputKey} className={styles.formRow} style={{ marginBottom: 6 }}>
                    <div className={styles.formLabel}>{inp.label}{inp.required !== false && ' *'}</div>
                    <input
                      type={inp.inputType === 'datetime' ? 'datetime-local' : inp.inputType === 'date' ? 'date' : 'text'}
                      className={styles.formInput}
                      value={templateInputs[inp.inputKey] ?? ''}
                      onChange={e => setTemplateInputs(prev => ({ ...prev, [inp.inputKey]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className={styles.formRow}>
          <div className={styles.formLabel}>Név</div>
          <input
            className={styles.formInput}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="pl. Budaörsi ipari terület"
            required
            autoFocus
          />
        </div>

        <div className={styles.formRow}>
          <div className={styles.formLabel}>Leírás (opcionális)</div>
          <textarea
            className={styles.formInput}
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <button type="submit" className={styles.saveBtn} disabled={saving || !name.trim()}>
          {saving ? 'Létrehozás…' : 'Projekt létrehozása'}
        </button>
      </form>
    </div>
  );
}

/* ── NEW PING MODAL ──────────────────────────────────────
 * Időzített "harang" (ScheduledNotification) létrehozása.
 * Két fő művelet: Időzítés (jövőbeli scheduledFor) és Küldd most
 * (azonnali insert + dispatch). A user saját magát is választhatja,
 * így a teljes pipeline (in-app bell + Expo push, ha van token) tesztelhető.
 */
function NewPingModal({
  overview, defaultUserId, onClose, onSaved,
}: {
  overview: DashboardOverview;
  defaultUserId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Default scheduledFor: most + 60 perc, kerekítve percre. A datetime-local
  // input "YYYY-MM-DDTHH:mm" formátumot vár.
  const defaultScheduled = useMemo(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  const [userId, setUserId] = useState<string>(defaultUserId ?? '');
  const [scheduledFor, setScheduledFor] = useState<string>(defaultScheduled);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [projectId, setProjectId] = useState('');
  const [saving, setSaving] = useState(false);

  // Csak emberi felhasználók (munkaállomásokat kihagyjuk a recipient-listából).
  const candidates = overview.people.filter(p => p.role !== 'Munkaállomás');

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !userId || !scheduledFor) return;
    setSaving(true);
    try {
      await apiCreatePing({
        userId,
        scheduledFor: new Date(scheduledFor).toISOString(),
        title: title.trim(),
        body: body.trim() || undefined,
        projectId: projectId || undefined,
      });
      toast.success('Harang időzítve');
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg ?? `Időzítés sikertelen: ${err?.message ?? 'ismeretlen'}`));
    } finally {
      setSaving(false);
    }
  }

  async function handleSendNow() {
    if (!title.trim() || !userId) return;
    setSaving(true);
    try {
      await apiCreateAndSendNow({
        userId,
        title: title.trim(),
        body: body.trim() || undefined,
        projectId: projectId || undefined,
      });
      toast.success('Értesítés elküldve');
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg ?? `Küldés sikertelen: ${err?.message ?? 'ismeretlen'}`));
    } finally {
      setSaving(false);
    }
  }

  const isSelf = userId === defaultUserId;

  return (
    <div className={styles.modalBg} onClick={onClose}>
      <form className={styles.modal} onClick={e => e.stopPropagation()} onSubmit={handleSchedule}>
        <div className={styles.modalHead}>
          <div>
            <div className={styles.modalSub}>🔔 Új harang</div>
            <div className={styles.modalTitle}>Időzített értesítés</div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formLabel}>👤 Kinek?</div>
          <select
            className={styles.formSelect}
            value={userId}
            onChange={e => setUserId(e.target.value)}
            required
          >
            <option value="">— Válassz —</option>
            {candidates.map(p => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
                {p.id === defaultUserId ? ' (én)' : ''}
              </option>
            ))}
          </select>
          {isSelf && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              📌 Saját magadnak küldöd — tesztelheted a teljes értesítés-pipeline-t.
            </div>
          )}
        </div>

        <div className={styles.formRow}>
          <div className={styles.formLabel}>🕐 Mikor?</div>
          <input
            type="datetime-local"
            className={styles.formInput}
            value={scheduledFor}
            onChange={e => setScheduledFor(e.target.value)}
          />
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
            A "Küldd most" gomb figyelmen kívül hagyja ezt és azonnal küld.
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formLabel}>✏️ Üzenet címe</div>
          <input
            type="text"
            className={styles.formInput}
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={300}
            placeholder="pl. Munkalapot lezárni"
            required
            autoFocus
          />
        </div>

        <div className={styles.formRow}>
          <div className={styles.formLabel}>📝 Részletek (opcionális)</div>
          <textarea
            className={styles.formInput}
            value={body}
            onChange={e => setBody(e.target.value)}
            maxLength={4000}
            rows={3}
            placeholder="további info, link, stb."
            style={{ resize: 'vertical' }}
          />
        </div>

        <div className={styles.formRow}>
          <div className={styles.formLabel}>📂 Projekt (opcionális)</div>
          <select
            className={styles.formSelect}
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
          >
            <option value="">— Nincs projekthez kötve —</option>
            {overview.projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
            Ha projektet választasz, a Gantt-on a projekt-során is megjelenik a 🔔 marker.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={handleSendNow}
            disabled={saving || !title.trim() || !userId}
            className={styles.saveBtn}
            style={{ background: '#16a34a', flex: 1 }}
            title="Mentés + azonnali küldés"
          >
            {saving ? '…' : '📨 Küldd most'}
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim() || !userId || !scheduledFor}
            className={styles.saveBtn}
            style={{ flex: 1 }}
            title="Időzítés a megadott időpontra"
          >
            {saving ? '…' : '🕐 Időzítés'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Workflow nav-row a ProjectModal Szerződés/Munkalap/Árajánlat tabjaira ── */

function WorkflowTabHeader({
  kind, state,
}: {
  kind: 'contract' | 'worksheet' | 'quote';
  state: ReturnType<typeof useProjectWorkflowState>['state'];
}) {
  const meta = (() => {
    if (kind === 'quote') {
      const q = state?.quote;
      return {
        chipLabel: q ? `Árajánlat: ${q.state}` : 'Nincs árajánlat',
        chipColor: q?.state === 'accepted' ? '#15803d' : '#6b7280',
        href: q ? `/crm/quotes?id=${q.id}` : '/crm/quotes',
        ctaLabel: q ? 'Megnyitás →' : 'Új árajánlat →',
      };
    }
    if (kind === 'worksheet') {
      const w = state?.workOrder;
      return {
        chipLabel: w ? `Munkalap: ${w.itemCount} tétel · ${w.state}` : 'Nincs munkalap',
        chipColor: w && w.itemCount > 0 ? '#15803d' : '#6b7280',
        href: w ? `/work-orders/${w.id}` : '/work-orders',
        ctaLabel: w ? 'Megnyitás →' : 'Munkalapok →',
      };
    }
    // contract: nincs külön state-mező, csak doc-feltöltés. Egyszerű jelzés.
    return {
      chipLabel: 'Szerződés — dokumentum-csatolás',
      chipColor: '#6b7280',
      href: null as string | null,
      ctaLabel: null as string | null,
    };
  })();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 8, padding: '8px 10px', marginBottom: 12,
      background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6,
    }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: meta.chipColor }}>
        {meta.chipLabel}
      </span>
      {meta.href && meta.ctaLabel ? (
        <Link
          href={meta.href}
          style={{
            padding: '4px 12px', fontSize: 12, fontWeight: 600,
            border: '1px solid #2563eb', borderRadius: 4,
            background: '#eff6ff', color: '#2563eb', textDecoration: 'none',
          }}
        >
          {meta.ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}

function DocPanelCollapsed({ children }: { children: React.ReactNode }) {
  return (
    <details style={{ marginTop: 4 }}>
      <summary style={{
        fontSize: 12, color: '#6b7280', cursor: 'pointer', padding: '6px 0',
        userSelect: 'none',
      }}>
        Dokumentum csatolása ▾
      </summary>
      <div style={{ marginTop: 8 }}>{children}</div>
    </details>
  );
}

/* A default `MeetingPage` wrapper a `./page.tsx`-ben él — a Next.js a page-fájlokban
 * csak konkrét named export-okat enged (`metadata`, `dynamic` stb.), ezért a
 * `MeetingView` komponens egy "_"-prefixű (privát, nem-route) fájlban van. */
