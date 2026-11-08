import { logout } from "@/lib/strava.ts";

export async function POST() {
  await logout();
  return Response.json({ ok: true });
}
