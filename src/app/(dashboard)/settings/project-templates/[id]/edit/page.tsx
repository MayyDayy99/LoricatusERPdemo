'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Save, Plus, Trash2, ChevronUp, ChevronDown, Loader2,
  ChevronRight, Info, X, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import {
  useProjectTemplate, updateProjectTemplate,
  type ProjectTemplateInput, type ProjectTemplateStep, type ProjectTemplateStepType,
  type ProjectTemplateAnchorKind, type ProjectTemplateOffsetUnit, type ProjectTemplateOffsetDirection,
} from '@/lib/hooks/use-project-templates';
import { useTaskTypes, type TaskType } from '@/lib/hooks/use-task-types';
import { useUsers, type User } from '@/lib/hooks/use-users';
import { useWorksheetTemplates, type WorksheetTemplate } from '@/lib/hooks/use-worksheet-templates';
import { useDashboardOverview, type DashboardEquipment } from '@/lib/hooks/use-dashboard';

/* ── Step-type metadata: ikon + magyar címke + scoped form-spec ─────── */
const STEP_TYPES: Array<{
  value: ProjectTemplateStepType;
  icon: string;
  label: string;
  description: string;
  // Mely mezőket mutassuk a form-ban (scoped form per type)
  fields: {
    duration?: boolean;
    durationFixedUnit?: ProjectTemplateOffsetUnit;
    taskType?: boolean;
    assignee?: boolean;
    helpers?: boolean;
    equipment?: boolean;
    worksheetTemplate?: boolean;
    notification?: boolean;
    deadlineLabel?: boolean;
    dependsOn?: boolean;
    laneIndex?: boolean;
  };
}> = [
  { value: 'task',            icon: '📋', label: 'Feladat',           description: 'Munkavégzés a Gantt-on (pl. terep, iroda)',
    fields: { duration: true, taskType: true, assignee: true, helpers: true, equipment: true, dependsOn: true, laneIndex: true } },
  { value: 'work_order',      icon: '📄', label: 'Munkalap',          description: 'Munkalap generálása sablonból',
    fields: { worksheetTemplate: true, notification: true, dependsOn: true } },
  { value: 'legter_range',    icon: '🟦', label: 'Légtér-időszak',    description: 'Kék légtér-sáv a Gantt-on',
    fields: { duration: true, durationFixedUnit: 'calendar' } },
  { value: 'deadline_marker', icon: '🔴', label: 'Határidő',          description: 'Piros vonal egy adott napon, felelőssel',
    fields: { deadlineLabel: true, assignee: true } },
  { value: 'notification',    icon: '🔔', label: 'Értesítés',          description: 'In-app + push értesítés',
    fields: { notification: true } },
  { value: 'reminder',        icon: '⏰', label: 'Emlékeztető',        description: 'Időzített emlékeztető (általában nagyobb késleltetéssel)',
    fields: { notification: true } },
];

/* ── Anchor opciók friendly labelekkel ────────────────────────────── */
const ANCHOR_OPTIONS: Array<{ value: ProjectTemplateAnchorKind; label: string }> = [
  { value: 'project_created',  label: '⏱ a projekt létrehozásakor' },
  { value: 'template_input',   label: '📅 egy felhasználói paraméter dátumtól' },
  { value: 'step_start',       label: '▶ egy korábbi lépés kezdetétől' },
  { value: 'step_end',         label: '⏹ egy korábbi lépés végétől' },
  { value: 'range_workday_n',  label: '📅 egy korábbi lépés N. munkanapján' },
];

const UNIT_LABELS: Record<ProjectTemplateOffsetUnit, string> = {
  calendar: 'naptári nap',
  working:  'munkanap',
  hours:    'óra',
};
const DIRECTION_LABELS: Record<ProjectTemplateOffsetDirection, string> = {
  after:  'után',
  before: 'előtt',
  on:     'pontosan akkor',
};

const INPUT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'date',     label: '📅 Dátum' },
  { value: 'datetime', label: '🕐 Dátum + idő' },
  { value: 'user',     label: '👤 Felhasználó' },
  { value: 'text',     label: '💬 Szöveg' },
];

