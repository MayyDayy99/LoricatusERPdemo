import useSWR from 'swr';
import { apiClient } from '../api-client';

/**
 * Rozika 1. fázis: beillesztett meeting-átirat → piszkozat-feladatok a
 * Projekt mapen. A szerver csak akkor fogad átiratot, ha be van állítva a
 * kinyerő (ROZIKA_LLM_*); a felület ebből dönti el, megjelenjen-e a gomb.
 */

export interface RozikaAllapot {
  bekapcsolva: boolean;
  modell?: string;
}

export interface RozikaJavaslat {
  cim: string;
  felelosNev: string;
  felelosId?: string;
  felelosJeloltek: number;
  hatarido?: string;
  idezet: string;
  idezetEgyezik: boolean;
  allapot: 'letrehozva' | 'mar-megvolt';
  taskId?: string;
}

export interface RozikaEredmeny {
  modell: string;
  meetingDatum: string;
  javaslatok: RozikaJavaslat[];
  hibasTetelek: number;
}

const KIKAPCSOLVA: RozikaAllapot = { bekapcsolva: false };

export function useRozikaAllapot(): RozikaAllapot {
  // 403 (nincs javaslattevő joga) vagy bármilyen hiba: a gomb egyszerűen nem
  // jelenik meg. Ez nem hibaállapot, amit a felhasználónak látnia kell.
  const { data } = useSWR<RozikaAllapot>(
    '/rozika/allapot',
    (url: string) => apiClient.get(url).then((r) => r.data).catch(() => KIKAPCSOLVA),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  return data ?? KIKAPCSOLVA;
}

export async function rozikaAtirat(dto: {
  atirat: string;
  meetingDatum?: string;
  projectId?: string;
}): Promise<RozikaEredmeny> {
  // A kinyerés egy modellfutás — egy hosszú átiratnál perc is lehet.
  const res = await apiClient.post('/rozika/atirat', dto, { timeout: 180_000 });
  return res.data;
}
