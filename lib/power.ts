const G = 9.81;
const RHO = 1.2;
const CDA = 0.32;
const CRR = 0.005;
const DRIVETRAIN_EFF = 0.975;
const BIKE_KG = 8;

/** Parse Strava's xoms strings: "45s", "5:23", "1:02:03". */
export function parseDuration(s: string): number {
  if (/^\d+s$/.test(s)) return parseInt(s, 10);
  const parts = s.split(":").map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some(Number.isNaN)) {
    throw new Error(`Unparseable duration: ${s}`);
  }
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** Steady-state crank power (W) needed to cover `distance` m in `seconds` at `gradePct`. */
export function requiredPower(distance: number, seconds: number, gradePct: number, riderKg: number): number {
  const v = distance / seconds;
  const mass = riderKg + BIKE_KG;
  const theta = Math.atan(gradePct / 100);
  const wheel = v * (mass * G * (CRR * Math.cos(theta) + Math.sin(theta)) + 0.5 * RHO * CDA * v * v);
  return wheel / DRIVETRAIN_EFF;
}

/** Sustainable power for a given duration, from FTP. Simple power-law fade, clamped to 30s–3h. */
export function sustainablePower(ftp: number, seconds: number): number {
  const t = Math.min(Math.max(seconds, 30), 3 * 3600);
  return ftp * Math.pow(t / 3600, -0.07);
}

/** >1 means your estimated power beats what the KOM took. */
export function attainability(
  seg: { distance: number; komSeconds: number; gradePct: number },
  ftp: number,
  riderKg: number,
): { required: number; available: number; score: number } {
  const required = requiredPower(seg.distance, seg.komSeconds, seg.gradePct, riderKg);
  const available = sustainablePower(ftp, seg.komSeconds);
  return { required, available, score: available / required };
}
