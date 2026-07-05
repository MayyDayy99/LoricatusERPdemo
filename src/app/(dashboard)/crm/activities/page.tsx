'use client';

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Filter, Pencil, Phone, Mail, Users, StickyNote, MapPin, Plus, Search, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/lib/hooks/use-t';
import { useActivities, deleteActivity, type CrmActivity } from '@/lib/hooks/use-crm';
import { useCanAccess } from '@/lib/hooks/use-access';
import { ActivityModal } from '@/components/crm/activity-modal';

/* ── Types ──────────────────────────────────────────────── */
type GroupBy = 'time' | 'customer' | 'deal';

interface Customer { id: string; firstName: string; lastName: string; company?: string; }
interface Deal { id: string; title: string; }
interface Project { id: string; name: string; }

const TYPE_ICONS: Record<string, React.ElementType> = {
  CALL:       Phone,
  EMAIL:      Mail,
  MEETING:    Users,
  NOTE:       StickyNote,
  SITE_VISIT: MapPin,
};

const TYPE_COLORS: Record<string, string> = {
  CALL:       'bg-blue-100 text-blue-700',
  EMAIL:      'bg-cyan-100 text-cyan-700',
  MEETING:    'bg-purple-100 text-purple-700',
  NOTE:       'bg-gray-100 text-gray-600',
  SITE_VISIT: 'bg-green-100 text-green-700',
};

const ACTIVE_TYPES = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'SITE_VISIT'] as const;

function buildTypeLabels(t: ReturnType<typeof useT>): Record<string, string> {
  return {
    CALL:       t.activities.typeCall,
    EMAIL:      t.activities.typeEmail,
    MEETING:    t.activities.typeMeeting,
    NOTE:       t.activities.typeNote,
    SITE_VISIT: t.activities.typeSiteVisit,
  };
}

