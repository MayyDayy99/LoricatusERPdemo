'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ChevronLeft, Plus, GripVertical, Pencil, Trash2, X, Check, Cloud, Loader2,
} from 'lucide-react';
import {
  useFieldLayout, useProjectCategories,
  createFieldBox, updateFieldBox, deleteFieldBox, reorderFieldBoxes,
  createCustomField, updateCustomField, deleteCustomField,
  moveCustomField, reorderCustomFields,
  type CustomFieldDef, type CustomFieldType, type FieldBoxWithFields,
} from '@/lib/hooks/use-projects';

/**
 * Adatlap-szerkesztő ("Mezők testreszabása") — a MiniCRM adatlap-szerkesztő
 * mintájára. Egy projekt-kategória adatlap-sémáját állítja: dobozok (szekciók)
 * és bennük egyedi mezők, natív drag-drop átrendezéssel. Minden művelet
 * azonnal a szerverre megy (granuláris autosave), majd revalidál.
 */

const TYPE_LABEL: Record<CustomFieldType, string> = {
  text: 'Szöveg',
  textarea: 'Hosszú szöveg',
  number: 'Szám',
  date: 'Dátum',
  boolean: 'Igen / Nem',
  select: 'Választólista',
  multiselect: 'Többszörös választás',
  file: 'Fájl',
  user: 'Felhasználó',
};

function slugifyKey(s: string): string {
  const base = s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  if (!base) return 'mezo';
  return /^[a-z]/.test(base) ? base : `f_${base}`.slice(0, 60);
}

