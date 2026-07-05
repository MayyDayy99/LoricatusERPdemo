'use client';

/**
 * Sprint 3 β₁: Document detail page.
 * ────────────────────────────────────────────────────────────────────────────
 * 5 tab: Preview / Versions / Recipients / Linked-entity / Audit-timeline.
 *
 *  - Preview: signed-URL iframe (PDF only) → ha a doc még DRAFT, "PDF generálás"
 *    gomb a /documents/:id/generate endpointot dobja; ha SENT/GENERATED, akkor
 *    Download-link + ujragenerálás opciónak.
 *  - Versions: traverse-el a supersededById láncon visszafele (rekurzív SWR-
 *    fetch; max 20 mély). A láncon belüli minden dokumentumot listáz, current-
 *    /superseded-badgezsel.
 *  - Recipients: a recipients-tömb táblásan + "Címzett hozzáadása" form a
 *    /documents/:id/send patch-en keresztül (incremental send, a backend
 *    dedup-ol email szerint).
 *  - Linked-entity: az első non-null FK (project|customer|deal|contract|
 *    work-order|invoice) és link a megfelelő detail-page-re.
 *  - Audit-timeline: <AuditTimeline resource="document" resourceId={id} />.
 */

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { clsx } from 'clsx';
import {
  ArrowLeft, FileText, Download, RefreshCw, Send, Users, Link2,
  History, Activity, Archive, AlertCircle, X, Plus,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  useDocument, sendDocument, generateDocument, supersedeDocument, downloadDocument,
  type Document, type DocumentRecipient,
} from '@/lib/hooks/use-documents';
import { useProject } from '@/lib/hooks/use-projects';
import { useT } from '@/lib/hooks/use-t';
import { AuditTimeline } from '@/components/audit/AuditTimeline';
import { DOCUMENT_STATE_STYLES } from '@/lib/document-lifecycle';

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

/* ─── version-chain hook ─────────────────────────────────────────────────── */

/**
 * A supersededById láncon visszafele halad — kis perf-overhead (max 20 mély,
 * sequential request). A backend-en NINCS dedikált /documents/:id/versions
 * endpoint, ezért a single-shot /documents/:id GET-ekből építjük a láncot.
 */
function useVersionChain(headId: string | null) {
  // Single SWR-kulcs: a chain-en végigmegyünk egy custom-fetcher-rel.
  const { data, error, isLoading } = useSWR<Document[]>(
    headId ? `/documents/${headId}::chain` : null,
    async () => {
      const chain: Document[] = [];
      let cursorId: string | null | undefined = headId;
      const seen = new Set<string>();
      for (let i = 0; i < 20 && cursorId && !seen.has(cursorId); i++) {
        seen.add(cursorId);
        try {
          const res = await apiClient.get(`/documents/${cursorId}`);
          const doc: Document = res.data;
          chain.push(doc);
          cursorId = doc.supersededById ?? null;
        } catch {
          break;
        }
      }
      return chain;
    },
  );
  return { chain: data ?? [], error, isLoading };
}

/* ─── linked-entity helper ────────────────────────────────────────────── */

function pickLinkedEntity(doc: Document): {
  kind: 'project' | 'customer' | 'deal' | 'contract' | 'workOrder' | 'invoice' | 'none';
  id: string | null;
} {
  if (doc.projectId)   return { kind: 'project',   id: doc.projectId };
  if (doc.customerId)  return { kind: 'customer',  id: doc.customerId };
  if (doc.dealId)      return { kind: 'deal',      id: doc.dealId };
  if (doc.contractId)  return { kind: 'contract',  id: doc.contractId };
  if (doc.workOrderId) return { kind: 'workOrder', id: doc.workOrderId };
  if (doc.invoiceId)   return { kind: 'invoice',   id: doc.invoiceId };
  return { kind: 'none', id: null };
}

/* ─── főkomponens ───────────────────────────────────────────────────────── */

type TabKey = 'preview' | 'versions' | 'recipients' | 'linked' | 'audit';

