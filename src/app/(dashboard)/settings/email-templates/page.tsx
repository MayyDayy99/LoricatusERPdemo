'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import {
  Mail, CheckCircle2, AlertCircle,
  FileText, Briefcase, Receipt, HardHat, CalendarCheck, ClipboardList,
} from 'lucide-react';
import { useT } from '@/lib/hooks/use-t';

/* ── email template registry ────────────────────────────────────────────────── */

interface TemplateInfo {
  key: string;
  icon: React.ReactNode;
  envVar: string;
  dynamicData: string[];
}

const TEMPLATES: TemplateInfo[] = [
  {
    key: 'quote_sent',
    icon: <Receipt className="w-4 h-4" />,
    envVar: 'SENDGRID_QUOTE_TEMPLATE_ID',
    dynamicData: ['quoteNumber', 'customerName', 'totalAmount', 'currency', 'validUntil', 'pdfUrl'],
  },
  {
    key: 'quote_accepted',
    icon: <CheckCircle2 className="w-4 h-4" />,
    envVar: 'SENDGRID_QUOTE_ACCEPTED_TEMPLATE_ID',
    dynamicData: ['quoteNumber', 'customerName', 'totalAmount', 'currency'],
  },
  {
    key: 'invoice_sent',
    icon: <FileText className="w-4 h-4" />,
    envVar: 'SENDGRID_INVOICE_TEMPLATE_ID',
    dynamicData: ['invoiceNumber', 'customerName', 'totalAmount', 'currency', 'dueDate', 'pdfUrl'],
  },
  {
    key: 'invoice_overdue',
    icon: <AlertCircle className="w-4 h-4" />,
    envVar: 'SENDGRID_INVOICE_OVERDUE_TEMPLATE_ID',
    dynamicData: ['invoiceNumber', 'customerName', 'totalAmount', 'currency', 'dueDate', 'daysPastDue'],
  },
  {
    key: 'deal_won',
    icon: <Briefcase className="w-4 h-4" />,
    envVar: 'SENDGRID_DEAL_WON_TEMPLATE_ID',
    dynamicData: ['dealTitle', 'customerName', 'value', 'currency', 'assignedTo'],
  },
  {
    key: 'deal_lost',
    icon: <Briefcase className="w-4 h-4" />,
    envVar: 'SENDGRID_DEAL_LOST_TEMPLATE_ID',
    dynamicData: ['dealTitle', 'customerName', 'value', 'currency', 'reason'],
  },
  {
    key: 'work_order_completed',
    icon: <HardHat className="w-4 h-4" />,
    envVar: 'SENDGRID_WORK_ORDER_COMPLETED_TEMPLATE_ID',
    dynamicData: ['workOrderNumber', 'location', 'completedBy', 'completedAt'],
  },
  {
    key: 'work_order_signed_off',
    icon: <HardHat className="w-4 h-4" />,
    envVar: 'SENDGRID_WORK_ORDER_SIGNED_OFF_TEMPLATE_ID',
    dynamicData: ['workOrderNumber', 'location', 'signedBy', 'signedAt'],
  },
  {
    key: 'crm_task_assigned',
    icon: <ClipboardList className="w-4 h-4" />,
    envVar: 'SENDGRID_CRM_TASK_ASSIGNED_TEMPLATE_ID',
    dynamicData: ['taskTitle', 'assignedTo', 'dueDate', 'priority', 'dealTitle'],
  },
  {
    key: 'meeting_closed',
    icon: <CalendarCheck className="w-4 h-4" />,
    envVar: 'SENDGRID_MEETING_CLOSED_TEMPLATE_ID',
    dynamicData: ['meetingDate', 'participants', 'summary'],
  },
];

/* ── template card ──────────────────────────────────────────────────────────── */

function TemplateCard({ tpl }: { tpl: TemplateInfo }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  const label = (t.emailTemplates.events as Record<string, string>)[tpl.key] ?? tpl.key;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition"
      >
        <span className="text-brand-500">{tpl.icon}</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{tpl.envVar}</p>
        </div>
        <span className={clsx(
          'text-xs font-bold px-2 py-0.5 rounded-full',
          'bg-green-50 text-green-700',
        )}>
          {t.emailTemplates.configured}
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-4 pt-2 border-t border-gray-100 space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1.5">{t.emailTemplates.dynamicVars}</p>
            <div className="flex flex-wrap gap-1.5">
              {tpl.dynamicData.map(v => (
                <code key={v} className="text-xs font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                  {`{{${v}}}`}
                </code>
              ))}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">
              {t.emailTemplates.sendgridHint}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── main page ──────────────────────────────────────────────────────────────── */

export default function EmailTemplatesPage() {
  const t = useT();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.emailTemplates.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{t.emailTemplates.subtitle}</p>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <Mail className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">{t.emailTemplates.infoTitle}</p>
          <p className="text-blue-600 mt-1">{t.emailTemplates.infoDesc}</p>
        </div>
      </div>

      {/* Template list */}
      <div className="space-y-3">
        {TEMPLATES.map(tpl => (
          <TemplateCard key={tpl.key} tpl={tpl} />
        ))}
      </div>

      {/* Env vars reference */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-900">{t.emailTemplates.envTitle}</h2>
        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <pre className="text-xs text-green-400 font-mono leading-relaxed">
{`# .env — SendGrid konfiguráció
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=noreply@loricatus.hu

${TEMPLATES.map(tpl => `${tpl.envVar}=d-xxxxxxxx`).join('\n')}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
