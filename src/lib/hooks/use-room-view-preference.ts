import useSWR from 'swr';
import { apiClient } from '../api-client';

export type RoomViewMode = 'list' | 'kanban' | 'gantt';

type RoomViewMap = Record<string, RoomViewMode>;

const VIEW_KEY = 'roomViewModes';
const LAST_ROOM_KEY = 'lastActiveRoomId';
const VIEW_URL = `/users/me/settings/${VIEW_KEY}`;
const LAST_ROOM_URL = `/users/me/settings/${LAST_ROOM_KEY}`;

const fetcher = (url: string) => apiClient.get(url).then(r => r.data);

/**
 * Server-side perzisztált /rooms-preferences (per-user, cross-device):
 *   • view-mód szobánként: list / kanban / gantt — a tab-választást őrzi
 *   • lastActiveRoomId — az utolsó kiválasztott szoba; visszalépéskor erre
 *     ugrunk a /rooms-on, hogy a user ne essen vissza az első szobához
 *     amikor egy projektből visszanavigál.
 *
 * Minden mező önálló settings-kulcs, a backend `usersService.upsertSetting()`
 * atomikus jsonb_set-jét hívja → concurrent írás biztonságos.
 */
export function useRoomViewPreference() {
  const viewSwr = useSWR<RoomViewMap | null>(VIEW_URL, fetcher, { revalidateOnFocus: false });
  const lastRoomSwr = useSWR<string | null>(LAST_ROOM_URL, fetcher, { revalidateOnFocus: false });

  const viewModes: RoomViewMap = (viewSwr.data && typeof viewSwr.data === 'object') ? viewSwr.data : {};
  const lastActiveRoom: string | null = typeof lastRoomSwr.data === 'string' ? lastRoomSwr.data : null;
  // `data === undefined` jelzi, hogy az SWR még tölt — `null` már a backend
  // konkrét válasza (nincs még setting). A useEffect-eknek várni kell, amíg
  // ez betölt, különben az első renderen "nincs perzisztált érték"-szel
  // számolnak és visszaesnek a first-room/list-default-ra.
  const isLoaded = viewSwr.data !== undefined && lastRoomSwr.data !== undefined;

  async function setRoomView(roomId: string, view: RoomViewMode): Promise<void> {
    const next: RoomViewMap = { ...viewModes, [roomId]: view };
    await viewSwr.mutate(next, { revalidate: false });
    try {
      await apiClient.put(VIEW_URL, { value: next });
    } catch {
      await viewSwr.mutate();
    }
  }

  async function setLastActiveRoom(roomId: string): Promise<void> {
    if (lastActiveRoom === roomId) return;
    await lastRoomSwr.mutate(roomId, { revalidate: false });
    try {
      await apiClient.put(LAST_ROOM_URL, { value: roomId });
    } catch {
      await lastRoomSwr.mutate();
    }
  }

  return { viewModes, lastActiveRoom, isLoaded, setRoomView, setLastActiveRoom };
}
