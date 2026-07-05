'use client';

import { MeetingView } from './_view';

/**
 * A teljes Gantt + projekt-map UI a `./_view.tsx`-ben (`MeetingView`).
 * A Next.js page-fájlokban csak a named-export white-list (default,
 * metadata, dynamic, stb.) engedélyezett, ezért a komponens egy
 * "_"-prefixű (privát, nem-route) fájlban él, és innen csak default
 * export-tal csomagoljuk.
 */
export default function MeetingPage() {
  return <MeetingView scope="project" />;
}
