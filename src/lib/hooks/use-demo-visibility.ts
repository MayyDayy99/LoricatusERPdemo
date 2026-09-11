import { useEffect, useState } from 'react';
import { useCurrentUser } from './use-users';

/**
 * Demó-adat betöltő gombok láthatóság-vezérlése.
 *
 * A tenant-üzemben (éles kereskedelmi ügyfeleknél) NEM kívánatos, hogy a felhasználók
 * véletlenül demó-adatot töltsenek be a saját éles környezetükbe. Két rétegű védelem:
 *
 * 1. **Admin-only**: NEM-`admin` szerepű user SOHA nem lát demó-betöltés gombot,
 *    a `showDemoButtons` mindig `false`.
 * 2. **Explicit opt-in**: admin user is CSAK akkor lát demó-gombokat, ha a settings-ben
 *    bekapcsolta (`localStorage.settings.showDemoButtons === 'true'`). Alapból KI van kapcsolva.
 *
 * A localStorage-alapú perzisztálás böngésző-lokális — ha az admin új gépről jelentkezik be,
 * újra be kell kapcsolnia. Ez szándékos: nem tenant-szintű beállítás, hanem "dev-mode a saját
 * gépemen" flag.
 */

const STORAGE_KEY = 'settings.showDemoButtons';

export function useDemoVisibility() {
  const { currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const [enabled, setEnabledState] = useState(false);

  // Storage-ból inicializálás CSAK a kliens-oldalon (SSR-t elkerülve)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setEnabledState(window.localStorage.getItem(STORAGE_KEY) === 'true');
  }, []);

  const setEnabled = (next: boolean) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, String(next));
    setEnabledState(next);
  };

  return {
    /** Végleges látható-e: admin + explicit opt-in. Ezt olvassa minden gomb-render. */
    showButtons: isAdmin && enabled,
    /** Admin-e a user (a toggle csak ő számára jelenik meg a settings-ben). */
    isAdmin,
    /** Az explicit toggle állapota — a settings kapcsoló ezen dolgozik. */
    enabled,
    setEnabled,
  };
}
