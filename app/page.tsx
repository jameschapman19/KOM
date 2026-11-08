"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { LatLng } from "@/lib/geo.ts";
import type { Segment } from "@/lib/plan.ts";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

type Plan = {
  candidates: Segment[];
  stops: number[];
  route: { line: LatLng[]; distanceM: number; ascentM: number } | null;
};

const fmtTime = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : `${s}s`);
const verdict = (score: number) => (score >= 1.05 ? "Go for it" : score >= 0.9 ? "Stretch" : "Out of reach");

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw Object.assign(new Error(body.error), { status: res.status });
  return body;
}

export default function Page() {
  const [athlete, setAthlete] = useState<string | null>(null);
  const [start, setStart] = useState<LatLng | null>(null);
  const [distanceKm, setDistanceKm] = useState(40);
  const [ftp, setFtp] = useState(220);
  const [weightKg, setWeightKg] = useState(72);
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ name: string; ftp: number | null; weightKg: number | null }>("/api/me")
      .then((me) => {
        setAthlete(me.name);
        if (me.ftp) setFtp(me.ftp);
        if (me.weightKg) setWeightKg(Math.round(me.weightKg));
      })
      .catch((e) => {
        if (e.status !== 401) setError(e.message);
      });
  }, []);

  async function search() {
    const r = await api<{ lat: string; lon: string }[]>(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
    );
    if (!r.length) return setError(`No place found for "${query}"`);
    setStart([Number(r[0].lat), Number(r[0].lon)]);
    setPlan(null);
  }

  async function find() {
    setBusy(true);
    setError(null);
    try {
      setPlan(
        await api<Plan>("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start, distanceKm, ftp, weightKg }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app">
      <aside className="panel">
        <h1>KOM Finder</h1>
        {athlete ? (
          <p className="muted">
            Connected as {athlete} ·{" "}
            <a
              href="#"
              onClick={async (e) => {
                e.preventDefault();
                await api("/api/auth/logout", { method: "POST" });
                setAthlete(null);
              }}
            >
              disconnect
            </a>
          </p>
        ) : (
          <a className="btn strava" href="/api/auth/login">
            Connect Strava
          </a>
        )}

        <label>Start point</label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search().catch((err) => setError(err.message));
          }}
          className="row"
        >
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a place, or click the map" />
          <button type="submit">Go</button>
        </form>
        <button
          className="link"
          onClick={() =>
            navigator.geolocation.getCurrentPosition((p) => {
              setStart([p.coords.latitude, p.coords.longitude]);
              setPlan(null);
            })
          }
        >
          Use my location
        </button>
        {start && <p className="muted">{start[0].toFixed(4)}, {start[1].toFixed(4)}</p>}

        <label>Ride distance: {distanceKm} km</label>
        <input type="range" min={10} max={150} step={5} value={distanceKm} onChange={(e) => setDistanceKm(+e.target.value)} />

        <div className="row">
          <div>
            <label>FTP (W)</label>
            <input type="number" value={ftp} onChange={(e) => setFtp(+e.target.value)} />
          </div>
          <div>
            <label>Weight (kg)</label>
            <input type="number" value={weightKg} onChange={(e) => setWeightKg(+e.target.value)} />
          </div>
        </div>
        <p className="muted">{(ftp / weightKg).toFixed(2)} W/kg</p>

        <button className="btn primary" disabled={!start || !athlete || busy} onClick={find}>
          {busy ? "Searching segments…" : "Find KOM route"}
        </button>
        {error && <p className="error">{error}</p>}

        {plan && (
          <section>
            {plan.route ? (
              <p>
                <strong>{(plan.route.distanceM / 1000).toFixed(1)} km</strong> · {Math.round(plan.route.ascentM)} m climbing ·{" "}
                {plan.stops.length} target segment{plan.stops.length === 1 ? "" : "s"}
              </p>
            ) : (
              <p>No segments within reach for this distance and ability. Try a longer ride or another start.</p>
            )}
            <ul className="segments">
              {plan.candidates.map((s) => (
                <li
                  key={s.id}
                  className={s.id === selected ? "sel" : ""}
                  onClick={() => setSelected(s.id === selected ? null : s.id)}
                >
                  <div className="name">
                    {plan.stops.includes(s.id) && <span className="tag">on route</span>}
                    {s.name}
                  </div>
                  <div className="muted">
                    {(s.distance / 1000).toFixed(2)} km · {s.gradePct.toFixed(1)}% · KOM {fmtTime(s.komSeconds)} · needs{" "}
                    {Math.round(s.requiredW)} W, you ~{Math.round(s.availableW)} W
                  </div>
                  <div className={`verdict ${verdict(s.score).replace(/\W/g, "")}`}>
                    {verdict(s.score)} ({Math.round(s.score * 100)}%)
                  </div>
                </li>
              ))}
            </ul>
            <p className="muted">
              Power estimates are physics-based (flat air, no wind, no draft) and FTP is scaled to each effort's duration. Check
              the leaderboard conditions before you commit.
            </p>
          </section>
        )}
      </aside>
      <Map
        start={start}
        onPick={(p) => {
          setStart(p);
          setPlan(null);
        }}
        route={plan?.route?.line ?? null}
        segments={plan?.candidates ?? []}
        stops={plan?.stops ?? []}
        selected={selected}
      />
    </main>
  );
}
