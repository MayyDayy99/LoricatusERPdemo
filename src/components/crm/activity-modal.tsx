'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/lib/hooks/use-t';
import {
  createActivity,
  updateActivity,
  type CrmActivity,
  type CreateActivityDto,
} from '@/lib/hooks/use-crm';

/* ── Types ──────────────────────────────────────────────── */
export interface ActivityModalCustomer {
  id: string;
  firstName: string;
  lastName: string;
  company?: string;
}
export interface ActivityModalDeal {
  id: string;
  title: string;
}
export interface ActivityModalProject {
  id: string;
  name: string;
}

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  CALL:       'Hívás',
  EMAIL:      'E-mail',
  MEETING:    'Megbeszélés',
  NOTE:       'Jegyzet',
  SITE_VISIT: 'Helyszín',
};

export const ACTIVITY_ACTIVE_TYPES = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'SITE_VISIT'] as const;

interface ActivityModalProps {
  initial?: CrmActivity;
  /** Optional pre-loaded relational data. If omitted, the modal fetches them on its own. */
  customers?: ActivityModalCustomer[];
  deals?: ActivityModalDeal[];
  projects?: ActivityModalProject[];
  /** Pre-fill the dealId — used when invoked from the Deal modal "Tevékenységek" tab. */
  dealId?: string;
  /** Pre-fill the customerId — useful for customer-detail pages. */
  customerId?: string;
  /** Pre-fill the projectId — useful for project-room pages. */
  projectId?: string;
  /** Hide the relation pickers (dealId / customerId / projectId selects). */
  hideRelations?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/* ── Activity Modal (create + edit) — extracted, reusable ─ */
export function ActivityModal({
  initial,
  customers: customersProp,
  deals: dealsProp,
  projects: projectsProp,
  dealId,
  customerId,
  projectId,
  hideRelations = false,
  onClose,
  onSaved,
}: ActivityModalProps) {
  const t = useT();
  const [customers, setCustomers] = useState<ActivityModalCustomer[]>(customersProp ?? []);
  const [deals, setDeals] = useState<ActivityModalDeal[]>(dealsProp ?? []);
  const [projects, setProjects] = useState<ActivityModalProject[]>(projectsProp ?? []);

  const [form, setForm] = useState({
    activityType: (initial?.activityType as string) ?? 'NOTE',
    subject:      initial?.subject ?? '',
    body:         initial?.body ?? '',
    customerId:   initial?.customerId ?? customerId ?? '',
    dealId:       initial?.dealId ?? dealId ?? '',
    projectId:    initial?.projectId ?? projectId ?? '',
    direction:    initial?.direction ?? 'outbound',
    durationMinutes: initial?.durationMinutes?.toString() ?? '',
    occurredAt:   initial?.occurredAt
      ? new Date(initial.occurredAt).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
  });
  const [loading, setLoading] = useState(false);

  // Lazy-fetch relation data only if not provided AND relations are visible.
  useEffect(() => {
    if (hideRelations) return;
    const needCustomers = !customersProp || customersProp.length === 0;
    const needDeals     = !dealsProp || dealsProp.length === 0;
    const needProjects  = !projectsProp || projectsProp.length === 0;
    if (!needCustomers && !needDeals && !needProjects) return;

    const promises: Promise<unknown>[] = [];
    if (needCustomers) {
      promises.push(
        // A /customers most paginated objektum-ot ad ({items,total,take,skip}) —
        // a fallback még visszamenőleg kezeli a régi tömb-shape-et is.
        apiClient.get('/customers?take=1000').then(r => setCustomers(r.data?.items ?? r.data?.data ?? r.data ?? [])),
      );
    }
    if (needDeals) {
      promises.push(
        apiClient.get('/deals').then(r => setDeals(Array.isArray(r.data) ? r.data : (r.data?.data ?? []))),
      );
    }
    if (needProjects) {
      promises.push(
        apiClient.get('/projects').then(r => setProjects(Array.isArray(r.data) ? r.data : (r.data?.data ?? []))),
      );
    }
    Promise.all(promises).catch(() => {});
  }, [hideRelations, customersProp, dealsProp, projectsProp]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        subject:        form.subject,
        body:           form.body || undefined,
        customerId:     form.customerId || undefined,
        dealId:         form.dealId || undefined,
        projectId:      form.projectId || undefined,
        direction:      (form.activityType === 'CALL' || form.activityType === 'EMAIL') ? form.direction : undefined,
        durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : undefined,
        occurredAt:     form.occurredAt || undefined,
      };
      if (initial) {
        await updateActivity(initial.id, payload);
        toast.success(t.activities.toastSavedEdit);
      } else {
        await createActivity({ ...payload, activityType: form.activityType as CreateActivityDto['activityType'] });
        toast.success(t.activities.toastSavedNew);
      }
      onSaved();
      onClose();
    } catch {
      toast.error(t.activities.toastSaveFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">
          {initial ? t.activities.editTitle : t.activities.newTitle}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {!initial && (
            <select
              aria-label={t.tasks.activityType}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.activityType}
              onChange={e => setForm(f => ({ ...f, activityType: e.target.value }))}
            >
              {ACTIVITY_ACTIVE_TYPES.map(k => (
                <option key={k} value={k}>{ACTIVITY_TYPE_LABELS[k]}</option>
              ))}
            </select>
          )}

          <input
            required
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder={t.activities.subjectPh}
            value={form.subject}
            onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
          />

          <textarea
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
            placeholder={t.activities.bodyPh}
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          />

          {(form.activityType === 'CALL' || form.activityType === 'EMAIL') && (
            <div className="grid grid-cols-2 gap-2">
              <select
                className="border rounded-lg px-3 py-2 text-sm"
                value={form.direction}
                onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}
              >
                <option value="outbound">{t.activities.directionOutbound}</option>
                <option value="inbound">{t.activities.directionInbound}</option>
              </select>
              {form.activityType === 'CALL' && (
                <input
                  type="number" min="0"
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder={t.activities.durationPh}
                  value={form.durationMinutes}
                  onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value }))}
                />
              )}
            </div>
          )}

          <input
            type="datetime-local"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.occurredAt}
            onChange={e => setForm(f => ({ ...f, occurredAt: e.target.value }))}
          />

          {!hideRelations && (
            <>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.customerId}
                onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
              >
                <option value="">{t.activities.customerOptPh}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}{c.company ? ` (${c.company})` : ''}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-2">
                <select
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={form.dealId}
                  onChange={e => setForm(f => ({ ...f, dealId: e.target.value }))}
                >
                  <option value="">{t.activities.dealOptPh}</option>
                  {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>

                <select
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={form.projectId}
                  onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
                >
                  <option value="">{t.activities.projectOptPh}</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition">
              {t.common.cancel}
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition">
              {loading ? t.common.saving : (initial ? t.common.save : t.activities.newBtn)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ActivityModal;
