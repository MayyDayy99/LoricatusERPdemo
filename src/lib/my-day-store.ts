'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MyDayPrefs {
  showCounterStrip: boolean;
  showWeekly: boolean;
  showKpiStrip: boolean;
}

interface MyDayState {
  /** null = még nincs felhasználói/alapérték; ensureDefaults tölti szerepkör szerint. */
  prefs: MyDayPrefs | null;
  setPref: (key: keyof MyDayPrefs, value: boolean) => void;
  ensureDefaults: (role: string | null | undefined) => void;
}

/** Szerepkör-alapú alapértelmezések. (KPI-sáv csak vezetőknek; heti előretekintés
 *  nem ügyfeleknek; számláló-sáv mindenkinek.) */
function defaultsForRole(role: string | null | undefined): MyDayPrefs {
  const isManager = role === 'admin' || role === 'ceo' || role === 'manager';
  return {
    showCounterStrip: true,
    showWeekly: role !== 'client',
    showKpiStrip: isManager,
  };
}

export const useMyDayStore = create<MyDayState>()(
  persist(
    (set, get) => ({
      prefs: null,
      setPref: (key, value) =>
        set((s) => ({
          prefs: { ...(s.prefs ?? defaultsForRole(null)), [key]: value },
        })),
      ensureDefaults: (role) => {
        if (get().prefs === null) set({ prefs: defaultsForRole(role) });
      },
    }),
    { name: 'loricatus-my-day' },
  ),
);
