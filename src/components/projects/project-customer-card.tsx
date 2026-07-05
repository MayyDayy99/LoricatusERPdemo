'use client';

import { useState } from 'react';
import { UserRound, Check, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomers } from '@/lib/hooks/use-crm';
import { updateProject } from '@/lib/hooks/use-projects';

/**
 * Megrendelő-kártya a /projects/[id] "Alap adatok" fülén. A projekt-árajánlat
 * indításához kötelező a megrendelő — itt lehet hozzárendelni / lecserélni.
 */
export function ProjectCustomerCard({
  projectId,
  customerId,
  onChanged,
}: {
  projectId: string;
  customerId?: string;
  onChanged: () => void;
}) {
  const { customers } = useCustomers();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(customerId ?? '');
  const [saving, setSaving] = useState(false);

  const current = customers.find(c => c.id === customerId);
  const displayName = (c: { company?: string; firstName: string; lastName: string }) =>
    c.company || `${c.lastName} ${c.firstName}`.trim();

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await updateProject(projectId, { customerId: selected });
      toast.success('Megrendelő mentve');
      setEditing(false);
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Mentés sikertelen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <UserRound className="w-3.5 h-3.5" /> Megrendelő
      </h3>
      {editing ? (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            disabled={saving}
            className="flex-1 min-w-[180px] border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="">— válassz megrendelőt —</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{displayName(c)}</option>
            ))}
          </select>
          <button type="button" onClick={save} disabled={!selected || saving}
            className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40 inline-flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> {saving ? 'Mentés…' : 'Mentés'}
          </button>
          <button type="button" onClick={() => { setEditing(false); setSelected(customerId ?? ''); }}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-50">
            Mégse
          </button>
        </div>
      ) : current ? (
        <div className="text-sm text-gray-700">
          <div className="font-medium text-gray-900">{displayName(current)}</div>
          {current.company && <div className="text-xs text-gray-500">{current.lastName} {current.firstName}</div>}
          {current.email && <div className="text-xs text-gray-500">✉ {current.email}</div>}
          {current.phone && <div className="text-xs text-gray-500">☎ {current.phone}</div>}
          <button type="button" onClick={() => setEditing(true)}
            className="mt-2 text-xs text-gray-500 hover:text-brand-700 inline-flex items-center gap-1">
            <Pencil className="w-3 h-3" /> Megrendelő váltása
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-400 italic mb-2">Nincs hozzárendelt megrendelő.</p>
          <button type="button" onClick={() => setEditing(true)}
            className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700">
            Megrendelő hozzárendelése
          </button>
        </div>
      )}
    </div>
  );
}
