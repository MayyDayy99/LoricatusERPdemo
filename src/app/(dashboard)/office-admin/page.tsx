'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

/**
 * Az 'Iroda – Adminisztráció' kompletten beolvadt a `/rooms`-ba (mint egy
 * szoba, ahol `categoryType === 'OfficeAdmin'`). Ez a route már csak egy
 * kompatibilitási redirect — a régi bookmark-ok / direkt URL-ek a /rooms-ra
 * irányulnak, kiválasztva az OfficeAdmin-szobát és a Gantt-nézettel.
 */
export default function OfficeAdminRedirect() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    async function go() {
      try {
        // Garantáljuk az OfficeAdmin-kategóriát, hogy legyen kihez navigálni.
        await apiClient.post('/projects/categories/ensure-office-default');
        const res = await apiClient.get('/projects/categories');
        if (cancelled) return;
        const office = (res.data ?? []).find((c: { categoryType?: string }) => c.categoryType === 'OfficeAdmin');
        router.replace(office ? `/rooms?room=${office.id}&view=gantt` : '/rooms');
      } catch {
        if (!cancelled) router.replace('/rooms');
      }
    }
    void go();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="text-sm text-gray-500">Átirányítás a Szobákra…</div>
    </div>
  );
}
