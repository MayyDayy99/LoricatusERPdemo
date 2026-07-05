'use client';

import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import {
  Shield, Plus, Trash2, Save, X, CheckCircle2, AlertCircle,
  RefreshCw, ChevronDown, ChevronRight, UserCheck, Eye, EyeOff,
} from 'lucide-react';
import {
  useRoles, usePermissionOverrides, createRole, updateRolePermissions,
  deleteRole, setPermissionOverride, removePermissionOverride,
} from '@/lib/hooks/use-roles';
import { useUsers } from '@/lib/hooks/use-users';
import { useT } from '@/lib/hooks/use-t';
import {
  GROUPS, NAV_LABELS, type GroupId, type UserRoleLike,
  getOrderedItemsForGroup,
} from '@/components/layout/sidebar-config';
import {
  useTenant, updateSidebarPolicies as apiUpdateSidebarPolicies,
  type SidebarPoliciesByRole,
} from '@/lib/hooks/use-tenants';
import { useLangStore } from '@/lib/lang-store';

/* ── All permissions grouped by resource ──────────────────────── */

const PERMISSION_GROUPS: { resource: string; permissions: string[] }[] = [
  { resource: 'tenant',      permissions: ['tenant:read', 'tenant:update'] },
  { resource: 'users',       permissions: ['users:create', 'users:read', 'users:update', 'users:delete'] },
  { resource: 'projects',    permissions: ['projects:create', 'projects:read', 'projects:update', 'projects:delete'] },
  { resource: 'uploads',     permissions: ['uploads:create', 'uploads:read', 'uploads:update', 'uploads:delete'] },
  { resource: 'documents',   permissions: ['documents:create', 'documents:read', 'documents:update', 'documents:send'] },
  { resource: 'shares',      permissions: ['shares:create', 'shares:read', 'shares:revoke'] },
  { resource: 'pricing',     permissions: ['pricing:read', 'pricing:write'] },
  { resource: 'maps',        permissions: ['maps:read', 'maps:write'] },
  { resource: 'contracts',   permissions: ['contracts:read', 'contracts:write'] },
  { resource: 'customers',   permissions: ['customers:read', 'customers:create', 'customers:update', 'customers:delete'] },
  { resource: 'audit',       permissions: ['audit:read'] },
  { resource: 'deals',         permissions: ['deals:create', 'deals:read', 'deals:update', 'deals:delete'] },
  { resource: 'activities',    permissions: ['activities:create', 'activities:read', 'activities:update', 'activities:delete'] },
  { resource: 'crm-tasks',     permissions: ['crm-tasks:create', 'crm-tasks:read', 'crm-tasks:update', 'crm-tasks:delete'] },
  { resource: 'quotes',        permissions: ['quotes:create', 'quotes:read', 'quotes:update', 'quotes:send'] },
  { resource: 'invoices',      permissions: ['invoices:create', 'invoices:read', 'invoices:update'] },
  { resource: 'pipelines',     permissions: ['pipelines:create', 'pipelines:read', 'pipelines:update', 'pipelines:delete'] },
  { resource: 'workflows',     permissions: ['workflows:create', 'workflows:read', 'workflows:update', 'workflows:delete'] },
  { resource: 'webhooks',      permissions: ['webhooks:create', 'webhooks:read', 'webhooks:update', 'webhooks:delete'] },
  { resource: 'crm-reports',   permissions: ['crm-reports:read'] },
  { resource: 'comments',      permissions: ['comments:create', 'comments:read', 'comments:update', 'comments:delete'] },
  { resource: 'field-reports', permissions: ['field-reports:read', 'field-reports:create', 'field-reports:update', 'field-reports:delete'] },
  { resource: 'leaves',        permissions: ['leaves:read', 'leaves:create', 'leaves:update', 'leaves:approve'] },
  { resource: 'reports',       permissions: ['reports:read', 'reports:create', 'reports:update'] },
  { resource: 'project-map',   permissions: ['project-map:read', 'project-map:create', 'project-map:update', 'project-map:delete'] },
  { resource: 'import',        permissions: ['import:create'] },
  { resource: 'work-orders',     permissions: ['work-orders:create', 'work-orders:read', 'work-orders:update', 'work-orders:delete'] },
  { resource: 'equipment',       permissions: ['equipment:create', 'equipment:read', 'equipment:update', 'equipment:delete'] },
  { resource: 'subcontractors',  permissions: ['subcontractors:create', 'subcontractors:read', 'subcontractors:update', 'subcontractors:delete'] },
  { resource: 'timesheets',      permissions: ['timesheets:create', 'timesheets:read', 'timesheets:update', 'timesheets:delete'] },
  { resource: 'analytics',       permissions: ['analytics:read'] },
  { resource: 'referrals',       permissions: ['referrals:create', 'referrals:read'] },
];