/* ── Activity Card ─────────────────────────────────────── */
function ActivityCard({ activity, onEdit, onDelete, canWrite, t }: {
  activity: CrmActivity;
  onEdit: (a: CrmActivity) => void;
  onDelete: (a: CrmActivity) => void;
  canWrite: boolean;
  t: ReturnType<typeof useT>;
}) {
  const Icon = TYPE_ICONS[activity.activityType] ?? StickyNote;
  const colorCls = TYPE_COLORS[activity.activityType] ?? TYPE_COLORS.NOTE;

  const occurredAt = activity.occurredAt ?? activity.createdAt;
  const dateStr = new Date(occurredAt).toLocaleString('hu-HU', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition group">
      <div className="flex items-start gap-3">
        <div className={clsx('flex-shrink-0 p-2 rounded-lg', colorCls)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className="font-medium text-sm text-gray-900">{activity.subject}</span>
              {activity.activityType === 'CALL' && activity.direction && (
                <span className="ml-2 text-xs text-gray-400">
                  ({activity.direction === 'inbound' ? t.activities.callInbound : t.activities.callOutbound}
                  {activity.durationMinutes ? ` · ${t.activities.durationMin(activity.durationMinutes)}` : ''})
                </span>
              )}
              {activity.activityType === 'EMAIL' && activity.direction && (
                <span className="ml-2 text-xs text-gray-400">
                  ({activity.direction === 'inbound' ? t.activities.emailInbound : t.activities.emailOutbound})
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {dateStr}
              </span>
              {canWrite && (
                <>
                  <button
                    type="button"
                    onClick={() => onEdit(activity)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(activity)}
                    className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {activity.body && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{activity.body}</p>
          )}

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {activity.customerName && (
              <span className="text-xs text-gray-400">👤 {activity.customerName}</span>
            )}
            {activity.dealTitle && (
              <span className="text-xs text-gray-400">💼 {activity.dealTitle}</span>
            )}
            {activity.createdByName && (
              <span className="text-xs text-gray-300">{activity.createdByName}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Delete confirm ─────────────────────────────────────── */
function DeleteActivityConfirm({ activity, onClose, onDeleted }: {
  activity: CrmActivity;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT();
  const [deleting, setDeleting] = useState(false);
  async function handle() {
    setDeleting(true);
    try {
      await deleteActivity(activity.id);
      toast.success(t.activities.toastDeleted);
      onDeleted();
      onClose();
    } catch {
      toast.error(t.activities.toastDeleteFailed);
      setDeleting(false);
    }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-semibold">{t.activities.deleteTitle}</h2>
        <p className="text-sm text-gray-500">{t.activities.deleteConfirm(activity.subject ?? '')}</p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
            {t.common.cancel}
          </button>
          <button type="button" disabled={deleting} onClick={handle}
            className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold transition">
            {deleting ? t.common.saving : t.common.delete}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────── */
export default function ActivitiesPage() {
  const t = useT();
  const canWrite = useCanAccess('crm.write');
  const { activities, mutate, isLoading } = useActivities();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editActivity, setEditActivity] = useState<CrmActivity | null>(null);
  const [deleteAct, setDeleteAct] = useState<CrmActivity | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('time');
  const [activeTab, setActiveTab] = useState<'all' | 'project_feed'>('all');
  const [search, setSearch] = useState('');

  const TYPE_LABELS = buildTypeLabels(t);

  // Load related data for modals
  useEffect(() => {
    Promise.all([
      // A /customers paginated: {items,total,take,skip}. A fallback még kezeli a régi shape-eket.
      apiClient.get('/customers?take=1000').then(r => setCustomers(r.data?.items ?? r.data?.data ?? r.data ?? [])),
      apiClient.get('/deals').then(r => setDeals(Array.isArray(r.data) ? r.data : (r.data?.data ?? []))),
      apiClient.get('/projects').then(r => setProjects(Array.isArray(r.data) ? r.data : (r.data?.data ?? []))),
    ]).catch(() => {});
  }, []);

  /* Type stats */
  const typeCounts = ACTIVE_TYPES.reduce((acc, k) => {
    acc[k] = activities.filter(a => a.activityType === k).length;
    return acc;
  }, {} as Record<string, number>);

  /* Filtering */
  let filtered = [...activities];
  if (activeTab === 'project_feed') {
    filtered = filtered.filter(a => a.activityType === 'NOTE' || a.activityType === 'SITE_VISIT');
  }
  if (filterType !== 'all') {
    filtered = filtered.filter(a => a.activityType === filterType);
  }
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(a =>
      a.subject?.toLowerCase().includes(q) ||
      a.body?.toLowerCase().includes(q) ||
      a.customerName?.toLowerCase().includes(q),
    );
  }

  /* Grouping */
  const grouped: { key: string; label: string; items: CrmActivity[] }[] = [];
  if (groupBy === 'time') {
    const byDate = filtered.reduce((acc, a) => {
      const d = new Date(a.occurredAt ?? a.createdAt).toLocaleDateString('hu-HU', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
      if (!acc[d]) acc[d] = [];
      acc[d].push(a);
      return acc;
    }, {} as Record<string, CrmActivity[]>);
    for (const [key, items] of Object.entries(byDate)) grouped.push({ key, label: key, items });
  } else if (groupBy === 'customer') {
    const byCustomer = filtered.reduce((acc, a) => {
      const key = a.customerName ?? t.activities.noCustomer;
      if (!acc[key]) acc[key] = [];
      acc[key].push(a);
      return acc;
    }, {} as Record<string, CrmActivity[]>);
    for (const [key, items] of Object.entries(byCustomer)) grouped.push({ key, label: key, items });
  } else {
    const byDeal = filtered.reduce((acc, a) => {
      const key = a.dealTitle ?? t.activities.noDeal;
      if (!acc[key]) acc[key] = [];
      acc[key].push(a);
      return acc;
    }, {} as Record<string, CrmActivity[]>);
    for (const [key, items] of Object.entries(byDeal)) grouped.push({ key, label: key, items });
  }

  if (isLoading) return <div className="p-8 text-gray-400">{t.common.loading}</div>;

  return (
    <div className="p-6 flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.activities.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{t.activities.subtitleTotal(activities.length)}</p>
        </div>
        {canWrite && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
            <Plus className="w-4 h-4" /> {t.activities.newBtn}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={t.activities.searchPh}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Type stats bar */}
      <div className="grid grid-cols-5 gap-3">
        {ACTIVE_TYPES.map(k => {
          const Icon = TYPE_ICONS[k];
          return (
            <button type="button" key={k}
              onClick={() => setFilterType(filterType === k ? 'all' : k)}
              className={clsx(
                'flex items-center gap-2 p-3 rounded-xl border transition',
                filterType === k
                  ? 'border-brand-500 bg-brand-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300',
              )}>
              <div className={clsx('p-1.5 rounded-lg', TYPE_COLORS[k])}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <div className="text-lg font-bold text-gray-900 leading-none">{typeCounts[k] ?? 0}</div>
                <div className="text-xs text-gray-500">{TYPE_LABELS[k]}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab + Group controls */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['all', 'project_feed'] as const).map((tab, i) => (
            <button type="button" key={tab} onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-4 py-1.5 text-xs font-medium transition',
                i > 0 && 'border-l border-gray-200',
                activeTab === tab ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50',
              )}>
              {tab === 'all' ? t.activities.tabAll : t.activities.tabProjectFeed}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-500">{t.activities.groupByLabel}</span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {([['time', t.activities.groupTime], ['customer', t.activities.groupCustomer], ['deal', t.activities.groupDeal]] as [GroupBy, string][]).map(([g, label], i) => (
              <button type="button" key={g} onClick={() => setGroupBy(g)}
                className={clsx(
                  'px-3 py-1.5 text-xs font-medium transition',
                  i > 0 && 'border-l border-gray-200',
                  groupBy === g ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:bg-gray-50',
                )}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Activity list */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {filtered.length === 0 && (
          <div className="text-center text-gray-400 py-16">
            <div className="text-3xl mb-2">📋</div>
            <p>{t.activities.empty}</p>
          </div>
        )}
        {grouped.map(group => (
          <div key={group.key}>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
              {group.label}
              <span className="ml-2 font-normal normal-case text-gray-400">({group.items.length})</span>
            </div>
            <div className="space-y-2">
              {group.items.map(activity => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onEdit={setEditActivity}
                  onDelete={setDeleteAct}
                  canWrite={canWrite}
                  t={t}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
      {(showCreate || editActivity) && (
        <ActivityModal
          initial={editActivity ?? undefined}
          customers={customers}
          deals={deals}
          projects={projects}
          onClose={() => { setShowCreate(false); setEditActivity(null); }}
          onSaved={() => mutate()}
        />
      )}
      {deleteAct && (
        <DeleteActivityConfirm
          activity={deleteAct}
          onClose={() => setDeleteAct(null)}
          onDeleted={() => mutate()}
        />
      )}
    </div>
  );
}
