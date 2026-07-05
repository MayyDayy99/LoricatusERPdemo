'use client';

import { useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { Play, Check, X, Ban, Radar, FileText, Mail, ChevronRight, ExternalLink, Send, Eye } from 'lucide-react';
import {
  type DroneOperation,
  transitionDroneOperation, fetchOperationNotams,
  useOperationDocuments, useDroneFormInvites,
  DRONE_DOC_CATEGORY_LABELS,
} from '@/lib/hooks/use-drone';
import { FormInviteModal } from './form-invite-modal';
import { SubmissionViewModal } from './submission-view-modal';

const STATUS_BADGE: Record<string, string> = {
  planned:     'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-50 text-red-500',
  aborted:     'bg-orange-100 text-orange-600',
};
const STATUS_HU: Record<string, string> = {
  planned: 'Tervezett', in_progress: 'Repülés', completed: 'Befejezett',
  cancelled: 'Törölve', aborted: 'Megszakítva',
};

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * A projekt-"szobához" linkelt repülés (DroneOperation) vezérlőpanele a jobb
 * oldali Sidebarba. Státusz + meta + állapot-átmenet gombok (a meglévő drone
 * API-val), NOTAM-ellenőrzés, és összecsukható Dokumentumok + Megrendelői űrlap
 * listák. A feltöltés/küldés/szerkesztés a /drone oldalon történik (link).
 *
 * A DroneOperation a légtér-domain forrása — a státusz itt él, NEM a
 * projekt adatlap-snapshotjában.
 */
export function DroneFlightPanel({
  operation: op, onChanged,
}: {
  operation: DroneOperation;
  onChanged: () => void;
}) {
  const [notams, setNotams] = useState<{ notams: any[]; warning?: string } | null>(null);
  const [notamsLoading, setNotamsLoading] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [formsOpen, setFormsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [viewingFormId, setViewingFormId] = useState<string | null>(null);

  const { documents } = useOperationDocuments(docsOpen ? op.id : null);
  const { invites, mutate: mutateInvites } = useDroneFormInvites(formsOpen ? op.id : null);

  const permitExpired = op.airspacePermitExpiry && new Date(op.airspacePermitExpiry) < new Date();

  async function handleTransition(action: 'start' | 'complete' | 'cancel' | 'abort') {
    try {
      await transitionDroneOperation(op.id, action);
      toast.success('Repülés állapota frissítve');
      onChanged();
    } catch (err: any) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message ?? 'Állapotváltás sikertelen';
      if (status === 400 && action === 'start' && /Hiányzó előfeltételek/i.test(message)) {
        if (confirm(`${message}\n\nMégis indítod? (csak admin)`)) {
          try {
            await transitionDroneOperation(op.id, action, { force: true });
            toast.warning('Repülés indítva — checklist felülírva');
            onChanged();
          } catch (e2: any) {
            toast.error(e2?.response?.data?.message ?? 'Indítás sikertelen');
          }
        }
        return;
      }
      toast.error(message);
    }
  }

  async function handleNotamCheck() {
    setNotamsLoading(true);
    try {
      const r = await fetchOperationNotams(op.id);
      setNotams(r);
      if (r.warning) toast.warning(r.warning);
      else if (r.notams.length === 0) toast.success('Nincs releváns NOTAM');
      else toast.warning(`${r.notams.length} NOTAM a területen`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'NOTAM lekérdezés sikertelen');
    } finally {
      setNotamsLoading(false);
    }
  }

  const btn = 'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition';

  return (
    <div className="space-y-3 text-sm">
      {/* Státusz */}
      <div className="flex items-center justify-between">
        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_BADGE[op.status] ?? 'bg-gray-100 text-gray-600')}>
          {STATUS_HU[op.status] ?? op.status}
        </span>
        <Link href="/drone" className="text-xs text-gray-400 hover:text-brand-600 flex items-center gap-0.5">
          Részletes kezelés <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Meta */}
      <div className="space-y-1 text-xs text-gray-600">
        {op.serialCode && <div className="flex justify-between"><span className="text-gray-400">Sorszám</span><span className="font-mono">{op.serialCode}</span></div>}
        <div className="flex justify-between"><span className="text-gray-400">Tervezett</span><span>{fmtDate(op.plannedDate)}</span></div>
        {op.flightTimeMin != null && <div className="flex justify-between"><span className="text-gray-400">Repült idő</span><span>{op.flightTimeMin} perc</span></div>}
        {op.airspacePermitNumber && (
          <div className="flex justify-between">
            <span className="text-gray-400">Légtér-eng.</span>
            <span className={clsx('font-mono', permitExpired && 'text-red-500')}>
              {op.airspacePermitNumber}{permitExpired ? ' ⚠ lejárt' : ''}
            </span>
          </div>
        )}
        {(op.locationAddress || op.location) && (
          <div className="flex justify-between gap-2"><span className="text-gray-400 shrink-0">Helyszín</span><span className="text-right">{op.locationAddress || op.location}</span></div>
        )}
      </div>

      {/* Akciók */}
      <div className="flex flex-wrap gap-1.5">
        {op.status === 'planned' && (
          <>
            <button type="button" onClick={() => handleTransition('start')} className={clsx(btn, 'bg-blue-600 text-white hover:bg-blue-700')}><Play className="w-3.5 h-3.5" /> Indít</button>
            <button type="button" onClick={() => handleTransition('cancel')} className={clsx(btn, 'border border-gray-200 text-gray-500 hover:bg-gray-50')}><X className="w-3.5 h-3.5" /> Lemondás</button>
          </>
        )}
        {op.status === 'in_progress' && (
          <>
            <button type="button" onClick={() => handleTransition('complete')} className={clsx(btn, 'bg-green-600 text-white hover:bg-green-700')}><Check className="w-3.5 h-3.5" /> Befejezés</button>
            <button type="button" onClick={() => handleTransition('abort')} className={clsx(btn, 'border border-orange-200 text-orange-600 hover:bg-orange-50')}><Ban className="w-3.5 h-3.5" /> Megszakít</button>
          </>
        )}
        {(op.status === 'planned' || op.status === 'in_progress') && (
          <button type="button" onClick={handleNotamCheck} disabled={notamsLoading} className={clsx(btn, 'border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50')}>
            <Radar className="w-3.5 h-3.5" /> {notamsLoading ? 'NOTAM…' : 'NOTAM'}
          </button>
        )}
      </div>
      {notams && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
          {notams.warning ? notams.warning : notams.notams.length === 0 ? 'Nincs releváns NOTAM a területen.' : `${notams.notams.length} NOTAM a területen.`}
        </div>
      )}

      {/* Dokumentumok */}
      <div className="border-t border-gray-100 pt-2">
        <button type="button" onClick={() => setDocsOpen(o => !o)} className="w-full flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900">
          <ChevronRight className={clsx('w-3.5 h-3.5 transition', docsOpen && 'rotate-90')} />
          <FileText className="w-3.5 h-3.5" /> Dokumentumok
        </button>
        {docsOpen && (
          <div className="mt-1.5 space-y-1 pl-5">
            {documents.length === 0 ? (
              <p className="text-xs text-gray-400">Nincs feltöltött dokumentum.</p>
            ) : documents.map(d => (
              <div key={d.id} className="flex items-center justify-between text-xs">
                <span className="truncate text-gray-600" title={d.fileName}>{DRONE_DOC_CATEGORY_LABELS[d.category] ?? d.category}</span>
                {d.downloadUrl && <a href={d.downloadUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline shrink-0 ml-2">Letöltés</a>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Megrendelői űrlap */}
      <div className="border-t border-gray-100 pt-2">
        <button type="button" onClick={() => setFormsOpen(o => !o)} className="w-full flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900">
          <ChevronRight className={clsx('w-3.5 h-3.5 transition', formsOpen && 'rotate-90')} />
          <Mail className="w-3.5 h-3.5" /> Megrendelői űrlap{invites.length > 0 && <span className="text-gray-400">({invites.length})</span>}
        </button>
        {formsOpen && (
          <div className="mt-1.5 space-y-1.5 pl-5">
            {invites.length === 0 ? (
              <p className="text-xs text-gray-400">Nincs kiküldött űrlap.</p>
            ) : invites.map(i => (
              <div key={i.id} className="flex items-center justify-between text-xs">
                <span className="truncate text-gray-600" title={i.recipientEmail}>{i.recipientName || i.recipientEmail || '—'}</span>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className="text-gray-400">{i.status}</span>
                  {i.status === 'submitted' && (
                    <button
                      type="button"
                      onClick={() => setViewingFormId(i.id)}
                      title="Beküldött űrlap megtekintése"
                      className="p-0.5 text-gray-400 hover:text-brand-600 rounded"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium pt-1"
            >
              <Send className="w-3 h-3" /> Új űrlap küldése
            </button>
          </div>
        )}
      </div>

      {inviteOpen && (
        <FormInviteModal
          operationId={op.id}
          onClose={() => setInviteOpen(false)}
          onCreated={() => { setInviteOpen(false); mutateInvites(); }}
        />
      )}

      {viewingFormId && (
        <SubmissionViewModal
          operationId={op.id}
          formId={viewingFormId}
          onClose={() => setViewingFormId(null)}
        />
      )}
    </div>
  );
}
