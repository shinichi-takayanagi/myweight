---
name: testing-myweight
description: Test the myweight app end-to-end locally. Use when verifying UI layout, chart rendering, or data display changes.
---

# Testing myweight

## Prerequisites

- Node.js installed
- `npm install` completed in repo root

## Devin Secrets Needed

- None required for visual/layout testing (use fixture data mode)
- `VITE_HEALTHPLANET_ACCESS_TOKEN` needed only if testing live API data fetching

## Local Dev Server

```bash
cd /home/ubuntu/repos/myweight
npm run dev -- --host
```

Default port is 5173. If occupied, Vite auto-increments (5174, 5175, etc).

## Fixture Data Mode

Append `?fixture=success` to the URL to load hardcoded sample data without needing a HealthPlanet API token. This is sufficient for testing UI layout, chart rendering, CSS changes, and metric switching.

Example: `http://localhost:5173/?fixture=success`

## Key UI Elements to Verify

- **Header section** (`.panel-header`): Title "体重の推移" or "体脂肪率の推移", metric selector dropdown
- **Summary row** (`.summary-row`): LATEST value, RECORDS count, UPDATED date
- **Chart area** (`.chart-area`): Contains the Recharts LineChart with:
  - Weight/body fat data line
  - Y-axis with units (kg or %)
  - X-axis with rotated (-90 deg) date labels
  - Medication period background bands with labels (リベルサス 3mg/7mg/14mg, ダパグリフロジン)
  - Legend at top
  - Brush slider at bottom
- **Metric switching**: Dropdown toggles between 体重 (weight) and 体脂肪率 (body fat)
- **Y-axis range inputs** (`.axis-range`, top-right of panel header): min 〜 max number inputs (placeholder "auto"). Empty falls back to the metric's default domain; min >= max also falls back. Inputs reset when switching metric. Note: with default weight domain `[70, 'auto']`, Recharts tick rounding may show a bottom tick of 69kg rather than exactly 70 — this is expected, not a bug.

## Verifying CSS Changes

Use DevTools console to check computed styles:
```js
JSON.stringify({
  panelHeader: getComputedStyle(document.querySelector('.panel-header')).padding,
  summaryDiv: getComputedStyle(document.querySelector('.summary-row > div')).padding,
  chartHeight: getComputedStyle(document.querySelector('.chart-area')).height,
  h2FontSize: getComputedStyle(document.querySelector('.panel-header h2')).fontSize
})
```

## Important Notes

- The Brush component has a hardcoded `y` prop in `WeightChart.tsx`. If chart height changes, the Brush y must be adjusted proportionally.
- CSS is in `src/App.css` (layout) and `src/index.css` (global styles).
- Mobile breakpoint is at 760px width.
- Production-like testing uses `npm run export && npm run preview:pages` at `http://localhost:4173/myweight/`.

## CI

CI runs `npm test`, `npm run lint`, and `npm run build` on PRs. All three must pass before merging.
