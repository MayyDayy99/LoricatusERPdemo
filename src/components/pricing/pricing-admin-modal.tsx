'use client';

import { useState } from 'react';
import { X, Plus, Trash2, GripVertical, Palette, Database } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import {
  usePricingGroups, usePricingColumns,
  createPricingGroup, updatePricingGroup, deletePricingGroup, reorderPricingGroups,
  setPricingColumns, bulkAdjustPrices, seedPricingCatalog,
  type PricingColumn, type PricingColumnType,
} from '@/lib/hooks/use-pricing';

const COLOR_PALETTE = ['#e5e7eb', '#bfdbfe', '#bbf7d0', '#fde68a', '#fecaca', '#ddd6fe', '#fbcfe8', '#a7f3d0'];

type AdminTab = 'groups' | 'columns' | 'prices';

export function PricingAdminModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<AdminTab>('groups');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[88vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Árazógép — finomhangolás</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </header>

        <div className="flex border-b border-gray-100">
          {([
            { id: 'groups', label: 'Tétel-csoportok' },
            { id: 'columns', label: 'Oszlopok' },
            { id: 'prices', label: 'Ár-módosítás' },
          ] as const).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={clsx(
                'flex-1 px-4 py-2.5 text-sm transition border-b-2',
                tab === t.id
                  ? 'border-brand-600 text-brand-700 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto">
          {tab === 'groups' && <GroupsPanel />}
          {tab === 'columns' && <ColumnsPanel />}
          {tab === 'prices' && <PricesPanel />}
        </div>
      </div>
    </div>
  );
}

// ── Csoportok ────────────────────────────────────────────────────────────────

function GroupsPanel() {
  const { groups, mutate } = usePricingGroups();
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  async function add() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await createPricingGroup(newName.trim());
      setNewName('');
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Csoport létrehozása sikertelen');
    } finally {
      setBusy(false);
    }
  }

  async function setColor(id: string, color: string) {
    try {
      await updatePricingGroup(id, { color });
      await mutate();
    } catch { toast.error('Szín mentése sikertelen'); }
  }

  async function rename(id: string, name: string) {
    try {
      await updatePricingGroup(id, { name });
      await mutate();
    } catch { toast.error('Átnevezés sikertelen'); }
  }

  async function remove(id: string) {
    try {
      await deletePricingGroup(id);
      await mutate();
    } catch { toast.error('Törlés sikertelen'); }
  }

  async function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = groups.map(g => g.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setDragId(null);
    // Optimista: az SWR cache azonnal újrarendezve
    await mutate(
      ids.map((id, i) => ({ ...groups.find(g => g.id === id)!, sortOrder: i })),
      { revalidate: false },
    );
    try {
      await reorderPricingGroups(ids);
      await mutate();
    } catch { toast.error('Sorrend mentése sikertelen'); await mutate(); }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        A csoportok az Árazógép-táblázatban a saját háttérszínükkel jelennek meg. Húzd a sorokat a sorrendhez.
      </p>
      <div className="space-y-1.5">
        {groups.map(g => (
          <div
            key={g.id}
            draggable
            onDragStart={() => setDragId(g.id)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => onDrop(g.id)}
            className="flex items-center gap-2 p-2 rounded-lg border border-gray-100"
            style={{ background: g.color + '55' }}
          >
            <GripVertical className="w-4 h-4 text-gray-300 cursor-grab shrink-0" />
            <input
              defaultValue={g.name}
              onBlur={e => { if (e.target.value.trim() && e.target.value !== g.name) rename(g.id, e.target.value.trim()); }}
              className="flex-1 bg-white/70 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <div className="flex gap-1">
              {COLOR_PALETTE.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(g.id, c)}
                  title={c}
                  className={clsx('w-5 h-5 rounded-full border', g.color === c ? 'ring-2 ring-brand-500 border-white' : 'border-gray-300')}
                  style={{ background: c }}
                />
              ))}
            </div>
            <button type="button" onClick={() => remove(g.id)} className="text-gray-400 hover:text-red-600 shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {groups.length === 0 && <p className="text-xs text-gray-400 italic py-3 text-center">Még nincs csoport.</p>}
      </div>
      <div className="flex gap-2 pt-1">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Új csoport neve…"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button type="button" onClick={add} disabled={busy || !newName.trim()}
          className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40 inline-flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Hozzáad
        </button>
      </div>
    </div>
  );
}

// ── Oszlopok ─────────────────────────────────────────────────────────────────