export default function CategoryFieldsEditorPage() {
  const params = useParams();
  const router = useRouter();
  const categoryId = String(params.categoryId);

  const { categories } = useProjectCategories();
  const category = categories.find((c) => c.id === categoryId) ?? null;
  const { boxes, isLoading, mutate } = useFieldLayout(categoryId);

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Drag állapot
  const [dragBoxId, setDragBoxId] = useState<string | null>(null);
  const [dragField, setDragField] = useState<{ id: string; boxId: string } | null>(null);

  // Modálok
  const [boxModal, setBoxModal] = useState<FieldBoxWithFields | 'new' | null>(null);
  const [fieldModal, setFieldModal] = useState<
    { field: CustomFieldDef } | { boxId: string } | null
  >(null);

  /** Művelet-futtató: jelzi a mentést, revalidál, hiba esetén toast. */
  async function run(fn: () => Promise<unknown>) {
    setSaving(true);
    try {
      await fn();
      await mutate();
      setSavedAt(Date.now());
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'A művelet nem sikerült');
    } finally {
      setSaving(false);
    }
  }

  // — Doboz drag-drop —
  function onBoxDrop(targetBoxId: string) {
    if (!dragBoxId || dragBoxId === targetBoxId) { setDragBoxId(null); return; }
    const ids = boxes.map((b) => b.id);
    const from = ids.indexOf(dragBoxId);
    const to = ids.indexOf(targetBoxId);
    if (from < 0 || to < 0) { setDragBoxId(null); return; }
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setDragBoxId(null);
    run(() => reorderFieldBoxes(categoryId, ids));
  }

  // — Mező drag-drop: targetBoxId + opcionális beszúrási index —
  function onFieldDrop(targetBoxId: string, beforeFieldId: string | null) {
    const d = dragField;
    setDragField(null);
    if (!d) return;

    if (d.boxId === targetBoxId) {
      // Átrendezés a dobozon belül
      const box = boxes.find((b) => b.id === targetBoxId);
      if (!box) return;
      const ids = box.fields.map((f) => f.id);
      const from = ids.indexOf(d.id);
      if (from < 0) return;
      ids.splice(from, 1);
      const to = beforeFieldId ? ids.indexOf(beforeFieldId) : ids.length;
      ids.splice(to < 0 ? ids.length : to, 0, d.id);
      run(() => reorderCustomFields(targetBoxId, ids));
    } else {
      // Áthelyezés másik dobozba a kért pozícióra
      const box = boxes.find((b) => b.id === targetBoxId);
      const targetIds = box ? box.fields.map((f) => f.id) : [];
      const idx = beforeFieldId ? targetIds.indexOf(beforeFieldId) : targetIds.length;
      run(async () => {
        await moveCustomField(d.id, targetBoxId, idx < 0 ? targetIds.length : idx);
        // a beszúrás után normalizáljuk a cél-doboz sorrendjét
        targetIds.splice(idx < 0 ? targetIds.length : idx, 0, d.id);
        await reorderCustomFields(targetBoxId, targetIds);
      });
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Fejléc */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/rooms')}
            className="p-2 -ml-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            title="Vissza az adatlapra"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {category ? `${category.name} — adatlap testreszabása` : 'Adatlap testreszabása'}
            </h1>
            <p className="text-xs text-gray-400">Dobozok és mezők — húzd át a sorrendhez.</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          {saving
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Mentés…</>
            : savedAt
              ? <><Cloud className="w-3.5 h-3.5" /> Mentve</>
              : <><Cloud className="w-3.5 h-3.5" /> Automatikus mentés</>}
        </div>
      </div>

      {/* Új doboz felül */}
      <button
        onClick={() => setBoxModal('new')}
        className="w-full flex items-center justify-center gap-2 py-2.5 mb-4 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 transition"
      >
        <Plus className="w-4 h-4" /> Új doboz
      </button>

      {isLoading && <p className="text-sm text-gray-400">Betöltés…</p>}

      {!isLoading && boxes.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">
          Még nincs doboz. Hozz létre egyet a fenti gombbal.
        </p>
      )}

      <div className="space-y-3">
        {boxes.map((box) => (
          <BoxCard
            key={box.id}
            box={box}
            dragBoxId={dragBoxId}
            dragField={dragField}
            onBoxDragStart={() => setDragBoxId(box.id)}
            onBoxDrop={() => onBoxDrop(box.id)}
            onFieldDragStart={(fieldId) => setDragField({ id: fieldId, boxId: box.id })}
            onFieldDrop={(beforeFieldId) => onFieldDrop(box.id, beforeFieldId)}
            onEditBox={() => setBoxModal(box)}
            onDeleteBox={() =>
              run(async () => {
                await deleteFieldBox(box.id);
              })
            }
            onAddField={() => setFieldModal({ boxId: box.id })}
            onEditField={(field) => setFieldModal({ field })}
            onDeleteField={(fieldId) => run(() => deleteCustomField(fieldId))}
          />
        ))}
      </div>

      {boxModal && (
        <BoxModal
          categoryId={categoryId}
          initial={boxModal === 'new' ? null : boxModal}
          onClose={() => setBoxModal(null)}
          onSaved={async () => { await mutate(); setSavedAt(Date.now()); setBoxModal(null); }}
        />
      )}

      {fieldModal && (
        <FieldModal
          categoryId={categoryId}
          initial={'field' in fieldModal ? fieldModal.field : null}
          boxId={'boxId' in fieldModal ? fieldModal.boxId : fieldModal.field.boxId}
          onClose={() => setFieldModal(null)}
          onSaved={async () => { await mutate(); setSavedAt(Date.now()); setFieldModal(null); }}
        />
      )}
    </div>
  );
}

