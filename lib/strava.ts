import { cookies } from "next/headers";

const API = "https://www.strava.com/api/v3";
const COOKIE = "kom_session";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Tokens = { access_token: string; refresh_token: string; expires_at: number };

export function authorizeUrl(redirectUri: string): string {
  const q = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,profile:read_all",
  });
  return `https://www.strava.com/oauth/authorize?${q}`;
}

async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      ...body,
    }),
  });
  if (!res.ok) throw new HttpError(res.status, `Strava token error: ${await res.text()}`);
  return res.json();
}

async function saveTokens(t: Tokens) {
  (await cookies()).set(COOKIE, JSON.stringify(t), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function exchangeCode(code: string) {
  await saveTokens(await tokenRequest({ code, grant_type: "authorization_code" }));
}

export async function logout() {
  (await cookies()).delete(COOKIE);
}

async function accessToken(): Promise<string> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) throw new HttpError(401, "Not connected to Strava");
  let t: Tokens = JSON.parse(raw);
  if (t.expires_at < Date.now() / 1000 + 60) {
    t = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh_token });
    await saveTokens(t);
  }
  return t.access_token;
}

export async function stravaGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${API}${path}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429) throw new HttpError(429, "Strava rate limit hit (100 req / 15 min). Try again shortly.");
  if (!res.ok) throw new HttpError(res.status, `Strava ${path}: ${await res.text()}`);
  return res.json();
}

export async function route<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    return Response.json(await fn());
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
