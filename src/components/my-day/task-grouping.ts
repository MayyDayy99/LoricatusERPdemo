import type { ComponentType, CSSProperties } from 'react';
import {
  Folder, Briefcase, Building, Building2, ClipboardList, Wrench, Plane,
} from 'lucide-react';
import type { CrmTask } from '@/lib/hooks/use-crm';
import type { Project, ProjectCategory } from '@/lib/hooks/use-projects';

/** ProjectCategory.icon → lucide komponens. Ismeretlen ikon → Folder fallback. */
export const CATEGORY_ICONS: Record<string, ComponentType<{ className?: string; style?: CSSProperties }>> = {
  Folder, Briefcase, Building, Building2, ClipboardList, Wrench, Plane,
};

export interface ProjectBucket {
  project: Project;
  tasks: CrmTask[];
}

export interface RoomGroup {
  /** null = "Egyéb / projekten kívüli" */
  category: ProjectCategory | null;
  projects: Map<string, ProjectBucket>;
  /** Olyan teendők, amik kategóriához tartoznának, de a projekt nem látható (törölt?). */
  orphanTasks: CrmTask[];
}

/**
 * Mai-napom teendők csoportosítása szoba (ProjectCategory) → projekt szerint.
 * A projekt nélküli, ill. nem-látható projektű teendők az "Egyéb" (null) csoport
 * orphanTasks-jába kerülnek. A csoportok a kategória sortIndex-e szerint rendezettek,
 * az "Egyéb" mindig a végére kerül.
 *
 * (A logika a régi MyTodayWidget useMemo-jából lett kiemelve, hogy a teljes oldal
 * és a kompakt widget is ugyanazt használja.)
 */
export function groupTasksByRoom(
  tasks: CrmTask[],
  projects: Project[],
  categories: ProjectCategory[],
): RoomGroup[] {
  const projectMap = new Map<string, Project>();
  for (const p of projects) projectMap.set(p.id, p);
  const categoryMap = new Map<string, ProjectCategory>();
  for (const c of categories) categoryMap.set(c.id, c);

  const byCategory = new Map<string | null, RoomGroup>();
  const ensure = (catId: string | null): RoomGroup => {
    let g = byCategory.get(catId);
    if (!g) {
      const cat = catId ? categoryMap.get(catId) ?? null : null;
      g = { category: cat, projects: new Map(), orphanTasks: [] };
      byCategory.set(catId, g);
    }
    return g;
  };

  for (const t of tasks) {
    if (!t.projectId) {
      ensure(null).orphanTasks.push(t);
      continue;
    }
    const project = projectMap.get(t.projectId);
    if (!project) {
      // Projekt nem látható (pl. soft-deleted) — orphan-ként jelenjen meg.
      ensure(null).orphanTasks.push(t);
      continue;
    }
    const catId = project.categoryId ?? null;
    const group = ensure(catId);
    let bucket = group.projects.get(project.id);
    if (!bucket) {
      bucket = { project, tasks: [] };
      group.projects.set(project.id, bucket);
    }
    bucket.tasks.push(t);
  }

  return [...byCategory.values()].sort((a, b) => {
    if (!a.category && !b.category) return 0;
    if (!a.category) return 1;
    if (!b.category) return -1;
    return (a.category.sortIndex ?? 0) - (b.category.sortIndex ?? 0);
  });
}

/** Egy csoport összes teendőjének száma (projekt-bucketek + orphan). */
export function roomGroupTaskCount(group: RoomGroup): number {
  let n = group.orphanTasks.length;
  for (const b of group.projects.values()) n += b.tasks.length;
  return n;
}

/** Egy teendő lejárt-e: pending és a határidő (helyi ISO-nap) a mai nap előtt van. */
export function isTaskOverdue(task: CrmTask, todayIso: string): boolean {
  const done = task.status === 'completed' || task.status === 'cancelled';
  return !done && !!task.dueDate && task.dueDate.slice(0, 10) < todayIso;
}

/** Helyi "ma" ISO-dátum (YYYY-MM-DD) — a meglévő widget-konvencióval egyezően. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