function BoxCard({
  box, dragBoxId, dragField,
  onBoxDragStart, onBoxDrop,
  onFieldDragStart, onFieldDrop,
  onEditBox, onDeleteBox, onAddField, onEditField, onDeleteField,
}: {
  box: FieldBoxWithFields;
  dragBoxId: string | null;
  dragField: { id: string; boxId: string } | null;
  onBoxDragStart: () => void;
  onBoxDrop: () => void;
  onFieldDragStart: (fieldId: string) => void;
  onFieldDrop: (beforeFieldId: string | null) => void;
  onEditBox: () => void;
  onDeleteBox: () => void;
  onAddField: () => void;
  onEditField: (field: CustomFieldDef) => void;
  onDeleteField: (fieldId: string) => void;
}) {
  const isDragging = dragBoxId === box.id;
  return (
    <div
      onDragOver={(e) => { if (dragBoxId || dragField) e.preventDefault(); }}
      onDrop={() => {
        if (dragBoxId) onBoxDrop();
        else if (dragField) onFieldDrop(null); // dobozra ejtve = a doboz végére
      }}
      className={`border border-gray-200 rounded-xl bg-white ${isDragging ? 'opacity-40' : ''}`}
    >
      {/* Doboz fejléc */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-t-xl border-b border-gray-100">
        <span
          draggable
          onDragStart={onBoxDragStart}
          className="cursor-grab text-gray-300 hover:text-gray-500"
          title="Húzd a doboz átrendezéséhez"
        >
          <GripVertical className="w-4 h-4" />
        </span>
        <span className="text-sm font-medium text-gray-700 flex-1">{box.title}</span>
        <button onClick={onEditBox} className="p-1 text-gray-400 hover:text-brand-600" title="Doboz szerkesztése">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            if (box.fields.length > 0) {
              toast.error('A doboz nem törölhető, amíg mezőket tartalmaz.');
              return;
            }
            if (confirm(`Töröljed a(z) "${box.title}" dobozt?`)) onDeleteBox();
          }}
          className="p-1 text-gray-400 hover:text-red-500"
          title="Doboz törlése"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mezők */}
      <div className="p-2 space-y-1">
        {box.fields.length === 0 && (
          <p className="text-xs text-gray-300 italic px-2 py-3 text-center">Nincs mező — adj hozzá egyet.</p>
        )}
        {box.fields.map((field) => (
          <div
            key={field.id}
            draggable
            onDragStart={(e) => { e.stopPropagation(); onFieldDragStart(field.id); }}
            onDragOver={(e) => { if (dragField) { e.preventDefault(); e.stopPropagation(); } }}
            onDrop={(e) => { if (dragField) { e.stopPropagation(); onFieldDrop(field.id); } }}
            className={`flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 group ${
              dragField?.id === field.id ? 'opacity-40' : ''
            }`}
          >
            <span className="cursor-grab text-gray-300 group-hover:text-gray-400">
              <GripVertical className="w-4 h-4" />
            </span>
            <span className="text-sm text-gray-700 flex-1 truncate">
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </span>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
              {TYPE_LABEL[field.fieldType]}
            </span>
            <button
              onClick={() => onEditField(field)}
              className="p-1 text-gray-400 hover:text-brand-600 opacity-0 group-hover:opacity-100"
              title="Mező szerkesztése"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { if (confirm(`Töröljed a(z) "${field.label}" mezőt?`)) onDeleteField(field.id); }}
              className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
              title="Mező törlése"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        <button
          onClick={onAddField}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-400 hover:text-brand-600 rounded-lg hover:bg-gray-50"
        >
          <Plus className="w-3.5 h-3.5" /> Új mező
        </button>
      </div>
    </div>
  );
}

const modalInput =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400';

function BoxModal({
  categoryId, initial, onClose, onSaved,
}: {
  categoryId: string;
  initial: FieldBoxWithFields | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [collapsedByDefault, setCollapsed] = useState(initial?.collapsedByDefault ?? false);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim()) { toast.error('A doboz címe kötelező'); return; }
    setBusy(true);
    try {
      if (initial) await updateFieldBox(initial.id, { title, collapsedByDefault });
      else await createFieldBox(categoryId, { title, collapsedByDefault });
      await onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Mentés sikertelen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={initial ? 'Doboz szerkesztése' : 'Új doboz'} onClose={onClose}>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Cím</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="pl. Kapcsolatfelvétel"
          maxLength={120}
          autoFocus
          className={modalInput}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={collapsedByDefault}
          onChange={(e) => setCollapsed(e.target.checked)}
          className="rounded"
        />
        Alapból összecsukva jelenjen meg
      </label>
      <ModalFooter busy={busy} onClose={onClose} onSave={save} saveLabel={initial ? 'Mentés' : 'Létrehozás'} />
    </ModalShell>
  );
}

