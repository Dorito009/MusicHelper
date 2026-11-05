import { describe, expect, it } from "vitest";
import { computeCalibration } from "./calibration.ts";

const beat = 60000 / 90;
const clicks = Array.from({ length: 16 }, (_, i) => 1000 + i * beat);

describe("computeCalibration", () => {
    it("ignores the first 4 taps and returns the median offset and spread", () => {
        // First four taps are way off (settling in), the rest are 40 ms late with ±10 ms jitter.
        const taps = clicks.map((c, i) => c + (i < 4 ? 250 : 40 + (i % 2 ? 10 : -10)));
        const result = computeCalibration(clicks, taps);
        expect(result).toEqual({ medianMs: 40, spreadMs: 10, taps: 12 });
    });

    it("handles early taps and skipped beats", () => {
        const taps = clicks.filter((_, i) => i !== 9).map((c) => c - 25);
        expect(computeCalibration(clicks, taps)).toMatchObject({ medianMs: -25, taps: 11 });
    });

    it("returns null when there's nothing to measure", () => {
        expect(computeCalibration(clicks, clicks.slice(0, 4))).toBeNull();
    });
});
