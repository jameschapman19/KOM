import { exchangeCode } from "@/lib/strava.ts";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return new Response(`Strava auth failed: ${url.searchParams.get("error")}`, { status: 400 });
  await exchangeCode(code);
  return Response.redirect(url.origin);
}
