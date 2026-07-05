'use client';

import { MyDayPage } from './my-day-page';

/**
 * "Mai napom" — minden szerepkör a SAJÁT aznapi teendőit látja egy helyen,
 * 1-kattintásos pipálással/indítással, drawer-ben hozzászólással/checklisttel,
 * heti előretekintéssel és (vezetőknek) KPI-sávval. Személyre szabható.
 * A korábbi szerepkör-függő Vezérlőpultot (KPI/diagnosztika/projektkártyák +
 * külön operatív meeting-nézet) ez váltja le; a meeting-állapot bannerként
 * jelenik meg.
 */
export default function DashboardPage() {
  return <MyDayPage />;
}
