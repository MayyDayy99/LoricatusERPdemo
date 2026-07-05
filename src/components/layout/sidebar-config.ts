import type { LucideIcon } from 'lucide-react';
import {
  Sun, FolderOpen, Upload, FileText, Share2, Users, Settings,
  ClipboardList, Map as MapIcon, Plane, DollarSign, UserRound, ScrollText, TrendingUp,
  CheckSquare, Activity, GitBranch, Receipt, Wallet, Clock, Wrench, HardHat,
  Shield, Briefcase, BarChart2, CalendarCheck, ListChecks, Zap, Mail, Plug,
  GitMerge, UserPlus,
} from 'lucide-react';
import type { LocaleCode } from '@/lib/lang-store';

export type GroupId = 'daily' | 'sales' | 'crm' | 'projects' | 'documents' | 'finance' | 'admin';

export type UserRoleLike = 'super_admin' | 'admin' | 'ceo' | 'manager' | 'operative' | 'client';

/**
 * v2.2.0 — A `client` (megrendelő) szerepkörű user kizárólag ezt a 4 útvonalat
 * látja a sidebar-on. Minden más item el van rejtve (a route maga is védve van
 * a backend ROLE_PERMISSIONS-ben + a applyClientScope + assertCustomerOwnership
 * policy-kkal). A térkép = Maps (helyjelölős), nem a Gantt.
 */
export const CLIENT_ALLOWED_ROUTES = ['/quotes', '/contracts', '/work-orders', '/map'] as const;

// inline TenantFeatureFlags-key tipus a `@construction/domain`-bol valo duplikalas helyett (FE alias macera)
export type FeatureFlagKey =
  | 'notamEnabled' | 'threeDEnabled' | 'pdfAdvancedEnabled'
  | 'crmEnabled' | 'crmWorkflowsEnabled' | 'crmInvoicingEnabled'
  | 'crmExternalIntegrations' | 'workOrdersEnabled'
  | 'droneEnabled' | 'internalTasksEnabled'
  | 'meetingEnabled' | 'fieldReportsEnabled'
  | 'miniCrmImportEnabled' | 'commissionEnabled';

export interface NavItem {
  href: string;
  icon: LucideIcon;
  group: GroupId;
  requiredFeature?: FeatureFlagKey;
  roleAllowed?: UserRoleLike[];   // ha nincs, mindenki latja (kiveve worker)
  beta?: boolean;
}

export interface SidebarConfig {
  hidden: string[];
  order: Partial<Record<GroupId, string[]>>;
  collapsedGroups: GroupId[];
  /** Per-user csoport-cím felülírás. Üres string → eredeti label. */
  groupLabels: Partial<Record<GroupId, string>>;
}

export const DEFAULT_SIDEBAR_CONFIG: SidebarConfig = {
  // Alapból rejtett menüpontok (a felhasználó a Testreszabás-ból bekapcsolhatja).
  // /settings/webhooks: technikai integrációs felület (n8n stb.) — átlagfelhasználónak nem kell.
  hidden: ['/pricing', '/settings/webhooks'],
  order: {},
  collapsedGroups: ['crm', 'projects', 'documents', 'finance', 'admin'],
  groupLabels: {},
};

