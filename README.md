# Okami LED Video Wall Calculator

Standalone Okami Designs LED wall planning tool. Fully **client-side** (math, canvas preview, jsPDF export) — no Node API.

## Pages

| Path | Role |
|------|------|
| `/` (`index.html`) | App **landing page** — what the main Okami site links to |
| `/app.html` | The actual tool UI |

Flow: main site Tools → this host `/` → **Open Calculator** → `app.html`.

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

## Portainer deployment

This is a stateless static app (nginx serving pre-built files) — no env vars or volumes required.

1. In Portainer: **Stacks → Add stack → Repository**.
2. Repository URL: `https://github.com/Jallison154/okami-led-wall-calculator.git`, reference `refs/heads/main`, Compose path `docker-compose.yml`.
3. **Deploy the stack.** Portainer builds the image from the repo and starts `okami-led-wall-calculator`, publishing container port 80 to host port `${PORT:-3082}`.
4. Point your reverse proxy / Cloudflare Tunnel at `http://<host>:3082` (e.g. for `ledcalc.okamidesigns.com`).

To **update**: re-pull and redeploy the stack from Portainer (or enable GitOps auto-update) — the whole container is replaced on each deploy, no data to preserve.

## Layout

| Path | Role |
|------|------|
| `index.html` | App shell |
| `app.js` | UI / DOM (from `led-wall-visualizer.js`) |
| `engine/` | Portable calculator modules |
| `vendor/jspdf.umd.min.js` | PDF export |
| `css/` | Design tokens + chrome + site style snapshot |

Public URL (planned): `https://ledcalc.okamidesigns.com`
