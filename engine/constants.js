(function(global) {
    'use strict';

    const MM_PER_FOOT = 304.8;

    const DISPLAY_TYPE_STANDARD = 'standard';
    const DISPLAY_TYPE_CUSTOM_SPACING = 'customSpacing';
    /** @deprecated Saved projects may still use this value — treated as customSpacing */
    const DISPLAY_TYPE_TRANSPARENT_LEGACY = 'transparent';

    const DEFAULTS = {
        cabinetPreset: '500x500',
        pitchPreset: '3.9',
        displayType: DISPLAY_TYPE_STANDARD,
        cabinetWidthMM: 500,
        cabinetHeightMM: 500,
        pixelPitchMM: 3.9,
        meshPitchHorizontalMM: 2.6,
        meshPitchVerticalMM: 2.6,
        panelsWide: 10,
        panelsTall: 6,
        pixelWidth: 128,
        pixelHeight: 128,
        autoCalculateResolution: true,
        overlayFormat: '16:9',
        portCapacity: 650000,
        portFillThreshold: 90,
        customFormatWidth: 32,
        customFormatHeight: 9,
        showCabinetNumbers: false,
        wattsPerPanel: 200,
        circuitAmperage: 20,
        circuitVoltage: 120,
        circuitSafeLoadPercent: 80,
        curvedWallMode: false,
        cabinetAnglePreset: '0',
        customCabinetAngleDegrees: 2.5
    };

    const CABINET_ANGLE_PRESETS = [
        { value: '0', label: '0° Flat', degrees: 0 },
        { value: '2.5', label: '2.5°', degrees: 2.5 },
        { value: '5', label: '5°', degrees: 5 },
        { value: 'custom', label: 'Custom', degrees: null }
    ];

    const COMMON_PITCHES = [1.9, 2.6, 2.9, 3.9, 5.9];
    const EXTENDED_PITCHES = [1.2, 1.5, 1.8, 2.0, 2.5, 4.8];
    const PITCH_PRESETS = [...COMMON_PITCHES, ...EXTENDED_PITCHES];

    const CABINET_PRESETS = {
        '500x500': { width: 500, height: 500, label: '500mm × 500mm' },
        '500x1000': { width: 500, height: 1000, label: '500mm × 1000mm' }
    };

    const RESOLUTION_PRESETS = {
        '500x500': {
            1.9: { pixelWidth: 263, pixelHeight: 263 },
            2.6: { pixelWidth: 192, pixelHeight: 192 },
            2.9: { pixelWidth: 168, pixelHeight: 168 },
            3.9: { pixelWidth: 128, pixelHeight: 128 },
            4.8: { pixelWidth: 104, pixelHeight: 104 },
            5.9: { pixelWidth: 84, pixelHeight: 84 }
        },
        '500x1000': {
            1.9: { pixelWidth: 263, pixelHeight: 526 },
            2.6: { pixelWidth: 192, pixelHeight: 384 },
            2.9: { pixelWidth: 168, pixelHeight: 336 },
            3.9: { pixelWidth: 128, pixelHeight: 256 },
            4.8: { pixelWidth: 104, pixelHeight: 208 },
            5.9: { pixelWidth: 84, pixelHeight: 168 }
        }
    };

    const STANDARD_RATIOS = [
        { label: '16:9', value: 16 / 9 },
        { label: '21:9', value: 21 / 9 },
        { label: '4:3', value: 4 / 3 },
        { label: '1:1', value: 1 },
        { label: '2.35:1', value: 2.35 },
        { label: '3:1', value: 3 }
    ];

    const OVERLAY_FORMAT_RATIOS = {
        '16:9': 16 / 9,
        '4:3': 4 / 3,
        '1:1': 1,
        '21:9': 21 / 9,
        '2.35:1': 2.35,
        '3:1': 3
    };

    const MIN_PANEL_COUNT = 1;
    const MAX_PANEL_COUNT = 500;
    const MAX_TOTAL_CURVE_ANGLE = 180;

    global.OkamiLedWallCalculator = global.OkamiLedWallCalculator || {};
    global.OkamiLedWallCalculator.Constants = {
        MM_PER_FOOT,
        DISPLAY_TYPE_STANDARD,
        DISPLAY_TYPE_CUSTOM_SPACING,
        DISPLAY_TYPE_TRANSPARENT_LEGACY,
        DEFAULTS,
        COMMON_PITCHES,
        EXTENDED_PITCHES,
        PITCH_PRESETS,
        CABINET_PRESETS,
        RESOLUTION_PRESETS,
        STANDARD_RATIOS,
        OVERLAY_FORMAT_RATIOS,
        MIN_PANEL_COUNT,
        MAX_PANEL_COUNT,
        MAX_TOTAL_CURVE_ANGLE,
        CABINET_ANGLE_PRESETS
    };
})(typeof window !== 'undefined' ? window : globalThis);
