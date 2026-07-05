'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import {
  ArrowLeft, Play, CheckCircle, XCircle, Archive, FileText, Download,
  MapPin, Calendar, Users, ClipboardList, User, Phone, Mail, Briefcase,
  Loader2, AlertCircle, QrCode, Copy, X, MessageSquare, MinusCircle,
  Plus, Pencil, Trash2, Save, FileSignature, Activity, Folder,
} from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { apiClient } from '@/lib/api-client';
import { GenerateTasksModal } from '@/components/work-orders/generate-tasks-modal';
import { SignaturePad } from '@/components/work-orders/SignaturePad';
import { AuditTimeline } from '@/components/audit/AuditTimeline';
import { finalizeTasksForWorkOrder } from '@/lib/hooks/use-project-workflow';
import { signOffWorkOrder, revalidateWorkOrderScope } from '@/lib/hooks/use-work-orders';
import { revalidateShareScope } from '@/lib/hooks/use-shares';
import { useDocuments } from '@/lib/hooks/use-documents';
import { useCrmTasks, type CrmTask } from '@/lib/hooks/use-crm';
import { useT } from '@/lib/hooks/use-t';

/* ── Types ──────────────────────────────────────────────────── */
type WOState = 'draft' | 'active' | 'completed' | 'archived' | 'cancelled';

interface WorkOrderContact {
  name: string;
  phone?: string;
  email?: string;
  role?: string;
}

type WorkOrderItemStatus = 'todo' | 'done' | 'skipped';

interface WorkOrderItem {
  id: string;
  workOrderId: string;
  sourceTemplateItemId?: string;
  sectionCode: string;
  sectionTitle: string;
  code: string;
  task: string;
  tool1?: string;
  tool2?: string;
  owner?: string;
  unitPrice?: number | string | null;
  quantity?: number | string | null;
  unit?: string | null;
  status: WorkOrderItemStatus;
  comment?: string;
  completedAt?: string;
  completedBy?: string;
  sortIndex: number;
}

/** A munkalap-sor szerkesztő űrlap kimenete. `null` = a mező törlése.
 *  Ár-mezők (unitPrice/quantity/unit) szándékosan NEM szerepelnek — a pénz
 *  nem látszik a munkalapon. A quote-exportból örökölt ár-adat a DB-ben marad,
 *  csak nem jelenik meg / nem szerkeszthető itt. */
interface ItemPayload {
  sectionTitle?: string;
  code: string;
  task: string;
  tool1: string | null;
  tool2: string | null;
  owner: string | null;
}

interface WorkOrder {
  id: string;
  workOrderNumber: string;
  state: WOState;
  projectId?: string;
  customerId?: string;
  quoteId?: string;
  location: string;
  locationAddress?: string;
  locationGps?: { lat: number; lng: number };
  deadline?: string;
  workDates?: string[];
  clientCompany: string;
  contacts: WorkOrderContact[];
  accessInfo?: string;
  requiredDocuments?: string;
  priorAdministration?: string;
  projectGoal: string;
  scanningTasks?: string;
  droneTasks?: string;
  processingTasks?: string;
  modelingTasks?: string;
  consultationDate?: string;
  consultationPrepTime?: string;
  isExtraWork: boolean;
  deliverableFormats?: string[];
  responsiblePerson?: string;
  notes?: string;
  customFields: Record<string, unknown>;
  generatedStorageKey?: string;
  items?: WorkOrderItem[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/* ── Constants ──────────────────────────────────────────────── */
const STATE_STYLES: Record<WOState, string> = {
  draft:     'bg-gray-100 text-gray-600',
  active:    'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  archived:  'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};

const STATE_LABELS: Record<WOState, string> = {
  draft:     'Vázlat',
  active:    'Aktív',
  completed: 'Befejezett',
  archived:  'Archivált',
  cancelled: 'Visszavont',
};

const TRANSITIONS: Record<WOState, { label: string; action: string; icon: React.ElementType; variant: 'primary' | 'success' | 'danger' | 'warning' }[]> = {
  draft:     [{ label: 'Aktivál',  action: 'activate', icon: Play,         variant: 'primary' },
              { label: 'Visszavon', action: 'cancel',   icon: XCircle,      variant: 'danger' }],
  active:    [{ label: 'Befejez',  action: 'complete', icon: CheckCircle,  variant: 'success' },
              { label: 'Visszavon', action: 'cancel',   icon: XCircle,      variant: 'danger' }],
  completed: [{ label: 'Archivál', action: 'archive',  icon: Archive,      variant: 'warning' }],
  archived:  [],
  cancelled: [],
};

const VARIANT_STYLES = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  success: 'bg-green-600 hover:bg-green-700 text-white',
  danger:  'bg-red-600 hover:bg-red-700 text-white',
  warning: 'bg-yellow-500 hover:bg-yellow-600 text-white',
};

function fetcher(url: string) {
  return apiClient.get(url).then((r) => r.data);
}

/* ── Sub-components ─────────────────────────────────────────── */
function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-lg">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-gray-500" />}
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

