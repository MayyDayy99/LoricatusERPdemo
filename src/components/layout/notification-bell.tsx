'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, BellDot, CheckCheck, TrendingUp, CheckSquare, Receipt, Wallet, AtSign, User, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';
import {
  useNotifications,
  useUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from '@/lib/hooks/use-crm';

// ─── Notification type icon ───────────────────────────────────────────────────

function NotifIcon({ type }: { type: string }) {
  const cls = 'w-4 h-4';
  if (type === 'deal_stage_changed') return <TrendingUp className={clsx(cls, 'text-blue-500')} />;
  if (type === 'task_due')           return <CheckSquare className={clsx(cls, 'text-orange-500')} />;
  if (type === 'quote_sent' || type === 'quote_accepted' || type === 'quote_rejected')
    return <Receipt className={clsx(cls, 'text-purple-500')} />;
  if (type === 'invoice_overdue')    return <Wallet className={clsx(cls, 'text-red-500')} />;
  if (type === 'mention')            return <AtSign className={clsx(cls, 'text-cyan-500')} />;
  if (type === 'assignment')         return <User className={clsx(cls, 'text-green-500')} />;
  return <Settings className={clsx(cls, 'text-gray-400')} />;
}

// ─── Entity route mapping ─────────────────────────────────────────────────────

function entityRoute(notif: Notification): string | null {
  if (!notif.relatedEntity || !notif.relatedEntityId) return null;
  const e = notif.relatedEntity.toLowerCase();
  if (e === 'deal')     return `/deals`;
  if (e === 'task')     return `/crm/tasks`;
  if (e === 'quote')    return `/crm/quotes`;
  if (e === 'invoice')  return `/crm/invoices`;
  if (e === 'customer') return `/customers`;
  return null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'most';
  if (mins < 60) return `${mins} perce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} órája`;
  return `${Math.floor(hours / 24)} napja`;
}

// ─── Notification Bell ────────────────────────────────────────────────────────

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { count, mutate: mutateCount } = useUnreadNotificationCount();
  const { notifications, mutate: mutateNotifs, isLoading } = useNotifications({ limit: 20 });

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function handleMarkRead(notif: Notification) {
    if (notif.isRead) {
      const route = entityRoute(notif);
      if (route) router.push(route);
      setOpen(false);
      return;
    }
    try {
      await markNotificationRead(notif.id);
      mutateNotifs();
      mutateCount();
      const route = entityRoute(notif);
      if (route) { router.push(route); setOpen(false); }
    } catch { /* silent */ }
  }

  async function handleMarkAll() {
    try {
      await markAllNotificationsRead();
      mutateNotifs();
      mutateCount();
    } catch { /* silent */ }
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition text-gray-500 hover:text-gray-700"
        aria-label="Értesítések"
      >
        {count > 0 ? <BellDot className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full px-1">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              Értesítések
              {count > 0 && (
                <span className="ml-2 text-xs font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                  {count} új
                </span>
              )}
            </h3>
            {count > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium transition"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mind olvasott
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50">
            {isLoading && (
              <p className="text-center text-xs text-gray-400 py-8">Betöltés...</p>
            )}
            {!isLoading && notifications.length === 0 && (
              <div className="text-center py-10">
                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Nincs értesítés</p>
              </div>
            )}
            {notifications.map(notif => (
              <button
                key={notif.id}
                type="button"
                onClick={() => handleMarkRead(notif)}
                className={clsx(
                  'w-full text-left px-4 py-3 hover:bg-gray-50 transition flex items-start gap-3',
                  !notif.isRead && 'bg-brand-50/50',
                )}
              >
                <div className="mt-0.5 shrink-0">
                  <NotifIcon type={notif.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={clsx(
                    'text-xs leading-snug',
                    notif.isRead ? 'text-gray-600' : 'text-gray-900 font-semibold',
                  )}>
                    {notif.title}
                  </p>
                  {notif.body && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{notif.body}</p>
                  )}
                  <p className="text-[10px] text-gray-300 mt-1">{timeAgo(notif.createdAt)}</p>
                </div>
                {!notif.isRead && (
                  <div className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-1.5" />
                )}
              </button>
            ))}
          </div>

          {notifications.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-2.5 text-center">
              <span className="text-xs text-gray-400">Legutóbbi 20 értesítés</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
