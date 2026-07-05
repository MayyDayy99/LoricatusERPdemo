'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Wrench, Users, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/lib/hooks/use-t';
import { toast } from 'sonner';

/* ── Types ──────────────────────────────────────────────────── */
type EquipmentStatus = 'available' | 'in_use' | 'maintenance' | 'retired';
type EquipmentCategory = 'drone' | 'laser_scanner' | 'gnss_receiver' | 'total_station' | 'camera' | 'other';

interface Equipment {
  id: string; name: string; category?: EquipmentCategory; serialNumber?: string;
  status: EquipmentStatus; dailyCost?: number; description?: string;
}

interface EquipmentBooking {
  id: string; startDate: string; endDate: string; notes?: string;
  equipment?: { name: string };
  project?: { name: string };
}

interface Subcontractor {
  id: string; name: string; contactName?: string; email?: string;
  phone?: string; specialty?: string; hourlyRate?: number; taxNumber?: string;
  isActive: boolean;
}

interface SubCost {
  id: string; description: string; amount: number; currency?: string;
  invoiceNumber?: string; isPaid: boolean;
  subcontractor?: { name: string };
  project?: { name: string };
}

interface Project { id: string; name: string; }
type TabKey = 'equipment' | 'subcontractors';

const STATUS_STYLES: Record<EquipmentStatus, string> = {
  available:   'bg-green-100 text-green-700',
  in_use:      'bg-blue-100 text-blue-700',
  maintenance: 'bg-yellow-100 text-yellow-700',
  retired:     'bg-gray-100 text-gray-500',
};