/* ── ALL_ITEMS: 35 nav-item 6 csoportban ─────────────────────── */
export const ALL_ITEMS: NavItem[] = [
  // DAILY (4) — a user által rangsorolt napi-munka 4-elem
  { href: '/dashboard', icon: Sun,           group: 'daily' },
  { href: '/meeting',   icon: CalendarCheck, group: 'daily', requiredFeature: 'meetingEnabled' },
  { href: '/projects',  icon: FolderOpen,    group: 'daily' },
  { href: '/rooms',     icon: Briefcase,     group: 'daily' },

  // SALES (5)
  { href: '/customers', icon: UserRound,  group: 'sales' },
  { href: '/quotes',    icon: Receipt,    group: 'sales', requiredFeature: 'crmInvoicingEnabled' },
  { href: '/pricing',   icon: DollarSign, group: 'sales' },
  { href: '/contracts', icon: ScrollText, group: 'sales' },
  { href: '/referrals', icon: UserPlus,   group: 'sales' },

  // CRM (5) — /pipelines + /activities eltavolitva (DiMOP egyszerusites: pipeline-config az admin alatt, activity-log DealModal-ban)
  // E-feladat: /customers/merge — duplicate-detection + ugyfél-összevonás eszköz.
  { href: '/crm/dashboard', icon: BarChart2,  group: 'crm', requiredFeature: 'crmEnabled' },
  { href: '/tasks',         icon: CheckSquare, group: 'crm' },
  { href: '/accounts',      icon: Briefcase,  group: 'crm', requiredFeature: 'crmEnabled' },
  { href: '/deals',         icon: TrendingUp, group: 'crm', requiredFeature: 'crmEnabled' },
  { href: '/customers/merge', icon: GitMerge, group: 'crm', requiredFeature: 'crmEnabled', roleAllowed: ['admin', 'ceo', 'manager'] },

  // PROJECTS / "Terep és műveletek" (4 — /projects a daily-be ment)
  { href: '/work-orders', icon: HardHat,   group: 'projects', requiredFeature: 'workOrdersEnabled' },
  { href: '/map',         icon: MapIcon,   group: 'projects' },
  { href: '/notam',       icon: Plane,     group: 'projects', requiredFeature: 'notamEnabled' },
  { href: '/drone',       icon: Plane,     group: 'projects', requiredFeature: 'droneEnabled' },

  // DOCUMENTS / "Dokumentumtár" (3) — Boost-sprint utáni rendezés: a 3 fájl-kezelő
  // modul egy saját collapsable csoportba, mert ugyanazon koncept-szuper-kategória
  // (a 3 page tetején tab-bar köti össze őket). A korábbi /uploads/duplicates
  // sub-page KIKERÜLT a sidebar-ból — a Feltöltések header-en gombbal érhető el,
  // ami helyesebben tükrözi hogy az nem önálló modul, csak az uploads-ot kiszolgáló eszköz.
  { href: '/documents',   icon: FileText,  group: 'documents' },
  { href: '/uploads',     icon: Upload,    group: 'documents' },
  { href: '/shares',      icon: Share2,    group: 'documents' },

  // FINANCE (6)
  { href: '/jutalek',        icon: Wallet,     group: 'finance', requiredFeature: 'commissionEnabled', roleAllowed: ['admin', 'ceo'] },
  { href: '/invoices',       icon: Wallet,     group: 'finance', requiredFeature: 'crmInvoicingEnabled' },
  { href: '/finances',       icon: DollarSign, group: 'finance', requiredFeature: 'crmInvoicingEnabled' },
  { href: '/timesheets',     icon: Clock,      group: 'finance', requiredFeature: 'crmEnabled' },
  { href: '/resources',      icon: Wrench,     group: 'finance', requiredFeature: 'crmEnabled' },
  { href: '/internal-tasks', icon: ListChecks, group: 'finance', requiredFeature: 'internalTasksEnabled' },

  // ADMIN (8)
  { href: '/users',                      icon: Users,         group: 'admin', roleAllowed: ['admin', 'ceo', 'manager'] },
  { href: '/settings',                   icon: Settings,      group: 'admin' },
  { href: '/settings/roles',             icon: Shield,        group: 'admin', roleAllowed: ['admin', 'ceo'] },
  { href: '/settings/pipeline-config',   icon: GitBranch,     group: 'admin', roleAllowed: ['admin', 'ceo'] },
  { href: '/settings/audit',             icon: ClipboardList, group: 'admin', roleAllowed: ['admin', 'ceo'] },
  { href: '/settings/integrations',      icon: Plug,          group: 'admin', roleAllowed: ['admin', 'ceo'] },
  { href: '/settings/webhooks',          icon: Zap,           group: 'admin', roleAllowed: ['admin'] },
  { href: '/settings/email-templates',   icon: Mail,          group: 'admin', roleAllowed: ['admin', 'ceo'] },
  { href: '/settings/project-templates', icon: FileText,      group: 'admin', roleAllowed: ['admin', 'ceo', 'manager'] },
  { href: '/diagnostic',                 icon: ClipboardList, group: 'admin', roleAllowed: ['admin'] },
];

