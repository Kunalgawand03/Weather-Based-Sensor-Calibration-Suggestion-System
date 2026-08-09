# Presentation Outline — VIGIL Weather Calibration Module

Suggested 8–10 slide structure. Keep each slide to one idea; let the live demo carry the detail.

1. **Title** — Project name, one-line tagline, team name, college.
2. **The problem** — PIDS false alarms caused by weather; cost of false alarms (operator fatigue, wasted
   response, alarm distrust). One strong stat or scenario, not a wall of text.
3. **Our approach** — One sentence: "Read live weather → run it through an explainable rule engine → recommend
   sensitivity → let operators override when needed." Diagram from `ARCHITECTURE.md`.
4. **Live demo** (or embedded video clip) — Show site selection, live conditions loading, dial reacting,
   reasoning list, trend chart, and an override.
5. **How the recommendation engine works** — Show the actual rule thresholds (wind/rain/storm/humidity/temp).
   Emphasize explainability: every recommendation ships with plain-language reasons.
6. **Architecture** — Frontend / Backend / DB / External API diagram, tech stack table.
7. **Impact / analytics** — Estimated false-alarm reduction model, what data would validate it in production
   (real false-alarm logs correlated with weather).
8. **What's next** — Path to production: swap rule engine for a model trained on real false-alarm logs, add
   auth, multi-tenant sites, SMS/email alerting, integrate directly with camera/sensor firmware.
9. **Team & thanks** — Team members, roles, GitHub link, video link.

## Talking points that tend to score well with judges

- Lead with the *operator's* problem, not the tech stack.
- Show, don't just tell: the live dial reacting to real weather is more convincing than any slide.
- Be explicit about what's a real measured result vs. an illustrative estimate (the false-alarm reduction number
  is explicitly modeled, not measured — say so; judges respect honesty about limitations far more than an
  inflated, unsupported claim).
- Name every third-party tool/API/library used (Open-Meteo, Recharts, lucide-react, better-sqlite3) — the case
  study explicitly asks for acknowledgment of third-party tools.
