import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import {
  Wind,
  CloudRain,
  Thermometer,
  Droplets,
  Zap,
  RadioTower,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  RefreshCw,
  Power,
  ChevronDown,
  Activity,
  Database,
  TrendingDown,
} from "lucide-react";

/* ---------------------------------------------------------------------
   VIGIL — Weather-Adaptive Sensor Calibration Module
   A prototype module for a Perimeter Intrusion Detection System (PIDS)
   that reads live weather conditions and recommends sensor sensitivity
   to reduce weather-triggered false alarms.
--------------------------------------------------------------------- */

const SITES = [
  { id: "wh-north", name: "North Perimeter — Warehouse Complex", lat: 19.076, lon: 72.8777, region: "Mumbai, MH" },
  { id: "port-coast", name: "Coastal Fence Line — Port Facility", lat: 13.0827, lon: 80.2707, region: "Chennai, TN" },
  { id: "border-alpha", name: "Border Post Alpha", lat: 28.6139, lon: 77.209, region: "Delhi NCR" },
  { id: "tech-campus", name: "Campus Perimeter — Tech Park", lat: 12.9716, lon: 77.5946, region: "Bengaluru, KA" },
];

const LEVELS = ["Low", "Medium", "High"];
const LEVEL_VALUE = { Low: 1, Medium: 2, High: 3 };
const LEVEL_COLOR = {
  Low: "#FF9F45",
  Medium: "#F2C94C",
  High: "#2DD4CF",
};

function describeWeatherCode(code) {
  if (code >= 95) return { label: "Thunderstorm", storm: true };
  if (code >= 80) return { label: "Rain showers", storm: false };
  if (code >= 71 && code <= 77) return { label: "Snowfall", storm: false };
  if (code >= 61) return { label: "Rain", storm: false };
  if (code >= 51) return { label: "Drizzle", storm: false };
  if (code >= 45) return { label: "Fog", storm: false };
  if (code >= 1) return { label: "Partly cloudy", storm: false };
  return { label: "Clear sky", storm: false };
}

/* Core recommendation engine — pure function, unit-testable in isolation */
function computeRecommendation(current) {
  const { wind, gust, rain, temp, humidity, code } = current;
  const wx = describeWeatherCode(code);
  const reasons = [];
  let score = 3; // start at High sensitivity, subtract for adverse conditions

  if (wind >= 40) {
    score -= 2;
    reasons.push(`Wind speed ${wind.toFixed(0)} km/h exceeds 40 km/h threshold — high risk of foliage/debris false triggers`);
  } else if (wind >= 20) {
    score -= 1;
    reasons.push(`Wind speed ${wind.toFixed(0)} km/h is moderate — some risk of motion false triggers`);
  }

  if (gust >= 55) {
    score -= 1;
    reasons.push(`Gusts reaching ${gust.toFixed(0)} km/h — sudden gusts are a known cause of PIR false alarms`);
  }

  if (rain >= 15) {
    score -= 2;
    reasons.push(`Heavy precipitation (${rain.toFixed(1)} mm) — water sheeting can trigger microwave/PIR sensors`);
  } else if (rain >= 2) {
    score -= 1;
    reasons.push(`Light-to-moderate precipitation (${rain.toFixed(1)} mm) detected`);
  }

  if (wx.storm) {
    score -= 2;
    reasons.push(`Active thunderstorm conditions — lightning and heavy gusts significantly elevate false-alarm risk`);
  }

  if (humidity >= 90 && rain > 0) {
    score -= 1;
    reasons.push(`Humidity at ${humidity.toFixed(0)}% with active precipitation — fog/condensation risk on lenses`);
  }

  if (temp <= 2) {
    reasons.push(`Near-freezing temperature (${temp.toFixed(1)}°C) — possible frost/ice interference on sensors`);
    score -= 1;
  }

  if (reasons.length === 0) {
    reasons.push("Conditions are within normal operating range — no adjustment needed");
  }

  score = Math.max(1, Math.min(3, Math.round(score)));
  const level = LEVELS[score - 1];

  const confidence = Math.max(
    62,
    100 - reasons.length * 8 - (wx.storm ? 10 : 0)
  );

  return { level, confidence, reasons, wx };
}

function estimateFalseAlarmReduction(history) {
  if (history.length < 2) return 0;
  const adverseReadings = history.filter((h) => h.level !== "High").length;
  const pct = (adverseReadings / history.length) * 100;
  // Illustrative model: each adaptive (non-default) reading assumed to prevent
  // ~0.6 false alarms/day relative to a static "always High" baseline.
  return Math.min(78, Math.round(pct * 0.6 + adverseReadings * 1.4));
}

