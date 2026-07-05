import { useCurrentUser } from './use-users';
import { useImpersonationStore } from '../impersonation-store';

/**
 * Az effektív szerepkör — amit a UI permission-checkek használnak.
 *
 * Ha a current user admin (vagy super_admin) ÉS aktív impersonation van
 * a sessionStorage-ben, az impersonatedRole-t adja vissza. Egyébként
 * a tényleges `currentUser.role`-t.
 *
 * Adatban (API hívások) NEM jelent semmit — a JWT változatlan.
 */
export function useEffectiveRole(): string | null {
  const { currentUser } = useCurrentUser();
  const impersonatedRole = useImpersonationStore(s => s.impersonatedRole);
  if (!currentUser) return null;
  const realRole = currentUser.role;
  if (impersonatedRole && (realRole === 'admin' || realRole === 'super_admin')) {
    return impersonatedRole;
  }
  return realRole;
}

/** A "valódi" szerepkör — a JWT-ben kódolt eredeti, soha nem felülírt érték. */
export function useRealRole(): string | null {
  const { currentUser } = useCurrentUser();
  return currentUser?.role ?? null;
}

/** Csak admin vagy super_admin kapcsolhatja be az impersonation-t. */
export function useCanImpersonate(): boolean {
  const real = useRealRole();
  return real === 'admin' || real === 'super_admin';
}
