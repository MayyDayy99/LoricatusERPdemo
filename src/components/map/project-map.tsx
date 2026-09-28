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

/* ─── Snap-target geometry helpers ─────────────────────────────────────────────
 *
 * Draw-módban snap-eljük a click/mousemove pozíciót a többi projekt már mentett
 * poligonjának CSÚCSAIRA (elsődleges) és ÉLEIRE (másodlagos), ha a kurzor `SNAP_PX`
 * pixelen belül van. Így két szomszédos terület pontosan egymáshoz illeszthető.
 */
const SNAP_PX = 14; // pixel tolerance a snap-hez

interface Point2 { x: number; y: number }

function distSq(a: Point2, b: Point2): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Projektál p-t az (a→b) szakaszra; visszaadja a legközelebbi pontot a szakaszon
 *  (végpontokra clamp-elve). */
function projectOnSegment(p: Point2, a: Point2, b: Point2): Point2 {
  const l2 = distSq(a, b);
  if (l2 === 0) return { x: a.x, y: a.y };
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
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
  // Konfirmációs modal — dblclick/Enter után jelenik meg a térkép tetején.
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Snap-indikátor: mousemove hover-nél ha snap-target van közel, kis türkiz
  // körjelölővel jelezzük a felhasználónak.
  const snapIndicatorRef = useRef<Marker | null>(null);
  // Egyéb projektek poligonjai (nem-selected) — draw-módban render + snap-source.
  const otherPolygonRefs = useRef<Polygon[]>([]);
  // Jelenlegi projekt már mentett poligonjának OVERLAY-e draw-módban: zöld szaggatott
  // körvonal + kattintható zöld csúcs-jelölők. Kattintás vertex-re vagy edge-re
  // beviszi a felhasználót "edit mode"-ba (l. lentebb). Overlay-t az edit-mode
  // aktiválásakor eltávolítjuk, a poligonja kékké alakul (draggable dots-szal).
  const savedOverlayRef = useRef<{ polygon: Polygon; vertexRings: Marker[] } | null>(null);
  // Draw-módban a felhasználó szüneteltetése (konfirmációs modal alatt).
  const drawingPausedRef = useRef(false);

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
        // A helyszin lehet RESZLEGES (csak cim, koordinata nelkul) — ilyenkor
        // nincs mit kirakni a terkepre. A `location` objektum letezese tehat
        // NEM eleg felteteli; a koordinata kell.
        const lat = project.location?.latitude;
        const lng = project.location?.longitude;
        if (typeof lat !== 'number' || typeof lng !== 'number') return;
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
    const lat = project?.location?.latitude;
    const lng = project?.location?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    map.flyTo([lat, lng], 14, { duration: 1 });
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

      let L: typeof import('leaflet');
      // A jelenlegi projekt mentett poligonja LatLng-tömbként. Amíg edit-mode
      // NEM aktív, a felhasználó ehhez viszonyítva kattint (csúcs/él → edit-mode,
      // egyéb → új rajz). Null ha még nincs mentve semmi.
      let currentSavedPoly: LatLng[] | null = null;

      // Draggable csúcs-jelölő minden kék rajz-pontra. L.marker + divIcon (nem
      // circleMarker!) mert a `draggable: true` csak markereken működik. A
      // `polyPointsRef.current[i]` sorrend megegyezik a `dotMarkersRef.current[i]`-vel
      // → a drag-en az indexOf-fal keressük vissza melyik pontra hivatkozik.
      const addDotMarker = (latlng: LatLng): Marker | null => {
        if (!L) return null;
        const icon = L.divIcon({
          className: 'polygon-vertex-marker',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
          html: '<div style="width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid #2563eb;box-shadow:0 1px 3px rgba(0,0,0,0.25);cursor:grab;"></div>',
        });
        const dot = L.marker(latlng, { icon, draggable: true });
        dot.on('dragstart', () => {
          map.getContainer().style.cursor = 'grabbing';
          if (ghostLineRef.current) { ghostLineRef.current.remove(); ghostLineRef.current = null; }
        });
        dot.on('drag', () => {
          const idx = dotMarkersRef.current.indexOf(dot as unknown as Marker);
          if (idx === -1) return;
          polyPointsRef.current[idx] = dot.getLatLng();
          redrawPolygon(L, map);
        });
        dot.on('dragend', () => {
          map.getContainer().style.cursor = 'crosshair';
        });
        dot.addTo(map);
        return dot as unknown as Marker;
      };

      // Snap-targets: MÁS projektek poligonjai (a jelenlegi NEM snap-target, mert
      // azt szerkesztjük). Vertex-snap preferált, edge-snap fallback.
      const snapTargets: Array<{ vertices: LatLng[]; edges: Array<[LatLng, LatLng]> }> = [];

      // Editable overlay a jelenlegi projekt mentett poligonjához: zöld szaggatott
      // körvonal + zöld gyűrűk a csúcsokon. `interactive: false` a poligonon → a
      // kattintás átmegy a Leaflet map-re, ahol mi magunk detektáljuk (távolság-alapon).
      const renderSavedOverlay = () => {
        if (!L || !currentSavedPoly) return;
        const poly = L.polygon(currentSavedPoly, {
          color: '#16a34a',
          fillOpacity: 0.10,
          weight: 2,
          dashArray: '6 4',
          interactive: false,
        }).addTo(map);
        const vertexRings: Marker[] = currentSavedPoly.map(v =>
          L.circleMarker(v, {
            radius: 6,
            color: '#16a34a',
            fillColor: '#ffffff',
            fillOpacity: 1,
            weight: 2,
            interactive: false,
          } as any).addTo(map) as unknown as Marker,
        );
        savedOverlayRef.current = { polygon: poly, vertexRings };
      };
      const removeSavedOverlay = () => {
        const ov = savedOverlayRef.current;
        if (!ov) return;
        ov.polygon.remove();
        ov.vertexRings.forEach(r => r.remove());
        savedOverlayRef.current = null;
      };

      import('leaflet').then((mod) => {
        L = mod;
        // Default: ÜRES rajz-állapot, új területet készül a user rajzolni.
        setHint('Kattints a terület sarkainak megjelöléséhez · csúcsra/vonalra klikk = a meglévő szerkesztése · Enter/dupla katt = befejezés');

        // Jelenlegi projekt mentett poligonja: overlay-ként renderelve, kattintva edit-módba lép
        const currentProject = projects.find(p => p.id === selectedProjectId);
        const existingPoly = currentProject?.metadata?.polygon as [number, number][] | undefined;
        if (existingPoly && existingPoly.length >= 3) {
          currentSavedPoly = existingPoly.map(([lat, lng]) => L.latLng(lat, lng));
          renderSavedOverlay();
        }

        // Egyéb projektek poligonjai — halványabb szürke szaggatottal render + snap-target
        for (const p of projects) {
          if (p.id === selectedProjectId) continue;
          const poly = p.metadata?.polygon as [number, number][] | undefined;
          if (!poly || poly.length < 3) continue;
          const latlngs = poly.map(([lat, lng]) => L.latLng(lat, lng));
          const renderedPoly = L.polygon(latlngs, {
            color: '#94a3b8',
            fillOpacity: 0.05,
            weight: 1.5,
            dashArray: '4 3',
          }).addTo(map);
          otherPolygonRefs.current.push(renderedPoly);
          const edges: Array<[LatLng, LatLng]> = [];
          for (let i = 0; i < latlngs.length; i++) {
            edges.push([latlngs[i], latlngs[(i + 1) % latlngs.length]]);
          }
          snapTargets.push({ vertices: latlngs, edges });
        }
      });

      // Detektálja: click közel volt-e a jelenlegi mentett poligon csúcsához vagy éléhez.
      // Ha igen, visszaadja a szerkesztéshez betöltendő pontokat (vertex-nél: az összes
      // meglévőt; edge-nél: a meglévőt + egy új pontot az él projektált-pontján).
      const EDIT_HIT_PX = 14;
      const detectEditableClick = (latlng: LatLng): { newPoints: LatLng[]; description: 'vertex' | 'edge' } | null => {
        if (!currentSavedPoly || !L) return null;
        const clickedPx = map.latLngToContainerPoint(latlng);
        // Vertex-check
        for (let i = 0; i < currentSavedPoly.length; i++) {
          const vpx = map.latLngToContainerPoint(currentSavedPoly[i]);
          const d2 = distSq({ x: vpx.x, y: vpx.y }, { x: clickedPx.x, y: clickedPx.y });
          if (d2 < EDIT_HIT_PX * EDIT_HIT_PX) {
            return { newPoints: currentSavedPoly.map(ll => L.latLng(ll.lat, ll.lng)), description: 'vertex' };
          }
        }
        // Edge-check
        for (let i = 0; i < currentSavedPoly.length; i++) {
          const a = currentSavedPoly[i];
          const b = currentSavedPoly[(i + 1) % currentSavedPoly.length];
          const apx = map.latLngToContainerPoint(a);
          const bpx = map.latLngToContainerPoint(b);
          const proj = projectOnSegment(
            { x: clickedPx.x, y: clickedPx.y },
            { x: apx.x, y: apx.y },
            { x: bpx.x, y: bpx.y },
          );
          const d2 = distSq(proj, { x: clickedPx.x, y: clickedPx.y });
          if (d2 < EDIT_HIT_PX * EDIT_HIT_PX) {
            const insertAt = map.containerPointToLatLng([proj.x, proj.y]);
            // Új csúcs beszúrva a i-edik és (i+1)-edik közé
            const pts = currentSavedPoly.map(ll => L.latLng(ll.lat, ll.lng));
            pts.splice(i + 1, 0, insertAt);
            return { newPoints: pts, description: 'edge' };
          }
        }
        return null;
      };

      // Belép edit-mode-ba: betölti a saved poligon-pontokat draggable dots-ként,
      // eltávolítja az overlay-t. Utána a user Ctrl+Z-vel törölhet, klikkeléssel
      // adhat hozzá, drag-gel elmozdíthat pontokat.
      const enterEditMode = (points: LatLng[], via: 'vertex' | 'edge') => {
        if (!L) return;
        polyPointsRef.current = points;
        points.forEach(p => {
          const dot = addDotMarker(p);
          if (dot) dotMarkersRef.current.push(dot);
        });
        removeSavedOverlay();
        redrawPolygon(L, map);
        setPointCount(points.length);
        setHint(
          via === 'edge'
            ? 'Új pont beszúrva az élen · húzd a csúcsokat vagy adj tovább pontokat · Enter/dupla katt = befejezés'
            : 'Húzd a csúcsokat vagy adj tovább pontokat · Enter/dupla katt = befejezés',
        );
      };

      // Snap-eljük a click/mousemove pozíciót a snapTargets-hoz.
      // Visszaadja a snapped LatLng-et + snap-típust ('vertex' | 'edge' | null).
      const trySnap = (latlng: LatLng): { pt: LatLng; type: 'vertex' | 'edge' | null } => {
        if (!snapTargets.length) return { pt: latlng, type: null };
        const clickedPx = map.latLngToContainerPoint(latlng);
        let best: { pt: LatLng; type: 'vertex' | 'edge' | null; distSq: number } = {
          pt: latlng, type: null, distSq: SNAP_PX * SNAP_PX,
        };
        // Vertex-snap: preferált (pontosabb)
        for (const target of snapTargets) {
          for (const v of target.vertices) {
            const vpx = map.latLngToContainerPoint(v);
            const d2 = distSq({ x: vpx.x, y: vpx.y }, { x: clickedPx.x, y: clickedPx.y });
            if (d2 < best.distSq) best = { pt: v, type: 'vertex', distSq: d2 };
          }
        }
        if (best.type === 'vertex') return { pt: best.pt, type: 'vertex' };
        // Edge-snap: ha nincs közeli csúcs
        for (const target of snapTargets) {
          for (const [a, b] of target.edges) {
            const apx = map.latLngToContainerPoint(a);
            const bpx = map.latLngToContainerPoint(b);
            const projected = projectOnSegment(
              { x: clickedPx.x, y: clickedPx.y },
              { x: apx.x, y: apx.y },
              { x: bpx.x, y: bpx.y },
            );
            const d2 = distSq(projected, { x: clickedPx.x, y: clickedPx.y });
            if (d2 < best.distSq) {
              const projLatLng = map.containerPointToLatLng([projected.x, projected.y]);
              best = { pt: projLatLng, type: 'edge', distSq: d2 };
            }
          }
        }
        return best.type ? { pt: best.pt, type: best.type } : { pt: latlng, type: null };
      };

      // Snap-indikátor (türkiz kör) frissítése mousemove-on
      const updateSnapIndicator = (latlng: LatLng | null) => {
        if (!L) return;
        if (snapIndicatorRef.current) {
          snapIndicatorRef.current.remove();
          snapIndicatorRef.current = null;
        }
        if (latlng) {
          snapIndicatorRef.current = L.circleMarker(latlng, {
            radius: 8,
            color: '#14b8a6',
            fillColor: '#14b8a6',
            fillOpacity: 0.3,
            weight: 2,
          } as any).addTo(map) as unknown as Marker;
        }
      };

      // Delayed-click pattern: a single click NEM azonnal ad hozzá pontot, hanem
      // 260ms-t vár. Ha közben egy `dblclick` érkezik, a függőben lévő click-et
      // ELDOBJUK → semmi pont nem kerül fel a dupla-katt helyére.
      let pendingClickTimer: number | null = null;
      let pendingLatlng: LatLng | null = null;
      let pendingDot: Marker | null = null;
      const clearPending = () => {
        if (pendingClickTimer != null) {
          window.clearTimeout(pendingClickTimer);
          pendingClickTimer = null;
        }
        if (pendingDot) {
          (pendingDot as unknown as { remove: () => void }).remove();
          pendingDot = null;
        }
        pendingLatlng = null;
      };
      const commitPending = () => {
        if (pendingClickTimer != null) {
          window.clearTimeout(pendingClickTimer);
          pendingClickTimer = null;
        }
        if (pendingLatlng) {
          // Cseréljük le a circleMarker echo-t a valódi draggable marker-re
          if (pendingDot) {
            (pendingDot as unknown as { remove: () => void }).remove();
            pendingDot = null;
          }
          const draggableDot = addDotMarker(pendingLatlng);
          if (draggableDot) dotMarkersRef.current.push(draggableDot);
          polyPointsRef.current = [...polyPointsRef.current, pendingLatlng];
          if (L) redrawPolygon(L, map);
          setPointCount(polyPointsRef.current.length);
          if (polyPointsRef.current.length >= 3) {
            setHint('Kattints tovább · dupla katt vagy Enter = befejezés · Ctrl+Z = visszavonás');
          }
        }
        pendingLatlng = null;
      };

      map.on('click', (e) => {
        if (drawingPausedRef.current) return;
        // 1. lépés: ha üres rajz-állapotban vagyunk ÉS klikk közel volt a jelenlegi
        // mentett poligon csúcsához vagy éléhez → edit-mode indul, NEM új pont.
        if (polyPointsRef.current.length === 0 && savedOverlayRef.current) {
          const editHit = detectEditableClick(e.latlng);
          if (editHit) {
            // Nincs pending click → simán edit-mode
            enterEditMode(editHit.newPoints, editHit.description);
            return;
          }
        }
        // 2. lépés: normál pont-hozzáadás delayed-click pattern-nel + snap
        const { pt: snapped } = trySnap(e.latlng);
        if (pendingLatlng) commitPending();
        pendingLatlng = snapped;
        if (L) {
          // Vizuális echo — L.marker draggable-lel is működik, de itt a pending
          // dot-nak nem kell drag: gyorsan visszavonható lesz ha dblclick jön.
          // Egyszerű circleMarker elég a "pending" jelöléshez.
          const dot = L.circleMarker(snapped, {
            radius: 5,
            color: '#2563eb',
            fillColor: '#ffffff',
            fillOpacity: 1,
            weight: 2,
          } as any).addTo(map);
          pendingDot = dot as unknown as Marker;
        }
        pendingClickTimer = window.setTimeout(() => {
          pendingClickTimer = null;
          commitPending();
        }, 260);
      });

      // Ghost line from last point to cursor + snap indicator
      map.on('mousemove', (e) => {
        if (!L) return;
        if (drawingPausedRef.current) { updateSnapIndicator(null); return; }
        // Snap-előnézet: ha közel van egy szomszéd-polygon csúcshoz/élhez,
        // mutassuk türkiz körrel + a ghost line snapped-pozícióra megy.
        const { pt: snapped, type } = trySnap(e.latlng);
        updateSnapIndicator(type ? snapped : null);
        if (polyPointsRef.current.length === 0) return;
        const last = polyPointsRef.current[polyPointsRef.current.length - 1];
        if (ghostLineRef.current) ghostLineRef.current.remove();
        ghostLineRef.current = L.polyline([last, snapped], {
          color: '#2563eb',
          weight: 1.5,
          dashArray: '6 4',
          opacity: 0.6,
        }).addTo(map);
      });

      // Double-click / Enter → konfirmációs modal (nem közvetlen mentés)
      const requestClose = () => {
        clearPending();
        if (polyPointsRef.current.length < 3) {
          setHint('Legalább 3 pont szükséges');
          setTimeout(() => setHint(null), 2500);
          return;
        }
        // Modal alatt szüneteltetjük a rajzolást, hogy a "Nem" gombra kattintva
        // ne rakódjon fel új pont a modal aljára
        drawingPausedRef.current = true;
        if (ghostLineRef.current) { ghostLineRef.current.remove(); ghostLineRef.current = null; }
        updateSnapIndicator(null);
        setConfirmOpen(true);
      };
      map.on('dblclick', requestClose);

      // Ctrl+Z = undo last point ; Enter = konfirmáció-kérés
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !drawingPausedRef.current) {
          e.preventDefault();
          requestClose();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !drawingPausedRef.current) {
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
        clearPending();
        drawingPausedRef.current = false;
        updateSnapIndicator(null);
        // Cleanup: egyéb projektek rendered poligonjai + saved-overlay
        otherPolygonRefs.current.forEach(p => p.remove());
        otherPolygonRefs.current = [];
        removeSavedOverlay();
        map.off('click');
        map.off('dblclick');
        map.off('mousemove');
        window.removeEventListener('keydown', handleKeyDown);
      };
    }

    return () => { map.off('click'); map.off('dblclick'); map.off('mousemove'); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedProjectId]);

  // ── save polygon (called from button OR after confirm modal) ────────────────
  const savePolygon = useCallback(async () => {
    const map = mapRef.current;
    if (!selectedProjectId || !map) return;

    const pts = polyPointsRef.current;
    if (pts.length < 3) { setHint('Legalább 3 pont szükséges'); return; }

    setConfirmOpen(false);
    drawingPausedRef.current = false;
    map.off('click');
    map.off('dblclick');
    map.off('mousemove');
    if (ghostLineRef.current) { ghostLineRef.current.remove(); ghostLineRef.current = null; }
    if (snapIndicatorRef.current) { snapIndicatorRef.current.remove(); snapIndicatorRef.current = null; }

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
  // Draw-módban SKIP-eljük a mentett zöld poligon renderét, mert a draw-mode
  // useEffect a jelenlegi projekt csúcsait BLUE pontokként előre betölti szerkesztésre,
  // és a szomszéd projektek poligonjait szürke szaggatottal külön renderelí + snap-target.
  const savedPolyRefsRef = useRef<Polygon[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Előző render-jelölések takarítása
    savedPolyRefsRef.current.forEach(p => p.remove());
    savedPolyRefsRef.current = [];
    if (mode === 'draw-polygon') return; // draw-módban a másik useEffect kezel mindent
    import('leaflet').then((L) => {
      projects.forEach((p) => {
        const poly = p.metadata?.polygon as [number, number][] | undefined;
        if (!poly || poly.length < 3) return;
        if (p.id === selectedProjectId) {
          const rendered = L.polygon(poly, { color: '#16a34a', fillOpacity: 0.12, weight: 2, dashArray: '6 4' }).addTo(map);
          savedPolyRefsRef.current.push(rendered);
        }
      });
    });
  }, [projects, selectedProjectId, mode]);

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

      {/* Konfirmációs modal — dblclick/Enter után. Térkép tetején, középen.
       * Nem böngésző-alert, hogy stílusban illeszkedjen a UI-hoz és ne szakítsa
       * meg a rajzolási flow-t. */}
      {confirmOpen && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1002] bg-white border border-gray-200 rounded-xl shadow-2xl px-6 py-4 min-w-[280px] max-w-[400px]">
          <div className="text-sm font-semibold text-gray-800 text-center mb-3">
            Megfelelő a kijelölés?
          </div>
          <div className="text-xs text-gray-500 text-center mb-4">
            {pointCount} pont · Igen = végleges mentés · Nem = tovább szerkesztheted
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void savePolygon()}
              disabled={saving}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition disabled:opacity-60"
            >
              Igen
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                drawingPausedRef.current = false;
              }}
              disabled={saving}
              className="flex-1 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition"
            >
              Nem
            </button>
          </div>
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
