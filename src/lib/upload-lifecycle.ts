// Kanonikus upload state-szett + style-mapping a Sprint 3 β₂-FE feladat
// részeként. A backend `UploadState` enum (packages/domain/src/state-machines/
// upload.state-machine.ts) értékeit követjük 1:1-ben.
//
// A label-szöveg az i18n-ből jön (`t.uploads.state[s]`); ez a modul csak a
// stage-kulcsok + style-osztályok kanonikus listáját adja, és NEM page-file-ban
// él, mert a Next.js 15 page-export validáció a `default` exporton kívül csak
// szigorú metadata-mezőket enged.
//
// A precedens a customer-lifecycle.ts.

export const UPLOAD_STATES = [
  'initiated',
  'uploading',
  'completed',
  'scanned',
  'available',
  'failed',
] as const;

export type UploadStateKey = typeof UPLOAD_STATES[number];

/**
 * A folyamat 6 állapotának Tailwind-osztály mapping-je. A border-szint csak
 * "available" + "failed" esetén kap erősebb sávot — a köztes (uploading /
 * completed / scanned) átmeneti, így halvány. Vízszintes szempontból
 * konzisztens a customer-lifecycle / contract-state precedenssel.
 */
export const UPLOAD_STATE_STYLES: Record<UploadStateKey, string> = {
  initiated: 'bg-gray-100 text-gray-600',
  uploading: 'bg-blue-100 text-blue-700',
  completed: 'bg-yellow-100 text-yellow-700',
  scanned:   'bg-teal-100 text-teal-700',
  available: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
};

// FileCategory enum (packages/domain/src/entities/upload.entity.ts). A 7
// kategória string-érték formában — a backend ezt fogadja a query/body-ban.
export const UPLOAD_CATEGORIES = [
  'plan',
  'photo',
  'video',
  'report',
  'document',
  'model_3d',
  'other',
] as const;

export type UploadCategory = typeof UPLOAD_CATEGORIES[number];