export default function DocumentDetailPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const { document: doc, isLoading, mutate, error } = useDocument(id ?? null);
  const [tab, setTab] = useState<TabKey>('preview');

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="space-y-6 max-w-5xl">
        <Link href="/documents" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-brand-600">
          <ArrowLeft className="w-4 h-4" />
          {t.documents.backToList}
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
          <p className="font-medium">{t.documents.emptyDocs}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="space-y-3">
        <Link href="/documents" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-brand-600">
          <ArrowLeft className="w-4 h-4" />
          {t.documents.backToList}
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-brand-500" />
              <h1 className="text-2xl font-bold text-gray-900 truncate">{doc.title}</h1>
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full',
                DOCUMENT_STATE_STYLES[doc.state] ?? 'bg-gray-100 text-gray-600')}>
                {(t.documents.stateLabels as Record<string, string>)[doc.state] ?? doc.state}
              </span>
              <span className="text-xs text-gray-500">
                {(t.documents.typeLabels as Record<string, string>)[doc.type] ?? doc.type}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(doc.createdAt).toLocaleString('hu-HU')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {doc.state !== 'draft' && (
              <button type="button" onClick={() => downloadDocument(doc.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
                <Download className="w-4 h-4" />
                {t.documents.pdfBtn}
              </button>
            )}
            {(doc.state === 'generated' || doc.state === 'sent') && (
              <SupersedeButton doc={doc} onDone={() => mutate()} />
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'preview',    label: t.documents.tabs.preview,    Icon: FileText },
          { key: 'versions',   label: t.documents.tabs.versions,   Icon: History  },
          { key: 'recipients', label: t.documents.tabs.recipients, Icon: Users    },
          { key: 'linked',     label: t.documents.tabs.linked,     Icon: Link2    },
          { key: 'audit',      label: t.documents.tabs.audit,      Icon: Activity },
        ] as { key: TabKey; label: string; Icon: typeof FileText }[]).map(({ key, label, Icon }) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={clsx('flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition',
              tab === key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        {tab === 'preview'    && <PreviewTab doc={doc} onChanged={mutate} />}
        {tab === 'versions'   && <VersionsTab doc={doc} />}
        {tab === 'recipients' && <RecipientsTab doc={doc} onChanged={mutate} />}
        {tab === 'linked'     && <LinkedTab doc={doc} />}
        {tab === 'audit'      && <AuditTimeline resource="document" resourceId={doc.id} />}
      </div>
    </div>
  );
}

/* ─── supersede button ───────────────────────────────────────────────────── */

function SupersedeButton({ doc, onDone }: { doc: Document; onDone: () => void }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!confirming) { setConfirming(true); return; }
    setBusy(true);
    try {
      await supersedeDocument(doc.id);
      onDone();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={busy}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition',
        confirming
          ? 'bg-orange-600 text-white hover:bg-orange-700'
          : 'border border-gray-200 text-gray-700 hover:bg-gray-50',
        busy && 'opacity-60',
      )}>
      <Archive className="w-4 h-4" />
      {confirming ? t.documents.bulk.confirmTitle : t.documents.supersedeBtn}
    </button>
  );
}

/* ─── Preview tab ────────────────────────────────────────────────────────── */

