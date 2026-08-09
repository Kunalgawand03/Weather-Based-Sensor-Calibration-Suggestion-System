const path = require('path');
const Database = require('better-sqlite3');
const { computeRecommendation } = require('../services/recommendationEngine');

const dbPath = path.join(__dirname, '..', 'db', 'vigil.sqlite3');
const db = new Database(dbPath);

function randBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

async function seed(options = {}) {
  const { perSite = 200, intervalMinutes = 10 } = options;
  const sites = db.prepare('SELECT * FROM sites').all();
  const now = Date.now();

  const insertReading = db.prepare(`
    INSERT INTO weather_readings (site_id, recorded_at, temperature_c, humidity_pct, precipitation_mm, wind_speed_kmh, wind_gust_kmh, weather_code)
    VALUES (@site_id, @recorded_at, @temp, @humidity, @rain, @wind, @gust, @code)
  `);
  const insertRec = db.prepare(`
    INSERT INTO recommendations (site_id, reading_id, recommended_level, confidence_pct, reasons_json, storm_flag)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  console.log(`Seeding ${perSite} readings per site (${sites.length} sites)`);

  for (const site of sites) {
    for (let i = perSite - 1; i >= 0; i--) {
      const t = new Date(now - i * intervalMinutes * 60 * 1000);
      // produce plausible weather variations depending on lat
      const baseTemp = 20 + (site.latitude % 10) - 2 * Math.sin(i / 50);
      const temp = clamp(baseTemp + randBetween(-4, 4), -5, 45);
      const humidity = clamp(50 + randBetween(-20, 40), 10, 100);
      const rain = Math.abs(parseFloat((randBetween(0, 6) * (humidity / 100)).toFixed(2)));
      const wind = Math.abs(parseFloat(randBetween(0, 40).toFixed(1)));
      const gust = Math.abs(parseFloat((wind + randBetween(0, 30)).toFixed(1)));
      let code = 0;
      if (rain > 10) code = 80; else if (rain > 2) code = 51; else if (wind > 30) code = 95; else code = 1;

      const reading = insertReading.run({
        site_id: site.id,
        recorded_at: t.toISOString().replace('T', ' ').split('.')[0],
        temp,
        humidity: Math.round(humidity),
        rain,
        wind,
        gust,
        code,
      });

      const rec = computeRecommendation({ temp, humidity, rain, wind, gust, code });

      insertRec.run(site.id, reading.lastInsertRowid, rec.level, rec.confidence, JSON.stringify(rec.reasons), rec.storm ? 1 : 0);
    }
    console.log(`Seeded site ${site.id}`);
  }
  console.log('Seeding complete.');
}

if (require.main === module) {
  const perSite = parseInt(process.argv[2], 10) || 200;
  const interval = parseInt(process.argv[3], 10) || 10;
  seed({ perSite, intervalMinutes: interval });
}
