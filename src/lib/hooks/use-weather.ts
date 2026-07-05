import useSWR from 'swr';
import { useEffect, useState } from 'react';
import { apiClient } from '../api-client';

export interface WeatherCity {
  key: string;     // stable slug
  name: string;    // megjelenített név
  lat: number;
  lng: number;
}

/** Nagy magyar városok az időjárás-szűrőhöz. lat/lng forrás: nyilvános gazetteer. */
export const WEATHER_CITIES: WeatherCity[] = [
  { key: 'budapest',         name: 'Budapest',           lat: 47.4979, lng: 19.0402 },
  { key: 'debrecen',         name: 'Debrecen',           lat: 47.5316, lng: 21.6273 },
  { key: 'szeged',           name: 'Szeged',             lat: 46.2530, lng: 20.1414 },
  { key: 'miskolc',          name: 'Miskolc',            lat: 48.1035, lng: 20.7784 },
  { key: 'pecs',             name: 'Pécs',               lat: 46.0727, lng: 18.2323 },
  { key: 'gyor',             name: 'Győr',               lat: 47.6875, lng: 17.6504 },
  { key: 'nyiregyhaza',      name: 'Nyíregyháza',        lat: 47.9554, lng: 21.7167 },
  { key: 'kecskemet',        name: 'Kecskemét',          lat: 46.9062, lng: 19.6913 },
  { key: 'szekesfehervar',   name: 'Székesfehérvár',     lat: 47.1925, lng: 18.4083 },
  { key: 'szombathely',      name: 'Szombathely',        lat: 47.2306, lng: 16.6219 },
  { key: 'szolnok',          name: 'Szolnok',            lat: 47.1747, lng: 20.1809 },
  { key: 'tatabanya',        name: 'Tatabánya',          lat: 47.5692, lng: 18.4044 },
  { key: 'kaposvar',         name: 'Kaposvár',           lat: 46.3593, lng: 17.7968 },
  { key: 'eger',             name: 'Eger',               lat: 47.9025, lng: 20.3772 },
  { key: 'veszprem',         name: 'Veszprém',           lat: 47.0930, lng: 17.9093 },
];

const CITY_STORAGE_KEY = 'weather:cityKey';

/** Aktuális város a localStorage-ban perzisztálva (SSR-safe). */
export function useWeatherCity(): {
  city: WeatherCity;
  setCity: (c: WeatherCity) => void;
} {
  const [cityKey, setCityKey] = useState<string>(WEATHER_CITIES[0].key);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CITY_STORAGE_KEY);
      if (stored && WEATHER_CITIES.some(c => c.key === stored)) setCityKey(stored);
    } catch { /* ignore — private mode etc. */ }
  }, []);
  const city = WEATHER_CITIES.find(c => c.key === cityKey) ?? WEATHER_CITIES[0];
  const setCity = (c: WeatherCity) => {
    setCityKey(c.key);
    try { window.localStorage.setItem(CITY_STORAGE_KEY, c.key); } catch { /* ignore */ }
  };
  return { city, setCity };
}

export interface WeatherDayData {
  date: string;             // 'YYYY-MM-DD'
  weather_code: number;     // WMO code
  temp_max: number;         // °C
  temp_min: number;         // °C
  precip_prob_max: number;  // %
  wind_speed_max: number;   // m/s
  wind_gusts_max: number;   // m/s
}

export interface WeatherHourlyData {
  time: string;             // 'YYYY-MM-DDTHH:00'
  temperature: number;      // °C
  precip_prob: number;      // %
  wind_speed: number;       // m/s
  weather_code: number;
}

export interface WeatherForecast {
  latitude: number;
  longitude: number;
  fetchedAt: string;
  daily: WeatherDayData[];
  hourly: WeatherHourlyData[];
}

export interface WeatherThresholds {
  windSafeMs: number;
  windCautionMs: number;
  rainSafePct: number;
  rainCautionPct: number;
  thunderCodes: number[];
  isCustom: boolean;
}

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

const FIFTEEN_MIN = 15 * 60 * 1000;

export function useWeatherForecast(lat = 47.4979, lng = 19.0402) {
  const key = `/weather/forecast?lat=${lat}&lng=${lng}`;
  const { data, error, isLoading, mutate } = useSWR<WeatherForecast | null>(
    key,
    fetcher,
    { refreshInterval: FIFTEEN_MIN, revalidateOnFocus: false },
  );
  return { forecast: data ?? null, error, isLoading, mutate };
}

export function useWeatherThresholds() {
  const { data, error, isLoading, mutate } = useSWR<WeatherThresholds>(
    '/tenants/me/weather-thresholds',
    fetcher,
  );
  return { thresholds: data ?? null, error, isLoading, mutate };
}

export async function updateWeatherThresholds(dto: {
  windSafeMs?: number;
  windCautionMs?: number;
  rainSafePct?: number;
  rainCautionPct?: number;
}): Promise<WeatherThresholds> {
  const res = await apiClient.patch('/tenants/me/weather-thresholds', dto);
  return res.data;
}

export async function resetWeatherThresholds(): Promise<WeatherThresholds> {
  const res = await apiClient.delete('/tenants/me/weather-thresholds');
  return res.data;
}

export type DroneRiskLevel = 'safe' | 'caution' | 'danger';

export function evaluateDroneRisk(
  day: WeatherDayData | undefined,
  thr: WeatherThresholds | null,
): DroneRiskLevel | null {
  if (!day || !thr) return null;
  if (thr.thunderCodes.includes(day.weather_code)) return 'danger';
  if (day.wind_speed_max >= thr.windCautionMs) return 'danger';
  if (day.precip_prob_max >= thr.rainCautionPct) return 'danger';
  if (day.wind_speed_max > thr.windSafeMs) return 'caution';
  if (day.precip_prob_max > thr.rainSafePct) return 'caution';
  return 'safe';
}
