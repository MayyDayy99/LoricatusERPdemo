// Kanonikus contract lifecycle-state lista. NEM page-file-ban él, mert a Next.js
// 15 page-export validáció csak `default` + meghatározott metadata-mezőket enged.
//
// Label-szöveget az i18n adja (`t.contracts.state[state]`); ez a tömb csak
// a state-kulcsok + style-osztályok kanonikus listája.

export const CONTRACT_STATES = [
  'draft',
  'active',
  'expired',
  'terminated',
] as const;

export type ContractState = typeof CONTRACT_STATES[number];

export const CONTRACT_STATE_STYLES: Record<string, string> = {
  draft:      'bg-gray-100 text-gray-600',
  active:     'bg-green-100 text-green-700',
  expired:    'bg-yellow-100 text-yellow-700',
  terminated: 'bg-red-100 text-red-700',
};
