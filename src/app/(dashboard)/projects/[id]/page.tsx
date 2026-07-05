'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Pencil, MapPin, Calendar, Tag, X, Check,
  FileText, Upload, ClipboardList, FileSignature, Receipt, Activity,
  Eye, Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import useSWR from 'swr';
import { useProject, updateProject } from '@/lib/hooks/use-projects';
import { useDocuments } from '@/lib/hooks/use-documents';
import { useUploads } from '@/lib/hooks/use-uploads';
import { apiClient } from '@/lib/api-client';
import { ProjectQuoteTab } from '@/components/projects/project-quote-tab';
import { ProjectCustomerCard } from '@/components/projects/project-customer-card';

const STATE_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  archived: 'bg-orange-100 text-orange-700',
};

const TRANSITIONS: Record<string, { label: string; transition: string; danger?: boolean }[]> = {
  draft:     [{ label: 'Activate',  transition: 'activate' }],
  active:    [{ label: 'Complete',  transition: 'complete' },
              { label: 'Archive',   transition: 'archive', danger: true }],
  completed: [{ label: 'Archive',   transition: 'archive', danger: true }],
  archived:  [],
};

type Tab = 'info' | 'documents' | 'uploads' | 'quote' | 'work-orders' | 'contracts' | 'invoices' | 'activities';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'info',        label: 'Alap adatok',   icon: Tag },
  { id: 'documents',   label: 'Dokumentumok',  icon: FileText },
  { id: 'uploads',     label: 'Feltöltések',   icon: Upload },
  { id: 'quote',       label: 'Árajánlat',     icon: Receipt },
  { id: 'work-orders', label: 'Munkalapok',    icon: ClipboardList },
  { id: 'contracts',   label: 'Szerződések',   icon: FileSignature },
  { id: 'invoices',    label: 'Számlák',        icon: Receipt },
  { id: 'activities',  label: 'Tevékenységek', icon: Activity },
];

function fetcher(url: string) {
  return apiClient.get(url).then((r) => r.data);
}

/**
 * Egy munkalap-sor a "Munkalapok" fülön. A sorra kattintva megnyílik a
 * részletező oldal; az "Előnézet" gomb legenerálja a PDF-et (ha még nincs),
 * majd új ablakban megnyitja — így az árajánlatból exportált munkalap
 * azonnal megnézhető.
 */
