// Sprint 4 β₁: kanonikus share-status + share-scope szettek + style-mapping.
//
// A backend `ShareLinkStatus` enum (packages/domain/src/entities/share-link.entity.ts)
// értékeit követjük 1:1-ben. A label-szöveg az i18n-ből jön
// (`t.shares.status[s]`, `t.shares.scope[s]`); ez a modul csak a kulcsok +
// Tailwind-osztályok kanonikus listáját adja, és NEM page-file-ban él, mert
// a Next.js 15 page-export validáció a `default` exporton kívül csak
// szigorú metadata-mezőket enged.
//
// A precedens a customer-lifecycle.ts + upload-lifecycle.ts.

export const SHARE_STATUSES = [
  'active',
  'revoked',
  'expired',
] as const;

export type ShareStatusKey = typeof SHARE_STATUSES[number];

/**
 * A 3 állapot Tailwind-osztály mapping-je. Az "active" zöld (élő), a "revoked"
 * piros (admin-akció), az "expired" sárga (idő-/limit-alapú). Konzisztens a
 * customer-lifecycle + upload-lifecycle palettával.
 */
export const SHARE_STATUS_STYLES: Record<ShareStatusKey, string> = {
  active:  'bg-green-100 text-green-700',
  revoked: 'bg-red-100 text-red-700',
  expired: 'bg-yellow-100 text-yellow-700',
};

// A backend `ShareScope` enum értékei. A korábbi (Sprint 3) verzió csak
// upload/project/document-et ismert; a Sprint 4 hozza a calculator +
// work_order opciókat, így a lista-modal scope-dropdown teljes.
export const SHARE_SCOPES = [
  'upload',
  'project',
  'document',
  'calculator',
  'work_order',
] as const;

export type ShareScopeKey = typeof SHARE_SCOPES[number];

/**
 * Hatókör badge-színek. A 5 erőforrás-típus konzisztens a Documents/Uploads
 * páros korábbi színeivel (upload=kék, document=narancs), a 3 új scope egyedi
 * színt kap.
 */
export const SHARE_SCOPE_STYLES: Record<ShareScopeKey, string> = {
  upload:     'bg-blue-100 text-blue-700',
  project:    'bg-purple-100 text-purple-700',
  document:   'bg-orange-100 text-orange-700',
  calculator: 'bg-teal-100 text-teal-700',
  work_order: 'bg-amber-100 text-amber-700',
};
