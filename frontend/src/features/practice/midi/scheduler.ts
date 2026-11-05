import type { Program, ProgramEvent } from "../engine/program.ts";
import { TempoMap } from "../engine/tempo.ts";
import type { NoteEvent } from "../engine/types.ts";
import { DEFAULT_LOOKAHEAD_MS, type MidiOut } from "./midiOut.ts";
import { CC, type Clock, type Ticker } from "./types.ts";

export interface MetronomeSettings {
    enabled: boolean;
    channel: number;
    downbeatNote: number;
    beatNote: number;
    velocity: number;
}

export type CueEvent = Extract<ProgramEvent, { kind: "cue" }>;

export interface SchedulerHooks {
    /** An expected (graded) note, with its exact time. Called ahead of time. */
    onExpect?: (note: NoteEvent, timeMs: number, iteration: number) => void;
    /** Cursor position; called when it's due. */
    onCue?: (cue: CueEvent, timeMs: number) => void;
    /** A loop pass ended (called when due). */
    onIterationEnd?: (iteration: number, endTimeMs: number) => void;
    /** The end of the program (or segment) was reached (called when due). */
    onEnd?: (endTimeMs: number) => void;
    /** Every tick, after dispatching. */
    onTick?: (now: number) => void;
}

export interface SchedulerOptions {
    clock: Clock;
    out: MidiOut;
    ticker: Ticker;
    /** How far ahead notes are sent (default 120 ms). */
    lookaheadMs?: number;
    /** How far ahead expected notes are announced (should cover the grading tolerance). */
    expectLookaheadMs?: number;
    /** How far ahead note-offs are sent. 0 = only when due (wait-for-me mode). */
    offLookaheadMs?: number;
    getMetronome: () => MetronomeSettings;
    /** Channels to silence on panic even if unused so far (e.g. thru). */
    getPanicChannels?: () => number[];
    hooks?: SchedulerHooks;
}

export interface StartOptions {
    /** Beat to start from (default: the program start, including the count-in). */
    fromBeat?: number;
    /** Beat to stop at, exclusive (default: the program end). */
    toBeat?: number;
    /** When `fromBeat` sounds. Defaults to now + lookahead + 50 ms, so a preceding panic lands first. */
    startTime?: number;
    /** Restart at beat 0 (without count-in) every time the end is reached. */
    loop?: boolean;
}

interface PendingOff {
    time: number;
    channel: number;
    midi: number;
}

interface DueCallback {
    time: number;
    fire: () => void;
}

const CLICK_LENGTH_MS = 50;
const EPS = 1e-9;

/**
 * Plays a Program on a MidiOut. Ticked by a Ticker (a Web Worker in the browser, manual in tests).
 * Every tick, events up to `lookaheadMs` ahead are sent with absolute timestamps.
 */
export class Scheduler {
    private readonly clock: Clock;
    private readonly out: MidiOut;
    private readonly ticker: Ticker;
    private readonly lookaheadMs: number;
    private readonly expectLookaheadMs: number;
    private readonly offLookaheadMs: number;
    private readonly getMetronome: () => MetronomeSettings;
    private readonly getPanicChannels: () => number[];
    hooks: SchedulerHooks;

    private program: Program | null = null;
    private tempoMap = new TempoMap([]);
    private factor = 1;
    private anchorBeat = 0;
    private anchorTime = 0;
    private mainIndex = 0;
    private expectIndex = 0;
    private toBeat = 0;
    private loop = false;
    private iteration = 0;
    private dispatching = false;
    private ticking = false;
    private endScheduled = false;
    private offs: PendingOff[] = [];
    private due: DueCallback[] = [];

    constructor(options: SchedulerOptions) {
        this.clock = options.clock;
        this.out = options.out;
        this.ticker = options.ticker;
        this.lookaheadMs = options.lookaheadMs ?? DEFAULT_LOOKAHEAD_MS;
        this.expectLookaheadMs = Math.max(this.lookaheadMs, options.expectLookaheadMs ?? this.lookaheadMs);
        this.offLookaheadMs = options.offLookaheadMs ?? this.lookaheadMs;
        this.getMetronome = options.getMetronome;
        this.getPanicChannels = options.getPanicChannels ?? (() => []);
        this.hooks = options.hooks ?? {};
    }

