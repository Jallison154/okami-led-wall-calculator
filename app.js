(function() {
    'use strict';

    const Calc = window.OkamiLedWallCalculator;
    const {
        Constants,
        clampPanelCount,
        clampPortFillThreshold,
        calculateCabinetResolution,
        calculateContentOverlay,
        calculateCabinetArtworkType,
        computeWallProject,
        computeTopViewCurveDiagram,
        computeTopViewCurveViewBox,
        buildTopViewCurveSvg,
        maxCabinetAngleForPanels,
        isCustomSpacingDisplayType
    } = Calc;

    const {
        DEFAULTS,
        PITCH_PRESETS,
        CABINET_PRESETS,
        EXTENDED_PITCHES,
        DISPLAY_TYPE_STANDARD,
        DISPLAY_TYPE_CUSTOM_SPACING,
        DISPLAY_TYPE_TRANSPARENT_LEGACY
    } = Constants;

    const LABEL_TIER = {
        LARGE: 'large',
        MEDIUM: 'medium',
        SMALL: 'small',
        TINY: 'tiny'
    };

    const ADV_TO_HIDDEN_FIELDS = {
        'custom-cabinet-width-mm': 'cabinet-width-mm',
        'custom-cabinet-height-mm': 'cabinet-height-mm',
        'custom-pixel-pitch-mm': 'pixel-pitch-mm'
    };

    const ADV_FIELD_IDS = Object.keys(ADV_TO_HIDDEN_FIELDS);
    const PANEL_COUNT_CANONICAL = {
        'panels-wide-adv': 'panels-wide',
        'panels-tall-adv': 'panels-tall'
    };
    const PANEL_COUNT_STEPPERS = [
        { input: 'panels-wide', dec: 'panels-wide-dec', inc: 'panels-wide-inc' },
        { input: 'panels-tall', dec: 'panels-tall-dec', inc: 'panels-tall-inc' },
        { input: 'panels-wide-adv', dec: 'panels-wide-adv-dec', inc: 'panels-wide-adv-inc' },
        { input: 'panels-tall-adv', dec: 'panels-tall-adv-dec', inc: 'panels-tall-adv-inc' }
    ];

    const OVERLAY_DEBUG = new URLSearchParams(window.location.search).has('debug');
    const CABINET_NUMBERS_SESSION_KEY = 'led-show-cabinet-numbers';
    const PREVIEW_INTRINSIC_WIDTH = 480;
    const PREVIEW_MIN_SCALE = 0.2;
    const PREVIEW_MAX_SCALE = 8;
    const PREVIEW_FILL_RATIO = 0.93;
    const PREVIEW_AXIS_GUTTER_X = 28;
    const PREVIEW_AXIS_GUTTER_Y = 22;
    const PREVIEW_MEASURE_PADDING = 16;
    const PREVIEW_OVERLAY_TOP_GUTTER = 12;
    const CABINET_ART = {
        square: { src: '../images/led-cabinet-square.png', status: 'loading' },
        tall: { src: '../images/led-cabinet-500x1000.png', status: 'loading' }
    };

    let resizeObserver = null;
    let previewResizeRaf = null;
    let lastMeasureWidth = 0;
    let lastMeasureHeight = 0;
    let lastAppliedPreviewScale = 0;
    let lastPreviewLayoutKey = '';
    let lastPreviewContentKey = '';
    let lastTopViewPanelKey = '';
    let syncingPreset = false;
    let previewHoverBound = false;
    let advancedViewOpen = false;
    let cabinetArtInitialized = false;

    function initLedWallVisualizer() {
        const app = document.getElementById('led-wall-app');
        if (!app || app.dataset.initialized === 'true') {
            if (app) {
                updateAll();
            }
            return;
        }

        app.dataset.initialized = 'true';

        ADV_FIELD_IDS.forEach((id) => {
            document.getElementById(id)?.addEventListener('input', () => onAdvFieldChange(id));
        });

        initQuickStart();
        initPanelCountControls();
        initCurvedWallControls();
        syncPanelCountFields();
        initShowCabinetNumbers();
        initCabinetArtWhenVisible();

        document.getElementById('auto-calculate-resolution')?.addEventListener('change', () => {
            applyAutoCalculateMode();
            updateAll();
        });

        document.getElementById('pixel-width')?.addEventListener('input', onManualPixelChange);
        document.getElementById('pixel-height')?.addEventListener('input', onManualPixelChange);
        document.getElementById('port-capacity')?.addEventListener('input', updateAll);
        document.getElementById('port-fill-threshold')?.addEventListener('input', updateAll);
        document.getElementById('port-fill-threshold')?.addEventListener('blur', () => {
            const input = document.getElementById('port-fill-threshold');
            if (input) {
                input.value = readPortFillThreshold();
            }
            updateAll();
        });

        ['watts-per-panel', 'circuit-amperage', 'circuit-voltage', 'circuit-safe-load'].forEach((id) => {
            document.getElementById(id)?.addEventListener('input', updateAll);
            if (id === 'circuit-safe-load') {
                document.getElementById(id)?.addEventListener('blur', () => {
                    const input = document.getElementById(id);
                    if (input) {
                        input.value = readCircuitSafeLoadPercent();
                    }
                    updateAll();
                });
            }
        });

        document.getElementById('custom-spacing-horizontal-mm')?.addEventListener('input', onCustomSpacingChange);
        document.getElementById('custom-spacing-vertical-mm')?.addEventListener('input', onCustomSpacingChange);

        document.getElementById('overlay-format')?.addEventListener('change', () => {
            toggleCustomFormatFields();
            updateAll();
        });

        document.getElementById('custom-format-width')?.addEventListener('input', updateAll);
        document.getElementById('custom-format-height')?.addEventListener('input', updateAll);

        document.getElementById('led-reset')?.addEventListener('click', () => {
            resetCalculator();
            updateAll();
        });

        document.getElementById('led-advanced-open')?.addEventListener('click', () => {
            openAdvancedView();
        });

        document.getElementById('led-advanced-back')?.addEventListener('click', () => {
            closeAdvancedView();
        });

        document.getElementById('led-save-project')?.addEventListener('click', () => {
            void saveProjectFile();
        });

        document.getElementById('led-load-project')?.addEventListener('click', () => {
            document.getElementById('led-load-project-input')?.click();
        });

        document.getElementById('led-load-project-input')?.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) {
                void loadProjectFile(file);
            }
        });

        document.getElementById('led-export-report')?.addEventListener('click', () => {
            void exportProjectReport();
        });

        document.getElementById('led-download-build-sheet-pdf')?.addEventListener('click', () => {
            void downloadBuildSheetPdf();
        });

        const measure = document.getElementById('led-preview-measure');
        if (measure && 'ResizeObserver' in window) {
            resizeObserver = new ResizeObserver(onPreviewMeasureResize);
            resizeObserver.observe(measure);
        }

        window.addEventListener('resize', onResize);
        closeAdvancedView();
        syncAdvFromHidden();
        applyAutoCalculateMode();
        toggleCustomFormatFields();
        updateAll();

        void window.OkamiCommercialGate?.initForProduct?.('okami-led-wall-calculator');
        void window.OkamiDesktopShell?.initDesktopShell?.({ productId: 'okami-led-wall-calculator' });
    }

    function initCabinetArtWhenVisible() {
        if (cabinetArtInitialized) {
            return;
        }

        const measure = document.getElementById('led-preview-measure');
        if (!measure) {
            return;
        }

        const startLoading = () => {
            if (!cabinetArtInitialized) {
                initCabinetArt();
            }
        };

        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    observer.disconnect();
                    startLoading();
                }
            }, { rootMargin: '120px' });

            observer.observe(measure);
            return;
        }

        if ('requestIdleCallback' in window) {
            requestIdleCallback(startLoading, { timeout: 2000 });
            return;
        }

        setTimeout(startLoading, 500);
    }

    function initCabinetArt() {
        if (cabinetArtInitialized) {
            return;
        }

        cabinetArtInitialized = true;

        Object.keys(CABINET_ART).forEach((key) => {
            const preload = new Image();
            preload.onload = () => {
                CABINET_ART[key].status = 'loaded';
                refreshCabinetArtPreview();
            };
            preload.onerror = () => {
                CABINET_ART[key].status = 'error';
                refreshCabinetArtPreview();
            };
            preload.src = CABINET_ART[key].src;
        });
    }

    function getCabinetArtType(state) {
        return calculateCabinetArtworkType(state);
    }

    function refreshCabinetArtPreview() {
        if (document.getElementById('led-preview-wall')) {
            renderPreview(getState());
        }
    }

    function createCabinetCell(index) {
        const cell = document.createElement('div');
        cell.className = 'led-cabinet';
        cell.dataset.index = String(index);

        const label = document.createElement('span');
        label.className = 'led-cabinet-label';
        cell.appendChild(label);

        return cell;
    }

    function applyCabinetArtToWall(wall, state) {
        const artType = getCabinetArtType(state);
        const useSquare = artType === 'square' && CABINET_ART.square.status === 'loaded';
        const useTall = artType === 'tall' && CABINET_ART.tall.status === 'loaded';

        wall.querySelectorAll('.led-cabinet').forEach((cell) => {
            cell.classList.toggle('has-cabinet-art--square', useSquare);
            cell.classList.toggle('has-cabinet-art--tall', useTall);
            cell.classList.toggle('led-cabinet--fallback', !useSquare && !useTall);
        });
    }

    function initShowCabinetNumbers() {
        const toggle = document.getElementById('show-cabinet-numbers');
        if (!toggle) {
            return;
        }

        const stored = sessionStorage.getItem(CABINET_NUMBERS_SESSION_KEY);
        toggle.checked = stored === null ? DEFAULTS.showCabinetNumbers : stored === 'true';

        toggle.addEventListener('change', () => {
            sessionStorage.setItem(CABINET_NUMBERS_SESSION_KEY, String(toggle.checked));
            hideCabinetTooltip();
            renderPreview(getState());
        });
    }

    function initQuickStart() {
        document.querySelectorAll('[data-cabinet]').forEach((button) => {
            button.addEventListener('click', () => {
                applyQuickCabinet(button.dataset.cabinet);
            });
        });

        document.querySelectorAll('[data-pitch]').forEach((button) => {
            button.addEventListener('click', () => {
                if (button.dataset.pitch === 'custom') {
                    applyCustomPitch();
                } else {
                    applyQuickPitch(parseFloat(button.dataset.pitch));
                }
            });
        });

        document.querySelectorAll('[name="display-mode"]').forEach((input) => {
            input.addEventListener('change', () => {
                if (input.checked) {
                    applyDisplayType(input.value);
                }
            });
        });
    }

    function initPanelCountControls() {
        PANEL_COUNT_STEPPERS.forEach(({ input, dec, inc }) => {
            document.getElementById(dec)?.addEventListener('click', () => adjustPanelCount(input, -1));
            document.getElementById(inc)?.addEventListener('click', () => adjustPanelCount(input, 1));
        });

        getAllPanelCountInputIds().forEach((id) => {
            const input = document.getElementById(id);
            input?.addEventListener('input', () => onPanelCountInput(id));
            input?.addEventListener('blur', () => onPanelCountBlur(id));
            input?.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    input.blur();
                }
            });
        });
    }

    function getAllPanelCountInputIds() {
        return PANEL_COUNT_STEPPERS.map(({ input }) => input);
    }

    function getPanelCountSiblings(id) {
        const canonical = PANEL_COUNT_CANONICAL[id] || id;
        if (canonical === 'panels-wide') {
            return ['panels-wide', 'panels-wide-adv'];
        }
        return ['panels-tall', 'panels-tall-adv'];
    }

    function syncPanelCountFields() {
        setInputValue('panels-wide-adv', readInt('panels-wide', DEFAULTS.panelsWide));
        setInputValue('panels-tall-adv', readInt('panels-tall', DEFAULTS.panelsTall));
    }

    function syncAdvFromHidden() {
        Object.entries(ADV_TO_HIDDEN_FIELDS).forEach(([advId, hiddenId]) => {
            const hidden = document.getElementById(hiddenId);
            const adv = document.getElementById(advId);
            if (hidden && adv) {
                adv.value = hidden.value;
            }
        });
    }

    function syncHiddenFromAdv(advId) {
        const hiddenId = ADV_TO_HIDDEN_FIELDS[advId];
        const adv = document.getElementById(advId);
        const hidden = hiddenId ? document.getElementById(hiddenId) : null;
        if (adv && hidden) {
            hidden.value = adv.value;
        }
    }

    function applyQuickCabinet(presetKey) {
        const preset = CABINET_PRESETS[presetKey];
        if (!preset) {
            return;
        }

        syncingPreset = true;
        setInputValue('cabinet-preset', presetKey);
        setInputValue('cabinet-width-mm', preset.width);
        setInputValue('cabinet-height-mm', preset.height);
        syncAdvFromHidden();
        syncingPreset = false;
        syncAutoPixelResolution();
        updateAll();
    }

    function applyQuickPitch(pitch) {
        setInputValue('pitch-preset', String(pitch));
        setInputValue('pixel-pitch-mm', pitch);
        syncAutoPixelResolution();
        updateAll();
    }

    function applyCustomPitch() {
        setPitchToCustom();
        document.getElementById('custom-pixel-pitch-mm')?.focus();
        updateAll();
    }

    function isExtendedPitchPreset(pitchPreset) {
        if (pitchPreset === 'custom') {
            return true;
        }
        const pitch = parseFloat(pitchPreset);
        return EXTENDED_PITCHES.some((value) => Math.abs(value - pitch) < 0.01);
    }

    function getCabinetLayoutSnapshot() {
        return {
            cabinetPreset: getCabinetPreset(),
            cabinetWidthMM: readNumber('cabinet-width-mm', DEFAULTS.cabinetWidthMM),
            cabinetHeightMM: readNumber('cabinet-height-mm', DEFAULTS.cabinetHeightMM),
            panelsWide: readInt('panels-wide', DEFAULTS.panelsWide),
            panelsTall: readInt('panels-tall', DEFAULTS.panelsTall)
        };
    }

    function restoreCabinetLayoutSnapshot(snapshot) {
        setInputValue('cabinet-preset', snapshot.cabinetPreset);
        setInputValue('cabinet-width-mm', snapshot.cabinetWidthMM);
        setInputValue('cabinet-height-mm', snapshot.cabinetHeightMM);
        setInputValue('panels-wide', snapshot.panelsWide);
        setInputValue('panels-tall', snapshot.panelsTall);
        syncPanelCountFields();
        syncAdvFromHidden();
    }

    function normalizeDisplayType(displayType) {
        const type = displayType || DEFAULTS.displayType;
        if (type === DISPLAY_TYPE_TRANSPARENT_LEGACY) {
            return DISPLAY_TYPE_CUSTOM_SPACING;
        }
        return type;
    }

    function readCustomSpacingHorizontal() {
        return readNumber('custom-spacing-horizontal-mm', DEFAULTS.meshPitchHorizontalMM);
    }

    function readCustomSpacingVertical() {
        return readNumber('custom-spacing-vertical-mm', DEFAULTS.meshPitchVerticalMM);
    }

    function setCustomSpacingHorizontal(value) {
        setInputValue('custom-spacing-horizontal-mm', value);
    }

    function setCustomSpacingVertical(value) {
        setInputValue('custom-spacing-vertical-mm', value);
    }

    function seedCustomSpacingFromStandardPitch() {
        const pitch = readNumber('pixel-pitch-mm', DEFAULTS.pixelPitchMM);
        setCustomSpacingHorizontal(pitch);
        setCustomSpacingVertical(pitch);
    }

    function applyDisplayType(displayType) {
        const previousType = normalizeDisplayType(getDisplayType());
        const normalized = normalizeDisplayType(displayType);
        const layoutSnapshot = getCabinetLayoutSnapshot();

        if (normalized === DISPLAY_TYPE_CUSTOM_SPACING && previousType === DISPLAY_TYPE_STANDARD) {
            seedCustomSpacingFromStandardPitch();
        }

        setInputValue('display-type', normalized);
        syncAutoPixelResolution();
        restoreCabinetLayoutSnapshot(layoutSnapshot);
        updateAll();
    }

    function onCustomSpacingChange() {
        syncAutoPixelResolution();
        updateAll();
    }

    function getPanelCountDefault(id) {
        const canonical = PANEL_COUNT_CANONICAL[id] || id;
        return canonical === 'panels-wide' ? DEFAULTS.panelsWide : DEFAULTS.panelsTall;
    }

    function setPanelCount(id, value) {
        const next = clampPanelCount(value);
        getPanelCountSiblings(id).forEach((siblingId) => {
            setInputValue(siblingId, next);
        });
        updateAll();
    }

    function adjustPanelCount(id, delta) {
        const current = readInt(id, getPanelCountDefault(id));
        setPanelCount(id, current + delta);
    }

    function onPanelCountInput(id) {
        const input = document.getElementById(id);
        if (!input || input.value.trim() === '') {
            return;
        }

        const parsed = parseInt(input.value, 10);
        if (!Number.isFinite(parsed)) {
            return;
        }

        setPanelCount(id, parsed);
    }

    function onPanelCountBlur(id) {
        const input = document.getElementById(id);
        if (!input) {
            return;
        }

        const parsed = parseInt(input.value, 10);
        if (input.value.trim() === '' || !Number.isFinite(parsed)) {
            setPanelCount(id, getPanelCountDefault(id));
            return;
        }

        setPanelCount(id, parsed);
    }

    function syncPanelCountInputs(state) {
        [
            { ids: getPanelCountSiblings('panels-wide'), value: state.panelsWide },
            { ids: getPanelCountSiblings('panels-tall'), value: state.panelsTall }
        ].forEach(({ ids, value }) => {
            ids.forEach((id) => {
                const input = document.getElementById(id);
                if (!input || document.activeElement === input) {
                    return;
                }

                if (parseInt(input.value, 10) !== value) {
                    input.value = value;
                }
            });
        });
    }

    function findMatchingPitch(pixelPitchMM) {
        return PITCH_PRESETS.find((pitch) => Math.abs(pitch - pixelPitchMM) < 0.01) ?? null;
    }

    function getDisplayType() {
        return normalizeDisplayType(document.getElementById('display-type')?.value || DEFAULTS.displayType);
    }

    function setPitchToCustom() {
        setInputValue('pitch-preset', 'custom');
    }

    function onPreviewMeasureResize(entries) {
        const entry = entries[0];
        if (!entry) {
            return;
        }

        const width = Math.round(entry.contentRect.width);
        const height = Math.round(entry.contentRect.height);
        if (Math.abs(width - lastMeasureWidth) <= 1 && Math.abs(height - lastMeasureHeight) <= 1) {
            return;
        }

        if (previewResizeRaf) {
            cancelAnimationFrame(previewResizeRaf);
        }

        previewResizeRaf = requestAnimationFrame(() => {
            previewResizeRaf = null;
            applyPreviewScaleOnly(getState());
        });
    }

    function onResize() {
        if (!document.getElementById('led-wall-app')) {
            return;
        }

        applyPreviewScaleOnly(getState());
    }

    function computePreviewContentKey(state) {
        return [
            state.panelsWide,
            state.panelsTall,
            state.cabinetWidthMM,
            state.cabinetHeightMM,
            state.totalPanels,
            state.displayType,
            isCabinetNumbersEnabled()
        ].join('|');
    }

    function computePreviewIntrinsicLayout(state) {
        const aspect = getWallPhysicalAspect(state);
        const wallWidth = PREVIEW_INTRINSIC_WIDTH;
        const wallHeight = wallWidth / aspect;
        const cellWidth = wallWidth / state.panelsWide;
        const tier = getLabelTier(cellWidth);
        const numbersEnabled = isCabinetNumbersEnabled();
        const showAxisLabels = numbersEnabled && tier === LABEL_TIER.TINY;

        let contentWidth = wallWidth;
        let contentHeight = wallHeight;
        if (showAxisLabels) {
            contentWidth += PREVIEW_AXIS_GUTTER_X;
            contentHeight += PREVIEW_AXIS_GUTTER_Y;
        }

        let overlayTopGutter = 0;
        if (state?.overlay && state.overlay.topPercent < 2) {
            overlayTopGutter = PREVIEW_OVERLAY_TOP_GUTTER;
        }

        if (overlayTopGutter) {
            contentHeight += overlayTopGutter;
        }

        return {
            wallWidth,
            wallHeight,
            contentWidth,
            contentHeight,
            showAxisLabels,
            tier,
            cellWidth,
            overlayTopGutter
        };
    }

    function computePreviewScaleFactor(contentWidth, contentHeight, measureWidth, measureHeight) {
        const availableWidth = Math.max(measureWidth - PREVIEW_MEASURE_PADDING, 80);
        const availableHeight = Math.max(measureHeight - PREVIEW_MEASURE_PADDING, 80);
        const fitScale = Math.min(
            availableWidth / contentWidth,
            availableHeight / contentHeight
        );
        const scale = fitScale * PREVIEW_FILL_RATIO;
        return Math.max(PREVIEW_MIN_SCALE, Math.min(PREVIEW_MAX_SCALE, scale));
    }

    function applyPreviewScaleOnly(state) {
        const measure = document.getElementById('led-preview-measure');
        const scaleWrap = document.getElementById('led-preview-scale-wrap');
        const scaleLayer = document.getElementById('led-preview-scale-layer');
        if (!measure || !scaleWrap || !scaleLayer) {
            return;
        }

        const layout = computePreviewIntrinsicLayout(state);
        const measureWidth = Math.round(measure.clientWidth);
        const measureHeight = Math.round(measure.clientHeight);
        const scale = computePreviewScaleFactor(
            layout.contentWidth,
            layout.contentHeight,
            measureWidth,
            measureHeight
        );

        const layoutKey = `${layout.contentWidth}x${layout.contentHeight}`;

        if (
            Math.abs(scale - lastAppliedPreviewScale) < 0.001
            && layoutKey === lastPreviewLayoutKey
            && Math.abs(measureWidth - lastMeasureWidth) <= 1
            && Math.abs(measureHeight - lastMeasureHeight) <= 1
        ) {
            return;
        }

        lastAppliedPreviewScale = scale;
        lastPreviewLayoutKey = layoutKey;
        lastMeasureWidth = measureWidth;
        lastMeasureHeight = measureHeight;

        const visualWidth = layout.contentWidth * scale;
        const visualHeight = layout.contentHeight * scale;

        scaleWrap.style.width = `${visualWidth}px`;
        scaleWrap.style.height = `${visualHeight}px`;
        scaleLayer.style.width = `${layout.contentWidth}px`;
        scaleLayer.style.height = `${layout.contentHeight}px`;
        scaleLayer.style.paddingTop = layout.overlayTopGutter ? `${layout.overlayTopGutter}px` : '0';
        scaleLayer.style.transform = `scale(${scale})`;
    }

    function onAdvFieldChange(advId) {
        syncHiddenFromAdv(advId);
        if (!syncingPreset && (advId === 'custom-cabinet-width-mm' || advId === 'custom-cabinet-height-mm')) {
            applyCustomCabinetFromDimensions();
        }
        if (advId === 'custom-pixel-pitch-mm') {
            setPitchToCustom();
        }
        syncAutoPixelResolution();
        updateAll();
    }

    function onManualPixelChange() {
        if (isAutoCalculateEnabled()) {
            return;
        }
        updateAll();
    }

    function setPresetToCustom() {
        const presetInput = document.getElementById('cabinet-preset');
        if (presetInput && presetInput.value !== 'custom') {
            presetInput.value = 'custom';
        }
    }

    function applyCustomCabinetFromDimensions() {
        const width = readNumber('cabinet-width-mm', DEFAULTS.cabinetWidthMM);
        const height = readNumber('cabinet-height-mm', DEFAULTS.cabinetHeightMM);
        const matchesPreset = (presetKey) => {
            const preset = CABINET_PRESETS[presetKey];
            return preset && Math.abs(preset.width - width) < 0.001 && Math.abs(preset.height - height) < 0.001;
        };

        if (matchesPreset('500x500')) {
            setInputValue('cabinet-preset', '500x500');
        } else if (matchesPreset('500x1000')) {
            setInputValue('cabinet-preset', '500x1000');
        } else {
            setPresetToCustom();
        }
    }

    function getCabinetPreset() {
        return document.getElementById('cabinet-preset')?.value || 'custom';
    }

    function isAutoCalculateEnabled() {
        const checkbox = document.getElementById('auto-calculate-resolution');
        return checkbox ? checkbox.checked : DEFAULTS.autoCalculateResolution;
    }

    function applyAutoCalculateMode() {
        const autoEnabled = isAutoCalculateEnabled();
        const manualFields = document.getElementById('led-manual-resolution-fields');

        if (manualFields) {
            manualFields.hidden = autoEnabled;
        }

        if (autoEnabled) {
            syncAutoPixelResolution();
        }

        setText('auto-calc-state', autoEnabled ? 'On' : 'Off');
    }

    function syncAutoPixelResolution() {
        if (!isAutoCalculateEnabled()) {
            return;
        }

        const { pixelWidth, pixelHeight } = calculateCabinetResolution(gatherInputs());
        setInputValue('pixel-width', pixelWidth);
        setInputValue('pixel-height', pixelHeight);
    }

    function toggleCustomFormatFields() {
        const customAspect = document.getElementById('led-custom-aspect-section');
        const format = getOverlayFormat();
        if (customAspect) {
            customAspect.hidden = format !== 'custom';
        }
    }

    function getOverlayFormat() {
        return document.getElementById('overlay-format')?.value || 'none';
    }

    function overlayInputsFromDom() {
        return {
            overlayFormat: getOverlayFormat(),
            customFormatWidth: readInt('custom-format-width', DEFAULTS.customFormatWidth),
            customFormatHeight: readInt('custom-format-height', DEFAULTS.customFormatHeight)
        };
    }

    function setOverlayFormat(format) {
        const select = document.getElementById('overlay-format');
        if (select) {
            select.value = format;
        }
    }

    function openAdvancedView() {
        advancedViewOpen = true;
        syncPanelCountFields();
        document.getElementById('led-config-swap')?.classList.add('is-advanced');
        document.querySelector('.wall-configuration-card')?.classList.add('is-advanced-open');
        const quickStart = document.getElementById('led-quick-start');
        const advancedPanel = document.getElementById('led-advanced-panel');
        const advancedOpen = document.getElementById('led-advanced-open');
        if (quickStart) {
            quickStart.hidden = true;
        }
        if (advancedPanel) {
            advancedPanel.hidden = false;
        }
        if (advancedOpen) {
            advancedOpen.hidden = true;
        }
    }

    function closeAdvancedView() {
        advancedViewOpen = false;
        document.getElementById('led-config-swap')?.classList.remove('is-advanced');
        document.querySelector('.wall-configuration-card')?.classList.remove('is-advanced-open');
        const quickStart = document.getElementById('led-quick-start');
        const advancedPanel = document.getElementById('led-advanced-panel');
        const advancedOpen = document.getElementById('led-advanced-open');
        if (quickStart) {
            quickStart.hidden = false;
        }
        if (advancedPanel) {
            advancedPanel.hidden = true;
        }
        if (advancedOpen) {
            advancedOpen.hidden = false;
        }
    }

    function resetCalculator() {
        setInputValue('cabinet-preset', DEFAULTS.cabinetPreset);
        setInputValue('pitch-preset', DEFAULTS.pitchPreset);
        setInputValue('display-type', DEFAULTS.displayType);
        setInputValue('cabinet-width-mm', DEFAULTS.cabinetWidthMM);
        setInputValue('cabinet-height-mm', DEFAULTS.cabinetHeightMM);
        setInputValue('pixel-pitch-mm', DEFAULTS.pixelPitchMM);
        setCustomSpacingHorizontal(DEFAULTS.meshPitchHorizontalMM);
        setCustomSpacingVertical(DEFAULTS.meshPitchVerticalMM);
        setInputValue('panels-wide', DEFAULTS.panelsWide);
        setInputValue('panels-tall', DEFAULTS.panelsTall);
        syncPanelCountFields();
        document.getElementById('auto-calculate-resolution').checked = DEFAULTS.autoCalculateResolution;
        setInputValue('pixel-width', DEFAULTS.pixelWidth);
        setInputValue('pixel-height', DEFAULTS.pixelHeight);
        setInputValue('port-capacity', DEFAULTS.portCapacity);
        setInputValue('port-fill-threshold', DEFAULTS.portFillThreshold);
        setInputValue('watts-per-panel', DEFAULTS.wattsPerPanel);
        setInputValue('circuit-amperage', DEFAULTS.circuitAmperage);
        setInputValue('circuit-voltage', DEFAULTS.circuitVoltage);
        setInputValue('circuit-safe-load', DEFAULTS.circuitSafeLoadPercent);
        setInputValue('custom-format-width', DEFAULTS.customFormatWidth);
        setInputValue('custom-format-height', DEFAULTS.customFormatHeight);
        setOverlayFormat(DEFAULTS.overlayFormat);
        setInputValue('project-name', '');
        const curvedWallMode = document.getElementById('curved-wall-mode');
        if (curvedWallMode) {
            curvedWallMode.checked = DEFAULTS.curvedWallMode;
        }
        setInputValue('cabinet-angle-preset', DEFAULTS.cabinetAnglePreset);
        setInputValue('custom-cabinet-angle-degrees', DEFAULTS.customCabinetAngleDegrees);
        updateCurvedWallControls();
        const showNumbers = document.getElementById('show-cabinet-numbers');
        if (showNumbers) {
            showNumbers.checked = DEFAULTS.showCabinetNumbers;
            sessionStorage.setItem(CABINET_NUMBERS_SESSION_KEY, String(DEFAULTS.showCabinetNumbers));
        }
        document.querySelectorAll('[name="display-mode"]').forEach((input) => {
            input.checked = input.value === DEFAULTS.displayType;
        });
        closeAdvancedView();
        syncAdvFromHidden();
        applyAutoCalculateMode();
        syncAutoPixelResolution();
        toggleCustomFormatFields();
    }

    function setInputValue(id, value) {
        const input = document.getElementById(id);
        if (input) {
            input.value = value;
        }
    }

    function readNumber(id, fallback) {
        const value = parseFloat(document.getElementById(id)?.value);
        return Number.isFinite(value) && value > 0 ? value : fallback;
    }

    function readInt(id, fallback) {
        const value = parseInt(document.getElementById(id)?.value, 10);
        return Number.isFinite(value) && value > 0 ? value : fallback;
    }

    function readPortFillThreshold() {
        const value = parseInt(document.getElementById('port-fill-threshold')?.value, 10);
        return clampPortFillThreshold(value);
    }

    function clampCircuitSafeLoadPercent(value, fallback = DEFAULTS.circuitSafeLoadPercent) {
        if (typeof Calc.clampCircuitSafeLoadPercent === 'function') {
            return Calc.clampCircuitSafeLoadPercent(value, fallback);
        }
        if (!Number.isFinite(value)) {
            return fallback;
        }
        return Math.min(80, Math.max(1, Math.round(value)));
    }

    function readCircuitSafeLoadPercent() {
        const value = parseInt(document.getElementById('circuit-safe-load')?.value, 10);
        return clampCircuitSafeLoadPercent(value);
    }

    function readCurvedWallMode() {
        return document.getElementById('curved-wall-mode')?.checked === true;
    }

    function readCabinetAnglePreset() {
        return document.getElementById('cabinet-angle-preset')?.value || DEFAULTS.cabinetAnglePreset;
    }

    function readCustomCabinetAngleDegrees() {
        const value = parseFloat(document.getElementById('custom-cabinet-angle-degrees')?.value);
        return Number.isFinite(value) && value >= 0 ? value : DEFAULTS.customCabinetAngleDegrees;
    }

    function updateCurvedWallControls(state) {
        const modeOn = readCurvedWallMode();
        const settings = document.getElementById('led-curved-wall-settings');
        const modeState = document.getElementById('curved-wall-mode-state');
        const customField = document.getElementById('led-custom-cabinet-angle-field');
        const customInput = document.getElementById('custom-cabinet-angle-degrees');
        const errorEl = document.getElementById('led-curved-wall-error');
        const preset = readCabinetAnglePreset();
        const panelsWide = readInt('panels-wide', DEFAULTS.panelsWide);
        const maxAngle = maxCabinetAngleForPanels(panelsWide);

        if (settings) {
            settings.hidden = !modeOn;
        }
        if (modeState) {
            modeState.textContent = modeOn ? 'On' : 'Off';
        }
        if (customField) {
            customField.hidden = !modeOn || preset !== 'custom';
        }
        if (customInput && panelsWide > 1) {
            customInput.max = String(Math.round(maxAngle * 10) / 10);
        }

        if (errorEl) {
            if (state?.curvedWallAngleExceeded && state.curvedWallValidationMessage) {
                errorEl.textContent = state.curvedWallValidationMessage;
                errorEl.hidden = false;
            } else if (modeOn && preset === 'custom' && readCustomCabinetAngleDegrees() > maxAngle && panelsWide > 1) {
                errorEl.textContent = `Cabinet angle cannot exceed ${maxAngle.toFixed(1)}° for ${panelsWide} cabinets wide (180° total max).`;
                errorEl.hidden = false;
            } else {
                errorEl.textContent = '';
                errorEl.hidden = true;
            }
        }
    }

    function initCurvedWallControls() {
        document.getElementById('curved-wall-mode')?.addEventListener('change', () => {
            updateCurvedWallControls(getState());
            updateAll();
        });
        document.getElementById('cabinet-angle-preset')?.addEventListener('change', () => {
            updateCurvedWallControls(getState());
            updateAll();
        });
        document.getElementById('custom-cabinet-angle-degrees')?.addEventListener('input', () => {
            updateCurvedWallControls(getState());
            updateAll();
        });
        document.getElementById('custom-cabinet-angle-degrees')?.addEventListener('blur', () => {
            const input = document.getElementById('custom-cabinet-angle-degrees');
            const panelsWide = readInt('panels-wide', DEFAULTS.panelsWide);
            const maxAngle = maxCabinetAngleForPanels(panelsWide);
            if (input) {
                const value = parseFloat(input.value);
                if (Number.isFinite(value) && value > maxAngle) {
                    input.value = String(Math.round(maxAngle * 10) / 10);
                } else if (Number.isFinite(value) && value < 0) {
                    input.value = '0';
                }
            }
            updateCurvedWallControls(getState());
            updateAll();
        });
        updateCurvedWallControls(getState());
    }

    function gatherInputs() {
        return {
            displayType: getDisplayType(),
            cabinetPreset: getCabinetPreset(),
            pitchPreset: document.getElementById('pitch-preset')?.value || 'custom',
            cabinetWidthMM: readNumber('cabinet-width-mm', DEFAULTS.cabinetWidthMM),
            cabinetHeightMM: readNumber('cabinet-height-mm', DEFAULTS.cabinetHeightMM),
            pixelPitchMM: readNumber('pixel-pitch-mm', DEFAULTS.pixelPitchMM),
            meshPitchHorizontalMM: readCustomSpacingHorizontal(),
            meshPitchVerticalMM: readCustomSpacingVertical(),
            panelsWide: readInt('panels-wide', DEFAULTS.panelsWide),
            panelsTall: readInt('panels-tall', DEFAULTS.panelsTall),
            pixelWidth: readInt('pixel-width', DEFAULTS.pixelWidth),
            pixelHeight: readInt('pixel-height', DEFAULTS.pixelHeight),
            autoCalculateResolution: isAutoCalculateEnabled(),
            portCapacity: readInt('port-capacity', DEFAULTS.portCapacity),
            portFillThreshold: readPortFillThreshold(),
            wattsPerPanel: readInt('watts-per-panel', DEFAULTS.wattsPerPanel),
            circuitAmperage: readInt('circuit-amperage', DEFAULTS.circuitAmperage),
            circuitVoltage: readInt('circuit-voltage', DEFAULTS.circuitVoltage),
            circuitSafeLoadPercent: readCircuitSafeLoadPercent(),
            projectName: document.getElementById('project-name')?.value?.trim() || '',
            curvedWallMode: readCurvedWallMode(),
            cabinetAnglePreset: readCabinetAnglePreset(),
            customCabinetAngleDegrees: readCustomCabinetAngleDegrees(),
            ...overlayInputsFromDom()
        };
    }

    function getState() {
        return computeWallProject(gatherInputs());
    }

    async function saveProjectFile() {
        const gate = window.OkamiCommercialGate;
        const footer = document.querySelector('.led-config-footer');
        if (gate?.checkLedWallSaveAllowed) {
            const check = await gate.checkLedWallSaveAllowed();
            if (!check.allowed) {
                gate.showUpgradeNotice?.('Save Project requires a Standard license or higher.', footer);
                return;
            }
        }

        const ProjectIO = window.OkamiLedWallCalculator?.ProjectIO;
        if (!ProjectIO) {
            return;
        }

        ProjectIO.downloadProject(gatherInputs(), getState());
        trackCalculatorUsage('save-project', 'LED Calculator: save project');
    }

    async function exportProjectReport() {
        const gate = window.OkamiCommercialGate;
        const footer = document.querySelector('.led-config-footer');
        if (gate?.checkLedWallReportAllowed) {
            const check = await gate.checkLedWallReportAllowed();
            if (!check.allowed) {
                gate.showUpgradeNotice?.('Export Report requires a Standard license or higher.', footer);
                return;
            }
        }

        const ProjectIO = window.OkamiLedWallCalculator?.ProjectIO;
        if (!ProjectIO) {
            return;
        }

        ProjectIO.downloadReport(gatherInputs(), getState());
        trackCalculatorUsage('export-report', 'LED Calculator: export report');
    }

    function buildSheetExportOptions() {
        const logoUrl = new URL('../GFX/Full/Okami_Designs_FullW.png', window.location.href).href;
        const inputs = gatherInputs();
        return {
            inputs,
            state: getState(),
            options: {
                projectName: inputs.projectName,
                logoUrl
            }
        };
    }

    function trackCalculatorUsage(action, label) {
        window.OkamiAnalytics?.trackToolUsage?.('led-wall-calculator', action, label);
    }

    function downloadBuildSheetPdf() {
        try {
            const PdfExport = window.OkamiLedWallCalculator?.BuildSheetPdf;
            if (!PdfExport?.downloadPdf) {
                throw new Error('PDF build sheet export is unavailable.');
            }

            const { inputs, state, options } = buildSheetExportOptions();
            PdfExport.downloadPdf(inputs, state, options);
            trackCalculatorUsage('pdf-download', 'LED Calculator: PDF build sheet');
        } catch (error) {
            window.alert(error.message || 'Could not download build sheet PDF. Please try again.');
        }
    }

    function applyProjectInputs(inputs = {}) {
        const data = inputs || {};

        setInputValue('cabinet-preset', data.cabinetPreset ?? DEFAULTS.cabinetPreset);
        setInputValue('pitch-preset', data.pitchPreset ?? DEFAULTS.pitchPreset);
        setInputValue('display-type', normalizeDisplayType(data.displayType ?? DEFAULTS.displayType));
        setInputValue('cabinet-width-mm', data.cabinetWidthMM ?? DEFAULTS.cabinetWidthMM);
        setInputValue('cabinet-height-mm', data.cabinetHeightMM ?? DEFAULTS.cabinetHeightMM);
        setInputValue('pixel-pitch-mm', data.pixelPitchMM ?? DEFAULTS.pixelPitchMM);
        setCustomSpacingHorizontal(data.meshPitchHorizontalMM ?? DEFAULTS.meshPitchHorizontalMM);
        setCustomSpacingVertical(data.meshPitchVerticalMM ?? DEFAULTS.meshPitchVerticalMM);
        setInputValue('project-name', data.projectName ?? '');
        setInputValue('panels-wide', data.panelsWide ?? DEFAULTS.panelsWide);
        setInputValue('panels-tall', data.panelsTall ?? DEFAULTS.panelsTall);
        syncPanelCountFields();
        setInputValue('pixel-width', data.pixelWidth ?? DEFAULTS.pixelWidth);
        setInputValue('pixel-height', data.pixelHeight ?? DEFAULTS.pixelHeight);
        setInputValue('port-capacity', data.portCapacity ?? DEFAULTS.portCapacity);
        setInputValue('port-fill-threshold', data.portFillThreshold ?? DEFAULTS.portFillThreshold);
        setInputValue('watts-per-panel', data.wattsPerPanel ?? DEFAULTS.wattsPerPanel);
        setInputValue('circuit-amperage', data.circuitAmperage ?? DEFAULTS.circuitAmperage);
        setInputValue('circuit-voltage', data.circuitVoltage ?? DEFAULTS.circuitVoltage);
        setInputValue('circuit-safe-load', data.circuitSafeLoadPercent ?? DEFAULTS.circuitSafeLoadPercent);
        setInputValue('custom-format-width', data.customFormatWidth ?? DEFAULTS.customFormatWidth);
        setInputValue('custom-format-height', data.customFormatHeight ?? DEFAULTS.customFormatHeight);
        setOverlayFormat(data.overlayFormat ?? DEFAULTS.overlayFormat);

        const curvedWallMode = document.getElementById('curved-wall-mode');
        if (curvedWallMode) {
            curvedWallMode.checked = data.curvedWallMode === true || data.curvedWallMode === 'true';
        }
        setInputValue('cabinet-angle-preset', data.cabinetAnglePreset ?? DEFAULTS.cabinetAnglePreset);
        setInputValue('custom-cabinet-angle-degrees', data.customCabinetAngleDegrees ?? DEFAULTS.customCabinetAngleDegrees);
        updateCurvedWallControls(getState());

        const autoCalculate = document.getElementById('auto-calculate-resolution');
        if (autoCalculate) {
            autoCalculate.checked = data.autoCalculateResolution !== false
                && data.autoCalculateResolution !== 'false';
        }

        document.querySelectorAll('[name="display-mode"]').forEach((input) => {
            input.checked = normalizeDisplayType(data.displayType ?? DEFAULTS.displayType) === input.value;
        });

        closeAdvancedView();
        syncAdvFromHidden();
        applyAutoCalculateMode();
        toggleCustomFormatFields();
        updateAll();
    }

    async function loadProjectFile(file) {
        const gate = window.OkamiCommercialGate;
        const footer = document.querySelector('.led-config-footer');
        if (gate?.checkLedWallLoadAllowed) {
            const check = await gate.checkLedWallLoadAllowed();
            if (!check.allowed) {
                gate.showUpgradeNotice?.('Load Project requires a Standard license or higher.', footer);
                return;
            }
        }

        const ProjectIO = window.OkamiLedWallCalculator?.ProjectIO;
        if (!ProjectIO?.readProjectFile) {
            return;
        }

        try {
            const project = await ProjectIO.readProjectFile(file);
            applyProjectInputs(project.inputs);
        } catch (error) {
            window.alert(error.message || 'Could not load project file.');
        }
    }

    function getWallPhysicalAspect(state) {
        if (state.physicalWidthMM && state.physicalHeightMM) {
            return state.physicalWidthMM / state.physicalHeightMM;
        }
        return Calc.calculatePhysicalSize(state).aspectRatio;
    }

    function formatQuickCabinetLabel(cabinetPreset) {
        const presetLabels = {
            '500x500': '500x500',
            '500x1000': '500x1000',
            custom: 'Custom'
        };

        return presetLabels[cabinetPreset] || 'Custom';
    }

    function formatFeetInches(feetDecimal) {
        const totalInches = Math.round(feetDecimal * 12);
        const feet = Math.floor(totalInches / 12);
        const inches = totalInches % 12;
        return `${feet}' ${inches}"`;
    }

    function formatPixelPair(width, height, useGrouping) {
        const w = useGrouping ? width.toLocaleString() : String(width);
        const h = useGrouping ? height.toLocaleString() : String(height);
        return `${w} × ${h}`;
    }

    function formatQuickPitchLabel(state) {
        if (isCustomSpacingDisplayType(state.displayType)) {
            const h = readCustomSpacingHorizontal();
            const v = readCustomSpacingVertical();
            return `${h} × ${v} mm`;
        }

        const pitchPreset = document.getElementById('pitch-preset')?.value || 'custom';
        if (pitchPreset !== 'custom') {
            return `P${pitchPreset}`;
        }

        const matched = findMatchingPitch(state.pixelPitchMM);
        if (matched) {
            return `P${matched}`;
        }

        return `${(Math.round(state.pixelPitchMM * 10) / 10).toFixed(1)}mm`;
    }

    function updateAdvancedSettings(state) {
        const isCustomSpacing = isCustomSpacingDisplayType(state.displayType);
        const spacingSettings = document.getElementById('led-custom-spacing-settings');

        if (spacingSettings) {
            spacingSettings.hidden = !isCustomSpacing;
        }

        document.querySelectorAll('[name="display-mode"]').forEach((input) => {
            input.checked = normalizeDisplayType(state.displayType) === input.value;
        });

        toggleCustomFormatFields();
        applyAutoCalculateMode();
        updateCurvedWallControls(state);
    }

    function updateQuickStartUI(state) {
        const cabinetPreset = getCabinetPreset();
        const pitchPreset = document.getElementById('pitch-preset')?.value || 'custom';

        document.querySelectorAll('[data-cabinet]').forEach((button) => {
            const isActive = cabinetPreset === button.dataset.cabinet;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });

        document.querySelectorAll('[data-pitch]').forEach((button) => {
            const isActive = pitchPreset === button.dataset.pitch;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });

        const morePitches = document.getElementById('led-more-pitches');
        if (morePitches) {
            morePitches.open = isExtendedPitchPreset(pitchPreset);
        }

        const customPitchField = document.getElementById('led-custom-pitch-field');
        if (customPitchField) {
            customPitchField.hidden = pitchPreset !== 'custom' || isCustomSpacingDisplayType(state.displayType);
        }

        syncPanelCountInputs(state);
        syncAdvFromHidden();
        updateAdvancedSettings(state);
        updateCurvedWallControls(state);

        const cabinetLabel = formatQuickCabinetLabel(cabinetPreset);
        const pitchLabel = formatQuickPitchLabel(state);
        setText('summary-cabinet-pitch', `${cabinetLabel} • ${pitchLabel}`);
        setText('summary-cabinet-resolution', formatPixelPair(state.pixelWidth, state.pixelHeight, false));
        setText('summary-wall-resolution', formatPixelPair(state.totalPixelWidth, state.totalPixelHeight, true));
        setText('summary-processor-ports', String(state.portsRequired));
        setText(
            'summary-physical-size',
            `${formatFeetInches(state.physicalWidthFt)} × ${formatFeetInches(state.physicalHeightFt)}`
        );
        setText(
            'summary-port-utilization',
            formatSafePortUtilizationLabel(state)
        );
        setText('summary-power', Number.isFinite(state.circuitsRequired)
            ? `${state.circuitsRequired.toLocaleString()} circuits · ${formatWatts(state.totalEstimatedWatts)}`
            : formatWatts(state.totalEstimatedWatts));
    }

    function formatSafePortUtilizationLabel(state) {
        const threshold = state.portFillThreshold ?? DEFAULTS.portFillThreshold;
        const safePeak = state.peakSafeCapacityUsedPercent ?? state.peakPortUtilizationPercent;
        if (!Number.isFinite(safePeak)) {
            return '—';
        }
        return `${safePeak.toFixed(0)}% of ${threshold}% safe`;
    }

    function applyProjectSummaryCard(key, card) {
        if (!card) {
            return;
        }

        const titleEl = document.getElementById(`result-${key}-title`);
        if (titleEl && card.title) {
            titleEl.textContent = card.title;
        }

        setText(`result-${key}-primary`, card.primary || '—');
        setMultilineText(`result-${key}-secondary`, card.lines || []);

        const badgeEl = document.getElementById(`result-${key}-badge`);
        if (badgeEl) {
            if (card.badge) {
                badgeEl.textContent = card.badge;
                badgeEl.hidden = false;
            } else {
                badgeEl.textContent = '';
                badgeEl.hidden = true;
            }
        }
    }

    function updateProjectSummary(state, inputs) {
        const Summary = window.OkamiLedWallCalculator?.WallProjectSummary;
        if (!Summary?.buildProjectSummary) {
            return;
        }

        const resolvedInputs = inputs || gatherInputs();
        const summary = Summary.buildProjectSummary(state, resolvedInputs);
        applyProjectSummaryCard('wall', summary.wall);

        const curvedCard = document.getElementById('result-curved-wall-card');
        const showCurvedSummary = readCurvedWallMode() === true;

        if (showCurvedSummary && summary.curvedWall) {
            if (curvedCard) {
                curvedCard.hidden = false;
            }
            applyProjectSummaryCard('curved-wall', summary.curvedWall);
        } else if (curvedCard) {
            curvedCard.hidden = true;
        }

        applyProjectSummaryCard('resolution', summary.resolution);
        applyProjectSummaryCard('processor', summary.processor);
        applyProjectSummaryCard('power', summary.power);
        applyProjectSummaryCard('content-fit', summary.contentFit);

        const fitCard = document.getElementById('result-content-fit-card');
        if (fitCard) {
            fitCard.classList.toggle('led-result-card--inactive', !summary.contentFit?.configured);
        }

        updateOverlayDebug(state);
    }

    function formatWatts(watts) {
        const Summary = window.OkamiLedWallCalculator?.WallProjectSummary;
        if (Summary?.formatWatts) {
            return Summary.formatWatts(watts);
        }
        if (!Number.isFinite(watts)) {
            return '—';
        }
        return `${Math.round(watts).toLocaleString()} W`;
    }

    function setMultilineText(id, lines) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = (lines || []).filter(Boolean).join('\n');
        }
    }

    function isCabinetNumbersEnabled() {
        const checkbox = document.getElementById('show-cabinet-numbers');
        return checkbox ? checkbox.checked : DEFAULTS.showCabinetNumbers;
    }

    function isDesktopPreview() {
        return window.matchMedia('(min-width: 1200px)').matches;
    }

    function getLabelTier(cellWidth) {
        if (cellWidth > 60) {
            return LABEL_TIER.LARGE;
        }
        if (cellWidth >= 35) {
            return LABEL_TIER.MEDIUM;
        }
        if (cellWidth >= 20) {
            return LABEL_TIER.SMALL;
        }
        return LABEL_TIER.TINY;
    }

    function getAxisMarkers(count) {
        const markers = [1];
        for (let value = 5; value <= count; value += 5) {
            markers.push(value);
        }
        return markers;
    }

    function shouldShowCabinetNumber(cabinetNumber, tier) {
        if (tier === LABEL_TIER.LARGE || tier === LABEL_TIER.MEDIUM) {
            return true;
        }
        if (tier === LABEL_TIER.SMALL) {
            return cabinetNumber % 5 === 0;
        }
        return false;
    }

    function getTierFontSize(tier, cellWidth) {
        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        const minFont = isMobile ? 8 : 10;

        if (tier === LABEL_TIER.LARGE) {
            return Math.max(minFont, Math.min(18, cellWidth * 0.28));
        }
        if (tier === LABEL_TIER.MEDIUM) {
            return Math.max(minFont, Math.min(13, cellWidth * 0.26));
        }
        if (tier === LABEL_TIER.SMALL) {
            return Math.max(minFont, Math.min(11, cellWidth * 0.3));
        }
        return 0;
    }

    function renderAxisLabels(colAxis, rowAxis, state) {
        if (!colAxis || !rowAxis) {
            return;
        }

        colAxis.textContent = '';
        rowAxis.textContent = '';

        getAxisMarkers(state.panelsWide).forEach((col) => {
            const label = document.createElement('span');
            label.className = 'led-preview-axis-label led-preview-axis-label--col';
            label.textContent = String(col);
            label.style.left = `${((col - 0.5) / state.panelsWide) * 100}%`;
            colAxis.appendChild(label);
        });

        getAxisMarkers(state.panelsTall).forEach((row) => {
            const label = document.createElement('span');
            label.className = 'led-preview-axis-label led-preview-axis-label--row';
            label.textContent = String(row);
            label.style.top = `${((row - 0.5) / state.panelsTall) * 100}%`;
            rowAxis.appendChild(label);
        });
    }

    function hideCabinetTooltip() {
        const tooltip = document.getElementById('led-cabinet-tooltip');
        if (tooltip) {
            tooltip.hidden = true;
        }
    }

    function showCabinetTooltip(cell, cabinetNumber, row, col) {
        const tooltip = document.getElementById('led-cabinet-tooltip');
        const stage = document.getElementById('led-preview-measure');
        if (!tooltip || !stage || !isDesktopPreview()) {
            return;
        }

        tooltip.innerHTML = `
            <strong>Cabinet ${cabinetNumber}</strong>
            <span>Column ${col + 1}</span>
            <span>Row ${row + 1}</span>
        `;
        tooltip.hidden = false;

        const stageRect = stage.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;
        let left = cellRect.left - stageRect.left + cellRect.width / 2 - tooltipWidth / 2;
        let top = cellRect.top - stageRect.top - tooltipHeight - 8;

        if (top < 4) {
            top = cellRect.bottom - stageRect.top + 8;
        }

        left = Math.max(4, Math.min(left, stageRect.width - tooltipWidth - 4));
        top = Math.max(4, Math.min(top, stageRect.height - tooltipHeight - 4));

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    function bindPreviewHover(wall) {
        if (!wall || previewHoverBound) {
            return;
        }

        previewHoverBound = true;
        wall.addEventListener('mouseover', (event) => {
            const cell = event.target.closest('.led-cabinet');
            if (!cell || !wall.contains(cell)) {
                return;
            }

            const index = parseInt(cell.dataset.index, 10);
            if (!Number.isFinite(index)) {
                return;
            }

            const currentState = getState();
            const row = Math.floor(index / currentState.panelsWide);
            const col = index % currentState.panelsWide;
            showCabinetTooltip(cell, index + 1, row, col);
        });

        wall.addEventListener('mouseout', (event) => {
            const cell = event.target.closest('.led-cabinet');
            const related = event.relatedTarget;
            if (cell && related && cell.contains(related)) {
                return;
            }
            hideCabinetTooltip();
        });

        wall.addEventListener('mouseleave', hideCabinetTooltip);
    }

    function updateOverlayDebug(state) {
        const debugEl = document.getElementById('led-overlay-debug');
        if (!debugEl) {
            return;
        }

        if (!OVERLAY_DEBUG || !state.overlay) {
            debugEl.hidden = true;
            return;
        }

        debugEl.hidden = false;
        setText('debug-wall-pixels', `${state.totalPixelWidth} × ${state.totalPixelHeight}`);
        setText('debug-wall-ratio', state.aspectRatio.toFixed(3));
        setText('debug-overlay-pixels', `${state.overlay.overlayPixelWidth} × ${state.overlay.overlayPixelHeight}`);
        setText('debug-overlay-ratio', state.overlay.overlayAspectRatio.toFixed(3));
        setText('debug-overlay-position', `left ${state.overlay.leftPercent.toFixed(2)}% · top ${state.overlay.topPercent.toFixed(2)}%`);
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    }

    function renderTopViewCurvePanel(state) {
        const panel = document.getElementById('led-top-view-panel');
        const diagramEl = document.getElementById('led-top-view-diagram');
        const measurementsEl = document.getElementById('led-curved-wall-measurements-list');
        if (!panel || !diagramEl) {
            return;
        }

        const showPanel = readCurvedWallMode() === true && !state.curvedWallAngleExceeded;

        const panelKey = showPanel
            ? [
                state.panelsWide,
                state.cabinetAngleDegrees,
                state.surfaceWidthFeet,
                state.chordWidthFeet,
                state.curveDepthFeet,
                state.radiusFeet,
                state.totalCurveAngle
            ].join('|')
            : 'hidden';

        panel.hidden = !showPanel;
        document.querySelector('.led-preview-panel')?.classList.toggle('led-preview-panel--curved-open', showPanel);
        requestAnimationFrame(() => {
            applyPreviewScaleOnly(state);
        });
        if (!showPanel) {
            if (lastTopViewPanelKey !== panelKey) {
                diagramEl.innerHTML = '';
                if (measurementsEl) {
                    measurementsEl.innerHTML = '';
                }
                lastTopViewPanelKey = panelKey;
            }
            return;
        }

        if (panelKey === lastTopViewPanelKey) {
            return;
        }
        lastTopViewPanelKey = panelKey;

        const Summary = window.OkamiLedWallCalculator?.WallProjectSummary;
        if (measurementsEl && Summary?.buildCurvedWallMeasurementRows) {
            measurementsEl.innerHTML = Summary.buildCurvedWallMeasurementRows(state)
                .map((row) => (
                    `<div class="led-curved-wall-measurement">`
                    + `<dt>${row.label}</dt>`
                    + `<dd>${row.value}</dd>`
                    + `</div>`
                ))
                .join('');
        }

        const diagram = computeTopViewCurveDiagram(state);
        const viewBox = computeTopViewCurveViewBox(diagram, 0.08);
        const labels = Summary?.buildCurvedWallDiagramLabels?.(state) || null;
        diagramEl.innerHTML = buildTopViewCurveSvg(diagram, viewBox, labels);
    }

    function renderPreview(state) {
        const wall = document.getElementById('led-preview-wall');
        if (!wall) {
            return;
        }

        hideCabinetTooltip();

        const contentKey = computePreviewContentKey(state);
        const layout = computePreviewIntrinsicLayout(state);
        const contentChanged = contentKey !== lastPreviewContentKey;

        wall.style.width = `${layout.wallWidth}px`;
        wall.style.height = `${layout.wallHeight}px`;

        const totalPanels = state.totalPanels;
        const wallContainer = document.getElementById('led-preview-wall-container');
        const colAxis = document.getElementById('led-preview-col-axis');
        const rowAxis = document.getElementById('led-preview-row-axis');

        if (wallContainer) {
            wallContainer.classList.toggle('has-axis-labels', layout.showAxisLabels);
        }
        if (colAxis) {
            colAxis.hidden = !layout.showAxisLabels;
        }
        if (rowAxis) {
            rowAxis.hidden = !layout.showAxisLabels;
        }
        if (layout.showAxisLabels) {
            renderAxisLabels(colAxis, rowAxis, state);
        }

        const existingCells = wall.querySelectorAll('.led-cabinet');
        if (existingCells.length !== totalPanels) {
            wall.textContent = '';
            const fragment = document.createDocumentFragment();

            for (let i = 0; i < totalPanels; i++) {
                fragment.appendChild(createCabinetCell(i));
            }

            const overlayLayer = document.createElement('div');
            overlayLayer.className = 'led-overlay-layer';
            overlayLayer.id = 'led-overlay-layer';
            overlayLayer.hidden = true;
            fragment.appendChild(overlayLayer);
            wall.appendChild(fragment);
            lastPreviewContentKey = '';
        }

        applyCabinetArtToWall(wall, state);

        wall.style.display = 'grid';
        wall.style.gridTemplateColumns = `repeat(${state.panelsWide}, ${state.cabinetWidthMM}fr)`;
        wall.style.gridTemplateRows = `repeat(${state.panelsTall}, ${state.cabinetHeightMM}fr)`;

        const numbersEnabled = isCabinetNumbersEnabled();
        const cells = wall.querySelectorAll('.led-cabinet');
        cells.forEach((cell, index) => {
            const row = Math.floor(index / state.panelsWide);
            const col = index % state.panelsWide;
            const cabinetNumber = index + 1;
            const label = cell.querySelector('.led-cabinet-label');
            cell.classList.remove('dimmed');
            cell.dataset.index = String(index);
            cell.dataset.row = String(row);
            cell.dataset.col = String(col);
            cell.classList.remove('label-large', 'label-medium', 'label-small');

            if (label && numbersEnabled && shouldShowCabinetNumber(cabinetNumber, layout.tier)) {
                label.textContent = String(cabinetNumber);
                label.style.fontSize = `${getTierFontSize(layout.tier, layout.cellWidth)}px`;
                if (layout.tier === LABEL_TIER.LARGE) {
                    cell.classList.add('label-large');
                } else if (layout.tier === LABEL_TIER.MEDIUM) {
                    cell.classList.add('label-medium');
                } else {
                    cell.classList.add('label-small');
                }
            } else if (label) {
                label.textContent = '';
                label.style.fontSize = '';
            }
        });

        if (contentChanged) {
            lastPreviewContentKey = contentKey;
        }

        bindPreviewHover(wall);
        renderOverlayLayer(state);
        applyPreviewScaleOnly(state);
    }

    function renderOverlayLayer(state) {
        const layer = document.getElementById('led-overlay-layer');
        if (!layer) {
            return;
        }

        if (!state.overlay) {
            layer.hidden = true;
            layer.innerHTML = '';
            return;
        }

        const { leftPercent, topPercent, widthPercent, heightPercent } = state.overlay;
        const Summary = window.OkamiLedWallCalculator?.WallProjectSummary;
        const labelText = Summary?.getOverlayReferenceLabel?.(state.overlayFormatLabel, 'preview')
            || `${state.overlayFormatLabel || '16:9'} Content Area`;

        layer.hidden = false;
        layer.innerHTML = `
            <div class="led-overlay-frame" style="left:${leftPercent}%;top:${topPercent}%;width:${widthPercent}%;height:${heightPercent}%;">
                <span class="led-overlay-label">${labelText}</span>
            </div>
        `;
    }

    function updateAll() {
        if (isAutoCalculateEnabled()) {
            syncAutoPixelResolution();
        }

        const state = getState();
        const inputs = gatherInputs();
        updateQuickStartUI(state);
        updateProjectSummary(state, inputs);
        updateCurvedWallBadge(state);
        renderTopViewCurvePanel(state);
        renderPreview(state);
    }

    function updateCurvedWallBadge(state) {
        const badge = document.getElementById('led-curved-wall-badge');
        if (badge) {
            badge.hidden = !(state.curvedWallMode === true && state.curvedWallActive === true);
        }
    }

    function runOverlayTests() {
        const targetRatio = 16 / 9;
        const tests = [
            {
                name: '500x500 P2.9 10x6',
                wallWidth: 1680,
                wallHeight: 1008,
                expectWidth: 1680,
                expectHeight: 945,
                expectUnusedHorizontal: 0,
                expectUnusedVertical: 63,
                expectTopPercent: 3.125
            },
            {
                name: '500x1000 P2.9 19x5',
                wallWidth: 3192,
                wallHeight: 1680,
                expectWidth: 2987,
                expectHeight: 1680,
                expectUnusedHorizontal: 205,
                expectUnusedVertical: 0,
                expectTopPercent: 0
            },
            {
                name: '500x1000 custom spacing 3.9×7.8 19×5',
                wallWidth: 2432,
                wallHeight: 640,
                expectWidth: 1138,
                expectHeight: 640,
                expectUnusedHorizontal: 1294,
                expectUnusedVertical: 0,
                expectTopPercent: 0,
                expectLeftPercent: 26.604605263157895
            }
        ];

        const failures = [];
        let passed = 0;
        tests.forEach((test) => {
            const overlay = calculateContentOverlay({
                totalPixelWidth: test.wallWidth,
                totalPixelHeight: test.wallHeight,
                targetRatio
            });
            const expectLeftPercent = ((test.wallWidth - test.expectWidth) / 2 / test.wallWidth) * 100;
            const ok = overlay.overlayPixelWidth === test.expectWidth
                && overlay.overlayPixelHeight === test.expectHeight
                && overlay.unusedHorizontal === test.expectUnusedHorizontal
                && overlay.unusedVertical === test.expectUnusedVertical
                && Math.abs(overlay.topPercent - test.expectTopPercent) < 0.001
                && Math.abs(overlay.leftPercent - (test.expectLeftPercent ?? expectLeftPercent)) < 0.001;

            if (ok) {
                passed += 1;
            } else {
                failures.push(test.name);
            }
        });

        if (failures.length && OVERLAY_DEBUG) {
            window.__ledOverlayTestFailures = failures;
        }

        return passed === tests.length;
    }

    window.initLedWallVisualizer = initLedWallVisualizer;
    window.runLedOverlayTests = runOverlayTests;

    document.addEventListener('DOMContentLoaded', () => {
        initLedWallVisualizer();
        if (new URLSearchParams(window.location.search).has('test')) {
            runOverlayTests();
        }
    });
})();
