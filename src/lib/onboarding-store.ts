import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ── Types ─────────────────────────────────────────────────── */

export type TourState = 'not_started' | 'in_progress' | 'completed' | 'dismissed';
export type UserRole = 'admin' | 'ceo' | 'manager' | 'operative' | 'client';

export interface ChecklistState {
  createdCustomer: boolean;
  createdProject: boolean;
  createdDeal: boolean;
  loggedTimesheet: boolean;
  generatedDocument: boolean;
}

interface OnboardingState {
  /* Layer 1 — Welcome + Guided Tour */
  mainTour: TourState;
  mainTourStep: number;
  selectedRole: UserRole | null;

  /* Welcome modal visibility (transient, not persisted) */
  welcomeModalOpen: boolean;

  /* Layer 2 — Contextual tips */
  seenTips: Record<string, boolean>;

  /* Layer 3 — Module tours */
  moduleTours: Record<string, 'not_started' | 'completed'>;

  /* Checklist */
  checklist: ChecklistState;
  checklistDismissed: boolean;

  /* Meta */
  firstLoginAt: string | null;

  /* Actions */
  openWelcomeModal: () => void;
  closeWelcomeModal: () => void;
  startMainTour: (role: UserRole) => void;
  advanceMainTour: (step: number) => void;
  completeMainTour: () => void;
  dismissMainTour: () => void;
  markTipSeen: (tipId: string) => void;
  completeModuleTour: (tourId: string) => void;
  updateChecklist: (key: keyof ChecklistState, value: boolean) => void;
  dismissChecklist: () => void;
  resetOnboarding: () => void;
}

const INITIAL_CHECKLIST: ChecklistState = {
  createdCustomer: false,
  createdProject: false,
  createdDeal: false,
  loggedTimesheet: false,
  generatedDocument: false,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      mainTour: 'not_started',
      mainTourStep: 0,
      selectedRole: null,
      welcomeModalOpen: false,
      seenTips: {},
      moduleTours: {},

      openWelcomeModal: () => set({ welcomeModalOpen: true }),
      closeWelcomeModal: () => set({ welcomeModalOpen: false }),
      checklist: { ...INITIAL_CHECKLIST },
      checklistDismissed: false,
      firstLoginAt: null,

      startMainTour: (role) =>
        set({
          mainTour: 'in_progress',
          selectedRole: role,
          mainTourStep: 0,
          welcomeModalOpen: false,
          firstLoginAt: new Date().toISOString(),
        }),

      advanceMainTour: (step) =>
        set({ mainTourStep: step }),

      completeMainTour: () =>
        set({ mainTour: 'completed' }),

      dismissMainTour: () =>
        set({ mainTour: 'dismissed', welcomeModalOpen: false }),

      markTipSeen: (tipId) =>
        set((s) => ({ seenTips: { ...s.seenTips, [tipId]: true } })),

      completeModuleTour: (tourId) =>
        set((s) => ({ moduleTours: { ...s.moduleTours, [tourId]: 'completed' } })),

      updateChecklist: (key, value) =>
        set((s) => ({ checklist: { ...s.checklist, [key]: value } })),

      dismissChecklist: () =>
        set({ checklistDismissed: true }),

      resetOnboarding: () =>
        set({
          mainTour: 'not_started',
          mainTourStep: 0,
          selectedRole: null,
          welcomeModalOpen: false,
          seenTips: {},
          moduleTours: {},
          checklist: { ...INITIAL_CHECKLIST },
          checklistDismissed: false,
          firstLoginAt: null,
        }),
    }),
    {
      name: 'dimop-onboarding',
      partialize: (state: OnboardingState) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { welcomeModalOpen, openWelcomeModal, closeWelcomeModal, ...rest } = state;
        // Never persist `in_progress`: rehydrating a half-finished tour on a route
        // that lacks the anchors covers the page in a driver.js overlay that
        // `pointer-events:none`-s every click (silent dead UI).
        return {
          ...rest,
          mainTour: rest.mainTour === 'in_progress' ? 'dismissed' : rest.mainTour,
        };
      },
    },
  ),
);