// Hook: smooth numeric animation for UI counters
function useAnimatedNumber(value, duration = 700) {
  const [display, setDisplay] = useState(value);
  const ref = useRef(value);

  useEffect(() => {
    const start = ref.current || 0;
    const end = Number(value) || 0;
    const startTime = performance.now();
    let raf = null;

    function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = start + (end - start) * eased;
      setDisplay(Math.round(v * 100) / 100);
      if (t < 1) raf = requestAnimationFrame(step);
      else ref.current = end;
    }

    raf = requestAnimationFrame(step);
    return () => raf && cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}

function StatCard({ icon: Icon, label, value, unit, accent }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#1E2733] bg-[#121821] px-4 py-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${accent}1A`, color: accent }}
      >
        <Icon size={18} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-[#7C8FA3]">{label}</div>
        <div className="font-mono text-lg text-[#E8EDF3]">
          {value}
          <span className="ml-1 text-xs text-[#7C8FA3]">{unit}</span>
        </div>
      </div>
    </div>
  );
}

function SensitivityDial({ level, confidence, overridden }) {
  const angleFor = { Low: -60, Medium: 0, High: 60 };
  const needleAngle = angleFor[level] ?? 0;
  const color = LEVEL_COLOR[level] ?? "#7C8FA3";

  return (
    <div className="relative flex flex-col items-center justify-center py-2">
      <svg viewBox="0 0 240 150" className="w-full max-w-[280px]">
        <defs>
          <linearGradient id="arcLow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FF9F45" />
            <stop offset="100%" stopColor="#F2C94C" />
          </linearGradient>
          <linearGradient id="arcHigh" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#F2C94C" />
            <stop offset="100%" stopColor="#2DD4CF" />
          </linearGradient>
        </defs>
        {/* base arc */}
        <path d="M 30 130 A 90 90 0 0 1 210 130" fill="none" stroke="#1E2733" strokeWidth="14" strokeLinecap="round" />
        <path d="M 30 130 A 90 90 0 0 1 120 40" fill="none" stroke="url(#arcLow)" strokeWidth="14" strokeLinecap="round" opacity="0.9" />
        <path d="M 120 40 A 90 90 0 0 1 210 130" fill="none" stroke="url(#arcHigh)" strokeWidth="14" strokeLinecap="round" opacity="0.9" />

        {/* tick labels */}
        <text x="30" y="148" fill="#7C8FA3" fontSize="11" fontFamily="monospace">LOW</text>
        <text x="105" y="26" fill="#7C8FA3" fontSize="11" fontFamily="monospace">MED</text>
        <text x="182" y="148" fill="#7C8FA3" fontSize="11" fontFamily="monospace">HIGH</text>

        {/* needle */}
        <g transform={`rotate(${needleAngle} 120 130)`} style={{ transition: "transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)" }}>
          <line x1="120" y1="130" x2="120" y2="50" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <circle cx="120" cy="130" r="7" fill={color} />
        </g>
        <circle cx="120" cy="130" r="3" fill="#0A0E13" />
      </svg>
      <div className="-mt-2 text-center">
        <div className="font-mono text-3xl font-semibold" style={{ color }}>
          {level.toUpperCase()}
        </div>
        <div className="text-xs text-[#7C8FA3]">
          {overridden ? "manual override active" : `recommended sensitivity · ${confidence}% confidence`}
        </div>
      </div>
    </div>
  );
}

export default function VigilCalibrationDashboard() {
  const [siteId, setSiteId] = useState(SITES[0].id);
  const [siteOpen, setSiteOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [override, setOverride] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef(null);

  const site = SITES.find((s) => s.id === siteId);

  const fetchWeather = useCallback(async (targetSite) => {
    setLoading(true);
    setError(null);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${targetSite.lat}&longitude=${targetSite.lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Weather service unavailable");
      const data = await res.json();
      const c = data.current;
      const parsed = {
        temp: c.temperature_2m,
        humidity: c.relative_humidity_2m,
        rain: c.precipitation ?? 0,
        wind: c.wind_speed_10m,
        gust: c.wind_gusts_10m ?? c.wind_speed_10m,
        code: c.weather_code,
        time: c.time,
      };
      const rec = computeRecommendation(parsed);
      setCurrent(parsed);
      setRecommendation(rec);
      setLastUpdated(new Date());
      setHistory((h) => {
        const next = [
          ...h,
          {
            t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            level: rec.level,
            value: LEVEL_VALUE[rec.level],
            wind: parsed.wind,
            rain: parsed.rain,
          },
        ];
        return next.slice(-24);
      });
    } catch (e) {
      setError("Could not reach weather service — check network access and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setHistory([]);
    setOverride(null);
    fetchWeather(site);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => fetchWeather(site), 60000);
      return () => clearInterval(intervalRef.current);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, siteId]);

  const effectiveLevel = override ?? recommendation?.level;
  const reduction = estimateFalseAlarmReduction(history);
  const stormActive = recommendation?.wx?.storm;

  // animated counters for smoother UI
  const displayedReadings = useAnimatedNumber(history.length);
  const displayedReduction = useAnimatedNumber(reduction);

  return (
    <div className="min-h-full w-full bg-[#0A0E13] p-4 sm:p-6 font-['Inter',sans-serif] text-[#E8EDF3]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .fade-in { animation: fadeIn .45s ease both; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .stat-value { transition: color .2s, transform .3s; }
      `}</style>

      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#2DD4CF]/10 text-[#2DD4CF]">
            <RadioTower size={20} />
          </div>
          <div>
            <div className="font-display text-lg font-semibold leading-tight tracking-tight">
              VIGIL <span className="text-[#7C8FA3] font-normal">/ calibration module</span>
            </div>
            <div className="text-xs text-[#7C8FA3]">Weather-adaptive sensitivity for perimeter intrusion detection</div>
          </div>
        </div>

        {/* Site selector */}
        <div className="relative">
          <button
            onClick={() => setSiteOpen((o) => !o)}
            className="flex w-full min-w-[260px] items-center justify-between gap-2 rounded-lg border border-[#1E2733] bg-[#121821] px-3 py-2 text-sm hover:border-[#2DD4CF]/40"
          >
            <span className="truncate">{site.name}</span>
            <ChevronDown size={16} className="shrink-0 text-[#7C8FA3]" />
          </button>
          {siteOpen && (
            <div className="absolute right-0 z-10 mt-1 w-full min-w-[260px] overflow-hidden rounded-lg border border-[#1E2733] bg-[#121821] shadow-xl">
              {SITES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSiteId(s.id);
                    setSiteOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-[#1E2733] ${s.id === siteId ? "text-[#2DD4CF]" : "text-[#E8EDF3]"}`}
                >
                  {s.name}
                  <span className="ml-2 text-xs text-[#7C8FA3]">{s.region}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Storm alert banner */}
      {stormActive && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#FF5470]/30 bg-[#FF5470]/10 px-4 py-2.5 text-sm text-[#FF9BAA]">
          <ShieldAlert size={16} />
          Active storm conditions at this site — sensitivity automatically lowered to reduce false alarms.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-[#FF5470]/30 bg-[#FF5470]/10 px-4 py-2.5 text-sm text-[#FF9BAA]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: live conditions */}
        <div className="flex flex-col gap-3 lg:col-span-1">
          <div className="text-[11px] uppercase tracking-wider text-[#7C8FA3]">Live conditions</div>
          {current ? (
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Wind} label="Wind speed" value={current.wind.toFixed(0)} unit="km/h" accent="#2DD4CF" />
              <StatCard icon={Zap} label="Gusts" value={current.gust.toFixed(0)} unit="km/h" accent="#F2C94C" />
              <StatCard icon={CloudRain} label="Precipitation" value={current.rain.toFixed(1)} unit="mm" accent="#5C9CFF" />
              <StatCard icon={Droplets} label="Humidity" value={current.humidity.toFixed(0)} unit="%" accent="#5C9CFF" />
              <StatCard icon={Thermometer} label="Temperature" value={current.temp.toFixed(1)} unit="°C" accent="#FF9F45" />
              <StatCard icon={Activity} label="Sky condition" value={recommendation?.wx?.label ?? "—"} unit="" accent="#7C8FA3" />
            </div>
          ) : (
            <div className="rounded-lg border border-[#1E2733] bg-[#121821] px-4 py-6 text-center text-sm text-[#7C8FA3]">
              Loading live conditions…
            </div>
          )}

          <button
            onClick={() => fetchWeather(site)}
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg border border-[#1E2733] bg-[#121821] py-2 text-sm text-[#E8EDF3] hover:border-[#2DD4CF]/40 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {loading ? "Refreshing…" : "Refresh now"}
          </button>
          <label className="flex items-center justify-between rounded-lg border border-[#1E2733] bg-[#121821] px-3 py-2 text-xs text-[#7C8FA3]">
            Auto-refresh every 60s
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4 accent-[#2DD4CF]"
            />
          </label>
          {lastUpdated && (
            <div className="text-center text-[11px] text-[#7C8FA3]">
              Last updated {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Center: dial + recommendation */}
        <div className="flex flex-col gap-3 lg:col-span-1">
          <div className="text-[11px] uppercase tracking-wider text-[#7C8FA3]">Sensor sensitivity</div>
          <div className="rounded-lg border border-[#1E2733] bg-[#121821] px-4 py-4">
            {recommendation ? (
              <SensitivityDial level={effectiveLevel} confidence={recommendation.confidence} overridden={!!override} />
            ) : (
              <div className="py-14 text-center text-sm text-[#7C8FA3]">Calculating recommendation…</div>
            )}
          </div>

          <div className="rounded-lg border border-[#1E2733] bg-[#121821] px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-[#7C8FA3]">
              <ShieldQuestion size={14} /> Reasoning
            </div>
            <ul className="space-y-1.5 text-sm text-[#C4CDD8]">
              {recommendation?.reasons.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#2DD4CF]" />
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((lv) => (
              <button
                key={lv}
                onClick={() => setOverride(override === lv ? null : lv)}
                className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                  override === lv
                    ? "border-transparent text-[#0A0E13]"
                    : "border-[#1E2733] bg-[#121821] text-[#7C8FA3] hover:border-[#2DD4CF]/40"
                }`}
                style={override === lv ? { backgroundColor: LEVEL_COLOR[lv] } : {}}
              >
                <Power size={12} className="mb-1 inline" /> Override {lv}
              </button>
            ))}
          </div>
        </div>

        {/* Right: trend + analytics */}
        <div className="flex flex-col gap-3 lg:col-span-1">
          <div className="text-[11px] uppercase tracking-wider text-[#7C8FA3]">Sensitivity trend</div>
          <div className="rounded-lg border border-[#1E2733] bg-[#121821] px-3 py-3">
            {history.length > 1 ? (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2DD4CF" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2DD4CF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1E2733" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="t" stroke="#7C8FA3" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis
                    domain={[0.5, 3.5]}
                    ticks={[1, 2, 3]}
                    tickFormatter={(v) => LEVELS[v - 1]}
                    stroke="#7C8FA3"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  <Tooltip
                    contentStyle={{ background: "#121821", border: "1px solid #1E2733", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#7C8FA3" }}
                  />
                  <ReferenceLine y={2} stroke="#1E2733" />
                  <Area type="stepAfter" dataKey="value" stroke="#2DD4CF" strokeWidth={2} fill="url(#trendFill)" isAnimationActive={true} animationBegin={120} animationDuration={900} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[160px] items-center justify-center text-sm text-[#7C8FA3]">
                Collecting readings — trend appears after 2+ data points
              </div>
            )}
          </div>

          <div className="text-[11px] uppercase tracking-wider text-[#7C8FA3]">Analytics</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-[#1E2733] bg-[#121821] px-4 py-3">
              <div className="flex items-center gap-2 text-[#7C8FA3]">
                <Database size={14} />
                <span className="text-[11px] uppercase tracking-wider">Readings logged</span>
              </div>
              <div className="mt-1 font-mono text-2xl">{displayedReadings}</div>
            </div>
            <div className="rounded-lg border border-[#1E2733] bg-[#121821] px-4 py-3">
              <div className="flex items-center gap-2 text-[#7C8FA3]">
                <TrendingDown size={14} />
                <span className="text-[11px] uppercase tracking-wider">Est. false-alarm cut</span>
              </div>
              <div className="mt-1 font-mono text-2xl text-[#2DD4CF]">{displayedReduction}%</div>
            </div>
          </div>
          <div className="rounded-lg border border-[#1E2733] bg-[#121821] px-4 py-3 text-xs leading-relaxed text-[#7C8FA3]">
            <ShieldCheck size={14} className="mb-1 inline text-[#2DD4CF]" /> Estimate compares adaptive calibration
            against a static always-High-sensitivity baseline, modeled from the proportion of readings where
            conditions triggered a lowered sensitivity. Presented as an illustrative model, not a measured result.
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#1E2733] pt-3 text-[11px] text-[#7C8FA3]">
        <span>VIGIL PIDS · Weather Calibration Module · Prototype build</span>
        <span>Live data: Open-Meteo API · Site: {site.region}</span>
      </div>
    </div>
  );
}
