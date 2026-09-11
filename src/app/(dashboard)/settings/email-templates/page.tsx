'use client';

import { useState, useMemo, useEffect } from 'react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import {
  Mail, CheckCircle2, Ban, Loader2, Send, RotateCcw, Save, Monitor, Smartphone,
  Receipt, FileText, Briefcase, HardHat, CalendarCheck, ClipboardList,
  Plane, Users, Cake, Gift, FileSignature, AlertTriangle, Share2, FileCheck,
} from 'lucide-react';
import {
  useMailTemplates,
  useMailTemplate,
  updateMailTemplate,
  resetMailTemplate,
  previewMailTemplate,
  type MailTemplateListItem,
  type TemplateCategory,
} from '@/lib/hooks/use-mail-templates';

/* ── icon / category label mapping ─────────────────────────────── */

const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  sales: 'Ajánlat / Számla / Deal',
  operations: 'Munkalap / Meeting / Feladat',
  lifecycle: 'Ügyfél-életciklus',
  drone: 'Drón-események',
  notifications: 'Emlékeztetők',
};

function iconFor(category: TemplateCategory, eventKey: string) {
  if (eventKey.startsWith('quote')) return <Receipt className="w-4 h-4" />;
  if (eventKey.startsWith('invoice')) return <FileText className="w-4 h-4" />;
  if (eventKey.startsWith('deal')) return <Briefcase className="w-4 h-4" />;
  if (eventKey.startsWith('contract')) return <FileSignature className="w-4 h-4" />;
  if (eventKey.startsWith('work_order')) return <HardHat className="w-4 h-4" />;
  if (eventKey === 'meeting.closed') return <CalendarCheck className="w-4 h-4" />;
  if (eventKey === 'crm_task.assigned') return <ClipboardList className="w-4 h-4" />;
  if (eventKey.startsWith('drone')) return <Plane className="w-4 h-4" />;
  if (eventKey === 'referral.invite') return <Gift className="w-4 h-4" />;
  if (eventKey === 'lifecycle.welcome' || eventKey === 'customer.check_in') return <Users className="w-4 h-4" />;
  if (eventKey === 'birthday') return <Cake className="w-4 h-4" />;
  if (eventKey.startsWith('share')) return <Share2 className="w-4 h-4" />;
  if (eventKey === 'document.ready_for_review') return <FileCheck className="w-4 h-4" />;
  if (category === 'notifications') return <AlertTriangle className="w-4 h-4" />;
  return <Mail className="w-4 h-4" />;
}

/* ── client-side interpolate — ugyanaz a szintaxis mint a szerveren ───────── */

function interpolateClient(str: string, vars: Record<string, unknown>): string {
  return str.replace(/{{\s*([\w.]+)\s*}}/g, (_m, key) => {
    const v = vars[key];
    if (v == null) return `{{${key}}}`; // ha nincs sample, hagyjuk meg placeholderként
    if (v instanceof Date) return v.toLocaleDateString('hu-HU');
    return String(v);
  });
}

/* ── editor panel (right side) ─────────────────────────────────── */

