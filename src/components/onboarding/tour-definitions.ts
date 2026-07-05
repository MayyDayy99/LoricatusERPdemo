import type { UserRole } from '@/lib/onboarding-store';

/* ── Types ─────────────────────────────────────────────────── */

export interface TourStep {
  element: string;          // CSS selector (data-tour attribute)
  popover: {
    title: string;          // i18n key path e.g. 'tutorial.ceoTour.step1Title'
    description: string;    // i18n key path
    side?: 'top' | 'bottom' | 'left' | 'right';
    align?: 'start' | 'center' | 'end';
  };
}

export interface TourModule {
  id: string;
  icon: string;            // lucide icon name
  steps: TourStep[];
}

/* ── Role-specific main tours ──────────────────────────────── */

export const MAIN_TOURS: Record<UserRole, TourStep[]> = {
  admin: [
    {
      element: '[data-tour="stats-bar"]',
      popover: {
        title: 'tutorial.adminTour.step1Title',
        description: 'tutorial.adminTour.step1Desc',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="sidebar-sales"]',
      popover: {
        title: 'tutorial.adminTour.step2Title',
        description: 'tutorial.adminTour.step2Desc',
        side: 'right',
      },
    },
    {
      element: '[data-tour="sidebar-operations"]',
      popover: {
        title: 'tutorial.adminTour.step3Title',
        description: 'tutorial.adminTour.step3Desc',
        side: 'right',
      },
    },
    {
      element: '[data-tour="sidebar-settings"]',
      popover: {
        title: 'tutorial.adminTour.step4Title',
        description: 'tutorial.adminTour.step4Desc',
        side: 'right',
      },
    },
    {
      element: '[data-tour="sidebar-help"]',
      popover: {
        title: 'tutorial.adminTour.step5Title',
        description: 'tutorial.adminTour.step5Desc',
        side: 'right',
      },
    },
  ],

  ceo: [
    {
      element: '[data-tour="stats-bar"]',
      popover: {
        title: 'tutorial.ceoTour.step1Title',
        description: 'tutorial.ceoTour.step1Desc',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="deals-widget"]',
      popover: {
        title: 'tutorial.ceoTour.step2Title',
        description: 'tutorial.ceoTour.step2Desc',
        side: 'right',
      },
    },
    {
      element: '[data-tour="team-utilization"]',
      popover: {
        title: 'tutorial.ceoTour.step3Title',
        description: 'tutorial.ceoTour.step3Desc',
        side: 'left',
      },
    },
  ],

  manager: [
    {
      element: '[data-tour="sidebar-sales"]',
      popover: {
        title: 'tutorial.managerTour.step1Title',
        description: 'tutorial.managerTour.step1Desc',
        side: 'right',
      },
    },
    {
      element: '[data-tour="sidebar-customers"]',
      popover: {
        title: 'tutorial.managerTour.step2Title',
        description: 'tutorial.managerTour.step2Desc',
        side: 'right',
      },
    },
    {
      element: '[data-tour="sidebar-deals"]',
      popover: {
        title: 'tutorial.managerTour.step3Title',
        description: 'tutorial.managerTour.step3Desc',
        side: 'right',
      },
    },
    {
      element: '[data-tour="sidebar-operations"]',
      popover: {
        title: 'tutorial.managerTour.step4Title',
        description: 'tutorial.managerTour.step4Desc',
        side: 'right',
      },
    },
    {
      element: '[data-tour="sidebar-help"]',
      popover: {
        title: 'tutorial.managerTour.step5Title',
        description: 'tutorial.managerTour.step5Desc',
        side: 'right',
      },
    },
  ],

  operative: [
    {
      element: '[data-tour="sidebar-operations"]',
      popover: {
        title: 'tutorial.operativeTour.step1Title',
        description: 'tutorial.operativeTour.step1Desc',
        side: 'right',
      },
    },
    {
      element: '[data-tour="sidebar-tasks"]',
      popover: {
        title: 'tutorial.operativeTour.step2Title',
        description: 'tutorial.operativeTour.step2Desc',
        side: 'right',
      },
    },
    {
      element: '[data-tour="sidebar-timesheets"]',
      popover: {
        title: 'tutorial.operativeTour.step3Title',
        description: 'tutorial.operativeTour.step3Desc',
        side: 'right',
      },
    },
    {
      element: '[data-tour="sidebar-help"]',
      popover: {
        title: 'tutorial.operativeTour.step4Title',
        description: 'tutorial.operativeTour.step4Desc',
        side: 'right',
      },
    },
  ],

  client: [
    {
      element: '[data-tour="stats-bar"]',
      popover: {
        title: 'tutorial.clientTour.step1Title',
        description: 'tutorial.clientTour.step1Desc',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="sidebar-projects"]',
      popover: {
        title: 'tutorial.clientTour.step2Title',
        description: 'tutorial.clientTour.step2Desc',
        side: 'right',
      },
    },
    {
      element: '[data-tour="sidebar-help"]',
      popover: {
        title: 'tutorial.clientTour.step3Title',
        description: 'tutorial.clientTour.step3Desc',
        side: 'right',
      },
    },
  ],
};

