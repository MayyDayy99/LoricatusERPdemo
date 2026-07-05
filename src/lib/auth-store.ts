import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { IS_DEMO, DEMO_TOKEN, DEMO_TENANT_ID } from './demo/config';

interface AuthState {
  accessToken: string | null;
  tenantId: string | null;
  _hasHydrated: boolean;
  setAuth: (accessToken: string, tenantId?: string) => void;
  clearAuth: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // DEMÓ MÓD: már beléptetett kezdőállapot, hogy az app azonnal használható
      // legyen valós backend / bejelentkezés nélkül.
      accessToken: IS_DEMO ? DEMO_TOKEN : null,
      tenantId: IS_DEMO ? DEMO_TENANT_ID : null,
      _hasHydrated: false,
      setAuth: (accessToken, tenantId) =>
        // KRITIKUS: ha nincs új tenantId, MEGŐRIZZÜK a meglévőt. Különben
        // minden silent-refresh (ami csak accessToken-t kap vissza) törölné
        // a tenantId-t → x-tenant-id header eltűnik → 401 → újabb refresh
        // → végtelen loop, ami percek alatt elhasználja a session-t.
        set((state) => ({
          accessToken,
          tenantId: tenantId !== undefined ? tenantId : state.tenantId,
        })),
      clearAuth: () => {
        // Demóban a "kijelentkezés" nem hagyhat holt session-t: visszaléptet a
        // login oldalra, de a demó-token elérhető marad (a login "Démó belépés").
        if (IS_DEMO) {
          set({ accessToken: null, tenantId: DEMO_TENANT_ID });
          if (typeof window !== 'undefined') window.location.href = '/login';
          return;
        }
        set({ accessToken: null, tenantId: null });
        if (typeof window !== 'undefined') window.location.href = '/login';
      },
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'auth-storage',
      // accessToken lives in memory only — never written to localStorage.
      // Reason: XSS-sel ellopható lenne. A 15 perces TTL sem véd eleget.
      // tenantId nem szenzitív adat, sessionként hasznos megőrizni.
      partialize: (state) => ({ tenantId: state.tenantId }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
