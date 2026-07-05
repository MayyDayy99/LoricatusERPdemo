// Kanonikus customer lifecycle-stage lista. NEM page-file-ban él, mert a Next.js
// 15 page-export validáció csak `default` + meghatározott metadata-mezőket enged.
//
// Label-szöveget az i18n adja (`t.customers.lifecycle[stage]`); ez a tömb csak
// a stage-kulcsok + style-osztályok kanonikus listája.

export const LIFECYCLE_STAGES = [
  'lead',
  'subscriber',
  'marketing_qualified_lead',
  'sales_qualified_lead',
  'opportunity',
  'customer',
  'evangelist',
  'other',
] as const;

export type LifecycleStage = typeof LIFECYCLE_STAGES[number];

export const LIFECYCLE_STYLES: Record<string, string> = {
  lead:                     'bg-gray-100 text-gray-600',
  subscriber:               'bg-yellow-100 text-yellow-700',
  marketing_qualified_lead: 'bg-orange-100 text-orange-700',
  sales_qualified_lead:     'bg-blue-100 text-blue-700',
  opportunity:              'bg-purple-100 text-purple-700',
  customer:                 'bg-green-100 text-green-700',
  evangelist:               'bg-emerald-100 text-emerald-700',
  other:                    'bg-gray-100 text-gray-500',
};
