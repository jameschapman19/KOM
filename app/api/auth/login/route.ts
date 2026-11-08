import { authorizeUrl } from "@/lib/strava.ts";

export function GET(req: Request) {
  const origin = new URL(req.url).origin;
  return Response.redirect(authorizeUrl(`${origin}/api/auth/callback`));
}
