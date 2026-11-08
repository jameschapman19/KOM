export type LatLng = [number, number];

export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bounds(center: LatLng, radiusM: number): [number, number, number, number] {
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((center[0] * Math.PI) / 180));
  return [center[0] - dLat, center[1] - dLng, center[0] + dLat, center[1] + dLng];
}

/** Split [swLat, swLng, neLat, neLng] into n×n cells. */
export function grid(b: [number, number, number, number], n: number): [number, number, number, number][] {
  const [s, w, nn, e] = b;
  const cells: [number, number, number, number][] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      cells.push([
        s + ((nn - s) * i) / n,
        w + ((e - w) * j) / n,
        s + ((nn - s) * (i + 1)) / n,
        w + ((e - w) * (j + 1)) / n,
      ]);
  return cells;
}

/** Decode a Google-encoded polyline to [lat, lng][]. */
export function decodePolyline(str: string): LatLng[] {
  const out: LatLng[] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const axis of [0, 1]) {
      let shift = 0, result = 0, b: number;
      do {
        b = str.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += d; else lng += d;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}
