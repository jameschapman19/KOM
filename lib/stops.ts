import { type LatLng, haversine } from "./geo.ts";
import type { Segment } from "./plan.ts";

const MAX_STOPS = 6;
const ROAD_FACTOR = 1.3;

function* permutations<T>(xs: T[]): Generator<T[]> {
  if (xs.length <= 1) return yield xs;
  for (let i = 0; i < xs.length; i++)
    for (const rest of permutations([...xs.slice(0, i), ...xs.slice(i + 1)])) yield [xs[i], ...rest];
}

function estimateLength(start: LatLng, order: Segment[]): number {
  let pos = start;
  let total = 0;
  for (const s of order) {
    total += haversine(pos, s.start) * ROAD_FACTOR + s.distance;
    pos = s.end;
  }
  return total + haversine(pos, start) * ROAD_FACTOR;
}

/** Greedily add the best segments while some visiting order still fits the distance budget. */
export function chooseStops(start: LatLng, ranked: Segment[], targetM: number): Segment[] {
  let chosen: Segment[] = [];
  let order: Segment[] = [];
  for (const s of ranked) {
    if (chosen.length >= MAX_STOPS) break;
    if (s.score < 0.85) break;
    const trial = [...chosen, s];
    let best: Segment[] | null = null;
    let bestLen = Infinity;
    for (const p of permutations(trial)) {
      const len = estimateLength(start, p);
      if (len < bestLen) [best, bestLen] = [p, len];
    }
    if (bestLen <= targetM) {
      chosen = trial;
      order = best!;
    }
  }
  return order;
}
