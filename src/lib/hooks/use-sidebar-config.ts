import useSWR from 'swr';
import { apiClient } from '../api-client';
import {
  type SidebarConfig,
  DEFAULT_SIDEBAR_CONFIG,
  parseSidebarConfig,
} from '@/components/layout/sidebar-config';

const URL = '/users/me/settings/sidebarConfig';

const fetcher = async (url: string) => {
  try {
    return await apiClient.get(url).then((r) => r.data);
  } catch (e: any) {
    // 404 = nincs meg setting, default-ot adunk vissza
    if (e?.response?.status === 404) return null;
    throw e;
  }
};

export function useSidebarConfig() {
  const swr = useSWR<unknown>(URL, fetcher, { revalidateOnFocus: false });
  const config: SidebarConfig = parseSidebarConfig(swr.data);
  const isLoaded = swr.data !== undefined;

  async function update(patch: Partial<SidebarConfig>): Promise<void> {
    const next: SidebarConfig = { ...config, ...patch };
    await swr.mutate(next, { revalidate: false });
    try {
      await apiClient.put(URL, { value: next });
    } catch {
      await swr.mutate();
    }
  }

  async function reset(): Promise<void> {
    await update(DEFAULT_SIDEBAR_CONFIG);
  }

  return { config, isLoaded, update, reset };
}
