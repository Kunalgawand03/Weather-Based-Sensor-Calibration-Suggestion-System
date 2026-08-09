/**
 * db/init.js
 * Creates the SQLite database and schema for the Vigil calibration module.
 * Run with: npm run init-db
 */
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "vigil.sqlite3");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS sites (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  region        TEXT,
  latitude      REAL NOT NULL,
  longitude     REAL NOT NULL,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weather_readings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id       TEXT NOT NULL REFERENCES sites(id),
  recorded_at   TEXT DEFAULT (datetime('now')),
  temperature_c REAL,
  humidity_pct  REAL,
  precipitation_mm REAL,
  wind_speed_kmh REAL,
  wind_gust_kmh REAL,
  weather_code  INTEGER
);

CREATE TABLE IF NOT EXISTS recommendations (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id           TEXT NOT NULL REFERENCES sites(id),
  reading_id        INTEGER NOT NULL REFERENCES weather_readings(id),
  recommended_level TEXT NOT NULL CHECK (recommended_level IN ('Low','Medium','High')),
  confidence_pct    INTEGER NOT NULL,
  reasons_json      TEXT NOT NULL,
  storm_flag        INTEGER DEFAULT 0,
  created_at        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS overrides (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id       TEXT NOT NULL REFERENCES sites(id),
  level         TEXT NOT NULL CHECK (level IN ('Low','Medium','High')),
  operator_note TEXT,
  active        INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now')),
  cleared_at    TEXT
);

CREATE TABLE IF NOT EXISTS zones (
  id            TEXT PRIMARY KEY,
  site_id       TEXT NOT NULL REFERENCES sites(id),
  name          TEXT NOT NULL,
  sensor_type   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id       TEXT NOT NULL REFERENCES sites(id),
  zone_id       TEXT REFERENCES zones(id),
  type          TEXT NOT NULL CHECK (type IN ('trigger_suppressed','trigger_escalated','storm_alert','override_applied','override_cleared','level_change')),
  message       TEXT NOT NULL,
  level_at_time TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_readings_site_time ON weather_readings(site_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_recs_site_time ON recommendations(site_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_site_time ON events(site_id, created_at);
`);

const seedSites = [
  { id: "wh-north", name: "North Perimeter — Warehouse Complex", region: "Mumbai, MH", lat: 19.076, lon: 72.8777 },
  { id: "port-coast", name: "Coastal Fence Line — Port Facility", region: "Chennai, TN", lat: 13.0827, lon: 80.2707 },
  { id: "border-alpha", name: "Border Post Alpha", region: "Delhi NCR", lat: 28.6139, lon: 77.209 },
  { id: "tech-campus", name: "Campus Perimeter — Tech Park", region: "Bengaluru, KA", lat: 12.9716, lon: 77.5946 },
];

const insert = db.prepare(
  `INSERT OR IGNORE INTO sites (id, name, region, latitude, longitude) VALUES (@id, @name, @region, @lat, @lon)`
);
const seedAll = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
seedAll(seedSites);

// Each site gets 4 named perimeter zones so the live sensor feed has something
// spatial to reference (e.g. "North Fence Line — Zone 2").
const zoneNames = ["Zone 1 — Main Gate", "Zone 2 — North Fence Line", "Zone 3 — Rear Perimeter", "Zone 4 — Loading Bay"];
const sensorTypes = ["PIR", "Microwave", "PIR", "Dual-tech"];
const insertZone = db.prepare(`INSERT OR IGNORE INTO zones (id, site_id, name, sensor_type) VALUES (?, ?, ?, ?)`);
const seedZones = db.transaction((rows) => {
  rows.forEach((site) => {
    zoneNames.forEach((name, i) => {
      insertZone.run(`${site.id}-z${i + 1}`, site.id, name, sensorTypes[i]);
    });
  });
});
seedZones(seedSites.map((s) => ({ id: s.id })));

console.log(`Vigil database initialized at ${dbPath} with ${seedSites.length} seed sites and ${seedSites.length * zoneNames.length} zones.`);
db.close();
