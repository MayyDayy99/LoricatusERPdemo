'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowLeft, ArrowRight, Clock, History, Plus, Save, Trash2, RefreshCw, CheckCircle2, Link2, X, Sparkles, Archive, ArchiveRestore, FileText, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { EmojiPicker } from '@/components/emoji-picker';
import { useUsers, updateProfile, setUserActive, useCurrentUser, type User } from '@/lib/hooks/use-users';
import {
  useTaskChainTemplates, upsertTaskChainTemplate, deleteTaskChainTemplate,
  type TaskChainTemplate,
} from '@/lib/hooks/use-dashboard';
import {
  useWeatherThresholds, updateWeatherThresholds, resetWeatherThresholds,
} from '@/lib/hooks/use-weather';
import {
  useTaskTypes, saveTaskTypes, resetTaskTypes, type TaskType,
} from '@/lib/hooks/use-task-types';
import {
  useWorksheetTemplates, createWorksheetTemplate, updateWorksheetTemplate,
  archiveWorksheetTemplate, importGreenareaTemplate,
  type WorksheetTemplate, type WorksheetSection, type WorksheetItem,
} from '@/lib/hooks/use-worksheet-templates';
import {
  useProjectTemplates, createProjectTemplate, archiveProjectTemplate,
  unarchiveProjectTemplate, deleteProjectTemplate, importGreenAreaTemplate,
} from '@/lib/hooks/use-project-templates';

/* ── Types ────────────────────────────────────────────────── */
type RoleType = 'operativ' | 'irodai' | 'mixed';

interface Equipment {
  id: string;
  name: string;
  category: string;
  status: string;
  serialNumber?: string;
  description?: string;
  holderId?: string;
  note?: string;
}

const CATEGORY_OPTIONS = [
  { value: 'drone',          label: 'Drón' },
  { value: 'car',            label: 'Autó' },
  { value: 'pc',             label: 'PC' },
  { value: 'software',       label: 'Szoftver' },
  { value: 'laser_scanner',  label: 'Lézerszkenner' },
  { value: 'gnss_receiver',  label: 'GNSS' },
  { value: 'total_station',  label: 'Mérőállomás' },
  { value: 'camera',         label: 'Kamera' },
  { value: 'misc',           label: 'Egyéb felszerelés' },
  { value: 'other',          label: 'Egyéb' },
];

const STATUS_LABELS: Record<string, string> = {
  available: 'Szabad',
  in_use: 'Használatban',
  maintenance: 'Szervizben',
  retired: 'Selejt',
};

const ROLE_TYPE_OPTIONS: { value: RoleType; label: string }[] = [
  { value: 'operativ', label: 'Operatív (terep)' },
  { value: 'irodai',   label: 'Irodai' },
  { value: 'mixed',    label: 'Vegyes' },
];

const PALETTE = ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#f87171', '#c084fc', '#5eead4', '#fb923c', '#38bdf8'];

const fetcher = (url: string) => apiClient.get(url).then(r => r.data);