/* ── Magyar slug-generálás a label-ből az inputKey-hez ──────────────── */
function slugifyHu(s: string): string {
  return s
    .toLowerCase()
    .replace(/[áàâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
    .replace(/[óòôöő]/g, 'o').replace(/[úùûüű]/g, 'u')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50) || 'input';
}

/* ── Természetes nyelvi anchor-leírás (timeline-summary-hez) ────────── */
function humanizeAnchor(
  step: ProjectTemplateStep,
  inputs: ProjectTemplateInput[],
  steps: ProjectTemplateStep[],
): string {
  const refStep = step.anchorStepSortIndex != null
    ? steps.find(s => s.sortIndex === step.anchorStepSortIndex)
    : undefined;
  const refInput = step.anchorInputKey
    ? inputs.find(i => i.inputKey === step.anchorInputKey)
    : undefined;
  const offsetValue = Number(step.offsetValue ?? 0);
  const dir = (step.offsetDirection ?? 'after') as ProjectTemplateOffsetDirection;
  const unit = (step.offsetUnit ?? 'calendar') as ProjectTemplateOffsetUnit;

  const offsetPart = offsetValue > 0 && dir !== 'on'
    ? `${offsetValue} ${UNIT_LABELS[unit]} ${DIRECTION_LABELS[dir]}`
    : '';

  switch (step.anchorKind) {
    case 'project_created':
      return offsetPart ? `${offsetPart} a projekt létrehozásától` : 'A projekt létrehozásakor';
    case 'template_input':
      return offsetPart
        ? `${offsetPart} a "${refInput?.label ?? step.anchorInputKey}" paramétertől`
        : `A "${refInput?.label ?? step.anchorInputKey}" paraméter napján`;
    case 'step_start':
      return offsetPart
        ? `${offsetPart} a(z) "${refStep?.name ?? `#${step.anchorStepSortIndex}`}" kezdete óta`
        : `A(z) "${refStep?.name ?? `#${step.anchorStepSortIndex}`}" kezdetével egyszerre`;
    case 'step_end':
      return offsetPart
        ? `${offsetPart} a(z) "${refStep?.name ?? `#${step.anchorStepSortIndex}`}" végétől`
        : `A(z) "${refStep?.name ?? `#${step.anchorStepSortIndex}`}" végével egyszerre`;
    case 'range_workday_n':
      return `A(z) "${refStep?.name ?? `#${step.anchorStepSortIndex}`}" ${step.anchorWorkdayN ?? 1}. munkanapján`;
    default:
      return '';
  }
}

/* ── Lépés egysoros összefoglalója a collapsed nézethez ─────────────── */
function humanizeStep(
  step: ProjectTemplateStep,
  inputs: ProjectTemplateInput[],
  steps: ProjectTemplateStep[],
  users: User[],
  taskTypes: TaskType[],
): string {
  const parts: string[] = [];
  parts.push(humanizeAnchor(step, inputs, steps));

  if (step.durationValue && step.durationValue > 0) {
    const unit = (step.durationUnit ?? 'calendar') as ProjectTemplateOffsetUnit;
    parts.push(`${step.durationValue} ${UNIT_LABELS[unit]}`);
  }
  if (step.assigneeId) {
    const u = users.find(x => x.id === step.assigneeId);
    if (u) parts.push(`${u.lastName} ${u.firstName}`);
  }
  if (step.stepType === 'task' && step.taskType) {
    const tt = taskTypes.find(t => t.value === step.taskType);
    if (tt) parts.push(`(${tt.label})`);
  }
  if (step.stepType === 'notification' || step.stepType === 'reminder') {
    if (step.notificationRecipientId) {
      const u = users.find(x => x.id === step.notificationRecipientId);
      if (u) parts.push(`→ ${u.lastName} ${u.firstName}`);
    }
  }
  return parts.filter(Boolean).join(' · ');
}

/* ══════════════════════════════════════════════════════════════════════
   FŐ OLDAL
   ══════════════════════════════════════════════════════════════════════ */
export default function ProjectTemplateEditPage() {
  const { id } = useParams<{ id: string }>();
  const { template, isLoading, mutate } = useProjectTemplate(id ?? null);

  // Cross-tab freshness: a hookok SWR-kulcsai globálisak, az admin-oldali
  // mentések automatikusan revalidálják ezeket az oldalt is.
  const { taskTypes: taskTypesRaw } = useTaskTypes();
  const taskTypes: TaskType[] = taskTypesRaw ?? [];
  const { users } = useUsers();
  const { templates: worksheetTemplatesRaw } = useWorksheetTemplates();
  const worksheetTemplates: WorksheetTemplate[] = worksheetTemplatesRaw ?? [];
  const { overview } = useDashboardOverview();
  const equipment: DashboardEquipment[] = overview?.equipment ?? [];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');
  const [inputs, setInputs] = useState<ProjectTemplateInput[]>([]);
  const [steps, setSteps] = useState<ProjectTemplateStep[]>([]);
  const [openStep, setOpenStep] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [showAddStepPicker, setShowAddStepPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description ?? '');
      setColor(template.color ?? '');
      setInputs(template.inputs.map(i => ({ ...i })));
      setSteps([...template.steps].sort((a, b) => a.sortIndex - b.sortIndex).map(s => ({ ...s })));
    }
  }, [template]);

  async function save() {
    if (!name.trim()) { toast.error('A sablon neve kötelező'); return; }
    setSaving(true);
    try {
      // sortIndex normalizálás: inputs 0..N-1, steps 1..N. A step-anchor-stepIndex
      // és depends-on referenciák a sorrend változása miatt frissülnek.
      const oldStepIndexById = new Map<number, number>(); // régi sortIndex → új sortIndex
      steps.forEach((s, idx) => oldStepIndexById.set(s.sortIndex, idx + 1));
      const remap = (n: number | undefined): number | undefined => {
        if (n == null) return undefined;
        return oldStepIndexById.get(n) ?? n;
      };
      // A backend DTO whitelist + forbidNonWhitelisted miatt csak a megengedett
      // mezőket küldhetjük (id/templateId/createdAt/updatedAt elutasítva).
      const renumberedInputs = inputs.map((i, idx) => ({
        inputKey: i.inputKey,
        label: i.label,
        inputType: i.inputType,
        required: i.required,
        sortIndex: idx,
      }));
      const renumberedSteps = steps.map((s, idx) => ({
        sortIndex: idx + 1,
        stepType: s.stepType,
        name: s.name,
        description: s.description,
        anchorKind: s.anchorKind,
        anchorInputKey: s.anchorInputKey,
        anchorStepSortIndex: remap(s.anchorStepSortIndex),
        anchorWorkdayN: s.anchorWorkdayN,
        offsetValue: s.offsetValue,
        offsetUnit: s.offsetUnit,
        offsetDirection: s.offsetDirection,
        durationValue: s.durationValue,
        durationUnit: s.durationUnit,
        taskType: s.taskType,
        equipmentIds: s.equipmentIds,
        assigneeId: s.assigneeId,
        assigneeEditable: s.assigneeEditable,
        helperIds: s.helperIds,
        worksheetTemplateId: s.worksheetTemplateId,
        notificationRecipientId: s.notificationRecipientId,
        notificationTitle: s.notificationTitle,
        notificationBody: s.notificationBody,
        deadlineLabel: s.deadlineLabel,
        dayAnnotationType: s.dayAnnotationType,
        dependsOnStepSortIndex: remap(s.dependsOnStepSortIndex),
        laneIndex: (s as any).laneIndex ?? null,
        config: s.config,
      }));
      await updateProjectTemplate(id!, {
        name: name.trim(),
        description: description.trim() || undefined,
        color: color || undefined,
        inputs: renumberedInputs,
        steps: renumberedSteps,
      });
      toast.success('Sablon mentve');
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Mentés sikertelen');
    } finally {
      setSaving(false);
    }
  }

  /* ── Inputs CRUD ─────────────────────────────────────────────────── */
  function addInput() {
    const nextNo = inputs.length + 1;
    setInputs(prev => [...prev, {
      inputKey: `parameter_${nextNo}`,
      label: `Új paraméter ${nextNo}`,
      inputType: 'date',
      required: true,
      sortIndex: prev.length,
    }]);
  }
  function updateInput(idx: number, patch: Partial<ProjectTemplateInput>) {
    setInputs(prev => prev.map((i, n) => {
      if (n !== idx) return i;
      const next = { ...i, ...patch };
      // Auto-slug: ha a label változik és a inputKey még az alapértelmezett
      // (vagy a régi label-slugja), generálódjon új kulcs. Haladó toggle alatt
      // a felhasználó kézzel írhatja felül.
      if ('label' in patch && !showAdvanced) {
        const proposed = slugifyHu(next.label);
        // Ütközés-elkerülés: ha másik input ugyanezt használja, számozzunk
        let unique = proposed;
        let suffix = 2;
        while (inputs.some((other, oi) => oi !== idx && other.inputKey === unique)) {
          unique = `${proposed}_${suffix++}`;
        }
        next.inputKey = unique;
      }
      return next;
    }));
  }
  function removeInput(idx: number) {
    setInputs(prev => prev.filter((_, n) => n !== idx));
  }

  /* ── Steps CRUD ──────────────────────────────────────────────────── */
  function addStep(type: ProjectTemplateStepType) {
    const meta = STEP_TYPES.find(t => t.value === type)!;
    const nextSort = steps.length + 1;
    setSteps(prev => [...prev, {
      sortIndex: nextSort,
      stepType: type,
      name: `${meta.label} #${nextSort}`,
      anchorKind: 'project_created',
      offsetValue: 0,
      offsetUnit: 'calendar',
      offsetDirection: 'after',
      ...(meta.fields.duration ? {
        durationValue: 1,
        durationUnit: meta.fields.durationFixedUnit ?? 'working',
      } : {}),
      ...(meta.fields.taskType ? { taskType: taskTypes[0]?.value ?? 'todo' } : {}),
      equipmentIds: [],
      helperIds: [],
    } as ProjectTemplateStep]);
    setOpenStep(steps.length);
    setShowAddStepPicker(false);
  }
  function updateStep(idx: number, patch: Partial<ProjectTemplateStep>) {
    setSteps(prev => prev.map((s, n) => n === idx ? { ...s, ...patch } : s));
  }
  function removeStep(idx: number) {
    setSteps(prev => prev.filter((_, n) => n !== idx));
    setOpenStep(null);
  }
  function moveStep(idx: number, dir: -1 | 1) {
    setSteps(prev => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    if (openStep === idx) setOpenStep(idx + dir);
  }

  if (isLoading || !template) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur -mx-4 px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/meeting/admin" className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Sablon szerkesztése</h1>
        </div>
        <button
          onClick={save} disabled={saving}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 shadow-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Mentés
        </button>
      </div>

      {/* Útmutató */}
      {showHelp && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-blue-900">
            <p className="font-semibold mb-1">Hogyan működik a sablon?</p>
            <p>
              A sablonból generált projekt összes lépése a <strong>felhasználói paraméterek</strong> (pl. légtér kezdő dátum)
              és a <strong>lépés-közi időzítés</strong> alapján kerül a Gantt-ra. Minden lépés egy időpont vagy időszak,
              és hivatkozhat korábbi lépésekre (pl. <em>„X lépés vége után 2 munkanappal"</em>).
            </p>
          </div>
          <button onClick={() => setShowHelp(false)} className="text-blue-400 hover:text-blue-600 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sablon alapadatok */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800 mb-1">Alapadatok</h2>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Sablon neve *</label>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={200}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Leírás</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-gray-600">Szín:</label>
          <input type="color" value={color || '#94a3b8'} onChange={e => setColor(e.target.value)}
            className="h-8 w-12 border border-gray-200 rounded cursor-pointer" />
          {color && <button onClick={() => setColor('')} className="text-xs text-gray-400 hover:text-gray-700">törlés</button>}
          <div className="flex-1" />
          <label className="text-xs text-gray-500 inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showAdvanced} onChange={e => setShowAdvanced(e.target.checked)} />
            Haladó mód (kulcsok megjelenítése)
          </label>
        </div>
      </div>

      {/* Felhasználói paraméterek */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Felhasználói paraméterek</h2>
            <p className="text-xs text-gray-500 mt-0.5">Új projekt létrehozásakor a felhasználó ezeket tölti ki.</p>
          </div>
          <button onClick={addInput} className="text-xs text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Hozzáad
          </button>
        </div>
        {inputs.length === 0 && (
          <p className="text-xs text-gray-400 italic py-2">
            Nincs paraméter. Akkor érdemes hozzáadni, ha egy lépés egy felhasználói dátumtól függ (pl. „légtér kezdete").
          </p>
        )}
        <div className="space-y-2">
          {inputs.map((inp, idx) => (
            <div key={idx} className="flex gap-2 items-center flex-wrap p-2 rounded-lg border border-gray-100 bg-gray-50/50">
              <input
                value={inp.label}
                onChange={e => updateInput(idx, { label: e.target.value })}
                placeholder="Címke (pl. Légtér kezdő dátum)"
                className="flex-1 min-w-[160px] border border-gray-200 rounded px-2 py-1.5 text-sm bg-white"
              />
              <select
                value={inp.inputType ?? 'date'}
                onChange={e => updateInput(idx, { inputType: e.target.value as any })}
                className="border border-gray-200 rounded px-2 py-1.5 text-sm bg-white"
              >
                {INPUT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <label className="text-xs text-gray-600 inline-flex items-center gap-1.5">
                <input type="checkbox" checked={inp.required ?? true} onChange={e => updateInput(idx, { required: e.target.checked })} />
                Kötelező
              </label>
              {showAdvanced && (
                <input
                  value={inp.inputKey}
                  onChange={e => updateInput(idx, { inputKey: e.target.value })}
                  placeholder="kulcs"
                  className="w-36 border border-gray-200 rounded px-2 py-1.5 text-xs font-mono bg-white"
                />
              )}
              <button onClick={() => removeInput(idx)} className="text-gray-400 hover:text-red-600 p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Lépések */}
      <div className="bg-white border border-gray-100 rounded-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Lépések ({steps.length})</h2>
        </div>
        {steps.length === 0 && !showAddStepPicker && (
          <div className="p-10 text-center text-sm text-gray-400">
            Még nincs lépés. Kattints a „Új lépés" gombra lent.
          </div>
        )}
        <div className="divide-y divide-gray-100">
          {steps.map((step, idx) => {
            const meta = STEP_TYPES.find(t => t.value === step.stepType) ?? STEP_TYPES[0];
            const summary = humanizeStep(step, inputs, steps, users, taskTypes);
            const isOpen = openStep === idx;
            return (
              <div key={idx}>
                <div
                  className="flex items-center gap-2 px-5 py-3 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setOpenStep(isOpen ? null : idx)}
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                  <span className="text-sm font-mono text-gray-400 w-6 shrink-0">{idx + 1}.</span>
                  <span className="text-base shrink-0" title={meta.label}>{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{step.name || meta.label}</div>
                    {summary && <div className="text-xs text-gray-500 truncate mt-0.5">{summary}</div>}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); moveStep(idx, -1); }} disabled={idx === 0}
                    className="p-1 text-gray-400 hover:text-brand-600 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                  <button onClick={(e) => { e.stopPropagation(); moveStep(idx, 1); }} disabled={idx === steps.length - 1}
                    className="p-1 text-gray-400 hover:text-brand-600 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                  <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Törlöd: ${step.name}?`)) removeStep(idx); }}
                    className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
                {isOpen && (
                  <StepForm
                    step={step}
                    inputs={inputs}
                    priorSteps={steps.slice(0, idx)}
                    taskTypes={taskTypes}
                    users={users}
                    worksheetTemplates={worksheetTemplates}
                    equipment={equipment}
                    onChange={(patch) => updateStep(idx, patch)}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Új lépés választó */}
        {showAddStepPicker ? (
          <div className="p-5 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-600">Válassz lépés-típust:</p>
              <button onClick={() => setShowAddStepPicker(false)} className="text-xs text-gray-400 hover:text-gray-700">Mégse</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {STEP_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => addStep(t.value)}
                  className="text-left border border-gray-200 hover:border-brand-300 hover:bg-white rounded-lg p-3 transition">
                  <div className="text-2xl mb-1">{t.icon}</div>
                  <div className="text-sm font-semibold text-gray-900">{t.label}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{t.description}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3 border-t border-gray-100">
            <button onClick={() => setShowAddStepPicker(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed border-gray-200 text-sm font-medium text-brand-600 hover:bg-brand-50 hover:border-brand-300 transition">
              <Plus className="w-4 h-4" /> Új lépés
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   STEP FORM — egy lépés szerkesztő űrlapja (scoped per type)
   ══════════════════════════════════════════════════════════════════════ */
function StepForm({
  step, inputs, priorSteps, taskTypes, users, worksheetTemplates, equipment, onChange,
}: {
  step: ProjectTemplateStep;
  inputs: ProjectTemplateInput[];
  priorSteps: ProjectTemplateStep[];
  taskTypes: TaskType[];
  users: User[];
  worksheetTemplates: WorksheetTemplate[];
  equipment: DashboardEquipment[];
  onChange: (patch: Partial<ProjectTemplateStep>) => void;
}) {
  const meta = STEP_TYPES.find(t => t.value === step.stepType) ?? STEP_TYPES[0];
  const F = meta.fields;

  const labelCls = 'text-[11px] font-semibold text-gray-500 block mb-1 uppercase tracking-wide';
  const fieldCls = 'w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white';

  // Élő anchor-preview
  const anchorPreview = useMemo(() => humanizeAnchor(step, inputs, priorSteps.concat([])), [step, inputs, priorSteps]);

  return (
    <div className="px-5 py-4 bg-gray-50/70 space-y-4 border-l-2 border-brand-300">
      {/* Lépés-típus váltó kártyák (kis változat, a kiválasztott highlight-tal) */}
      <div className="flex gap-1.5 flex-wrap">
        {STEP_TYPES.map(t => (
          <button key={t.value} type="button"
            onClick={() => onChange({ stepType: t.value })}
            className={clsx(
              'text-xs px-2.5 py-1.5 rounded-md border transition inline-flex items-center gap-1.5',
              t.value === step.stepType
                ? 'border-brand-400 bg-brand-50 text-brand-700 font-semibold'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
            )}
            title={t.description}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Név */}
      <div>
        <label className={labelCls}>Lépés neve</label>
        <input value={step.name} onChange={e => onChange({ name: e.target.value })} maxLength={200} className={fieldCls} />
      </div>

      {/* Leírás (opcionális) */}
      <div>
        <label className={labelCls}>Leírás (opcionális)</label>
        <textarea value={step.description ?? ''} onChange={e => onChange({ description: e.target.value })} rows={2} className={fieldCls} />
      </div>

      {/* Anchor sentence-builder */}
      <AnchorBuilder
        step={step}
        inputs={inputs}
        priorSteps={priorSteps}
        onChange={onChange}
      />
      {anchorPreview && (
        <div className="text-xs text-gray-600 italic bg-white border border-gray-100 rounded px-3 py-2">
          <span className="text-gray-400 mr-1">→ </span>
          {anchorPreview}
        </div>
      )}

      {/* Duration (scoped per type) */}
      {F.duration && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Időtartam</label>
            <input type="number" value={step.durationValue ?? 1} step="0.5" min={0}
              onChange={e => onChange({ durationValue: Number(e.target.value) })} className={fieldCls} />
          </div>
          {!F.durationFixedUnit ? (
            <div>
              <label className={labelCls}>Egység</label>
              <select value={step.durationUnit ?? 'working'} onChange={e => onChange({ durationUnit: e.target.value as ProjectTemplateOffsetUnit })} className={fieldCls}>
                <option value="working">munkanap</option>
                <option value="calendar">naptári nap</option>
                <option value="hours">óra</option>
              </select>
            </div>
          ) : (
            <div>
              <label className={labelCls}>Egység</label>
              <div className="text-sm py-1.5 px-2 text-gray-500">{UNIT_LABELS[F.durationFixedUnit]}</div>
            </div>
          )}
        </div>
      )}

      {/* Task-type (csak task lépéseknél) */}
      {F.taskType && (
        <div>
          <label className={labelCls}>Task-típus</label>
          <select
            value={step.taskType ?? ''}
            onChange={e => onChange({ taskType: e.target.value })}
            className={fieldCls}
          >
            {taskTypes.map(t => (
              <option key={t.value} value={t.value}>
                {t.icon ? `${t.icon} ` : ''}{t.label}
              </option>
            ))}
          </select>
          {step.taskType && (() => {
            const tt = taskTypes.find(t => t.value === step.taskType);
            return tt ? (
              <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs">
                <span className="inline-block w-3 h-3 rounded shrink-0" style={{ background: tt.color }} />
                <span className="text-gray-500">A Gantt-on ezzel a színnel jelenik meg.</span>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Felelős (assignee) */}
      {F.assignee && (
        <div>
          <label className={labelCls}>Felelős (alapértelmezett)</label>
          <UserPicker
            users={users}
            value={step.assigneeId ?? ''}
            onChange={(v) => onChange({ assigneeId: v || undefined })}
            placeholder="— válassz felhasználót —"
          />
          <label className="text-xs text-gray-500 inline-flex items-center gap-2 mt-2">
            <input type="checkbox" checked={step.assigneeEditable ?? false}
              onChange={e => onChange({ assigneeEditable: e.target.checked })} />
            Felülbírálható projekt-létrehozáskor
          </label>
        </div>
      )}

      {/* Helpers (multi-user) */}
      {F.helpers && (
        <div>
          <label className={labelCls}>Segítők (opcionális)</label>
          <MultiUserPicker
            users={users}
            value={step.helperIds ?? []}
            excludeId={step.assigneeId}
            onChange={(ids) => onChange({ helperIds: ids })}
          />
        </div>
      )}

      {/* Equipment (multi) */}
      {F.equipment && (
        <div>
          <label className={labelCls}>Eszközök (opcionális)</label>
          <EquipmentMultiPicker
            equipment={equipment}
            value={step.equipmentIds ?? []}
            onChange={(ids) => onChange({ equipmentIds: ids })}
          />
        </div>
      )}

      {/* Worksheet template */}
      {F.worksheetTemplate && (
        <div>
          <label className={labelCls}>Munkalap-sablon</label>
          <select
            value={step.worksheetTemplateId ?? ''}
            onChange={e => onChange({ worksheetTemplateId: e.target.value || undefined })}
            className={fieldCls}
          >
            <option value="">— üres munkalap —</option>
            {worksheetTemplates.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          {worksheetTemplates.length === 0 && (
            <p className="text-xs text-amber-600 mt-1.5">
              Nincs munkalap-sablon. Hozz létre egyet a Projekt map → admin → Munkalap-sablonok tab-on.
            </p>
          )}
        </div>
      )}

      {/* Notification */}
      {F.notification && (
        <div className="space-y-3 bg-white rounded-lg border border-gray-100 p-3">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Értesítés
          </h4>
          <div>
            <label className={labelCls}>Címzett</label>
            <UserPicker
              users={users}
              value={step.notificationRecipientId ?? ''}
              onChange={(v) => onChange({ notificationRecipientId: v || undefined })}
              placeholder="— válassz felhasználót —"
            />
          </div>
          <div>
            <label className={labelCls}>Cím</label>
            <input value={step.notificationTitle ?? ''} onChange={e => onChange({ notificationTitle: e.target.value || undefined })}
              maxLength={300} className={fieldCls} placeholder="pl. Munkalap kész — Zöldfelületi projekt" />
          </div>
          <div>
            <label className={labelCls}>Szöveg</label>
            <textarea value={step.notificationBody ?? ''} onChange={e => onChange({ notificationBody: e.target.value || undefined })}
              rows={2} className={fieldCls} placeholder="Részletek a címzettnek…" />
          </div>
        </div>
      )}

      {/* Deadline label */}
      {F.deadlineLabel && (
        <div>
          <label className={labelCls}>Határidő címke (a piros vonal mellé)</label>
          <input value={step.deadlineLabel ?? ''} onChange={e => onChange({ deadlineLabel: e.target.value || undefined })}
            maxLength={200} className={fieldCls} placeholder="pl. Zöldfelületi tanúsítvány — határidő" />
        </div>
      )}

      {/* Depends on */}
      {F.dependsOn && priorSteps.length > 0 && (
        <div>
          <label className={labelCls}>Függés egy korábbi lépéstől (opcionális)</label>
          <select value={step.dependsOnStepSortIndex ?? ''} onChange={e => onChange({ dependsOnStepSortIndex: e.target.value ? Number(e.target.value) : undefined })} className={fieldCls}>
            <option value="">— nincs függés —</option>
            {priorSteps.map((s, i) => <option key={i} value={s.sortIndex}>#{i + 1}. {s.name}</option>)}
          </select>
          <p className="text-[11px] text-gray-400 mt-1">A Gantt-on nyíl jelzi a függést, és a task csak az előző után indítható manuálisan.</p>
        </div>
      )}

      {/* Lane index — párhuzamos task-ok kifejezett sávja */}
      {F.laneIndex && (
        <div>
          <label className={labelCls}>Sáv (párhuzamos task-okhoz)</label>
          <select
            value={(step as any).laneIndex ?? ''}
            onChange={e => onChange({
              laneIndex: e.target.value === '' ? null : Number(e.target.value),
            } as any)}
            className={fieldCls}
          >
            <option value="">— auto (a rendszer számolja) —</option>
            <option value="0">Sáv 0 (alsó)</option>
            <option value="1">Sáv 1</option>
            <option value="2">Sáv 2</option>
            <option value="3">Sáv 3</option>
            <option value="4">Sáv 4 (felső)</option>
          </select>
          <p className="text-[11px] text-gray-400 mt-1">
            Ha két task ugyanazon a napon indul (pl. TIG + Számla), állítsd
            mindegyiket más sávra (0 / 1), hogy a Gantt-on egymás alatt
            jelenjenek meg. Az „auto" mindig a legkisebb szabad sávot választja.
          </p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   ANCHOR BUILDER — sentence-builder az anchor-hoz
   ══════════════════════════════════════════════════════════════════════ */
function AnchorBuilder({
  step, inputs, priorSteps, onChange,
}: {
  step: ProjectTemplateStep;
  inputs: ProjectTemplateInput[];
  priorSteps: ProjectTemplateStep[];
  onChange: (patch: Partial<ProjectTemplateStep>) => void;
}) {
  const labelCls = 'text-[11px] font-semibold text-gray-500 block mb-1 uppercase tracking-wide';
  const fieldCls = 'border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white';

  const needsInputRef = step.anchorKind === 'template_input';
  const needsStepRef = step.anchorKind === 'step_start' || step.anchorKind === 'step_end' || step.anchorKind === 'range_workday_n';
  const needsWorkdayN = step.anchorKind === 'range_workday_n';
  const showOffset = step.anchorKind !== 'project_created' || (Number(step.offsetValue ?? 0) > 0);

  // Bármely olyan korábbi lépés használható range-anchorként, aminek van időtartama
  // (légtér-időszak, feladat, munkalap). Pl. „feldolgozás 8. munkanapja" = határidő.
  const rangeSteps = priorSteps.filter(s =>
    s.stepType === 'legter_range' || (Number(s.durationValue ?? 0) > 0),
  );

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-3">
      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Mikor induljon ez a lépés?</h4>

      <div>
        <label className={labelCls}>Az időzítés alapja</label>
        <select
          value={step.anchorKind}
          onChange={e => onChange({ anchorKind: e.target.value as ProjectTemplateAnchorKind })}
          className={clsx(fieldCls, 'w-full')}
        >
          {ANCHOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {needsInputRef && (
        <div>
          <label className={labelCls}>Melyik paraméter?</label>
          <select
            value={step.anchorInputKey ?? ''}
            onChange={e => onChange({ anchorInputKey: e.target.value || undefined })}
            className={clsx(fieldCls, 'w-full')}
          >
            <option value="">— válassz —</option>
            {inputs.map(i => <option key={i.inputKey} value={i.inputKey}>{i.label}</option>)}
          </select>
          {inputs.length === 0 && (
            <p className="text-[11px] text-amber-600 mt-1">Még nincs felhasználói paraméter — hozz létre egyet fent.</p>
          )}
        </div>
      )}

      {needsStepRef && !needsWorkdayN && (
        <div>
          <label className={labelCls}>Melyik korábbi lépés?</label>
          <select
            value={step.anchorStepSortIndex ?? ''}
            onChange={e => onChange({ anchorStepSortIndex: e.target.value ? Number(e.target.value) : undefined })}
            className={clsx(fieldCls, 'w-full')}
          >
            <option value="">— válassz lépést —</option>
            {priorSteps.map((s, i) => <option key={i} value={s.sortIndex}>#{i + 1}. {s.name}</option>)}
          </select>
          {priorSteps.length === 0 && (
            <p className="text-[11px] text-amber-600 mt-1">Még nincs korábbi lépés.</p>
          )}
        </div>
      )}

      {needsWorkdayN && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Melyik légtér-időszak?</label>
            <select
              value={step.anchorStepSortIndex ?? ''}
              onChange={e => onChange({ anchorStepSortIndex: e.target.value ? Number(e.target.value) : undefined })}
              className={clsx(fieldCls, 'w-full')}
            >
              <option value="">— válassz —</option>
              {rangeSteps.map(s => (
                <option key={s.sortIndex} value={s.sortIndex}>#{s.sortIndex}. {s.name}</option>
              ))}
            </select>
            {rangeSteps.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1">Nincs korábbi időtartamos lépés (légtér-időszak vagy feladat).</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Hányadik munkanap?</label>
            <input type="number" min={1} value={step.anchorWorkdayN ?? 1}
              onChange={e => onChange({ anchorWorkdayN: Number(e.target.value) })}
              className={clsx(fieldCls, 'w-full')} />
          </div>
        </div>
      )}

      {/* Offset szakasz: csak akkor, ha értelmes (nem project_created egyszerű esete) */}
      {showOffset && (
        <div>
          <label className={labelCls}>Eltolás az alaptól</label>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="number" min={0} step="0.5"
              value={step.offsetValue ?? 0}
              onChange={e => onChange({ offsetValue: Number(e.target.value) })}
              className={clsx(fieldCls, 'w-20')}
            />
            <select
              value={step.offsetUnit ?? 'calendar'}
              onChange={e => onChange({ offsetUnit: e.target.value as ProjectTemplateOffsetUnit })}
              className={fieldCls}
            >
              <option value="working">munkanap</option>
              <option value="calendar">naptári nap</option>
              <option value="hours">óra</option>
            </select>
            <select
              value={step.offsetDirection ?? 'after'}
              onChange={e => onChange({ offsetDirection: e.target.value as ProjectTemplateOffsetDirection })}
              className={fieldCls}
            >
              <option value="after">{DIRECTION_LABELS.after}</option>
              <option value="before">{DIRECTION_LABELS.before}</option>
              <option value="on">{DIRECTION_LABELS.on}</option>
            </select>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Tipp: <em>0</em> érték + <em>„pontosan akkor"</em> ⇒ ugyanabban a pillanatban indul, mint az alap.
          </p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PICKER komponensek
   ══════════════════════════════════════════════════════════════════════ */

function UserPicker({
  users, value, onChange, placeholder,
}: {
  users: User[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
    >
      <option value="">{placeholder ?? '— senki —'}</option>
      {users.filter(u => u.isActive !== false).map(u => (
        <option key={u.id} value={u.id}>{u.lastName} {u.firstName}</option>
      ))}
    </select>
  );
}

function MultiUserPicker({
  users, value, excludeId, onChange,
}: {
  users: User[];
  value: string[];
  excludeId?: string;
  onChange: (ids: string[]) => void;
}) {
  const eligible = users.filter(u => u.isActive !== false && u.id !== excludeId);
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {eligible.map(u => {
        const checked = value.includes(u.id);
        return (
          <button
            key={u.id} type="button" onClick={() => toggle(u.id)}
            className={clsx(
              'text-xs px-2.5 py-1 rounded-full border transition',
              checked
                ? 'border-brand-400 bg-brand-50 text-brand-700 font-semibold'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
            )}
          >
            {u.lastName} {u.firstName}
          </button>
        );
      })}
      {eligible.length === 0 && <p className="text-xs text-gray-400 italic">Nincs választható felhasználó.</p>}
    </div>
  );
}

function EquipmentMultiPicker({
  equipment, value, onChange,
}: {
  equipment: DashboardEquipment[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {equipment.map(eq => {
        const checked = value.includes(eq.id);
        return (
          <button
            key={eq.id} type="button" onClick={() => toggle(eq.id)}
            className={clsx(
              'text-xs px-2.5 py-1 rounded-full border transition inline-flex items-center gap-1',
              checked
                ? 'border-brand-400 bg-brand-50 text-brand-700 font-semibold'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
            )}
            title={eq.status === 'maintenance' ? 'Karbantartás alatt' : undefined}
          >
            🔧 {eq.name}
          </button>
        );
      })}
      {equipment.length === 0 && <p className="text-xs text-gray-400 italic">Nincs eszköz a tenant-en.</p>}
    </div>
  );
}
