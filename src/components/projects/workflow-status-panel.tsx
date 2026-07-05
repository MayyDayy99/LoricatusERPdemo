'use client';

import type { ProjectWorkflowState } from '@/lib/hooks/use-project-workflow';

type StepStatus = 'done' | 'progress' | 'pending';

interface Step {
  key: string;
  label: string;
  status: StepStatus;
  detail?: string;
  href?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
}

function StatusBadge({ status }: { status: StepStatus }) {
  const map = {
    done:     { bg: '#dcfce7', fg: '#15803d', icon: '✓', label: 'KÉSZ' },
    progress: { bg: '#fef3c7', fg: '#a16207', icon: '⏳', label: 'FOLYAMATBAN' },
    pending:  { bg: '#f3f4f6', fg: '#6b7280', icon: '⬜', label: 'MÉG NINCS' },
  } as const;
  const s = map[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      background: s.bg, color: s.fg,
      fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
      textTransform: 'uppercase',
    }}>
      <span>{s.icon}</span>
      <span>{s.label}</span>
    </span>
  );
}

/**
 * 5 lépéses workflow-vizualizáció a ProjectModal Áttekintés-tab tetején.
 * Lépések: Árajánlat → Munkalap → Task-ok → Számla → Jutalék.
 *
 * A `onGenerateTasks` callback a Task-ok lépés "Generálás" gombját köti
 * a WO-detail oldalon definiált GenerateTasksModal-hoz (vagy navigál oda).
 */
export function WorkflowStatusPanel({
  state,
  onNavigate,
  onGenerateTasks,
}: {
  state: ProjectWorkflowState | null;
  onNavigate: (href: string) => void;
  onGenerateTasks?: () => void;
}) {
  if (!state) return null;

  const quoteStatus: StepStatus = (() => {
    if (!state.quote) return 'pending';
    if (state.quote.state === 'accepted') return 'done';
    if (state.quote.state === 'sent') return 'progress';
    return 'pending';
  })();

  const woStatus: StepStatus = (() => {
    if (!state.workOrder) return 'pending';
    return state.workOrder.itemCount > 0 ? 'done' : 'progress';
  })();

  const taskStatus: StepStatus = (() => {
    if (!state.workOrder) return 'pending';
    if (state.workOrder.itemCount === 0) return 'pending';
    if (state.workOrder.taskCount === 0) return 'progress';
    return state.workOrder.taskCount >= state.workOrder.itemCount ? 'done' : 'progress';
  })();

  const invoiceStatus: StepStatus = (() => {
    if (!state.invoice) return 'pending';
    if (state.invoice.state === 'paid') return 'done';
    if (['sent', 'partially_paid', 'overdue'].includes(state.invoice.state)) return 'progress';
    return 'pending';
  })();

  const commissionStatus: StepStatus = (() => {
    if (!state.commission) return 'pending';
    if (state.commission.status === 'paid') return 'done';
    if (['earned', 'payable'].includes(state.commission.status)) return 'progress';
    if (state.commission.status === 'lost') return 'pending';
    return 'pending';
  })();

  const steps: Step[] = [
    {
      key: 'quote',
      label: 'Árajánlat',
      status: quoteStatus,
      detail: state.quote ? quoteLabel(state.quote.state) : 'Nincs árajánlat',
      href: state.quote ? `/crm/quotes?id=${state.quote.id}` : '/crm/quotes',
      ctaLabel: state.quote ? 'Megnyitás' : 'Új árajánlat',
    },
    {
      key: 'workOrder',
      label: 'Munkalap',
      status: woStatus,
      detail: state.workOrder
        ? `${state.workOrder.itemCount} tétel · ${woLabel(state.workOrder.state)}`
        : 'Nincs munkalap (árajánlat ACCEPTED-re vált → auto-létrehozás)',
      href: state.workOrder ? `/work-orders/${state.workOrder.id}` : undefined,
      ctaLabel: state.workOrder ? 'Megnyitás' : undefined,
    },
    {
      key: 'tasks',
      label: 'Task-ok',
      status: taskStatus,
      detail: state.workOrder
        ? `${state.workOrder.taskCount} / ${state.workOrder.itemCount} generálva`
        : 'Várja a munkalapot',
      href: state.workOrder ? `/work-orders/${state.workOrder.id}` : undefined,
      ctaLabel: state.workOrder && taskStatus !== 'done' ? 'Generálás' : undefined,
      onCtaClick: state.workOrder && taskStatus !== 'done' ? onGenerateTasks : undefined,
    },
    {
      key: 'invoice',
      label: 'Számla',
      status: invoiceStatus,
      detail: state.invoice ? invoiceLabel(state.invoice.state) : 'Még nincs',
      href: state.invoice ? `/crm/invoices?id=${state.invoice.id}` : '/crm/invoices',
      ctaLabel: state.invoice ? 'Megnyitás' : undefined,
    },
    {
      key: 'commission',
      label: 'Jutalék',
      status: commissionStatus,
      detail: state.commission ? commissionLabel(state.commission.status) : 'Még nincs',
      href: `/jutalek`,
      ctaLabel: state.commission ? 'Megnyitás' : undefined,
    },
  ];

  return (
    <div style={{
      background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8,
      padding: 12, marginBottom: 16,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: '#6b7280',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
      }}>
        Munkafolyamat
      </div>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {steps.map(step => (
          <li key={step.key} style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(100px, max-content) max-content 1fr max-content',
            alignItems: 'center', gap: 8,
            padding: '6px 8px', background: 'white', borderRadius: 6,
            border: '1px solid #e5e7eb',
          }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{step.label}</span>
            <StatusBadge status={step.status} />
            <span style={{ fontSize: 12, color: '#6b7280' }}>{step.detail}</span>
            {step.ctaLabel ? (
              <button
                type="button"
                onClick={() => {
                  if (step.onCtaClick) step.onCtaClick();
                  else if (step.href) onNavigate(step.href);
                }}
                style={{
                  padding: '3px 10px', fontSize: 11, fontWeight: 600,
                  border: '1px solid #2563eb', borderRadius: 4,
                  background: '#eff6ff', color: '#2563eb', cursor: 'pointer',
                }}
              >
                {step.ctaLabel} →
              </button>
            ) : <span />}
          </li>
        ))}
      </ol>
    </div>
  );
}

function quoteLabel(s: string): string {
  return s === 'draft' ? 'Piszkozat' :
         s === 'sent' ? 'Elküldve' :
         s === 'accepted' ? 'Elfogadva' :
         s === 'rejected' ? 'Elutasítva' :
         s === 'expired' ? 'Lejárt' : s;
}

function woLabel(s: string): string {
  return s === 'draft' ? 'Piszkozat' :
         s === 'active' ? 'Aktív' :
         s === 'completed' ? 'Befejezve' :
         s === 'archived' ? 'Archív' :
         s === 'cancelled' ? 'Visszavonva' : s;
}

function invoiceLabel(s: string): string {
  return s === 'draft' ? 'Piszkozat' :
         s === 'sent' ? 'Kiküldve' :
         s === 'paid' ? 'Kifizetve' :
         s === 'partially_paid' ? 'Részben fizetve' :
         s === 'overdue' ? 'Lejárt' : s;
}

function commissionLabel(s: string): string {
  return s === 'pending' ? 'Várólistán' :
         s === 'earned' ? 'Megszerezve' :
         s === 'payable' ? 'Kifizethető' :
         s === 'paid' ? 'Kifizetve' :
         s === 'lost' ? 'Elveszett' : s;
}
