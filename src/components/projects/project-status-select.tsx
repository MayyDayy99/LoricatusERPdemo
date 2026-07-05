'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { updateProject, type Project, type ProjectStatus } from '@/lib/hooks/use-projects';

/**
 * Kompakt státusz-választó — színezett badge-ként jelenik meg, kattintásra
 * legördül. A projekt `statusId`-ját menti azonnal. Link-en belül is használható
 * (a kattintást nem engedi felbubborékolni a szülő `<Link>`-hez).
 */
export function ProjectStatusSelect({
  project, statuses, onChanged,
}: {
  project: Project;
  statuses: ProjectStatus[];
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState(project.statusId ?? '');
  const current = statuses.find(s => s.id === value);

  async function change(next: string) {
    setValue(next);
    setBusy(true);
    try {
      await updateProject(project.id, { statusId: next || null });
      onChanged?.();
    } catch (err: any) {
      setValue(project.statusId ?? '');
      toast.error(err?.response?.data?.message ?? 'Státusz mentése sikertelen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      value={value}
      disabled={busy || statuses.length === 0}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => { e.stopPropagation(); change(e.target.value); }}
      className="text-xs rounded-full font-medium border-0 focus:outline-none focus:ring-2 focus:ring-brand-400 cursor-pointer disabled:opacity-60 px-2.5 py-1 max-w-[180px]"
      style={{
        background: current ? current.color + '33' : '#f3f4f6',
        color: current ? '#1f2937' : '#9ca3af',
      }}
      title={statuses.length === 0 ? 'Előbb hozz létre státuszt a "Státuszok" gombbal' : 'Projekt-státusz'}
    >
      <option value="">— nincs státusz —</option>
      {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
}
