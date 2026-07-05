import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      toggle: () => {
        const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: next });
        applyTheme(next);
      },
    }),
    { name: 'dimop-theme' }
  )
);

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/** Hívd meg egyszer a kliens oldalon — visszaállítja a mentett témát FOUC nélkül */
export function initTheme() {
  try {
    const raw = localStorage.getItem('dimop-theme');
    const theme: Theme = raw ? (JSON.parse(raw)?.state?.theme ?? 'light') : 'light';
    applyTheme(theme);
  } catch {
    // ignore
  }
}
