# KOM Finder

Pick a start point and a distance; get a loop through Strava segments whose KOM you could plausibly take, based on your FTP and weight.

**How it works:** Strava `segments/explore` (tiled 3×3 around the start) finds candidate segments, `segments/{id}` gives the KOM time. A physics model (gravity, rolling resistance, aero) converts the KOM time into required watts; your FTP is scaled to that effort's duration. Segments are ranked by `available / required`, the best ones that fit the distance budget become waypoints, and OpenRouteService routes the loop.

## Setup
1. Create a Strava API app (https://www.strava.com/settings/api). Set the Authorization Callback Domain to `localhost` and your Vercel domain.
2. Get a free OpenRouteService key.
3. `cp .env.example .env.local`, fill it in, `npm install && npm run dev`.

## Deploy
Import the repo in Vercel and set `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `ORS_API_KEY`.

## Limits
Strava's default API quota is 100 requests / 15 min; one search costs ~33 calls (segment details are cached per instance). Routing snaps to roads, so the route passes through segments but isn't guaranteed to follow them exactly.
