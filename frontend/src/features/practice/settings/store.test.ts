import { describe, expect, it } from "vitest";
import { DEFAULT_PRACTICE_SETTINGS, PRACTICE_SETTINGS_KEY, sanitizePracticeSettings } from "./store.ts";

describe("practice settings", () => {
    it("uses its own localStorage key", () => {
        expect(PRACTICE_SETTINGS_KEY).toBe("music-helper:practice:settings");
    });

    it("fills missing fields from the defaults", () => {
        const result = sanitizePracticeSettings({ latency: { offsetMs: 42 } });
        expect(result.latency).toEqual({ offsetMs: 42, lastCalibration: null });
        expect(result.midi).toEqual(DEFAULT_PRACTICE_SETTINGS.midi);
    });

    it("falls back to defaults for an invalid section and keeps the valid ones", () => {
        const result = sanitizePracticeSettings({
            grading: { toleranceMs: "banana", rhythmOnly: true },
            midi: { ...DEFAULT_PRACTICE_SETTINGS.midi, thruChannel: 5 },
        });
        expect(result.grading).toEqual(DEFAULT_PRACTICE_SETTINGS.grading);
        expect(result.midi.thruChannel).toBe(5);
    });

    it("rejects out-of-range values", () => {
        expect(sanitizePracticeSettings({ midi: { ...DEFAULT_PRACTICE_SETTINGS.midi, metronomeChannel: 17 } }).midi.metronomeChannel).toBe(10);
        expect(sanitizePracticeSettings(null)).toEqual(DEFAULT_PRACTICE_SETTINGS);
    });
});