/* ── Modular tours (for Help panel) ────────────────────────── */

export const MODULE_TOURS: TourModule[] = [
  {
    id: 'overview',
    icon: 'LayoutDashboard',
    steps: [
      { element: '[data-tour="stats-bar"]', popover: { title: 'tutorial.modules.overview.step1Title', description: 'tutorial.modules.overview.step1Desc', side: 'bottom' } },
      { element: '[data-tour="deals-widget"]', popover: { title: 'tutorial.modules.overview.step2Title', description: 'tutorial.modules.overview.step2Desc', side: 'bottom' } },
      { element: '[data-tour="team-utilization"]', popover: { title: 'tutorial.modules.overview.step3Title', description: 'tutorial.modules.overview.step3Desc', side: 'bottom' } },
    ],
  },
  {
    id: 'customers',
    icon: 'UserRound',
    steps: [
      { element: '[data-tour="sidebar-customers"]', popover: { title: 'tutorial.modules.customers.step1Title', description: 'tutorial.modules.customers.step1Desc', side: 'right' } },
      { element: '[data-tour="new-customer-btn"]', popover: { title: 'tutorial.modules.customers.step2Title', description: 'tutorial.modules.customers.step2Desc', side: 'bottom' } },
    ],
  },
  {
    id: 'deals',
    icon: 'TrendingUp',
    steps: [
      { element: '[data-tour="sidebar-deals"]', popover: { title: 'tutorial.modules.deals.step1Title', description: 'tutorial.modules.deals.step1Desc', side: 'right' } },
      { element: '[data-tour="deals-kanban"]', popover: { title: 'tutorial.modules.deals.step2Title', description: 'tutorial.modules.deals.step2Desc', side: 'bottom' } },
    ],
  },
  {
    id: 'finances',
    icon: 'Wallet',
    steps: [
      { element: '[data-tour="sidebar-finances"]', popover: { title: 'tutorial.modules.finances.step1Title', description: 'tutorial.modules.finances.step1Desc', side: 'right' } },
      { element: '[data-tour="finances-tabs"]', popover: { title: 'tutorial.modules.finances.step2Title', description: 'tutorial.modules.finances.step2Desc', side: 'bottom' } },
    ],
  },
  {
    id: 'tasks',
    icon: 'CheckSquare',
    steps: [
      { element: '[data-tour="sidebar-tasks"]', popover: { title: 'tutorial.modules.tasks.step1Title', description: 'tutorial.modules.tasks.step1Desc', side: 'right' } },
      { element: '[data-tour="tasks-overdue"]', popover: { title: 'tutorial.modules.tasks.step2Title', description: 'tutorial.modules.tasks.step2Desc', side: 'bottom' } },
    ],
  },
  {
    id: 'timesheets',
    icon: 'Clock',
    steps: [
      { element: '[data-tour="sidebar-timesheets"]', popover: { title: 'tutorial.modules.timesheets.step1Title', description: 'tutorial.modules.timesheets.step1Desc', side: 'right' } },
      { element: '[data-tour="timesheets-summary"]', popover: { title: 'tutorial.modules.timesheets.step2Title', description: 'tutorial.modules.timesheets.step2Desc', side: 'bottom' } },
    ],
  },
  {
    id: 'resources',
    icon: 'Wrench',
    steps: [
      { element: '[data-tour="sidebar-resources"]', popover: { title: 'tutorial.modules.resources.step1Title', description: 'tutorial.modules.resources.step1Desc', side: 'right' } },
      { element: '[data-tour="resources-equip"]', popover: { title: 'tutorial.modules.resources.step2Title', description: 'tutorial.modules.resources.step2Desc', side: 'bottom' } },
    ],
  },
];
