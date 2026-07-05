'use client';

import { useMemo, useState } from 'react';
import { useProjectActivity, type ActivityEntry } from '@/lib/hooks/use-projects';
import { useComments, type Comment } from '@/lib/hooks/use-comments';
import { useUsers } from '@/lib/hooks/use-users';
import { useCrmTasks, useProjectActivities, type CrmTask, type CrmActivity } from '@/lib/hooks/use-crm';
import { CommentThread } from '@/components/comments/comment-thread';
import { humanizeActivity, relativeTime } from '@/lib/activity-humanizer';
import { TaskEditorModal } from '../task-editor-modal';

/**
 * Egy projekt teljes Hírfolyam-felülete:
 *   • Projekt-szintű komment-input (kommentek beágyazódnak a feedbe)
 *   • Egy idővonal, amely chronológikus sorrendben mutatja:
 *     - audit-log entry-ket (project + crm-task events humanizálva)
 *     - projekt-kommenteket
 *     - task-szintű kommenteket
 *   • Legújabb felül.
 */
export function Newsfeed({ projectId }: { projectId: string }) {
  const { entries: activity } = useProjectActivity(projectId);
  const { comments: projectComments } = useComments('project', projectId);
  const { tasks, mutate: mutateTasks } = useCrmTasks({ projectId });
  const { activities: crmActivities } = useProjectActivities(projectId);
  const { users } = useUsers();
  const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // Task-szintű kommentek aggregálása — minden task SWR-hookja meghív lenne
  // egy iterációval, de azt a React nem engedi (a hook-okat nem hívhatjuk
  // ciklusban). Helyette: külön <TaskCommentsLoader> komponensek, amik
  // egyenként hívnak useComments-et és a parent-nek átadnak egy callback-et,
  // de ez bonyolult. Egyszerűbb: a Newsfeed csak project-level kommenteket
  // mutat itt, a task-level kommentek a TaskEditorModalban jelennek meg.
  // A task-events viszont (létrehozás, állapotváltás) AZ AUDIT-LOG-BÓL
  // jönnek, és a projects.controller.ts findProjectScope() most már
  // bevonja őket.

  const feed = useMemo(
    () => buildFeed(activity, projectComments, crmActivities),
    [activity, projectComments, crmActivities],
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      {/* Komment-input + projekt-szintű kommentek listája */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Hozzászólások</h3>
        <CommentThread
          targetType="project"
          targetId={projectId}
          emptyHint="Még nincs hozzászólás a projekthez. Légy az első!"
        />
      </section>

      {/* Idővonal: activity + komment-event-ek egybeolvasztva */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Idővonal</h3>
        <ol className="relative border-l border-gray-200 ml-3 space-y-4">
          {feed.length === 0 && (
            <li className="ml-4 text-sm text-gray-400">Még nincs esemény.</li>
          )}
          {feed.map((item) => {
            const author = item.kind === 'activity'
              ? (item.entry.userId ? userMap.get(item.entry.userId) : undefined)
              : item.kind === 'comment'
                ? userMap.get(item.comment.authorId)
                : (item.activity.createdBy ? userMap.get(item.activity.createdBy) : undefined);
            const authorName = author
              ? `${author.lastName ?? ''} ${author.firstName ?? ''}`.trim() || 'Ismeretlen'
              : (item.kind === 'crm-activity' && item.activity.createdByName) || 'Rendszer';

            return (
              <li key={item.id} className="ml-4">
                <span className="absolute -left-[6px] mt-1.5 w-3 h-3 rounded-full bg-brand-100 border-2 border-brand-500" />
                <div className="flex items-baseline gap-2 text-sm text-gray-700">
                  <span className="font-medium">{authorName}</span>
                  <span className="text-[11px] text-gray-400">{relativeTime(item.createdAt)}</span>
                </div>
                {item.kind === 'activity' ? (
                  <ActivityFeedRow entry={item.entry} taskMap={taskMap} onOpenTask={setOpenTaskId} />
                ) : item.kind === 'comment' ? (
                  <CommentFeedRow comment={item.comment} />
                ) : (
                  <CrmActivityFeedRow activity={item.activity} />
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {/* Hírfolyam task-eseményre kattintva a teendő szerkesztője nyílik. */}
      {openTaskId && taskMap.get(openTaskId) && (
        <TaskEditorModal
          projectId={projectId}
          task={taskMap.get(openTaskId)!}
          onClose={() => setOpenTaskId(null)}
          onSaved={() => { setOpenTaskId(null); void mutateTasks(); }}
        />
      )}
    </div>
  );
}

type FeedItem =
  | { kind: 'activity'; id: string; createdAt: string; entry: ActivityEntry }
  | { kind: 'comment'; id: string; createdAt: string; comment: Comment }
  | { kind: 'crm-activity'; id: string; createdAt: string; activity: CrmActivity };

function buildFeed(activity: ActivityEntry[], comments: Comment[], crmActivities: CrmActivity[]): FeedItem[] {
  const items: FeedItem[] = [
    ...activity.map(a => ({ kind: 'activity' as const, id: `a-${a.id}`, createdAt: a.createdAt, entry: a })),
    ...comments.map(c => ({ kind: 'comment' as const, id: `c-${c.id}`, createdAt: c.createdAt, comment: c })),
    ...crmActivities.map(a => ({ kind: 'crm-activity' as const, id: `act-${a.id}`, createdAt: a.occurredAt, activity: a })),
  ];
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function ActivityFeedRow({
  entry, taskMap, onOpenTask,
}: {
  entry: ActivityEntry;
  taskMap: Map<string, CrmTask>;
  onOpenTask: (taskId: string) => void;
}) {
  const h = humanizeActivity(entry);
  const taskId = entry.resource === 'crm-task' && entry.resourceId && taskMap.has(entry.resourceId)
    ? entry.resourceId : undefined;
  return (
    <div className="mt-0.5">
      <span className="text-sm text-gray-800">
        <span className="mr-1.5">{h.icon}</span>
        {h.title}
      </span>
      {h.detail && <div className="text-[11px] text-gray-500 mt-0.5">{h.detail}</div>}
      {taskId && (
        <button
          type="button"
          onClick={() => onOpenTask(taskId)}
          className="text-[11px] text-gray-500 mt-0.5 hover:text-brand-600 hover:underline"
        >
          → Teendő: <span className="text-gray-700">{taskMap.get(taskId)?.title}</span>
        </button>
      )}
    </div>
  );
}

const CRM_ACTIVITY_ICON: Record<string, string> = {
  EMAIL: '✉️', NOTE: '📝', CALL: '📞', MEETING: '🤝', SITE_VISIT: '📍',
  TASK_COMPLETED: '✅', SYSTEM: '⚙️',
};

function CrmActivityFeedRow({ activity }: { activity: CrmActivity }) {
  return (
    <div className="mt-0.5">
      <span className="text-sm text-gray-800">
        <span className="mr-1.5">{CRM_ACTIVITY_ICON[activity.activityType] ?? '•'}</span>
        {activity.subject || activity.activityType}
      </span>
      {activity.body && (
        <div className="text-[11px] text-gray-500 mt-0.5 whitespace-pre-wrap break-words line-clamp-4">
          {activity.body}
        </div>
      )}
    </div>
  );
}

function CommentFeedRow({ comment }: { comment: Comment }) {
  return (
    <div className="mt-0.5 text-sm text-gray-800 whitespace-pre-wrap break-words">
      <span className="mr-1.5">💬</span>
      {comment.body}
    </div>
  );
}