function FieldModal({
  categoryId, initial, boxId, onClose, onSaved,
}: {
  categoryId: string;
  initial: CustomFieldDef | null;
  boxId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [fieldKey, setFieldKey] = useState(initial?.fieldKey ?? '');
  const [keyTouched, setKeyTouched] = useState(!!initial);
  const [fieldType, setFieldType] = useState<CustomFieldType>(initial?.fieldType ?? 'text');
  const [required, setRequired] = useState(initial?.required ?? false);
  const [placeholder, setPlaceholder] = useState(initial?.placeholder ?? '');
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>(
    initial?.options ?? [],
  );
  const [busy, setBusy] = useState(false);

  const hasOptions = fieldType === 'select' || fieldType === 'multiselect';

  function onLabelChange(v: string) {
    setLabel(v);
    if (!keyTouched && !initial) setFieldKey(slugifyKey(v));
  }

  async function save() {
    if (!label.trim()) { toast.error('A mező címkéje kötelező'); return; }
    setBusy(true);
    try {
      // Defenzív: a meglevő opcióknál a value vagy a label hiányozhat
      // (undefined) — `?? ''` nélkül a `.trim()` TypeError-t dobna, ami
      // a Mentést némán megölné. Ha a value üres de van címke, a value a
      // címkéből generálódik (nem vész el az opció).
      const cleanOptions = hasOptions
        ? options
            .map((o) => {
              const lbl = (o.label ?? '').trim();
              const val = (o.value ?? '').trim() || slugifyKey(lbl);
              return { label: lbl, value: val };
            })
            .filter((o) => o.label && o.value)
        : undefined;
      if (initial) {
        await updateCustomField(initial.id, {
          label, fieldType, required, placeholder: placeholder || undefined, options: cleanOptions,
        });
      } else {
        if (!/^[a-z][a-z0-9_]{0,59}$/.test(fieldKey)) {
          toast.error('A mezőkulcs formátuma: a-z, 0-9, _ — betűvel kezdődjön');
          setBusy(false);
          return;
        }
        await createCustomField(categoryId, {
          boxId, fieldKey, label, fieldType, required,
          placeholder: placeholder || undefined, options: cleanOptions,
        });
      }
      await onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Mentés sikertelen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={initial ? 'Mező szerkesztése' : 'Új mező'} onClose={onClose}>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Címke</label>
        <input
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="pl. Projekt részletei"
          maxLength={120}
          autoFocus
          className={modalInput}
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Mezőkulcs {initial && <span className="text-gray-400">(nem módosítható)</span>}
        </label>
        <input
          value={fieldKey}
          onChange={(e) => { setKeyTouched(true); setFieldKey(e.target.value); }}
          disabled={!!initial}
          maxLength={60}
          className={`${modalInput} ${initial ? 'bg-gray-50 text-gray-400' : 'font-mono'}`}
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Típus</label>
        <select
          value={fieldType}
          onChange={(e) => setFieldType(e.target.value as CustomFieldType)}
          className={modalInput}
        >
          {(Object.keys(TYPE_LABEL) as CustomFieldType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABEL[t]}</option>
          ))}
        </select>
      </div>
      {!hasOptions && fieldType !== 'boolean' && fieldType !== 'file' && fieldType !== 'user' && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Segéd-szöveg (placeholder)</label>
          <input
            value={placeholder}
            onChange={(e) => setPlaceholder(e.target.value)}
            maxLength={120}
            className={modalInput}
          />
        </div>
      )}
      {hasOptions && (
        <OptionsEditor options={options} onChange={setOptions} />
      )}
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          className="rounded"
        />
        Kötelező mező
      </label>
      <ModalFooter busy={busy} onClose={onClose} onSave={save} saveLabel={initial ? 'Mentés' : 'Létrehozás'} />
    </ModalShell>
  );
}

function OptionsEditor({
  options, onChange,
}: {
  options: Array<{ value: string; label: string }>;
  onChange: (o: Array<{ value: string; label: string }>) => void;
}) {
  function update(i: number, patch: Partial<{ value: string; label: string }>) {
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">Opciók</label>
      <div className="space-y-1.5">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              value={o.label ?? ''}
              onChange={(e) => {
                const label = e.target.value;
                update(i, o.value ? { label } : { label, value: slugifyKey(label) });
              }}
              placeholder="Megjelenő név"
              className={`${modalInput} flex-1`}
            />
            <input
              value={o.value ?? ''}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder="érték"
              className={`${modalInput} w-32 font-mono text-xs`}
            />
            <button
              onClick={() => onChange(options.filter((_, idx) => idx !== i))}
              className="p-1.5 text-gray-400 hover:text-red-500"
              title="Opció törlése"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => onChange([...options, { value: '', label: '' }])}
        className="mt-2 flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
      >
        <Plus className="w-3.5 h-3.5" /> Opció hozzáadása
      </button>
    </div>
  );
}

function ModalShell({
  title, onClose, children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function ModalFooter({
  busy, onClose, onSave, saveLabel,
}: {
  busy: boolean;
  onClose: () => void;
  onSave: () => void;
  saveLabel: string;
}) {
  return (
    <div className="flex gap-2 justify-end pt-2">
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
      >
        Mégsem
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={busy}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {saveLabel}
      </button>
    </div>
  );
}
