(function(global) {
    'use strict';

    const C = global.OkamiLedWallCalculator.Constants;

    function clampPanelCount(value) {
        if (!Number.isFinite(value)) {
            return C.MIN_PANEL_COUNT;
        }
        return Math.min(C.MAX_PANEL_COUNT, Math.max(C.MIN_PANEL_COUNT, Math.round(value)));
    }

    function clampPortFillThreshold(value, fallback = C.DEFAULTS.portFillThreshold) {
        if (!Number.isFinite(value)) {
            return fallback;
        }
        return Math.min(100, Math.max(50, Math.round(value)));
    }

    function clampCircuitSafeLoadPercent(value, fallback = C.DEFAULTS.circuitSafeLoadPercent) {
        if (!Number.isFinite(value)) {
            return fallback;
        }
        // Cap at 80% so circuit plans always retain at least 20% headroom.
        return Math.min(80, Math.max(1, Math.round(value)));
    }

    function isMmCabinetPreset(presetKey) {
        return presetKey === '500x500' || presetKey === '500x1000';
    }

    function resolveCabinetDimensions(inputs = {}) {
        const presetKey = inputs.cabinetPreset;
        const preset = isMmCabinetPreset(presetKey) ? C.CABINET_PRESETS[presetKey] : null;

        if (preset) {
            return {
                cabinetWidthMM: preset.width,
                cabinetHeightMM: preset.height
            };
        }

        return {
            cabinetWidthMM: Number(inputs.cabinetWidthMM) || C.DEFAULTS.cabinetWidthMM,
            cabinetHeightMM: Number(inputs.cabinetHeightMM) || C.DEFAULTS.cabinetHeightMM
        };
    }

    /**
     * Custom LED Spacing mode (includes legacy saved value "transparent").
     */
    function isCustomSpacingDisplayType(displayType) {
        const type = displayType || C.DEFAULTS.displayType;
        return type === C.DISPLAY_TYPE_CUSTOM_SPACING || type === C.DISPLAY_TYPE_TRANSPARENT_LEGACY;
    }

    /**
     * Per-cabinet pixel resolution from pitch, preset tables, or custom LED spacing.
     * Pure function — no DOM.
     */
    function calculateCabinetResolution(inputs = {}) {
        const displayType = inputs.displayType || C.DEFAULTS.displayType;
        const cabinetWidthMM = Number(inputs.cabinetWidthMM) || C.DEFAULTS.cabinetWidthMM;
        const cabinetHeightMM = Number(inputs.cabinetHeightMM) || C.DEFAULTS.cabinetHeightMM;
        const pixelPitchMM = Number(inputs.pixelPitchMM) || C.DEFAULTS.pixelPitchMM;
        const cabinetPreset = inputs.cabinetPreset || 'custom';
        const pitchPreset = inputs.pitchPreset || 'custom';

        if (isCustomSpacingDisplayType(displayType)) {
            const horizontalPitch = Number(inputs.meshPitchHorizontalMM) || C.DEFAULTS.meshPitchHorizontalMM;
            const verticalPitch = Number(inputs.meshPitchVerticalMM) || C.DEFAULTS.meshPitchVerticalMM;
            return {
                pixelWidth: Math.round(cabinetWidthMM / horizontalPitch),
                pixelHeight: Math.round(cabinetHeightMM / verticalPitch)
            };
        }

        if (isMmCabinetPreset(cabinetPreset) && pitchPreset !== 'custom') {
            const pitch = parseFloat(pitchPreset);
            const presetResolution = C.RESOLUTION_PRESETS[cabinetPreset]?.[pitch];
            if (presetResolution) {
                return {
                    pixelWidth: presetResolution.pixelWidth,
                    pixelHeight: presetResolution.pixelHeight
                };
            }
        }

        return {
            pixelWidth: Math.round(cabinetWidthMM / pixelPitchMM),
            pixelHeight: Math.round(cabinetHeightMM / pixelPitchMM)
        };
    }

    /**
     * Total wall pixel resolution from cabinet pixels and grid size.
     */
    function calculateWallResolution(inputs = {}) {
        const pixelWidth = Math.max(1, Math.round(Number(inputs.pixelWidth) || C.DEFAULTS.pixelWidth));
        const pixelHeight = Math.max(1, Math.round(Number(inputs.pixelHeight) || C.DEFAULTS.pixelHeight));
        const panelsWide = clampPanelCount(Number(inputs.panelsWide) || C.DEFAULTS.panelsWide);
        const panelsTall = clampPanelCount(Number(inputs.panelsTall) || C.DEFAULTS.panelsTall);

        const totalPixelWidth = pixelWidth * panelsWide;
        const totalPixelHeight = pixelHeight * panelsTall;
        const totalPixels = totalPixelWidth * totalPixelHeight;

        return {
            pixelWidth,
            pixelHeight,
            panelsWide,
            panelsTall,
            totalPanels: panelsWide * panelsTall,
            totalPixelWidth,
            totalPixelHeight,
            totalPixels
        };
    }

    /**
     * Physical wall size in mm and feet.
     */
    function calculatePhysicalSize(inputs = {}) {
        const cabinetWidthMM = Number(inputs.cabinetWidthMM) || C.DEFAULTS.cabinetWidthMM;
        const cabinetHeightMM = Number(inputs.cabinetHeightMM) || C.DEFAULTS.cabinetHeightMM;
        const panelsWide = clampPanelCount(Number(inputs.panelsWide) || C.DEFAULTS.panelsWide);
        const panelsTall = clampPanelCount(Number(inputs.panelsTall) || C.DEFAULTS.panelsTall);
        const mmPerFoot = Number(inputs.mmPerFoot) || C.MM_PER_FOOT;

        const physicalWidthMM = cabinetWidthMM * panelsWide;
        const physicalHeightMM = cabinetHeightMM * panelsTall;
        const physicalWidthFt = physicalWidthMM / mmPerFoot;
        const physicalHeightFt = physicalHeightMM / mmPerFoot;
        const aspectRatio = physicalWidthMM / physicalHeightMM;

        return {
            physicalWidthMM,
            physicalHeightMM,
            physicalWidthFt,
            physicalHeightFt,
            aspectRatio
        };
    }

    /**
     * Pixel aspect ratio and nearest standard format label.
     */
    function calculateAspectRatio(inputs = {}, standardRatios = C.STANDARD_RATIOS) {
        const width = Number(inputs.width ?? inputs.totalPixelWidth);
        const height = Number(inputs.height ?? inputs.totalPixelHeight);

        if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
            return {
                ratio: 0,
                closestRatio: standardRatios[0]
            };
        }

        const ratio = width / height;
        let closestRatio = standardRatios[0];
        let smallestDiff = Math.abs(ratio - closestRatio.value);

        standardRatios.forEach((entry) => {
            const diff = Math.abs(ratio - entry.value);
            if (diff < smallestDiff) {
                smallestDiff = diff;
                closestRatio = entry;
            }
        });

        return { ratio, closestRatio };
    }

    function resolveOverlayTargetRatio(inputs = {}) {
        const overlayFormat = inputs.overlayFormat ?? 'none';

        if (overlayFormat === 'none') {
            return null;
        }

        if (overlayFormat === 'custom') {
            const width = Math.round(Number(inputs.customFormatWidth) || 0);
            const height = Math.round(Number(inputs.customFormatHeight) || 0);
            if (width <= 0 || height <= 0) {
                return null;
            }
            return {
                format: overlayFormat,
                label: `${width}:${height}`,
                ratio: width / height
            };
        }

        const ratio = C.OVERLAY_FORMAT_RATIOS[overlayFormat];
        if (ratio == null) {
            return null;
        }

        return {
            format: overlayFormat,
            label: overlayFormat,
            ratio
        };
    }

    function isOverlayActive(inputs = {}) {
        return resolveOverlayTargetRatio(inputs) !== null;
    }

    /**
     * Largest centered content rectangle matching target aspect inside the wall.
     */
    function calculateContentOverlay(inputs = {}) {
        const totalPixelWidth = Math.round(Number(inputs.totalPixelWidth) || 0);
        const totalPixelHeight = Math.round(Number(inputs.totalPixelHeight) || 0);
        const targetRatio = Number(inputs.targetRatio);

        if (
            totalPixelWidth <= 0
            || totalPixelHeight <= 0
            || !Number.isFinite(targetRatio)
            || targetRatio <= 0
        ) {
            return null;
        }

        const wallRatio = totalPixelWidth / totalPixelHeight;
        let overlayPixelWidth;
        let overlayPixelHeight;

        if (wallRatio > targetRatio) {
            overlayPixelHeight = totalPixelHeight;
            overlayPixelWidth = Math.round(overlayPixelHeight * targetRatio);
        } else {
            overlayPixelWidth = totalPixelWidth;
            overlayPixelHeight = Math.round(overlayPixelWidth / targetRatio);
        }

        overlayPixelWidth = Math.min(overlayPixelWidth, totalPixelWidth);
        overlayPixelHeight = Math.min(overlayPixelHeight, totalPixelHeight);

        const unusedHorizontal = totalPixelWidth - overlayPixelWidth;
        const unusedVertical = totalPixelHeight - overlayPixelHeight;
        const overlayLeftPx = unusedHorizontal / 2;
        const overlayTopPx = unusedVertical / 2;
        const usedPercentage = ((overlayPixelWidth * overlayPixelHeight) / (totalPixelWidth * totalPixelHeight)) * 100;
        const overlayAspectRatio = overlayPixelWidth / overlayPixelHeight;

        const leftPercent = (overlayLeftPx / totalPixelWidth) * 100;
        const topPercent = (overlayTopPx / totalPixelHeight) * 100;
        const widthPercent = (overlayPixelWidth / totalPixelWidth) * 100;
        const heightPercent = (overlayPixelHeight / totalPixelHeight) * 100;

        return {
            overlayPixelWidth,
            overlayPixelHeight,
            overlayAspectRatio,
            unusedHorizontal,
            unusedVertical,
            overlayLeftPx,
            overlayTopPx,
            usedPercentage,
            leftPercent,
            topPercent,
            widthPercent,
            heightPercent
        };
    }

    /**
     * Usable pixel budget per processor port after fill threshold.
     */
    function calculatePortFill(inputs = {}) {
        const portCapacity = Math.max(0, Math.round(Number(inputs.portCapacity) || C.DEFAULTS.portCapacity));
        const portFillThreshold = clampPortFillThreshold(inputs.portFillThreshold);
        const usablePixelsPerPort = Math.floor(portCapacity * (portFillThreshold / 100));

        return {
            portCapacity,
            portFillThreshold,
            usablePixelsPerPort
        };
    }

    /**
     * Processor ports required for total pixel load.
     */
    function calculateProcessorPorts(inputs = {}) {
        const totalPixels = Math.max(0, Math.round(Number(inputs.totalPixels) || 0));
        const portFill = inputs.usablePixelsPerPort != null
            ? {
                portCapacity: inputs.portCapacity ?? C.DEFAULTS.portCapacity,
                portFillThreshold: inputs.portFillThreshold ?? C.DEFAULTS.portFillThreshold,
                usablePixelsPerPort: Math.max(0, Math.floor(Number(inputs.usablePixelsPerPort)))
            }
            : calculatePortFill(inputs);

        const portsRequired = portFill.usablePixelsPerPort > 0
            ? Math.ceil(totalPixels / portFill.usablePixelsPerPort)
            : 0;

        return {
            ...portFill,
            totalPixels,
            portsRequired
        };
    }

    /**
     * Aggregate port fill and processor capacity usage for UI and exports.
     */
    function summarizePortLoading(state = {}) {
        const portsRequired = Math.max(0, Math.round(Number(state.portsRequired) || 0));
        const usablePixelsPerPort = Math.max(0, Math.floor(Number(state.usablePixelsPerPort) || 0));
        const totalPixels = Math.max(0, Math.round(Number(state.totalPixels) || 0));
        const portCapacity = Math.max(0, Math.round(Number(state.portCapacity) || 0));

        if (!portsRequired || !usablePixelsPerPort || !totalPixels) {
            return {
                avgPortUtilizationPercent: null,
                peakPortUtilizationPercent: null,
                processorLoadingPercent: null
            };
        }

        let assignedPixels = 0;
        let peakFill = 0;
        let peakPortPixels = 0;
        let fillSum = 0;

        for (let portNum = 1; portNum <= portsRequired; portNum += 1) {
            const remaining = totalPixels - assignedPixels;
            const portPixels = portNum === portsRequired
                ? remaining
                : Math.min(usablePixelsPerPort, remaining);
            const fillPercent = (portPixels / usablePixelsPerPort) * 100;
            peakFill = Math.max(peakFill, fillPercent);
            peakPortPixels = Math.max(peakPortPixels, portPixels);
            fillSum += fillPercent;
            assignedPixels += portPixels;
        }

        const peakSafeCapacityUsedPercent = peakFill;
        const peakRawMaxLoadPercent = portCapacity > 0
            ? (peakPortPixels / portCapacity) * 100
            : null;
        const processorPortHeadroomPercent = peakRawMaxLoadPercent != null
            ? Math.max(0, 100 - peakRawMaxLoadPercent)
            : null;
        const processorLoadingPercent = portCapacity > 0
            ? (totalPixels / (portsRequired * portCapacity)) * 100
            : null;
        const atSafePortLimit = peakSafeCapacityUsedPercent >= 99.5;

        return {
            avgPortUtilizationPercent: fillSum / portsRequired,
            peakPortUtilizationPercent: peakFill,
            peakSafeCapacityUsedPercent,
            peakRawMaxLoadPercent,
            processorPortHeadroomPercent,
            processorLoadingPercent,
            atSafePortLimit
        };
    }

    /**
     * Which preview artwork matches cabinet dimensions (square, tall, or custom).
     */
    function calculateCabinetArtworkType(inputs = {}) {
        const width = Number(inputs.cabinetWidthMM) || C.DEFAULTS.cabinetWidthMM;
        const height = Number(inputs.cabinetHeightMM) || C.DEFAULTS.cabinetHeightMM;

        if (width === height) {
            return 'square';
        }

        if (height === width * 2) {
            return 'tall';
        }

        return null;
    }

    /**
     * Estimated power draw and circuit count from panel count and circuit settings.
     */
    function calculatePowerRequirements(inputs = {}) {
        const wattsPerPanel = Math.max(0, Number(inputs.wattsPerPanel) || C.DEFAULTS.wattsPerPanel);
        const circuitAmperage = Math.max(0, Number(inputs.circuitAmperage) || C.DEFAULTS.circuitAmperage);
        const circuitVoltage = Math.max(0, Number(inputs.circuitVoltage) || C.DEFAULTS.circuitVoltage);
        const circuitSafeLoadPercent = clampCircuitSafeLoadPercent(inputs.circuitSafeLoadPercent);
        const totalPanels = Math.max(0, Math.round(Number(inputs.totalPanels) || 0));

        const totalEstimatedWatts = totalPanels * wattsPerPanel;
        const totalEstimatedAmps = circuitVoltage > 0 ? totalEstimatedWatts / circuitVoltage : 0;
        const rawWattsPerCircuit = circuitVoltage * circuitAmperage;
        const usableWattsPerCircuit = rawWattsPerCircuit * (circuitSafeLoadPercent / 100);
        const circuitHeadroomPercent = 100 - circuitSafeLoadPercent;
        const circuitsRequired = usableWattsPerCircuit > 0
            ? Math.ceil(totalEstimatedWatts / usableWattsPerCircuit)
            : 0;

        return {
            wattsPerPanel,
            circuitAmperage,
            circuitVoltage,
            circuitSafeLoadPercent,
            circuitHeadroomPercent,
            rawWattsPerCircuit,
            totalEstimatedWatts,
            totalEstimatedAmps,
            usableWattsPerCircuit,
            circuitsRequired
        };
    }

    /**
     * Per-cabinet bend angle when curved wall mode is enabled.
     */
    function resolveCabinetAngleDegrees(rawInputs = {}) {
        const curvedWallMode = rawInputs.curvedWallMode === true
            || rawInputs.curvedWallMode === 'true';
        if (!curvedWallMode) {
            return 0;
        }

        const preset = String(rawInputs.cabinetAnglePreset ?? '0');
        if (preset === 'custom') {
            const custom = Number(rawInputs.customCabinetAngleDegrees);
            return Number.isFinite(custom) && custom >= 0 ? custom : 0;
        }

        const angle = parseFloat(preset);
        return Number.isFinite(angle) && angle >= 0 ? angle : 0;
    }

    /**
     * Arc width, chord width, depth, and total curve angle for angled cabinets.
     * Does not affect pixel resolution or processor math.
     * Surface width = cabinet width × cabinets wide (arc length).
     */
    function calculateCurvedWallPhysical(inputs = {}) {
        const mmPerFoot = Number(inputs.mmPerFoot) || C.MM_PER_FOOT;
        const cabinetWidthMM = Number(inputs.cabinetWidthMM) || C.DEFAULTS.cabinetWidthMM;
        const panelsWide = clampPanelCount(Number(inputs.panelsWide) || C.DEFAULTS.panelsWide);
        const curvedWallMode = inputs.curvedWallMode === true
            || inputs.curvedWallMode === 'true';
        const cabinetAngleDegrees = Math.max(0, resolveCabinetAngleDegrees(inputs));

        const surfaceWidthFeet = (cabinetWidthMM / mmPerFoot) * panelsWide;
        const surfaceWidthMM = cabinetWidthMM * panelsWide;

        const flatResult = {
            curvedWallMode,
            curvedWallActive: false,
            cabinetAngleDegrees: 0,
            surfaceWidthFeet,
            surfaceWidthMM,
            arcWidthFeet: surfaceWidthFeet,
            chordWidthFeet: surfaceWidthFeet,
            chordWidthMM: surfaceWidthMM,
            curveDepthFeet: 0,
            curveDepthMM: 0,
            depthFeet: 0,
            totalCurveAngle: 0,
            totalCurveAngleRadians: 0,
            radiusFeet: null,
            radiusMM: null,
            curvedWallAngleExceeded: false,
            curvedWallValidationMessage: null
        };

        if (!curvedWallMode || cabinetAngleDegrees === 0 || panelsWide <= 1) {
            return flatResult;
        }

        const totalCurveAngle = (panelsWide - 1) * cabinetAngleDegrees;
        if (totalCurveAngle > C.MAX_TOTAL_CURVE_ANGLE) {
            return {
                ...flatResult,
                cabinetAngleDegrees,
                totalCurveAngle,
                curvedWallAngleExceeded: true,
                curvedWallValidationMessage: `Total curve angle (${totalCurveAngle.toFixed(1)}°) exceeds 180°. Reduce cabinet angle or panel count.`
            };
        }

        if (totalCurveAngle === 0) {
            return flatResult;
        }

        const totalCurveAngleRadians = totalCurveAngle * Math.PI / 180;
        const radiusFeet = surfaceWidthFeet / totalCurveAngleRadians;
        const chordWidthFeet = 2 * radiusFeet * Math.sin(totalCurveAngleRadians / 2);
        const curveDepthFeet = radiusFeet * (1 - Math.cos(totalCurveAngleRadians / 2));

        return {
            curvedWallMode,
            curvedWallActive: true,
            cabinetAngleDegrees,
            surfaceWidthFeet,
            surfaceWidthMM,
            arcWidthFeet: surfaceWidthFeet,
            chordWidthFeet,
            chordWidthMM: chordWidthFeet * mmPerFoot,
            curveDepthFeet,
            curveDepthMM: curveDepthFeet * mmPerFoot,
            depthFeet: curveDepthFeet,
            totalCurveAngle,
            totalCurveAngleRadians,
            radiusFeet,
            radiusMM: radiusFeet * mmPerFoot,
            curvedWallAngleExceeded: false,
            curvedWallValidationMessage: null
        };
    }

    /**
     * Top-down arc geometry for the curved wall diagram (preview + PDF).
     * Coordinates in feet: chord on y=0, arc bulges toward +y (stage depth).
     */
    function computeTopViewCurveDiagram(state) {
        const panelsWide = clampPanelCount(Number(state.panelsWide) || C.DEFAULTS.panelsWide);
        const surfaceWidthFeet = Number(state.surfaceWidthFeet) || Number(state.physicalWidthFt) || 0;
        const chordWidthFeet = Number(state.chordWidthFeet) || surfaceWidthFeet;
        const curveDepthFeet = Number(state.curveDepthFeet) || 0;
        const radiusFeet = Number(state.radiusFeet) || 0;
        const totalRad = Number(state.totalCurveAngleRadians) || 0;
        const totalCurveAngle = Number(state.totalCurveAngle) || 0;
        const flat = !state.curvedWallActive || panelsWide <= 1 || totalRad <= 0 || radiusFeet <= 0;

        if (flat) {
            const half = surfaceWidthFeet / 2;
            return {
                flat: true,
                panelsWide,
                surfaceWidthFeet,
                chordWidthFeet: surfaceWidthFeet,
                curveDepthFeet: 0,
                radiusFeet: null,
                totalCurveAngle: 0,
                arcSegments: [{ x1: -half, y1: 0, x2: half, y2: 0 }],
                chordLine: { x1: -half, y1: 0, x2: half, y2: 0 },
                depthLine: null,
                radiusLine: null,
                circleCenter: null,
                apex: { x: 0, y: 0 }
            };
        }

        const halfTheta = totalRad / 2;
        const cosHalf = Math.cos(halfTheta);

        function pointAt(phi) {
            return {
                x: radiusFeet * Math.sin(phi),
                y: radiusFeet * Math.cos(phi) - radiusFeet * cosHalf
            };
        }

        const segAngle = totalRad / panelsWide;
        const arcSegments = [];
        for (let i = 0; i < panelsWide; i += 1) {
            const phi0 = -halfTheta + i * segAngle;
            const phi1 = phi0 + segAngle;
            const p0 = pointAt(phi0);
            const p1 = pointAt(phi1);
            arcSegments.push({ x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y });
        }

        const leftEnd = pointAt(-halfTheta);
        const rightEnd = pointAt(halfTheta);
        const apex = pointAt(0);
        const circleCenter = { x: 0, y: apex.y - radiusFeet };

        return {
            flat: false,
            panelsWide,
            surfaceWidthFeet,
            chordWidthFeet,
            curveDepthFeet,
            radiusFeet,
            totalCurveAngle,
            totalCurveAngleRadians: totalRad,
            arcSegments,
            chordLine: { x1: leftEnd.x, y1: 0, x2: rightEnd.x, y2: 0 },
            depthLine: { x1: rightEnd.x, y1: 0, x2: apex.x, y2: apex.y },
            radiusLines: [
                { x1: circleCenter.x, y1: circleCenter.y, x2: leftEnd.x, y2: leftEnd.y },
                { x1: circleCenter.x, y1: circleCenter.y, x2: rightEnd.x, y2: rightEnd.y }
            ],
            radiusLine: { x1: circleCenter.x, y1: circleCenter.y, x2: apex.x, y2: apex.y },
            circleCenter,
            leftEnd,
            rightEnd,
            apex
        };
    }

    /**
     * View box + padding for rendering top view diagram into SVG or PDF.
     */
    function computeTopViewCurveViewBox(diagram, paddingRatio = 0.1) {
        if (!diagram) {
            return null;
        }

        const points = [];
        diagram.arcSegments.forEach((seg) => {
            points.push({ x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 });
        });
        if (diagram.leftEnd) {
            points.push(diagram.leftEnd);
        }
        if (diagram.rightEnd) {
            points.push(diagram.rightEnd);
        }
        if (diagram.apex) {
            points.push(diagram.apex);
        }
        if (diagram.depthLine) {
            points.push(
                { x: diagram.depthLine.x1, y: diagram.depthLine.y1 },
                { x: diagram.depthLine.x2, y: diagram.depthLine.y2 }
            );
        }

        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        let minX = Math.min(...xs);
        let maxX = Math.max(...xs);
        let minY = Math.min(...ys);
        let maxY = Math.max(...ys);

        let flatBand = 0;
        if (diagram.flat) {
            const span = Math.max(maxX - minX, 1);
            flatBand = span * 0.12;
            minY = -flatBand;
            maxY = flatBand;
        }

        const spanX = Math.max(maxX - minX, 1);
        const spanY = Math.max(maxY - minY, flatBand * 2 || 1);
        const padX = spanX * paddingRatio;
        const padY = diagram.flat ? flatBand * 0.35 : spanY * paddingRatio;

        minX -= padX;
        maxX += padX * 1.1;
        if (diagram.flat) {
            minY -= padY;
            maxY += padY;
        } else {
            minY -= padY * 0.65;
            maxY += padY * 1.2;
        }

        return {
            minX,
            minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    function topViewYToSvg(y, viewBox) {
        return viewBox.minY * 2 + viewBox.height - y;
    }

    function escapeSvgText(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function svgText(x, y, lines, anchor = 'middle', size = 0.55) {
        if (!lines || !lines.length) {
            return '';
        }
        const tspans = lines.map((line, index) => (
            `<tspan x="${x}" dy="${index === 0 ? 0 : size * 1.15}">${escapeSvgText(line)}</tspan>`
        )).join('');
        return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="led-top-view-label" font-size="${size}">${tspans}</text>`;
    }

    /**
     * SVG markup for top view curve diagram (shared by UI + PDF conversion path).
     */
    function buildTopViewCurveSvg(diagram, viewBox, labels = null) {
        if (!diagram || !viewBox) {
            return '';
        }

        const ySvg = (y) => topViewYToSvg(y, viewBox);
        const vb = `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`;
        const annotated = labels && typeof labels === 'object';

        const segments = diagram.arcSegments.map((seg) => (
            `<line x1="${seg.x1}" y1="${ySvg(seg.y1)}" x2="${seg.x2}" y2="${ySvg(seg.y2)}" class="led-top-view-segment" vector-effect="non-scaling-stroke"/>`
        )).join('');

        const chord = diagram.chordLine
            ? `<line x1="${diagram.chordLine.x1}" y1="${ySvg(diagram.chordLine.y1)}" x2="${diagram.chordLine.x2}" y2="${ySvg(diagram.chordLine.y2)}" class="led-top-view-chord" vector-effect="non-scaling-stroke"/>`
            : '';

        const radiusLines = (diagram.radiusLines || (diagram.radiusLine ? [diagram.radiusLine] : []))
            .map((line) => (
                `<line x1="${line.x1}" y1="${ySvg(line.y1)}" x2="${line.x2}" y2="${ySvg(line.y2)}" class="led-top-view-radius" vector-effect="non-scaling-stroke"/>`
            )).join('');

        const depth = diagram.depthLine
            ? `<line x1="${diagram.depthLine.x1}" y1="${ySvg(diagram.depthLine.y1)}" x2="${diagram.depthLine.x2}" y2="${ySvg(diagram.depthLine.y2)}" class="led-top-view-depth" vector-effect="non-scaling-stroke"/>`
            : '';

        let angleMarkup = '';
        if (annotated && diagram.circleCenter && diagram.leftEnd && diagram.rightEnd && diagram.totalCurveAngleRadians) {
            const center = diagram.circleCenter;
            const arcR = Math.max(diagram.radiusFeet * 0.12, 0.35);
            const startX = center.x + arcR * Math.sin(-diagram.totalCurveAngleRadians / 2);
            const startY = center.y + arcR * Math.cos(-diagram.totalCurveAngleRadians / 2);
            const endX = center.x + arcR * Math.sin(diagram.totalCurveAngleRadians / 2);
            const endY = center.y + arcR * Math.cos(diagram.totalCurveAngleRadians / 2);
            const largeArc = diagram.totalCurveAngleRadians > Math.PI ? 1 : 0;
            angleMarkup = `<path d="M ${startX} ${ySvg(startY)} A ${arcR} ${arcR} 0 ${largeArc} 1 ${endX} ${ySvg(endY)}" class="led-top-view-angle-arc" vector-effect="non-scaling-stroke" fill="none"/>`;
        }

        let labelMarkup = '';
        if (annotated && !diagram.flat) {
            const span = Math.max(diagram.chordWidthFeet, diagram.surfaceWidthFeet, 1);
            const labelOffset = span * 0.045;
            const labelSize = Math.max(0.7, Math.min(viewBox.width * 0.042, 1.05));
            const apex = diagram.apex || { x: 0, y: diagram.curveDepthFeet };
            const chordMidX = diagram.chordLine ? (diagram.chordLine.x1 + diagram.chordLine.x2) / 2 : 0;
            const depthMidX = diagram.depthLine
                ? (diagram.depthLine.x1 + diagram.depthLine.x2) / 2
                : apex.x;
            const depthMidY = diagram.depthLine
                ? (diagram.depthLine.y1 + diagram.depthLine.y2) / 2
                : apex.y / 2;
            const center = diagram.circleCenter || { x: 0, y: 0 };
            const leftEnd = diagram.leftEnd || { x: 0, y: 0 };
            const radiusLabelX = center.x + (leftEnd.x - center.x) * 0.72;
            const radiusLabelY = center.y + (leftEnd.y - center.y) * 0.72;

            labelMarkup = [
                svgText(apex.x, ySvg(apex.y + labelOffset * 1.1), labels.arcLength, 'middle', labelSize),
                svgText(chordMidX, ySvg(-labelOffset * 0.85), labels.chordWidth, 'middle', labelSize),
                svgText(depthMidX + labelOffset, ySvg(depthMidY), labels.depth, 'start', labelSize),
                svgText(radiusLabelX, ySvg(radiusLabelY), labels.radius, 'middle', labelSize),
                svgText(chordMidX, ySvg(-labelOffset * 2.1), labels.angle, 'middle', labelSize)
            ].join('');
        }

        return `<svg class="led-top-view-svg" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" overflow="hidden" role="img" aria-label="Top view curve diagram">${radiusLines}${angleMarkup}${segments}${chord}${depth}${labelMarkup}</svg>`;
    }

    /**
     * Maximum per-cabinet angle before total curve exceeds 180°.
     */
    function maxCabinetAngleForPanels(panelsWide) {
        const wide = clampPanelCount(Number(panelsWide) || C.DEFAULTS.panelsWide);
        if (wide <= 1) {
            return 0;
        }
        return C.MAX_TOTAL_CURVE_ANGLE / (wide - 1);
    }

    /**
     * Resolve cabinet pixels (auto or manual) then compute full wall metrics.
     * Input object is serializable — suitable for save/load and export later.
     */
    function computeWallProject(rawInputs = {}) {
        const autoCalculate = rawInputs.autoCalculateResolution !== false
            && rawInputs.autoCalculateResolution !== 'false';

        const cabinetDimensions = resolveCabinetDimensions(rawInputs);
        const resolvedInputs = {
            ...rawInputs,
            ...cabinetDimensions
        };

        let pixelWidth = Number(resolvedInputs.pixelWidth) || C.DEFAULTS.pixelWidth;
        let pixelHeight = Number(resolvedInputs.pixelHeight) || C.DEFAULTS.pixelHeight;

        if (autoCalculate) {
            const cabinetPixels = calculateCabinetResolution(resolvedInputs);
            pixelWidth = cabinetPixels.pixelWidth;
            pixelHeight = cabinetPixels.pixelHeight;
        }

        const wall = calculateWallResolution({
            pixelWidth,
            pixelHeight,
            panelsWide: resolvedInputs.panelsWide,
            panelsTall: resolvedInputs.panelsTall
        });

        const physical = calculatePhysicalSize({
            cabinetWidthMM: cabinetDimensions.cabinetWidthMM,
            cabinetHeightMM: cabinetDimensions.cabinetHeightMM,
            panelsWide: wall.panelsWide,
            panelsTall: wall.panelsTall,
            mmPerFoot: resolvedInputs.mmPerFoot
        });

        const aspect = calculateAspectRatio({
            totalPixelWidth: wall.totalPixelWidth,
            totalPixelHeight: wall.totalPixelHeight
        });

        const processor = calculateProcessorPorts({
            totalPixels: wall.totalPixels,
            portCapacity: resolvedInputs.portCapacity,
            portFillThreshold: resolvedInputs.portFillThreshold
        });

        const portLoading = summarizePortLoading({
            ...processor,
            totalPixels: wall.totalPixels
        });

        const overlayTarget = resolveOverlayTargetRatio(resolvedInputs);
        const overlay = overlayTarget
            ? calculateContentOverlay({
                totalPixelWidth: wall.totalPixelWidth,
                totalPixelHeight: wall.totalPixelHeight,
                targetRatio: overlayTarget.ratio
            })
            : null;

        const power = calculatePowerRequirements({
            totalPanels: wall.totalPanels,
            wattsPerPanel: resolvedInputs.wattsPerPanel,
            circuitAmperage: resolvedInputs.circuitAmperage,
            circuitVoltage: resolvedInputs.circuitVoltage,
            circuitSafeLoadPercent: resolvedInputs.circuitSafeLoadPercent
        });

        const curvedWall = calculateCurvedWallPhysical({
            curvedWallMode: resolvedInputs.curvedWallMode,
            cabinetAnglePreset: resolvedInputs.cabinetAnglePreset,
            customCabinetAngleDegrees: resolvedInputs.customCabinetAngleDegrees,
            cabinetWidthMM: cabinetDimensions.cabinetWidthMM,
            panelsWide: wall.panelsWide,
            mmPerFoot: resolvedInputs.mmPerFoot
        });

        return {
            ...wall,
            ...physical,
            ...curvedWall,
            aspectRatio: aspect.ratio,
            closestRatio: aspect.closestRatio,
            ...processor,
            ...portLoading,
            ...power,
            overlayFormat: resolvedInputs.overlayFormat ?? 'none',
            overlayFormatLabel: overlayTarget ? overlayTarget.label : null,
            overlayActive: overlayTarget !== null,
            overlay,
            cabinetArtworkType: calculateCabinetArtworkType(cabinetDimensions),
            displayType: resolvedInputs.displayType || C.DEFAULTS.displayType,
            cabinetWidthMM: cabinetDimensions.cabinetWidthMM,
            cabinetHeightMM: cabinetDimensions.cabinetHeightMM,
            pixelPitchMM: Number(resolvedInputs.pixelPitchMM) || C.DEFAULTS.pixelPitchMM
        };
    }

    global.OkamiLedWallCalculator = global.OkamiLedWallCalculator || {};
    Object.assign(global.OkamiLedWallCalculator, {
        clampPanelCount,
        clampPortFillThreshold,
        clampCircuitSafeLoadPercent,
        isCustomSpacingDisplayType,
        resolveCabinetDimensions,
        calculateCabinetResolution,
        calculateWallResolution,
        calculatePhysicalSize,
        calculateAspectRatio,
        resolveOverlayTargetRatio,
        isOverlayActive,
        calculateContentOverlay,
        calculatePortFill,
        calculateProcessorPorts,
        summarizePortLoading,
        calculatePowerRequirements,
        calculateCabinetArtworkType,
        resolveCabinetAngleDegrees,
        calculateCurvedWallPhysical,
        computeTopViewCurveDiagram,
        computeTopViewCurveViewBox,
        buildTopViewCurveSvg,
        topViewYToSvg,
        maxCabinetAngleForPanels,
        computeWallProject
    });
})(typeof window !== 'undefined' ? window : globalThis);
