# Database Schema

SQLite, created by `backend/db/init.js`. Four tables:

## `sites`
Monitoring locations configured on the platform.

| Column | Type | Notes |
|---|---|---|
| id | TEXT (PK) | short slug, e.g. `wh-north` |
| name | TEXT | display name |
| region | TEXT | human-readable region label |
| latitude | REAL | used for weather API calls |
| longitude | REAL | used for weather API calls |
| created_at | TEXT | ISO timestamp, default now |

## `weather_readings`
One row per weather snapshot fetched for a site.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER (PK, autoincrement) | |
| site_id | TEXT (FK → sites.id) | |
| recorded_at | TEXT | ISO timestamp, default now |
| temperature_c | REAL | |
| humidity_pct | REAL | |
| precipitation_mm | REAL | |
| wind_speed_kmh | REAL | |
| wind_gust_kmh | REAL | |
| weather_code | INTEGER | WMO weather code from Open-Meteo |

## `recommendations`
One row per recommendation, linked 1:1 to the reading that produced it.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER (PK, autoincrement) | |
| site_id | TEXT (FK → sites.id) | |
| reading_id | INTEGER (FK → weather_readings.id) | |
| recommended_level | TEXT | `Low` \| `Medium` \| `High` |
| confidence_pct | INTEGER | 62–100 |
| reasons_json | TEXT | JSON array of plain-language reasons |
| storm_flag | INTEGER | 0/1, true if active thunderstorm detected |
| created_at | TEXT | ISO timestamp, default now |

## `overrides`
Manual operator overrides. Only one row per site should be `active = 1` at a time; the API enforces this by
deactivating any prior active override before inserting a new one.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER (PK, autoincrement) | |
| site_id | TEXT (FK → sites.id) | |
| level | TEXT | `Low` \| `Medium` \| `High` |
| operator_note | TEXT | optional free-text reason |
| active | INTEGER | 0/1 |
| created_at | TEXT | when override was applied |
| cleared_at | TEXT | when override was cleared (nullable) |

## Indexes

- `idx_readings_site_time` on `weather_readings(site_id, recorded_at)` — speeds up history queries per site
- `idx_recs_site_time` on `recommendations(site_id, created_at)` — speeds up analytics aggregation per site

## Entity relationship

```mermaid
erDiagram
    SITES ||--o{ WEATHER_READINGS : has
    SITES ||--o{ RECOMMENDATIONS : has
    SITES ||--o{ OVERRIDES : has
    WEATHER_READINGS ||--|| RECOMMENDATIONS : produces

    SITES {
        text id PK
        text name
        text region
        real latitude
        real longitude
    }
    WEATHER_READINGS {
        integer id PK
        text site_id FK
        real temperature_c
        real humidity_pct
        real precipitation_mm
        real wind_speed_kmh
        real wind_gust_kmh
        integer weather_code
    }
    RECOMMENDATIONS {
        integer id PK
        text site_id FK
        integer reading_id FK
        text recommended_level
        integer confidence_pct
        text reasons_json
        integer storm_flag
    }
    OVERRIDES {
        integer id PK
        text site_id FK
        text level
        text operator_note
        integer active
    }
