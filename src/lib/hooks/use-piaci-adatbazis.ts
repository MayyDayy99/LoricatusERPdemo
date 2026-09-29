import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';

/**
 * Saját piaci adatbázis (a mi áraink, helyezésünk, a nyertes, a vesztés oka)
 * és a havi piaci jelentés — szerveroldal: `procurement/sajat-eredmenyek.service.ts`,
 * `procurement/havi-jelentes*.ts`.
 */

export type Kimenet = 'won' | 'lost' | 'cancelled' | 'withdrawn';
export const KIMENET_FELIRAT: Record<Kimenet, string> = {
  won: 'Nyert', lost: 'Vesztett', cancelled: 'Eredménytelen / visszavonva', withdrawn: 'Nem adtunk be',
};

export interface Ajanlattevo { name: string; price: number | null; rank: number | null; winner: boolean; own: boolean; invalid?: boolean }

export interface SajatEredmeny {
  id: string;
  tenderId: string | null;
  projectId: string | null;
  title: string;
  buyer: string | null;
  country: string | null;
  cpvCodes: string[];
  outcome: Kimenet;
  currency: string;
  ourPrice: number | null;
  ourRank: number | null;
  biddersCount: number | null;
  winnerName: string | null;
  winnerPrice: number | null;
  estimatedValue: number | null;
  priceToWinner: number | null;
  decisionDate: string | null;
  lossReasons: string[];
  note: string | null;
  source: string;
  bidders: Ajanlattevo[];
  updatedAt: string;
}

export interface SajatEredmenyMentes {
  tenderId?: string | null;
  projectId?: string | null;
  title?: string;
  buyer?: string | null;
  outcome: Kimenet;
  currency?: string;
  ourPrice?: number | null;
  ourRank?: number | null;
  biddersCount?: number | null;
  winnerName?: string | null;
  winnerPrice?: number | null;
  estimatedValue?: number | null;
  decisionDate?: string | null;
  lossReasons?: string[];
  note?: string | null;
  source?: 'kezi' | 'osszegezes';
  bidders?: Array<Omit<Ajanlattevo, 'invalid'>>;
}

export interface OsszegezesJavaslat {
  bidders: Ajanlattevo[];
  winnerName: string | null;
  winnerPrice: number | null;
  estimatedValue: number | null;
  currency: 'HUF' | 'EUR';
  warnings: string[];
}

export interface HaviCimzett { userId?: string; email?: string; nev?: string }
export interface HaviBeallitas {
  enabled: boolean;
  nap: number;
  perc: number;
  cimzettek: Array<HaviCimzett & { feloldottEmail: string | null; feloldottNev: string }>;
}

const lek = <T,>(url: string): Promise<T> => apiClient.get(url).then((r) => r.data);

export function useSajatEredmenyek(q: { outcome?: Kimenet | null; search?: string; page?: number }) {
  const p = new URLSearchParams();
  if (q.outcome) p.set('outcome', q.outcome);
  if (q.search) p.set('search', q.search);
  if (q.page) p.set('page', String(q.page));
  const { data, isLoading, mutate } = useSWR<{ items: SajatEredmeny[]; total: number; page: number; limit: number }>(
    `/procurement/outcomes?${p}`, lek, { keepPreviousData: true },
  );
  return { items: data?.items ?? [], total: data?.total ?? 0, limit: data?.limit ?? 50, isLoading, mutate };
}

export function useHianyzoEredmenyek() {
  return useSWR<{
    tendersWithoutOutcome: Array<{ tenderId: string; title: string; status: string }>;
    outcomesWithoutPrice: Array<{ id: string; title: string; outcome: string }>;
  }>('/procurement/outcomes/missing', lek);
}

export function usePalyazatEredmeny(tenderId: string | null) {
  return useSWR<SajatEredmeny | null>(tenderId ? `/procurement/opportunities/${tenderId}/outcome` : null, lek);
}

export const piaciAdatbazisApi = {
  ment: (dto: SajatEredmenyMentes, id?: string) =>
    (id ? apiClient.put(`/procurement/outcomes/${id}`, dto) : apiClient.post('/procurement/outcomes', dto))
      .then((r) => r.data as SajatEredmeny),
  torol: (id: string) => apiClient.delete(`/procurement/outcomes/${id}`),
  osszegezes: (text: string) =>
    apiClient.post('/procurement/outcomes/parse-summary', { text }).then((r) => r.data as OsszegezesJavaslat),
};

/* ── Havi piaci jelentés ─────────────────────────────────────────────────── */

export function useHaviJelentes(honap: string | null) {
  return useSWR<{
    adat: { honap: string; megjeloles: string };
    elonezet: boolean; allapot: string | null; elkuldve: string | null; keziKuldes: string | null; hiba: string | null;
  }>(`/procurement/market-report${honap ? `?honap=${honap}` : ''}`, lek, { revalidateOnFocus: false });
}

export function useHaviLevel(honap: string | null) {
  return useSWR<{ subject: string; html: string; text: string }>(
    `/procurement/market-report/email${honap ? `?honap=${honap}` : ''}`, lek, { revalidateOnFocus: false },
  );
}

export function useHaviLista() {
  return useSWR<Array<{ honap: string; megjeloles: string; allapot: string; elkuldve: string | null; keziKuldes: string | null }>>(
    '/procurement/market-report/archive', lek, { revalidateOnFocus: false },
  );
}

export function useHaviBeallitas() {
  return useSWR<HaviBeallitas>('/procurement/market-report/settings', lek, { revalidateOnFocus: false });
}

export const haviJelentesApi = {
  beallitas: (dto: { enabled?: boolean; nap?: number; perc?: number; cimzettek?: HaviCimzett[] }) =>
    apiClient.put('/procurement/market-report/settings', dto).then((r) => r.data as HaviBeallitas),
  ujra: (honap: string) => apiClient.post(`/procurement/market-report/month/${honap}/regenerate`).then((r) => r.data),
  keziElkuldve: (honap: string) => apiClient.post(`/procurement/market-report/month/${honap}/sent-manually`),
  letoltes: async (honap: string | null) => {
    const res = await apiClient.get(`/procurement/market-report/export${honap ? `?honap=${honap}` : ''}`, { responseType: 'blob', timeout: 120_000 });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `havi-piaci-jelentes-${honap ?? 'aktualis'}.eml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
};