/* Új sor / meglévő sor szerkesztő űrlapja — minden tételes mező editálható. */
function ItemForm({
  initial, lockSection, busy, onSave, onCancel,
}: {
  initial: Partial<WorkOrderItem>;
  lockSection: boolean;
  busy: boolean;
  onSave: (data: ItemPayload) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    sectionTitle: initial.sectionTitle ?? '',
    code: initial.code ?? '',
    task: initial.task ?? '',
    tool1: initial.tool1 ?? '',
    tool2: initial.tool2 ?? '',
    owner: initial.owner ?? '',
  });
  const set = (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF((prev) => ({ ...prev, [k]: e.target.value }));

  function submit() {
    if (!f.task.trim()) { toast.error('A feladat megadása kötelező'); return; }
    if (!lockSection && !f.sectionTitle.trim()) { toast.error('A szekció neve kötelező'); return; }
    onSave({
      ...(lockSection ? {} : { sectionTitle: f.sectionTitle.trim() }),
      code: f.code.trim(),
      task: f.task.trim(),
      tool1: f.tool1.trim() || null,
      tool2: f.tool2.trim() || null,
      owner: f.owner.trim() || null,
    });
  }

  const inputCls = 'border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';

  return (
    <div className="px-4 py-3 bg-blue-50/50 space-y-2 border-l-2 border-blue-300">
      {!lockSection && (
        <input
          className={clsx(inputCls, 'w-full font-medium')}
          placeholder="Szekció neve *" value={f.sectionTitle}
          onChange={set('sectionTitle')} maxLength={200}
        />
      )}
      <div className="flex gap-2">
        <input className={clsx(inputCls, 'w-24 shrink-0')} placeholder="Kód" value={f.code} onChange={set('code')} maxLength={16} />
        <textarea className={clsx(inputCls, 'flex-1')} placeholder="Feladat *" value={f.task} onChange={set('task')} rows={2} />
      </div>
      <div className="flex gap-2 flex-wrap">
        <input className={clsx(inputCls, 'flex-1 min-w-[110px]')} placeholder="Eszköz 1" value={f.tool1} onChange={set('tool1')} maxLength={120} />
        <input className={clsx(inputCls, 'flex-1 min-w-[110px]')} placeholder="Eszköz 2" value={f.tool2} onChange={set('tool2')} maxLength={120} />
        <input className={clsx(inputCls, 'flex-1 min-w-[110px]')} placeholder="Felelős" value={f.owner} onChange={set('owner')} maxLength={200} />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={submit} disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Mentés
        </button>
        <button
          onClick={onCancel} disabled={busy}
          className="px-3 py-1.5 text-sm rounded border border-gray-200 hover:bg-gray-50 text-gray-600"
        >
          Mégse
        </button>
      </div>
    </div>
  );
}

