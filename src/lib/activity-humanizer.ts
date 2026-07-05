import type { ActivityEntry } from './hooks/use-projects';

/**
 * Audit-log entry → ember-olvasható UI-szöveg + ikon.
 * A frontend Hírfolyam komponens ezt használja a JSON-dump helyett.
 */
export interface HumanizedActivity {
  icon: string;
  title: string;
  detail?: string;
}

const PROJECT_STATE_LABELS: Record<string, string> = {
  draft: 'Tervezet',
  active: 'Aktív',
  completed: 'Lezárt',
  archived: 'Archív',
  on_hold: 'Felfüggesztve',
};

const TASK_STATE_LABELS: Record<string, string> = {
  pending: 'Várólista',
  in_progress: 'Folyamatban',
  completed: 'Kész',
  cancelled: 'Lemondva',
};

function stateLabel(value: unknown, map: Record<string, string>): string {
  if (typeof value !== 'string') return String(value ?? '?');
  return map[value] ?? value;
}

export function humanizeActivity(entry: ActivityEntry): HumanizedActivity {
  const m = (entry.metadata ?? {}) as Record<string, unknown>;
  const action = entry.action;

  // ── Projekt-events ─────────────────────────────────────────
  if (action === 'project.created') {
    return {
      icon: '✨',
      title: 'Projekt létrehozva',
      detail: typeof m.name === 'string' ? m.name : undefined,
    };
  }
  if (action === 'project.updated') {
    const changedKeys = Object.keys(m).filter(k => k !== 'projectId');
    return {
      icon: '✏️',
      title: 'Projekt módosítva',
      detail: changedKeys.length > 0 ? `Mezők: ${changedKeys.join(', ')}` : undefined,
    };
  }
  if (action === 'project.transition') {
    const from = stateLabel(m.from, PROJECT_STATE_LABELS);
    const to = stateLabel(m.to, PROJECT_STATE_LABELS);
    return { icon: '🔁', title: `Állapot: ${from} → ${to}` };
  }
  if (action === 'project.deleted') {
    return { icon: '🗑️', title: 'Projekt törölve' };
  }
  if (action === 'project.restored') {
    return { icon: '↩️', title: 'Projekt visszaállítva' };
  }

  // ── CRM-task events ────────────────────────────────────────
  const title = typeof m.title === 'string' ? `"${m.title}"` : '';
  if (action === 'crm-task.created') {
    return { icon: '✅', title: `Új teendő ${title}`.trim() };
  }
  if (action === 'crm-task.updated') {
    const ignored = new Set(['projectId', 'title']);
    const changedKeys = Object.keys(m).filter(k => !ignored.has(k));
    return {
      icon: '✏️',
      title: `Teendő frissítve ${title}`.trim(),
      detail: changedKeys.length > 0 ? `Mezők: ${changedKeys.join(', ')}` : undefined,
    };
  }
  if (action === 'crm-task.start') {
    return { icon: '▶️', title: `Teendő elkezdve ${title}`.trim() };
  }
  if (action === 'crm-task.complete') {
    return { icon: '☑️', title: `Teendő kész ${title}`.trim() };
  }
  if (action === 'crm-task.cancel') {
    return { icon: '✖️', title: `Teendő lemondva ${title}`.trim() };
  }
  if (action === 'crm-task.csat') {
    return { icon: '⭐', title: `Elégedettség ${m.score ?? '?'}/5 ${title}`.trim() };
  }
  if (action === 'crm-task.reopened') {
    return { icon: '🔄', title: `Teendő újranyitva ${title}`.trim() };
  }

  // ── Plan-task (Gantt) events — a /meeting Gantt task-műveletei ──
  if (action === 'plan_task.created') {
    return { icon: '✅', title: `Új teendő ${title}`.trim() };
  }
  if (action === 'plan_task.updated') {
    if (m.status === 'completed') {
      return { icon: '☑️', title: `Teendő kész ${title}`.trim() };
    }
    if (m.status === 'cancelled') {
      return { icon: '✖️', title: `Teendő lemondva ${title}`.trim() };
    }
    if (m.status === 'in_progress') {
      return { icon: '▶️', title: `Teendő elkezdve ${title}`.trim() };
    }
    const ignored = new Set(['projectId', 'title', 'status']);
    const changedKeys = Object.keys(m).filter(k => !ignored.has(k));
    return {
      icon: '✏️',
      title: `Teendő frissítve ${title}`.trim(),
      detail: changedKeys.length > 0 ? `Mezők: ${changedKeys.join(', ')}` : undefined,
    };
  }
  if (action === 'plan_task.deleted') {
    return { icon: '🗑️', title: `Teendő törölve ${title}`.trim() };
  }

  // ── Checklist (részfeladat) events ────────────────────────
  const itemText = typeof m.text === 'string' ? `„${m.text}"` : '';
  const taskCtx = typeof m.taskTitle === 'string' ? ` — ${m.taskTitle}` : '';
  if (action === 'crm-task.checklist.added') {
    return { icon: '➕', title: `Részfeladat hozzáadva: ${itemText}`.trim(), detail: taskCtx.trim() || undefined };
  }
  if (action === 'crm-task.checklist.toggled') {
    return {
      icon: m.done ? '✓' : '○',
      title: `Részfeladat ${m.done ? 'elvégezve' : 'visszanyitva'}: ${itemText}`.trim(),
      detail: taskCtx.trim() || undefined,
    };
  }
  if (action === 'crm-task.checklist.removed') {
    return { icon: '➖', title: `Részfeladat törölve: ${itemText}`.trim(), detail: taskCtx.trim() || undefined };
  }

  // ── Fallback ──────────────────────────────────────────────
  return { icon: '📝', title: action };
}

/** Relatív idő — "3 perce", "2 órája", "tegnap", "2 napja". */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 60) return 'most';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} perce`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} órája`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return 'tegnap';
  if (diffD < 7) return `${diffD} napja`;
  // 1+ hete: dátum
  return new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' });
}