/* ── Create Equipment Modal ────────────────────────────────── */
function CreateEquipmentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const [form, setForm] = useState({ name: '', category: 'other', serialNumber: '', dailyCost: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post('/equipment', {
        name: form.name,
        category: form.category,
        serialNumber: form.serialNumber || undefined,
        dailyCost: form.dailyCost ? parseFloat(form.dailyCost) : undefined,
      });
      toast.success(t.common.saved);
      onSaved(); onClose();
    } catch (err: any) { toast.error(err?.response?.data?.message ?? 'Hiba'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{t.equipment.newTitle}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder={t.equipment.namePh} value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-3 gap-2">
            <select className="border rounded-lg px-3 py-2 text-sm"
              value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {(['drone', 'laser_scanner', 'gnss_receiver', 'total_station', 'camera', 'other'] as EquipmentCategory[])
                .map(c => <option key={c} value={c}>{t.equipment.categories[c]}</option>)}
            </select>
            <input className="border rounded-lg px-3 py-2 text-sm" placeholder={t.equipment.serialPh}
              value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} />
            <input type="number" min="0" className="border rounded-lg px-3 py-2 text-sm"
              placeholder={t.equipment.dailyCostPh} value={form.dailyCost}
              onChange={e => setForm(f => ({ ...f, dailyCost: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">{t.common.cancel}</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {loading ? t.common.creating : t.common.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Book Equipment Modal ──────────────────────────────────── */
function BookEquipmentModal({ equipment, projects, onClose, onSaved }: {
  equipment: Equipment; projects: Project[]; onClose: () => void; onSaved: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState({ projectId: '', startDate: '', endDate: '', notes: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post('/equipment/bookings', {
        equipmentId: equipment.id,
        projectId: form.projectId || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        notes: form.notes || undefined,
      });
      toast.success(t.common.saved);
      onSaved(); onClose();
    } catch (err: any) { toast.error(err?.response?.data?.message ?? 'Hiba'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-4">{t.equipment.bookTitle}: {equipment.name}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <select className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}>
            <option value="">{t.common.selectProject}</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input required type="date" className="border rounded-lg px-3 py-2 text-sm"
              value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            <input required type="date" className="border rounded-lg px-3 py-2 text-sm"
              value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
          </div>
          <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder={t.equipment.bookNotesPh} value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">{t.common.cancel}</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {loading ? t.common.creating : t.common.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Create Subcontractor Modal ────────────────────────────── */
function CreateSubModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const [form, setForm] = useState({
    name: '', contactName: '', email: '', phone: '', specialty: '', hourlyRate: '', taxNumber: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post('/subcontractors', {
        name: form.name,
        contactName: form.contactName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        specialty: form.specialty || undefined,
        hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : undefined,
        taxNumber: form.taxNumber || undefined,
      });
      toast.success(t.common.saved);
      onSaved(); onClose();
    } catch (err: any) { toast.error(err?.response?.data?.message ?? 'Hiba'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{t.subcontractors.newTitle}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder={t.subcontractors.namePh} value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <input className="border rounded-lg px-3 py-2 text-sm" placeholder={t.subcontractors.contactPh}
              value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
            <input className="border rounded-lg px-3 py-2 text-sm" placeholder={t.subcontractors.specialtyPh}
              value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="email" className="border rounded-lg px-3 py-2 text-sm" placeholder={t.subcontractors.emailPh}
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <input className="border rounded-lg px-3 py-2 text-sm" placeholder={t.subcontractors.phonePh}
              value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min="0" className="border rounded-lg px-3 py-2 text-sm"
              placeholder={t.subcontractors.hourlyRatePh} value={form.hourlyRate}
              onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))} />
            <input className="border rounded-lg px-3 py-2 text-sm" placeholder={t.subcontractors.taxNumberPh}
              value={form.taxNumber} onChange={e => setForm(f => ({ ...f, taxNumber: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">{t.common.cancel}</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {loading ? t.common.creating : t.common.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══ MAIN PAGE ═══ */
export default function ResourcesPage() {
  const t = useT();
  const [tab, setTab] = useState<TabKey>('equipment');
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [bookings, setBookings] = useState<EquipmentBooking[]>([]);
  const [subs, setSubs] = useState<Subcontractor[]>([]);
  const [costs, setCosts] = useState<SubCost[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  /* Modals */
  const [showCreateEquip, setShowCreateEquip] = useState(false);
  const [bookEquip, setBookEquip] = useState<Equipment | null>(null);
  const [showCreateSub, setShowCreateSub] = useState(false);

  const fetchAll = async () => {
    try {
      const [eRes, bRes, sRes, cRes, pRes] = await Promise.all([
        apiClient.get('/equipment'),
        apiClient.get('/equipment/bookings/list').catch(() => ({ data: [] })),
        apiClient.get('/subcontractors'),
        apiClient.get('/subcontractors/costs/list').catch(() => ({ data: [] })),
        apiClient.get('/projects'),
      ]);
      setEquipmentList(eRes.data);
      setBookings(bRes.data);
      setSubs(sRes.data);
      setCosts(cRes.data);
      setProjects(pRes.data);
    } catch { /* */ } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchAll(); }, []);

  const deleteEquipment = async (id: string) => {
    try { await apiClient.delete(`/equipment/${id}`); toast.success(t.common.saved); fetchAll(); }
    catch (err: any) { toast.error(err?.response?.data?.message ?? 'Hiba'); }
  };
  const deleteSub = async (id: string) => {
    try { await apiClient.delete(`/subcontractors/${id}`); toast.success(t.common.saved); fetchAll(); }
    catch (err: any) { toast.error(err?.response?.data?.message ?? 'Hiba'); }
  };
  const markPaid = async (costId: string) => {
    try { await apiClient.post(`/subcontractors/costs/${costId}/mark-paid`); toast.success(t.common.saved); fetchAll(); }
    catch (err: any) { toast.error(err?.response?.data?.message ?? 'Hiba'); }
  };

  const TABS: { key: TabKey; label: string; count: number; icon: typeof Wrench }[] = [
    { key: 'equipment',      label: t.resources.tabEquipment,      count: equipmentList.length, icon: Wrench },
    { key: 'subcontractors', label: t.resources.tabSubcontractors, count: subs.length,          icon: Users },
  ];

  if (loading) return <div className="p-8 text-gray-400">{t.common.loading}</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t.resources.title}</h1>
        {tab === 'equipment' && (
          <button onClick={() => setShowCreateEquip(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700">
            <Plus className="w-4 h-4" /> {t.equipment.newBtn}
          </button>
        )}
        {tab === 'subcontractors' && (
          <button onClick={() => setShowCreateSub(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700">
            <Plus className="w-4 h-4" /> {t.subcontractors.newBtn}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map(({ key, label, count, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              tab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <Icon className="w-4 h-4" /> {label}
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-100">{count}</span>
          </button>
        ))}
      </div>

      {/* ── Equipment Tab ───────────────────────────────────── */}
      {tab === 'equipment' && (
        <>
          <div data-tour="resources-equip" className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.equipment.colName}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.equipment.colCategory}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.equipment.colSerial}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.equipment.colStatus}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{t.equipment.colCost}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{t.equipment.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {equipmentList.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">{t.equipment.empty}</td></tr>
                )}
                {equipmentList.map(eq => (
                  <tr key={eq.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{eq.name}</td>
                    <td className="px-4 py-3 text-gray-600">{eq.category ? t.equipment.categories[eq.category] : '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{eq.serialNumber ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[eq.status]}`}>
                        {t.equipment.statuses[eq.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {eq.dailyCost ? new Intl.NumberFormat('hu-HU').format(eq.dailyCost) + ' HUF' : '—'}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      {eq.status === 'available' && (
                        <button onClick={() => setBookEquip(eq)}
                          className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded">
                          <Calendar className="w-3 h-3 inline mr-0.5" />{t.equipment.bookBtn}
                        </button>
                      )}
                      <button onClick={() => deleteEquipment(eq.id)}
                        className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bookings section */}
          {bookings.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.equipment.bookings}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {bookings.map(b => (
                  <div key={b.id} className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="text-sm font-medium text-gray-900">{b.equipment?.name ?? '—'}</div>
                    <div className="text-xs text-gray-500 mt-1">{b.project?.name ?? '—'}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(b.startDate).toLocaleDateString('hu-HU')} → {new Date(b.endDate).toLocaleDateString('hu-HU')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Subcontractors Tab ──────────────────────────────── */}
      {tab === 'subcontractors' && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.subcontractors.colName}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.subcontractors.colSpecialty}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{t.subcontractors.colContact}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{t.subcontractors.colRate}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{t.subcontractors.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subs.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">{t.subcontractors.empty}</td></tr>
                )}
                {subs.map(sub => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{sub.name}</td>
                    <td className="px-4 py-3 text-gray-600">{sub.specialty ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {sub.contactName && <div>{sub.contactName}</div>}
                      {sub.email && <div>{sub.email}</div>}
                      {sub.phone && <div>{sub.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {sub.hourlyRate ? new Intl.NumberFormat('hu-HU').format(sub.hourlyRate) + ' HUF/h' : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteSub(sub.id)}
                        className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Costs section */}
          {costs.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.subcontractors.costs}</h3>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{t.subcontractors.colName}</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{t.subcontractors.costDescPh}</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">{t.subcontractors.costAmountPh}</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500">{t.subcontractors.markPaid}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {costs.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-600">{c.subcontractor?.name ?? '—'}</td>
                        <td className="px-4 py-2 text-gray-500">{c.description}</td>
                        <td className="px-4 py-2 text-right font-medium">
                          {new Intl.NumberFormat('hu-HU').format(c.amount)} {c.currency ?? 'HUF'}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {c.isPaid ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                          ) : (
                            <button onClick={() => markPaid(c.id)}
                              className="text-xs px-2 py-1 text-green-600 hover:bg-green-50 rounded">
                              {t.subcontractors.markPaid}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showCreateEquip && <CreateEquipmentModal onClose={() => setShowCreateEquip(false)} onSaved={fetchAll} />}
      {bookEquip && <BookEquipmentModal equipment={bookEquip} projects={projects} onClose={() => setBookEquip(null)} onSaved={fetchAll} />}
      {showCreateSub && <CreateSubModal onClose={() => setShowCreateSub(false)} onSaved={fetchAll} />}
    </div>
  );
}
