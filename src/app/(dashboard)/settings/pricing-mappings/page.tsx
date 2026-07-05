'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowLeft, Tags, Save } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useCurrentUser } from '@/lib/hooks/use-users';
import { useTaskTypes, type TaskType } from '@/lib/hooks/use-task-types';

interface MappingRow {
  pricingItemId: string;
  itemName: string;
  taskType: string | null;
  roleKind: string | null;
  defaultEquipmentIds: string[] | null;
  sortIndex: number | null;
}

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

export default function PricingMappingsPage() {
  const { currentUser } = useCurrentUser();
  const role = (currentUser as any)?.role;
  const isAdmin = role === 'admin' || role === 'ADMIN' || role === 'ceo' || role === 'CEO';

  const { data: rows, mutate } = useSWR<MappingRow[]>('/pricing/mappings', fetcher);
  const { taskTypes } = useTaskTypes();
  const [savingId, setSavingId] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold text-gray-900">Pricing-mappings</h1>
        <p className="mt-3 text-sm text-gray-500">Ez a felület csak admin / CEO szerepkörrel érhető el.</p>
      </div>
    );
  }

  async function saveRow(row: MappingRow, patch: Partial<MappingRow>) {
    setSavingId(row.pricingItemId);
    try {
      const next = { ...row, ...patch };
      await apiClient.patch(`/pricing/mappings/${row.pricingItemId}`, {
        taskType: next.taskType ?? 'iroda',
        roleKind: next.roleKind ?? 'irodai',
        defaultEquipmentIds: next.defaultEquipmentIds ?? [],
        sortIndex: next.sortIndex ?? 0,
      });
      toast.success('Mappelés mentve');
      void mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Mentés sikertelen');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <Link href="/settings" className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3 h-3" /> Vissza a beállításokhoz
        </Link>
        <div className="flex items-center gap-2">
          <Tags className="w-5 h-5 text-brand-600" />
          <h1 className="text-xl font-semibold text-gray-900">Árazó-tétel → Task-típus mappelés</h1>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          A quote-→-projekt importnál ezt a mappelést használjuk: minden Y (saját) tételhez
          létrejön egy draft task a megfelelő task-típussal. Ha egy tételhez nincs mappelve
          task-típus, az "iroda" lesz a default.
        </p>
      </header>

      <section className="bg-white border border-gray-100 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="text-left p-3 font-medium">Árazó-tétel</th>
              <th className="text-left p-3 font-medium">Task-típus</th>
              <th className="text-left p-3 font-medium">Szerepkör</th>
              <th className="text-right p-3 font-medium w-24">Mentés</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(rows ?? []).length === 0 && (
              <tr><td colSpan={4} className="text-center p-8 text-gray-400">Nincs árazó-tétel.</td></tr>
            )}
            {(rows ?? []).map((row) => (
              <MappingRowEditor
                key={row.pricingItemId}
                row={row}
                taskTypes={taskTypes ?? []}
                onSave={(patch) => saveRow(row, patch)}
                saving={savingId === row.pricingItemId}
              />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function MappingRowEditor({
  row, taskTypes, onSave, saving,
}: {
  row: MappingRow;
  taskTypes: TaskType[];
  onSave: (patch: Partial<MappingRow>) => void;
  saving: boolean;
}) {
  const [taskType, setTaskType] = useState(row.taskType ?? 'iroda');
  const [roleKind, setRoleKind] = useState(row.roleKind ?? 'irodai');
  const dirty = taskType !== (row.taskType ?? 'iroda') || roleKind !== (row.roleKind ?? 'irodai');
  return (
    <tr className="hover:bg-gray-50">
      <td className="p-3 font-medium text-gray-900">{row.itemName}</td>
      <td className="p-3">
        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1"
        >
          {taskTypes.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
        </select>
      </td>
      <td className="p-3">
        <select
          value={roleKind}
          onChange={(e) => setRoleKind(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1"
        >
          <option value="operativ">Operatív</option>
          <option value="irodai">Irodai</option>
        </select>
      </td>
      <td className="p-3 text-right">
        <button
          disabled={!dirty || saving}
          onClick={() => onSave({ taskType, roleKind })}
          className="text-xs px-3 py-1 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-30"
        >
          <Save className="w-3 h-3 inline" /> {saving ? '…' : ''}
        </button>
      </td>
    </tr>
  );
}