    load(program: Program): void {
        this.program = program;
        this.tempoMap = new TempoMap(program.tempoChanges);
    }

    get isPlaying(): boolean {
        return this.dispatching;
    }

    get tempoFactor(): number {
        return this.factor;
    }

    get currentIteration(): number {
        return this.iteration;
    }

    get lookahead(): number {
        return this.lookaheadMs;
    }

    start(options: StartOptions = {}): void {
        if (!this.program) throw new Error("No program loaded.");
        const now = this.clock.now();
        const fromBeat = options.fromBeat ?? this.program.startBeat;
        this.anchorBeat = fromBeat;
        this.anchorTime = options.startTime ?? now + this.lookaheadMs + 50;
        this.toBeat = options.toBeat ?? this.program.endBeat;
        // An empty program can't loop.
        this.loop = (options.loop ?? false) && this.toBeat > 0 + EPS;
        this.mainIndex = this.firstIndexAtOrAfter(fromBeat);
        this.expectIndex = this.mainIndex;
        this.iteration = 0;
        this.endScheduled = false;
        this.dispatching = true;
        this.ensureTicking();
        this.tick();
    }

    /** Stops playback. With panic (default), silences every channel used. */
    stop(panic = true): void {
        this.dispatching = false;
        this.endScheduled = false;
        this.offs = [];
        this.due = [];
        this.stopTicking();
        if (panic) this.panic();
    }

    panic(): void {
        const metronome = this.getMetronome();
        this.out.panic([metronome.channel, ...this.getPanicChannels()], this.lookaheadMs);
    }

    /** Sends every pending note-off now (wait-for-me: the next step started). */
    releaseHeldNotes(time = this.clock.now()): void {
        const offs = this.offs;
        this.offs = [];
        for (const off of offs) this.out.noteOff(off.channel, off.midi, time);
    }

    /** Changes the tempo live: the current position is kept, everything after it uses the new tempo. */
    setTempoFactor(factor: number): void {
        if (!(factor > 0)) return;
        if (this.dispatching) {
            const now = this.clock.now();
            if (now > this.anchorTime) {
                this.anchorBeat = this.beatAt(now);
                this.anchorTime = now;
            }
        }
        this.factor = factor;
    }

    /** Absolute time of a beat with the current anchor and tempo. */
    timeAt(beat: number): number {
        return this.anchorTime + this.tempoMap.durationMs(this.anchorBeat, beat, this.factor);
    }

    /** Beat at an absolute time with the current anchor and tempo. */
    beatAt(time: number): number {
        return this.tempoMap.beatAfter(this.anchorBeat, time - this.anchorTime, this.factor);
    }

    /** Milliseconds per quarter note at a beat, with the current tempo factor. */
    msPerBeatAt(beat: number): number {
        return 60000 / (this.tempoMap.bpmAt(beat) * this.factor);
    }

    tick(): void {
        const now = this.clock.now();
        if (this.dispatching && this.program) this.dispatch(now);
        this.flushOffs(now + this.offLookaheadMs);
        this.fireDue(now);
        this.hooks.onTick?.(now);
        if (!this.dispatching && this.offs.length === 0 && this.due.length === 0) this.stopTicking();
    }

