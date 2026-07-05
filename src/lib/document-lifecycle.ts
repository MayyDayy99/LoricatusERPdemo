// Sprint 3 β₁ — kanonikus document-lifecycle state-lista (a customer-lifecycle
// modul mintájára). NEM page-file-ban él, mert a Next.js 15 page-export validáció
// csak `default` + meghatározott metadata-mezőket enged.
//
// A label-szöveget az i18n adja (`t.documents.stateLabels[state]`); ez a tömb csak
// a state-kulcsok + style-osztályok kanonikus listája. A state-string lower-case-
// ben jön a backenddől (DocumentState enum-value), így a STATE_STYLES kulcsa
// 'draft' | 'generated' | 'sent' | 'superseded'.

export const DOCUMENT_STATES = [
  'draft',
  'generated',
  'sent',
  'superseded',
] as const;

export type DocumentState = typeof DOCUMENT_STATES[number];

// A DocumentType enum-érték a packages/domain/src/entities/document.entity.ts-ben él
// (SAFETY_REPORT, INSPECTION_REPORT, PERMIT, CONTRACT, HANDOVER, INCIDENT, NOTAM,
//  CUSTOM, WORK_ORDER_PDF, QUOTE_PDF, INVOICE_PDF, CONTRACT_PDF). A frontend csak
// a leggyakoribb hetet exponálja a type-select UI-ban — a generated PDF-fajták
// (WORK_ORDER_PDF / INVOICE_PDF / QUOTE_PDF / CONTRACT_PDF) backend-belül jönnek
// létre, nem user-választhatók.
export const DOCUMENT_TYPES = [
  'safety_report',
  'inspection_report',
  'permit',
  'contract',
  'handover',
  'incident',
  'notam',
  'custom',
] as const;

export type DocumentType = typeof DOCUMENT_TYPES[number];

// Customer-lifecycle precedens: a STATE_STYLES mapping a vizuális badge-szín,
// külön a két modul között, hogy a Sprint 3 audit-design-rendszer (zöld=ok,
// kék=info, narancs=warn, szürke=neutral) konzisztens maradjon.
export const DOCUMENT_STATE_STYLES: Record<string, string> = {
  draft:      'bg-gray-100 text-gray-600',
  generated:  'bg-blue-100 text-blue-700',
  sent:       'bg-green-100 text-green-700',
  superseded: 'bg-orange-100 text-orange-700',
};
