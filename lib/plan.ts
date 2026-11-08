import { type LatLng, bounds, decodePolyline, grid, haversine } from "./geo.ts";
import { attainability, parseDuration } from "./power.ts";
import { chooseStops } from "./stops.ts";
import { HttpError, stravaGet } from "./strava.ts";

export type PlanInput = { start: LatLng; distanceKm: number; ftp: number; weightKg: number };

export type Segment = {
  id: number;
  name: string;
  distance: number;
  gradePct: number;
  komSeconds: number;
  efforts: number;
  start: LatLng;
  end: LatLng;
  points: LatLng[];
  requiredW: number;
  availableW: number;
  score: number;
};

type Explored = {
  id: number;
  name: string;
  avg_grade: number;
  distance: number;
  start_latlng: LatLng;
  end_latlng: LatLng;
  points: string;
};
type Detail = { xoms: { kom?: string; overall?: string }; effort_count: number };

const DETAIL_BUDGET = 24;
const detailCache = new Map<number, Detail>();

async function candidateSegments(start: LatLng, radiusM: number): Promise<Explored[]> {
  const cells = grid(bounds(start, radiusM), 3);
  const results = await Promise.all(
    cells.map((c) =>
      stravaGet<{ segments: Explored[] }>("/segments/explore", { bounds: c.join(","), activity_type: "riding" }),
    ),
  );
  const byId = new Map<number, Explored>();
  for (const r of results) for (const s of r.segments) byId.set(s.id, s);
  return [...byId.values()]
    .filter((s) => s.distance >= 300 && s.distance <= 15000 && s.avg_grade >= -2)
    .filter((s) => haversine(start, s.start_latlng) <= radiusM && haversine(start, s.end_latlng) <= radiusM)
    .sort((a, b) => haversine(start, a.start_latlng) - haversine(start, b.start_latlng))
    .slice(0, DETAIL_BUDGET);
}

async function detail(id: number): Promise<Detail> {
  const hit = detailCache.get(id);
  if (hit) return hit;
  const d = await stravaGet<Detail>(`/segments/${id}`);
  detailCache.set(id, d);
  return d;
}

export async function rankSegments(input: PlanInput): Promise<Segment[]> {
  const radius = (input.distanceKm * 1000) / 3;
  const explored = await candidateSegments(input.start, radius);
  const details = await Promise.all(explored.map((s) => detail(s.id)));
  const segments: Segment[] = [];
  explored.forEach((s, i) => {
    const kom = details[i].xoms.kom;
    if (!kom) return;
    const komSeconds = parseDuration(kom);
    const { required, available, score } = attainability(
      { distance: s.distance, komSeconds, gradePct: s.avg_grade },
      input.ftp,
      input.weightKg,
    );
    segments.push({
      id: s.id,
      name: s.name,
      distance: s.distance,
      gradePct: s.avg_grade,
      komSeconds,
      efforts: details[i].effort_count,
      start: s.start_latlng,
      end: s.end_latlng,
      points: decodePolyline(s.points),
      requiredW: required,
      availableW: available,
      score,
    });
  });
  return segments.sort((a, b) => b.score - a.score);
}

type OrsFeature = {
  geometry: { coordinates: [number, number, number?][] };
  properties: { summary: { distance: number }; ascent?: number };
};

async function ride(start: LatLng, stops: Segment[]) {
  const pts: LatLng[] = [start, ...stops.flatMap((s) => [s.start, s.end]), start];
  const res = await fetch("https://api.openrouteservice.org/v2/directions/cycling-regular/geojson", {
    method: "POST",
    headers: { Authorization: process.env.ORS_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates: pts.map(([lat, lng]) => [lng, lat]), elevation: true }),
  });
  if (!res.ok) throw new HttpError(502, `OpenRouteService: ${await res.text()}`);
  const f: OrsFeature = (await res.json()).features[0];
  return {
    line: f.geometry.coordinates.map(([lng, lat]) => [lat, lng] as LatLng),
    distanceM: f.properties.summary.distance,
    ascentM: f.properties.ascent ?? 0,
  };
}

export async function plan(input: PlanInput) {
  const ranked = await rankSegments(input);
  const targetM = input.distanceKm * 1000;
  let stops = chooseStops(input.start, ranked, targetM);
  let result = stops.length ? await ride(input.start, stops) : null;
  // Real roads are windier than our estimate: shed the weakest stop until we're within 15% of target.
  while (result && stops.length > 1 && result.distanceM > targetM * 1.15) {
    const weakest = stops.reduce((a, b) => (a.score < b.score ? a : b));
    stops = stops.filter((s) => s !== weakest);
    result = await ride(input.start, stops);
  }
  return { candidates: ranked, stops: stops.map((s) => s.id), route: result };
}