/* ── Csoport-meta ────────────────────────────────────────────── */
export const GROUPS: { id: GroupId; label: Record<LocaleCode, string>; }[] = [
  { id: 'daily',    label: { hu: 'Napi munka',      en: 'Daily',        it: 'Quotidiano' } },
  { id: 'sales',    label: { hu: 'Értékesítés',     en: 'Sales',        it: 'Vendite' } },
  { id: 'crm',      label: { hu: 'CRM',             en: 'CRM',          it: 'CRM' } },
  { id: 'projects',  label: { hu: 'Terep és műveletek', en: 'Field & Ops', it: 'Campo e operazioni' } },
  { id: 'documents', label: { hu: 'Dokumentumtár',     en: 'Document Hub', it: 'Archivio documenti' } },
  { id: 'finance',   label: { hu: 'Pénzügy',           en: 'Finance',      it: 'Finanze' } },
  { id: 'admin',    label: { hu: 'Adminisztráció',  en: 'Admin',        it: 'Amministrazione' } },
];

/* ── NAV_LABELS: href -> per-locale szoveg ───────────────────── */
export const NAV_LABELS: Record<string, Record<LocaleCode, string>> = {
  '/dashboard':      { hu: 'Mai napom',     en: 'My Day',       it: 'La mia giornata' },
  '/projects':       { hu: 'Projektek',     en: 'Projects',     it: 'Progetti'      },
  '/rooms':          { hu: 'Szobák',        en: 'Rooms',        it: 'Stanze'        },
  '/customers':      { hu: 'Ügyfelek',      en: 'Customers',    it: 'Clienti'       },
  '/customers/merge':{ hu: 'Duplikátum-egyesítés', en: 'Merge duplicates', it: 'Unisci duplicati' },
  '/accounts':       { hu: 'Fiókok (B2B)',  en: 'Accounts',     it: 'Account'       },
  '/crm/dashboard':  { hu: 'CRM Vezérlőpult', en: 'CRM Dashboard', it: 'CRM Dashboard' },
  '/settings/audit': { hu: 'Audit napló',     en: 'Audit Log',    it: 'Audit Log'     },
  '/settings/integrations': { hu: 'Integrációk', en: 'Integrations', it: 'Integrazioni' },
  '/meeting':        { hu: 'Projekt map',     en: 'Project map',  it: 'Mappa progetti' },
  '/jutalek':        { hu: 'Jutalék',         en: 'Commission',   it: 'Provvigione'   },
  '/settings/webhooks':        { hu: 'Webhookok',        en: 'Webhooks',         it: 'Webhook'          },
  '/settings/email-templates': { hu: 'E-mail sablonok',  en: 'Email Templates',  it: 'Modelli email'    },
  '/settings/project-templates': { hu: 'Projektsablonok', en: 'Project Templates', it: 'Modelli progetto' },
  '/contracts':      { hu: 'Szerződések',   en: 'Contracts',    it: 'Contratti'     },
  '/pricing':        { hu: 'Árazógép',      en: 'Pricing Engine', it: 'Motore prezzi' },
  '/referrals':      { hu: 'Meghívók',      en: 'Referrals',    it: 'Inviti'        },
  '/map':            { hu: 'Térkép',        en: 'Map',          it: 'Mappa'         },
  '/notam':          { hu: 'NOTAM',         en: 'NOTAM',        it: 'NOTAM'         },
  '/uploads':        { hu: 'Feltöltések',   en: 'Uploads',      it: 'Caricamenti'   },
  '/uploads/duplicates': { hu: 'Fájl-duplikátumok', en: 'File duplicates', it: 'Duplicati file' },
  '/documents':      { hu: 'Dokumentumok',  en: 'Documents',    it: 'Documenti'     },
  '/shares':         { hu: 'Megosztások',   en: 'Shares',       it: 'Condivisioni'  },
  '/users':          { hu: 'Felhasználók',  en: 'Users',        it: 'Utenti'        },
  '/settings':       { hu: 'Beállítások',   en: 'Settings',     it: 'Impostazioni'  },
  '/settings/roles': { hu: 'Jogosultságok', en: 'Permissions',  it: 'Permessi'      },
  '/settings/pipeline-config': { hu: 'Pipeline-szerkesztő', en: 'Pipeline Editor', it: 'Editor Pipeline' },
  '/work-orders':    { hu: 'Munkalapok',    en: 'Work Orders',  it: 'Ordini di Lavoro' },
  '/diagnostic':     { hu: 'Dev státusz',   en: 'Dev Status',   it: 'Dev Status'    },
  '/tasks':          { hu: 'Feladataim',    en: 'My Tasks',     it: 'I miei compiti'},
  '/activities':     { hu: 'Tevékenységek', en: 'Activities',   it: 'Attività'      },
  '/deals':          { hu: 'Ügyletek',      en: 'Deals',        it: 'Affari'        },
  '/pipelines':      { hu: 'Pipeline-ok',   en: 'Pipelines',    it: 'Pipeline'      },
  '/quotes':         { hu: 'Árajánlatok',   en: 'Quotes',       it: 'Preventivi'    },
  '/invoices':       { hu: 'Számlák',       en: 'Invoices',     it: 'Fatture'       },
  '/timesheets':     { hu: 'Munkaidő',      en: 'Timesheets',   it: 'Ore di lavoro' },
  '/resources':      { hu: 'Erőforrások',   en: 'Resources',    it: 'Risorse'       },
  '/finances':       { hu: 'Pénzügyek',     en: 'Finances',     it: 'Finanze'       },
  '/internal-tasks': { hu: 'Belső feladatok', en: 'Internal Tasks', it: 'Task interni' },
  '/drone':          { hu: 'Drone repülések', en: 'Drone Ops',      it: 'Operazioni drone' },
};

