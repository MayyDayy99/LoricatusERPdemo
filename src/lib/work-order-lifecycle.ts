// Kanonikus work order lifecycle-state lista. NEM page-file-ban él, mert a Next.js
// 15 page-export validáció csak `default` + meghatározott metadata-mezőket enged.
//
// Label-szöveget az i18n adja (`t.workOrders.state[state]`); ez a tömb csak
// a state-kulcsok + style-osztályok kanonikus listája.

export const WORK_ORDER_STATES = [
  'draft',
  'active',
  'completed',
  'cancelled',
  'archived',
] as const;

export type WorkOrderState = typeof WORK_ORDER_STATES[number];

export const WORK_ORDER_STATE_STYLES: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-600',
  active:    'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  archived:  'bg-yellow-100 text-yellow-700',
};
