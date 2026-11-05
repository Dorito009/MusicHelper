import type { MidiOut } from "../midi/midiOut.ts";
import type { Clock, InputSource } from "../midi/types.ts";

export const CALIBRATION_CLICKS = 16;
export const CALIBRATION_BPM = 90;
export const CALIBRATION_IGNORED_TAPS = 4;

export interface CalibrationResult {
    /** Median of tap minus click, in ms. Positive = taps arrive late. */
    medianMs: number;
    /** Standard deviation of the offsets used. */
    spreadMs: number;
    /** Taps used (after ignoring the first ones). */
    taps: number;
}

/**
 * Matches each tap to the nearest click (within half a beat), ignores the first taps
 * while the player settles in, and returns the median offset and its spread.
 */
export function computeCalibration(clickTimes: number[], tapTimes: number[], ignoreFirst = CALIBRATION_IGNORED_TAPS): CalibrationResult | null {
    if (clickTimes.length < 2) return null;
    const halfBeat = (clickTimes[1] - clickTimes[0]) / 2;
    const offsets: number[] = [];
    for (const tap of tapTimes.slice(ignoreFirst)) {
        let nearest = clickTimes[0];
        for (const click of clickTimes) if (Math.abs(tap - click) < Math.abs(tap - nearest)) nearest = click;
        const offset = tap - nearest;
        if (Math.abs(offset) <= halfBeat) offsets.push(offset);
    }
    if (offsets.length === 0) return null;
    const sorted = [...offsets].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    const mean = offsets.reduce((a, b) => a + b, 0) / offsets.length;
    const spread = Math.sqrt(offsets.reduce((sum, o) => sum + (o - mean) ** 2, 0) / offsets.length);
    return { medianMs: Math.round(median), spreadMs: Math.round(spread), taps: offsets.length };
}

export interface CalibrationClick {
    channel: number;
    downbeatNote: number;
    beatNote: number;
    velocity: number;
}

export type CalibrationState =
    | { phase: "idle" }
    | { phase: "running"; clicksPlayed: number; taps: number }
    | { phase: "done"; result: CalibrationResult | null; taps: number };

/** Plays 16 clicks at 90 BPM through the MIDI click channel and records taps on any key. */
export class CalibrationRun {
    private readonly clock: Clock;
    private readonly out: MidiOut;
    private readonly input: InputSource;
    private clickTimes: number[] = [];
    private taps: number[] = [];
    private unsubscribe: (() => void) | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;
    private state: CalibrationState = { phase: "idle" };
    private readonly onChange: (state: CalibrationState) => void;

    constructor(clock: Clock, out: MidiOut, input: InputSource, onChange: (state: CalibrationState) => void) {
        this.clock = clock;
        this.out = out;
        this.input = input;
        this.onChange = onChange;
    }

    start(click: CalibrationClick): void {
        this.stop();
        const beatMs = 60000 / CALIBRATION_BPM;
        const first = this.clock.now() + 800;
        this.clickTimes = Array.from({ length: CALIBRATION_CLICKS }, (_, i) => first + i * beatMs);
        this.taps = [];
        this.clickTimes.forEach((time, i) => {
            const note = i % 4 === 0 ? click.downbeatNote : click.beatNote;
            this.out.noteOn(click.channel, note, click.velocity, time);
            this.out.noteOff(click.channel, note, time + 50);
        });
        this.unsubscribe = this.input.subscribe((event) => {
            if (event.type !== "noteon") return;
            this.taps.push(event.time);
            this.emitRunning();
        });
        this.state = { phase: "running", clicksPlayed: 0, taps: 0 };
        this.onChange(this.state);
        const end = this.clickTimes[this.clickTimes.length - 1] + beatMs / 2;
        this.timer = setInterval(() => {
            if (this.clock.now() >= end) this.finish();
            else this.emitRunning();
        }, 100);
    }

    private emitRunning(): void {
        if (this.state.phase !== "running") return;
        const now = this.clock.now();
        this.state = { phase: "running", clicksPlayed: this.clickTimes.filter((t) => t <= now).length, taps: this.taps.length };
        this.onChange(this.state);
    }

    private finish(): void {
        const result = computeCalibration(this.clickTimes, this.taps);
        const taps = this.taps.length;
        this.cleanup();
        this.state = { phase: "done", result, taps };
        this.onChange(this.state);
    }

    stop(): void {
        if (this.state.phase === "running") this.out.panic();
        this.cleanup();
        this.state = { phase: "idle" };
    }

    private cleanup(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }
}