function WorkOrderRow({ wo }: { wo: any }) {
  const [busy, setBusy] = useState(false);

  async function handlePreview() {
    setBusy(true);
    try {
      if (!wo.generatedStorageKey) {
        await apiClient.post(`/work-orders/${wo.id}/generate-pdf`);
        toast.success('Munkalap-PDF generálása elindult…');
      }
      // A generálás a queue-ban fut — próbálkozunk a letöltési linkkel pár mp-ig
      let url: string | null = null;
      for (let attempt = 0; attempt < 8 && !url; attempt++) {
        try {
          const { data } = await apiClient.get<{ url: string }>(`/work-orders/${wo.id}/pdf`);
          url = data.url;
        } catch {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
      if (url) window.open(url, '_blank');
      else toast.error('A PDF még nem készült el — próbáld újra pár másodperc múlva.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Előnézet sikertelen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50 transition">
      <td className="px-4 py-3 font-medium text-gray-900">
        <Link href={`/work-orders/${wo.id}`} className="hover:text-brand-700 hover:underline">
          {wo.workOrderNumber}
        </Link>
      </td>
      <td className="px-4 py-3 text-gray-500">{wo.location}</td>
      <td className="px-4 py-3">
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{wo.state}</span>
      </td>
      <td className="px-4 py-3 text-gray-400">
        {wo.deadline ? new Date(wo.deadline).toLocaleDateString('hu-HU') : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={handlePreview}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
          Előnézet
        </button>
      </td>
    </tr>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { project, isLoading, error, mutate } = useProject(id ?? null);
  const [activeTab, setActiveTab] = useState<Tab>('info');

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', startDate: '', endDate: '', tags: '' });

  const { documents } = useDocuments(activeTab === 'documents' ? (id ?? null) : null);
  const { uploads } = useUploads(activeTab === 'uploads' ? (id ?? null) : null);
  const { data: workOrders } = useSWR(
    activeTab === 'work-orders' && id ? `/work-orders?projectId=${id}&take=100` : null,
    fetcher,
  );
  const { data: contracts } = useSWR(
    activeTab === 'contracts' && id ? `/contracts/project/${id}` : null,
    fetcher,
  );
  const { data: invoices } = useSWR(
    activeTab === 'invoices' && id ? `/invoices?projectId=${id}&take=100` : null,
    fetcher,
  );
  const { data: activities } = useSWR(
    activeTab === 'activities' && id ? `/activities/project/${id}` : null,
    fetcher,
  );

  const startEdit = () => {
    if (!project) return;
    setForm({
      name: project.name,
      description: project.description ?? '',
      startDate: project.startDate ? project.startDate.slice(0, 10) : '',
      endDate: project.endDate ? project.endDate.slice(0, 10) : '',
      tags: (project.tags ?? []).join(', '),
    });
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const handleSave = async () => {
    if (!project) return;
    setSaving(true);
    try {
      await updateProject(project.id, {
        name: form.name,
        description: form.description || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      });
      await mutate();
      setEditing(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(
        Array.isArray(msg) ? msg.join(', ')
        : (msg ?? `Mentés sikertelen: ${err?.message ?? 'ismeretlen hiba'}`),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async (transition: string) => {
    if (!project) return;
    setTransitioning(true);
    try {
      await apiClient.patch(`/projects/${project.id}/transition`, { transition });
      await mutate();
    } catch {
      toast.error('Állapotváltás sikertelen — kérjük próbálja újra');
    } finally {
      setTransitioning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-12 w-96 bg-gray-100 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-4 text-center py-20">
        <p className="text-gray-500">Project not found.</p>
        <Link href="/projects" className="text-brand-600 hover:underline text-sm">
          Back to Projects
        </Link>
      </div>
    );
  }

  const transitions = TRANSITIONS[project.state] ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/projects" className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{project.name}</h1>
            <span className={clsx('text-xs px-2.5 py-1 rounded-full font-medium capitalize shrink-0', STATE_COLORS[project.state] ?? 'bg-gray-100 text-gray-600')}>
              {project.state}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            Created {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </div>
        {!editing && activeTab === 'info' && (
          <button
            onClick={startEdit}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex gap-1 -mb-px min-w-max">
          {TABS.map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap',
                activeTab === tabId
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'info' && (
        <>
          {editing && (
            <div className="bg-white border border-brand-200 rounded-xl p-5 space-y-4">
              <h2 className="font-semibold text-gray-900">Edit Project</h2>
              <div className="space-y-3">
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Project name *"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  placeholder="Description"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                    <input
                      type="date"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      value={form.startDate}
                      onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End Date</label>
                    <input
                      type="date"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      value={form.endDate}
                      onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tags (comma-separated)</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="e.g. residential, phase-1"
                    value={form.tags}
                    onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button onClick={cancelEdit} className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition"
                >
                  <Check className="w-4 h-4" />
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Description</h3>
              <p className="text-sm text-gray-700">{project.description || <span className="text-gray-400 italic">No description</span>}</p>
            </div>

            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Location
              </h3>
              {project.location ? (
                <div className="text-sm text-gray-700 space-y-0.5">
                  {project.location.address && <p>{project.location.address}</p>}
                  <p>{project.location.city}{project.location.country ? `, ${project.location.country}` : ''}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No location set</p>
              )}
            </div>

            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Dates
              </h3>
              <div className="text-sm text-gray-700 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Start</span>
                  <span>{project.startDate ? new Date(project.startDate).toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">End</span>
                  <span>{project.endDate ? new Date(project.endDate).toLocaleDateString() : '—'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Tags
              </h3>
              {project.tags && project.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2.5 py-1 bg-brand-50 text-brand-700 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No tags</p>
              )}
            </div>

            {id && (
              <ProjectCustomerCard
                projectId={id}
                customerId={project.customerId}
                onChanged={() => mutate()}
              />
            )}
          </div>

          {transitions.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Actions</h3>
              <div className="flex flex-wrap gap-2">
                {transitions.map(({ label, transition, danger }) => (
                  <button
                    key={transition}
                    onClick={() => handleTransition(transition)}
                    disabled={transitioning}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50',
                      danger
                        ? 'border border-red-200 text-red-600 hover:bg-red-50'
                        : 'bg-brand-600 text-white hover:bg-brand-700',
                    )}
                  >
                    {transitioning ? '…' : label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'documents' && (
        <div className="bg-white border border-gray-100 rounded-xl">
          {!documents || documents.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Nincs dokumentum ehhez a projekthez.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Cím</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Típus</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Állapot</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Létrehozva</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc: any) => (
                  <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{doc.title}</td>
                    <td className="px-4 py-3 text-gray-500">{doc.type}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full',
                        doc.state === 'generated' ? 'bg-green-100 text-green-700' :
                        doc.state === 'sent' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-500'
                      )}>{doc.state}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{new Date(doc.createdAt).toLocaleDateString('hu-HU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'uploads' && (
        <div className="bg-white border border-gray-100 rounded-xl">
          {!uploads || uploads.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Nincs feltöltés ehhez a projekthez.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Fájlnév</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Kategória</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Méret</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Feltöltve</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((up: any) => (
                  <tr key={up.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{up.fileName}</td>
                    <td className="px-4 py-3 text-gray-500">{up.fileCategory}</td>
                    <td className="px-4 py-3 text-gray-400">{up.fileSizeBytes ? `${Math.round(up.fileSizeBytes / 1024)} KB` : '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{new Date(up.createdAt).toLocaleDateString('hu-HU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'quote' && id && (
        <ProjectQuoteTab
          projectId={id}
          projectName={project?.name ?? ''}
          customerId={project?.customerId}
        />
      )}

      {activeTab === 'work-orders' && (
        <div className="bg-white border border-gray-100 rounded-xl">
          {!workOrders || workOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Nincs munkalap ehhez a projekthez.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Szám</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Helyszín</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Állapot</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Határidő</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {workOrders.map((wo: any) => (
                  <WorkOrderRow key={wo.id} wo={wo} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'contracts' && (
        <div className="bg-white border border-gray-100 rounded-xl">
          {!contracts || (Array.isArray(contracts) ? contracts : contracts?.data ?? []).length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Nincs szerződés ehhez a projekthez.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Szám</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Cím</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Állapot</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Érték</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(contracts) ? contracts : contracts?.data ?? []).map((c: any) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.contractNumber}</td>
                    <td className="px-4 py-3 text-gray-500">{c.title}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c.state}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{c.value ? `${Number(c.value).toLocaleString('hu-HU')} Ft` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="bg-white border border-gray-100 rounded-xl">
          {!invoices || invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Nincs számla ehhez a projekthez.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Szám</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Állapot</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Összeg</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Határidő</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full',
                        inv.state === 'paid' ? 'bg-green-100 text-green-700' :
                        inv.state === 'overdue' ? 'bg-red-100 text-red-700' :
                        inv.state === 'sent' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-500'
                      )}>{inv.state}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{inv.totalAmount ? `${Number(inv.totalAmount).toLocaleString('hu-HU')} Ft` : '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('hu-HU') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'activities' && (
        <div className="bg-white border border-gray-100 rounded-xl">
          {!activities || activities.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Nincs tevékenység ehhez a projekthez.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {activities.map((act: any) => (
                <div key={act.id} className="px-4 py-3 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-medium text-brand-600 uppercase">{act.type}</span>
                      <p className="text-sm text-gray-700 mt-0.5">{act.notes || act.subject || '—'}</p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(act.occurredAt ?? act.createdAt).toLocaleDateString('hu-HU')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