/* ── Human-readable Hungarian labels ─────────────────────────── */

const RESOURCE_LABELS: Record<string, string> = {
  'tenant':      'Munkaterület',
  'users':       'Felhasználók',
  'projects':    'Projektek',
  'uploads':     'Fájlok / Feltöltések',
  'documents':   'Dokumentumok',
  'shares':      'Megosztások',
  'pricing':     'Árazás',
  'maps':        'Térkép',
  'contracts':   'Szerződések',
  'customers':   'Ügyfelek',
  'audit':       'Tevékenységnapló',
  'deals':       'Üzletek (CRM)',
  'activities':  'Tevékenységek',
  'crm-tasks':   'CRM Feladatok',
  'quotes':      'Árajánlatok',
  'invoices':    'Számlák',
  'pipelines':   'Értékesítési folyamatok',
  'workflows':   'Automatizációk',
  'webhooks':    'Webhookok',
  'crm-reports': 'CRM Riportok',
  'comments':      'Kommentek',
  'field-reports': 'Helyszíni jelentések',
  'leaves':        'Szabadságok',
  'reports':       'Jelentések',
  'project-map':   'Projekt térkép',
  'import':        'Importálás',
  'work-orders':   'Munkalapok',
  'equipment':      'Eszközök',
  'subcontractors': 'Alvállalkozók',
  'timesheets':     'Munkaidő',
  'analytics':      'Elemzések',
  'referrals':      'Meghívók',
};

