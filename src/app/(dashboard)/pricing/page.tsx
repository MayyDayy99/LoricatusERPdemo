'use client';

import { useState, useMemo } from 'react';
import { Plus, Trash2, GripVertical, Settings2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import {
  usePricingItems, usePricingGroups, usePricingColumns,
  createPricingItem, updatePricingItem, deletePricingItem, reorderPricingItems,
  type PricingItem, type PricingGroup, type PricingColumn,
  type CalcMode, type PercentBasis,
} from '@/lib/hooks/use-pricing';
import { PricingAdminModal } from '@/components/pricing/pricing-admin-modal';

const fmt = (n: number) =>
  new Intl.NumberFormat('hu-HU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

// ── Cella-renderelő egy dinamikus oszlophoz ──────────────────────────────────

function renderCell(item: PricingItem, col: PricingColumn): React.ReactNode {
  const isPercent = item.metadata?.calcMode === 'percent';
  switch (col.key) {
    case 'name': return <span className="font-medium text-gray-900">{item.name}</span>;
    case 'unit': return <span className="text-gray-500">{item.unit ?? '—'}</span>;
    case 'quantity':
      return <span className="font-mono">{isPercent ? '—' : fmt(Number(item.quantity))}</span>;
    case 'unitPrice':
      return isPercent
        ? <span className="font-mono text-brand-600">{item.metadata?.percentValue ?? 0}%</span>
        : <span className="font-mono">{fmt(Number(item.unitPrice))}</span>;
    case 'totalPrice':
      return <span className="font-mono font-semibold">{fmt(Number(item.totalPrice))}</span>;
    default: {
      // dinamikus (custom) oszlop — érték a metadata-ból
      const v = item.metadata?.[col.key];
      if (v == null || v === '') return <span className="text-gray-300">—</span>;
      if (col.type === 'currency' || col.type === 'number') return <span className="font-mono">{fmt(Number(v))}</span>;
      return <span className="text-gray-700">{String(v)}</span>;
    }
  }
}

// ── Tétel-szerkesztő modal ───────────────────────────────────────────────────

function ItemEditorModal({
  item, groups, columns, onClose, onSaved,
}: {
  item: PricingItem | null;
  groups: PricingGroup[];
  columns: PricingColumn[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [groupId, setGroupId] = useState(item?.groupId ?? '');
  const [calcMode, setCalcMode] = useState<CalcMode>(item?.metadata?.calcMode ?? 'multiply');
  const [unitPrice, setUnitPrice] = useState(String(item?.unitPrice ?? ''));
  const [quantity, setQuantity] = useState(String(item?.quantity ?? '1'));
  // Jutalékrendszer (LOGIKA §7-8): tétel default-jai. Quote-tételre kerüléskor
  // öröklődik, ott felülbírálható. Y (saját) → jutalék-keretbe számít;
  // X (alvállalkozó) → kimarad a keretből. Tri-state: a régi katalógus-sorokon
  // NULL-ként él, mentésnél csak akkor írjuk át, ha a user explicit választott.
  const [defaultIsOwn, setDefaultIsOwn] = useState<boolean | null>(item?.defaultIsOwn ?? null);
  const [defaultEstimatedMinutes, setDefaultEstimatedMinutes] = useState(
    item?.defaultEstimatedMinutes != null ? String(item.defaultEstimatedMinutes) : ''
  );
  const [percentValue, setPercentValue] = useState(String(item?.metadata?.percentValue ?? ''));
  const [percentBasis, setPercentBasis] = useState<PercentBasis>(item?.metadata?.percentBasis ?? 'subtotal');
  const [custom, setCustom] = useState<Record<string, string>>(() => {
    const c: Record<string, string> = {};
    for (const col of columns) {
      if (!col.fixed) c[col.key] = String(item?.metadata?.[col.key] ?? '');
    }
    return c;
  });
  const [busy, setBusy] = useState(false);

  const customColumns = columns.filter(c => !c.fixed);

  async function save() {
    if (!name.trim()) { toast.error('A tétel neve kötelező'); return; }
    setBusy(true);
    try {
      const metadata: Record<string, unknown> = {};
      if (calcMode === 'percent') {
        metadata.calcMode = 'percent';
        metadata.percentValue = parseFloat(percentValue) || 0;
        metadata.percentBasis = percentBasis;
      } else {
        metadata.calcMode = 'multiply';
      }
      for (const col of customColumns) {
        const v = custom[col.key]?.trim();
        if (v) metadata[col.key] = col.type === 'text' ? v : (parseFloat(v) || 0);
      }
      const minutesParsed = defaultEstimatedMinutes.trim() ? parseInt(defaultEstimatedMinutes, 10) : NaN;
      const payload = {
        name: name.trim(),
        unit: unit.trim() || undefined,
        groupId: groupId || undefined,
        unitPrice: calcMode === 'percent' ? 0 : (parseFloat(unitPrice) || 0),
        quantity: calcMode === 'percent' ? 1 : (parseFloat(quantity) || 1),
        metadata,
        // Csak akkor írjuk át a DB-ben tárolt értéket, ha a user explicit választott.
        ...(defaultIsOwn !== null ? { defaultIsOwn } : {}),
        // NaN-guard: nem-numerikus inputot nem küldünk át — különben silent NULL.
        ...(Number.isFinite(minutesParsed) ? { defaultEstimatedMinutes: minutesParsed } : {}),
      };
      if (item) await updatePricingItem(item.id, payload);
      else await createPricingItem({ ...payload, isTemplate: true });
      toast.success(item ? 'Tétel mentve' : 'Tétel létrehozva');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Mentés sikertelen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{item ? 'Tétel szerkesztése' : 'Új tétel'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </header>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Megnevezés</label>
            <input value={name} onChange={e => setName(e.target.value)} autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Csoport</label>
              <select value={groupId} onChange={e => setGroupId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">— nincs —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Egység</label>
              <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="pl. m², óra, db"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Számítási mód</label>
            <div className="flex gap-2">
              {(['multiply', 'percent'] as const).map(m => (
                <button key={m} type="button" onClick={() => setCalcMode(m)}
                  className={clsx('flex-1 px-3 py-1.5 rounded-lg text-sm border transition',
                    calcMode === m ? 'bg-brand-50 border-brand-400 text-brand-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                  {m === 'multiply' ? 'Szorzás (egységár × menny.)' : 'Százalék'}
                </button>
              ))}
            </div>
          </div>

          {calcMode === 'multiply' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Egységár</label>
                <input type="number" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mennyiség</label>
                <input type="number" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Százalék (%)</label>
                <input type="number" step="0.1" value={percentValue} onChange={e => setPercentValue(e.target.value)}
                  placeholder="pl. 5" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mihez képest</label>
                <select value={percentBasis} onChange={e => setPercentBasis(e.target.value as PercentBasis)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="subtotal">Teljes összeg</option>
                  <option value="group">Saját csoport összege</option>
                </select>
              </div>
            </div>
          )}

          {customColumns.length > 0 && (
            <div className="pt-2 border-t border-gray-100 space-y-3">
              <div className="text-xs font-semibold text-gray-600">Egyéni oszlopok</div>
              {customColumns.map(col => (
                <div key={col.key}>
                  <label className="block text-xs text-gray-500 mb-1">{col.label}</label>
                  <input
                    type={col.type === 'text' ? 'text' : 'number'}
                    step={col.type === 'text' ? undefined : '0.01'}
                    value={custom[col.key] ?? ''}
                    onChange={e => setCustom(c => ({ ...c, [col.key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Jutalékrendszer (Y/X + ráfordítás default-ok) */}
          <div className="pt-2 border-t border-gray-100 space-y-3">
            <div className="text-xs font-semibold text-gray-600">Jutalék-keret</div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Tétel típusa (default)</label>
              <div className="flex gap-2" role="radiogroup" aria-label="Tétel típusa">
                <button type="button" onClick={() => setDefaultIsOwn(true)}
                  role="radio" aria-checked={defaultIsOwn === true}
                  className={clsx('flex-1 px-3 py-2 rounded-lg text-sm border transition',
                    defaultIsOwn === true ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                  Saját munka (Y) — beleszámít a jutalék-keretbe
                </button>
                <button type="button" onClick={() => setDefaultIsOwn(false)}
                  role="radio" aria-checked={defaultIsOwn === false}
                  className={clsx('flex-1 px-3 py-2 rounded-lg text-sm border transition',
                    defaultIsOwn === false ? 'bg-amber-50 border-amber-400 text-amber-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                  Alvállalkozó (X) — kimarad a keretből
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                {defaultIsOwn === null
                  ? 'Nincs még beállítva — válassz, hogy a tétel beleszámítson-e a jutalék-keretbe.'
                  : 'A quote-tételre kerüléskor öröklődik, ott felülbírálható.'}
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Becsült ráfordítás (perc / egység, opcionális)</label>
              <input type="number" min="0" step="15" value={defaultEstimatedMinutes}
                onChange={e => setDefaultEstimatedMinutes(e.target.value)}
                placeholder="pl. 240 (= 4 óra / egység)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" />
              <p className="text-[11px] text-gray-400 mt-1">Az árazógép-vezérelt projekt-importnál ebből számolódik a draft task hossza (480 perc = 1 nap).</p>
            </div>
          </div>
        </div>
        <footer className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Mégse</button>
          <button type="button" onClick={save} disabled={busy}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {busy ? 'Mentés…' : 'Mentés'}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ── Fő Árazógép-oldal ────────────────────────────────────────────────────────

export default function PricingPage() {
  const { items, isLoading, mutate: mutateItems } = usePricingItems();
  const { groups } = usePricingGroups();
  const { columns } = usePricingColumns();
  const [showAdmin, setShowAdmin] = useState(false);
  const [editing, setEditing] = useState<PricingItem | null | 'new'>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  // Csoportonként rendezett szekciók: a csoportok sortOrder szerint, végül a
  // csoport nélküli tételek. Minden szekción belül sortOrder.
  const sections = useMemo(() => {
    const byGroup = new Map<string, PricingItem[]>();
    const ungrouped: PricingItem[] = [];
    for (const it of [...items].sort((a, b) => a.sortOrder - b.sortOrder)) {
      if (it.groupId) {
        if (!byGroup.has(it.groupId)) byGroup.set(it.groupId, []);
        byGroup.get(it.groupId)!.push(it);
      } else {
        ungrouped.push(it);
      }
    }
    const out: Array<{ group: PricingGroup | null; items: PricingItem[] }> = [];
    for (const g of groups) {
      out.push({ group: g, items: byGroup.get(g.id) ?? [] });
    }
    if (ungrouped.length > 0) out.push({ group: null, items: ungrouped });
    return out;
  }, [items, groups]);

  const grandTotal = useMemo(
    () => items.reduce((s, i) => s + Number(i.totalPrice), 0),
    [items],
  );

  async function handleDelete(id: string) {
    const item = items.find(i => i.id === id);
    const name = item?.name?.trim();
    const msg = name
      ? `Biztosan törlöd a(z) "${name}" tételt? Ez a művelet nem visszavonható.`
      : 'Biztosan törlöd ezt a tételt? Ez a művelet nem visszavonható.';
    if (!confirm(msg)) return;
    try {
      await deletePricingItem(id);
      await mutateItems();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Törlés sikertelen');
    }
  }

  async function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const ordered = [...items].sort((a, b) => a.sortOrder - b.sortOrder).map(i => i.id);
    const from = ordered.indexOf(dragId);
    const to = ordered.indexOf(targetId);
    ordered.splice(to, 0, ordered.splice(from, 1)[0]);
    setDragId(null);
    try {
      await reorderPricingItems(ordered);
      await mutateItems();
    } catch {
      toast.error('Sorrend mentése sikertelen');
    }
  }

  const visibleColumns = [...columns].sort((a, b) => a.sortIndex - b.sortIndex);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Árazógép</h1>
          <p className="text-gray-500 mt-1">
            {items.length} tétel · {groups.length} csoport · összérték: <span className="font-semibold">{fmt(grandTotal)} Ft</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowAdmin(true)}
            className="flex items-center gap-2 border border-gray-200 px-3 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition text-sm">
            <Settings2 className="w-4 h-4" /> Admin
          </button>
          <button type="button" onClick={() => setEditing('new')}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-brand-700 transition text-sm">
            <Plus className="w-4 h-4" /> Új tétel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="w-8" />
              {visibleColumns.map(col => (
                <th key={col.key} className={clsx(
                  'px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide',
                  col.type === 'text' ? 'text-left' : 'text-right',
                )}>
                  {col.label}
                </th>
              ))}
              <th className="w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && (
              [...Array(4)].map((_, i) => (
                <tr key={i}>
                  <td /><td colSpan={visibleColumns.length + 1} className="px-4 py-3">
                    <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
                  </td>
                </tr>
              ))
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length + 2} className="px-4 py-10 text-center text-gray-400">
                  Még nincs tétel. Hozz létre egyet, vagy töltsd be az alapkatalógust az Admin gombbal.
                </td>
              </tr>
            )}
            {!isLoading && sections.map(({ group, items: groupItems }) => (
              <FragmentSection
                key={group?.id ?? '__ungrouped__'}
                group={group}
                groupItems={groupItems}
                visibleColumns={visibleColumns}
                dragId={dragId}
                onDragStart={setDragId}
                onDrop={handleDrop}
                onEdit={setEditing}
                onDelete={handleDelete}
              />
            ))}
          </tbody>
          {items.length > 0 && (
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td />
                <td colSpan={visibleColumns.length - 1} className="px-4 py-3 text-sm font-semibold text-gray-600">
                  Összesen
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{fmt(grandTotal)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showAdmin && <PricingAdminModal onClose={() => setShowAdmin(false)} />}
      {editing && (
        <ItemEditorModal
          item={editing === 'new' ? null : editing}
          groups={groups}
          columns={columns}
          onClose={() => setEditing(null)}
          onSaved={() => mutateItems()}
        />
      )}
    </div>
  );
}

// ── Egy csoport-szekció (külön komponens a sok prop miatt) ────────────────────

function FragmentSection({
  group, groupItems, visibleColumns, dragId, onDragStart, onDrop, onEdit, onDelete,
}: {
  group: PricingGroup | null;
  groupItems: PricingItem[];
  visibleColumns: PricingColumn[];
  dragId: string | null;
  onDragStart: (id: string) => void;
  onDrop: (id: string) => void;
  onEdit: (item: PricingItem) => void;
  onDelete: (id: string) => void;
}) {
  const tint = group ? group.color + '33' : undefined;
  return (
    <>
      <tr style={{ background: group ? group.color + '66' : '#f3f4f6' }}>
        <td colSpan={visibleColumns.length + 2} className="px-4 py-1.5 text-xs font-semibold text-gray-700 uppercase tracking-wide">
          {group?.name ?? 'Csoport nélkül'} <span className="text-gray-400 normal-case font-normal">({groupItems.length})</span>
        </td>
      </tr>
      {groupItems.map(item => (
        <tr
          key={item.id}
          draggable
          onDragStart={() => onDragStart(item.id)}
          onDragOver={e => e.preventDefault()}
          onDrop={() => onDrop(item.id)}
          className={clsx('hover:brightness-95 transition', dragId === item.id && 'opacity-40')}
          style={{ background: tint }}
        >
          <td className="px-2 text-center">
            <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab inline-block" />
          </td>
          {visibleColumns.map(col => (
            <td key={col.key} className={clsx('px-4 py-2.5', col.type === 'text' ? 'text-left' : 'text-right')}>
              {renderCell(item, col)}
            </td>
          ))}
          <td className="px-4 py-2.5 text-right whitespace-nowrap">
            <button type="button" onClick={() => onEdit(item)} aria-label="Szerkesztés" title="Szerkesztés" className="text-yellow-500 hover:text-yellow-600 transition mr-2">
              <Pencil className="w-5 h-5" strokeWidth={2.5} />
            </button>
            <button type="button" onClick={() => onDelete(item.id)} aria-label="Törlés" title="Törlés" className="text-red-600 hover:text-red-700 transition">
              <Trash2 className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </td>
        </tr>
      ))}
    </>
  );
}
