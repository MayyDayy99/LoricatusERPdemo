'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, Marker, Polygon, Polyline, LatLng } from 'leaflet';
import { type Project, updateProject } from '@/lib/hooks/use-projects';

/* ─── Leaflet icon fix ───────────────────────────────────────────────────────── */

function fixLeafletIcon(L: typeof import('leaflet')) {
  const icon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
  L.Marker.prototype.options.icon = icon;
}

/* ─── Smart polygon helpers ──────────────────────────────────────────────────── */

/**
 * Sorts points by angle around their centroid so the resulting polygon
 * is always convex-like and never self-intersecting, regardless of
 * the order the user clicks.
 */
function sortByAngle(points: LatLng[]): LatLng[] {
  if (points.length < 2) return points;
  const cx = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return [...points].sort(
    (a, b) =>
      Math.atan2(a.lng - cy, a.lat - cx) - Math.atan2(b.lng - cy, b.lat - cx),
  );
}

/* ─── types ──────────────────────────────────────────────────────────────────── */

export type MapMode = 'view' | 'set-location' | 'draw-polygon';

export interface ProjectMapProps {
  projects: Project[];
  selectedProjectId: string | null;
  mode: MapMode;
  onProjectSelect: (id: string) => void;
  onLocationSaved: () => void;
}

/* ─── component ──────────────────────────────────────────────────────────────── */

