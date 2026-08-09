# Okami LED Video Wall Calculator

Standalone Okami Designs LED wall planning tool. Fully **client-side** (math, canvas preview, jsPDF export) — no Node API.

## Local

```bash
npx serve -l 3082 .
# open http://localhost:3082
```

## Docker

```bash
docker build -t okami-led-wall-calculator .
docker run --rm -p 3082:80 okami-led-wall-calculator
```

## Layout

| Path | Role |
|------|------|
| `index.html` | App shell |
| `app.js` | UI / DOM (from `led-wall-visualizer.js`) |
| `engine/` | Portable calculator modules |
| `vendor/jspdf.umd.min.js` | PDF export |
| `css/` | Design tokens + chrome + site style snapshot |

Public URL (planned): `https://ledcalc.okamidesigns.com`
