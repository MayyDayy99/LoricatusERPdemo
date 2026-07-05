'use client';

import { Clock, CalendarCheck, CheckSquare } from 'lucide-react';
import Link from 'next/link';

export type MeetingBannerState = 'none' | 'open' | 'closed';

/**
 * Reggeli-meeting állapot banner a "Mai napom" tetején.
 * - none:   még nincs mai session (a teendőlista így is látszik)
 * - open:   nyitott session → a backend my-today üres listát ad → a lista rejtve
 * - closed: a meeting lezárult → halvány megerősítés, alatta a teljes lista
 */
export function MeetingBanner({ state }: { state: MeetingBannerState }) {
  if (state === 'none') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-yellow-800">Még nem indult el a mai meeting</p>
          <p className="text-sm text-yellow-700 mt-0.5">
            A feladataid addig is itt vannak — a reggeli meeting után frissül a kiosztás.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'open') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-start gap-3">
        <CalendarCheck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-blue-800">Meeting folyamatban</p>
          <p className="text-sm text-blue-700 mt-0.5">
            A mai feladatok kiosztása folyamatban van. Gyere vissza a meeting után — addig a heti
            előretekintésed lent elérhető.
          </p>
        </div>
        <Link href="/meeting" className="text-sm font-medium text-blue-700 hover:underline shrink-0 mt-0.5">
          Meeting →
        </Link>
      </div>
    );
  }

  // closed
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
      <CheckSquare className="w-4 h-4 text-green-600 shrink-0" />
      <p className="text-sm text-green-800">A reggeli meeting lezárult — a mai feladataid lent.</p>
    </div>
  );
}
