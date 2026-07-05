'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, FileText, Archive, ArchiveRestore, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import {
  useProjectTemplates,
  createProjectTemplate,
  archiveProjectTemplate,
  unarchiveProjectTemplate,
  deleteProjectTemplate,
  importGreenAreaTemplate,
} from '@/lib/hooks/use-project-templates';

/**
 * Projektsablonok listája — innen lehet importálni a beépített „Zöldfelületi
 * tanúsítvány" sablont, új sablont létrehozni, és a meglévőket szerkeszteni.
 */
export default function ProjectTemplatesPage() {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const { templates, isLoading, mutate } = useProjectTemplates(showArchived);
  const [seeding, setSeeding] = useState(false);
  const [creating, setCreating] = useState(false);

  async function seedGreenArea() {
    setSeeding(true);
    try {
      const t = await importGreenAreaTemplate();
      toast.success(`Sablon importálva: ${t.name}`);
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Importálás sikertelen');
    } finally {
      setSeeding(false);
    }
  }

  async function createNew() {
    setCreating(true);
    try {
      const t = await createProjectTemplate({
        name: 'Új sablon',
        description: '',
        inputs: [],
        steps: [],
      });
      router.push(`/settings/project-templates/${t.id}/edit`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Sablon létrehozása sikertelen');
    } finally {
      setCreating(false);
    }
  }

  async function archive(id: string) {
    try { await archiveProjectTemplate(id); await mutate(); }
    catch { toast.error('Archiválás sikertelen'); }
  }
  async function unarchive(id: string) {
    try { await unarchiveProjectTemplate(id); await mutate(); }
    catch { toast.error('Visszaállítás sikertelen'); }
  }
  async function remove(id: string, name: string) {
    if (!window.confirm(`Biztosan törlöd a "${name}" sablont?`)) return;
    try { await deleteProjectTemplate(id); await mutate(); }
    catch { toast.error('Törlés sikertelen'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projektsablonok</h1>
          <p className="text-gray-500 mt-1">
            Új projekt létrehozásánál választható sablonok — alaptaskok, munkalap, határidő, értesítések automatikusan generálódnak.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(v => !v)}
            className={clsx(
              'flex items-center gap-2 border px-3 py-2.5 rounded-lg text-sm font-medium transition',
              showArchived
                ? 'border-brand-200 bg-brand-50 text-brand-700'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50',
            )}
          >
            <Archive className="w-4 h-4" /> Archiváltak
          </button>
          <button
            onClick={seedGreenArea}
            disabled={seeding}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            title="Beépített Zöldfelületi tanúsítvány sablon importálása"
          >
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Zöldfelületi tanúsítvány
          </button>
          <button
            onClick={createNew}
            disabled={creating}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Új sablon
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-10 text-center">
          <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500 mb-4">Még nincs sablon. Kezdj az alábbi gombokkal.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md hover:border-brand-200 transition">
              <div className="flex items-start justify-between gap-2 mb-2">
                <Link href={`/settings/project-templates/${t.id}/edit`} className="flex-1">
                  <h3 className="font-semibold text-gray-900 hover:text-brand-600 transition flex items-center gap-2">
                    {t.color && <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color }} />}
                    {t.name}
                  </h3>
                </Link>
                {t.isArchived && (
                  <span className="text-[10px] uppercase font-semibold tracking-wide text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Archív</span>
                )}
              </div>
              {t.description && <p className="text-sm text-gray-500 line-clamp-2 mb-3">{t.description}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{t.inputs.length} input</span>
                <span>·</span>
                <span>{t.steps.length} lépés</span>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                <Link
                  href={`/settings/project-templates/${t.id}/edit`}
                  className="flex-1 text-center text-xs px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700"
                >
                  Szerkesztés
                </Link>
                {t.isArchived ? (
                  <button onClick={() => unarchive(t.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-gray-50" title="Visszaállít">
                    <ArchiveRestore className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={() => archive(t.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-yellow-600 hover:bg-gray-50" title="Archivál">
                    <Archive className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => remove(t.id, t.name)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-50" title="Törlés">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
