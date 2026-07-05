'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, Circle } from 'leaflet';
import type { NotamSearchParams } from '@/lib/hooks/use-notam';

/* Nautical miles → metres */
const NM_TO_M = 1852;

export function NotamMap({
  searchParams,
  notamCount,
}: {
  searchParams: NotamSearchParams | null;
  notamCount: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const circleRef = useRef<Circle | null>(null);

  /* ── init ── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: LeafletMap;
    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return;
      map = L.map(containerRef.current, { center: [47.4979, 19.0402], zoom: 6, zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      if (map) { map.remove(); mapRef.current = null; }
    };
  }, []);

  /* ── update circle when searchParams change ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !searchParams) return;

    import('leaflet').then((L) => {
      if (circleRef.current) { circleRef.current.remove(); circleRef.current = null; }

      const radiusM = searchParams.radiusNauticalMiles * NM_TO_M;

      circleRef.current = L.circle(
        [searchParams.latitude, searchParams.longitude],
        {
          radius: radiusM,
          color: '#2563eb',
          fillColor: '#3b82f6',
          fillOpacity: 0.08,
          weight: 2,
        },
      ).addTo(map);

      /* Center marker */
      L.circleMarker([searchParams.latitude, searchParams.longitude], {
        radius: 5,
        color: '#1d4ed8',
        fillColor: '#3b82f6',
        fillOpacity: 1,
        weight: 2,
      })
        .bindPopup(`<strong>Keresési pont</strong><br/>${searchParams.latitude.toFixed(4)}, ${searchParams.longitude.toFixed(4)}<br/>${notamCount} NOTAM`)
        .addTo(map);

      map.fitBounds(circleRef.current.getBounds(), { padding: [20, 20] });
    });
  }, [searchParams, notamCount]);

  return <div ref={containerRef} className="w-full h-full" />;
}