const PERMISSION_LABELS: Record<string, string> = {
  // Munkaterület
  'tenant:read':              'Munkaterület adatainak megtekintése',
  'tenant:update':            'Munkaterület beállításainak módosítása',
  // Felhasználók
  'users:create':             'Új felhasználó meghívása',
  'users:read':               'Felhasználók listájának megtekintése',
  'users:update':             'Felhasználói adatok és szerepkörök módosítása',
  'users:delete':             'Felhasználó eltávolítása',
  // Projektek
  'projects:create':          'Új projekt létrehozása',
  'projects:read':            'Projektek megtekintése',
  'projects:update':          'Projekt adatainak módosítása',
  'projects:delete':          'Projekt törlése',
  // Fájlok
  'uploads:create':           'Fájl feltöltése',
  'uploads:read':             'Feltöltött fájlok megtekintése',
  'uploads:update':           'Feltöltött fájl módosítása',
  'uploads:delete':           'Feltöltött fájl törlése',
  // Dokumentumok
  'documents:create':         'Új dokumentum létrehozása',
  'documents:read':           'Dokumentumok megtekintése',
  'documents:update':         'Dokumentum szerkesztése',
  'documents:send':           'Dokumentum elküldése / aláírásra küldése',
  // Megosztások
  'shares:create':            'Megosztási link létrehozása',
  'shares:read':              'Megosztási linkek megtekintése',
  'shares:revoke':            'Megosztási link visszavonása',
  // Árazás
  'pricing:read':             'Árlisták megtekintése',
  'pricing:write':            'Árlisták szerkesztése',
  // Térkép
  'maps:read':                'Térkép és helyszínadatok megtekintése',
  'maps:write':               'Térkép szerkesztése (területek, helyszínek)',
  // Szerződések
  'contracts:read':           'Szerződések megtekintése',
  'contracts:write':          'Szerződések létrehozása és szerkesztése',
  // Ügyfelek
  'customers:read':           'Ügyfelek listájának megtekintése',
  'customers:create':         'Új ügyfél felvitele',
  'customers:update':         'Ügyfél adatainak módosítása',
  'customers:delete':         'Ügyfél törlése',
  // Tevékenységnapló
  'audit:read':               'Rendszernaplók és tevékenységtörténet megtekintése',
  // Üzletek
  'deals:create':             'Új üzlet / értékesítési lehetőség rögzítése',
  'deals:read':               'Üzletek megtekintése',
  'deals:update':             'Üzlet adatainak módosítása',
  'deals:delete':             'Üzlet törlése',
  // Tevékenységek
  'activities:create':        'Tevékenység rögzítése (hívás, találkozó, megjegyzés)',
  'activities:read':          'Tevékenységek megtekintése',
  'activities:update':        'Tevékenység szerkesztése',
  'activities:delete':        'Tevékenység törlése',
  // CRM Feladatok
  'crm-tasks:create':         'Új feladat létrehozása',
  'crm-tasks:read':           'Feladatok megtekintése',
  'crm-tasks:update':         'Feladat módosítása (státusz, határidő, leírás)',
  'crm-tasks:delete':         'Feladat törlése',
  // Árajánlatok
  'quotes:create':            'Új árajánlat készítése',
  'quotes:read':              'Árajánlatok megtekintése',
  'quotes:update':            'Árajánlat szerkesztése',
  'quotes:send':              'Árajánlat elküldése ügyfélnek',
  // Számlák
  'invoices:create':          'Új számla kiállítása',
  'invoices:read':            'Számlák megtekintése',
  'invoices:update':          'Számla módosítása',
  // Értékesítési folyamatok
  'pipelines:create':         'Új értékesítési folyamat létrehozása',
  'pipelines:read':           'Értékesítési folyamatok megtekintése',
  'pipelines:update':         'Értékesítési folyamat módosítása',
  'pipelines:delete':         'Értékesítési folyamat törlése',
  // Automatizációk
  'workflows:create':         'Új automatizáció létrehozása',
  'workflows:read':           'Automatizációk megtekintése',
  'workflows:update':         'Automatizáció módosítása',
  'workflows:delete':         'Automatizáció törlése',
  // Webhookok
  'webhooks:create':          'Új webhook létrehozása',
  'webhooks:read':            'Webhookok megtekintése',
  'webhooks:update':          'Webhook módosítása',
  'webhooks:delete':          'Webhook törlése',
  // Riportok
  'crm-reports:read':         'CRM riportok és statisztikák megtekintése',
  'analytics:read':           'Elemzések és műszerfal adatok megtekintése',
  // Kommentek
  'comments:create':          'Komment írása',
  'comments:read':            'Kommentek megtekintése',
  'comments:update':          'Komment szerkesztése',
  'comments:delete':          'Komment törlése',
  // Helyszíni jelentések
  'field-reports:read':       'Helyszíni jelentések megtekintése',
  'field-reports:create':     'Új helyszíni jelentés létrehozása',
  'field-reports:update':     'Helyszíni jelentés szerkesztése',
  'field-reports:delete':     'Helyszíni jelentés törlése',
  // Szabadságok
  'leaves:read':              'Szabadságkérelmek megtekintése',
  'leaves:create':            'Új szabadságkérelem rögzítése',
  'leaves:update':            'Szabadságkérelem módosítása',
  'leaves:approve':           'Szabadságkérelem jóváhagyása / elutasítása',
  // Jelentések
  'reports:read':             'Jelentések megtekintése',
  'reports:create':           'Új jelentés létrehozása',
  'reports:update':           'Jelentés szerkesztése',
  // Projekt térkép
  'project-map:read':         'Projekt térkép megtekintése',
  'project-map:create':       'Új térkép elem létrehozása',
  'project-map:update':       'Térkép elem módosítása',
  'project-map:delete':       'Térkép elem törlése',
  // Importálás
  'import:create':            'Adatok importálása CSV-ből / külső forrásból',
  // Munkalapok
  'work-orders:create':       'Új munkalap létrehozása',
  'work-orders:read':         'Munkalapok megtekintése',
  'work-orders:update':       'Munkalap szerkesztése',
  'work-orders:delete':       'Munkalap törlése',
  // Eszközök
  'equipment:create':         'Új eszköz felvitele',
  'equipment:read':           'Eszközök megtekintése',
  'equipment:update':         'Eszköz szerkesztése',
  'equipment:delete':         'Eszköz törlése',
  // Alvállalkozók
  'subcontractors:create':    'Új alvállalkozó felvitele',
  'subcontractors:read':      'Alvállalkozók megtekintése',
  'subcontractors:update':    'Alvállalkozó szerkesztése',
  'subcontractors:delete':    'Alvállalkozó törlése',
  // Munkaidő
  'timesheets:create':        'Új munkaidő-bejegyzés',
  'timesheets:read':          'Munkaidő-naptár megtekintése',
  'timesheets:update':        'Munkaidő-bejegyzés szerkesztése',
  'timesheets:delete':        'Munkaidő-bejegyzés törlése',
  'referrals:create':         'Új meghívó létrehozása',
  'referrals:read':           'Meghívók megtekintése és statisztika',
};

