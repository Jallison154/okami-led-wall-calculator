# LED Video Wall Calculator — Architecture Direction

Product goal: **free web calculator now**, **paid desktop app later** (Electron or Tauri).

---

## Layer model

```
┌─────────────────────────────────────────────────────────┐
│  Web shell (led-wall-visualizer.html, styles.css)       │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Web UI (led-wall-visualizer.js)                        │
│  DOM, controls, preview grid, formatting for display      │
└──────────────────────────┬──────────────────────────────┘
                           │ gatherInputs() → computeWallProject()
┌──────────────────────────▼──────────────────────────────┐
│  Calculation layer (led-wall-calculator/)               │
│  Pure functions, serializable inputs, no DOM              │
└─────────────────────────────────────────────────────────┘
```

---

## Calculation API

All functions live on `OkamiLedWallCalculator` and accept plain objects.

| Function | Purpose |
|----------|---------|
| `calculateCabinetResolution()` | Pixels per cabinet from pitch / presets / custom LED spacing |
| `calculateWallResolution()` | Total wall pixels from grid |
| `calculatePhysicalSize()` | mm and feet from cabinet + grid |
| `calculateAspectRatio()` | Pixel ratio + nearest standard label |
| `calculateContentOverlay()` | Content-fit rectangle inside wall |
| `calculatePortFill()` | Usable pixels per port at fill % |
| `calculateProcessorPorts()` | Ports required for pixel load |
| `calculateCabinetArtworkType()` | `square` / `tall` / custom preview art |
| `computeWallProject()` | Full snapshot from project inputs |
| `calculateLedWall()` | Quick grid metrics + scaling warnings (Signal Lab) |

Constants and presets: `OkamiLedWallCalculator.Constants`.

### Module load order (browser)

```html
<script src="led-wall-calculator/constants.js"></script>
<script src="led-wall-calculator/calculations.js"></script>
<script src="led-wall-calculator/metrics.js"></script>
```

### Tests

```bash
npm run test:calculations
```

---

## Project input shape (save/load ready)

```js
{
  displayType, cabinetPreset, pitchPreset,
  cabinetWidthMM, cabinetHeightMM, pixelPitchMM,
  meshPitchHorizontalMM, meshPitchVerticalMM,
  panelsWide, panelsTall,
  pixelWidth, pixelHeight, autoCalculateResolution,
  portCapacity, portFillThreshold,
  overlayFormat, customFormatWidth, customFormatHeight
}
```

Future: persist this JSON for projects, multi-wall arrays, PNG/SVG export, power/weight calculators — all call the same layer. **Build sheet export** (`build-sheet-export.js`) renders a printable HTML document from `inputs` + `computeWallProject()` state.

---

## Do / Don't

**Do**
- Add new math in `led-wall-calculator/calculations.js`
- Keep UI formatting (feet/inches labels, preview DOM) in `led-wall-visualizer.js`
- Pass complete input objects into calculation functions

**Don't**
- Put wall math in HTML, CSS, or preview render functions
- Read DOM inside the calculation layer
- Duplicate formulas in Signal Lab or export tools — import this layer instead

---

## Related code

- `tools/led-wall-calculator/metrics.js` — grid metrics + warnings (`calculateLedWall`); shared by Signal Lab via shim.
- `tools/signal-lab/engine/led-wall-calculator.js` — thin adapter → `OkamiLedWallCalculator.Metrics`.
- `tools/signal-lab/modules/led-wall-utilities.js` — canvas preview; uses metrics via `OkamiSignalLab.LedWallCalculator`.
