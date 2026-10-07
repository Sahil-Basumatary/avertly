# Avertly

Avertly is a route-exposure workspace for risk and operations teams at freight forwarders and shippers. It ranks recent public reports near a shipping route, explains each score and drafts a cited brief. It does not recommend rerouting; the analyst makes the decision.

[Live app](https://avertly.vercel.app) · [Repository](https://github.com/Sahil-Basumatary/avertly)

## Use it

1. Select the Suez or Cape route.
2. Pick a ranked report from the list or map.
3. Review its source, route distance and score breakdown.
4. Generate a brief, follow its citation chips and verify the original reports before acting.

## How it works

The server requests route-relevant GDELT Cloud events, validates and normalises them with Zod, then scores their distance, category, recency and location precision. Turf measures each report against the route line. The top reports are shown through one GeoJSON source on a MapLibre globe.

The brief endpoint rebuilds the top eight scores on the server and asks Gemini 3.5 Flash-Lite for structured JSON. Unknown citations and unsupported evidence are removed before the response reaches the UI. If GDELT fails, the app uses a dated replay set. If Gemini fails or returns an unsafe or invalid brief, the app produces a rule-based summary from the top three reports.

## Exposure score

The score is additive and capped at 100:

- recency: up to 40 points
- route distance: up to 30 points
- category: up to 20 points
- location precision: up to 10 points

Reports more than 500 km from the route are removed. Scores of 80 or more are high, 65–79 are elevated and lower scores are guarded. Replay recency is measured from the replay snapshot, not today.

These weights, bands and distance thresholds are product assumptions, not predictions. They are named constants in `src/lib/exposure.ts` so they can be reviewed and changed.

## Run locally

```bash
npm install
```

Create `.env.local` with the variable names you use:

```bash
GDELT_API_KEY=
GEMINI_API_KEY=
NEXT_PUBLIC_CARTO_API_KEY=
```

`GDELT_API_KEY` and `GEMINI_API_KEY` stay on the server. Restrict the public CARTO key by referrer.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
npm test
npm run lint
npm run build
```

## Deliberate limits

This version has no accounts, organisations, saved routes, scheduled alerts or payments. It supports two fixed routes and public-report evidence only. The raster map labels are not guaranteed to be English.

Next I would add organisation-scoped accounts and saved routes, durable ingestion and caching, scheduled alerts, English vector labels, broader source evaluation and production rate limiting and monitoring.