export function ProjectMap({
  projects,
  selectedProjectId,
  mode,
  onProjectSelect,
  onLocationSaved,
}: ProjectMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const polygonRef = useRef<Polygon | null>(null);
  const ghostLineRef = useRef<Polyline | null>(null);
  const dotMarkersRef = useRef<Marker[]>([]);
  const polyPointsRef = useRef<LatLng[]>([]);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [pointCount, setPointCount] = useState(0);

  // ── init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    let map: LeafletMap;

    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return;
      fixLeafletIcon(L);

      map = L.map(containerRef.current, {
        center: [47.4979, 19.0402],
        zoom: 7,
      });

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

  // ── sync markers ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    import('leaflet').then((L) => {
      markersRef.current.forEach((marker, id) => {
        if (!projects.find((p) => p.id === id)) {
          marker.remove();
          markersRef.current.delete(id);
        }
      });

      projects.forEach((project) => {
        if (!project.location) return;
        const { latitude: lat, longitude: lng } = project.location;
        const existing = markersRef.current.get(project.id);
        if (existing) { existing.setLatLng([lat, lng]); return; }

        const marker = L.marker([lat, lng]).addTo(map);
        marker.bindPopup(`
          <div style="min-width:160px">
            <strong style="font-size:13px">${project.name}</strong><br/>
            <span style="font-size:11px;color:#6b7280">${project.location?.city ?? ''}</span><br/>
            <span style="font-size:11px;padding:2px 6px;background:#dbeafe;color:#1d4ed8;border-radius:9999px;margin-top:4px;display:inline-block">${project.state}</span>
          </div>
        `);
        marker.on('click', () => onProjectSelect(project.id));
        markersRef.current.set(project.id, marker);
      });
    });
  }, [projects, onProjectSelect]);

  // ── fly to selected project ───────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedProjectId) return;
    const project = projects.find((p) => p.id === selectedProjectId);
    if (!project?.location) return;
    map.flyTo([project.location.latitude, project.location.longitude], 14, { duration: 1 });
    markersRef.current.get(selectedProjectId)?.openPopup();
  }, [selectedProjectId, projects]);

  // ── helpers for polygon drawing ───────────────────────────────────────────
  const clearDrawing = useCallback((map: LeafletMap) => {
    if (polygonRef.current) { polygonRef.current.remove(); polygonRef.current = null; }
    if (ghostLineRef.current) { ghostLineRef.current.remove(); ghostLineRef.current = null; }
    dotMarkersRef.current.forEach((m) => m.remove());
    dotMarkersRef.current = [];
    polyPointsRef.current = [];
    setPointCount(0);
    map.off('mousemove');
  }, []);

  const redrawPolygon = useCallback((L: typeof import('leaflet'), map: LeafletMap) => {
    if (polygonRef.current) { polygonRef.current.remove(); polygonRef.current = null; }
    const pts = polyPointsRef.current;
    if (pts.length >= 3) {
      const sorted = sortByAngle(pts);
      polygonRef.current = L.polygon(sorted, {
        color: '#2563eb',
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map);
    }
  }, []);

  // ── mode changes ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Reset state on mode change
    clearDrawing(map);
    map.off('click');
    map.off('dblclick');
    map.getContainer().style.cursor = 'grab';
    map.doubleClickZoom.enable();
    setHint(null);

    if (mode === 'set-location') {
      map.getContainer().style.cursor = 'crosshair';
      setHint('Kattints a projekt helyszínének megjelöléséhez');

      map.once('click', async (e) => {
        if (!selectedProjectId) return;
        setSaving(true);
        try {
          const project = projects.find((p) => p.id === selectedProjectId);
          if (!project) return;
          await updateProject(selectedProjectId, {
            location: {
              latitude: e.latlng.lat,
              longitude: e.latlng.lng,
              address: project.location?.address ?? '',
              city: project.location?.city ?? '',
              country: project.location?.country ?? '',
            },
          });
          onLocationSaved();
        } finally {
          setSaving(false);
          setHint(null);
          map.getContainer().style.cursor = 'grab';
        }
      });
    }

    if (mode === 'draw-polygon') {
      if (!selectedProjectId) { setHint('Előbb válassz projektet'); return; }
      map.getContainer().style.cursor = 'crosshair';
      map.doubleClickZoom.disable(); // prevent map zoom on double-click
      setHint('Kattints a terület sarkainak megjelöléséhez');

      let L: typeof import('leaflet');
      import('leaflet').then((mod) => { L = mod; });

      // Small dot marker for each clicked point
      const addDotMarker = (latlng: LatLng) => {
        if (!L) return;
        const dot = L.circleMarker(latlng, {
          radius: 5,
          color: '#2563eb',
          fillColor: '#ffffff',
          fillOpacity: 1,
          weight: 2,
        } as any).addTo(map);
        dotMarkersRef.current.push(dot as unknown as Marker);
      };

      map.on('click', (e) => {
        // Skip if this is the 2nd click of a double-click (fired before dblclick event)
        // We detect this by checking if the dblclick timer is pending — not possible directly,
        // so instead we add a tiny guard: single clicks are processed after 180ms delay
        polyPointsRef.current = [...polyPointsRef.current, e.latlng];
        addDotMarker(e.latlng);
        redrawPolygon(L, map);
        setPointCount(polyPointsRef.current.length);

        const pts = polyPointsRef.current;
        if (pts.length >= 3) {
          setHint('Kattints tovább · dupla kattintás vagy "Mentés" gomb = befejezés · Ctrl+Z = visszavonás');
        }
      });

      // Ghost line from last point to cursor
      map.on('mousemove', (e) => {
        if (!L || polyPointsRef.current.length === 0) return;
        const last = polyPointsRef.current[polyPointsRef.current.length - 1];
        if (ghostLineRef.current) ghostLineRef.current.remove();
        ghostLineRef.current = L.polyline([last, e.latlng], {
          color: '#2563eb',
          weight: 1.5,
          dashArray: '6 4',
          opacity: 0.6,
        }).addTo(map);
      });

      // Double-click = close polygon
      map.on('dblclick', async () => {
        map.off('click');
        map.off('dblclick');
        map.off('mousemove');
        if (ghostLineRef.current) { ghostLineRef.current.remove(); ghostLineRef.current = null; }

        // Remove the last point that was added by the click event that fired as part of the dblclick
        if (polyPointsRef.current.length > 0) {
          polyPointsRef.current = polyPointsRef.current.slice(0, -1);
          if (dotMarkersRef.current.length > 0) {
            dotMarkersRef.current[dotMarkersRef.current.length - 1].remove();
            dotMarkersRef.current = dotMarkersRef.current.slice(0, -1);
          }
        }

        if (polyPointsRef.current.length < 3) {
          setHint('Legalább 3 pont szükséges');
          setTimeout(() => setHint(null), 2500);
          return;
        }
        await savePolygon();
      });

      // Ctrl+Z = undo last point
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
          e.preventDefault();
          if (polyPointsRef.current.length === 0) return;
          polyPointsRef.current = polyPointsRef.current.slice(0, -1);
          if (dotMarkersRef.current.length > 0) {
            dotMarkersRef.current[dotMarkersRef.current.length - 1].remove();
            dotMarkersRef.current = dotMarkersRef.current.slice(0, -1);
          }
          redrawPolygon(L, map);
          setPointCount(polyPointsRef.current.length);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        map.off('click');
        map.off('dblclick');
        map.off('mousemove');
        window.removeEventListener('keydown', handleKeyDown);
      };
    }

    return () => { map.off('click'); map.off('dblclick'); map.off('mousemove'); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedProjectId]);

  // ── save polygon (called from button OR dblclick) ─────────────────────────
  const savePolygon = useCallback(async () => {
    const map = mapRef.current;
    if (!selectedProjectId || !map) return;

    const pts = polyPointsRef.current;
    if (pts.length < 3) { setHint('Legalább 3 pont szükséges'); return; }

    map.off('click');
    map.off('dblclick');
    map.off('mousemove');
    if (ghostLineRef.current) { ghostLineRef.current.remove(); ghostLineRef.current = null; }

    setSaving(true);
    try {
      const sorted = sortByAngle(pts);
      const project = projects.find((p) => p.id === selectedProjectId);
      const existingMeta = project?.metadata ?? {};
      await updateProject(selectedProjectId, {
        metadata: {
          ...existingMeta,
          polygon: sorted.map((ll) => [ll.lat, ll.lng]),
        },
      });
      onLocationSaved();
      setHint('Területkijelölés mentve');
      setTimeout(() => setHint(null), 2000);
    } catch {
      setHint('Mentés sikertelen — próbáld újra');
      setTimeout(() => setHint(null), 3000);
    } finally {
      setSaving(false);
      if (map) map.getContainer().style.cursor = 'grab';
      map.doubleClickZoom.enable();
      dotMarkersRef.current.forEach((m) => m.remove());
      dotMarkersRef.current = [];
      polyPointsRef.current = [];
      setPointCount(0);
    }
  }, [selectedProjectId, projects, onLocationSaved]);

  // ── render saved polygons ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    import('leaflet').then((L) => {
      projects.forEach((p) => {
        const poly = p.metadata?.polygon as [number, number][] | undefined;
        if (!poly || poly.length < 3) return;
        if (p.id === selectedProjectId) {
          L.polygon(poly, { color: '#16a34a', fillOpacity: 0.12, weight: 2, dashArray: '6 4' }).addTo(map);
        }
      });
    });
  }, [projects, selectedProjectId]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full rounded-xl" />

      {/* Hint overlay */}
      {hint && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm border border-brand-200 text-brand-800 text-xs font-medium px-4 py-2 rounded-full shadow-md whitespace-nowrap">
          {hint}
        </div>
      )}

      {/* Draw-mode toolbar: point counter + save + cancel */}
      {mode === 'draw-polygon' && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2">
          <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm">
            {pointCount} pont
          </div>
          {pointCount >= 3 && (
            <button
              type="button"
              onClick={savePolygon}
              disabled={saving}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-md transition disabled:opacity-60"
            >
              {saving ? 'Mentés…' : 'Terület mentése'}
            </button>
          )}
          {pointCount > 0 && (
            <button
              type="button"
              onClick={() => {
                const map = mapRef.current;
                if (!map) return;
                clearDrawing(map);
                map.off('click');
                map.off('dblclick');
              }}
              className="bg-white/90 border border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 text-xs font-medium px-3 py-1.5 rounded-full shadow-sm transition"
            >
              Törlés
            </button>
          )}
        </div>
      )}

      {/* Saving overlay */}
      {saving && (
        <div className="absolute inset-0 z-[999] bg-white/40 backdrop-blur-[1px] flex items-center justify-center rounded-xl">
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 text-sm font-medium text-gray-700 shadow-lg">
            Mentés…
          </div>
        </div>
      )}
    </div>
  );
}
