/**
 * recommendationEngine.js
 *
 * Pure, deterministic rule engine that converts a weather snapshot into a
 * sensor sensitivity recommendation for the PIDS platform. Kept dependency-free
 * and side-effect-free so it can be unit tested in isolation and reused by
 * both the live API route and the scheduled cron job (services/scheduler.js).
 */

const LEVELS = ["Low", "Medium", "High"];

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

/**
 * @param {{wind:number, gust:number, rain:number, temp:number, humidity:number, code:number}} current
 * @returns {{level:string, confidence:number, reasons:string[], storm:boolean, weatherLabel:string}}
 */
function computeRecommendation(current) {
  const { wind, gust, rain, temp, humidity, code } = current;
  const wx = describeWeatherCode(code);
  const reasons = [];
  let score = 3; // 3 = High sensitivity (best case), reduced by adverse conditions

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
    reasons.push("Active thunderstorm conditions — lightning and heavy gusts significantly elevate false-alarm risk");
  }

  if (humidity >= 90 && rain > 0) {
    score -= 1;
    reasons.push(`Humidity at ${humidity.toFixed(0)}% with active precipitation — fog/condensation risk on lenses`);
  }

  if (temp <= 2) {
    score -= 1;
    reasons.push(`Near-freezing temperature (${temp.toFixed(1)}°C) — possible frost/ice interference on sensors`);
  }

  if (reasons.length === 0) {
    reasons.push("Conditions are within normal operating range — no adjustment needed");
  }

  score = Math.max(1, Math.min(3, Math.round(score)));
  const level = LEVELS[score - 1];
  const confidence = Math.max(62, 100 - reasons.length * 8 - (wx.storm ? 10 : 0));
  const riskScore = computeRiskScore({ wind, gust, rain, temp, humidity, storm: wx.storm });

  // Return both a legacy flat shape and a structured `wx` object so
  // frontends expecting either format work without error.
  return { level, confidence, reasons, storm: wx.storm, weatherLabel: wx.label, wx, riskScore };
}

function computeRiskScore(current) {
  let score = 0;

  if (current.wind >= 40) score += 20;
  else if (current.wind >= 25) score += 12;
  else if (current.wind >= 15) score += 6;

  if (current.gust >= 55) score += 18;
  else if (current.gust >= 35) score += 10;

  if (current.rain >= 15) score += 20;
  else if (current.rain >= 5) score += 12;
  else if (current.rain >= 1) score += 6;

  if (current.humidity >= 90) score += 10;
  else if (current.humidity >= 75) score += 5;

  if (current.storm) score += 20;
  if (current.temp <= 2 || current.temp >= 40) score += 6;

  return Math.min(100, Math.round(score));
}

function describeForecastAction(hourly, currentLevel) {
  if (!Array.isArray(hourly) || hourly.length === 0) {
    return { summary: 'Forecast not available', action: currentLevel, hoursAhead: null, hourly: [] };
  }

  const forecastPoints = hourly.slice(0, 24).map((point) => {
    if (!point || !point.recommendation) {
      return { time: point?.time ?? 'unknown', weather: 'Unavailable', level: currentLevel, riskScore: 0 };
    }
    const wx = point.wx || describeWeatherCode(point.code);
    return {
      time: point.time || 'unknown',
      weather: wx?.label ?? 'Unknown',
      level: point.recommendation.level || currentLevel,
      riskScore: typeof point.recommendation.riskScore === 'number' ? point.recommendation.riskScore : 0,
    };
  });

  const alertPoint = forecastPoints.find((point) => point.level !== currentLevel && point.riskScore >= 30);
  if (alertPoint) {
    const hoursAhead = Math.max(1, Math.round((new Date(alertPoint.time) - new Date()) / 3600000));
    return {
      summary: `${alertPoint.weather} expected in ${hoursAhead}h — prepare ${alertPoint.level} sensitivity`,
      action: alertPoint.level,
      hoursAhead,
      hourly: forecastPoints,
    };
  }

  const peak = forecastPoints.reduce((max, point) => (point.riskScore > max.riskScore ? point : max), forecastPoints[0]);
  return {
    summary: `Stable 24h outlook — highest forecast risk is ${peak.weather} in ${Math.max(1, Math.round((new Date(peak.time) - new Date()) / 3600000))}h`,
    action: currentLevel,
    hoursAhead: null,
    hourly: forecastPoints,
  };
}

module.exports = { computeRecommendation, describeWeatherCode, LEVELS, computeRiskScore, describeForecastAction };
