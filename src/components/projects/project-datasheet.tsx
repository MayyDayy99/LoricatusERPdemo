'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Calendar, Upload, FileText, X, Loader2, Settings2 } from 'lucide-react';
import {
  useFieldLayout, updateProject,
  type CustomFieldDef, type CustomFieldFileValue, type FieldBoxWithFields,
} from '@/lib/hooks/use-projects';
import { useUsers } from '@/lib/hooks/use-users';
import { initiateUpload, completeUpload, getDownloadUrl } from '@/lib/hooks/use-uploads';

/**
 * A projekt-kategória adatlapja — a MiniCRM "adatlap" mintájára: dobozokba
 * (összecsukható szekciókba) rendezett egyedi mezők, élő szerkesztéssel.
 * A séma a kategóriához kötött ({@link useFieldLayout}); az értékek a projekt
 * `customFieldsData` JSONB-jében élnek, `fieldKey` kulccsal.
 *
 * A szerkesztés "dirty + Mentés gomb" modellel megy (nem mezőnkénti autosave).
 */
export function ProjectDatasheet({
  categoryId, project, onChange,
}: {
  categoryId: string;
  project: { id: string; customFieldsData?: Record<string, unknown> };
  onChange: () => void;
}) {
  const router = useRouter();
  const { boxes, isLoading } = useFieldLayout(categoryId);
  const [values, setValues] = useState<Record<string, any>>(project.customFieldsData ?? {});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  const editorHref = `/rooms/categories/${categoryId}/fields`;

  useEffect(() => {
    setValues(project.customFieldsData ?? {});
    setDirty(false);
  }, [project.customFieldsData]);

  function setField(key: string, v: any) {
    setValues((s) => ({ ...s, [key]: v }));
    setDirty(true);
  }

  async function save() {
    setBusy(true);
    try {
      await updateProject(project.id, { customFieldsData: values });
      onChange();
      setDirty(false);
      toast.success('Adatlap mentve');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Mentés sikertelen');
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return null;

  // Üres állapot: a kategóriának még nincs adatlap-sémája — vezessük a szerkesztőhöz.
  if (boxes.length === 0) {
    return (
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Adatlap</h2>
        <div className="border border-dashed border-gray-300 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500 mb-3">
            Ehhez a szobához még nincs adatlap-séma — hozz létre dobozokat és mezőket.
          </p>
          <button
            onClick={() => router.push(editorHref)}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700"
          >
            <Settings2 className="w-3.5 h-3.5" /> Adatlap testreszabása
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Adatlap</h2>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={save}
              disabled={busy}
              className="text-xs px-3 py-1 bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? 'Mentés…' : 'Mentés'}
            </button>
          )}
          <button
            onClick={() => router.push(editorHref)}
            className="text-gray-400 hover:text-brand-600"
            title="Adatlap testreszabása"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {boxes.map((box) => (
        <DatasheetBox
          key={box.id}
          box={box}
          values={values}
          setField={setField}
          projectId={project.id}
        />
      ))}
    </section>
  );
}

function DatasheetBox({
  box, values, setField, projectId,
}: {
  box: FieldBoxWithFields;
  values: Record<string, any>;
  setField: (key: string, v: any) => void;
  projectId: string;
}) {
  const [collapsed, setCollapsed] = useState(box.collapsedByDefault);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700">{box.title}</span>
        {collapsed
          ? <ChevronDown className="w-4 h-4 text-gray-400" />
          : <ChevronUp className="w-4 h-4 text-gray-400" />}
      </button>
      {!collapsed && (
        <div className="p-4 space-y-3">
          {box.fields.length === 0 && (
            <p className="text-xs text-gray-400 italic">Nincs mező ebben a dobozban.</p>
          )}
          {box.fields.map((f) => (
            <div key={f.id}>
              <label className="block text-xs text-gray-500 mb-1">
                {f.label} {f.required && <span className="text-red-500">*</span>}
              </label>
              <FieldControl
                field={f}
                value={values[f.fieldKey]}
                onChange={(v) => setField(f.fieldKey, v)}
                projectId={projectId}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400';

function FieldControl({
  field, value, onChange, projectId,
}: {
  field: CustomFieldDef;
  value: any;
  onChange: (v: any) => void;
  projectId: string;
}) {
  switch (field.fieldType) {
    case 'textarea':
      return (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={field.placeholder}
          className={`${inputCls} resize-none`}
        />
      );

    case 'boolean':
      return (
        <label className="flex items-center gap-2 mt-1">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-gray-700">Igen</span>
        </label>
      );

    case 'select':
      return (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputCls}>
          <option value="">— Válassz —</option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );

    case 'multiselect':
      return <MultiSelectControl field={field} value={value} onChange={onChange} />;

    case 'date':
      return (
        <div className="relative">
          <Calendar className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="date"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputCls} pl-8`}
          />
        </div>
      );

    case 'number':
      return (
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder={field.placeholder ?? '0'}
          className={inputCls}
        />
      );

    case 'user':
      return <UserSelectControl value={value} onChange={onChange} />;

    case 'file':
      return <FileFieldControl value={value} onChange={onChange} projectId={projectId} />;

    case 'text':
    default:
      return (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputCls}
        />
      );
  }
}

function MultiSelectControl({
  field, value, onChange,
}: {
  field: CustomFieldDef;
  value: any;
  onChange: (v: string[]) => void;
}) {
  const selected: string[] = Array.isArray(value) ? value : [];
  function toggle(v: string) {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  }
  return (
    <div className="space-y-1.5 border border-gray-200 rounded-lg px-3 py-2">
      {(field.options ?? []).length === 0 && (
        <p className="text-xs text-gray-400 italic">Nincsenek opciók.</p>
      )}
      {(field.options ?? []).map((o) => (
        <label key={o.value} className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={selected.includes(o.value)}
            onChange={() => toggle(o.value)}
            className="rounded"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function UserSelectControl({
  value, onChange,
}: {
  value: any;
  onChange: (v: string) => void;
}) {
  const { users } = useUsers();
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">— Válassz felhasználót —</option>
      {users.filter((u) => u.isActive).map((u) => (
        <option key={u.id} value={u.id}>{u.lastName} {u.firstName}</option>
      ))}
    </select>
  );
}

function FileFieldControl({
  value, onChange, projectId,
}: {
  value: any;
  onChange: (v: CustomFieldFileValue | null) => void;
  projectId: string;
}) {
  const file: CustomFieldFileValue | null =
    value && typeof value === 'object' && value.uploadId ? value : null;
  const [busy, setBusy] = useState(false);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    setBusy(true);
    try {
      const { upload, chunkUploadUrls } = await initiateUpload({
        projectId,
        fileName: picked.name,
        mimeType: picked.type || 'application/octet-stream',
        fileSizeBytes: picked.size,
        category: 'document',
      });
      if (chunkUploadUrls[0] && !chunkUploadUrls[0].startsWith('http://mock-storage')) {
        const putRes = await fetch(chunkUploadUrls[0], {
          method: 'PUT',
          body: picked,
          headers: { 'Content-Type': picked.type || 'application/octet-stream' },
        });
        if (!putRes.ok) throw new Error(`Feltöltés hiba (${putRes.status})`);
      }
      await completeUpload(upload.id);
      onChange({ uploadId: upload.id, name: picked.name, size: picked.size });
      toast.success('Fájl feltöltve');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err?.message ?? 'Feltöltés sikertelen');
    } finally {
      setBusy(false);
    }
  }

  async function openFile() {
    if (!file) return;
    try {
      const url = await getDownloadUrl(file.uploadId);
      window.open(url, '_blank', 'noopener');
    } catch {
      toast.error('A fájl nem érhető el');
    }
  }

  if (file) {
    return (
      <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
        <button
          type="button"
          onClick={openFile}
          className="text-sm text-brand-600 hover:underline truncate flex-1 text-left"
        >
          {file.name}
        </button>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-gray-400 hover:text-red-500 shrink-0"
          aria-label="Fájl eltávolítása"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <label className={`${inputCls} flex items-center gap-2 cursor-pointer text-gray-500 hover:bg-gray-50`}>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
      <span className="text-sm">{busy ? 'Feltöltés…' : 'Fájl feltöltése'}</span>
      <input type="file" className="hidden" onChange={handlePick} disabled={busy} />
    </label>
  );
}
