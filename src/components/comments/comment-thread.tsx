'use client';

import { useMemo, useState } from 'react';
import { Send, Edit2, Trash2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import {
  useComments, createComment, updateComment, deleteComment,
  type CommentTargetType, type Comment,
} from '@/lib/hooks/use-comments';
import { useUsers, useCurrentUser } from '@/lib/hooks/use-users';
import { relativeTime } from '@/lib/activity-humanizer';

/**
 * Univerzális komment-thread komponens — projekt- vagy task-szintű
 * komment-listát + új-komment input mező-t mutat. A /rooms/[projectId]
 * Hírfolyam-fülén projekt-szinten, a TaskEditorModal-on belül pedig
 * task-szinten használjuk.
 */
export function CommentThread({
  targetType,
  targetId,
  emptyHint = 'Még nincs hozzászólás. Légy az első!',
}: {
  targetType: CommentTargetType;
  targetId: string;
  emptyHint?: string;
}) {
  const { comments, mutate } = useComments(targetType, targetId);
  const { users } = useUsers();
  const { currentUser } = useCurrentUser();
  const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await createComment(targetType, targetId, trimmed);
      setBody('');
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Komment elküldése sikertelen');
    } finally {
      setBusy(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.length === 0 && (
        <p className="text-xs text-gray-400 italic py-4 text-center">{emptyHint}</p>
      )}
      {comments.map(c => (
        <CommentRow
          key={c.id}
          comment={c}
          authorName={fullName(userMap.get(c.authorId))}
          authorInitial={initial(userMap.get(c.authorId))}
          isOwn={c.authorId === currentUser?.id}
          onChanged={() => mutate()}
        />
      ))}

      {/* Composer */}
      <div className="flex items-end gap-2 mt-1">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKey}
          placeholder="Írj egy hozzászólást… (Ctrl/⌘+Enter küldés)"
          rows={2}
          maxLength={4000}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy || !body.trim()}
          className="h-9 px-3 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition"
        >
          <Send className="w-3.5 h-3.5" />
          Küldés
        </button>
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  authorName,
  authorInitial,
  isOwn,
  onChanged,
}: {
  comment: Comment;
  authorName: string;
  authorInitial: string;
  isOwn: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function saveEdit() {
    const trimmed = editBody.trim();
    if (!trimmed) return;
    try {
      await updateComment(comment.id, trimmed);
      setEditing(false);
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Módosítás sikertelen');
    }
  }

  async function handleDelete() {
    try {
      await deleteComment(comment.id);
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Törlés sikertelen');
    }
  }

  return (
    <div className="flex gap-3 group">
      <div className="shrink-0 w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold">
        {authorInitial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-gray-900">{authorName}</span>
          <span className="text-[11px] text-gray-400">{relativeTime(comment.createdAt)}</span>
          {comment.updatedAt && (
            <span className="text-[11px] text-gray-400 italic">szerkesztve</span>
          )}
          {isOwn && !editing && (
            <span className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
              <button
                type="button"
                onClick={() => setEditing(true)}
                title="Szerkesztés"
                className="p-1 text-gray-400 hover:text-blue-600 rounded"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => confirmingDelete ? handleDelete() : setConfirmingDelete(true)}
                onBlur={() => setTimeout(() => setConfirmingDelete(false), 200)}
                title={confirmingDelete ? 'Kattints újra a megerősítéshez' : 'Törlés'}
                className={clsx(
                  'p-1 rounded',
                  confirmingDelete ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:text-red-600',
                )}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
        {editing ? (
          <div className="mt-1 flex flex-col gap-2">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={2}
              maxLength={4000}
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={saveEdit} className="px-2 py-1 rounded text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 inline-flex items-center gap-1">
                <Check className="w-3 h-3" /> Mentés
              </button>
              <button type="button" onClick={() => { setEditing(false); setEditBody(comment.body); }} className="px-2 py-1 rounded text-xs text-gray-600 hover:bg-gray-100 inline-flex items-center gap-1">
                <X className="w-3 h-3" /> Mégse
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 text-sm text-gray-800 whitespace-pre-wrap break-words">{comment.body}</p>
        )}
      </div>
    </div>
  );
}

function fullName(u: { firstName?: string; lastName?: string } | undefined): string {
  if (!u) return 'Ismeretlen';
  return `${u.lastName ?? ''} ${u.firstName ?? ''}`.trim() || 'Ismeretlen';
}
function initial(u: { firstName?: string; lastName?: string } | undefined): string {
  if (!u) return '?';
  return (u.lastName?.[0] ?? u.firstName?.[0] ?? '?').toUpperCase();
}