    private dispatch(now: number): void {
        const program = this.program!;
        const events = program.events;
        const horizon = now + this.lookaheadMs;

        for (let guard = 0; guard < 4; guard++) {
            // Expected notes are announced further ahead, so early presses can be matched.
            const expectHorizon = now + this.expectLookaheadMs;
            while (this.expectIndex < events.length) {
                const event = events[this.expectIndex];
                if (event.beat >= this.toBeat - EPS) break;
                if (event.kind !== "expect") {
                    this.expectIndex++;
                    continue;
                }
                const time = this.timeAt(event.beat);
                if (time > expectHorizon) break;
                this.hooks.onExpect?.(event.note, time, this.iteration);
                this.expectIndex++;
            }

            while (this.mainIndex < events.length) {
                const event = events[this.mainIndex];
                if (event.beat >= this.toBeat - EPS) break;
                const time = this.timeAt(event.beat);
                if (time > horizon) return;
                this.flushOffs(time);
                if (event.kind !== "expect") this.dispatchEvent(event, time);
                this.mainIndex++;
            }

            // Reached the end of the program or segment.
            const endTime = this.timeAt(this.toBeat);
            if (endTime > horizon || this.endScheduled) return;

            if (this.loop) {
                const finished = this.iteration;
                this.flushOffs(endTime - 2);
                this.out.allNotesOffAt(endTime - 1, [this.getMetronome().channel]);
                this.addDue(endTime, () => this.hooks.onIterationEnd?.(finished, endTime));
                this.iteration++;
                this.anchorBeat = 0;
                this.anchorTime = endTime;
                this.mainIndex = this.firstIndexAtOrAfter(0);
                this.expectIndex = this.mainIndex;
                continue;
            }

            this.endScheduled = true;
            this.dispatching = false;
            this.addDue(endTime, () => this.hooks.onEnd?.(endTime));
            return;
        }
    }

    private dispatchEvent(event: ProgramEvent, time: number): void {
        switch (event.kind) {
            case "note": {
                // A pending note-off for the same key would cut this note: send it just before.
                const sameKey = this.offs.findIndex((off) => off.channel === event.channel && off.midi === event.midi);
                if (sameKey !== -1) {
                    const [off] = this.offs.splice(sameKey, 1);
                    this.out.noteOff(off.channel, off.midi, Math.min(off.time, time - 1));
                }
                if (event.cc1 !== null) this.out.controlChangeIfChanged(event.channel, CC.modulation, event.cc1, time - 1);
                this.out.noteOn(event.channel, event.midi, event.velocity, time);
                const lengthMs = this.tempoMap.durationMs(event.beat, event.beat + event.durationBeats, this.factor);
                this.addOff({ time: time + Math.max(10, lengthMs - 2), channel: event.channel, midi: event.midi });
                break;
            }
            case "click": {
                const metronome = this.getMetronome();
                if (!event.countIn && !metronome.enabled) break;
                const note = event.downbeat ? metronome.downbeatNote : metronome.beatNote;
                this.out.noteOn(metronome.channel, note, metronome.velocity, time);
                this.addOff({ time: time + CLICK_LENGTH_MS, channel: metronome.channel, midi: note });
                break;
            }
            case "cue":
                this.addDue(time, () => this.hooks.onCue?.(event, time));
                break;
            case "expect":
                break;
        }
    }

    private firstIndexAtOrAfter(beat: number): number {
        const events = this.program?.events ?? [];
        let index = 0;
        while (index < events.length && events[index].beat < beat - EPS) index++;
        return index;
    }

    private addOff(off: PendingOff): void {
        let i = this.offs.length;
        while (i > 0 && this.offs[i - 1].time > off.time) i--;
        this.offs.splice(i, 0, off);
    }

    private flushOffs(until: number): void {
        while (this.offs.length > 0 && this.offs[0].time <= until) {
            const off = this.offs.shift()!;
            this.out.noteOff(off.channel, off.midi, off.time);
        }
    }

    private addDue(time: number, fire: () => void): void {
        let i = this.due.length;
        while (i > 0 && this.due[i - 1].time > time) i--;
        this.due.splice(i, 0, { time, fire });
    }

    private fireDue(now: number): void {
        while (this.due.length > 0 && this.due[0].time <= now) {
            this.due.shift()!.fire();
        }
    }

    private ensureTicking(): void {
        if (this.ticking) return;
        this.ticking = true;
        this.ticker.start(() => this.tick());
    }

    private stopTicking(): void {
        if (!this.ticking) return;
        this.ticking = false;
        this.ticker.stop();
    }
}
