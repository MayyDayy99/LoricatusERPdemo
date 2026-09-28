import type { FieldBoxWithFields, CustomFieldDef } from './hooks/use-projects';

/**
 * Adatlap-haladás számítása — „hol tart ez az ügy?" a lista- és kanban-nézeten.
 *
 * Az üzleti igény (2026-07-31 Loricatus e-mail): *„amikor sok repülés van a
 * várban, könnyebb így, ha egységesen látjuk"*. Ehhez a szoba-nézetben látszania
 * kell, hogy egy adott ügy hány lépésnél tart, anélkül hogy minden rekordot
 * meg kellene nyitni.
 *
 * A számítás KLIENS-OLDALI: a `customFieldsData` már benne van a
 * `GET /projects` payloadban, és a séma a `useFieldLayout(categoryId)` hookból
 * jön — így nincs szükség backend-bővítésre.
 *
 * NEM a légtér-szobára van drótozva: bármely kategória, aminek van adatlap-
 * sémája, kap haladás-mutatót. A mérföldkövek viszont légtér-specifikus
 * `field_key`-eket keresnek — ha nincsenek, egyszerűen kimaradnak.
 */

/** A mérföldkő ikonja — a `DatasheetProgressBadge` képezi le lucide-ikonra. */
export type MilestoneIcon = 'mail' | 'wallet' | 'receipt' | 'bell' | 'landmark';

export interface DatasheetProgress {
  /** Kitöltött mezők száma. */
  done: number;
  /** Összes mező a sémában. */
  total: number;
  /** 0–100 százalék (kerekítve). */
  percent: number;
  /** Kiemelt mérföldkövek — csak azok, amiknek a mezője létezik a sémában. */
  milestones: Array<{ key: string; label: string; icon: MilestoneIcon; done: boolean }>;
  /** A `outcome` select értéke, ha ki van töltve (lezárt ügy). */
  outcome?: 'succeeded' | 'failed' | 'cancelled';
}

/**
 * Kiemelt mérföldkövek a légtér-folyamatból — az e-mailben megnevezett
 * „kulcsfontosságú" lépések. A sorrend a folyamat sorrendje.
 *
 * Mindegyik SAJÁT IKONT kap: öt egyforma pipa ránézésre semmit nem mond,
 * a különböző ikonok viszont tooltip nélkül is olvashatóvá teszik, hogy
 * melyik lépés van kész.
 */
const MILESTONES: Array<{ key: string; label: string; icon: MilestoneIcon }> = [
  { key: 'template_email_sent', label: 'Sablon e-mail kiküldve',  icon: 'mail' },
  { key: 'proforma_paid',       label: 'Díjbekérő kifizetve',     icon: 'wallet' },
  { key: 'invoice_sent',        label: 'Számla kiküldve',         icon: 'receipt' },
  { key: 'client_notified',     label: 'Megrendelő kiértesítve',  icon: 'bell' },
  { key: 'authority_reported',  label: 'Hatóságnak lejelentve',   icon: 'landmark' },
];

/** Egy mezőérték „kitöltöttnek" számít-e. */
function isFilled(field: CustomFieldDef, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  switch (field.fieldType) {
    case 'boolean':
      // A `false` NEM kitöltetlen — de haladásnak csak a `true` számít
      // (a pipa lényege, hogy megtörtént-e a lépés).
      return value === true;
    case 'file':
      return typeof value === 'object' && !!(value as { uploadId?: string }).uploadId;
    case 'multiselect':
      return Array.isArray(value) && value.length > 0;
    case 'number':
      return value !== '' && Number.isFinite(Number(value));
    default:
      return typeof value === 'string' ? value.trim().length > 0 : !!value;
  }
}

/**
 * @param boxes  a kategória adatlap-sémája (`useFieldLayout().boxes`)
 * @param data   a projekt `customFieldsData` JSONB-je
 */
export function computeDatasheetProgress(
  boxes: FieldBoxWithFields[],
  data: Record<string, unknown> | undefined | null,
): DatasheetProgress | null {
  const fields = boxes.flatMap((b) => b.fields);
  if (fields.length === 0) return null;

  const values = data ?? {};
  let done = 0;
  for (const f of fields) {
    if (isFilled(f, values[f.fieldKey])) done++;
  }

  const byKey = new Map(fields.map((f) => [f.fieldKey, f]));
  const milestones = MILESTONES
    .filter((m) => byKey.has(m.key))
    .map((m) => ({
      key: m.key,
      label: m.label,
      icon: m.icon,
      done: isFilled(byKey.get(m.key)!, values[m.key]),
    }));

  const rawOutcome = values['outcome'];
  const outcome =
    rawOutcome === 'succeeded' || rawOutcome === 'failed' || rawOutcome === 'cancelled'
      ? rawOutcome
      : undefined;

  return {
    done,
    total: fields.length,
    percent: fields.length > 0 ? Math.round((done / fields.length) * 100) : 0,
    milestones,
    outcome,
  };
}
