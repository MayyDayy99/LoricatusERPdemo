/**
 * EGYSÉGES projekt-állapot vizuális nyelv — Lista / Kanban / Gantt.
 *
 * A `projects.state` enum (draft | active | completed | archived) az egyetlen
 * ténylegesen használt állapot-fogalom: a `project_statuses` testreszabható
 * tábla üres, és egyetlen projekt sem hivatkozik rá (`status_id` mind NULL).
 * A Kanban drag-drop is ezt az enumot mozgatja, és a Gantt adat-DTO-jában is
 * benne van — így ugyanaz a szín végigvihető mindhárom nézeten, backend-
 * módosítás nélkül.
 *
 * Cél: ha valaki a Kanban-ban „Aktív"-ba húz egy kártyát, az a Listán és a
 * Gantt-on is azonnal, ugyanazzal a színnel jelölődjön.
 *
 * A `hex` a Gantt-nak kell (inline style-t használ), a Tailwind-osztályok a
 * Listának és a Kanbannak.
 */

export type ProjectState = 'draft' | 'active' | 'completed' | 'archived';

export interface StateVisual {
  label: string;
  /** Nyers hex — inline style-hoz (Gantt sor-tint). */
  hex: string;
  /** Tömör szín-sáv / pötty (lista bal szegély, kanban kártya-csík). */
  bar: string;
  /** Halvány háttér (kanban oszlop). */
  bg: string;
  /** Szegély (kanban oszlop). */
  border: string;
  /** Badge: háttér + szöveg. */
  badge: string;
}

export const STATE_VISUALS: Record<ProjectState, StateVisual> = {
  draft: {
    label: 'Tervezet',
    hex: '#94a3b8', // slate-400
    bar: 'bg-slate-400',
    bg: 'bg-slate-50',
    border: 'border-slate-300',
    badge: 'bg-slate-100 text-slate-700',
  },
  active: {
    label: 'Aktív',
    hex: '#22c55e', // green-500 — a "folyamatban" a legfontosabb jelzés
    bar: 'bg-green-500',
    bg: 'bg-green-50',
    border: 'border-green-300',
    badge: 'bg-green-100 text-green-700',
  },
  completed: {
    label: 'Lezárt',
    hex: '#3b82f6', // blue-500
    bar: 'bg-blue-500',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    badge: 'bg-blue-100 text-blue-700',
  },
  archived: {
    label: 'Archív',
    hex: '#a1a1aa', // zinc-400
    bar: 'bg-zinc-400',
    bg: 'bg-zinc-50',
    border: 'border-zinc-300',
    badge: 'bg-zinc-100 text-zinc-600',
  },
};

const FALLBACK: StateVisual = STATE_VISUALS.draft;

/** Ismeretlen/hiányzó state-re a `draft` vizuálisát adja (nem dob). */
export function stateVisual(state: string | null | undefined): StateVisual {
  if (!state) return FALLBACK;
  return STATE_VISUALS[state as ProjectState] ?? FALLBACK;
}

/** A Kanban oszlop-sorrend — egyben a megengedett állapotok kanonikus listája. */
export const STATE_ORDER: ProjectState[] = ['draft', 'active', 'completed', 'archived'];
