import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { HGSS_MAP_POINTS, IMG_W, IMG_H, type HGSSMapPoint } from "../../data/hgss-map-points";
import { useDexStore } from "../../store/useDexStore";
import type { RouteData } from "../../hooks/useRouteIndex";

interface Props {
  routeIndex: Map<string, RouteData>;
  activeRoute: string | null;
  onRouteClick: (slug: string) => void;
  searchQuery: string;
  activeGeneration: number;
}

type Region = "johto" | "kanto";

const MAP_IMAGE_URL = "/maps/hgss-johto-kanto.png";
const MAP_BOUNDS   = L.latLngBounds(L.latLng(-IMG_H, 0), L.latLng(0, IMG_W));
// Each region is ~half the image; overlap slightly so the border area is reachable from either toggle
const JOHTO_BOUNDS = L.latLngBounds(L.latLng(-IMG_H, 0),        L.latLng(0, IMG_W * 0.56));
const KANTO_BOUNDS = L.latLngBounds(L.latLng(-IMG_H, IMG_W * 0.44), L.latLng(0, IMG_W));

// Dev helper: set to true to log pixel coords on map click (for calibrating hgss-map-points.ts)
const COORD_PICKER = false;

function markerStyle(
  slug: string | null,
  routeIndex: Map<string, RouteData>,
  caughtSet: Set<number>,
  activeRoute: string | null,
  searchQuery: string,
): L.CircleMarkerOptions {
  const isActive = slug !== null && slug === activeRoute;
  const q = searchQuery.trim().toLowerCase();
  const routeData = slug ? routeIndex.get(slug) : null;

  let total = 0;
  let caught = 0;
  if (routeData) {
    const uniqueIds = new Set<number>();
    for (const methodMap of routeData.games.values()) {
      for (const entries of methodMap.values()) {
        for (const e of entries) uniqueIds.add(e.pokemonId);
      }
    }
    total = uniqueIds.size;
    caught = [...uniqueIds].filter((id) => caughtSet.has(id)).length;
  }

  const matchesSearch = !q || (routeData?.displayName.toLowerCase().includes(q) ?? false);
  const dim = q.length > 0 && !matchesSearch;

  let fillColor: string;
  let fillOpacity: number;
  let color: string;
  let weight: number;

  if (isActive) {
    fillColor = "#6366f1";
    fillOpacity = 0.9;
    color = "#ffffff";
    weight = 2;
  } else if (total > 0 && caught === total) {
    fillColor = "#22c55e";
    fillOpacity = 0.8;
    color = "#22c55e";
    weight = 1;
  } else if (total > 0 && caught > 0) {
    fillColor = "#6366f1";
    fillOpacity = 0.5;
    color = "#6366f1";
    weight = 1;
  } else if (slug === null) {
    // Town/city with no encounter data — subtle dot
    fillColor = "#4b5563";
    fillOpacity = 0.5;
    color = "#6b7280";
    weight = 1;
  } else {
    fillColor = "#6b7280";
    fillOpacity = 0.3;
    color = "#6b7280";
    weight = 1;
  }

  return {
    radius: isActive ? 9 : 7,
    fillColor,
    fillOpacity: dim ? fillOpacity * 0.25 : fillOpacity,
    color: dim ? "#374151" : color,
    weight,
    opacity: dim ? 0.3 : 0.9,
  };
}

