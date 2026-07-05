import useSWR from 'swr';
import { apiClient } from '../api-client';
import { useImpersonationStore } from '../impersonation-store';

/**
 * v2.2.0 frontend permission hook — DINAMIKUS, a backend
 * `/users/me/permissions` endpoint-ról kapja a permission-set-et SWR-en
 * keresztül. Megszűnik a korábbi backend↔frontend szakadás (ahol a frontend
 * statikus ALL_INTERNAL ALLOW-mátrixa nem egyezett a backend dinamikus
 * tenant_roles + user_permission_overrides döntésével).
 *
 * Impersonation (admin "Megrendelő-nézet"): a hook a `?impersonateRole=...`
 * query-paramot küldi, és a backend visszaadja a megadott role effektív
 * permission-set-jét. A tényleges API-hívások továbbra is a valódi user-rel
 * mennek — az impersonation szigorúan UI-szintű vizualizáció.
 *
 * Új UI-permission hozzáadásakor: bővítsd a `Permission` típust és a
 * `MAPPING`-et. A backend ROLE_PERMISSIONS-ben már adja-e jogosult a
 * resource:action stringet — a `useCanAccess` ellenőrzi.
 */
export type Permission =
  | 'crm.view'
  | 'crm.tasks.write'
  | 'crm.all_tasks'
  | 'crm.pipelines'
  | 'crm.write'
  | 'project-map.write'
  | 'users.manage';

/** UI-permission → backend permission-stringek listája (OR-eltetve). */
const MAPPING: Record<Permission, string[]> = {
  'crm.view':          ['customers:read', 'deals:read', 'activities:read'],
  'crm.tasks.write':   ['crm-tasks:create', 'crm-tasks:update'],
  'crm.all_tasks':     ['crm-tasks:read'],
  'crm.pipelines':     ['pipelines:update', 'pipelines:create'],
  'crm.write':         ['customers:create', 'customers:update', 'quotes:create', 'quotes:update'],
  'project-map.write': ['project-map:update', 'project-map:create'],
  'users.manage':      ['users:update', 'users:create', 'users:delete'],
};

interface MePermissions {
  role: string;
  customerId: string | null;
  permissions: string[];
}

const fetcher = async (url: string): Promise<MePermissions> => {
  const res = await apiClient.get(url);
  return res.data;
};

/** Hook: az aktuális (vagy impersonálni-kívánt) user effektív permission-set-jét adja vissza. */
export function useMyPermissions() {
  const impersonatedRole = useImpersonationStore((s) => s.impersonatedRole);
  const url = impersonatedRole
    ? `/users/me/permissions?impersonateRole=${encodeURIComponent(impersonatedRole)}`
    : '/users/me/permissions';
  const { data, error, isLoading, mutate } = useSWR<MePermissions>(
    url,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );
  return {
    role: data?.role,
    customerId: data?.customerId ?? null,
    permissions: data?.permissions ?? [],
    isLoading,
    error,
    mutate,
  };
}

/** Wildcard-aware match — egyezik a backend RbacPolicy.hasPermission-szel.
 *  Támogatott: `*`, `*:*`, `resource:*`, `resource:action`. */
function matches(permissions: string[], required: string): boolean {
  if (permissions.includes('*') || permissions.includes('*:*')) return true;
  if (permissions.includes(required)) return true;
  const [resource] = required.split(':');
  if (permissions.includes(`${resource}:*`)) return true;
  return false;
}

/**
 * Adott UI-permission megadása-e a felhasználónak (a backend dinamikus
 * permission-set-je alapján; impersonation-aware).
 *
 * Loading state alatt `false`-ot ad — a gomb a teljes set megérkezéséig
 * NEM jelenik meg (megengedett flicker a helyességért cserébe).
 */
export function useCanAccess(permission: Permission): boolean {
  const { permissions, isLoading } = useMyPermissions();
  if (isLoading) return false;
  const backendPerms = MAPPING[permission] ?? [];
  return backendPerms.some((p) => matches(permissions, p));
}
