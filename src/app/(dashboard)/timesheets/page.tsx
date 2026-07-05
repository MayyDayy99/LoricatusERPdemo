'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, BarChart3 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/lib/hooks/use-t';
import { toast } from 'sonner';

/* ── Types ──────────────────────────────────────────────────── */
interface TimesheetEntry {
  id: string; workDate: string; plannedHours?: number; actualHours: number;
  description?: string; taskType?: string;
  project?: { id: string; name: string };
  user?: { id: string; firstName: string; lastName: string };
}

interface Project { id: string; name: string; }

interface UserSummary { userId: string; firstName: string; lastName: string; totalPlanned: number; totalActual: number; }

/* ── Create Modal ──────────────────────────────────────────── */
function CreateTimesheetModal({ projects, onClose, onSaved }: {
  projects: Project[]; onClose: () => void; onSaved: () => void;
}) {
  const t = useT();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    projectId: '', workDate: today, plannedHours: '', actualHours: '', description: '', taskType: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post('/timesheets', {
        projectId: form.projectId || undefined,
        workDate: form.workDate,
        plannedHours: form.plannedHours ? parseFloat(form.plannedHours) : undefined,
        actualHours: parseFloat(form.actualHours),
        description: form.description || undefined,
        taskType: form.taskType || undefined,
      });
      toast.success(t.common.saved);
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Hiba');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{t.timesheets.newTitle}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <select className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}>
            <option value="">{t.common.selectProject}</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <input required type="date" className="border rounded-lg px-3 py-2 text-sm" max={new Date().toISOString().slice(0, 10)}
              value={form.workDate} onChange={e => setForm(f => ({ ...f, workDate: e.target.value }))} />
            <input type="number" min="0" step="0.25" className="border rounded-lg px-3 py-2 text-sm"
              placeholder={t.timesheets.plannedPh} value={form.plannedHours}
              onChange={e => setForm(f => ({ ...f, plannedHours: e.target.value }))} />
            <input required type="number" min="0.25" step="0.25" className="border rounded-lg px-3 py-2 text-sm"
              placeholder={t.timesheets.actualPh} value={form.actualHours}
              onChange={e => setForm(f => ({ ...f, actualHours: e.target.value }))} />
          </div>
          <input className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder={t.timesheets.taskTypePh} value={form.taskType}
            onChange={e => setForm(f => ({ ...f, taskType: e.target.value }))} />
          <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder={t.timesheets.descPh} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">{t.common.cancel}</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {loading ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══ MAIN PAGE ═══ */
export default function TimesheetsPage() {
  const t = useT();
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [userSummary, setUserSummary] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState<'list' | 'summary'>('list');

  const fetchAll = async () => {
    try {
      const [eRes, pRes, sRes] = await Promise.all([
        apiClient.get('/timesheets'),
        apiClient.get('/projects'),
        apiClient.get('/timesheets/summary/by-user').catch(() => ({ data: [] })),
      ]);
      setEntries(eRes.data);
      setProjects(pRes.data);
      setUserSummary(sRes.data);
    } catch { /* */ } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchAll(); }, []);

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/timesheets/${id}`);
      toast.success(t.common.saved);
      fetchAll();
    } catch (err: any) { toast.error(err?.response?.data?.message ?? 'Hiba'); }
  };

  const totalActual = entries.reduce((s, e) => s + e.actualHours, 0);

  if (loading) return <div className="p-8 text-gray-400">{t.common.loading}</div>;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.timesheets.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{t.timesheets.subtitle(entries.length)}</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setView('list')}
              className={`px-3 py-1.5 text-xs font-medium ${view === 'list' ? 'bg-brand-50 text-brand-700' : 'text-gray-500'}`}>
              {t.timesheets.title}
            </button>
            <button onClick={() => setView('summary')}
              className={`px-3 py-1.5 text-xs font-medium ${view === 'summary' ? 'bg-brand-50 text-brand-700' : 'text-gray-500'}`}>
              <BarChart3 className="w-3 h-3 inline mr-1" />{t.timesheets.summaryUser}
            </button>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700">
            <Plus className="w-4 h-4" /> {t.timesheets.newBtn}
          </button>
        </div>
      </div>

      {/* List view */}
      {view === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.timesheets.colDate}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.timesheets.colProject}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{t.timesheets.colPlanned}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{t.timesheets.colActual}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.timesheets.colDesc}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{t.timesheets.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">{t.timesheets.empty}</td></tr>
              )}
              {entries.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 font-medium">
                    {new Date(entry.workDate).toLocaleDateString('hu-HU')}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{entry.project?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{entry.plannedHours ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{entry.actualHours}h</td>
                  <td className="px-4 py-3 text-gray-500 truncate max-w-[200px]">{entry.description ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(entry.id)}
                      className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {entries.length > 0 && (
              <tfoot className="bg-gray-50 border-t">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">{t.timesheets.total}:</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{totalActual}h</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Summary view */}
      {view === 'summary' && (
        <div data-tour="timesheets-summary" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {userSummary.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400">{t.timesheets.empty}</div>
          )}
          {userSummary.map(u => (
            <div key={u.userId} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="font-medium text-gray-900">{u.firstName} {u.lastName}</div>
              <div className="mt-3 flex items-end gap-4">
                <div>
                  <div className="text-xs text-gray-400">{t.timesheets.colPlanned}</div>
                  <div className="text-lg font-semibold text-gray-500">{u.totalPlanned ?? 0}h</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">{t.timesheets.colActual}</div>
                  <div className="text-lg font-bold text-gray-900">{u.totalActual ?? 0}h</div>
                </div>
              </div>
              {u.totalPlanned > 0 && (
                <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-brand-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (u.totalActual / u.totalPlanned) * 100)}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateTimesheetModal projects={projects}
          onClose={() => setShowCreate(false)} onSaved={fetchAll} />
      )}
    </div>
  );
}
