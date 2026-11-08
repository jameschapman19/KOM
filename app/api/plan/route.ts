import { plan } from "@/lib/plan.ts";
import { route } from "@/lib/strava.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function POST(req: Request) {
  return route(async () => plan(await req.json()));
}