function PreviewTab({ doc, onChanged }: { doc: Document; onChanged: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A backend /documents/:id/pdf 302-vel redirect-el az S3/MinIO signed-URL-re.
  // Az iframe-mel közvetlenül a redirect-target-et nyitjuk meg — modern
  // browser követi a 302-t.
  const base = (apiClient.defaults.baseURL ?? '').replace(/\/$/, '');
  const previewUrl = `${base}/documents/${doc.id}/pdf`;

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    try {
      await generateDocument(doc.id);
      onChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.documents.createError);
    } finally {
      setBusy(false);
    }
  }

  if (doc.state === 'draft') {
    return (
      <div className="text-center py-12 space-y-4">
        <FileText className="w-12 h-12 mx-auto text-gray-300" />
        <p className="text-gray-600">{t.documents.preview.notAvailable}</p>
        <button type="button" onClick={handleGenerate} disabled={busy}
          className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition disabled:opacity-60">
          {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {t.documents.generateBtn}
        </button>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 inline-block">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => downloadDocument(doc.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
          <Download className="w-4 h-4" />
          {t.documents.preview.downloadBtn}
        </button>
      </div>
      <iframe
        src={previewUrl}
        title={doc.title}
        className="w-full h-[700px] border border-gray-200 rounded-lg"
      />
    </div>
  );
}

/* ─── Versions tab ───────────────────────────────────────────────────────── */

function VersionsTab({ doc }: { doc: Document }) {
  const t = useT();
  const { chain, isLoading } = useVersionChain(doc.id);

  if (isLoading) {
    return <p className="text-sm text-gray-400">{t.common.loading ?? 'Loading…'}</p>;
  }

  if (chain.length <= 1) {
    return (
      <div className="text-center py-12 space-y-3">
        <History className="w-10 h-10 mx-auto text-gray-300" />
        <p className="text-gray-600">{t.documents.versions.emptyChain}</p>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {chain.map((v, i) => (
        <li key={v.id}
          className={clsx('flex items-start gap-3 p-3 rounded-lg border',
            v.id === doc.id ? 'border-brand-300 bg-brand-50/30' : 'border-gray-100 bg-gray-50/30',
          )}>
          <FileText className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/documents/${v.id}`}
                className="font-medium text-gray-900 hover:text-brand-600 transition truncate">
                {v.title}
              </Link>
              {v.id === doc.id ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">
                  {t.documents.versions.currentBadge}
                </span>
              ) : (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                  {t.documents.versions.supersededBadge}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(v.createdAt).toLocaleString('hu-HU')}
              {' · '}
              {v.recipients.length} {t.documents.recipients.toLowerCase()}
            </p>
          </div>
          <span className="text-xs text-gray-400">#{chain.length - i}</span>
        </li>
      ))}
    </ol>
  );
}

/* ─── Recipients tab ─────────────────────────────────────────────────────── */

function RecipientsTab({ doc, onChanged }: { doc: Document; onChanged: () => void }) {
  const t = useT();
  const [showForm, setShowForm] = useState(false);
  const [recipients, setRecipients] = useState<DocumentRecipient[]>([{ email: '', name: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sendDocument(doc.id, recipients);
      setShowForm(false);
      setRecipients([{ email: '', name: '' }]);
      onChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.documents.sendError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{t.documents.recipients}</h3>
        {doc.state === 'generated' && !showForm && (
          <button type="button" onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
            <Plus className="w-3.5 h-3.5" />
            {t.documents.addRecipientBtn}
          </button>
        )}
      </div>

      {doc.recipients.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">{t.documents.emptyDocs}</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
          {doc.recipients.map((rec, i) => (
            <li key={`${rec.email}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
              <Users className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{rec.name}</p>
                <p className="text-xs text-gray-500 truncate">{rec.email}</p>
              </div>
              {rec.sentAt && (
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(rec.sentAt).toLocaleDateString('hu-HU')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
          {recipients.map((rec, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input type="text" required placeholder={t.documents.namePh}
                value={rec.name}
                onChange={(e) => setRecipients((r) => r.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
              <input type="email" required placeholder={t.documents.emailPh}
                value={rec.email}
                onChange={(e) => setRecipients((r) => r.map((x, idx) => idx === i ? { ...x, email: e.target.value } : x))}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
              {recipients.length > 1 && (
                <button type="button"
                  onClick={() => setRecipients((r) => r.filter((_, idx) => idx !== i))}
                  className="text-gray-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button type="button"
            onClick={() => setRecipients((r) => [...r, { email: '', name: '' }])}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium">
            + {t.common.add}
          </button>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              {t.common.cancel}
            </button>
            <button type="submit" disabled={busy}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 inline-flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" />
              {busy ? t.common.sending : t.common.send}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ─── Linked entity tab ──────────────────────────────────────────────────── */

function LinkedTab({ doc }: { doc: Document }) {
  const t = useT();
  const linked = pickLinkedEntity(doc);
  const { project } = useProject(linked.kind === 'project' ? linked.id : null);

  if (linked.kind === 'none' || !linked.id) {
    return (
      <div className="text-center py-12 space-y-2">
        <Link2 className="w-10 h-10 mx-auto text-gray-300" />
        <p className="text-gray-600">{t.documents.linkedNone}</p>
      </div>
    );
  }

  const labelMap: Record<string, string> = {
    project:   t.documents.linkedProject,
    customer:  t.documents.linkedCustomer,
    deal:      t.documents.linkedDeal,
    contract:  t.documents.linkedContract,
    workOrder: t.documents.linkedWorkOrder,
    invoice:   t.documents.linkedInvoice,
  };

  const hrefMap: Record<string, string> = {
    project:   `/projects/${linked.id}`,
    customer:  `/customers/${linked.id}`,
    deal:      `/crm`, // a deal-detail nem mindenhol létezik, a CRM hub-ra ugrunk
    contract:  `/contracts/${linked.id}`,
    workOrder: `/work-orders/${linked.id}`,
    invoice:   `/invoices/${linked.id}`,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
        <Link2 className="w-5 h-5 text-gray-400" />
        <div className="flex-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{labelMap[linked.kind]}</p>
          <Link href={hrefMap[linked.kind]}
            className="text-brand-600 hover:underline font-medium">
            {linked.kind === 'project' && project?.name
              ? project.name
              : linked.id}
          </Link>
        </div>
      </div>
    </div>
  );
}