/* ── Sorrend egyesitese ─────────────────────────────────────── */
export function getOrderedItemsForGroup(
  groupId: GroupId,
  configOrder?: Partial<Record<GroupId, string[]>>,
): NavItem[] {
  const def = ALL_ITEMS.filter(i => i.group === groupId);
  const override = configOrder?.[groupId];
  if (!override) return def;
  const byHref = new Map<string, NavItem>();
  for (const i of def) byHref.set(i.href, i);
  const inOrder = override.map(h => byHref.get(h)).filter(Boolean) as NavItem[];
  const orderedHrefs = new Set(override);
  const rest = def.filter(i => !orderedHrefs.has(i.href));
  return [...inOrder, ...rest];  // uj item-ek a vegere
}

/* ── Defenziv parser users.settings JSONB-bol ───────────────── */
export function parseSidebarConfig(raw: unknown): SidebarConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_SIDEBAR_CONFIG;
  const r = raw as any;
  return {
    hidden: Array.isArray(r.hidden)
      ? r.hidden.filter((x: unknown): x is string => typeof x === 'string')
      : DEFAULT_SIDEBAR_CONFIG.hidden,
    order: r.order && typeof r.order === 'object' ? r.order : {},
    collapsedGroups: Array.isArray(r.collapsedGroups)
      ? r.collapsedGroups.filter((x: any) =>
          ['daily', 'sales', 'crm', 'projects', 'documents', 'finance', 'admin'].includes(x),
        )
      : DEFAULT_SIDEBAR_CONFIG.collapsedGroups,
    groupLabels: r.groupLabels && typeof r.groupLabels === 'object'
      ? Object.fromEntries(
          Object.entries(r.groupLabels)
            .filter(([k, v]) =>
              ['daily', 'sales', 'crm', 'projects', 'documents', 'finance', 'admin'].includes(k)
              && typeof v === 'string'
              && (v as string).trim().length > 0
              && (v as string).length <= 40,
            ),
        ) as Partial<Record<GroupId, string>>
      : {},
  };
}
