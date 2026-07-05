import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Admin nézet-szimulátor — frontend-only impersonation.
 *
 * Az admin felhasználó kiválaszthat egy másik szerepkört (pl. "client"),
 * és a UI ÚGY viselkedik, mintha ő abban a szerepkörben lenne — gombok
 * elrejtődnek/megjelennek a `useCanAccess()` szerint. Az API hívások
 * azonban TOVÁBBRA IS az admin tényleges JWT-jével mennek (nincs
 * impersonation header), így a backend-403-ok nem fognak fellépni.
 *
 * Cél: a UI-megjelenés tesztelése. Adatszintű impersonation NINCS.
 *
 * Tárolás: sessionStorage — tab-zárásra eltűnik, page-reload megőrzi.
 */

export type ImpersonatedRole =
  | 'admin' | 'ceo' | 'manager' | 'operative' | 'client';

interface ImpersonationState {
  impersonatedRole: ImpersonatedRole | null;
  setImpersonation: (role: ImpersonatedRole | null) => void;
  clearImpersonation: () => void;
}

export const useImpersonationStore = create<ImpersonationState>()(
  persist(
    (set) => ({
      impersonatedRole: null,
      setImpersonation: (role) => set({ impersonatedRole: role }),
      clearImpersonation: () => set({ impersonatedRole: null }),
    }),
    {
      name: 'dimop-impersonation',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.sessionStorage : (undefined as unknown as Storage),
      ),
    },
  ),
);