function TemplateEditor({
  eventKey,
  onSaved,
}: {
  eventKey: string;
  onSaved: () => void;
}) {
  const { template, isLoading, mutate } = useMailTemplate(eventKey);
  const [subject, setSubject] = useState<string | null>(null);
  const [htmlBody, setHtmlBody] = useState<string | null>(null);
  const [textBody, setTextBody] = useState<string | null>(null);
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [previewEmail, setPreviewEmail] = useState('');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Init on load — useEffect (nem useMemo!) mert setState-et hív
  useEffect(() => {
    if (template && subject === null) {
      setSubject(template.subject);
      setHtmlBody(template.htmlBody);
      setTextBody(template.textBody ?? '');
      setIsActive(template.isActive);
    }
  }, [template, subject]);

  // Sample-adatok + live preview — early return ELŐTT (React hooks-szabály)
  const sampleParams: Record<string, unknown> = useMemo(
    () => Object.fromEntries((template?.variables ?? []).map((v) => [v.key, v.sample])),
    [template?.variables],
  );
  const livePreview = useMemo(() => ({
    subject: interpolateClient(subject ?? '', sampleParams),
    html: interpolateClient(htmlBody ?? '', sampleParams),
    text: interpolateClient(textBody ?? '', sampleParams),
  }), [subject, htmlBody, textBody, sampleParams]);

  if (isLoading || !template) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const dirty =
    subject !== template.subject ||
    htmlBody !== template.htmlBody ||
    (textBody ?? '') !== (template.textBody ?? '') ||
    isActive !== template.isActive;

  const save = async () => {
    if (!subject || !htmlBody) return;
    setSaving(true);
    try {
      await updateMailTemplate(eventKey, {
        subject,
        htmlBody,
        textBody: textBody || undefined,
        isActive: isActive ?? true,
      });
      toast.success('Sablon elmentve');
      await mutate();
      onSaved();
    } catch (e) {
      toast.error(`Mentés sikertelen: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm('Biztos, hogy visszaállítod az alapértelmezett sablonra? Az egyedi módosításaid elvesznek.')) return;
    setResetting(true);
    try {
      await resetMailTemplate(eventKey);
      toast.success('Alapértelmezett sablon visszaállítva');
      setSubject(null);
      setHtmlBody(null);
      setTextBody(null);
      setIsActive(null);
      await mutate();
      onSaved();
    } catch (e) {
      toast.error(`Visszaállítás sikertelen: ${(e as Error).message}`);
    } finally {
      setResetting(false);
    }
  };

  const sendPreview = async () => {
    if (dirty) {
      toast.error('Előbb mentsd el a változtatásokat!');
      return;
    }
    try {
      const res = await previewMailTemplate(eventKey, previewEmail ? { recipientEmail: previewEmail } : {});
      toast.success(`Teszt-email elküldve: ${res.sentTo}`);
    } catch (e) {
      toast.error(`Küldés sikertelen: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{template.label}</h2>
        <p className="text-sm text-gray-500 mt-1">{template.description}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-600">
            {template.eventKey}
          </span>
          {template.hasOverride ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium">
              Egyedi sablon
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
              Alapértelmezett
            </span>
          )}
        </div>
      </div>

      {/* Aktív kapcsoló */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isActive ?? true}
          onChange={(e) => setIsActive(e.target.checked)}
          className="w-4 h-4"
        />
        <span className="text-sm font-medium text-gray-900">
          Aktív {isActive === false && <span className="text-red-600">(letiltva — nem küldjük ki)</span>}
        </span>
      </label>

      {/* Változó-lista */}
      {template.variables.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-800 mb-2">
            Használható változók (kattints, hogy vágólapra másold):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {template.variables.map((v) => (
              <button
                key={v.key}
                onClick={() => {
                  navigator.clipboard.writeText(`{{${v.key}}}`);
                  toast.info(`Másolva: {{${v.key}}}`);
                }}
                className="text-xs font-mono px-2 py-0.5 rounded bg-white border border-blue-200 text-blue-800 hover:bg-blue-100 transition"
                title={v.label}
              >
                {`{{${v.key}}}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tárgy */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tárgy</label>
        <input
          type="text"
          value={subject ?? ''}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
        />
      </div>

      {/* HTML törzs + LIVE ELŐNÉZET (split view lg+ képernyőn) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Bal: HTML szerkesztő */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">HTML-törzs</label>
          <textarea
            value={htmlBody ?? ''}
            onChange={(e) => setHtmlBody(e.target.value)}
            rows={20}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-brand-500 focus:border-brand-500 h-[500px]"
          />
        </div>

        {/* Jobb: live preview */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Élő előnézet <span className="text-gray-400 font-normal">(sample-adatokkal)</span>
            </label>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                className={clsx(
                  'p-1.5 rounded text-xs flex items-center gap-1 transition',
                  previewDevice === 'desktop'
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                )}
                title="Desktop nézet"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                className={clsx(
                  'p-1.5 rounded text-xs flex items-center gap-1 transition',
                  previewDevice === 'mobile'
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                )}
                title="Mobil nézet (375px)"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="border border-gray-300 rounded-lg overflow-hidden bg-white h-[500px] flex flex-col">
            {/* Email fejléc szimuláció */}
            <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 text-xs space-y-0.5">
              <div className="flex gap-2">
                <span className="text-gray-500 w-14 shrink-0">Feladó:</span>
                <span className="text-gray-800 truncate">DIMOP &lt;noreply@dimop.hu&gt;</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 w-14 shrink-0">Tárgy:</span>
                <span className="text-gray-900 font-semibold truncate">
                  {livePreview.subject || <em className="text-gray-400 font-normal">(üres)</em>}
                </span>
              </div>
            </div>
            {/* Iframe wrapper — mobil szimulációhoz center + max-width */}
            <div className={clsx(
              'flex-1 overflow-auto bg-gray-100 flex justify-center',
              previewDevice === 'mobile' && 'py-2',
            )}>
              <iframe
                srcDoc={livePreview.html || '<p style="color:#999;font-family:sans-serif;padding:20px">Nincs HTML-tartalom</p>'}
                className={clsx(
                  'bg-white transition-all',
                  previewDevice === 'desktop' ? 'w-full h-full' : 'w-[375px] h-full border border-gray-300 rounded shadow-sm',
                )}
                sandbox=""
                title="live-preview"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Text fallback */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Plain-text változat <span className="text-gray-400 font-normal">(opcionális)</span>
        </label>
        <textarea
          value={textBody ?? ''}
          onChange={(e) => setTextBody(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
        />
        {textBody && (
          <details className="mt-1">
            <summary className="text-xs text-brand-600 cursor-pointer hover:underline">Plain-text előnézet (interpolálva)</summary>
            <pre className="mt-1 text-xs bg-gray-50 border border-gray-200 rounded p-2 whitespace-pre-wrap font-mono text-gray-700">{livePreview.text}</pre>
          </details>
        )}
      </div>

      {/* Gombsor */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className={clsx(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition',
            dirty
              ? 'bg-brand-500 text-white hover:bg-brand-600'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed',
          )}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Mentés
        </button>

        {template.hasOverride && (
          <button
            onClick={reset}
            disabled={resetting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition"
          >
            {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Visszaáll. defaultra
          </button>
        )}

        <div className="flex-1" />

        <input
          type="email"
          placeholder="teszt@email.hu (opcionális)"
          value={previewEmail}
          onChange={(e) => setPreviewEmail(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-56"
        />
        <button
          onClick={sendPreview}
          disabled={dirty}
          className={clsx(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition',
            dirty
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-emerald-500 text-white hover:bg-emerald-600',
          )}
          title={dirty ? 'Előbb mentsd el a változtatásokat' : 'Küldj magadnak egy tesztet'}
        >
          <Send className="w-4 h-4" />
          Teszt-küldés
        </button>
      </div>
    </div>
  );
}

/* ── main page: 2-oszlopos ─────────────────────────────────────── */

export default function EmailTemplatesPage() {
  const { templates, isLoading, mutate } = useMailTemplates();
  const [selected, setSelected] = useState<string | null>(null);

  // Kategóriák szerint csoportosítva
  const grouped = useMemo(() => {
    const byCat = new Map<TemplateCategory, MailTemplateListItem[]>();
    for (const t of templates) {
      if (!byCat.has(t.category)) byCat.set(t.category, []);
      byCat.get(t.category)!.push(t);
    }
    return byCat;
  }, [templates]);

  const categoryOrder: TemplateCategory[] = ['sales', 'operations', 'notifications', 'lifecycle', 'drone'];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email-sablonok</h1>
        <p className="text-sm text-gray-500 mt-1">
          A tenant összes email-értesítés HTML-tartalma. Szerkeszd egyedire vagy állítsd
          vissza a Git-ben lévő alapértelmezettre. A változókat <code className="text-xs bg-gray-100 px-1 rounded">{`{{var}}`}</code> szintaxissal használd.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
          {/* Bal: lista */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {categoryOrder
              .filter((cat) => grouped.has(cat))
              .map((cat) => (
                <div key={cat}>
                  <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {CATEGORY_LABEL[cat]}
                  </div>
                  {grouped.get(cat)!.map((tpl) => (
                    <button
                      key={tpl.eventKey}
                      onClick={() => setSelected(tpl.eventKey)}
                      className={clsx(
                        'w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition',
                        selected === tpl.eventKey && 'bg-brand-50 hover:bg-brand-50',
                      )}
                    >
                      <span className={clsx(
                        'shrink-0',
                        selected === tpl.eventKey ? 'text-brand-600' : 'text-gray-400',
                      )}>
                        {iconFor(tpl.category, tpl.eventKey)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={clsx(
                          'truncate font-medium',
                          selected === tpl.eventKey ? 'text-brand-800' : 'text-gray-900',
                        )}>
                          {tpl.label}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {tpl.hasOverride && (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-500" title="Egyedi sablon" />
                        )}
                        {!tpl.isActive && (
                          <Ban className="w-3.5 h-3.5 text-red-500" />
                        )}
                        {tpl.isActive && tpl.hasOverride && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
          </div>

          {/* Jobb: editor */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            {selected ? (
              <TemplateEditor key={selected} eventKey={selected} onSaved={mutate} />
            ) : (
              <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                <Mail className="w-12 h-12 mb-3" />
                <p className="text-sm">Válassz egy sablont a szerkesztéshez</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