/* ── PEOPLE TAB ──────────────────────────────────────────── */
function PeopleTab() {
  const { users, mutate } = useUsers();
  const { currentUser } = useCurrentUser();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { roleType: RoleType; displayColor: string }>>({});

  useEffect(() => {
    const next: Record<string, { roleType: RoleType; displayColor: string }> = {};
    for (const u of users) {
      next[u.id] = {
        roleType: (u.roleType as RoleType) ?? 'mixed',
        displayColor: u.displayColor ?? PALETTE[u.id.charCodeAt(0) % PALETTE.length],
      };
    }
    setDrafts(next);
  }, [users]);

  async function save(u: User) {
    const draft = drafts[u.id];
    if (!draft) return;
    setSavingId(u.id);
    try {
      await updateProfile(u.id, { roleType: draft.roleType, displayColor: draft.displayColor });
      await mutate();
    } finally {
      setSavingId(null);
    }
  }

  async function removeFromTeam(u: User) {
    if (!confirm(
      `Inaktiválod ${u.firstName} ${u.lastName}-t? A fiók megmarad (visszafordítható), ` +
      `de a Csapat listán innen el fog tűnni és nem tud belépni a rendszerbe.`,
    )) return;
    setRemovingId(u.id);
    try {
      await setUserActive(u.id, false);
      await mutate();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Inaktiválás sikertelen');
    } finally {
      setRemovingId(null);
    }
  }

  // Csak az aktív tagok jelennek meg itt — az inaktív felhasználók a /users oldal
  // alján található "Inaktív" gyűjtőben láthatók és onnan reaktiválhatók is.
  const activeUsers = users.filter(u => u.isActive);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Név</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Szerep</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Típus (dashboard)</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Szín</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">—</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {activeUsers.map(u => {
            const draft = drafts[u.id];
            if (!draft) return null;
            const isSelf = currentUser?.id === u.id;
            return (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{u.firstName} {u.lastName}</div>
                  <div className="text-xs text-gray-400">{u.email}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{u.role}</td>
                <td className="px-4 py-3">
                  <select
                    value={draft.roleType}
                    onChange={e => setDrafts(d => ({ ...d, [u.id]: { ...draft, roleType: e.target.value as RoleType } }))}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  >
                    {ROLE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draft.displayColor}
                      onChange={e => setDrafts(d => ({ ...d, [u.id]: { ...draft, displayColor: e.target.value } }))}
                      className="w-8 h-8 border border-gray-200 rounded cursor-pointer"
                    />
                    <code className="text-xs text-gray-500">{draft.displayColor}</code>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1 justify-end">
                    <button
                      onClick={() => save(u)}
                      disabled={savingId === u.id || removingId === u.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-60"
                    >
                      {savingId === u.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Mentés
                    </button>
                    <button
                      onClick={() => removeFromTeam(u)}
                      disabled={savingId === u.id || removingId === u.id || isSelf}
                      title={isSelf ? 'Saját fiók nem inaktiválható' : 'Inaktiválás (kivétel a csapatból)'}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      {removingId === u.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {activeUsers.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Nincs aktív felhasználó.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ── EQUIPMENT TAB ───────────────────────────────────────── */
function EquipmentTab() {
  const { data: equipment, mutate: mutateEq } = useSWR<Equipment[]>('/equipment', fetcher);
  const { users } = useUsers();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [showingHistory, setShowingHistory] = useState<Equipment | null>(null);

  async function handleDelete(eq: Equipment) {
    if (!confirm(`Törlöd: ${eq.name}?`)) return;
    await apiClient.delete(`/equipment/${eq.id}`);
    mutateEq();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{equipment?.length ?? 0} eszköz</p>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700"
        >
          <Plus className="w-4 h-4" /> Új eszköz
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Név</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Kategória</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Státusz</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Nálunk</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Megjegyzés</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">—</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {equipment?.map(eq => {
              const holder = eq.holderId ? users.find(u => u.id === eq.holderId) : null;
              const catLabel = CATEGORY_OPTIONS.find(c => c.value === eq.category)?.label ?? eq.category;
              return (
                <tr key={eq.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setEditing(eq)}>
                  <td className="px-4 py-3 font-medium text-gray-900">{eq.name}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{catLabel}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                      {STATUS_LABELS[eq.status] ?? eq.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{holder ? `${holder.firstName} ${holder.lastName}` : '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{eq.note ?? '—'}</td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setShowingHistory(eq)}
                        title="Történet"
                        className="text-gray-400 hover:text-brand-600 p-1 rounded"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(eq)} className="text-red-500 hover:text-red-700 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(!equipment || equipment.length === 0) && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">Nincs eszköz.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showNew && <EquipmentModal onClose={() => setShowNew(false)} onSaved={() => { mutateEq(); setShowNew(false); }} />}
      {editing && (
        <EquipmentModal
          equipment={editing}
          users={users}
          onClose={() => setEditing(null)}
          onSaved={() => { mutateEq(); setEditing(null); }}
        />
      )}
      {showingHistory && (
        <EquipmentRevisionsModal
          equipment={showingHistory}
          users={users}
          onClose={() => setShowingHistory(null)}
        />
      )}
    </>
  );
}

interface EquipmentRevisionEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  projectId?: string;
  oldDurationDays: number | null;
  newDurationDays: number;
  deltaDays: number;
  reason?: string;
  changedBy: string;
  changedAt: string;
}

interface EquipmentRevisionAggregate {
  totalRevisions: number;
  totalDeltaDays: number;
  positiveCount: number;
  negativeCount: number;
  taskCount: number;
  entries: EquipmentRevisionEntry[];
}

function EquipmentRevisionsModal({
  equipment, users, onClose,
}: {
  equipment: Equipment;
  users?: User[];
  onClose: () => void;
}) {
  const { data, error } = useSWR<EquipmentRevisionAggregate>(
    `/equipment/${equipment.id}/revisions`,
    fetcher,
  );
  const userById = (id: string) => {
    const u = users?.find(u => u.id === id);
    return u ? `${u.firstName} ${u.lastName}` : '— ismeretlen —';
  };

  const fmtDays = (d: number) => {
    const sign = d > 0 ? '+' : '';
    return `${sign}${d.toFixed(2)} nap`;
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">Történet — {equipment.name}</h3>
            <p className="text-xs text-gray-400">Az eszközhöz tartozó task-ok időtartam-módosításai</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!data && !error && <p className="text-sm text-gray-500">Betöltés…</p>}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              Hiba a betöltésnél.
            </div>
          )}
          {data && (
            <>
              {/* Aggregate stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900">{data.totalRevisions}</div>
                  <div className="text-xs text-gray-500">Módosítás</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900">{data.taskCount}</div>
                  <div className="text-xs text-gray-500">Érintett task</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-700">+{data.positiveCount}</div>
                  <div className="text-xs text-red-600">Növelés</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">−{data.negativeCount}</div>
                  <div className="text-xs text-green-600">Csökkentés</div>
                </div>
              </div>

              <div className={`rounded-lg p-3 text-center font-medium ${data.totalDeltaDays > 0 ? 'bg-red-50 text-red-700' : data.totalDeltaDays < 0 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'}`}>
                Összes eltolás: {fmtDays(data.totalDeltaDays)}
              </div>

              {/* Entries */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tételek</p>
                {data.entries.length === 0 && (
                  <p className="text-sm text-gray-400 italic py-4 text-center">Nincs módosítás.</p>
                )}
                {data.entries.length > 0 && (
                  <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                    {data.entries.map(entry => {
                      const arrow = entry.deltaDays > 0 ? '↑' : entry.deltaDays < 0 ? '↓' : '→';
                      const color = entry.deltaDays > 0 ? 'text-red-600' : entry.deltaDays < 0 ? 'text-green-600' : 'text-gray-500';
                      return (
                        <li key={entry.id} className="px-3 py-2 text-sm hover:bg-gray-50">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-lg ${color}`}>{arrow}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{entry.taskTitle}</p>
                              <p className="text-xs text-gray-500">
                                {entry.oldDurationDays != null ? `${entry.oldDurationDays.toFixed(2)} → ` : ''}
                                {entry.newDurationDays.toFixed(2)} nap
                                {' · '}
                                <span className={color}>{fmtDays(entry.deltaDays)}</span>
                              </p>
                              {entry.reason && (
                                <p className="text-xs text-gray-400 mt-0.5 italic">"{entry.reason}"</p>
                              )}
                            </div>
                            <div className="text-right text-xs text-gray-400">
                              <Clock className="w-3 h-3 inline mr-0.5" />
                              {new Date(entry.changedAt).toLocaleDateString('hu-HU', { year: '2-digit', month: 'short', day: 'numeric' })}
                              <p>{userById(entry.changedBy)}</p>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EquipmentModal({
  equipment, users, onClose, onSaved,
}: {
  equipment?: Equipment; users?: User[];
  onClose: () => void; onSaved: () => void;
}) {
  const isNew = !equipment;
  const [form, setForm] = useState({
    name: equipment?.name ?? '',
    category: equipment?.category ?? 'pc',
    status: equipment?.status ?? 'available',
    serialNumber: equipment?.serialNumber ?? '',
    description: equipment?.description ?? '',
    holderId: equipment?.holderId ?? '',
    note: equipment?.note ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // POST /equipment-en a status mező nincs benne a CreateEquipmentDto-ban
      // (default AVAILABLE a service-ben). Csak edit-nél küldjük.
      const baseBody = {
        name: form.name,
        category: form.category,
        serialNumber: form.serialNumber || undefined,
        description: form.description || undefined,
        holderId: form.holderId || undefined,
        note: form.note || undefined,
      };
      if (isNew) {
        await apiClient.post('/equipment', baseBody);
      } else {
        await apiClient.patch(`/equipment/${equipment!.id}`, { ...baseBody, status: form.status });
      }
      onSaved();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Mentés sikertelen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={save} className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900">{isNew ? 'Új eszköz' : form.name}</h2>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Név *</label>
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Kategória</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Státusz</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Gyári szám</label>
          <input value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Leírás</label>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>

        {users && (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Jelenlegi tulajdonos</label>
            <select value={form.holderId} onChange={e => setForm(f => ({ ...f, holderId: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              <option value="">—</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Megjegyzés</label>
          <textarea rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            placeholder='pl. "Győrben, szerdán visszaér"' />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
            Mégsem
          </button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Mentés
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── SOFTWARE-PC MATRIX ──────────────────────────────────── */
function SoftwarePcTab() {
  const { data: equipment } = useSWR<Equipment[]>('/equipment', fetcher);
  const { data: matrix, mutate: mutateMatrix } = useSWR<{ softwareId: string; pcId: string }[]>('/equipment/software-pc/list', fetcher);

  const softwares = equipment?.filter(e => e.category === 'software') ?? [];
  const pcs = equipment?.filter(e => e.category === 'pc') ?? [];
  const linked = new Set((matrix ?? []).map(l => `${l.softwareId}|${l.pcId}`));

  async function toggle(softwareId: string, pcId: string) {
    const key = `${softwareId}|${pcId}`;
    if (linked.has(key)) {
      await apiClient.delete(`/equipment/software-pc/${softwareId}/${pcId}`);
    } else {
      await apiClient.post('/equipment/software-pc', { softwareId, pcId });
    }
    mutateMatrix();
  }

  if (softwares.length === 0 || pcs.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <Link2 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">
          A mátrix megjelenítéséhez legalább 1 szoftver és 1 PC kategóriájú eszköz kell.
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Menj az <span className="font-medium">Eszközök</span> tabra és hozz létre ilyen kategóriájú eszközöket.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 sticky left-0 bg-gray-50">Szoftver \ PC</th>
            {pcs.map(pc => (
              <th key={pc.id} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">{pc.name}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {softwares.map(sw => (
            <tr key={sw.id}>
              <td className="px-4 py-3 font-medium text-gray-900 sticky left-0 bg-white">{sw.name}</td>
              {pcs.map(pc => {
                const on = linked.has(`${sw.id}|${pc.id}`);
                return (
                  <td key={pc.id} className="px-3 py-3 text-center">
                    <button
                      onClick={() => toggle(sw.id, pc.id)}
                      className={`w-7 h-7 rounded-lg border-2 transition flex items-center justify-center ${
                        on ? 'bg-brand-500 border-brand-500 text-white' : 'bg-white border-gray-200 hover:border-brand-300'
                      }`}
                    >
                      {on && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── GANTT BEÁLLÍTÁSOK TAB ──────────────────────────────── */
function SettingsTab() {
  const [daysBehind, setDaysBehind] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const v = parseInt(localStorage.getItem('meetingDaysBehind') ?? '0', 10);
    return isNaN(v) ? 0 : Math.max(0, Math.min(180, v));
  });

  function commit(v: number) {
    const clamped = Math.max(0, Math.min(180, v));
    setDaysBehind(clamped);
    if (typeof window !== 'undefined') {
      localStorage.setItem('meetingDaysBehind', String(clamped));
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 max-w-xl">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Visszanéz a Gantt-on</h3>
        <p className="text-xs text-gray-500 mt-1">
          Hány nap múltat mutasson a Gantt a mai napok előtt. A mai nap így a (N+1)-edik
          oszlopban jelenik meg, és a múltbéli napokat halvány piros átlós csíkokkal jelöljük.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="number"
          min={0}
          max={180}
          value={daysBehind}
          onChange={e => commit(parseInt(e.target.value, 10) || 0)}
          className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <span className="text-sm text-gray-500">nap (0–180)</span>
        <span className="ml-auto text-xs text-gray-400">
          Mentés: localStorage (csak ezen a böngészőn)
        </span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[0, 7, 14, 30, 60].map(v => (
          <button
            key={v}
            onClick={() => commit(v)}
            className={`text-xs px-3 py-1 rounded ${
              daysBehind === v ? 'bg-brand-100 text-brand-700 border border-brand-300' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {v === 0 ? 'Csak jövő' : v + ' nap'}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── TASK-TÍPUSOK TAB ────────────────────────────────────── */
const DEFAULT_NEW_TYPE_COLOR = '#64748b';

function isValidTaskTypeValue(v: string): boolean {
  return /^[a-z0-9_-]+$/.test(v) && v.length >= 1 && v.length <= 30;
}

function TaskTypesTab() {
  // Melyik sor emoji-pickere van nyitva (index), null = egyik sem.
  const [emojiPickerRow, setEmojiPickerRow] = useState<number | null>(null);
  const { taskTypes, isCustom, mutate } = useTaskTypes();
  const [drafts, setDrafts] = useState<TaskType[]>([]);
  const [originalValues, setOriginalValues] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (taskTypes) {
      setDrafts(taskTypes.map(t => ({ ...t })));
      setOriginalValues(new Set(taskTypes.map(t => t.value)));
    }
  }, [taskTypes]);

  function updateDraft(idx: number, patch: Partial<TaskType>) {
    setDrafts(d => d.map((t, i) => i === idx ? { ...t, ...patch } : t));
  }

  function addNew() {
    if (drafts.length >= 20) {
      alert('Legfeljebb 20 task-típus lehet.');
      return;
    }
    const nextSort = drafts.length === 0 ? 0 : Math.max(...drafts.map(d => d.sortIndex)) + 1;
    setDrafts(d => [...d, { value: '', label: '', color: DEFAULT_NEW_TYPE_COLOR, sortIndex: nextSort }]);
  }

  function remove(idx: number) {
    if (drafts.length <= 1) {
      alert('Legalább 1 task-típus kell.');
      return;
    }
    setDrafts(d => d.filter((_, i) => i !== idx));
  }

  function move(idx: number, dir: -1 | 1) {
    setDrafts(d => {
      const next = [...d];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return d;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((t, i) => ({ ...t, sortIndex: i }));
    });
  }

  // Validáció a Mentés gombhoz
  const valuesSeen = new Map<string, number>();
  drafts.forEach((t, i) => valuesSeen.set(t.value, (valuesSeen.get(t.value) ?? 0) + 1));
  const errors: string[] = [];
  drafts.forEach((t, i) => {
    if (!t.label.trim()) errors.push(`#${i + 1}: Név hiányzik`);
    if (!isValidTaskTypeValue(t.value)) errors.push(`#${i + 1}: érvénytelen kód (csak kisbetű, szám, _ és -)`);
    if ((valuesSeen.get(t.value) ?? 0) > 1) errors.push(`#${i + 1}: duplikált kód "${t.value}"`);
    if (!/^#[0-9a-fA-F]{6}$/.test(t.color)) errors.push(`#${i + 1}: érvénytelen szín`);
  });

  async function save() {
    if (errors.length > 0) {
      alert('Javítsd a hibákat: \n• ' + errors.slice(0, 5).join('\n• '));
      return;
    }
    setSaving(true);
    try {
      const list = drafts.map((t, i) => ({ ...t, sortIndex: i }));
      await saveTaskTypes(list);
      await mutate();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Mentés sikertelen');
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!confirm('Visszaállítod az alapértelmezett 7 task-típust? A saját módosításaid elvesznek.')) return;
    setResetting(true);
    try {
      await resetTaskTypes();
      await mutate();
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Task-típusok</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            Ezeket a típusokat választhatod a task-okhoz, és a Gantt-on a sávjuk színe innen jön.
            A <strong>kód</strong> egyedi azonosító — ha módosítod, a meglévő task-ok elveszítik a típus-társítást.
            Új típus hozzáadása nem érinti a régi adatokat.
          </p>
        </div>
        <div className="text-xs text-gray-400 whitespace-nowrap">
          {isCustom ? 'Egyéni beállítás aktív' : 'Alapértékek aktívak'}
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-12">Szín</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-16">Emoji</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Név</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Kód</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 w-24">Esemény-szerű</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 w-24">Sorrend</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 w-12">—</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {drafts.map((t, i) => {
              const isExisting = originalValues.has(t.value);
              const isDuplicate = (valuesSeen.get(t.value) ?? 0) > 1;
              return (
                <tr key={i}>
                  <td className="px-3 py-2">
                    <input
                      type="color"
                      value={t.color}
                      onChange={e => updateDraft(i, { color: e.target.value })}
                      className="w-8 h-8 border border-gray-200 rounded cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="relative flex items-center gap-1">
                      <input
                        value={t.icon ?? ''}
                        onChange={e => updateDraft(i, { icon: e.target.value })}
                        maxLength={8}
                        placeholder="🧾"
                        title="Emoji-karakter (csak esemény-szerű típusokon látszik a bar-on). Kézzel is beírható, vagy válassz a 🙂 gombbal."
                        className="w-12 text-center border border-gray-200 rounded-lg px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      />
                      <button
                        type="button"
                        onClick={() => setEmojiPickerRow(emojiPickerRow === i ? null : i)}
                        title="Emoji választása"
                        className="shrink-0 w-7 h-7 flex items-center justify-center border border-gray-200 rounded-lg text-sm hover:bg-brand-50 transition"
                      >
                        🙂
                      </button>
                      {emojiPickerRow === i && (
                        <EmojiPicker
                          value={t.icon ?? ''}
                          onSelect={(emoji) => updateDraft(i, { icon: emoji })}
                          onClose={() => setEmojiPickerRow(null)}
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={t.label}
                      onChange={e => updateDraft(i, { label: e.target.value })}
                      maxLength={50}
                      placeholder="pl. Terep"
                      className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={t.value}
                      onChange={e => updateDraft(i, { value: e.target.value.toLowerCase().trim() })}
                      maxLength={30}
                      placeholder="pl. terep"
                      title={isExisting ? 'Módosítható, de a meglévő task-ok elvesztik a társítást' : 'Új típus kódja'}
                      className={`w-full border rounded-lg px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 ${
                        isDuplicate || (t.value && !isValidTaskTypeValue(t.value))
                          ? 'border-red-300 focus:ring-red-400'
                          : 'border-gray-200 focus:ring-brand-400'
                      }`}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={t.isUnassigned ?? false}
                      onChange={e => updateDraft(i, { isUnassigned: e.target.checked })}
                      title="Ha bekapcsolva: a task nem személyhez kötött (mint a gépidő); a 'Ki' mező disabled, a bar-on az emoji látszik az avatar helyett."
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed px-1"
                      >▲</button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === drafts.length - 1}
                        className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed px-1"
                      >▼</button>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      disabled={drafts.length <= 1}
                      className="text-red-400 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed p-1"
                      title={drafts.length <= 1 ? 'Legalább 1 típus kell' : 'Törlés'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addNew}
          disabled={drafts.length >= 20}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" /> Új típus
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={resetting || !isCustom}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            {resetting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Alapértékre
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || errors.length > 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
            title={errors.length > 0 ? errors.join('\n') : 'Mentés'}
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Mentés
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
          {errors.slice(0, 3).map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}
    </div>
  );
}

/* ── MUNKALAP-SABLONOK TAB ───────────────────────────────── */
function WorksheetTemplatesTab() {
  const { templates, isLoading, mutate } = useWorksheetTemplates();
  const [editing, setEditing] = useState<WorksheetTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleImport() {
    if (!confirm('Importáljuk a "Zöldfelületi tanúsítvány" minta-sablont? A 4 szekciós checklist (A1-D3) bekerül a sablonok közé.')) return;
    setImporting(true);
    try {
      await importGreenareaTemplate();
      await mutate();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Importálás sikertelen');
    } finally {
      setImporting(false);
    }
  }

  async function handleArchive(t: WorksheetTemplate) {
    if (!confirm(`Archiváld a sablont: "${t.name}"? A meglévő, már létrejött munkalapok nem érintettek.`)) return;
    try {
      await archiveWorksheetTemplate(t.id);
      await mutate();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Archiválás sikertelen');
    }
  }

  if (creating || editing) {
    return (
      <WorksheetTemplateEditor
        template={editing}
        onCancel={() => { setEditing(null); setCreating(false); }}
        onSaved={() => { mutate(); setEditing(null); setCreating(false); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Munkalap-sablonok</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            Szolgáltatás-típusonként készíts sablon-checklist-et (szekciók + kódolt sorok + opcionális eszköz/felelős).
            Az árajánlat-formán a felhasználó kiválasztja, melyik sablon kerüljön a munkalapra. Az elfogadáskor a
            rendszer egy <strong>pillanatképet</strong> klónoz a munkalapra; a sablon későbbi módosítása nem érinti a
            már létrejött munkalapokat.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700"
          >
            <Plus className="w-4 h-4" /> Új sablon
          </button>
          <button
            onClick={handleImport}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
            title="Beállított sablon importálása: Zöldfelületi tanúsítvány (4 szekció, 23 sor)"
          >
            {importing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Zöldfelületi-minta importálása
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Név</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Szín</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Szekciók</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Sorok</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">—</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Töltés…</td></tr>}
            {!isLoading && (templates ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Még nincs munkalap-sablon. Importálj egy mintát vagy hozz létre újat.</td></tr>
            )}
            {(templates ?? []).map(t => {
              const totalItems = (t.sections ?? []).reduce((acc, s) => acc + (s.items?.length ?? 0), 0);
              return (
                <tr key={t.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setEditing(t)}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {t.name}
                    {t.description && <div className="text-xs text-gray-400 mt-0.5">{t.description}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {t.color && (
                      <span style={{ display: 'inline-block', width: 22, height: 22, background: t.color, borderRadius: 4, border: '1px solid #ccc' }} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{(t.sections ?? []).length}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{totalItems}</td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleArchive(t)}
                      className="text-red-400 hover:text-red-700 p-1"
                      title="Archiválás"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* WorksheetTemplateEditor — sablon szerkesztő (új vagy meglévő) */
function WorksheetTemplateEditor({
  template, onCancel, onSaved,
}: {
  template: WorksheetTemplate | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const isNew = !template;
  const [form, setForm] = useState<{
    name: string;
    description: string;
    color: string;
    sections: WorksheetSection[];
  }>(() => ({
    name: template?.name ?? '',
    description: template?.description ?? '',
    color: template?.color ?? '#2f6f3e',
    sections: template?.sections ?? [
      { code: 'A', title: '', items: [{ code: 'A1', task: '' }] },
    ],
  }));
  const [saving, setSaving] = useState(false);

  function updateSection(idx: number, patch: Partial<WorksheetSection>) {
    setForm(f => ({ ...f, sections: f.sections.map((s, i) => i === idx ? { ...s, ...patch } : s) }));
  }
  function addSection() {
    const nextCode = String.fromCharCode(65 + form.sections.length); // A, B, C...
    setForm(f => ({ ...f, sections: [...f.sections, { code: nextCode, title: '', items: [{ code: `${nextCode}1`, task: '' }] }] }));
  }
  function removeSection(idx: number) {
    if (form.sections.length <= 1) { alert('Legalább 1 szekció kell.'); return; }
    setForm(f => ({ ...f, sections: f.sections.filter((_, i) => i !== idx) }));
  }
  function moveSection(idx: number, dir: -1 | 1) {
    setForm(f => {
      const next = [...f.sections];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return f;
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...f, sections: next };
    });
  }
  function updateItem(secIdx: number, itemIdx: number, patch: Partial<WorksheetItem>) {
    setForm(f => ({
      ...f,
      sections: f.sections.map((s, i) => i === secIdx
        ? { ...s, items: s.items.map((it, j) => j === itemIdx ? { ...it, ...patch } : it) }
        : s),
    }));
  }
  function addItem(secIdx: number) {
    setForm(f => ({
      ...f,
      sections: f.sections.map((s, i) => {
        if (i !== secIdx) return s;
        const nextNum = s.items.length + 1;
        return { ...s, items: [...s.items, { code: `${s.code}${nextNum}`, task: '' }] };
      }),
    }));
  }
  function removeItem(secIdx: number, itemIdx: number) {
    setForm(f => ({
      ...f,
      sections: f.sections.map((s, i) => {
        if (i !== secIdx) return s;
        if (s.items.length <= 1) { alert('Szekciónak legalább 1 sora legyen.'); return s; }
        return { ...s, items: s.items.filter((_, j) => j !== itemIdx) };
      }),
    }));
  }

  async function save() {
    if (!form.name.trim()) { alert('Sablon-név kötelező'); return; }
    for (const s of form.sections) {
      if (!s.code.trim() || !s.title.trim()) { alert(`Szekció "${s.code}": kód és cím kötelező`); return; }
      for (const it of s.items) {
        if (!it.code.trim() || !it.task.trim()) { alert(`Sor "${it.code}": kód és feladat kötelező`); return; }
      }
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        color: form.color,
        sections: form.sections.map((s, sIdx) => ({
          code: s.code,
          title: s.title,
          sortIndex: sIdx,
          items: s.items.map((it, iIdx) => ({
            code: it.code,
            task: it.task,
            tool1: it.tool1 || undefined,
            tool2: it.tool2 || undefined,
            owner: it.owner || undefined,
            sortIndex: iIdx,
          })),
        })),
      };
      if (isNew) await createWorksheetTemplate(payload);
      else await updateWorksheetTemplate(template!.id, payload);
      onSaved();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Mentés sikertelen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Vissza
          </button>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{isNew ? 'Új munkalap-sablon' : 'Sablon szerkesztése'}</h3>
            {!isNew && <p className="text-xs text-gray-400">{template!.name}</p>}
          </div>
        </div>
        <button
          onClick={save} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Mentés
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Sablon neve *</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            placeholder="pl. Drón fotogrammetria" maxLength={200} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Szín</label>
          <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
            className="w-full h-9 border border-gray-200 rounded-lg" />
        </div>
        <div className="md:col-span-3">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Leírás (opcionális)</label>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            maxLength={2000} />
        </div>
      </div>

      {form.sections.map((sec, secIdx) => (
        <div key={secIdx} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-2 border-b border-gray-200">
            <input value={sec.code} onChange={e => updateSection(secIdx, { code: e.target.value })}
              className="border border-gray-200 rounded px-2 py-1 text-xs font-mono w-16 focus:outline-none focus:ring-2 focus:ring-brand-400"
              maxLength={8} placeholder="A" />
            <input value={sec.title} onChange={e => updateSection(secIdx, { title: e.target.value })}
              className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              maxLength={200} placeholder="Szekció címe (pl. Terep)" />
            <button onClick={() => moveSection(secIdx, -1)} disabled={secIdx === 0}
              className="text-gray-400 hover:text-gray-700 disabled:opacity-20 px-2 text-sm">▲</button>
            <button onClick={() => moveSection(secIdx, 1)} disabled={secIdx === form.sections.length - 1}
              className="text-gray-400 hover:text-gray-700 disabled:opacity-20 px-2 text-sm">▼</button>
            <button onClick={() => removeSection(secIdx)} className="text-red-400 hover:text-red-700 p-1"
              title="Szekció törlése"><Trash2 className="w-4 h-4" /></button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-20">Kód</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Feladat</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-32">Eszköz 1</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-32">Eszköz 2</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-40">Felelős</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 w-12">—</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sec.items.map((it, itIdx) => (
                <tr key={itIdx}>
                  <td className="px-3 py-1.5">
                    <input value={it.code} onChange={e => updateItem(secIdx, itIdx, { code: e.target.value })}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-400"
                      maxLength={16} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={it.task} onChange={e => updateItem(secIdx, itIdx, { task: e.target.value })}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={it.tool1 ?? ''} onChange={e => updateItem(secIdx, itIdx, { tool1: e.target.value })}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
                      maxLength={120} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={it.tool2 ?? ''} onChange={e => updateItem(secIdx, itIdx, { tool2: e.target.value })}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
                      maxLength={120} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={it.owner ?? ''} onChange={e => updateItem(secIdx, itIdx, { owner: e.target.value })}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
                      maxLength={200} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button onClick={() => removeItem(secIdx, itIdx)} className="text-red-400 hover:text-red-700 p-1"
                      title="Sor törlése"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={6} className="px-3 py-1.5">
                  <button onClick={() => addItem(secIdx)}
                    className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Új sor
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      <button onClick={addSection}
        className="flex items-center gap-1.5 px-3 py-2 border-2 border-dashed border-gray-300 text-gray-600 text-sm rounded-lg hover:border-brand-300 hover:text-brand-700 w-full justify-center">
        <Plus className="w-4 h-4" /> Új szekció
      </button>
    </div>
  );
}

/* ── DRÓN-IDŐJÁRÁS TAB ───────────────────────────────────── */
function WeatherDroneTab() {
  const { thresholds, mutate } = useWeatherThresholds();
  const [draft, setDraft] = useState({
    windSafeMs: 10,
    windCautionMs: 15,
    rainSafePct: 60,
    rainCautionPct: 80,
  });
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (thresholds) {
      setDraft({
        windSafeMs: thresholds.windSafeMs,
        windCautionMs: thresholds.windCautionMs,
        rainSafePct: thresholds.rainSafePct,
        rainCautionPct: thresholds.rainCautionPct,
      });
    }
  }, [thresholds]);

  async function save() {
    if (draft.windSafeMs >= draft.windCautionMs) {
      alert('A "biztonságos szél" értéknek kisebbnek kell lennie a "figyelem" küszöbnél.');
      return;
    }
    if (draft.rainSafePct >= draft.rainCautionPct) {
      alert('A "biztonságos csapadék" értéknek kisebbnek kell lennie a "figyelem" küszöbnél.');
      return;
    }
    setSaving(true);
    try {
      await updateWeatherThresholds(draft);
      await mutate();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Mentés sikertelen');
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!confirm('Visszaállítod az alapértékeket? A saját beállításaid elvesznek.')) return;
    setResetting(true);
    try {
      await resetWeatherThresholds();
      await mutate();
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 max-w-xl">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Drón-időjárás kockázat</h3>
        <p className="text-xs text-gray-500 mt-1">
          Az alábbi küszöbök szerint jelöli a Gantt-fejléc az aznapi időjárást a drón-task-ok
          szempontjából. Ha a max szél vagy a csapadék-eséllyel meghaladja a "Figyelem" értéket,
          piros (veszélyes); a biztonságos és figyelem között sárga; alatta zöld.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Szél biztonságos (m/s)</label>
          <input
            type="number" min={0} max={50} step={0.5}
            value={draft.windSafeMs}
            onChange={e => setDraft(d => ({ ...d, windSafeMs: parseFloat(e.target.value) || 0 }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <p className="text-[11px] text-gray-400 mt-1">Alapérték: 10 m/s — ez alatt zöld.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Szél figyelem (m/s)</label>
          <input
            type="number" min={0} max={50} step={0.5}
            value={draft.windCautionMs}
            onChange={e => setDraft(d => ({ ...d, windCautionMs: parseFloat(e.target.value) || 0 }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <p className="text-[11px] text-gray-400 mt-1">Alapérték: 15 m/s — efölött piros.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Csapadék biztonságos (%)</label>
          <input
            type="number" min={0} max={100} step={1}
            value={draft.rainSafePct}
            onChange={e => setDraft(d => ({ ...d, rainSafePct: parseInt(e.target.value, 10) || 0 }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <p className="text-[11px] text-gray-400 mt-1">Alapérték: 60% — ez alatt zöld.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Csapadék figyelem (%)</label>
          <input
            type="number" min={0} max={100} step={1}
            value={draft.rainCautionPct}
            onChange={e => setDraft(d => ({ ...d, rainCautionPct: parseInt(e.target.value, 10) || 0 }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <p className="text-[11px] text-gray-400 mt-1">Alapérték: 80% — efölött piros.</p>
        </div>
      </div>

      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-3">
        <strong>Megjegyzés:</strong> a zivatart (WMO 95–99) mindig pirosnak tekintjük — ez nem
        állítható, mert a drón-repülésnek határozott biztonsági korlátja.
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="text-xs text-gray-400">
          {thresholds?.isCustom ? 'Egyéni beállítás aktív' : 'Alapértékek aktívak'}
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            disabled={resetting || !thresholds?.isCustom}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            {resetting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Alapértékre
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Mentés
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── MAIN ADMIN PAGE ─────────────────────────────────────── */
export default function MeetingAdminPage() {
  // Back-link: ha a /meeting (vagy /rooms?view=gantt) felől érkezett a user,
  // az URL ?back=... param tartalmazza, hova térjen vissza. Default /meeting.
  const searchParams = useSearchParams();
  const backHref = searchParams?.get('back') ?? '/meeting';
  const [tab, setTab] = useState<'people' | 'equipment' | 'matrix' | 'chain' | 'tasktypes' | 'worksheets' | 'projecttemplates' | 'settings' | 'weather'>('people');
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function seedDemo() {
    if (!confirm('Létrehoz demo adatokat: 6-8 projekt, 7 eszköz, ~20 ütemezett task, ünnepnapok/szabadságok/határidők. A meglévő adatok megmaradnak. Folytatás?')) return;
    setSeeding(true);
    try {
      const res = await apiClient.post('/dashboard/seed-demo');
      const { projectsCreated, equipmentCreated, tasksCreated, annotationsCreated, usersUpdated } = res.data;
      alert(`Demo feltöltve:\n• ${projectsCreated} új projekt\n• ${equipmentCreated} új eszköz\n• ${tasksCreated} új task\n• ${annotationsCreated} új nap-jelölés\n• ${usersUpdated} user frissítve`);
      window.location.reload();
    } catch (err: any) {
      alert('Hiba: ' + (err?.response?.data?.message ?? err.message));
    } finally {
      setSeeding(false);
    }
  }

  async function clearDemo() {
    if (!confirm(
      'Töröljem az ÖSSZES demo adatot (csak a [DEMO] jelölésű projekteket / eszközöket / hozzájuk tartozó task-okat / annotációkat)?\n\n' +
      'Valódi felhasználói adat NEM törlődik.',
    )) return;
    setClearing(true);
    try {
      const res = await apiClient.delete('/dashboard/seed-demo');
      const { projects, equipment, tasks, annotations } = res.data;
      alert(`Demo törölve:\n• ${projects} projekt\n• ${equipment} eszköz\n• ${tasks} task\n• ${annotations} nap-jelölés`);
      window.location.reload();
    } catch (err: any) {
      alert('Hiba: ' + (err?.response?.data?.message ?? err.message));
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={backHref} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3 h-3" /> Vissza
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard törzsadatok</h1>
          <p className="text-sm text-gray-500 mt-1">
            Csapat típusok/színek, eszközök, szoftver–PC telepítési mátrix.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearDemo}
            disabled={clearing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 transition disabled:opacity-60"
            title="Eltávolítja az összes [DEMO] jelölésű seed-rekordot — valódi adat érintetlen"
          >
            {clearing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Demo adatok törlése
          </button>
          <button
            onClick={seedDemo}
            disabled={seeding}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-brand-200 bg-brand-50 text-brand-700 text-sm font-medium hover:bg-brand-100 transition disabled:opacity-60"
            title="Valós adattal tölti fel a Gantt-ot (projekt, eszköz, task, szabadság, határidő)"
          >
            {seeding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Demo adatok feltöltése
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { id: 'people', label: 'Csapat' },
          { id: 'equipment', label: 'Eszközök' },
          { id: 'matrix', label: 'Szoftver mátrix' },
          { id: 'chain', label: 'Sablon-lánc' },
          { id: 'tasktypes', label: 'Task-típusok' },
          { id: 'worksheets', label: 'Munkalap-sablonok' },
          { id: 'projecttemplates', label: 'Projektsablonok' },
          { id: 'weather', label: 'Drón-időjárás' },
          { id: 'settings', label: 'Beállítások' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition ${
              tab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'people' && <PeopleTab />}
      {tab === 'equipment' && <EquipmentTab />}
      {tab === 'matrix' && <SoftwarePcTab />}
      {tab === 'chain' && <TaskChainTab />}
      {tab === 'tasktypes' && <TaskTypesTab />}
      {tab === 'worksheets' && <WorksheetTemplatesTab />}
      {tab === 'projecttemplates' && <ProjectTemplatesTab />}
      {tab === 'weather' && <WeatherDroneTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}

/* ── TASK CHAIN TAB ────────────────────────────────────────── */

const CHAIN_TASK_TYPES: Array<{ value: string; label: string }> = [
  { value: 'terep',       label: 'Terep' },
  { value: 'iroda',       label: 'Iroda' },
  { value: 'feldolgozas', label: 'Feldolgozás' },
  { value: 'sales',       label: 'Sales' },
  { value: 'marketing',   label: 'Marketing' },
  { value: 'szamlazas',   label: 'Számlázás' },
  { value: 'gepido',      label: 'Gépidő' },
];

function emptyChainDraft() {
  return {
    fromKey: '',
    nextTitle: '',
    nextTaskType: 'terep',
    nextDuration: 1,
    offsetDays: 1,
    keepAssignee: false,
    notes: '',
    sortIndex: 0,
  };
}

function TaskChainTab() {
  const { templates, loading, mutate } = useTaskChainTemplates();
  const [editing, setEditing] = useState<TaskChainTemplate | null>(null);
  const [draft, setDraft] = useState(emptyChainDraft());
  const [saving, setSaving] = useState(false);

  function startEdit(t: TaskChainTemplate) {
    setEditing(t);
    setDraft({
      fromKey: t.fromKey,
      nextTitle: t.nextTitle,
      nextTaskType: t.nextTaskType,
      nextDuration: Number(t.nextDuration),
      offsetDays: t.offsetDays,
      keepAssignee: t.keepAssignee,
      notes: t.notes ?? '',
      sortIndex: t.sortIndex,
    });
  }

  function startCreate() {
    setEditing(null);
    setDraft(emptyChainDraft());
  }

  async function save() {
    if (!draft.fromKey.trim() || !draft.nextTitle.trim()) {
      alert('A forrás és a generált task neve egyaránt kötelező');
      return;
    }
    setSaving(true);
    try {
      await upsertTaskChainTemplate({ ...draft, id: editing?.id });
      await mutate();
      startCreate();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Mentés sikertelen');
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: TaskChainTemplate) {
    if (!confirm(`Törlöd a sablon-szabályt: "${t.fromKey}" → "${t.nextTitle}"?`)) return;
    await deleteTaskChainTemplate(t.id);
    await mutate();
    if (editing?.id === t.id) startCreate();
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 text-sm">
        Itt megadhatod, hogy egy elkészült task után <strong>milyen következő task generálódjon</strong>{' '}
        automatikusan, ha a vezérlőpulton a felhasználó a <em>+ Sablon-task</em> gombra kattint.
        A párosítás a feladat <strong>címe</strong> alapján történik (kis-/nagybetű érzéketlen).
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-200">
          <div className="col-span-3">Ha ez a task</div>
          <div className="col-span-1 text-center">→</div>
          <div className="col-span-3">Ezt hozza létre</div>
          <div className="col-span-2">Típus</div>
          <div className="col-span-1 text-right">Nap</div>
          <div className="col-span-1 text-right">Eltol.</div>
          <div className="col-span-1 text-right">…</div>
        </div>
        {loading && <div className="p-4 text-sm text-gray-400">Töltés…</div>}
        {!loading && templates.length === 0 && (
          <div className="p-6 text-sm text-gray-400 text-center">
            Még nincs sablon-szabály. Vegyél fel egyet alább.
          </div>
        )}
        {templates.map(t => (
          <div
            key={t.id}
            className={`grid grid-cols-12 gap-2 px-4 py-2.5 text-sm items-center border-b border-gray-100 hover:bg-gray-50 transition ${
              editing?.id === t.id ? 'bg-blue-50' : ''
            }`}
          >
            <div className="col-span-3 font-medium text-gray-900 truncate">{t.fromKey}</div>
            <div className="col-span-1 text-gray-400 text-center"><ArrowRight className="w-4 h-4 inline" /></div>
            <div className="col-span-3 text-gray-700 truncate">{t.nextTitle}</div>
            <div className="col-span-2 text-xs text-gray-500">{t.nextTaskType}</div>
            <div className="col-span-1 text-right text-gray-600">{t.nextDuration}</div>
            <div className="col-span-1 text-right text-gray-600">+{t.offsetDays}n</div>
            <div className="col-span-1 flex justify-end gap-1">
              <button onClick={() => startEdit(t)} className="text-xs text-gray-500 hover:text-blue-600 px-1" title="Szerkesztés">⧉</button>
              <button onClick={() => remove(t)} className="text-xs text-gray-400 hover:text-red-600 px-1" title="Törlés">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            {editing ? 'Szabály szerkesztése' : 'Új szabály'}
          </h3>
          {editing && (
            <button onClick={startCreate} className="text-xs text-gray-500 hover:text-gray-700">+ Új helyett</button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ha ez a task elkészül</label>
            <input
              value={draft.fromKey}
              onChange={e => setDraft(d => ({ ...d, fromKey: e.target.value }))}
              maxLength={200}
              placeholder="pl. Helyszíni felmérés"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">…ez jön létre</label>
            <input
              value={draft.nextTitle}
              onChange={e => setDraft(d => ({ ...d, nextTitle: e.target.value }))}
              maxLength={200}
              placeholder="pl. Drón felvétel"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Típus</label>
            <select
              value={draft.nextTaskType}
              onChange={e => setDraft(d => ({ ...d, nextTaskType: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {CHAIN_TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Hossz (nap)</label>
              <input
                type="number" step={0.5} min={0.25} max={365}
                value={draft.nextDuration}
                onChange={e => setDraft(d => ({ ...d, nextDuration: parseFloat(e.target.value) || 0.5 }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Hány nap múlva indul</label>
              <input
                type="number" min={0} max={365}
                value={draft.offsetDays}
                onChange={e => setDraft(d => ({ ...d, offsetDays: parseInt(e.target.value, 10) || 0 }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.keepAssignee}
            onChange={e => setDraft(d => ({ ...d, keepAssignee: e.target.checked }))}
            className="rounded text-brand-600 focus:ring-brand-500"
          />
          Az új task ugyanahhoz a személyhez kerüljön, mint az előző
        </label>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Belső megjegyzés (opcionális)</label>
          <textarea
            value={draft.notes}
            onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
            rows={2}
            maxLength={2000}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-60"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editing ? 'Mentés' : 'Hozzáadás'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── PROJEKTSABLONOK TAB ──────────────────────────────────── */
/**
 * Projekt-sablonok lista + import + új. A sablon teljes szerkesztése
 * (név / inputs / lépések / anchor + offset matek) külön oldalon történik:
 * /settings/project-templates/[id]/edit. Itt csak a listát + alapműveleteket
 * adjuk.
 *
 * A sablonok az új projektek létrehozási modaljában jelennek meg
 * ("Sablon alapján" mód) — egy gombnyomással az összes lépés (taskok /
 * munkalap / légtér / határidő / értesítések) eager-materializálódik a
 * Gantt-on.
 */
function ProjectTemplatesTab() {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const { templates, isLoading, mutate } = useProjectTemplates(showArchived);
  const [seeding, setSeeding] = useState(false);
  const [creating, setCreating] = useState(false);
  // Inline két-lépcsős törlés — egy ID-t tárolunk: az első kattintás
  // betölti a megerősítő állapotot, a második (3 mp-en belül) ténylegesen
  // törli. Sose blokkol window.confirm, ami pár böngészőben elnémítható.
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function seedGreenArea() {
    setSeeding(true);
    try {
      const t = await importGreenAreaTemplate();
      alert(`Sablon importálva: ${t.name}`);
      await mutate();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Importálás sikertelen');
    } finally {
      setSeeding(false);
    }
  }

  async function createNew() {
    setCreating(true);
    try {
      const t = await createProjectTemplate({
        name: 'Új sablon', description: '', inputs: [], steps: [],
      });
      router.push(`/settings/project-templates/${t.id}/edit`);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Sablon létrehozása sikertelen');
    } finally {
      setCreating(false);
    }
  }

  async function archive(id: string) {
    try { await archiveProjectTemplate(id); await mutate(); }
    catch { alert('Archiválás sikertelen'); }
  }
  async function unarchive(id: string) {
    try { await unarchiveProjectTemplate(id); await mutate(); }
    catch { alert('Visszaállítás sikertelen'); }
  }
  async function remove(id: string) {
    setDeleting(id);
    setPendingDelete(null);
    try {
      await deleteProjectTemplate(id);
      await mutate();
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message ?? err?.message ?? 'Ismeretlen hiba';
      alert(`Törlés sikertelen${status ? ` (${status})` : ''}: ${msg}`);
    } finally {
      setDeleting(null);
    }
  }
  function onDeleteClick(id: string) {
    if (pendingDelete === id) {
      // Második kattintás — törlés
      void remove(id);
    } else {
      // Első kattintás — pending állapot, 3 mp után önmagát visszaállítja
      setPendingDelete(id);
      setTimeout(() => setPendingDelete(prev => (prev === id ? null : prev)), 3000);
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h3 className="font-semibold text-gray-900 mb-2">Projektsablonok</h3>
      <p className="text-sm text-gray-500 mb-4">
        Új projekt létrehozásánál választható sablonok. A sablon lépéseiből (taskok / munkalap /
        légtér / határidő / értesítések) automatikusan generálódik a Gantt — a felhasználói
        anchor-dátum (pl. légtér kezdő) + lépés-közi offsetek alapján.
      </p>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <button
          onClick={createNew} disabled={creating}
          className="flex items-center gap-2 bg-brand-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Új sablon
        </button>
        <button
          onClick={seedGreenArea} disabled={seeding}
          className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          title="Beépített 9 lépéses minta importálása"
        >
          {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Zöldfelületi tanúsítvány — minta importálása
        </button>
        <button
          onClick={() => setShowArchived(v => !v)}
          className={`flex items-center gap-2 border px-3 py-2 rounded-lg text-sm font-medium transition ${
            showArchived ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Archive className="w-4 h-4" /> Archiváltak
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(2)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="border border-gray-100 rounded-lg p-8 text-center text-sm text-gray-400">
          Még nincs projektsablon. Importálj egy mintát vagy hozz létre újat.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map(t => (
            <div key={t.id} className="border border-gray-100 rounded-lg p-4 hover:border-brand-200 hover:shadow-sm transition">
              <div className="flex items-start justify-between gap-2 mb-2">
                <Link href={`/settings/project-templates/${t.id}/edit`} className="flex-1">
                  <h4 className="font-semibold text-gray-900 hover:text-brand-600 transition flex items-center gap-2">
                    {t.color && <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color }} />}
                    {t.name}
                  </h4>
                </Link>
                {t.isArchived && (
                  <span className="text-[10px] uppercase font-semibold tracking-wide text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Archív</span>
                )}
              </div>
              {t.description && <p className="text-sm text-gray-500 line-clamp-2 mb-2">{t.description}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                <span>{t.inputs.length} input</span>
                <span>·</span>
                <span>{t.steps.length} lépés</span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                <Link
                  href={`/settings/project-templates/${t.id}/edit`}
                  className="flex-1 text-center text-xs px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700"
                >
                  Szerkesztés
                </Link>
                {t.isArchived ? (
                  <button onClick={() => unarchive(t.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-gray-50" title="Visszaállít">
                    <ArchiveRestore className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={() => archive(t.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-yellow-600 hover:bg-gray-50" title="Archivál">
                    <Archive className="w-4 h-4" />
                  </button>
                )}
                {pendingDelete === t.id ? (
                  <button
                    onClick={() => onDeleteClick(t.id)}
                    disabled={deleting === t.id}
                    className="px-2 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                    title="Biztos? Kattints újra"
                  >
                    {deleting === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Biztos?
                  </button>
                ) : (
                  <button
                    onClick={() => onDeleteClick(t.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-50"
                    title="Törlés (kattints kétszer)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
