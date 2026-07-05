'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { generateTasksFromWorkOrder } from '@/lib/hooks/use-project-workflow';

interface Props {
  workOrderId: string;
  projectId: string | null;
  quoteId: string | null;
  existingTaskCount: number;
  onClose: () => void;
  onDone: (result: { createdCount: number; skippedCount: number; projectId: string }) => void;
}

export function GenerateTasksModal({
  workOrderId, projectId, quoteId, existingTaskCount,
  onClose, onDone,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [includeSubcontractor, setIncludeSubcontractor] = useState(false);
  const [overrideProjectId, setOverrideProjectId] = useState(projectId ?? '');
  const [saving, setSaving] = useState(false);

  const projectIdRequired = !projectId;

  async function handleSubmit() {
    const effectiveProjectId = projectId ?? overrideProjectId.trim();
    if (!effectiveProjectId) {
      toast.error('Projekt-ID kötelező — a munkalapon nincs beállítva.');
      return;
    }
    setSaving(true);
    try {
      const result = await generateTasksFromWorkOrder(workOrderId, {
        projectId: projectId ? undefined : effectiveProjectId,
        startDate,
        includeSubcontractor,
      });
      toast.success(
        `Létrehozva: ${result.createdCount}, kihagyva: ${result.skippedCount}` +
        (result.skippedCount > 0 ? ' (már léteztek)' : ''),
      );
      onDone(result);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Sikertelen task-generálás'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white', borderRadius: 8, padding: 24,
          maxWidth: 480, width: '90%', boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ margin: 0, marginBottom: 12, fontSize: 18, fontWeight: 600 }}>
          {existingTaskCount > 0 ? 'Újragenerálás' : 'Task-ok generálása'}
        </h2>
        {existingTaskCount > 0 && (
          <div style={{
            padding: 8, background: '#eff6ff', borderRadius: 6, marginBottom: 12,
            fontSize: 12, color: '#1e40af',
          }}>
            Már {existingTaskCount} task létezik ebből a munkalapból — csak a hiányzókat
            generáljuk újra (idempotens, a meglévőket nem érinti).
          </div>
        )}

        {projectIdRequired && (
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Projekt-ID (a munkalapon nincs beállítva)
            </span>
            <input
              type="text"
              value={overrideProjectId}
              onChange={e => setOverrideProjectId(e.target.value)}
              placeholder="uuid"
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontFamily: 'monospace' }}
            />
          </label>
        )}

        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Mettől induljanak a task-ok?
          </span>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
          />
        </label>

        {quoteId && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
            padding: 8, background: '#f9fafb', borderRadius: 6,
          }}>
            <input
              type="checkbox"
              checked={includeSubcontractor}
              onChange={e => setIncludeSubcontractor(e.target.checked)}
            />
            <span style={{ fontSize: 12 }}>
              Alvállalkozói tételek is — alapból csak a saját (Y) tételekből generálunk.
            </span>
          </label>
        )}

        <div style={{
          padding: 8, background: '#fef3c7', borderRadius: 6, marginBottom: 16,
          fontSize: 11, color: '#92400e',
        }}>
          Akkor jelennek meg a megfelelő task-típusok (operatív / iroda / drón stb.), ha
          minden tétel rendelkezik <a
            href="/settings/pricing-mappings"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#92400e', textDecoration: 'underline' }}
          >
            pricing-mapping-gel
          </a>. Mapping nélküli tételek alapból „iroda" típust kapnak.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button" onClick={onClose} disabled={saving}
            style={{ padding: '6px 16px', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer' }}
          >
            Mégse
          </button>
          <button
            type="button" onClick={handleSubmit} disabled={saving}
            style={{
              padding: '6px 16px', border: 'none', borderRadius: 4,
              background: '#2563eb', color: 'white', fontWeight: 600,
              cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Generálás…' : (existingTaskCount > 0 ? 'Hiányzók generálása' : 'Task-ok generálása')}
          </button>
        </div>
      </div>
    </div>
  );
}
