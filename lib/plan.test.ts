import assert from "node:assert/strict";
import test from "node:test";
import type { Segment } from "./plan.ts";
import { chooseStops } from "./stops.ts";
import { attainability, parseDuration, requiredPower } from "./power.ts";

test("parseDuration", () => {
  assert.equal(parseDuration("45s"), 45);
  assert.equal(parseDuration("5:23"), 323);
  assert.equal(parseDuration("1:02:03"), 3723);
  assert.throws(() => parseDuration("abc"));
});

test("climb power is plausible", () => {
  // 70kg rider, 1km @ 8% in 3:00 is ~5.6 m/s, roughly 430W
  const w = requiredPower(1000, 180, 8, 70);
  assert.ok(w > 400 && w < 600, String(w));
});

test("score rises with FTP", () => {
  const seg = { distance: 2000, komSeconds: 360, gradePct: 5 };
  assert.ok(attainability(seg, 300, 70).score > attainability(seg, 200, 70).score);
});

const seg = (id: number, lat: number, lng: number, score: number): Segment => ({
  id, name: String(id), distance: 1000, gradePct: 4, komSeconds: 200, efforts: 1,
  start: [lat, lng], end: [lat + 0.009, lng], points: [], requiredW: 1, availableW: score, score,
});

test("chooseStops respects distance budget and score floor", () => {
  const start: [number, number] = [51.5, 0];
  const near = seg(1, 51.51, 0, 1.2);
  const far = seg(2, 51.9, 0, 1.1);
  const weak = seg(3, 51.51, 0.01, 0.5);
  const stops = chooseStops(start, [near, far, weak], 10_000);
  assert.deepEqual(stops.map((s) => s.id), [1]);
});
