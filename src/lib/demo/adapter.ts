/**
 * Axios adapter demó módhoz: minden kérést a memóriában futó mock-routerhez
 * irányít, hálózat nélkül. Így az egész app (SWR + minden apiClient-hívás)
 * valós backend nélkül működik.
 */

import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { handle } from './router';

/* eslint-disable @typescript-eslint/no-explicit-any */

function buildUrl(config: InternalAxiosRequestConfig): string {
  let url = config.url ?? '/';
  // baseURL (/api/v1) levágása, ha bekerült
  url = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api\/v1/, '');
  if (!url.startsWith('/')) url = '/' + url;
  // axios params → query string
  const params = config.params as Record<string, any> | undefined;
  if (params && Object.keys(params).length) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.append(k, String(v)); });
    const sep = url.includes('?') ? '&' : '?';
    if ([...qs].length) url += sep + qs.toString();
  }
  return url;
}

function parseBody(data: any): any {
  if (data == null) return undefined;
  if (typeof data === 'string') { try { return JSON.parse(data); } catch { return data; } }
  if (data instanceof FormData) {
    const obj: Record<string, any> = {};
    data.forEach((v, k) => { obj[k] = v; });
    return obj;
  }
  return data;
}

export const demoAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  const method = (config.method ?? 'get').toLowerCase();
  const url = buildUrl(config);
  const body = parseBody(config.data);

  // enyhe késleltetés, hogy a loading-állapotok látszódjanak (realisztikusabb)
  await new Promise((r) => setTimeout(r, 120));

  const { status, data } = handle(method, url, body);

  return {
    data,
    status,
    statusText: status < 300 ? 'OK' : 'Error',
    headers: {},
    config,
    request: {},
  } as AxiosResponse;
};
