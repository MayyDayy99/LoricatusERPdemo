'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  Sun, LogOut, Building2, HardHat, CheckSquare,
  HelpCircle, ChevronDown, ChevronRight, CalendarCheck,
  Smartphone, X, Menu,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { useCurrentUser } from '@/lib/hooks/use-users';
import { useEffectiveRole } from '@/lib/hooks/use-effective-role';
import { useTenant, type SidebarPoliciesByRole } from '@/lib/hooks/use-tenants';
import { useSidebarConfig } from '@/lib/hooks/use-sidebar-config';
import { LangPicker } from '@/components/ui/lang-picker';
import { useLangStore, type LocaleCode } from '@/lib/lang-store';
import {
  GROUPS,
  NAV_LABELS,
  CLIENT_ALLOWED_ROUTES,
  getOrderedItemsForGroup,
  type NavItem,
  type GroupId,
  type UserRoleLike,
} from './sidebar-config';

/**
 * Egységes nav-item osztály. Az aktív fülön: brand-háttér + félkövér szöveg +
 * bal oldali 4px brand-akcentcsík + lágy árnyék. A `border-l-4` az inaktív
 * elemen is ott van (transparent), így aktiváláskor nincs layout-eltolódás.
 */
function navItemClass(active: boolean, extra = 'py-2.5'): string {
  return clsx(
    // min-h-[44px]: WCAG / Apple touch-target baseline a mobile-tap-target-hez.
    'flex items-center gap-3 px-3 rounded-lg text-sm font-medium transition border-l-4 min-h-[44px]',
    active
      ? 'bg-brand-100 text-brand-800 font-semibold border-brand-600 shadow-sm'
      : 'text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-900',
    extra,
  );
}

const LOGOUT_LABEL: Record<LocaleCode, string> = {
  hu: 'Kijelentkezés', en: 'Sign Out', it: 'Esci',
};
const LANG_LABEL: Record<LocaleCode, string> = {
  hu: 'Nyelv', en: 'Language', it: 'Lingua',
};
const HELP_LABEL: Record<LocaleCode, string> = {
  hu: 'Súgó', en: 'Help', it: 'Aiuto',
};

/* ── Worker (operative) nav — meeting-centric view ─────────── */
const WORKER_NAV_LABELS: Record<string, Record<LocaleCode, string>> = {
  '/dashboard':    { hu: 'Mai napom',    en: 'My Day',       it: 'La mia giornata' },
  '/meeting':      { hu: 'Projekt map',  en: 'Project map',  it: 'Mappa'      },
  '/work-orders':  { hu: 'Munkalapok',   en: 'Work Orders',  it: 'Ordini'     },
  '/tasks':        { hu: 'Feladataim',   en: 'My Tasks',     it: 'Compiti'    },
};

const WORKER_NAV = [
  { href: '/dashboard',   icon: Sun },
  { href: '/meeting',     icon: CalendarCheck   },
  { href: '/work-orders', icon: HardHat         },
  { href: '/tasks',       icon: CheckSquare     },
];

/* ── NavGroup belso komponens ─────────────────────────────────
 * Kollapszibilis csoport-szekcio: header (label + chevron) + body
 * (nav-item lista). Az "aktiv ag" automatikusan kinyilik (transient,
 * nem perzisztal). Ha a header zarva van es belul aktiv elem ul, a
 * header maga is brand-akcentet kap, hogy a user lassa.
 */