function ColumnsPanel() {
  const { columns, mutate } = usePricingColumns();
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<PricingColumnType>('text');
  const [dragKey, setDragKey] = useState<string | null>(null);

  async function persist(next: PricingColumn[]) {
    const reindexed = next.map((c, i) => ({ ...c, sortIndex: i }));
    await mutate({ columns: reindexed, isCustom: true }, { revalidate: false });
    try {
      await setPricingColumns(reindexed);
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Oszlopok mentése sikertelen');
      await mutate();
    }
  }

  function addColumn() {
    const label = newLabel.trim();
    if (!label) return;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || `col_${Date.now()}`;
    if (columns.some(c => c.key === key)) { toast.error('Ilyen kulcsú oszlop már van'); return; }
    void persist([...columns, { key, label, type: newType, fixed: false, sortIndex: columns.length }]);
    setNewLabel('');
  }

  function renameColumn(key: string, label: string) {
    void persist(columns.map(c => c.key === key ? { ...c, label } : c));
  }

  function removeColumn(key: string) {
    void persist(columns.filter(c => c.key !== key));
  }

  function onDrop(targetKey: string) {
    if (!dragKey || dragKey === targetKey) return;
    const next = [...columns];
    const from = next.findIndex(c => c.key === dragKey);
    const to = next.findIndex(c => c.key === targetKey);
    next.splice(to, 0, next.splice(from, 1)[0]);
    setDragKey(null);
    void persist(next);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        A fix oszlopok (Megnevezés, Egység, …) sorrendje is állítható húzással. Custom oszlopok bármikor hozzáadhatók —
        az értékük tételenként szerkeszthető az Árazógépen.
      </p>
      <div className="space-y-1.5">
        {columns.map(c => (
          <div
            key={c.key}
            draggable
            onDragStart={() => setDragKey(c.key)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => onDrop(c.key)}
            className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50"
          >
            <GripVertical className="w-4 h-4 text-gray-300 cursor-grab shrink-0" />
            <input
              defaultValue={c.label}
              onBlur={e => { if (e.target.value.trim() && e.target.value !== c.label) renameColumn(c.key, e.target.value.trim()); }}
              className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <span className="text-[11px] text-gray-400 w-16 text-center">
              {c.type === 'currency' ? 'pénz' : c.type === 'number' ? 'szám' : 'szöveg'}
            </span>
            {c.fixed ? (
              <span className="text-[10px] text-gray-400 w-6 text-center">fix</span>
            ) : (
              <button type="button" onClick={() => removeColumn(c.key)} className="text-gray-400 hover:text-red-600 w-6 flex justify-center">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <input
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addColumn(); } }}
          placeholder="Új oszlop neve…"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <select
          value={newType}
          onChange={e => setNewType(e.target.value as PricingColumnType)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
        >
          <option value="text">szöveg</option>
          <option value="number">szám</option>
          <option value="currency">pénz</option>
        </select>
        <button type="button" onClick={addColumn} disabled={!newLabel.trim()}
          className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40 inline-flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Hozzáad
        </button>
      </div>
    </div>
  );
}

// ── Tömeges ár-módosítás ─────────────────────────────────────────────────────

function PricesPanel() {
  const [pct, setPct] = useState('');
  const [version, setVersion] = useState('');
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function applyAdjust() {
    const pctNum = parseFloat(pct);
    if (Number.isNaN(pctNum)) { toast.error('Adj meg egy százalék-értéket'); return; }
    if (!version.trim()) { toast.error('Adj meg egy verzió-címkét (pl. 2026-Q2)'); return; }
    setBusy(true);
    try {
      const r = await bulkAdjustPrices({ percentageChange: pctNum, newVersion: version.trim() });
      toast.success(`${r.updated} tétel ára módosítva (${pctNum > 0 ? '+' : ''}${pctNum}%)`);
      setPct('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Ár-módosítás sikertelen');
    } finally {
      setBusy(false);
    }
  }

  async function runSeed() {
    setSeeding(true);
    try {
      const r = await seedPricingCatalog();
      toast.success(`Katalógus: ${r.created} új tétel, ${r.skipped} kihagyva`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Katalógus-seed sikertelen');
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <Palette className="w-4 h-4" /> Tömeges ár-módosítás
        </h3>
        <p className="text-xs text-gray-500">
          Az összes katalógus-tétel egységárát módosítja a megadott százalékkal. A régi árak megmaradnak az
          ár-történetben — a korábban megkezdett projekt-árajánlatok továbbra is a régi árakkal számolnak.
        </p>
        <div className="flex gap-2">
          <input
            type="number" step="0.1" value={pct}
            onChange={e => setPct(e.target.value)}
            placeholder="pl. 10 vagy -5"
            className="w-32 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          />
          <span className="text-sm text-gray-400 self-center">%</span>
          <input
            value={version}
            onChange={e => setVersion(e.target.value)}
            placeholder="verzió-címke (pl. 2026-Q2)"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          />
          <button type="button" onClick={applyAdjust} disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40">
            {busy ? 'Folyamatban…' : 'Alkalmaz'}
          </button>
        </div>
      </div>

      <div className="space-y-2 pt-3 border-t border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <Database className="w-4 h-4" /> Alapkatalógus betöltése
        </h3>
        <p className="text-xs text-gray-500">
          Betölti az előre definiált tétel-katalógust (Terepi munka / Központi feldolgozás / Számolások).
          A már létező kódú tételeket kihagyja.
        </p>
        <button type="button" onClick={runSeed} disabled={seeding}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-40">
          {seeding ? 'Betöltés…' : 'Katalógus betöltése'}
        </button>
      </div>
    </div>
  );
}
