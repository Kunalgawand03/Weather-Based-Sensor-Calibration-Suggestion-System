# The live / real-time layer

This documents what was added on top of the original weather → recommendation → dashboard
loop to make the system feel genuinely live during a demo, and — importantly — what's real
versus simulated, so you can represent it accurately to judges.

## What's real

- Weather data: live from Open-Meteo, refetched on a schedule (`WEATHER_POLL_CRON`, default
  every 5 minutes) plus on-demand whenever a dashboard requests it.
- The recommendation engine: fully deterministic, rule-based, runs on every real weather reading.
- Manual overrides: real state in the database, immediately affects the "effective level"
  everywhere (dashboard, overview, event classification).
- Level-change and storm-alert events: logged and pushed **only when the real recommendation
  actually changes** based on real weather data.
- The multi-site overview (`/api/overview`, `/api/overview/stream`): a real read of the latest
  stored state for every site, pushed live over Server-Sent Events whenever anything changes.

## What's simulated — and why that's still a legitimate demo technique

- **The live sensor/incident feed** (`trigger_suppressed` / `trigger_escalated` events): the
  prototype has no physical PIR/microwave sensors to read from. `liveSensorTick()` in
  `server.js` simulates plausible raw sensor triggers at a rate influenced by the *real* current
  wind speed, rain, and storm flag for each site, then classifies each simulated trigger against
  the *real* current effective sensitivity level — exactly the decision a physical sensor's
  alarm logic would make. This demonstrates the actual value proposition (fewer false alarms
  reach an operator) without requiring hardware integration that's out of scope for a prototype.
- Say this plainly in your presentation and demo narration: *"the weather and recommendation
  are live; the sensor triggers are simulated at a rate driven by real conditions, standing in
  for physical PIR/microwave sensors we don't have hardware access to for this prototype."*
  Judges consistently respond better to an honest "simulated, here's why, here's how it maps to
  reality" than to an unstated black box.

## Server-Sent Events (SSE) channels

| Endpoint | Pushes |
|---|---|
| `GET /api/sites/:id/stream` | `connected`, `update` (full payload on real weather refresh), `sensor_event` (live feed items) |
| `GET /api/overview/stream` | `connected`, `overview` (array of all sites' current status) |

SSE was chosen over WebSockets because it's simpler for a one-directional server→client feed,
requires no extra library on the client (native `EventSource`), and auto-reconnects.

## Tuning for a live demo

In `backend/.env` (copy from `.env.example`):
```
WEATHER_POLL_CRON="*/1 * * * *"   # see real weather-driven changes within a minute
LIVE_TICK_MS=3000                  # busier-looking live feed while judges are watching
```
Revert to the defaults for normal/unattended operation so you don't hammer the free weather API.