function NavGroup({
  group,
  items,
  initiallyCollapsed,
  pathname,
  locale,
  customLabel,
}: {
  group: { id: GroupId; label: Record<LocaleCode, string> };
  items: NavItem[];
  initiallyCollapsed: boolean;
  pathname: string;
  locale: LocaleCode;
  customLabel?: string;
}) {
  const path = stripLocale(pathname);
  const groupHasActive = items.some(
    i => path === i.href || path.startsWith(i.href + '/'),
  );
  // initOpen: nyitva ha NEM collapsedGroups-ban van, VAGY ha az aktiv ut idebenn ul
  const [open, setOpen] = useState<boolean>(!initiallyCollapsed || groupHasActive);

  // Ha kozben uj path-ra navigalunk es most lett aktiv item idebenn → nyit
  useEffect(() => {
    if (groupHasActive) setOpen(true);
    // szandekosan nem ir vissza false-ra: a transient nyitas mar lezarult,
    // a user dontheti, hogy ujra becsukja-e.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupHasActive]);

  if (items.length === 0) return null;

  const label = customLabel?.trim() || group.label[locale] || group.label.hu;

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'flex items-center gap-2 w-full text-left transition',
          !open && groupHasActive
            ? 'bg-brand-50/60 text-brand-700 rounded-md border-l-2 border-brand-300 px-2 py-1.5'
            : 'text-gray-400 uppercase tracking-wide text-xs px-2 py-1.5 hover:text-gray-600',
        )}
        aria-expanded={open}
      >
        <span className="flex-1 uppercase tracking-wide text-xs font-semibold">
          {label}
        </span>
        {open
          ? <ChevronDown className="w-3.5 h-3.5 shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        }
      </button>

      {open && (
        <div className="mt-0.5 space-y-0.5">
          {items.map(({ href, icon: Icon, beta }) => {
            const itemLabel = NAV_LABELS[href]?.[locale] ?? NAV_LABELS[href]?.hu ?? href;
            const active = path === href || path.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={navItemClass(active, 'py-2')}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{itemLabel}</span>
                {beta && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 ml-auto">
                    BÉTA
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * A `/[locale]/...` route-okon (l. memory: project_locale_route_stubs) a
 * pathname `/hu/dashboard`, az `href` viszont `/dashboard`. Strippeljük le a
 * locale-prefixet, hogy a `pathname === href` match valóban legyen.
 */
function stripLocale(pathname: string): string {
  const stripped = pathname.replace(/^\/(hu|en|it)(\/|$)/, '/');
  return stripped.length > 1 && stripped.endsWith('/') ? stripped.slice(0, -1) : stripped;
}

export function Sidebar({
  onHelpClick,
  isMobileOpen = false,
  onMobileClose,
}: {
  onHelpClick?: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
} = {}) {
  const pathname = usePathname();
  const path = stripLocale(pathname);
  const { clearAuth } = useAuthStore();
  const { locale } = useLangStore();
  const { currentUser } = useCurrentUser();
  // v2.2.0 — admin nézet-szimulátor: ha impersonáció aktív, a sidebar a
  // szimulált szerepkör szerinti menüt mutatja. A tényleges API-hívások
  // továbbra is a valódi admin-tokennel mennek, csak a UI változik.
  const effectiveRoleLower = useEffectiveRole();
  const { tenant } = useTenant();
  const { config } = useSidebarConfig();

  const isWorker = effectiveRoleLower === 'operative';
  const flags = (tenant?.featureFlags ?? {}) as Record<string, boolean>;
  // useEffectiveRole nem-null ha currentUser betöltődött; null amíg nincs auth.
  const roleLower = effectiveRoleLower?.toLowerCase() as UserRoleLike | undefined;
  const rolePolicy = roleLower
    ? tenant?.metadata?.sidebarPoliciesByRole?.[roleLower as keyof SidebarPoliciesByRole]
    : undefined;
  const roleHidden = rolePolicy?.hidden ?? [];

  const isItemVisible = (it: NavItem): boolean => {
    if (it.requiredFeature && !flags[it.requiredFeature]) return false;
    if (it.roleAllowed && roleLower && !it.roleAllowed.includes(roleLower)) return false;
    // v2.2.0: a megrendelő (client) szerepkör explicit whitelisten van —
    // csak a 4 előre engedélyezett útvonal jelenik meg (árajánlat, szerződés,
    // munkalap, térkép). Minden más sidebar-item el van rejtve.
    if (roleLower === 'client' && !(CLIENT_ALLOWED_ROUTES as readonly string[]).includes(it.href)) return false;
    if (config.hidden.includes(it.href)) return false;
    if (roleHidden.includes(it.href)) return false;
    return true;
  };

  // Auto-close mobile drawer when navigating to a new path.
  useEffect(() => {
    if (isMobileOpen && onMobileClose) onMobileClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Mobile backdrop — visible only when drawer is open on small screens */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          'w-60 bg-white border-r border-gray-100 flex-col h-full shadow-sm',
          // Desktop: always visible as a sidebar in the flex layout
          'md:flex md:static md:z-auto',
          // Mobile: fixed drawer that slides in
          isMobileOpen ? 'fixed inset-y-0 left-0 z-50 flex' : 'hidden',
        )}
      >
      {/* Logo */}
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-6 h-6 text-brand-600" />
          <span className="font-semibold text-gray-900">Loricatus</span>
        </div>
        {/* Mobile close button — only inside the drawer on small screens.
            WCAG 44x44 touch-target. */}
        {onMobileClose && (
          <button
            type="button"
            onClick={onMobileClose}
            className="md:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] -mr-2 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 overflow-y-auto space-y-0.5">

        {/* ── Worker nézet (operative szerepkör) ───────────────── */}
        {isWorker && WORKER_NAV.map(({ href, icon: Icon }) => {
          const label = WORKER_NAV_LABELS[href]?.[locale] ?? WORKER_NAV_LABELS[href]?.hu ?? href;
          return (
            <Link
              key={href}
              href={href}
              className={navItemClass(path === href || path.startsWith(href + '/'))}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}

        {/* ── Standard nézet (admin / manager / egyéb) ─────────── */}
        {!isWorker && GROUPS.map(g => {
          const items = getOrderedItemsForGroup(g.id, config.order).filter(isItemVisible);
          return (
            <NavGroup
              key={g.id}
              group={g}
              items={items}
              initiallyCollapsed={config.collapsedGroups.includes(g.id)}
              pathname={pathname}
              locale={locale}
              customLabel={config.groupLabels?.[g.id]}
            />
          );
        })}
      </nav>

      {/* Bottom: help + language + logout */}
      <div className="p-4 border-t border-gray-100 space-y-2">
        {/* App link */}
        <Link
          href="/mobile-preview"
          className={clsx(
            'flex items-center gap-3 px-3 py-2 min-h-[44px] w-full text-sm font-medium rounded-lg transition',
            path === '/mobile-preview'
              ? 'bg-brand-50 text-brand-700'
              : 'text-gray-600 hover:bg-brand-50 hover:text-brand-700',
          )}
        >
          <Smartphone className="w-4 h-4" />
          <span className="flex-1">App</span>
        </Link>

        {onHelpClick && (
          <button
            type="button"
            onClick={onHelpClick}
            className="flex items-center gap-3 px-3 py-2 min-h-[44px] w-full text-sm font-medium text-gray-600 hover:bg-brand-50 hover:text-brand-700 rounded-lg transition"
          >
            <HelpCircle className="w-4 h-4" />
            {HELP_LABEL[locale]}
          </button>
        )}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-gray-400">{LANG_LABEL[locale]}</span>
          <LangPicker variant="icon" />
        </div>
        <button
          type="button"
          onClick={clearAuth}
          className="flex items-center gap-3 px-3 py-2.5 min-h-[44px] w-full text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
        >
          <LogOut className="w-4 h-4" />
          {LOGOUT_LABEL[locale]}
        </button>
      </div>
      </aside>
    </>
  );
}

/**
 * Mobile hamburger toggle — render in the header on small screens. WCAG 44x44
 * touch-target (p-2.5 ≈ 40px content + padding ≈ 44px hit area).
 */
export function MobileMenuToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="md:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 transition"
      aria-label="Open menu"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}
