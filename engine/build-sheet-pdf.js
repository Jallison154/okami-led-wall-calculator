(function(global) {
    'use strict';

    const BuildSheet = () => global.OkamiLedWallCalculator?.BuildSheetExport;
    const Summary = () => global.OkamiLedWallCalculator?.WallProjectSummary;

    const COLORS = {
        orange: [255, 106, 45],
        text: [26, 26, 26],
        muted: [102, 102, 102],
        border: [210, 210, 210],
        cardBg: [252, 252, 252],
        wallFill: [240, 240, 240],
        wallStroke: [120, 120, 120],
        gridLine: [190, 190, 190],
        letterbox: [220, 220, 220],
        activeArea: [255, 248, 244]
    };

    const PAGE = {
        width: 215.9,
        height: 279.4,
        margin: 12,
        footerHeight: 16
    };

    function getJsPDF() {
        const lib = global.jspdf?.jsPDF || global.jsPDF;
        if (!lib) {
            throw new Error('PDF library not loaded. Refresh the page and try again.');
        }
        return lib;
    }

    function formatExportDate(date) {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function formatFilenameDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function hasValue(value) {
        return value !== null && value !== undefined && value !== '' && !Number.isNaN(value);
    }

    function formatNumber(value) {
        return Number(value).toLocaleString('en-US');
    }

    function formatFeetInches(feetDecimal) {
        return Summary()?.formatFeetInches?.(feetDecimal) ?? null;
    }

    function formatMetersCompact(mm) {
        return Summary()?.formatMetersCompact?.(mm) ?? null;
    }

    function setTextColor(doc, rgb) {
        doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    }

    function setDrawColor(doc, rgb) {
        doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
    }

    function setFillColor(doc, rgb) {
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    }

    function drawHorizontalRule(doc, y, x1, x2) {
        setDrawColor(doc, COLORS.border);
        doc.setLineWidth(0.25);
        doc.line(x1, y, x2, y);
    }

    function drawTitleRow(doc, model, y) {
        const rightX = PAGE.width - PAGE.margin;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        setTextColor(doc, COLORS.text);
        doc.text('LED Wall Build Sheet', PAGE.margin, y);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        setTextColor(doc, COLORS.muted);
        doc.text(formatExportDate(model.exportedAt), rightX, y, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        setTextColor(doc, COLORS.orange);
        doc.text('Okami Designs', rightX, y + 3.5, { align: 'right' });

        let nextY = y + 6;

        if (model.projectName) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            setTextColor(doc, COLORS.muted);
            doc.text(`Project: ${model.projectName}`, PAGE.margin, nextY);
            nextY += 4.5;
        }

        return nextY + 1;
    }

    function drawCenteredLines(doc, lines, x, y, width, options = {}) {
        const fontSize = options.fontSize ?? 7;
        const lineHeight = options.lineHeight ?? 3.4;
        const fontStyle = options.fontStyle ?? 'normal';
        const color = options.color ?? COLORS.muted;

        doc.setFont('helvetica', fontStyle);
        doc.setFontSize(fontSize);
        setTextColor(doc, color);

        let cursorY = y;
        lines.filter(Boolean).forEach((line) => {
            const wrapped = doc.splitTextToSize(String(line), width - 2);
            wrapped.forEach((textLine) => {
                doc.text(textLine, x + width / 2, cursorY, { align: 'center' });
                cursorY += lineHeight;
            });
        });

        return cursorY;
    }

    function drawKpiCard(doc, x, y, width, height, card) {
        setFillColor(doc, COLORS.cardBg);
        setDrawColor(doc, COLORS.border);
        doc.setLineWidth(0.25);
        doc.roundedRect(x, y, width, height, 1.5, 1.5, 'FD');

        setFillColor(doc, COLORS.orange);
        doc.rect(x, y, width, 1.4, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        setTextColor(doc, COLORS.muted);
        doc.text(card.title.toUpperCase(), x + width / 2, y + 5, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(card.primary.length > 14 ? 9 : 10.5);
        setTextColor(doc, COLORS.text);
        const primaryLines = doc.splitTextToSize(card.primary, width - 4);
        let textY = y + 11.5;
        primaryLines.forEach((line) => {
            doc.text(line, x + width / 2, textY, { align: 'center' });
            textY += 4.2;
        });

        if (card.secondary) {
            textY = drawCenteredLines(doc, [card.secondary], x, textY + 0.5, width, {
                fontSize: card.secondaryBold ? 7.5 : 7,
                fontStyle: card.secondaryBold ? 'bold' : 'normal',
                color: card.secondaryBold ? COLORS.text : COLORS.muted
            });
        }

        if (card.tertiary) {
            drawCenteredLines(doc, [card.tertiary], x, textY, width, {
                fontSize: 6.2,
                fontStyle: 'normal',
                color: COLORS.muted
            });
        }

        if (card.badge) {
            drawCenteredLines(doc, [card.badge], x, textY + (card.tertiary ? 3.2 : 0.5), width, {
                fontSize: 5.5,
                fontStyle: 'bold',
                color: COLORS.orange
            });
        }
    }

    function drawProjectSummary(doc, cards, y, options = {}) {
        const contentLeft = PAGE.margin;
        const contentWidth = PAGE.width - PAGE.margin * 2;
        const cardCount = options.cardCount ?? cards.length;
        const gap = 2;
        const cardWidth = (contentWidth - gap * (cardCount - 1)) / cardCount;
        const cardHeight = options.cardHeight ?? 27;
        const visibleCards = cards.slice(0, cardCount);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        setTextColor(doc, COLORS.text);
        doc.text('Project Summary', contentLeft, y);

        setDrawColor(doc, COLORS.orange);
        doc.setLineWidth(0.5);
        doc.line(contentLeft, y + 1.5, contentLeft + 34, y + 1.5);

        const cardsY = y + 5;
        visibleCards.forEach((card, index) => {
            const cardX = contentLeft + index * (cardWidth + gap);
            drawKpiCard(doc, cardX, cardsY, cardWidth, cardHeight, card);
        });

        return cardsY + cardHeight + 3;
    }

    function getPrintableBounds(doc) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = PAGE.margin;
        const contentWidth = pageWidth - margin * 2;

        return {
            pageWidth,
            pageHeight,
            margin,
            contentLeft: margin,
            contentWidth,
            centerX: pageWidth / 2
        };
    }

    function computeWallDiagramSize(state, usableWidth, maxHeight) {
        const wallAspect = state.physicalWidthMM / state.physicalHeightMM;
        let diagramW;
        let diagramH;

        if (wallAspect >= usableWidth / maxHeight) {
            diagramW = usableWidth;
            diagramH = usableWidth / wallAspect;
        } else {
            diagramH = maxHeight;
            diagramW = maxHeight * wallAspect;
        }

        return { diagramW, diagramH, wallAspect };
    }

    function isCurvedWallExportEnabled(state, inputs = {}) {
        return Summary()?.isCurvedWallModeEnabled?.(state, inputs) === true;
    }

    function drawTopViewCurveDiagram(doc, state, x0, y0, boxW, boxH) {
        const Calc = global.OkamiLedWallCalculator;
        const diagram = Calc?.computeTopViewCurveDiagram?.(state);
        const viewBox = Calc?.computeTopViewCurveViewBox?.(diagram);
        if (!diagram || !viewBox) {
            return y0;
        }

        const ySvg = (y) => Calc.topViewYToSvg?.(y, viewBox)
            ?? (viewBox.minY * 2 + viewBox.height - y);

        const mapX = (x) => x0 + ((x - viewBox.minX) / viewBox.width) * boxW;
        const mapY = (y) => y0 + ((ySvg(y) - viewBox.minY) / viewBox.height) * boxH;

        setDrawColor(doc, COLORS.orange);
        doc.setLineWidth(0.7);
        diagram.arcSegments.forEach((seg) => {
            doc.line(mapX(seg.x1), mapY(seg.y1), mapX(seg.x2), mapY(seg.y2));
        });

        if (diagram.chordLine) {
            setDrawColor(doc, COLORS.orange);
            doc.setLineWidth(0.35);
            doc.setLineDashPattern([1.4, 1], 0);
            doc.line(
                mapX(diagram.chordLine.x1),
                mapY(diagram.chordLine.y1),
                mapX(diagram.chordLine.x2),
                mapY(diagram.chordLine.y2)
            );
            doc.setLineDashPattern([], 0);
        }

        const radiusLines = diagram.radiusLines || (diagram.radiusLine ? [diagram.radiusLine] : []);
        radiusLines.forEach((line) => {
            setDrawColor(doc, COLORS.gridLine);
            doc.setLineWidth(0.2);
            doc.setLineDashPattern([1, 0.8], 0);
            doc.line(mapX(line.x1), mapY(line.y1), mapX(line.x2), mapY(line.y2));
            doc.setLineDashPattern([], 0);
        });

        if (diagram.depthLine) {
            setDrawColor(doc, COLORS.muted);
            doc.setLineWidth(0.25);
            doc.line(
                mapX(diagram.depthLine.x1),
                mapY(diagram.depthLine.y1),
                mapX(diagram.depthLine.x2),
                mapY(diagram.depthLine.y2)
            );
        }

        return y0 + boxH + 2;
    }

    function drawTopViewCurveSection(doc, state, inputs, startY, maxHeight) {
        if (!isCurvedWallExportEnabled(state, inputs) || state?.curvedWallAngleExceeded) {
            return startY;
        }

        const bounds = getPrintableBounds(doc);
        const { margin, contentWidth } = bounds;
        const sectionH = Math.min(maxHeight, 52);
        const tableW = contentWidth * 0.42;
        const diagramW = contentWidth - tableW - 6;
        const tableX = margin;
        const diagramX = margin + tableW + 6;
        const bodyY = startY + 5;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        setTextColor(doc, COLORS.orange);
        doc.text('CURVED WALL MEASUREMENTS', tableX, startY);
        doc.text('TOP VIEW CURVE (STAGE FRONT)', diagramX, startY);

        const rows = Summary()?.buildCurvedWallMeasurementRows?.(state) || [];
        let rowY = bodyY;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        rows.forEach((row) => {
            setTextColor(doc, COLORS.muted);
            doc.text(row.label, tableX, rowY);
            setTextColor(doc, COLORS.text);
            doc.text(String(row.value), tableX + tableW - 2, rowY, { align: 'right' });
            rowY += 3.6;
        });

        drawTopViewCurveDiagram(doc, state, diagramX, bodyY - 2, diagramW, sectionH - 4);

        return startY + sectionH + 2;
    }

    /**
     * Wall diagram centered on the full printable page width.
     */
    function drawWallVisual(doc, state, startY, maxHeight) {
        if (!state?.panelsWide || !state?.panelsTall) {
            return startY;
        }

        const bounds = getPrintableBounds(doc);
        const { margin, contentWidth, centerX } = bounds;
        const usableWidth = contentWidth;
        const { diagramW, diagramH } = computeWallDiagramSize(state, usableWidth, maxHeight);
        const wallX = margin + (usableWidth - diagramW) / 2;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        setTextColor(doc, COLORS.text);
        doc.text('Wall Visual', centerX, startY, { align: 'center' });

        setDrawColor(doc, COLORS.border);
        doc.setLineWidth(0.2);
        doc.line(margin, startY + 1.5, margin + usableWidth, startY + 1.5);

        const y0 = startY + 5;
        const x0 = wallX;
        const cellW = diagramW / state.panelsWide;
        const cellH = diagramH / state.panelsTall;

        setFillColor(doc, COLORS.wallFill);
        setDrawColor(doc, COLORS.wallStroke);
        doc.setLineWidth(0.35);
        doc.roundedRect(x0, y0, diagramW, diagramH, 1.2, 1.2, 'FD');

        setDrawColor(doc, COLORS.gridLine);
        doc.setLineWidth(0.12);
        for (let col = 1; col < state.panelsWide; col += 1) {
            const x = x0 + col * cellW;
            doc.line(x, y0, x, y0 + diagramH);
        }
        for (let row = 1; row < state.panelsTall; row += 1) {
            const y = y0 + row * cellH;
            doc.line(x0, y, x0 + diagramW, y);
        }

        if (state.overlay) {
            const { leftPercent, topPercent, widthPercent, heightPercent } = state.overlay;
            const overlayX = x0 + (leftPercent / 100) * diagramW;
            const overlayY = y0 + (topPercent / 100) * diagramH;
            const overlayW = (widthPercent / 100) * diagramW;
            const overlayH = (heightPercent / 100) * diagramH;
            const overlayCenterX = overlayX + overlayW / 2;
            const referenceLabel = Summary()?.getOverlayReferenceLabel?.(state.overlayFormatLabel, 'pdf')
                || `${state.overlayFormatLabel || '16:9'} reference area`;

            setDrawColor(doc, COLORS.orange);
            doc.setLineWidth(0.75);
            doc.setLineDashPattern([1.8, 1.2], 0);
            doc.rect(overlayX, overlayY, overlayW, overlayH);
            doc.setLineDashPattern([], 0);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            setTextColor(doc, COLORS.orange);
            doc.text(referenceLabel, overlayCenterX, overlayY - 1.5, { align: 'center' });
        }

        const widthFt = formatFeetInches(state.physicalWidthFt);
        const heightFt = formatFeetInches(state.physicalHeightFt);
        const widthM = formatMetersCompact(state.physicalWidthMM);
        const heightM = formatMetersCompact(state.physicalHeightMM);
        const captionY = y0 + diagramH + 5;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        setTextColor(doc, COLORS.text);
        doc.text(
            `${state.panelsWide} × ${state.panelsTall} cabinets · ${formatNumber(state.totalPanels)} panels`,
            centerX,
            captionY,
            { align: 'center' }
        );

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        setTextColor(doc, COLORS.muted);
        const referenceNote = state.overlay
            ? (Summary()?.getOverlayReferenceNote?.(state.overlayFormatLabel)
                || 'Overlay shows content fit only. Full LED wall remains active.')
            : null;
        const captionLines = [
            `${formatNumber(state.totalPixelWidth)} × ${formatNumber(state.totalPixelHeight)} px`,
            widthFt && heightFt && widthM && heightM ? `${widthFt} × ${heightFt} (${widthM} × ${heightM})` : null,
            referenceNote
        ].filter(Boolean);

        let lineY = captionY + 3.8;
        captionLines.forEach((line) => {
            doc.text(line, centerX, lineY, { align: 'center' });
            lineY += 3.4;
        });

        return lineY + 2;
    }

    function pickRows(rows, labels) {
        const map = new Map(rows.map((row) => [row.label, row]));
        return labels.map((label) => map.get(label)).filter(Boolean);
    }

    function buildCabinetDetailRows(model) {
        return pickRows(model.sections.overview, [
            'Wall grid (W × H)',
            'Total cabinets',
            'Cabinet size',
            'Pixel pitch / spacing',
            'Display mode',
            'Aspect ratio'
        ]);
    }

    function buildResolutionDetailRows(model) {
        return pickRows(model.sections.resolution, [
            'Total resolution',
            'Horizontal pixels',
            'Vertical pixels',
            'Pixels per cabinet'
        ]);
    }

    function buildProcessorDetailRows(model, state) {
        const picked = pickRows(model.sections.processor, [
            'Total ports required',
            'Safe capacity used (peak port)',
            'Safe fill threshold',
            'Actual max port load (peak)',
            'Safety headroom (peak)',
            'Usable pixels per port',
            'Fill threshold'
        ]);

        if (hasValue(state?.portsRequired) && picked.every((row) => row.label !== 'Total ports required')) {
            picked.unshift({
                label: 'Total ports required',
                value: formatNumber(state.portsRequired)
            });
        }

        return picked;
    }

    function buildPowerDetailRows(state) {
        const rows = [];
        const circuitAmperage = state?.circuitAmperage;

        if (hasValue(state?.wattsPerPanel)) {
            rows.push({ label: 'Watts per panel', value: `${formatNumber(state.wattsPerPanel)} W` });
        }
        if (hasValue(state?.totalEstimatedWatts)) {
            rows.push({ label: 'Total estimated watts', value: `${formatNumber(state.totalEstimatedWatts)} W` });
        }
        if (hasValue(state?.totalEstimatedAmps) && hasValue(state?.circuitVoltage)) {
            rows.push({
                label: 'Total estimated amps',
                value: `${Number(state.totalEstimatedAmps).toFixed(1)} A @ ${state.circuitVoltage}V`
            });
        }
        if (hasValue(circuitAmperage)) {
            rows.push({ label: 'Circuit size', value: `${circuitAmperage}A` });
        }
        if (hasValue(state?.usableWattsPerCircuit)) {
            rows.push({
                label: 'Usable circuit capacity (80%)',
                value: `${formatNumber(Math.round(state.usableWattsPerCircuit))} W`
            });
        }
        if (hasValue(state?.circuitsRequired)) {
            rows.push({
                label: 'Circuits required',
                value: formatNumber(state.circuitsRequired)
            });
        }

        return rows;
    }

    function buildCurvedWallDetailRows(state, inputs = {}) {
        return Summary()?.buildCurvedWallDetailRows?.(state, inputs) || [];
    }

    function buildNotesRows(model) {
        const notes = [...(model.sections.buildNotes || [])];
        if (model.warnings?.length) {
            model.warnings.slice(0, 2).forEach((warning, index) => {
                notes.push({
                    label: index === 0 ? 'Deployment note' : '',
                    value: warning
                });
            });
        }
        return notes;
    }

    function drawDetailSection(doc, title, rows, x, y, width, options = {}) {
        if (!rows.length) {
            return y;
        }

        const labelWidth = options.labelWidth ?? 36;
        const rowGap = options.rowGap ?? 3.4;
        const titleGap = options.titleGap ?? 4;
        const fontSize = options.fontSize ?? 6.5;
        const valueFontSize = options.valueFontSize ?? 6.5;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        setTextColor(doc, COLORS.orange);
        doc.text(title, x, y);

        setDrawColor(doc, COLORS.border);
        doc.setLineWidth(0.2);
        doc.line(x, y + 1, x + width, y + 1);

        let cursorY = y + titleGap;

        rows.forEach((row) => {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(fontSize);
            setTextColor(doc, COLORS.muted);
            doc.text(row.label, x, cursorY);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(valueFontSize);
            setTextColor(doc, COLORS.text);
            const valueX = x + labelWidth;
            const valueWidth = width - labelWidth;
            const valueLines = doc.splitTextToSize(String(row.value), valueWidth);
            doc.text(valueLines, valueX, cursorY);

            cursorY += Math.max(rowGap, valueLines.length * 2.8);
        });

        if (options.note) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(6);
            setTextColor(doc, COLORS.muted);
            const noteLines = doc.splitTextToSize(options.note, width);
            doc.text(noteLines, x, cursorY + 0.5);
            cursorY += noteLines.length * 2.6 + 1;
        }

        return cursorY + 1.5;
    }

    function drawFooter(doc, y) {
        const contentWidth = PAGE.width - PAGE.margin * 2;
        const footerTop = Math.max(y + 3, PAGE.height - PAGE.margin - PAGE.footerHeight);

        drawHorizontalRule(doc, footerTop, PAGE.margin, PAGE.width - PAGE.margin);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        setTextColor(doc, COLORS.text);
        doc.text('Generated by Okami Designs LED Wall Calculator', PAGE.margin, footerTop + 4.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        setTextColor(doc, COLORS.muted);
        const disclaimer = 'Verify processor, power, rigging, and manufacturer specifications before deployment.';
        doc.text(doc.splitTextToSize(disclaimer, contentWidth), PAGE.margin, footerTop + 8);

        return footerTop;
    }

    function downloadPdf(inputs, state, options = {}) {
        const exportApi = BuildSheet();
        const summaryApi = Summary();
        if (!exportApi?.buildBuildSheetModel) {
            throw new Error('Build sheet export is unavailable.');
        }
        if (!summaryApi?.buildProjectSummary) {
            throw new Error('Project summary module is unavailable.');
        }

        const jsPDF = getJsPDF();
        const model = exportApi.buildBuildSheetModel(inputs, state, options);
        const wallState = model.wallState;
        const projectSummary = summaryApi.buildProjectSummary(wallState, inputs);
        const summaryCards = summaryApi.buildKpiCards(projectSummary);
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

        doc.setProperties({
            title: 'LED Wall Build Sheet',
            subject: 'Okami Designs LED Wall Calculator',
            author: 'Okami Designs'
        });

        const contentLeft = PAGE.margin;
        const contentWidth = PAGE.width - PAGE.margin * 2;
        const columnGap = 6;
        const columnWidth = (contentWidth - columnGap) / 2;
        const leftX = contentLeft;
        const rightX = contentLeft + columnWidth + columnGap;
        const footerReserve = PAGE.margin + PAGE.footerHeight + 4;
        const maxContentY = PAGE.height - footerReserve;

        let y = drawTitleRow(doc, model, PAGE.margin + 2);

        let summaryCardCount = 5;
        let summaryCardHeight = 27;
        let visualMaxH = 46;
        const estimatedDetailsHeight = 58;

        let projectedBottom = y + 5 + summaryCardHeight + 3 + visualMaxH + 22 + estimatedDetailsHeight;
        if (projectedBottom > maxContentY) {
            visualMaxH = 38;
            projectedBottom = y + 5 + summaryCardHeight + 3 + visualMaxH + 22 + estimatedDetailsHeight;
        }
        if (projectedBottom > maxContentY) {
            summaryCardCount = 4;
            projectedBottom = y + 5 + summaryCardHeight + 3 + visualMaxH + 22 + estimatedDetailsHeight;
        }
        if (projectedBottom > maxContentY) {
            summaryCardCount = 3;
            visualMaxH = 34;
        }

        y = drawProjectSummary(doc, summaryCards, y, {
            cardCount: summaryCardCount,
            cardHeight: summaryCardHeight
        });

        y = drawWallVisual(doc, wallState, y + 2, visualMaxH);

        if (isCurvedWallExportEnabled(wallState, inputs)) {
            y = drawTopViewCurveSection(doc, wallState, inputs, y + 2, 42);
        }

        const detailCompact = {
            rowGap: 3,
            titleGap: 3.8,
            fontSize: 6.2,
            valueFontSize: 6.2,
            labelWidth: 32
        };

        const cabinetRows = buildCabinetDetailRows(model);
        const resolutionRows = buildResolutionDetailRows(model);
        const processorRows = buildProcessorDetailRows(model, wallState);
        const powerRows = buildPowerDetailRows(wallState);
        const notesRows = buildNotesRows(model);

        let detailStartY = y + 1;
        let leftY = detailStartY;
        let rightY = detailStartY;

        leftY = drawDetailSection(doc, 'Cabinet Details', cabinetRows, leftX, leftY, columnWidth, detailCompact);
        leftY = drawDetailSection(doc, 'Resolution Details', resolutionRows, leftX, leftY + 0.5, columnWidth, detailCompact);
        if (isCurvedWallExportEnabled(wallState, inputs)) {
            leftY = drawDetailSection(
                doc,
                'Curved Wall',
                buildCurvedWallDetailRows(wallState, inputs),
                leftX,
                leftY + 0.5,
                columnWidth,
                detailCompact
            );
        }

        rightY = drawDetailSection(doc, 'Processor Details', processorRows, rightX, rightY, columnWidth, {
            ...detailCompact,
            note: model.portMapping?.length
                ? `${formatNumber(model.portMapping.length)} port${model.portMapping.length === 1 ? '' : 's'} suggested — confirm mapping in processor software.`
                : null
        });
        rightY = drawDetailSection(doc, 'Power Details', powerRows, rightX, rightY + 0.5, columnWidth, {
            ...detailCompact,
            note: '20% headroom included on circuit capacity.'
        });

        const notesY = Math.max(leftY, rightY) + 0.5;
        let contentBottom = notesY;

        if (notesRows.length && notesY < maxContentY - 10) {
            contentBottom = drawDetailSection(
                doc,
                'Notes',
                notesRows,
                contentLeft,
                notesY,
                contentWidth,
                { ...detailCompact, labelWidth: 24 }
            );
        }

        drawFooter(doc, Math.min(contentBottom, maxContentY));

        const filename = `okami-led-wall-build-sheet-${formatFilenameDate(model.exportedAt)}.pdf`;
        doc.save(filename);

        return { filename, model };
    }

    const api = { downloadPdf };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    global.OkamiLedWallCalculator = global.OkamiLedWallCalculator || {};
    global.OkamiLedWallCalculator.BuildSheetPdf = api;
}(typeof window !== 'undefined' ? window : global));
