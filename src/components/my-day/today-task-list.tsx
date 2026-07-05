'use client';

import Link from 'next/link';
import { CheckCircle2, Calendar, Clock, FolderOpen, AlertTriangle, Folder, Play, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import type { CrmTask } from '@/lib/hooks/use-crm';
import {
  CATEGORY_ICONS, roomGroupTaskCount, type RoomGroup, type ProjectBucket,
} from './task-grouping';

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500', medium: 'bg-amber-400', low: 'bg-blue-400',
};

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

/** A sorokra kötött akciók egy csomagban — kevesebb prop-átfűzés a fában. */
export interface TaskRowActions {
  /** Sor törzsére kattintva — drawer megnyitása. Ha nincs, a sor nem kattintható. */
  onSelectTask?: (task: CrmTask) => void;
  /** Checkbox nyitott teendőn — 1-kattintásos pipálás (kész). */
  onQuickComplete: (taskId: string) => void | Promise<void>;
  /** ▶ gomb — nyitott teendő „folyamatban"-ra állítása. */
  onStart?: (taskId: string) => void | Promise<void>;
  /** Checkbox kész teendőn — visszanyitás (un-pipálás). */
  onReopen?: (taskId: string) => void | Promise<void>;
}

export interface TodayTaskListProps extends TaskRowActions {
  groups: RoomGroup[];
  selectedTaskId?: string | null;
  variant?: 'full' | 'compact';
}

export function TodayTaskList({
  groups, selectedTaskId, variant = 'full', ...actions
}: TodayTaskListProps) {
  return (
    <div className={clsx('space-y-5', variant === 'compact' && 'space-y-4')}>
      {groups.map((g) => (
        <RoomGroupSection
          key={g.category?.id ?? 'orphan'}
          group={g}
          actions={actions}
          selectedTaskId={selectedTaskId}
          variant={variant}
        />
      ))}
    </div>
  );
}