/* Checklist — munkalap-sorok teljes körű szerkesztése (pipálás + add/edit/törlés). */
function ChecklistCard({
  items, workOrderId, onMutate,
}: {
  items: WorkOrderItem[];
  workOrderId: string;
  onMutate: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  // addTarget: meglévő szekcióhoz adunk sort {code,title}, vagy 'new' = új szekció
  const [addTarget, setAddTarget] = useState<{ code: string; title: string } | 'new' | null>(null);
  const [busy, setBusy] = useState(false);

  // Szekciókra csoportosítva
  const sections = (() => {
    const m = new Map<string, { code: string; title: string; items: WorkOrderItem[] }>();
    for (const it of items) {
      let s = m.get(it.sectionCode);
      if (!s) { s = { code: it.sectionCode, title: it.sectionTitle, items: [] }; m.set(it.sectionCode, s); }
      s.items.push(it);
    }
    return [...m.values()].sort((a, b) => a.code.localeCompare(b.code))
      .map(s => ({ ...s, items: s.items.sort((a, b) => a.sortIndex - b.sortIndex) }));
  })();

  const totalCount = items.length;
  const doneCount = items.filter(i => i.status === 'done').length;
  const skippedCount = items.filter(i => i.status === 'skipped').length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // 8 karakteres, ütközés-mentes szekció-kód új szekcióhoz
  const genSectionCode = () => 'M' + Date.now().toString(36).slice(-5).toUpperCase();

  // γ_polish: az item-szintű mutációk csak a /work-orders/${id} SWR-kulcsot frissítik
  // (onMutate → parent mutate). Ez szándékos — a checklist-progressz a detail-page
  // sajátja, a listanézet doneCount-ja a következő full-revalidate-en frissül.
  async function setStatus(item: WorkOrderItem, status: WorkOrderItemStatus) {
    try {
      await apiClient.patch(`/work-orders/${workOrderId}/items/${item.id}`, { status });
      onMutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Frissítés sikertelen');
    }
  }
  async function setComment(item: WorkOrderItem, comment: string) {
    if (comment === (item.comment ?? '')) return;
    try {
      await apiClient.patch(`/work-orders/${workOrderId}/items/${item.id}`, { comment: comment || null });
      onMutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Megjegyzés mentése sikertelen');
    }
  }

  async function saveEdit(itemId: string, data: ItemPayload) {
    setBusy(true);
    try {
      await apiClient.patch(`/work-orders/${workOrderId}/items/${itemId}`, data);
      toast.success('Sor mentve');
      setEditingId(null);
      onMutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Sor mentése sikertelen');
    } finally {
      setBusy(false);
    }
  }

  async function createItem(data: ItemPayload, section: { code: string; title: string } | null) {
    setBusy(true);
    try {
      const payload = section
        ? { ...data, sectionCode: section.code, sectionTitle: section.title }
        : { ...data, sectionCode: genSectionCode() }; // data.sectionTitle benne van
      await apiClient.post(`/work-orders/${workOrderId}/items`, payload);
      toast.success('Sor hozzáadva');
      setAddTarget(null);
      onMutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Sor hozzáadása sikertelen');
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(itemId: string) {
    if (!window.confirm('Biztosan törlöd ezt a munkalap-sort?')) return;
    setBusy(true);
    try {
      await apiClient.delete(`/work-orders/${workOrderId}/items/${itemId}`);
      toast.success('Sor törölve');
      onMutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Sor törlése sikertelen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border rounded-lg">
      <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-800">Munkalap-feladatok</h3>
        </div>
        {totalCount > 0 && (
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-500">
              <strong className="text-gray-900">{doneCount}</strong>/{totalCount} kész
              {skippedCount > 0 && <> · {skippedCount} kihagyva</>}
            </div>
            <div className="w-32 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div className="bg-green-500 h-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-gray-700 w-9 text-right">{pct}%</span>
          </div>
        )}
      </div>
      <div className="divide-y divide-gray-100">
        {sections.length === 0 && addTarget !== 'new' && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">
            Még nincs munkalap-sor — add hozzá az elsőt lent.
          </div>
        )}
        {sections.map(sec => (
          <div key={sec.code}>
            <div className="px-4 py-2 bg-gray-50 text-xs font-bold text-gray-700 uppercase tracking-wide">
              {sec.code} — {sec.title}
            </div>
            {sec.items.map(it => (
              editingId === it.id ? (
                <ItemForm
                  key={it.id} initial={it} lockSection busy={busy}
                  onSave={(d) => saveEdit(it.id, d)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <ChecklistRow
                  key={it.id}
                  item={it}
                  onSetStatus={(s) => setStatus(it, s)}
                  onSetComment={(c) => setComment(it, c)}
                  onEdit={() => { setAddTarget(null); setEditingId(it.id); }}
                  onDelete={() => deleteItem(it.id)}
                />
              )
            ))}
            {addTarget && addTarget !== 'new' && addTarget.code === sec.code ? (
              <ItemForm
                initial={{}} lockSection busy={busy}
                onSave={(d) => createItem(d, { code: sec.code, title: sec.title })}
                onCancel={() => setAddTarget(null)}
              />
            ) : (
              <button
                onClick={() => { setEditingId(null); setAddTarget({ code: sec.code, title: sec.title }); }}
                className="w-full px-4 py-2 text-left text-xs text-blue-600 hover:bg-blue-50 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Sor hozzáadása ehhez a szekcióhoz
              </button>
            )}
          </div>
        ))}
        {addTarget === 'new' ? (
          <ItemForm
            initial={{}} lockSection={false} busy={busy}
            onSave={(d) => createItem(d, null)}
            onCancel={() => setAddTarget(null)}
          />
        ) : (
          <button
            onClick={() => { setEditingId(null); setAddTarget('new'); }}
            className="w-full px-4 py-2.5 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-1.5 border-t border-gray-100"
          >
            <Plus className="w-4 h-4" /> Új szekció hozzáadása
          </button>
        )}
      </div>
    </div>
  );
}

function ChecklistRow({
  item, onSetStatus, onSetComment, onEdit, onDelete,
}: {
  item: WorkOrderItem;
  onSetStatus: (s: WorkOrderItemStatus) => void;
  onSetComment: (c: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showComment, setShowComment] = useState(!!item.comment);
  const [draft, setDraft] = useState(item.comment ?? '');
  const isDone = item.status === 'done';
  const isSkipped = item.status === 'skipped';

  return (
    <div className={clsx(
      'px-4 py-3 hover:bg-gray-50 group',
      isDone && 'bg-green-50/30',
      isSkipped && 'bg-yellow-50/30',
    )}>
      <div className="flex items-start gap-3">
        {/* Checkbox: todo↔done toggle */}
        <button
          onClick={() => onSetStatus(isDone ? 'todo' : 'done')}
          className={clsx(
            'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 transition',
            isDone ? 'bg-green-600 border-green-600 text-white'
                   : 'border-gray-300 hover:border-green-500 bg-white',
          )}
          title={isDone ? 'Visszavon' : 'Kész'}
        >
          {isDone && <CheckCircle className="w-3.5 h-3.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            {item.code && (
              <code className="text-xs font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">{item.code}</code>
            )}
            <span className={clsx(
              'text-sm',
              isDone && 'text-gray-500 line-through',
              isSkipped && 'text-yellow-700 italic',
            )}>{item.task}</span>
          </div>
          {(item.tool1 || item.tool2 || item.owner) && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
              {item.tool1 && <span>🛠 {item.tool1}</span>}
              {item.tool2 && <span>🛠 {item.tool2}</span>}
              {item.owner && <span>👤 {item.owner}</span>}
            </div>
          )}
          {item.completedAt && (
            <div className="mt-1 text-xs text-gray-400">
              {new Date(item.completedAt).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          )}
          {showComment ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => onSetComment(draft)}
              rows={2}
              maxLength={2000}
              placeholder="Megjegyzés…"
              className="mt-2 w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            <button
              onClick={() => setShowComment(true)}
              className="mt-1.5 text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1"
            >
              <MessageSquare className="w-3 h-3" /> Megjegyzés hozzáadása
            </button>
          )}
        </div>
        {/* Sor-műveletek: szerkesztés / törlés / kihagyás */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-1 rounded text-gray-300 hover:text-blue-600 hover:bg-gray-100"
            title="Sor szerkesztése"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded text-gray-300 hover:text-red-600 hover:bg-gray-100"
            title="Sor törlése"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onSetStatus(isSkipped ? 'todo' : 'skipped')}
            className={clsx(
              'p-1 rounded hover:bg-gray-100',
              isSkipped ? 'text-yellow-600' : 'text-gray-300 hover:text-yellow-600',
            )}
            title={isSkipped ? 'Visszavon' : 'Kihagyás (nem alkalmazható)'}
          >
            <MinusCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactCard({ contact }: { contact: WorkOrderContact }) {
  return (
    <div className="flex flex-col gap-1 p-2 bg-gray-50 rounded border">
      <div className="flex items-center gap-1.5 font-medium text-sm text-gray-900">
        <User className="w-3.5 h-3.5 text-gray-400" />
        {contact.name}
        {contact.role && <span className="text-xs text-gray-500">— {contact.role}</span>}
      </div>
      {contact.phone && (
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Phone className="w-3 h-3 text-gray-400" /> {contact.phone}
        </div>
      )}
      {contact.email && (
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Mail className="w-3 h-3 text-gray-400" /> {contact.email}
        </div>
      )}
    </div>
  );
}

/* ── β₃: Tab-system ─────────────────────────────────────────── */

type TabId = 'items' | 'generatedTasks' | 'linkedDocs' | 'audit' | 'signOff';

const TAB_ICONS: Record<TabId, React.ElementType> = {
  items:          ClipboardList,
  generatedTasks: Activity,
  linkedDocs:     Folder,
  audit:          FileText,
  signOff:        FileSignature,
};

/** Generated-tasks tab — minden /crm-tasks?workOrderId=… task linkelve a Map-be. */
function GeneratedTasksTab({ workOrderId }: { workOrderId: string }) {
  const t = useT();
  // A useCrmTasks hook a filters-tömböt URL-paramba pakolja. A workOrderId NEM
  // szerepel a kanonikus filter-shape-jében, ezért közvetlen apiClient-en
  // megyünk, így a SWR-kulcs egyértelműen `?workOrderId=…` lesz (a
  // revalidateWorkOrderScope ezt prefix-szel ütközteti).
  const { data, isLoading } = useSWR<CrmTask[] | { items: CrmTask[] }>(
    `/crm-tasks?workOrderId=${workOrderId}`,
    (url: string) => apiClient.get(url).then((r) => r.data),
  );
  const tasks: CrmTask[] = Array.isArray(data) ? data : (data?.items ?? []);

  if (isLoading) return <div className="py-8 text-center text-sm text-gray-400">{t.common.loading}</div>;
  if (tasks.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-400">{(t.workOrders as any).tabEmpty?.generatedTasks ?? 'Még nincs generált feladat.'}</div>;
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Cím</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Állapot</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Határidő</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Felelős</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tasks.map((task) => (
            <tr key={task.id} className="hover:bg-gray-50">
              <td className="px-4 py-2">
                <Link href={`/crm/tasks/${task.id}`} className="font-medium text-brand-600 hover:underline">
                  {task.title}
                </Link>
              </td>
              <td className="px-4 py-2 text-xs text-gray-500">{task.status}</td>
              <td className="px-4 py-2 text-xs text-gray-500">
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString('hu-HU') : '—'}
              </td>
              <td className="px-4 py-2 text-xs text-gray-500">{task.assignedToName ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Linked-documents tab — a projekt összes dokumentuma, ahol a metadata.workOrderId
 *  egyezik VAGY (legacy) a típus 'handover' (a WO-PDF-export előtti egyetlen
 *  típus, ami munkalaphoz kapcsolódott). */
function LinkedDocumentsTab({
  workOrderId, projectId,
}: { workOrderId: string; projectId: string | null }) {
  const t = useT();
  const { documents, isLoading } = useDocuments(projectId);

  if (!projectId) {
    return <div className="py-8 text-center text-sm text-gray-400">{(t.workOrders as any).tabEmpty?.linkedDocs ?? 'Nincs projekt — nincs dokumentum.'}</div>;
  }
  if (isLoading) return <div className="py-8 text-center text-sm text-gray-400">{t.common.loading}</div>;

  // metadata.workOrderId egyezés VAGY 'handover' fallback (legacy).
  const filtered = documents.filter((d) => {
    const meta = (d as any).metadata as { workOrderId?: string } | undefined;
    if (meta?.workOrderId === workOrderId) return true;
    if (d.type === 'handover') return true;
    return false;
  });

  if (filtered.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-400">{(t.workOrders as any).tabEmpty?.linkedDocs ?? 'Nincs kapcsolódó dokumentum.'}</div>;
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Cím</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Típus</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Állapot</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Generálva</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filtered.map((d) => (
            <tr key={d.id} className="hover:bg-gray-50">
              <td className="px-4 py-2">
                <Link href={`/documents/${d.id}`} className="font-medium text-brand-600 hover:underline">
                  {d.title}
                </Link>
              </td>
              <td className="px-4 py-2 text-xs text-gray-500">{d.type}</td>
              <td className="px-4 py-2 text-xs text-gray-500">{d.state}</td>
              <td className="px-4 py-2 text-xs text-gray-500">
                {d.generatedAt ? new Date(d.generatedAt).toLocaleString('hu-HU') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Sign-off tab — SignaturePad-komponensen át rögzítjük az ügyfél aláírását.
 *  Az adatfolyam: SignaturePad.onSign(base64Png, signerName) →
 *  POST /work-orders/:id/sign-off (signaturePngBase64 + signerName) →
 *  customFields.signedBy / signedAt / signaturePngBase64 mentve. */
function SignOffTab({ wo, onSigned }: { wo: WorkOrder; onSigned: () => void }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const customFields = (wo.customFields ?? {}) as Record<string, unknown>;
  const signedBy = customFields['signedBy'] as string | undefined;
  const signedAt = customFields['signedAt'] as string | undefined;
  const signedImg = customFields['signaturePngBase64'] as string | undefined;

  // A sign-off csak ACTIVE/COMPLETED state-ből engedélyezett (a szervere is
  // így transzicionál; tiltott állapotból küldés 400-at adna).
  const allowedState = wo.state === 'active' || wo.state === 'completed';

  async function handleSign(base64Png: string, signerName: string) {
    setSaving(true);
    try {
      await signOffWorkOrder(wo.id, { signerName, signaturePngBase64: base64Png });
      toast.success((t.workOrders as any).signOff?.successToast ?? 'Aláírás rögzítve.');
      setEditing(false);
      revalidateWorkOrderScope({
        workOrderId: wo.id,
        projectId: wo.projectId,
        customerId: wo.customerId,
        quoteId: wo.quoteId,
      });
      onSigned();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Hiba'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <FileSignature className="w-4 h-4 text-gray-500" />
          {(t.workOrders as any).signOff?.title ?? 'Aláírás rögzítése'}
        </h3>
        {signedBy && !editing && (
          <button type="button" onClick={() => setEditing(true)}
            className="text-xs text-gray-500 hover:text-brand-600 flex items-center gap-1">
            <Pencil className="w-3.5 h-3.5" />
            Új aláírás
          </button>
        )}
      </div>

      {/* Meglévő aláírás-megjelenítés */}
      {signedBy && !editing && (
        <div className="space-y-2">
          <InfoRow label={(t.workOrders as any).signOff?.signedBy ?? 'Aláírta'} value={signedBy} />
          {signedAt && (
            <InfoRow
              label={(t.workOrders as any).signOff?.signedAt ?? 'Aláírás időpontja'}
              value={new Date(signedAt).toLocaleString('hu-HU')}
            />
          )}
          {signedImg && (
            <div className="mt-3 border border-gray-200 rounded-lg p-3 bg-gray-50">
              <p className="text-xs text-gray-500 mb-2">
                {(t.workOrders as any).signOff?.showImage ?? 'Aláírás'}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signedImg} alt="Aláírás" className="max-w-md border bg-white" />
            </div>
          )}
        </div>
      )}

      {/* Aláírás-rögzítő panel */}
      {(!signedBy || editing) && (
        <>
          {!allowedState ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {(t.workOrders as any).signOff?.availableInStateActive
                ?? 'Aláírás csak AKTÍV vagy BEFEJEZETT munkalapra rögzíthető.'}
            </p>
          ) : (
            <SignaturePad
              onSign={handleSign}
              onCancel={() => setEditing(false)}
              initialName={signedBy ?? ''}
            />
          )}
        </>
      )}

      {!signedBy && !editing && (
        <p className="text-sm text-gray-500">
          {(t.workOrders as any).signOff?.notSigned ?? 'Még nincs aláírva.'}
        </p>
      )}

      {/* A saving-flag a SignaturePad-en belüli `submitting`-gel együtt ad
          vizuális visszajelzést — nem külön loader. */}
      {saving && <p className="text-xs text-gray-400">Mentés…</p>}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function WorkOrderDetailPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabId>('items');
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfQueued, setPdfQueued] = useState(false);
  const [portalLink, setPortalLink] = useState<{ url: string; qrDataUrl: string } | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [taskGenOpen, setTaskGenOpen] = useState(false);

  const taskStats = useSWR<{ taskCount: number; draftCount: number }>(
    id ? `/work-orders/${id}/task-stats` : null,
    (url: string) => apiClient.get(url).then(r => r.data),
  );
  const existingTaskCount = taskStats.data?.taskCount ?? 0;
  const draftCount = taskStats.data?.draftCount ?? 0;
  const [finalizing, setFinalizing] = useState(false);

  async function handleFinalize() {
    if (draftCount === 0) return;
    if (!confirm(`Véglegesíted a ${draftCount} piszkozat task-ot? Ezután élesben jelennek meg a Mapen.`)) return;
    setFinalizing(true);
    try {
      const result = await finalizeTasksForWorkOrder(id!);
      toast.success(`${result.finalizedCount} task véglegesítve`);
      void taskStats.mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Véglegesítés sikertelen');
    } finally {
      setFinalizing(false);
    }
  }

  async function handleGeneratePortalLink() {
    if (!wo) return;
    setPortalLoading(true);
    try {
      // 7-day expiry, single use (maxUses = 1 would prevent re-access if they close the tab; use 10 instead)
      const res = await apiClient.post('/shares', {
        scope: 'work_order',
        resourceId: wo.id,
        expiresInHours: 24 * 14,
        maxUses: 50,
      });
      // γ_polish: a portál-link létrehozása új share-rekord — invalidáljuk a
      // /shares* SWR-cache-t, hogy a Megosztások-lista azonnal frissüljön.
      revalidateShareScope({ resourceId: wo.id });
      const token = res.data.token as string;
      const url = `${window.location.origin}/portal/${token}`;
      const qrDataUrl = await QRCode.toDataURL(url, { width: 320, margin: 2 });
      setPortalLink({ url, qrDataUrl });
    } catch (err: any) {
      toast.error('Nem sikerült a link generálása: ' + (err?.response?.data?.message ?? err.message));
    } finally {
      setPortalLoading(false);
    }
  }

  const { data: wo, error, isLoading, mutate } = useSWR<WorkOrder>(
    id ? `/work-orders/${id}` : null,
    fetcher,
  );

  /* ── Transition handler ──────────────────────────────────── */
  const handleTransition = async (action: string) => {
    if (!id) return;
    setTransitioning(action);
    try {
      await apiClient.post(`/work-orders/${id}/${action}`);
      toast.success('Állapot frissítve');
      // γ_polish: az állapot-tranzíció a listanézetet is érinti — nemcsak a
      // detail SWR-t, hanem a /work-orders prefix-kulcsokat is invalidálni kell.
      revalidateWorkOrderScope({ workOrderId: id });
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Hiba történt');
    } finally {
      setTransitioning(null);
    }
  };

  /* ── PDF handlers ────────────────────────────────────────── */
  const handleGeneratePdf = async () => {
    if (!id) return;
    setPdfLoading(true);
    try {
      await apiClient.post(`/work-orders/${id}/generate-pdf`);
      setPdfQueued(true);
      toast.success('PDF generálás elindítva — pár másodperc múlva elérhető');
      setTimeout(() => mutate(), 4000);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'PDF generálás sikertelen');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!id) return;
    setPdfLoading(true);
    try {
      const { data } = await apiClient.get<{ url: string }>(`/work-orders/${id}/pdf`);
      window.open(data.url, '_blank');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Letöltési link nem elérhető');
    } finally {
      setPdfLoading(false);
    }
  };

  /* ── Loading / error states ──────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !wo) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-gray-600">Munkalap nem található</p>
        <Link href="/work-orders" className="text-sm text-blue-600 hover:underline">
          ← Vissza a listához
        </Link>
      </div>
    );
  }

  const transitions = TRANSITIONS[wo.state] ?? [];
  const daysLeft = wo.deadline
    ? Math.ceil((new Date(wo.deadline).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/work-orders"
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{wo.workOrderNumber}</h1>
              <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STATE_STYLES[wo.state])}>
                {STATE_LABELS[wo.state]}
              </span>
              {wo.isExtraWork && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                  Pótmunka
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{wo.clientCompany}</p>
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* PDF buttons */}
          {wo.generatedStorageKey ? (
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50"
            >
              {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              PDF letöltés
            </button>
          ) : (
            <button
              onClick={handleGeneratePdf}
              disabled={pdfLoading || pdfQueued}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50"
            >
              {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {pdfQueued ? 'Generálás folyamatban…' : 'PDF generálás'}
            </button>
          )}

          <button
            onClick={handleGeneratePortalLink}
            disabled={portalLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50"
            title="Alvállalkozói portál link + QR kód"
          >
            {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
            Alvállalkozói QR
          </button>

          {/* Task-ok generálása a projekt-mapba */}
          <button
            onClick={() => setTaskGenOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded font-medium bg-blue-600 hover:bg-blue-700 text-white"
            title="A munkalap-tételekből draft task-ok létrehozása a projekt mapba"
          >
            <Play className="w-4 h-4" />
            {existingTaskCount > 0 ? `Újragenerálás (${existingTaskCount})` : 'Task-ok generálása'}
          </button>

          {/* Piszkozat-task-ok véglegesítése */}
          {draftCount > 0 && (
            <button
              onClick={handleFinalize}
              disabled={finalizing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded font-medium bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
              title="A PISZKOZAT task-okat véglegessé teszi (draft → pending). Ezután élesben jelennek meg a Mapen."
            >
              <CheckCircle className="w-4 h-4" />
              {finalizing ? 'Véglegesítés…' : `Véglegesítés (${draftCount} piszkozat)`}
            </button>
          )}

          {/* State transitions */}
          {transitions.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.action}
                onClick={() => handleTransition(t.action)}
                disabled={transitioning !== null}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded font-medium disabled:opacity-50',
                  VARIANT_STYLES[t.variant],
                )}
              >
                {transitioning === t.action
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Icon className="w-4 h-4" />}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Meta bar ── */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-600 bg-gray-50 border rounded-lg px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span>{wo.location}</span>
          {wo.locationAddress && <span className="text-gray-400">— {wo.locationAddress}</span>}
        </div>
        {wo.deadline && (
          <div className={clsx('flex items-center gap-1.5', daysLeft !== null && daysLeft < 0 && 'text-red-600 font-medium')}>
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>Határidő: {new Date(wo.deadline).toLocaleDateString('hu-HU')}</span>
            {daysLeft !== null && (
              <span className={clsx('text-xs', daysLeft < 0 ? 'text-red-600' : daysLeft <= 7 ? 'text-orange-600' : 'text-gray-500')}>
                ({daysLeft < 0 ? `${Math.abs(daysLeft)} napja lejárt` : daysLeft === 0 ? 'Ma' : `${daysLeft} nap`})
              </span>
            )}
          </div>
        )}
        {wo.responsiblePerson && (
          <div className="flex items-center gap-1.5">
            <User className="w-4 h-4 text-gray-400" />
            <span>{wo.responsiblePerson}</span>
          </div>
        )}
        {wo.projectId && (
          <Link href={`/projects/${wo.projectId}`} className="flex items-center gap-1.5 text-blue-600 hover:underline">
            <Briefcase className="w-4 h-4" />
            <span>Projekt</span>
          </Link>
        )}
      </div>

      {/* ── β₃: Tabs (Items / Generated / Documents / Audit / Sign-off) ── */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 flex-wrap">
          {(['items', 'generatedTasks', 'linkedDocs', 'audit', 'signOff'] as TabId[]).map((tabId) => {
            const label = (t.workOrders as any).tabs?.[tabId] ?? tabId;
            const Icon = TAB_ICONS[tabId];
            return (
              <button key={tabId} type="button" onClick={() => setActiveTab(tabId)}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px',
                  activeTab === tabId
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                )}>
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── β₃: Tab-content ── */}
      {activeTab === 'generatedTasks' && (
        <GeneratedTasksTab workOrderId={wo.id} />
      )}
      {activeTab === 'linkedDocs' && (
        <LinkedDocumentsTab workOrderId={wo.id} projectId={wo.projectId ?? null} />
      )}
      {activeTab === 'audit' && (
        <div className="bg-white border rounded-lg p-4">
          <AuditTimeline resource="work_order" resourceId={wo.id} />
        </div>
      )}
      {activeTab === 'signOff' && (
        <SignOffTab wo={wo} onSigned={() => mutate()} />
      )}

      {/* ── Content grid (Items tab) ── */}
      {activeTab === 'items' && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Feladatok */}
        <div className="md:col-span-2">
          <Card title="Feladatok" icon={ClipboardList}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow label="Projekt célja" value={<span className="whitespace-pre-line">{wo.projectGoal}</span>} />
              {wo.scanningTasks && <InfoRow label="Felmérési feladatok" value={<span className="whitespace-pre-line">{wo.scanningTasks}</span>} />}
              {wo.droneTasks && <InfoRow label="Drón feladatok" value={<span className="whitespace-pre-line">{wo.droneTasks}</span>} />}
              {wo.processingTasks && <InfoRow label="Feldolgozási feladatok" value={<span className="whitespace-pre-line">{wo.processingTasks}</span>} />}
              {wo.modelingTasks && <InfoRow label="Modellezési feladatok" value={<span className="whitespace-pre-line">{wo.modelingTasks}</span>} />}
            </div>
            {wo.deliverableFormats && wo.deliverableFormats.length > 0 && (
              <div className="mt-3">
                <span className="text-xs text-gray-500 block mb-1">Átadandó formátumok</span>
                <div className="flex flex-wrap gap-1.5">
                  {wo.deliverableFormats.map((f) => (
                    <span key={f} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">{f}</span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Munkalap-checklist — teljes körű sor-szerkesztés (add / edit / törlés) */}
        <div className="md:col-span-2">
          <ChecklistCard items={wo.items ?? []} workOrderId={wo.id} onMutate={() => mutate()} />
        </div>

        {/* Helyszín adatok */}
        <Card title="Helyszín" icon={MapPin}>
          <div className="space-y-3">
            <InfoRow label="Helyszín neve" value={wo.location} />
            <InfoRow label="Cím" value={wo.locationAddress} />
            {wo.locationGps && (
              <InfoRow label="GPS koordináták"
                value={`${wo.locationGps.lat.toFixed(6)}, ${wo.locationGps.lng.toFixed(6)}`} />
            )}
            <InfoRow label="Hozzáférési információk" value={wo.accessInfo && <span className="whitespace-pre-line">{wo.accessInfo}</span>} />
            <InfoRow label="Szükséges dokumentumok" value={wo.requiredDocuments && <span className="whitespace-pre-line">{wo.requiredDocuments}</span>} />
            <InfoRow label="Előzetes adminisztráció" value={wo.priorAdministration && <span className="whitespace-pre-line">{wo.priorAdministration}</span>} />
          </div>
        </Card>

        {/* Időpontok */}
        <Card title="Időpontok" icon={Calendar}>
          <div className="space-y-3">
            {wo.deadline && (
              <InfoRow label="Határidő" value={new Date(wo.deadline).toLocaleDateString('hu-HU')} />
            )}
            {wo.workDates && wo.workDates.length > 0 && (
              <div>
                <span className="text-xs text-gray-500 block mb-1">Munkavégzés napjai</span>
                <div className="flex flex-col gap-1">
                  {wo.workDates.map((d) => (
                    <span key={d} className="text-sm text-gray-700">
                      {new Date(d).toLocaleDateString('hu-HU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {wo.consultationDate && (
              <InfoRow label="Konzultáció dátuma" value={new Date(wo.consultationDate).toLocaleDateString('hu-HU')} />
            )}
            <InfoRow label="Konzultáció előkészítési idő" value={wo.consultationPrepTime} />
            <InfoRow label="Létrehozva" value={new Date(wo.createdAt).toLocaleDateString('hu-HU')} />
          </div>
        </Card>

        {/* Kontaktok */}
        {wo.contacts && wo.contacts.length > 0 && (
          <Card title="Kontaktok" icon={Users}>
            <div className="space-y-2">
              {wo.contacts.map((c, i) => (
                <ContactCard key={i} contact={c} />
              ))}
            </div>
          </Card>
        )}

        {/* Megjegyzések */}
        {wo.notes && (
          <Card title="Megjegyzések">
            <p className="text-sm text-gray-700 whitespace-pre-line">{wo.notes}</p>
          </Card>
        )}

        {/* Egyéni mezők */}
        {wo.customFields && Object.keys(wo.customFields).length > 0 && (
          <Card title="Egyéni mezők">
            <div className="space-y-2">
              {Object.entries(wo.customFields).map(([k, v]) => (
                <InfoRow key={k} label={k} value={String(v)} />
              ))}
            </div>
          </Card>
        )}
      </div>
      )}

      {/* Portal QR modal */}
      {portalLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setPortalLink(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Alvállalkozói portál link</h2>
                <p className="text-xs text-gray-500 mt-1">Olvastasd be a QR-kódot a telefonnal vagy másold ki a linket.</p>
              </div>
              <button onClick={() => setPortalLink(null)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex justify-center bg-gray-50 rounded-xl p-4">
              <img src={portalLink.qrDataUrl} alt="QR kód" className="w-56 h-56" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">Link</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={portalLink.url}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono bg-gray-50"
                  onFocus={e => e.currentTarget.select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(portalLink.url);
                    toast.success('Link másolva');
                  }}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-700"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              A link 14 napig érvényes, maximum 50 megnyitás. Az aláírás egyszer rögzíthető.
            </p>
          </div>
        </div>
      )}

      {/* Task-ok generálása modal */}
      {taskGenOpen && wo && (
        <GenerateTasksModal
          workOrderId={wo.id}
          projectId={wo.projectId ?? null}
          quoteId={wo.quoteId ?? null}
          existingTaskCount={existingTaskCount}
          onClose={() => setTaskGenOpen(false)}
          onDone={() => { void taskStats.mutate(); }}
        />
      )}
    </div>
  );
}
