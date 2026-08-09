(function(global) {
    'use strict';

    const Calc = global.OkamiLedWallCalculator;
    const C = Calc?.Constants;
    const WEBSITE_URL = 'https://okamidesigns.com';
    const MM_PER_FOOT = C?.MM_PER_FOOT || 304.8;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function hasValue(value) {
        return value !== null && value !== undefined && value !== '' && !Number.isNaN(value);
    }

    function formatNumber(value) {
        return Number(value).toLocaleString('en-US');
    }

    function formatFeetInches(feetDecimal) {
        if (!hasValue(feetDecimal)) {
            return null;
        }
        const totalInches = Math.round(feetDecimal * 12);
        const feet = Math.floor(totalInches / 12);
        const inches = totalInches % 12;
        return `${feet}' ${inches}"`;
    }

    function formatMeters(mm) {
        if (!hasValue(mm)) {
            return null;
        }
        return `${(mm / 1000).toFixed(2)} m`;
    }

    function formatPortCapacity(capacity) {
        if (!hasValue(capacity)) {
            return null;
        }
        if (capacity >= 1000000) {
            const millions = capacity / 1000000;
            return Number.isInteger(millions) ? `${millions}M px` : `${millions.toFixed(1)}M px`;
        }
        if (capacity >= 1000) {
            return `${Math.round(capacity / 1000)}k px`;
        }
        return `${capacity.toLocaleString()} px`;
    }

    function formatCabinetPresetLabel(preset) {
        const labels = {
            '500x500': '500 × 500 mm',
            '500x1000': '500 × 1000 mm',
            custom: 'Custom'
        };
        return labels[preset] || 'Custom';
    }

    function formatDisplayMode(inputs) {
        if (Calc?.isCustomSpacingDisplayType?.(inputs.displayType)) {
            return 'Custom LED Spacing';
        }
        return 'Standard LED';
    }

    function formatPitchOrSpacing(inputs) {
        if (Calc?.isCustomSpacingDisplayType?.(inputs.displayType)) {
            const h = inputs.meshPitchHorizontalMM;
            const v = inputs.meshPitchVerticalMM;
            if (!hasValue(h) || !hasValue(v)) {
                return null;
            }
            return `${h} × ${v} mm spacing`;
        }

        const pitchPreset = inputs.pitchPreset;
        if (pitchPreset && pitchPreset !== 'custom') {
            return `P${pitchPreset}`;
        }

        if (hasValue(inputs.pixelPitchMM)) {
            return `${Number(inputs.pixelPitchMM).toFixed(1)} mm pitch`;
        }

        return null;
    }

    function formatCabinetOrientation(state) {
        const type = state.cabinetArtworkType;
        if (type === 'square') {
            return 'Square cabinets (1:1)';
        }
        if (type === 'tall') {
            return 'Portrait cabinets (1:2 height)';
        }
        if (state.cabinetHeightMM > state.cabinetWidthMM) {
            return 'Portrait orientation';
        }
        if (state.cabinetWidthMM > state.cabinetHeightMM) {
            return 'Landscape orientation';
        }
        return 'Square orientation';
    }

    function formatAmpsValue(amps) {
        if (!hasValue(amps)) {
            return null;
        }
        return `${Number(amps).toFixed(1)} A`;
    }

    /**
     * Scalable SVG wall diagram with optional content overlay.
     */
    function buildWallDiagramSvg(state, inputs) {
        if (!state?.panelsWide || !state?.panelsTall) {
            return '';
        }

        const pad = 12;
        const captionH = 52;
        const maxDiagramW = 520;
        const maxDiagramH = 190;
        const wallAspect = state.physicalWidthMM / state.physicalHeightMM;
        let diagramW;
        let diagramH;

        if (wallAspect >= maxDiagramW / maxDiagramH) {
            diagramW = maxDiagramW;
            diagramH = maxDiagramW / wallAspect;
        } else {
            diagramH = maxDiagramH;
            diagramW = maxDiagramH * wallAspect;
        }

        const x0 = pad;
        const y0 = pad;
        const cellW = diagramW / state.panelsWide;
        const cellH = diagramH / state.panelsTall;
        const svgW = pad * 2 + diagramW;
        const svgH = pad * 2 + diagramH + captionH;
        const parts = [];

        parts.push(`<rect x="${x0}" y="${y0}" width="${diagramW}" height="${diagramH}" rx="4" fill="#2a2a2a" stroke="#666" stroke-width="1.2"/>`);

        for (let col = 1; col < state.panelsWide; col += 1) {
            const x = x0 + col * cellW;
            parts.push(`<line x1="${x}" y1="${y0}" x2="${x}" y2="${y0 + diagramH}" stroke="rgba(255,255,255,0.14)" stroke-width="0.75"/>`);
        }

        for (let row = 1; row < state.panelsTall; row += 1) {
            const y = y0 + row * cellH;
            parts.push(`<line x1="${x0}" y1="${y}" x2="${x0 + diagramW}" y2="${y}" stroke="rgba(255,255,255,0.14)" stroke-width="0.75"/>`);
        }

        if (state.overlay) {
            const { leftPercent, topPercent, widthPercent, heightPercent } = state.overlay;
            const overlayX = x0 + (leftPercent / 100) * diagramW;
            const overlayY = y0 + (topPercent / 100) * diagramH;
            const overlayW = (widthPercent / 100) * diagramW;
            const overlayH = (heightPercent / 100) * diagramH;
            const referenceLabel = `${escapeHtml(state.overlayFormatLabel || '16:9')} reference area`;

            parts.push(`<rect x="${overlayX}" y="${overlayY}" width="${overlayW}" height="${overlayH}" fill="none" stroke="#ff6a2d" stroke-width="2" stroke-dasharray="6 4"/>`);
            parts.push(`<text x="${overlayX + overlayW / 2}" y="${overlayY - 4}" text-anchor="middle" fill="#ff6a2d" font-size="10" font-weight="700" font-family="Montserrat, Arial, sans-serif">${referenceLabel}</text>`);
        }

        const widthFt = formatFeetInches(state.physicalWidthFt);
        const heightFt = formatFeetInches(state.physicalHeightFt);
        const widthM = formatMeters(state.physicalWidthMM);
        const heightM = formatMeters(state.physicalHeightMM);
        const captionY = y0 + diagramH + 18;
        const captionLine1 = `${state.panelsWide} × ${state.panelsTall} cabinets · ${formatNumber(state.totalPixelWidth)} × ${formatNumber(state.totalPixelHeight)} px`;
        const captionLine2 = widthFt && heightFt && widthM && heightM
            ? `${widthFt} × ${heightFt} (${widthM} × ${heightM})`
            : '';

        parts.push(`<text x="${svgW / 2}" y="${captionY}" text-anchor="middle" fill="#cccccc" font-size="10.5" font-weight="600" font-family="Montserrat, Arial, sans-serif">${escapeHtml(captionLine1)}</text>`);
        if (captionLine2) {
            parts.push(`<text x="${svgW / 2}" y="${captionY + 16}" text-anchor="middle" fill="#999999" font-size="9.5" font-weight="500" font-family="Montserrat, Arial, sans-serif">${escapeHtml(captionLine2)}</text>`);
        }

        return `<svg class="build-sheet-wall-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" role="img" aria-label="LED wall layout diagram">${parts.join('')}</svg>`;
    }

    /**
     * Pixel-based port load plan for build sheet display.
     */
    function calculatePortMapping(state) {
        const ports = [];
        const portsRequired = state.portsRequired;
        const usablePixelsPerPort = state.usablePixelsPerPort;
        const totalPixels = state.totalPixels;
        const pixelsPerCabinet = state.pixelWidth * state.pixelHeight;

        if (!portsRequired || !usablePixelsPerPort || !totalPixels) {
            return ports;
        }

        let assignedPixels = 0;
        for (let portNum = 1; portNum <= portsRequired; portNum += 1) {
            const remaining = totalPixels - assignedPixels;
            const portPixels = portNum === portsRequired
                ? remaining
                : Math.min(usablePixelsPerPort, remaining);
            const fillPercent = usablePixelsPerPort > 0
                ? (portPixels / usablePixelsPerPort) * 100
                : 0;
            const cabinetsEstimate = pixelsPerCabinet > 0
                ? Math.round(portPixels / pixelsPerCabinet)
                : 0;

            ports.push({
                port: portNum,
                pixels: portPixels,
                fillPercent,
                cabinetsEstimate: Math.min(cabinetsEstimate, state.totalPanels)
            });
            assignedPixels += portPixels;
        }

        return ports;
    }

    function collectWarnings(inputs, state, portMapping) {
        const warnings = [];

        if (portMapping.length) {
            const peakFill = Math.max(...portMapping.map((entry) => entry.fillPercent));
            if (peakFill >= 98) {
                warnings.push('At least one port is at or above 98% of the configured fill threshold. Confirm processor headroom with your controller manufacturer.');
            } else if (peakFill >= 90) {
                warnings.push('One or more ports are near the configured fill threshold. Consider additional headroom for stable playback.');
            }
        }

        if (state.portsRequired >= 12) {
            warnings.push(`High port count (${state.portsRequired}). Verify sending card, processor, and fiber/converter layout.`);
        }

        if (inputs.autoCalculateResolution === false) {
            warnings.push('Cabinet pixel resolution is manually overridden — confirm values against manufacturer specifications.');
        }

        if (inputs.cabinetPreset === 'custom' || !['500x500', '500x1000'].includes(inputs.cabinetPreset)) {
            warnings.push('Custom cabinet dimensions are in use — verify physical size and mounting before fabrication.');
        }

        if (state.overlay && state.overlay.usedPercentage < 85) {
            warnings.push(`Content overlay (${state.overlayFormatLabel}) uses ${Math.round(state.overlay.usedPercentage)}% of the wall — significant inactive pixels remain outside the target format.`);
        }

        if (state.atSafePortLimit) {
            warnings.push('At least one port is at the configured safe fill limit. Add another port for more headroom.');
        }

        return warnings;
    }

    function formatPercent(value, digits = 1) {
        if (!hasValue(value)) {
            return null;
        }
        return `${Number(value).toFixed(digits)}%`;
    }

    function buildDetailRows(rows) {
        return rows.filter((row) => hasValue(row.value));
    }

    function buildBuildSheetModel(inputs, state, options = {}) {
        const exportedAt = options.exportedAt || new Date();
        const portMapping = calculatePortMapping(state);
        const warnings = collectWarnings(inputs, state, portMapping);
        const widthFt = formatFeetInches(state.physicalWidthFt);
        const heightFt = formatFeetInches(state.physicalHeightFt);
        const widthM = formatMeters(state.physicalWidthMM);
        const heightM = formatMeters(state.physicalHeightMM);
        const physicalSize = widthFt && heightFt && widthM && heightM
            ? `${widthFt} × ${heightFt} (${widthM} × ${heightM})`
            : null;

        const avgCabinetsPerPort = portMapping.length
            ? Math.round(portMapping.reduce((sum, entry) => sum + entry.cabinetsEstimate, 0) / portMapping.length)
            : null;

        const circuitAmperage = state.circuitAmperage;
        const circuitsLabel = hasValue(circuitAmperage)
            ? `Estimated ${circuitAmperage}A circuits required`
            : 'Estimated circuits required';
        const headroomPercent = hasValue(state.circuitHeadroomPercent)
            ? state.circuitHeadroomPercent
            : (hasValue(state.circuitSafeLoadPercent) ? 100 - state.circuitSafeLoadPercent : null);

        const model = {
            exportedAt,
            projectName: options.projectName?.trim() || null,
            logoUrl: options.logoUrl || '../GFX/Full/Okami_Designs_FullW.png',
            websiteUrl: options.websiteUrl || WEBSITE_URL,
            warnings,
            portMapping,
            wallDiagramSvg: buildWallDiagramSvg(state, inputs),
            wallState: state,
            sections: {
                overview: buildDetailRows([
                    { label: 'Wall grid (W × H)', value: `${state.panelsWide} × ${state.panelsTall} cabinets` },
                    { label: 'Total cabinets', value: formatNumber(state.totalPanels) },
                    { label: 'Physical size', value: physicalSize },
                    { label: 'Aspect ratio', value: state.closestRatio?.label || (state.aspectRatio ? state.aspectRatio.toFixed(3) : null) },
                    { label: 'Display mode', value: formatDisplayMode(inputs) },
                    { label: 'Pixel pitch / spacing', value: formatPitchOrSpacing(inputs) },
                    { label: 'Cabinet size', value: `${state.cabinetWidthMM} × ${state.cabinetHeightMM} mm` },
                    { label: 'Cabinet type', value: formatCabinetPresetLabel(inputs.cabinetPreset) }
                ]),
                resolution: buildDetailRows([
                    { label: 'Total resolution', value: `${formatNumber(state.totalPixelWidth)} × ${formatNumber(state.totalPixelHeight)} px` },
                    { label: 'Pixels per cabinet', value: `${formatNumber(state.pixelWidth)} × ${formatNumber(state.pixelHeight)} px` },
                    { label: 'Horizontal pixels', value: formatNumber(state.totalPixelWidth) },
                    { label: 'Vertical pixels', value: formatNumber(state.totalPixelHeight) }
                ]),
                processor: buildDetailRows([
                    { label: 'Port capacity setting', value: state.portCapacity ? `${formatNumber(state.portCapacity)} px max/port` : null },
                    { label: 'Safe fill threshold', value: hasValue(state.portFillThreshold) ? `${state.portFillThreshold}%` : null },
                    { label: 'Usable pixels per port', value: state.usablePixelsPerPort ? `${formatNumber(state.usablePixelsPerPort)} px` : null },
                    { label: 'Total ports required', value: hasValue(state.portsRequired) ? formatNumber(state.portsRequired) : null },
                    { label: 'Safe capacity used (peak port)', value: formatPercent(state.peakSafeCapacityUsedPercent ?? state.peakPortUtilizationPercent) },
                    { label: 'Actual max port load (peak)', value: formatPercent(state.peakRawMaxLoadPercent) },
                    { label: 'Safety headroom (peak)', value: formatPercent(state.processorPortHeadroomPercent) },
                    { label: 'Safe capacity used (avg port)', value: formatPercent(state.avgPortUtilizationPercent) },
                    { label: 'Avg. cabinets per port (est.)', value: avgCabinetsPerPort ? `~${avgCabinetsPerPort}` : null },
                    { label: 'Sending hardware', value: 'Confirm processor / sending card model with manufacturer — capacity settings above are user-defined.' }
                ]),
                power: buildDetailRows([
                    { label: 'Watts per panel', value: hasValue(state.wattsPerPanel) ? `${formatNumber(state.wattsPerPanel)} W` : null },
                    { label: 'Total panel count', value: hasValue(state.totalPanels) ? formatNumber(state.totalPanels) : null },
                    { label: 'Total estimated watts', value: hasValue(state.totalEstimatedWatts) ? `${formatNumber(state.totalEstimatedWatts)} W` : null },
                    { label: 'Total estimated amps', value: formatAmpsValue(state.totalEstimatedAmps) },
                    { label: 'Circuit size', value: hasValue(circuitAmperage) && hasValue(state.circuitVoltage) ? `${circuitAmperage}A @ ${state.circuitVoltage}V` : null },
                    { label: 'Raw circuit capacity', value: hasValue(state.rawWattsPerCircuit) ? `${formatNumber(Math.round(state.rawWattsPerCircuit))} W` : null },
                    { label: 'Safe load', value: hasValue(state.circuitSafeLoadPercent) ? `${state.circuitSafeLoadPercent}%` : null },
                    { label: '20% headroom included', value: hasValue(headroomPercent) ? `${headroomPercent}% reserved` : null },
                    { label: 'Usable watts per circuit', value: hasValue(state.usableWattsPerCircuit) ? `${formatNumber(Math.round(state.usableWattsPerCircuit))} W` : null },
                    { label: circuitsLabel, value: hasValue(state.circuitsRequired) ? formatNumber(state.circuitsRequired) : null }
                ]),
                buildNotes: buildDetailRows([
                    { label: 'Cabinet orientation', value: formatCabinetOrientation(state) },
                    { label: 'Resolution mode', value: inputs.autoCalculateResolution === false ? 'Manual cabinet resolution' : 'Auto-calculated from pitch / spacing' },
                    Calc?.isCustomSpacingDisplayType?.(inputs.displayType)
                        ? { label: 'Custom LED spacing', value: `${inputs.meshPitchHorizontalMM} × ${inputs.meshPitchVerticalMM} mm` }
                        : null,
                    state.overlay && state.overlayFormatLabel
                        ? {
                            label: 'Content overlay',
                            value: `${state.overlayFormatLabel} — ${formatNumber(state.overlay.overlayPixelWidth)} × ${formatNumber(state.overlay.overlayPixelHeight)} px (${Math.round(state.overlay.usedPercentage)}% of wall used)`
                        }
                        : null,
                    inputs.overlayFormat && inputs.overlayFormat !== 'none' && !state.overlay
                        ? { label: 'Content overlay', value: 'Enabled (no active area calculated)' }
                        : null
                ].filter(Boolean))
            }
        };

        return model;
    }

    function renderDetailSection(title, rows) {
        if (!rows.length) {
            return '';
        }

        const items = rows.map((row) => `
            <div class="build-sheet-row">
                <dt>${escapeHtml(row.label)}</dt>
                <dd>${escapeHtml(row.value)}</dd>
            </div>
        `).join('');

        return `
            <section class="build-sheet-section">
                <h2 class="build-sheet-section-title">${escapeHtml(title)}</h2>
                <dl class="build-sheet-details">${items}</dl>
            </section>
        `;
    }

    function renderPortMappingSection(portMapping, warnings) {
        if (!portMapping.length) {
            return '';
        }

        const rows = portMapping.map((entry) => `
            <tr>
                <td>Port ${entry.port}</td>
                <td>${formatNumber(entry.pixels)} px</td>
                <td>${entry.fillPercent.toFixed(1)}%</td>
                <td>~${formatNumber(entry.cabinetsEstimate)}</td>
            </tr>
        `).join('');

        const warningHtml = warnings.length
            ? `<p class="build-sheet-note build-sheet-note--warn">Review port loading before deployment. Estimates assume sequential pixel distribution.</p>`
            : `<p class="build-sheet-note">Cabinet counts per port are estimates based on pixel load — confirm mapping with your processor software.</p>`;

        return `
            <section class="build-sheet-section">
                <h2 class="build-sheet-section-title">Port Mapping / Data Plan</h2>
                <p class="build-sheet-lead">${formatNumber(portMapping.length)} sending port${portMapping.length === 1 ? '' : 's'} suggested for this wall configuration.</p>
                <div class="build-sheet-table-wrap">
                    <table class="build-sheet-table">
                        <thead>
                            <tr>
                                <th>Port</th>
                                <th>Pixel load</th>
                                <th>Fill %</th>
                                <th>Cabinets (est.)</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                ${warningHtml}
            </section>
        `;
    }

    function renderWallVisualSection(wallDiagramSvg, state) {
        if (!wallDiagramSvg) {
            return '';
        }

        const overlayNote = state.overlay && state.overlayFormatLabel
            ? `<p class="build-sheet-note">Overlay shows ${escapeHtml(state.overlayFormatLabel)} content fit only. Full LED wall remains active.</p>`
            : '';

        return `
            <section class="build-sheet-section build-sheet-section--visual wall-visual-print">
                <h2 class="build-sheet-section-title">Wall Layout</h2>
                <div class="build-sheet-wall-visual">${wallDiagramSvg}</div>
                ${overlayNote}
            </section>
        `;
    }

    function renderWarningsSection(warnings) {
        if (!warnings.length) {
            return '';
        }

        const items = warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('');
        return `
            <section class="build-sheet-section build-sheet-section--warnings">
                <h2 class="build-sheet-section-title">Warnings &amp; Notes</h2>
                <ul class="build-sheet-warnings">${items}</ul>
            </section>
        `;
    }

    function renderPowerSection(powerRows) {
        const headroomNote = 'Circuit estimates include 20% headroom by default for safer planning. Verify final power requirements with manufacturer specs and a qualified electrician.';
        const disclaimer = 'Power estimates are for planning only. Confirm actual cabinet power draw, distribution, and cabling with manufacturer specifications.';

        if (!powerRows?.length) {
            return `
                <section class="build-sheet-section">
                    <h2 class="build-sheet-section-title">Estimated Power Requirements</h2>
                    <p class="build-sheet-note build-sheet-note--disclaimer">${escapeHtml(headroomNote)}</p>
                </section>
            `;
        }

        const items = powerRows.map((row) => `
            <div class="build-sheet-row">
                <dt>${escapeHtml(row.label)}</dt>
                <dd>${escapeHtml(row.value)}</dd>
            </div>
        `).join('');

        return `
            <section class="build-sheet-section">
                <h2 class="build-sheet-section-title">Estimated Power Requirements</h2>
                <dl class="build-sheet-details">${items}</dl>
                <p class="build-sheet-note build-sheet-note--disclaimer">${escapeHtml(headroomNote)}</p>
                <p class="build-sheet-note">${escapeHtml(disclaimer)}</p>
            </section>
        `;
    }

    function buildBuildSheetHtml(model) {
        const exportLabel = model.exportedAt.toLocaleString(undefined, {
            dateStyle: 'full',
            timeStyle: 'short'
        });

        const projectLine = model.projectName
            ? `<p class="build-sheet-project">${escapeHtml(model.projectName)}</p>`
            : '';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LED Wall Configuration — Okami Designs</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        /* Screen preview — Okami dark theme */
        :root {
            --okami-bg: #121212;
            --okami-card: #1a1a1a;
            --okami-border: rgba(255, 255, 255, 0.08);
            --okami-text: #f2f2f2;
            --okami-muted: rgba(255, 255, 255, 0.58);
            --okami-accent: #ff6a2d;
        }

        * { box-sizing: border-box; }

        html, body {
            margin: 0;
            padding: 0;
            background: var(--okami-bg);
            color: var(--okami-text);
            font-family: "Montserrat", "Segoe UI", Arial, sans-serif;
            line-height: 1.45;
        }

        body {
            padding: 24px;
        }

        .build-sheet-page {
            max-width: 8.5in;
            margin: 0 auto;
        }

        .build-sheet-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            padding-bottom: 18px;
            border-bottom: 2px solid rgba(255, 106, 45, 0.45);
            margin-bottom: 22px;
        }

        .build-sheet-brand img {
            display: block;
            max-width: 180px;
            height: auto;
        }

        .build-sheet-header-meta {
            text-align: right;
        }

        .build-sheet-title {
            margin: 0 0 6px;
            font-size: 1.55rem;
            font-weight: 800;
            letter-spacing: -0.02em;
        }

        .build-sheet-subtitle,
        .build-sheet-exported,
        .build-sheet-project {
            margin: 0;
            color: var(--okami-muted);
            font-size: 0.92rem;
        }

        .build-sheet-project {
            margin-top: 6px;
            color: var(--okami-accent);
            font-weight: 700;
        }

        .build-sheet-section {
            background: var(--okami-card);
            border: 1px solid var(--okami-border);
            border-radius: 12px;
            padding: 16px 18px;
            margin-bottom: 16px;
        }

        .build-sheet-section-title {
            margin: 0 0 12px;
            font-size: 0.82rem;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--okami-accent);
        }

        .build-sheet-details {
            margin: 0;
        }

        .build-sheet-row {
            display: grid;
            grid-template-columns: minmax(140px, 38%) 1fr;
            gap: 10px 16px;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .build-sheet-row:last-child {
            border-bottom: none;
            padding-bottom: 0;
        }

        .build-sheet-row dt {
            margin: 0;
            color: var(--okami-muted);
            font-size: 0.88rem;
            font-weight: 600;
        }

        .build-sheet-row dd {
            margin: 0;
            font-size: 0.95rem;
            font-weight: 700;
        }

        .build-sheet-lead,
        .build-sheet-note {
            margin: 0 0 12px;
            color: var(--okami-muted);
            font-size: 0.88rem;
        }

        .build-sheet-note--warn {
            color: #ffb089;
        }

        .build-sheet-note--disclaimer {
            margin-top: 12px;
            margin-bottom: 0;
            font-size: 0.82rem;
            font-style: italic;
        }

        .build-sheet-wall-visual {
            display: flex;
            justify-content: center;
            margin: 4px 0 8px;
        }

        .build-sheet-wall-svg {
            display: block;
            width: 100%;
            max-width: 100%;
            height: auto;
        }

        .build-sheet-table-wrap {
            overflow-x: auto;
        }

        .build-sheet-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.88rem;
        }

        .build-sheet-table th,
        .build-sheet-table td {
            padding: 8px 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            text-align: left;
        }

        .build-sheet-table th {
            color: var(--okami-accent);
            font-size: 0.75rem;
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }

        .build-sheet-warnings {
            margin: 0;
            padding-left: 18px;
            color: #ffd3bf;
            font-size: 0.88rem;
        }

        .build-sheet-warnings li + li {
            margin-top: 8px;
        }

        .build-sheet-footer {
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid var(--okami-border);
            color: var(--okami-muted);
            font-size: 0.78rem;
        }

        .build-sheet-footer strong {
            color: var(--okami-text);
        }

        .export-actions {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 8px;
            margin: 0 0 18px;
        }

        .export-actions-row {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }

        .print-button,
        .build-sheet-btn {
            appearance: none;
            border: 1px solid rgba(255, 106, 45, 0.55);
            background: rgba(255, 106, 45, 0.14);
            color: #fff;
            border-radius: 8px;
            padding: 10px 16px;
            font: inherit;
            font-size: 0.88rem;
            font-weight: 700;
            cursor: pointer;
        }

        .print-button:hover,
        .build-sheet-btn:hover {
            background: rgba(255, 106, 45, 0.24);
        }

        .print-hint {
            margin: 0;
            max-width: 22rem;
            text-align: right;
            font-size: 0.78rem;
            line-height: 1.4;
            color: var(--okami-muted);
        }

        .build-sheet-page-one {
            break-inside: avoid-page;
            page-break-inside: avoid;
        }

        /* ── Printer-friendly stylesheet ── */
        @page {
            size: letter;
            margin: 0.5in;
        }

        @media print {
            :root {
                --okami-bg: #ffffff;
                --okami-card: #ffffff;
                --okami-border: #dddddd;
                --okami-text: #111111;
                --okami-muted: #444444;
                --okami-accent: #f97316;
            }

            html,
            body {
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #111111 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .export-actions,
            .print-button,
            .print-hint,
            button {
                display: none !important;
            }

            .build-sheet-page {
                background: #ffffff !important;
                color: #111111 !important;
                width: 100% !important;
                max-width: none !important;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
            }

            .build-sheet-page-one {
                break-inside: avoid-page;
                page-break-inside: avoid;
            }

            .build-sheet-header,
            .build-sheet-section,
            .build-sheet-footer,
            .build-sheet-table-wrap {
                background: #ffffff !important;
                color: #111111 !important;
                border: 1px solid #dddddd !important;
                border-radius: 6px !important;
                box-shadow: none !important;
                break-inside: avoid;
                page-break-inside: avoid;
            }

            .build-sheet-header {
                display: flex !important;
                padding: 12px 14px !important;
                margin-bottom: 12px !important;
                border-bottom: 2px solid #f97316 !important;
            }

            .build-sheet-brand img {
                max-width: 140px !important;
                filter: brightness(0) !important;
            }

            .build-sheet-title {
                color: #111111 !important;
                font-size: 1.25rem !important;
            }

            .build-sheet-subtitle,
            .build-sheet-exported,
            .build-sheet-project {
                color: #444444 !important;
            }

            .build-sheet-project {
                color: #c44f1a !important;
            }

            .build-sheet-section {
                padding: 12px 14px !important;
                margin-bottom: 12px !important;
            }

            .build-sheet-section-title {
                color: #f97316 !important;
                border-bottom: 1px solid #f97316;
                padding-bottom: 6px;
            }

            .build-sheet-row {
                border-bottom-color: #eeeeee !important;
            }

            .build-sheet-row dt {
                color: #444444 !important;
            }

            .build-sheet-row dd {
                color: #111111 !important;
            }

            .build-sheet-lead,
            .build-sheet-note,
            .build-sheet-note--disclaimer {
                color: #444444 !important;
            }

            .build-sheet-note--warn,
            .build-sheet-warnings {
                color: #8a3b12 !important;
            }

            .build-sheet-table th {
                color: #f97316 !important;
                border-bottom: 1px solid #dddddd !important;
            }

            .build-sheet-table td {
                color: #111111 !important;
                border-bottom: 1px solid #eeeeee !important;
            }

            .build-sheet-table thead {
                display: table-header-group;
            }

            .build-sheet-table tr {
                break-inside: avoid;
                page-break-inside: avoid;
            }

            .build-sheet-footer {
                border-top: 1px solid #dddddd !important;
                color: #444444 !important;
                margin-top: 16px !important;
                padding-top: 12px !important;
            }

            .build-sheet-footer strong {
                color: #111111 !important;
            }

            .build-sheet-section--visual,
            .build-sheet-wall-visual,
            .wall-visual-print,
            .build-sheet-wall-svg,
            svg {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
                max-width: 100% !important;
            }

            .build-sheet-section--visual {
                max-height: 3in;
            }

            .build-sheet-wall-svg {
                max-height: 2.4in !important;
            }

            .build-sheet-wall-svg rect[fill="#2a2a2a"] {
                fill: #e8e8e8 !important;
                stroke: #999999 !important;
            }

            .build-sheet-wall-svg line {
                stroke: #bbbbbb !important;
            }

            .build-sheet-wall-svg rect[fill="rgba(0,0,0,0.45)"] {
                fill: #dddddd !important;
            }

            .build-sheet-wall-svg rect[stroke="#ff6a2d"] {
                stroke: #f97316 !important;
            }

            .build-sheet-wall-svg text {
                fill: #333333 !important;
            }

            .build-sheet-wall-svg text[fill="#ff6a2d"] {
                fill: #f97316 !important;
            }
        }
    </style>
</head>
<body>
    <div class="build-sheet build-sheet-page">
        <div class="export-actions">
            <div class="export-actions-row">
                <button type="button" class="print-button build-sheet-btn" onclick="window.print()">Print / Save as PDF</button>
            </div>
            <p class="print-hint">In the print dialog, turn off <strong>Headers and Footers</strong> for a cleaner PDF.</p>
        </div>

        <div class="build-sheet-page-one">
            <header class="build-sheet-header">
                <div class="build-sheet-brand">
                    <img src="${escapeHtml(model.logoUrl)}" alt="Okami Designs">
                </div>
                <div class="build-sheet-header-meta">
                    <h1 class="build-sheet-title">LED Wall Configuration</h1>
                    <p class="build-sheet-subtitle">Build Sheet</p>
                    <p class="build-sheet-exported">Exported ${escapeHtml(exportLabel)}</p>
                    ${projectLine}
                </div>
            </header>

            ${renderWallVisualSection(model.wallDiagramSvg, model.wallState)}
            ${renderDetailSection('Wall Overview', model.sections.overview)}
        </div>

        ${renderDetailSection('Resolution', model.sections.resolution)}
        ${renderDetailSection('Processor / Sending Card', model.sections.processor)}
        ${renderPortMappingSection(model.portMapping, model.warnings)}
        ${renderPowerSection(model.sections.power)}
        ${renderDetailSection('Build Notes', model.sections.buildNotes)}
        ${renderWarningsSection(model.warnings)}

        <footer class="build-sheet-footer">
            <p><strong>Generated by Okami Designs LED Wall Calculator</strong></p>
            <p>${escapeHtml(model.websiteUrl)}</p>
            <p>Verify final processor, power, and rigging requirements with manufacturer specifications before deployment.</p>
        </footer>
    </div>
</body>
</html>`;
    }

    function openPrintView(inputs, state, options = {}) {
        const model = buildBuildSheetModel(inputs, state, options);
        const html = buildBuildSheetHtml(model);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const printWindow = window.open(blobUrl, '_blank');

        if (!printWindow) {
            URL.revokeObjectURL(blobUrl);
            throw new Error('Pop-up blocked. Allow pop-ups for this site to export the build sheet.');
        }

        const revokeUrl = () => URL.revokeObjectURL(blobUrl);
        printWindow.addEventListener('load', revokeUrl, { once: true });
        printWindow.addEventListener('unload', revokeUrl, { once: true });
        printWindow.focus();

        return model;
    }

    const api = {
        buildBuildSheetModel,
        buildBuildSheetHtml,
        buildWallDiagramSvg,
        calculatePortMapping,
        openPrintView
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    global.OkamiLedWallCalculator = global.OkamiLedWallCalculator || {};
    global.OkamiLedWallCalculator.BuildSheetExport = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {});
