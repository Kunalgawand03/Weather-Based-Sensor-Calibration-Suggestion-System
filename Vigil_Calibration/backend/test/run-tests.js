const assert = require('assert');
const { computeRecommendation } = require('../services/recommendationEngine');

function approxEqual(a, b, tol = 1) {
  return Math.abs(a - b) <= tol;
}

function run() {
  console.log('Running recommendation engine tests...');

  // Clear conditions -> expect High
  let r = computeRecommendation({ wind: 5, gust: 6, rain: 0, temp: 25, humidity: 40, code: 0 });
  assert.strictEqual(r.level, 'High');

  // Heavy rain -> Low
  r = computeRecommendation({ wind: 10, gust: 12, rain: 20, temp: 22, humidity: 85, code: 80 });
  assert.strictEqual(r.level, 'Low');

  // Moderate wind -> Medium
  r = computeRecommendation({ wind: 25, gust: 30, rain: 0.5, temp: 20, humidity: 60, code: 1 });
  assert.strictEqual(r.level, 'Medium');

  console.log('All tests passed.');
}

if (require.main === module) {
  try { run(); process.exit(0); } catch (e) { console.error('Tests failed:', e.message); process.exit(2); }
}