function RoomGroupSection({
  group, actions, selectedTaskId, variant,
}: {
  group: RoomGroup;
  actions: TaskRowActions;
  selectedTaskId?: string | null;
  variant: 'full' | 'compact';
}) {
  const cat = group.category;
  const Icon = (cat && CATEGORY_ICONS[cat.icon]) ?? Folder;
  const accent = cat?.color ?? null;
  const total = roomGroupTaskCount(group);
  if (total === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {cat ? (
          <>
            <Icon className="w-4 h-4 shrink-0" style={{ color: cat.color }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: cat.color }}>
              {cat.name}
            </span>
          </>
        ) : (
          <>
            <FolderOpen className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Egyéb</span>
          </>
        )}
        <span className="text-[10px] text-gray-400 tabular-nums">({total})</span>
      </div>

      <div className="space-y-2 ml-1.5">
        {[...group.projects.values()].map((b) => (
          <ProjectBucketBlock
            key={b.project.id}
            bucket={b}
            accent={accent}
            actions={actions}
            selectedTaskId={selectedTaskId}
            variant={variant}
          />
        ))}
        {group.orphanTasks.length > 0 && (
          <div className="space-y-0.5">
            {group.orphanTasks.map((t) => (
              <MyDayTaskRow
                key={t.id}
                task={t}
                actions={actions}
                selected={selectedTaskId === t.id}
                variant={variant}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectBucketBlock({
  bucket, accent, actions, selectedTaskId, variant,
}: {
  bucket: ProjectBucket;
  accent: string | null;
  actions: TaskRowActions;
  selectedTaskId?: string | null;
  variant: 'full' | 'compact';
}) {
  return (
    <div
      className="border-l-2 pl-3"
      style={{ borderColor: accent ?? '#e5e7eb' }}
    >
      <Link
        href={`/rooms/${bucket.project.id}`}
        className="text-xs text-gray-700 font-medium hover:text-brand-700 inline-flex items-center gap-1 mb-1"
      >
        {bucket.project.name}
      </Link>
      <div className="space-y-0.5">
        {bucket.tasks.map((t) => (
          <MyDayTaskRow
            key={t.id}
            task={t}
            actions={actions}
            selected={selectedTaskId === t.id}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Egyetlen teendő-sor a "Mai napom" listában. Exportált, mert a kész-teendők
 * összecsukható szekciója (my-day-page) is ezt használja újra.
 */
export function MyDayTaskRow({
  task, actions, selected, variant,
}: {
  task: CrmTask;
  actions: TaskRowActions;
  selected: boolean;
  variant: 'full' | 'compact';
}) {
  const { onSelectTask, onQuickComplete, onStart, onReopen } = actions;
  const isDone = task.status === 'completed' || task.status === 'cancelled';
  const inProgress = task.status === 'in_progress';
  const dueLabel = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
    : null;
  const overdue = !isDone && !!task.dueDate && task.dueDate.slice(0, 10) < TODAY_ISO();
  const estHours = task.estimatedMinutes ? Math.round((task.estimatedMinutes / 60) * 10) / 10 : null;
  const clickable = !!onSelectTask;
  // A kész-pipa visszavonható, ha kapunk onReopen-t; egyébként a doboz le van tiltva.
  const canReopen = isDone && !!onReopen;
  const checkboxDisabled = isDone && !canReopen;

  return (
    <div
      className={clsx(
        'group flex items-start gap-2.5 py-2 px-2 -mx-2 rounded-lg transition',
        selected && 'bg-brand-50',
        clickable && !selected && 'hover:bg-gray-50',
        isDone && 'opacity-70',
      )}
    >
      <button
        type="button"
        onClick={() => {
          if (canReopen) return void onReopen!(task.id);
          if (!isDone) return void onQuickComplete(task.id);
        }}
        disabled={checkboxDisabled}
        title={isDone ? (canReopen ? 'Visszanyitás' : 'Kész') : 'Pipálás (kész)'}
        className={clsx(
          'relative mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition',
          isDone
            ? clsx('bg-green-500 border-green-500 text-white', canReopen && 'hover:bg-green-600 cursor-pointer')
            : 'border-gray-300 hover:border-brand-500 hover:bg-brand-50',
        )}
      >
        {isDone && (
          <>
            <CheckCircle2
              className={clsx('w-3.5 h-3.5 absolute transition-opacity', canReopen && 'group-hover:opacity-0')}
            />
            {canReopen && (
              <RotateCcw className="w-3 h-3 absolute opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </>
        )}
      </button>

      <button
        type="button"
        onClick={() => onSelectTask?.(task)}
        disabled={!clickable}
        className={clsx('flex-1 min-w-0 text-left', clickable && 'cursor-pointer')}
      >
        <div className="flex items-center gap-1.5">
          {!isDone && (
            <span className={clsx('w-2 h-2 rounded-full shrink-0', PRIORITY_DOT[task.priority] ?? 'bg-gray-300')} />
          )}
          <span className={clsx('text-sm', isDone ? 'line-through text-gray-400' : 'text-gray-800 font-medium')}>
            {task.title}
          </span>
          {inProgress && (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 shrink-0">
              folyamatban
            </span>
          )}
        </div>
        {variant === 'full' && (dueLabel || estHours != null) && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {dueLabel && (
              <span
                className={clsx(
                  'inline-flex items-center gap-0.5 text-[11px] rounded px-1.5 py-0.5',
                  overdue ? 'text-red-700 bg-red-50 font-medium' : 'text-gray-500 bg-gray-100',
                )}
              >
                {overdue ? <AlertTriangle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                {overdue ? `lejárt · ${dueLabel}` : dueLabel}
              </span>
            )}
            {estHours != null && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
                <Clock className="w-3 h-3" />
                {estHours}h
              </span>
            )}
          </div>
        )}
      </button>

      {/* ▶ „Folyamatban" gyorsgomb — csak nyitott, még el nem kezdett teendőn. */}
      {!isDone && !inProgress && onStart && (
        <button
          type="button"
          onClick={() => void onStart(task.id)}
          title="Folyamatban"
          className="mt-0.5 shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition"
        >
          <Play className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
