/**
 * DEMÓ MÓD — portfólió-demó, valódi backend nélkül.
 *
 * Ha a NEXT_PUBLIC_DEMO_MODE=true, az axios API-kliens egy böngészőben futó,
 * memóriában tárolt mock-rétegre kapcsol (lásd ./adapter + ./router). Semmi
 * nem perzisztálódik: az oldal újratöltésekor a seed-adat visszaáll.
 *
 * Élesben (NEXT_PUBLIC_DEMO_MODE nincs / false) a kliens érintetlen marad.
 */
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

/** Demó session-konstansok — nem valódi hitelesítés, csak a UI beléptetéséhez. */
export const DEMO_TOKEN = 'demo-access-token';
export const DEMO_TENANT_ID = 'demo-tenant-0001';
