# VIGIL — Weather-Based Sensor Calibration Suggestion System

A prototype module for the **Vigil Perimeter Intrusion Detection System (PIDS)** platform that reads live weather
conditions and recommends sensor sensitivity settings, helping operators reduce weather-triggered false alarms.

Built for **A-1 Launchpad 2026 — National Hackathon, Software Development / AI & ML track**.

---

## 1. Problem

PIDS installations produce false alarms when wind, rain, storms, or humidity interfere with PIR/microwave sensors.
Operators currently adjust sensitivity manually and reactively. VIGIL closes that loop automatically: it pulls live
weather data for a site, runs it through a transparent rule engine, and recommends (or auto-applies) the sensitivity
level best suited to current conditions — with full reasoning shown, not a black box.

## 2. What's in this repository

```
vigil-calibration/
├── frontend/                 # (optional) place a full React app build here if you scaffold one
│   └── vigil_calibration_dashboard.jsx   # standalone dashboard component (drop into any React app)
├── backend/
│   ├── server.js              # Express API — weather fetch, recommendation, history, overrides
│   ├── services/
│   │   └── recommendationEngine.js   # pure rule engine, unit-testable in isolation
│   ├── db/
│   │   ├── init.js            # creates SQLite schema + seeds 4 demo sites
│   │   └── vigil.sqlite3      # created after running `npm run init-db`
│   └── package.json
└── docs/
    ├── ARCHITECTURE.md
    ├── DATABASE_SCHEMA.md
    ├── API_DOCUMENTATION.md
    └── PRESENTATION_OUTLINE.md
```

## 3. Live / real-time features

- **Server-Sent Events** push weather updates, sensitivity changes, and simulated sensor
  events to the dashboard instantly — no polling required in the browser.
- **Live activity feed**: a simulated (clearly labeled) stream of zone-level sensor triggers,
  reasoned in real time against the actual current sensitivity level — shows suppressed vs.
  escalated triggers exactly like the value proposition promises. See `docs/LIVE_LAYER.md`.
- **Mission-control overview strip**: all monitored sites at a glance, live status dots,
  click to jump between sites, updates over its own SSE channel.
- **Configurable live tick rate** for demos — see `backend/.env.example`.

## 4. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Tailwind CSS + Recharts + lucide-react | Fast to build a dynamic, data-rich dashboard |
| Backend | Node.js + Express | Simple, well-understood REST layer |
| Database | SQLite (via `better-sqlite3`) | Zero-config, file-based, perfect for a prototype/demo |
| Weather data | [Open-Meteo](https://open-meteo.com) API | Free, no API key required, CORS-enabled, good for live demos |
| Scheduling | `node-cron` | Polls weather every 15 minutes so history accumulates automatically |

## 5. Running it locally

```bash
# 1. Backend + frontend
cd backend
npm install
npm run init-db      # creates db/vigil.sqlite3 and seeds 4 demo sites
npm start             # starts the app on http://localhost:4000
```

Then open `http://localhost:4000` in your browser to view the live VIGIL dashboard.

The API endpoints remain available at:
- `GET  http://localhost:4000/api/sites`
- `GET  http://localhost:4000/api/sites/:id/weather`
- `GET  http://localhost:4000/api/sites/:id/history`
- `POST http://localhost:4000/api/sites/:id/override`

Quick sanity check once the backend is running:
```bash
curl http://localhost:4000/api/health
curl http://localhost:4000/api/sites
curl http://localhost:4000/api/sites/wh-north/weather
```

## 6. Recommendation logic (summary)

Sensitivity starts at **High** and is stepped down based on:

- Wind speed ≥ 20 km/h (moderate) or ≥ 40 km/h (severe)
- Wind gusts ≥ 55 km/h
- Precipitation ≥ 2 mm (light) or ≥ 15 mm (heavy)
- Active thunderstorm (weather code ≥ 95)
- Humidity ≥ 90% while raining (lens fogging risk)
- Near-freezing temperature (≤ 2°C, frost risk)

Each triggered rule is surfaced to the operator as a plain-language reason, so the recommendation is explainable,
not a black box. See `backend/services/recommendationEngine.js` for the exact implementation.

## 7. Attribution

- Weather data: [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0 attribution, free non-commercial API)
- Icons: [lucide-react](https://lucide.dev/)
- Charting: [Recharts](https://recharts.org/)

## 8. Team

_Add your team name, college, and member names here before submission._

## 9. Seeding data & tests

Use these commands from the `backend` folder to populate historical readings and run the simple recommendation tests.

```powershell
cd backend
npm install
npm run init-db        # create DB and seed site records
npm run seed-history:small   # seed a smaller history set (quick demo)
# or
npm run seed-history    # seed larger dataset (may take longer)

# Run the lightweight recommendation engine tests
node test/run-tests.js
```

Notes:
- `seed-history` writes many rows to `backend/db/vigil.sqlite3` so the frontend shows lively charts.
- The simple tests validate `computeRecommendation()` behavior; consider adding Jest/Mocha for more comprehensive CI tests.
