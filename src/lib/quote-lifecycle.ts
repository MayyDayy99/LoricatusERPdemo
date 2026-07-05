// Kanonikus quote lifecycle-state lista. NEM page-file-ban él, mert a Next.js
// 15 page-export validáció csak `default` + meghatározott metadata-mezőket enged.
//
// Label-szöveget az i18n adja (`t.quotes.state[state]`); ez a tömb csak
// a state-kulcsok + style-osztályok kanonikus listája.

export const QUOTE_STATES = [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
] as const;

export type QuoteState = typeof QUOTE_STATES[number];

export const QUOTE_STATE_STYLES: Record<string, string> = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired:  'bg-yellow-100 text-yellow-700',
};