const ROLE_COLORS: Record<string, string> = {
  red:    'bg-red-100 text-red-700',
  purple: 'bg-purple-100 text-purple-700',
  blue:   'bg-blue-100 text-blue-700',
  amber:  'bg-amber-100 text-amber-700',
  gray:   'bg-gray-100 text-gray-600',
  green:  'bg-green-100 text-green-700',
  teal:   'bg-teal-100 text-teal-700',
};

type Tab = 'roles' | 'matrix' | 'overrides' | 'visibility';

/* ═══════════════════════════════════════════════════════════════
   Main page
   ═══════════════════════════════════════════════════════════════ */

export default function RolesPage() {
  const t = useT();
  const tr = t.roles;
  const [tab, setTab] = useState<Tab>('roles');

  const TABS: { key: Tab; label: string }[] = [
    { key: 'roles',      label: tr.tabRoles },
    { key: 'matrix',     label: tr.tabMatrix },
    { key: 'overrides',  label: tr.tabOverrides },
    { key: 'visibility', label: tr.tabVisibility },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-brand-600" />
          {tr.title}
        </h1>
        <p className="text-gray-500 mt-1">{tr.subtitle}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 max-w-xl">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'flex-1 px-4 py-2 text-sm font-medium rounded-md transition',
              tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'roles'      && <RolesTab />}
      {tab === 'matrix'     && <PermissionMatrixTab />}
      {tab === 'overrides'  && <OverridesTab />}
      {tab === 'visibility' && <VisibilityTab />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Tab 1 — Roles list + CRUD
   ═══════════════════════════════════════════════════════════════ */

function RolesTab() {
  const t = useT();
  const tr = t.roles;
  const { roles, isLoading, mutate } = useRoles();
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeleting(id);
    try { await deleteRole(id); await mutate(); }
    finally { setDeleting(null); }
  }

  if (isLoading) return <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition">
          <Plus className="w-4 h-4" /> {tr.createRole}
        </button>
      </div>

      <div className="space-y-3">
        {roles.map((role) => (
          <div key={role.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition">
            <div className="flex items-center gap-4">
              <span className={clsx('text-xs font-bold px-3 py-1 rounded-full', ROLE_COLORS[role.color] ?? ROLE_COLORS.gray)}>
                {role.name}
              </span>
              <div>
                <p className="text-sm text-gray-500">{role.slug}</p>
                {role.description && <p className="text-xs text-gray-400 mt-0.5">{role.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">
                {role.permissions.length} {tr.permCount}
              </span>
              {role.isSystem ? (
                <span className="text-xs text-gray-300 italic">{tr.systemRole}</span>
              ) : (
                <button
                  onClick={() => handleDelete(role.id)}
                  disabled={deleting === role.id}
                  className="text-red-400 hover:text-red-600 transition disabled:opacity-40"
                  title={tr.deleteRole}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showCreate && <CreateRoleModal onClose={() => setShowCreate(false)} onSuccess={() => { mutate(); setShowCreate(false); }} />}
    </div>
  );
}

/* ── Create role modal ────────────────────────────────────────── */

function CreateRoleModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const t = useT();
  const tr = t.roles;
  const [form, setForm] = useState({ name: '', slug: '', description: '', color: 'blue' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function upd(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await createRole({ ...form, permissions: [] });
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? tr.createError);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{tr.createRole}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="role-name" className="block text-sm font-medium text-gray-700 mb-1">{tr.roleName}</label>
            <input id="role-name" type="text" required value={form.name} onChange={(e) => upd('name', e.target.value)} maxLength={100}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label htmlFor="role-slug" className="block text-sm font-medium text-gray-700 mb-1">{tr.roleSlug}</label>
            <input id="role-slug" type="text" required value={form.slug} onChange={(e) => upd('slug', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} maxLength={100}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-400" placeholder="custom-role" />
          </div>
          <div>
            <label htmlFor="role-desc" className="block text-sm font-medium text-gray-700 mb-1">{tr.roleDesc}</label>
            <input id="role-desc" type="text" value={form.description} onChange={(e) => upd('description', e.target.value)} maxLength={500}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label htmlFor="role-color" className="block text-sm font-medium text-gray-700 mb-1">{tr.roleColor}</label>
            <select id="role-color" value={form.color} onChange={(e) => upd('color', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              {Object.keys(ROLE_COLORS).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">{t.common.cancel}</button>
            <button type="submit" disabled={busy} className="flex-1 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-60">
              {busy ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : tr.createBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Tab 2 — Permission matrix (roles × permissions checkboxes)
   ═══════════════════════════════════════════════════════════════ */

function PermissionMatrixTab() {
  const t = useT();
  const tr = t.roles;
  const { roles, mutate } = useRoles();
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(PERMISSION_GROUPS.map((g) => g.resource)));

  // Local editable state: roleId → Set<permission>
  const [edits, setEdits] = useState<Record<string, Set<string>>>({});

  // Initialize edits from server data
  const rolePerms = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const r of roles) map[r.id] = new Set(r.permissions);
    return map;
  }, [roles]);

  function getPerms(roleId: string): Set<string> {
    return edits[roleId] ?? rolePerms[roleId] ?? new Set();
  }

  function toggle(roleId: string, perm: string) {
    const current = new Set(getPerms(roleId));
    if (current.has(perm)) current.delete(perm); else current.add(perm);
    setEdits((prev) => ({ ...prev, [roleId]: current }));
  }

  function toggleGroup(roleId: string, group: string[]) {
    const current = new Set(getPerms(roleId));
    const allChecked = group.every((p) => current.has(p));
    for (const p of group) { if (allChecked) current.delete(p); else current.add(p); }
    setEdits((prev) => ({ ...prev, [roleId]: current }));
  }

  function isDirty(roleId: string): boolean {
    if (!edits[roleId]) return false;
    const orig = rolePerms[roleId] ?? new Set();
    const curr = edits[roleId];
    if (orig.size !== curr.size) return true;
    for (const p of orig) if (!curr.has(p)) return true;
    return false;
  }

  async function handleSave(roleId: string) {
    const perms = Array.from(getPerms(roleId));
    setSaving(roleId);
    try {
      await updateRolePermissions(roleId, perms);
      await mutate();
      setEdits((prev) => { const next = { ...prev }; delete next[roleId]; return next; });
    } finally { setSaving(null); }
  }

  function toggleExpand(resource: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(resource)) next.delete(resource); else next.add(resource);
      return next;
    });
  }

  if (roles.length === 0) return <div className="text-center py-10 text-gray-400">{tr.noRoles}</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-3 font-semibold text-gray-500 min-w-[200px] sticky left-0 bg-white z-10">{tr.permission}</th>
            {roles.map((r) => (
              <th key={r.id} className="text-center py-3 px-2 min-w-[100px]">
                <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full', ROLE_COLORS[r.color] ?? ROLE_COLORS.gray)}>
                  {r.name}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_GROUPS.map(({ resource, permissions }) => (
            <>
              {/* Group header */}
              <tr key={`grp-${resource}`} className="bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleExpand(resource)}>
                <td className="py-2 px-3 font-semibold text-gray-700 flex items-center gap-1 sticky left-0 bg-gray-50 z-10">
                  {expandedGroups.has(resource) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  {RESOURCE_LABELS[resource] ?? resource}
                </td>
                {roles.map((r) => (
                  <td key={r.id} className="text-center py-2 px-2">
                    <input type="checkbox" className="w-3.5 h-3.5 accent-brand-500"
                      checked={permissions.every((p) => getPerms(r.id).has(p))}
                      onChange={() => toggleGroup(r.id, permissions)} />
                  </td>
                ))}
              </tr>
              {/* Individual permissions */}
              {expandedGroups.has(resource) && permissions.map((perm) => (
                <tr key={perm} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-1.5 px-3 pl-8 sticky left-0 bg-white z-10">
                    <span className="text-gray-700 text-sm">{PERMISSION_LABELS[perm] ?? perm}</span>
                    <span className="block text-gray-300 font-mono text-[10px] leading-none mt-0.5">{perm}</span>
                  </td>
                  {roles.map((r) => (
                    <td key={r.id} className="text-center py-1.5 px-2">
                      <input type="checkbox" className="w-3.5 h-3.5 accent-brand-500"
                        checked={getPerms(r.id).has(perm)}
                        onChange={() => toggle(r.id, perm)} />
                    </td>
                  ))}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>

      {/* Save buttons for dirty roles */}
      <div className="flex flex-wrap gap-2 mt-4">
        {roles.filter((r) => isDirty(r.id)).map((r) => (
          <button key={r.id} disabled={saving === r.id} onClick={() => handleSave(r.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-60">
            {saving === r.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {tr.saveRole.replace('{name}', r.name)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Tab 3 — Per-user permission overrides
   ═══════════════════════════════════════════════════════════════ */

function OverridesTab() {
  const t = useT();
  const tr = t.roles;
  const { users } = useUsers();
  const { overrides, mutate } = usePermissionOverrides();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newPerm, setNewPerm] = useState('');
  const [newType, setNewType] = useState<'grant' | 'revoke'>('grant');
  const [busy, setBusy] = useState(false);

  const userOverrides = useMemo(
    () => overrides.filter((o) => o.userId === selectedUser),
    [overrides, selectedUser],
  );

  const selectedUserObj = users.find((u) => u.id === selectedUser);

  async function handleAdd() {
    if (!selectedUser || !newPerm.trim()) return;
    setBusy(true);
    try {
      await setPermissionOverride(selectedUser, newPerm.trim(), newType);
      await mutate();
      setNewPerm(''); setAdding(false);
    } finally { setBusy(false); }
  }

  async function handleRemove(userId: string, permission: string) {
    await removePermissionOverride(userId, permission);
    await mutate();
  }

  return (
    <div className="space-y-6">
      {/* User selector */}
      <div className="max-w-md">
        <label htmlFor="override-user" className="block text-sm font-medium text-gray-700 mb-1.5">{tr.selectUser}</label>
        <select id="override-user" value={selectedUser ?? ''}
          onChange={(e) => setSelectedUser(e.target.value || null)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
          <option value="">{tr.selectUserPlaceholder}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
          ))}
        </select>
      </div>

      {/* Overrides list */}
      {selectedUser && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-brand-500" />
              {tr.overridesFor.replace('{name}', selectedUserObj ? `${selectedUserObj.firstName} ${selectedUserObj.lastName}` : '')}
            </h3>
            <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium">
              <Plus className="w-4 h-4" /> {tr.addOverride}
            </button>
          </div>

          {userOverrides.length === 0 && !adding ? (
            <p className="text-sm text-gray-400 py-4">{tr.noOverrides}</p>
          ) : (
            <div className="space-y-2">
              {userOverrides.map((ov) => (
                <div key={ov.id} className="flex items-center justify-between px-4 py-2.5 bg-white border border-gray-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className={clsx(
                      'text-xs font-bold px-2 py-0.5 rounded-full',
                      ov.type === 'grant' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                    )}>
                      {ov.type === 'grant' ? tr.grant : tr.revoke}
                    </span>
                    <span className="text-sm text-gray-700">{PERMISSION_LABELS[ov.permission] ?? ov.permission}</span>
                    <span className="font-mono text-[10px] text-gray-400 ml-1">({ov.permission})</span>
                  </div>
                  <button onClick={() => handleRemove(ov.userId, ov.permission)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add override form */}
          {adding && (
            <div className="flex items-end gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="flex-1">
                <label htmlFor="new-perm" className="block text-xs font-medium text-gray-600 mb-1">{tr.permission}</label>
                <select id="new-perm" value={newPerm} onChange={(e) => setNewPerm(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  <option value="">{tr.selectPermission}</option>
                  {PERMISSION_GROUPS.map((g) => (
                    <optgroup key={g.resource} label={RESOURCE_LABELS[g.resource] ?? g.resource}>
                      {g.permissions.map((p) => (
                        <option key={p} value={p}>{PERMISSION_LABELS[p] ?? p}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="new-type" className="block text-xs font-medium text-gray-600 mb-1">{tr.type}</label>
                <select id="new-type" value={newType} onChange={(e) => setNewType(e.target.value as 'grant' | 'revoke')}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  <option value="grant">{tr.grant}</option>
                  <option value="revoke">{tr.revoke}</option>
                </select>
              </div>
              <button disabled={busy || !newPerm} onClick={handleAdd}
                className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-40">
                {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              </button>
              <button onClick={() => { setAdding(false); setNewPerm(''); }}
                className="px-3 py-2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Tab 4 — Sidebar visibility policy per role (tenant-wide)
   ═══════════════════════════════════════════════════════════════ */

const ROLE_OPTION_COLORS: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700',
  admin:       'bg-purple-100 text-purple-700',
  ceo:         'bg-blue-100 text-blue-700',
  manager:     'bg-amber-100 text-amber-700',
  operative:   'bg-gray-100 text-gray-600',
  client:      'bg-green-100 text-green-700',
};

// A Szerepkörök-tab a useRoles() backend-listájáról veszi az 5 tenant-szintű
// szerepkört; super_admin platform-szintű és NEM jelenik meg a Szerepkörök-tabon —
// ezért a Menü-láthatóság-tabon sem mutatjuk, hogy a két lista egyezzen.
const ROLE_OPTION_KEYS: UserRoleLike[] = [
  'admin', 'ceo', 'manager', 'operative', 'client',
];

type VisSaveState = 'idle' | 'saving' | 'saved';

function VisibilityTab() {
  const t = useT();
  const tr = t.roles;
  const { tenant, mutate } = useTenant();
  const { locale } = useLangStore();
  const [selectedRole, setSelectedRole] = useState<UserRoleLike>('manager');
  const [state, setState] = useState<VisSaveState>('idle');
  const [localPolicies, setLocalPolicies] = useState<SidebarPoliciesByRole | null>(null);

  const roleOptions = ROLE_OPTION_KEYS.map((key) => ({
    key,
    label: tr.labels[key as keyof typeof tr.labels] ?? key,
    color: ROLE_OPTION_COLORS[key] ?? 'bg-gray-100 text-gray-600',
  }));

  const serverPolicies: SidebarPoliciesByRole = useMemo(
    () => (tenant?.metadata?.sidebarPoliciesByRole ?? {}) as SidebarPoliciesByRole,
    [tenant?.metadata?.sidebarPoliciesByRole],
  );

  const policies: SidebarPoliciesByRole = localPolicies ?? serverPolicies;
  const hiddenForRole = new Set(policies[selectedRole]?.hidden ?? []);

  async function commit(nextHidden: string[]) {
    const nextPolicies: SidebarPoliciesByRole = {
      ...policies,
      [selectedRole]: { hidden: nextHidden },
    };
    setLocalPolicies(nextPolicies);
    setState('saving');
    try {
      // optimistic mutate
      if (tenant) {
        await mutate(
          {
            ...tenant,
            metadata: { ...(tenant.metadata ?? {}), sidebarPoliciesByRole: nextPolicies },
          },
          false,
        );
      }
      await apiUpdateSidebarPolicies({ [selectedRole]: { hidden: nextHidden } });
      await mutate();
      setLocalPolicies(null);
      setState('saved');
      setTimeout(() => setState('idle'), 1500);
    } catch {
      setLocalPolicies(null);
      await mutate();
      setState('idle');
    }
  }

  function toggleHidden(href: string) {
    const current = new Set(hiddenForRole);
    if (current.has(href)) current.delete(href);
    else current.add(href);
    void commit(Array.from(current));
  }

  return (
    <div className="space-y-4">
      {/* Header / explanation */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          {tr.visibilityNote}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 text-xs h-5">
        {state === 'saving' && (
          <span className="flex items-center gap-1 text-gray-500">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            {tr.visibilitySaving}
          </span>
        )}
        {state === 'saved' && (
          <span className="flex items-center gap-1 text-green-600 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {tr.visibilitySaved}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
        {/* Left: role selector */}
        <div className="bg-white border border-gray-100 rounded-xl p-3 space-y-1 h-fit">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 px-2 py-1.5">
            {tr.visibilityRole}
          </p>
          {roleOptions.map((r) => {
            const count = policies[r.key]?.hidden?.length ?? 0;
            const active = selectedRole === r.key;
            return (
              <button
                key={r.key}
                onClick={() => setSelectedRole(r.key)}
                className={clsx(
                  'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition',
                  active ? 'bg-brand-50 text-brand-700' : 'hover:bg-gray-50 text-gray-700',
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', r.color)}>
                    {r.label}
                  </span>
                </span>
                <span className="text-[10px] text-gray-400">
                  {count > 0 ? tr.visibilityHiddenCount(count) : '—'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: items grouped */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-5">
          {GROUPS.map((g) => {
            const items = getOrderedItemsForGroup(g.id as GroupId);
            return (
              <div key={g.id} className="space-y-2">
                <div className="flex items-center justify-between border-b border-gray-50 pb-1.5">
                  <span className="text-sm font-semibold text-gray-800">
                    {g.label[locale]}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {tr.visibilityHiddenOfTotal(
                      items.filter((i) => hiddenForRole.has(i.href)).length,
                      items.length,
                    )}
                  </span>
                </div>
                <ul className="divide-y divide-gray-50">
                  {items.map((it) => {
                    const label = NAV_LABELS[it.href]?.[locale] ?? it.href;
                    const isHidden = hiddenForRole.has(it.href);
                    const Icon = it.icon;
                    return (
                      <li
                        key={it.href}
                        className={clsx(
                          'flex items-center gap-2 py-2',
                          isHidden && 'opacity-60',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleHidden(it.href)}
                          title={isHidden ? tr.visibilityShowItem : tr.visibilityHideItem}
                          className={clsx(
                            'p-1.5 rounded-lg transition',
                            isHidden
                              ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              : 'bg-brand-50 text-brand-700 hover:bg-brand-100',
                          )}
                        >
                          {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="flex-1 text-sm text-gray-700 truncate">{label}</span>
                        <span className="font-mono text-[10px] text-gray-300">{it.href}</span>
                        {it.beta && (
                          <span className="text-[9px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                            BETA
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {/* Status row at bottom for visual consistency with /save action style */}
          <div className="flex items-center justify-end pt-3 border-t border-gray-50 text-xs text-gray-400">
            <Save className="w-3.5 h-3.5 mr-1" />
            {tr.visibilityAutosave}
          </div>
        </div>
      </div>
    </div>
  );
}
