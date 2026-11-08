"use client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { LatLng } from "@/lib/geo.ts";
import type { Segment } from "@/lib/plan.ts";

type Props = {
  start: LatLng | null;
  onPick: (p: LatLng) => void;
  route: LatLng[] | null;
  segments: Segment[];
  stops: number[];
  selected: number | null;
};

const colour = (score: number) => (score >= 1.05 ? "#16a34a" : score >= 0.9 ? "#d97706" : "#9ca3af");

export default function Map({ start, onPick, route, segments, stops, selected }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    const m = L.map(el.current!).setView([51.5, -0.12], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(m);
    m.on("click", (e) => onPickRef.current([e.latlng.lat, e.latlng.lng]));
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => void m.remove();
  }, []);

  useEffect(() => {
    const g = layer.current!;
    g.clearLayers();
    if (route) L.polyline(route, { color: "#2563eb", weight: 4, opacity: 0.7 }).addTo(g);
    for (const s of segments) {
      const inRoute = stops.includes(s.id);
      L.polyline(s.points, {
        color: colour(s.score),
        weight: s.id === selected ? 9 : inRoute ? 7 : 4,
        opacity: inRoute || s.id === selected ? 1 : 0.6,
      })
        .bindTooltip(s.name)
        .addTo(g);
    }
    if (start) L.circleMarker(start, { radius: 8, color: "#111", fillColor: "#fc4c02", fillOpacity: 1 }).addTo(g);
  }, [start, route, segments, stops, selected]);

  useEffect(() => {
    if (route?.length) map.current!.fitBounds(L.latLngBounds(route), { padding: [30, 30] });
  }, [route]);

  useEffect(() => {
    if (start && !route) map.current!.setView(start, Math.max(map.current!.getZoom(), 12));
  }, [start, route]);

  return <div ref={el} className="map" />;
}