export default function HGSSMap({
  routeIndex,
  activeRoute,
  onRouteClick,
  searchQuery,
  activeGeneration,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const [region, setRegion] = useState<Region>("johto");
  const [pickerCoords, setPickerCoords] = useState<[number, number] | null>(null);

  const caughtByGen = useDexStore((s) => s.caughtByGen);
  const caughtSet = new Set<number>(caughtByGen[activeGeneration] ?? []);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -3,
      maxZoom: 3,
      maxBounds: L.latLngBounds(
        L.latLng(MAP_BOUNDS.getSouth() - 50, MAP_BOUNDS.getWest() - 50),
        L.latLng(MAP_BOUNDS.getNorth() + 50, MAP_BOUNDS.getEast() + 50),
      ),
      maxBoundsViscosity: 0.8,
      doubleClickZoom: false,
      zoomControl: true,
      attributionControl: false,
    });

    L.imageOverlay(MAP_IMAGE_URL, MAP_BOUNDS).addTo(map);
    map.fitBounds(JOHTO_BOUNDS, { padding: [4, 4], animate: false });

    if (COORD_PICKER) {
      map.on("click", (e) => {
        const x = Math.round(e.latlng.lng);
        const y = Math.round(-e.latlng.lat);
        setPickerCoords([x, y]);
        console.log(`{ x: ${x}, y: ${y} },`);
      });
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Pan to region when toggle changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds(region === "johto" ? JOHTO_BOUNDS : KANTO_BOUNDS, { padding: [4, 4], animate: true });
  }, [region]);

  // Rebuild markers when deps change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    const visiblePoints = HGSS_MAP_POINTS.filter((p) => p.region === region);

    for (const point of visiblePoints) {
      const latlng = L.latLng(-point.y, point.x);
      const options = markerStyle(point.slug, routeIndex, caughtSet, activeRoute, searchQuery);

      const marker = L.circleMarker(latlng, options);

      // Tooltip
      const routeData = point.slug ? routeIndex.get(point.slug) : null;
      let tooltipText = point.name;
      if (routeData) {
        const uniqueIds = new Set<number>();
        for (const methodMap of routeData.games.values()) {
          for (const entries of methodMap.values()) {
            for (const e of entries) uniqueIds.add(e.pokemonId);
          }
        }
        const total = uniqueIds.size;
        const caught = [...uniqueIds].filter((id) => caughtSet.has(id)).length;
        if (total > 0) tooltipText = `${point.name} — ${caught}/${total} caught`;
      }
      marker.bindTooltip(tooltipText, { sticky: true, className: "hgss-map-tooltip" });

      // Click
      if (point.slug) {
        marker.on("click", () => onRouteClick(point.slug!));
      }

      // Hover
      marker.on("mouseover", () => {
        if (point.slug !== activeRoute) {
          marker.setStyle({ radius: (options.radius ?? 7) + 2 });
        }
      });
      marker.on("mouseout", () => {
        marker.setStyle({ radius: options.radius });
      });

      marker.addTo(map);
      markersRef.current.push(marker);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeIndex, activeRoute, searchQuery, caughtByGen, activeGeneration, region]);

  return (
    <>
      <style>{`
        .leaflet-container { background: #030712; }
        .leaflet-control-zoom { border: 1px solid #374151 !important; box-shadow: none !important; }
        .leaflet-control-zoom a { background: #111827 !important; color: #d1d5db !important; border-color: #374151 !important; }
        .leaflet-control-zoom a:hover { background: #1f2937 !important; color: #ffffff !important; }
        .hgss-map-tooltip { background: #111827; border: 1px solid #374151; color: #f3f4f6; font-size: 12px; padding: 4px 8px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.6); }
        .hgss-map-tooltip::before { display: none; }
      `}</style>

      {/* Coordinate picker readout */}
      {COORD_PICKER && (
        <div style={{ position: "absolute", bottom: 10, left: 10, zIndex: 1000, background: "#111827", border: "1px solid #374151", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#f3f4f6", fontFamily: "monospace" }}>
          {pickerCoords ? `x: ${pickerCoords[0]}, y: ${pickerCoords[1]}` : "click map to get coords"}
        </div>
      )}

      {/* Region toggle — floats over the top-right of the map */}
      <div style={{ position: "absolute", top: 10, right: 48, zIndex: 1000, display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid #374151" }}>
        <button
          onClick={() => setRegion("johto")}
          style={{
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 600,
            background: region === "johto" ? "#4f46e5" : "#111827",
            color: region === "johto" ? "#ffffff" : "#9ca3af",
            border: "none",
            cursor: "pointer",
          }}
        >
          Johto
        </button>
        <button
          onClick={() => setRegion("kanto")}
          style={{
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 600,
            background: region === "kanto" ? "#4f46e5" : "#111827",
            color: region === "kanto" ? "#ffffff" : "#9ca3af",
            border: "none",
            borderLeft: "1px solid #374151",
            cursor: "pointer",
          }}
        >
          Kanto
        </button>
      </div>

      <div
        ref={containerRef}
        className="w-full h-full rounded-xl overflow-hidden"
        style={{ minHeight: 400 }}
      />
    </>
  );
}
