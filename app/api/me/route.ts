import { route, stravaGet } from "@/lib/strava.ts";

export const dynamic = "force-dynamic";

export function GET() {
  return route(async () => {
    const a = await stravaGet<{ firstname: string; ftp: number | null; weight: number | null }>("/athlete");
    return { name: a.firstname, ftp: a.ftp, weightKg: a.weight };
  });
}
