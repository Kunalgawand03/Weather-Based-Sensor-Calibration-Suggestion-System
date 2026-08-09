# API Documentation

Base URL (local): `http://localhost:4000`

All responses are JSON. No authentication in this prototype (would be added via API key / JWT before production use).

---

### `GET /api/health`
Health check.
```json
{ "status": "ok", "time": "2026-08-08T10:00:00.000Z" }
```

---

### `GET /api/sites`
List all configured monitoring sites.
```json
[
  { "id": "wh-north", "name": "North Perimeter — Warehouse Complex", "region": "Mumbai, MH", "latitude": 19.076, "longitude": 72.8777 }
]
```

---

### `GET /api/sites/:id/weather`
Fetches current weather for the site from Open-Meteo, computes a recommendation, logs both to the database, and
returns the combined result. This is the main endpoint the dashboard polls.

**Response**
```json
{
  "site": { "id": "wh-north", "name": "North Perimeter — Warehouse Complex", "...": "..." },
  "weather": { "temp": 29.4, "humidity": 78, "rain": 0, "wind": 14.2, "gust": 21.0, "code": 1 },
  "recommendation": {
    "level": "High",
    "confidence": 92,
    "reasons": ["Conditions are within normal operating range — no adjustment needed"],
    "storm": false,
    "weatherLabel": "Partly cloudy"
  },
  "override": null,
  "effectiveLevel": "High"
}
```
`effectiveLevel` is what the operator dashboard should display prominently — it already accounts for an active
manual override, if any.

---

### `GET /api/sites/:id/history?limit=50`
Returns up to `limit` (max 200) recent readings + recommendations, oldest first, for trend charting.
```json
[
  {
    "id": 12,
    "recorded_at": "2026-08-08 09:45:00",
    "temperature_c": 29.1,
    "humidity_pct": 80,
    "precipitation_mm": 0,
    "wind_speed_kmh": 12.4,
    "wind_gust_kmh": 18.0,
    "weather_code": 1,
    "recommended_level": "High",
    "confidence_pct": 92,
    "reasons_json": "[\"Conditions are within normal operating range — no adjustment needed\"]",
    "storm_flag": 0
  }
]
```

---

### `POST /api/sites/:id/override`
Applies a manual sensitivity override for a site, deactivating any previous override.

**Request body**
```json
{ "level": "Low", "note": "Known false-alarm hotspot during monsoon season" }
```
**Response** `201 Created`
```json
{ "status": "override applied", "level": "Low" }
```
**Errors**: `400` if `level` is not one of `Low`/`Medium`/`High`.

---

### `DELETE /api/sites/:id/override`
Clears any active override for the site, returning control to the automatic recommendation engine.
```json
{ "status": "override cleared" }
```

---

### `GET /api/sites/:id/analytics`
Summary statistics for the analytics panel.
```json
{
  "totalReadings": 48,
  "byLevel": [ { "level": "High", "n": 30 }, { "level": "Medium", "n": 14 }, { "level": "Low", "n": 4 } ],
  "stormEvents": 2,
  "estimatedFalseAlarmReductionPct": 41
}
```

---

## Third-party API used

**Open-Meteo Forecast API** — `GET https://api.open-meteo.com/v1/forecast`
Query params used: `latitude`, `longitude`, `current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m`, `timezone=auto`.
Free tier, no API key required, CORS-enabled — chosen specifically so the prototype has zero external
credentials to manage during judging/demo. Docs: https://open-meteo.com/en/docs
