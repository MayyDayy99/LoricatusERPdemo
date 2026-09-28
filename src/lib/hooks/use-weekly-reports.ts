import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import { kepetElokeszit } from '@/lib/kep-kicsinyites';

/**
 * Heti jelentés — a szerveroldali szabályok a `weekly-reports.service.ts`-ben.
 *
 * A felület SOHA nem dönti el maga, hogy egy jelentés írható-e: a szerver a
 * `szerkesztheto` mezőben mondja meg (vázlat ÉS még nem jött el a küldési idő).
 * Egy helyi óra-összevetés rossz időzónában vagy elállított gépen hazudna.
 */

export type JelentesAllapot = 'draft' | 'sending' | 'sent' | 'skipped' | 'failed';

export interface HetiKep {
  id: string;
  nev: string;
  meretByte: number;
}

export interface HetiBejegyzes {
  id: string;
  szerzoId: string;
  szerzo: string;
  szoveg: string;
  letrehozva: string;
  modositva: string;
  sajat: boolean;
  kepek: HetiKep[];
}

/** `notes_only`: a jelentés feladatok nélkül, csak a beírt megjegyzésekből áll. */
export type FeladatForras = 'project_map' | 'project_map_and_rooms' | 'notes_only';
export type Szerep = 'felelos' | 'segito';

interface AlapFeladat { id: string; cim: string; projekt: string; szoba: string | null; szerep: Szerep }
export interface ElvegzettFeladat extends AlapFeladat { kesz: string; projektMap: boolean }
export interface NyitottFeladat extends AlapFeladat { kezdes: string; hatarido: string | null; folyamatban: boolean; lejart: boolean }
export interface CsuszottFeladat extends AlapFeladat { napok: number }
export interface Tavollet { tol: string; ig: string; megjegyzes: string | null }

export interface SzemelyTevekenyseg {
  userId: string;
  nev: string;
  elvegezve: ElvegzettFeladat[];
  nyitva: NyitottFeladat[];
  csuszott: CsuszottFeladat[];
  jovoHet: NyitottFeladat[];
  tavollet: Tavollet[];
}

export interface HetiTevekenyseg {
  forras: FeladatForras;
  szamitva: string;
  ablak: { tol: string; ig: string };
  szemelyek: SzemelyTevekenyseg[];
}

export interface HetiJelentes {
  id: string;
  hetKezdete: string;
  hetPentek: string;
  megjeloles: string;
  kuldesIdeje: string;
  emlekeztetoIdeje: string;
  /** Mikor ment ki ténylegesen az emlékeztető (null: még nem). */
  emlekeztetoKiment: string | null;
  /** A szerver órája a válaszkor — ehhez viszonyítva mutatjuk, hol tart a hét. */
  most: string;
  allapot: JelentesAllapot;
  szerkesztheto: boolean;
  elkuldve: string | null;
  bejegyzesekSzamaKuldeskor: number | null;
  cimzettBeallitva: boolean;
  cimzett: string | null;
  utolsoHiba: string | null;
  /** `ir`: írási jog ÉS tagság. `tag`: a néző tagja-e a jelentésnek. */
  jogok: { ir: boolean; kezel: boolean; tag: boolean };
  /** A néző azonosítója — ez alapján keressük meg a saját sorát. */
  nezoId: string;
  forras: FeladatForras;
  tevekenyseg: HetiTevekenyseg;
  /** Elküldött jelentésnél a küldéskori, befagyasztott állapot. */
  befagyasztva: boolean;
  bejegyzesek: HetiBejegyzes[];
}

export interface JelentesListaElem {
  id: string;
  hetKezdete: string;
  megjeloles: string;
  allapot: JelentesAllapot;
  bejegyzesek: number;
  elkuldve: string | null;
}

const lekeres = <T,>(url: string) => apiClient.get<T>(url).then((r) => r.data);

/** A megadott hét jelentése, vagy — ha nincs megadva — a nyitott hét. */
export function useHetiJelentes(hetKezdete: string | null) {
  const url = hetKezdete ? `/weekly-reports/week/${hetKezdete}` : '/weekly-reports/current';
  const { data, error, isLoading, mutate } = useSWR<HetiJelentes>(url, lekeres, {
    // Csütörtök este sokan írnak egyszerre: fókuszra frissítjük, hogy mindenki
    // lássa a többiek bejegyzéseit, mielőtt ugyanazt leírná.
    revalidateOnFocus: true,
  });
  return { jelentes: data, hiba: error, betolt: isLoading, frissit: mutate };
}

export function useJelentesLista() {
  const { data, isLoading } = useSWR<JelentesListaElem[]>('/weekly-reports', lekeres, {
    revalidateOnFocus: false,
  });
  return { lista: data ?? [], betolt: isLoading };
}

export interface JelentesElonezet {
  targy: string;
  html: string;
  cimzett: string | null;
  befagyasztva: boolean;
}

/** A heti levél, ahogy a címzett megkapja. Kezelői jog kell hozzá. */
export async function jelentesElonezet(hetKezdete: string): Promise<JelentesElonezet> {
  const { data } = await apiClient.get<JelentesElonezet>(`/weekly-reports/week/${hetKezdete}/preview`);
  return data;
}

