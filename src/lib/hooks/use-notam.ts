import { useState } from 'react';
import { apiClient } from '../api-client';

export interface Notam {
  id: string;
  type: string;
  classification: string;
  location: string;           // ICAO identifier (e.g. "LHBP")
  effectiveFrom: string;
  effectiveTo?: string;
  altitude?: { lower: number; upper: number; unit: string };
  message: string;
  raw: string;
}

export interface NotamQuota {
  used: number;
  limit: number;
  remaining: number;
}

export interface NotamSearchParams {
  latitude: number;
  longitude: number;
  radiusNauticalMiles: number;
}

export function useNotamSearch() {
  const [notams, setNotams] = useState<Notam[]>([]);
  const [quota, setQuota] = useState<NotamQuota | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastParams, setLastParams] = useState<NotamSearchParams | null>(null);

  async function fetchQuota() {
    try {
      const res = await apiClient.get('/notam/quota');
      setQuota(res.data as NotamQuota);
    } catch {
      // non-fatal
    }
  }

  async function search(params: NotamSearchParams) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/notam/search', { params });
      setNotams(res.data as Notam[]);
      setLastParams(params);
      await fetchQuota();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 503) {
        setError('Havi NOTAM-lekérdezési limit elérve. Gyorsítótárazott adatok nem állnak rendelkezésre.');
      } else if (status === 403) {
        setError('A NOTAM funkció ennél a munkaterületnél nincs engedélyezve (notamEnabled = false).');
      } else {
        setError(err?.response?.data?.message ?? 'Ismeretlen hiba a NOTAM lekérdezéskor');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return { notams, quota, isLoading, error, lastParams, search, fetchQuota };
}
