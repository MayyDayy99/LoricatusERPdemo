import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';

/**
 * Heti vezetői riport (Iroda + Művelet) — a szerveroldali szabályok az
 * `executive-report.service.ts`-ben, a számok a `riport-szamitas.ts`-ben.
 */

export type Szakasz = 'iroda' | 'muvelet';
export type RiportAllapot = 'kesz' | 'kuldes' | 'elkuldve' | 'reszben';

export interface Cimzett {
  userId?: string;
  email?: string;
  nev?: string;
  szakaszok: Szakasz[];
}

export interface RiportBeallitas {
  enabled: boolean;
  nap: number;
  perc: number;
  cimzettek: Array<Cimzett & { feloldottEmail: string | null; feloldottNev: string }>;
}

export interface RiportNezet {
  adat: { het: { hetKezdete: string; hetVege: string; megjeloles: string }; szamitva: string };
  elonezet: boolean;
  allapot: RiportAllapot | null;
  elkuldve: string | null;
  cimzettek: string[];
  keziKuldes: string | null;
  hiba: string | null;
}

export interface RiportListaElem {
  hetKezdete: string;
  megjeloles: string;
  allapot: RiportAllapot;
  elkuldve: string | null;
  cimzettek: string[];
  keziKuldes: string | null;
  hiba: string | null;
}

export interface RiportLevel { subject: string; html: string; text: string }

const lekeres = async <T,>(url: string): Promise<T> => (await apiClient.get(url)).data;

export function useRiport(het: string | null) {
  return useSWR<RiportNezet>(`/executive-report${het ? `?het=${het}` : ''}`, lekeres, { revalidateOnFocus: false });
}

export function useRiportLevel(het: string | null, szakaszok?: Szakasz[]) {
  const q = new URLSearchParams();
  if (het) q.set('het', het);
  if (szakaszok?.length) q.set('szakaszok', szakaszok.join(','));
  const s = q.toString();
  return useSWR<RiportLevel>(`/executive-report/email${s ? `?${s}` : ''}`, lekeres, { revalidateOnFocus: false });
}

export function useRiportLista() {
  return useSWR<RiportListaElem[]>('/executive-report/archive', lekeres, { revalidateOnFocus: false });
}

export function useRiportBeallitas() {
  return useSWR<RiportBeallitas>('/executive-report/settings', lekeres, { revalidateOnFocus: false });
}

export function useCimzettJeloltek(engedve: boolean) {
  return useSWR<Array<{ id: string; nev: string; email: string }>>(
    engedve ? '/executive-report/settings/candidates' : null, lekeres, { revalidateOnFocus: false },
  );
}

export async function beallitasMentes(dto: { enabled?: boolean; nap?: number; perc?: number; cimzettek?: Cimzett[] }): Promise<RiportBeallitas> {
  return (await apiClient.put('/executive-report/settings', dto)).data;
}

export async function riportUjraszamolas(het: string): Promise<RiportNezet> {
  return (await apiClient.post(`/executive-report/week/${het}/regenerate`)).data;
}

export async function riportKezzelElkuldve(het: string): Promise<void> {
  await apiClient.post(`/executive-report/week/${het}/sent-manually`);
}

export async function riportLevelFajl(het: string | null): Promise<void> {
  const res = await apiClient.get(`/executive-report/export${het ? `?het=${het}` : ''}`, { responseType: 'blob', timeout: 120_000 });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vezetoi-riport-${het ?? 'aktualis'}.eml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