/**
 * A heti levél kész levélfájlként (.eml) — kézi küldéshez, ha a rendszer nem
 * tud levelet küldeni. Outlookban küldésre kész piszkozatként nyílik meg.
 */
export async function jelentesLevelFajl(hetKezdete: string): Promise<void> {
  const res = await apiClient.get(`/weekly-reports/week/${hetKezdete}/export`, { responseType: 'blob', timeout: 120_000 });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `heti-jelentes-${hetKezdete}.eml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** „Kézzel elküldtem" — a hét lezárása kézi küldés után. */
export async function jelentesKezzelElkuldve(hetKezdete: string): Promise<{ uzenet: string }> {
  const { data } = await apiClient.post(`/weekly-reports/week/${hetKezdete}/sent-manually`);
  return data;
}

/**
 * „Küldd el most" — egy kimaradt hét pótlása. A szerver nem küldi ki kétszer
 * ugyanazt a jelentést, és a levél kiírja, hogy késve megy.
 */
export async function jelentesKuldeseMost(
  hetKezdete: string,
): Promise<{ allapot: 'elkuldve' | 'hibas' | 'kihagyva'; uzenet: string }> {
  const { data } = await apiClient.post(`/weekly-reports/week/${hetKezdete}/send`);
  return data;
}

export async function ujBejegyzes(szoveg: string): Promise<{ id: string }> {
  const { data } = await apiClient.post<{ id: string }>('/weekly-reports/current/entries', { szoveg });
  return data;
}

export async function bejegyzesModositas(id: string, szoveg: string): Promise<void> {
  await apiClient.patch(`/weekly-reports/entries/${id}`, { szoveg });
}

export async function bejegyzesTorles(id: string): Promise<void> {
  await apiClient.delete(`/weekly-reports/entries/${id}`);
}

/**
 * Kép előkészítése (kicsinyítés, EXIF eldobása) és feltöltése.
 * A kicsinyítés hibája `KepHiba`, a feltöltésé API-hiba — a hívó mindkettőt
 * ugyanúgy üzenetként jeleníti meg.
 */
export async function kepFeltoltes(bejegyzesId: string, fajl: File): Promise<HetiKep> {
  const kep = await kepetElokeszit(fajl);
  const urlap = new FormData();
  urlap.append('teljes', kep.teljes, kep.nev);
  urlap.append('elonezet', kep.elonezet, kep.nev);
  const { data } = await apiClient.post<HetiKep>(`/weekly-reports/entries/${bejegyzesId}/images`, urlap, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function kepTorles(id: string): Promise<void> {
  await apiClient.delete(`/weekly-reports/images/${id}`);
}

/**
 * Aláírt link egy képhez. 10 percig érvényes, ezért SWR-rel 8 percenként
 * frissítjük — egy sokáig nyitva hagyott oldalon se törjön el a kép.
 */
export function useKepLink(id: string, meret: 'teljes' | 'elonezet') {
  const { data } = useSWR<{ url: string }>(
    `/weekly-reports/images/${id}/url?meret=${meret}`,
    lekeres,
    { refreshInterval: 8 * 60 * 1000, revalidateOnFocus: false },
  );
  return data?.url ?? null;
}

export interface JelentesBeallitas {
  cimzettEmail: string | null;
  cimzettNev: string | null;
  forras: FeladatForras;
  /** A küldés napja: 1 = hétfő … 7 = vasárnap. */
  kuldesNap: number;
  /** `"13:50"` — budapesti idő. */
  kuldesIdo: string;
  /** A most nyitott hét küldési és emlékeztető-ideje (csak olvasható). */
  kovetkezoKuldes: string;
  kovetkezoEmlekezteto: string;
}

export type BeallitasMentes = Partial<Pick<JelentesBeallitas, 'cimzettEmail' | 'cimzettNev' | 'forras' | 'kuldesNap' | 'kuldesIdo'>>;

export function useJelentesBeallitas(engedelyezve: boolean) {
  const { data, mutate } = useSWR<JelentesBeallitas>(
    engedelyezve ? '/weekly-reports/settings' : null,
    lekeres,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  return { beallitas: data, frissit: mutate };
}

export async function beallitasMentese(adat: BeallitasMentes): Promise<JelentesBeallitas> {
  const { data } = await apiClient.put<JelentesBeallitas>('/weekly-reports/settings', adat);
  return data;
}

// ── Tagok ─────────────────────────────────────────────────────────────────

export interface JelentesTag {
  userId: string;
  nev: string;
  email: string;
  szerepkor: string;
}

export function useJelentesTagok(kezelhet: boolean) {
  const tagok = useSWR<JelentesTag[]>('/weekly-reports/members', lekeres, { revalidateOnFocus: false });
  const jeloltek = useSWR<JelentesTag[]>(
    kezelhet ? '/weekly-reports/members/candidates' : null,
    lekeres,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  return {
    tagok: tagok.data ?? [],
    jeloltek: jeloltek.data ?? [],
    frissit: async () => { await Promise.all([tagok.mutate(), jeloltek.mutate()]); },
  };
}

export async function tagHozzaadas(userId: string): Promise<void> {
  await apiClient.post('/weekly-reports/members', { userId });
}

export async function tagEltavolitas(userId: string): Promise<void> {
  await apiClient.delete(`/weekly-reports/members/${userId}`);
}
