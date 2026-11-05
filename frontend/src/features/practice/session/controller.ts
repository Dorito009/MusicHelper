// Runs one practice session: wires input, scheduler, grading and the score display together.
// Plain TypeScript; the React player subscribes to its snapshot.

import { buildProgram } from "../engine/program.ts";
import type { LoopRange, ScoreConfig } from "../engine/scoreConfig.ts";
import { buildSteps } from "../engine/steps.ts";
import { buildTimeline, measureAtBeat } from "../engine/timeline.ts";
import { PlayAlongGrader, type GradeEvent } from "../engine/grader.ts";
import { computeStats } from "../engine/stats.ts";
import type { NoteEvent, ParsedScore, ScoreTimeline } from "../engine/types.ts";
import { WaitModeEngine } from "../engine/waitMode.ts";
import { Scheduler, type CueEvent, type MetronomeSettings } from "../midi/scheduler.ts";
import type { Clock, InputSource, MidiInputEvent, Ticker } from "../midi/types.ts";
import type { MidiOut } from "../midi/midiOut.ts";
import type { SessionMode, SessionStats } from "../storage/db.ts";
import { measureLabel, waitModeStats } from "./results.ts";

/** What the controller needs from the rendered score. */
export interface ScoreDisplay {
    moveCursor(measureIndex: number, onsetInMeasure: number): void;
    hideCursor(): void;
    colorNote(note: NoteEvent, color: "good" | "timing" | "bad" | "expected" | null): void;
    clearColors(): void;
    /** A red marker for an extra note. */
    markExtra?(measureIndex: number, onsetInMeasure: number): void;
    clearMarkers?(): void;
}

export type RunStatus = "idle" | "countIn" | "playing" | "waiting" | "finished";

export type KeyFeedback = "good" | "timing" | "bad";

export interface RunResult {
    mode: SessionMode;
    startedAt: number;
    durationMs: number;
    bpm: number;
    measureRange: LoopRange | null;
    rhythmOnly: boolean;
    stats: SessionStats;
    /** Loop pass this result belongs to (0 for a single run). */
    iteration: number;
}

export interface ControllerSnapshot {
    status: RunStatus;
    mode: SessionMode;
    /** Pitches I should play now (wait-for-me: the current step). */
    expectedPitches: number[];
    /** Pitches of the current step already pressed. */
    pressedPitches: number[];
    /** Keys I'm holding. */
    heldKeys: number[];
    /** Recent feedback per key, for the on-screen piano. */
    keyFeedback: Record<number, KeyFeedback>;
    counts: { correct: number; wrong: number; good: number; timing: number; missed: number; extra: number };
    /** Written measure under the cursor. */
    currentMeasure: number | null;
    iteration: number;
    lastResult: RunResult | null;
}

export interface RunOptions {
    mode: SessionMode;
    /** Quarter-note BPM the run starts at. */
    bpm: number;
    countInBars: number;
    rhythmOnly: boolean;
    loop: LoopRange | null;
    toleranceMs: number;
    latencyOffsetMs: number;
}

export interface ControllerDeps {
    clock: Clock;
    out: MidiOut;
    input: InputSource;
    ticker: Ticker;
    getMetronome: () => MetronomeSettings;
    getPanicChannels: () => number[];
    /** Called when a run (or a loop pass) is finished, with its results. */
    onResult?: (result: RunResult) => void;
    /** Called when the cursor moves, so the page can scroll. */
    onCursor?: (measureIndex: number, onsetInMeasure: number) => void;
}

const FEEDBACK_MS = 600;

const EMPTY_COUNTS = { correct: 0, wrong: 0, good: 0, timing: 0, missed: 0, extra: 0 };

export class PracticeController {
    private readonly deps: ControllerDeps;
    private display: ScoreDisplay | null = null;
    private score: ParsedScore | null = null;
    private config: ScoreConfig | null = null;
    private timeline: ScoreTimeline | null = null;
    private options: RunOptions | null = null;
    private scheduler: Scheduler | null = null;
    private wait: WaitModeEngine | null = null;
    private grader: PlayAlongGrader | null = null;
    /** Loop passes (or the single run) waiting for their last windows to close. */
    private toSettle: Array<{ iteration: number; endTime: number; final: boolean }> = [];
    private passStartTimes = new Map<number, number>();
    private startedAt = 0;
    /** Wait-for-me: start beat of the segment that's playing. */
    private segmentFrom = -Infinity;
    private startTime = 0;
    private readonly held = new Set<number>();
    private feedback = new Map<number, { kind: KeyFeedback; until: number }>();
    private snapshot: ControllerSnapshot = {
        status: "idle",
        mode: "wait",
        expectedPitches: [],
        pressedPitches: [],
        heldKeys: [],
        keyFeedback: {},
        counts: { ...EMPTY_COUNTS },
        currentMeasure: null,
        iteration: 0,
        lastResult: null,
    };
    private readonly listeners = new Set<() => void>();
    private readonly unsubscribeInput: () => void;
    private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(deps: ControllerDeps) {
        this.deps = deps;
        this.unsubscribeInput = deps.input.subscribe((event) => this.onInput(event));
    }

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    getSnapshot = (): ControllerSnapshot => this.snapshot;

    private update(patch: Partial<ControllerSnapshot>): void {
        this.snapshot = { ...this.snapshot, ...patch };
        for (const listener of this.listeners) listener();
    }

    setDisplay(display: ScoreDisplay | null): void {
        this.display = display;
    }

    setScore(score: ParsedScore, config: ScoreConfig): void {
        const running = this.snapshot.status !== "idle" && this.snapshot.status !== "finished";
        this.score = score;
        this.config = config;
        if (running) this.stop();
    }

    get isRunning(): boolean {
        return this.snapshot.status === "countIn" || this.snapshot.status === "playing" || this.snapshot.status === "waiting";
    }

    get runOptions(): RunOptions | null {
        return this.options;
    }

    /** Starts a run from the loop start (or the beginning). Stops any current run first. */
    start(options: RunOptions): void {
        if (!this.score || !this.config) return;
        this.stop();
        this.options = options;
        const order = options.loop ? range(options.loop.from, options.loop.to) : undefined;
        this.timeline = buildTimeline(this.score, order);
        this.display?.clearColors();
        this.startedAt = Date.now();
        this.update({ mode: options.mode, counts: { ...EMPTY_COUNTS }, iteration: 0, keyFeedback: {} });

        if (options.mode === "wait") this.startWait(options);
        else this.startPlayAlong(options);
    }

    /** Stops the run and silences everything. */
    stop(): void {
        if (this.scheduler) {
            this.scheduler.stop(true);
            this.scheduler = null;
        } else {
            this.deps.out.panic(this.deps.getPanicChannels());
        }
        this.wait = null;
        this.grader = null;
        this.toSettle = [];
        if (this.snapshot.status !== "idle" && this.snapshot.status !== "finished") {
            this.update({ status: "idle", expectedPitches: [], pressedPitches: [] });
        }
    }

    panic(): void {
        this.scheduler?.releaseHeldNotes();
        this.deps.out.panic(this.deps.getPanicChannels());
    }

    /** Live tempo change (quarter-note BPM). */
    setBpm(bpm: number): void {
        if (!this.options || !this.timeline) return;
        this.options = { ...this.options, bpm };
        this.scheduler?.setTempoFactor(bpm / this.timeline.baseTempo);
    }

    dispose(): void {
        this.stop();
        this.unsubscribeInput();
        if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
        this.listeners.clear();
    }

    private createScheduler(offLookaheadMs?: number, expectLookaheadMs?: number): Scheduler {
        const scheduler = new Scheduler({
            clock: this.deps.clock,
            out: this.deps.out,
            ticker: this.deps.ticker,
            offLookaheadMs,
            expectLookaheadMs,
            getMetronome: this.deps.getMetronome,
            getPanicChannels: this.deps.getPanicChannels,
        });
        scheduler.load(buildProgram(this.timeline!, this.config!, { countInBars: this.options?.mode === "play" ? this.options.countInBars : 0 }));
        scheduler.setTempoFactor(this.options!.bpm / this.timeline!.baseTempo);
        return scheduler;
    }

    // ---------- Wait for me ----------

    private startWait(options: RunOptions): void {
        const timeline = this.timeline!;
        const steps = buildSteps(timeline, this.config!);
        this.wait = new WaitModeEngine(steps, timeline.totalBeats);
        // Note-offs only when due, so a stale note-off can't cut the next step's notes.
        this.scheduler = this.createScheduler(0);
        this.scheduler.hooks = {
            onCue: (cue) => this.onCue(cue),
            onEnd: () => this.onWaitSegmentEnd(),
        };
        void options;
        this.startTime = this.deps.clock.now();
        const intro = this.wait.initialSegment();
        if (intro.toBeat > intro.fromBeat) {
            this.segmentFrom = -Infinity;
            this.update({ status: "playing" });
            this.scheduler.start({ fromBeat: intro.fromBeat, toBeat: intro.toBeat, startTime: this.deps.clock.now() + 50 });
        } else {
            this.enterWaiting();
        }
    }

    private enterWaiting(): void {
        const wait = this.wait;
        if (!wait) return;
        const step = wait.current;
        if (!step) {
            this.finishWait();
            return;
        }
        this.moveCursor(step.measureIndex, step.onsetInMeasure);
        for (const note of step.expected) this.display?.colorNote(note, "expected");
        this.update({ status: "waiting", expectedPitches: step.expectedPitches, pressedPitches: wait.pressedPitches });
    }

    private onWaitSegmentEnd(): void {
        if (!this.wait) return;
        if (this.wait.finished) this.finishWait();
        else if (this.snapshot.status === "playing") this.enterWaiting();
    }

    private onWaitPress(pitch: number): void {
        const wait = this.wait;
        if (!wait || !this.scheduler) return;
        const step = wait.current;
        const result = wait.press(pitch);
        const counts = { ...this.snapshot.counts };
        if (result.kind === "wrong") {
            counts.wrong++;
            this.flash(pitch, "bad");
            this.update({ counts });
            return;
        }
        if (result.kind !== "correct" || !step) return;
        counts.correct++;
        this.flash(pitch, "good");
        for (const note of step.expected) if (note.midi === pitch) this.display?.colorNote(note, "good");

        if (!result.completed) {
            this.update({ counts, pressedPitches: wait.pressedPitches });
            return;
        }

        // The next step starts: cut what's still sounding, then play this step's accompaniment
        // and any app-only steps at tempo until my next step.
        this.scheduler.releaseHeldNotes();
        const { segment } = result;
        const next = wait.current;
        this.update({ counts, pressedPitches: [], expectedPitches: next?.expectedPitches ?? [] });
        if (next) {
            const autoSteps = wait.autoStepsAfter(result.completedStep);
            if (autoSteps.length === 0) this.enterWaiting();
            else this.update({ status: "playing" });
        }
        if (segment.toBeat > segment.fromBeat) {
            this.segmentFrom = segment.fromBeat;
            this.scheduler.start({ fromBeat: segment.fromBeat, toBeat: segment.toBeat, startTime: this.deps.clock.now() });
        } else if (!next) {
            this.finishWait();
        }
    }

    private finishWait(): void {
        const wait = this.wait;
        if (!wait || !this.options || !this.timeline) return;
        const stats = waitModeStats(wait.stats(), this.timeline);
        const result: RunResult = {
            mode: "wait",
            startedAt: this.startedAt,
            durationMs: this.deps.clock.now() - this.startTime,
            bpm: this.options.bpm,
            measureRange: this.options.loop,
            rhythmOnly: false,
            stats,
            iteration: this.snapshot.iteration,
        };
        this.wait = null;
        this.display?.hideCursor();
        this.update({ status: "finished", lastResult: result, expectedPitches: [], pressedPitches: [] });
        this.deps.onResult?.(result);
    }

    // ---------- Play along ----------

    private startPlayAlong(options: RunOptions): void {
        this.grader = new PlayAlongGrader({ toleranceMs: options.toleranceMs, rhythmOnly: options.rhythmOnly });
        this.toSettle = [];
        this.passStartTimes = new Map();
        // Expected notes are announced early enough to match presses up to the tolerance early.
        const scheduler = this.createScheduler(undefined, options.toleranceMs + 160);
        this.scheduler = scheduler;
        scheduler.hooks = {
            onExpect: (note, time, iteration) => {
                if (!this.grader) return;
                if (!this.passStartTimes.has(iteration)) this.passStartTimes.set(iteration, time);
                this.applyGrades(this.grader.addExpected(note, time, iteration));
            },
            onCue: (cue) => this.onCue(cue),
            onTick: (now) => this.onPlayTick(now),
            onIterationEnd: (iteration, endTime) => {
                this.toSettle.push({ iteration, endTime, final: false });
                this.display?.clearColors();
                this.display?.clearMarkers?.();
                this.update({ iteration: iteration + 1, counts: { ...EMPTY_COUNTS } });
            },
            onEnd: (endTime) => {
                this.toSettle.push({ iteration: scheduler.currentIteration, endTime, final: true });
            },
            keepAlive: () => this.toSettle.length > 0,
        };
        this.startTime = this.deps.clock.now();
        scheduler.start({ loop: options.loop !== null });
        this.update({ status: scheduler.beatAt(this.deps.clock.now()) < 0 ? "countIn" : "playing" });
    }

    private onPlayTick(now: number): void {
        const grader = this.grader;
        const scheduler = this.scheduler;
        if (!grader || !scheduler || !this.options) return;
        if (this.snapshot.status === "countIn" && scheduler.beatAt(now) >= 0) this.update({ status: "playing" });
        this.applyGrades(grader.advance(now));

        const tolerance = this.options.toleranceMs;
        const ready = this.toSettle.filter((item) => now > item.endTime + tolerance + 10);
        for (const item of ready) {
            this.toSettle.splice(this.toSettle.indexOf(item), 1);
            if (item.final) this.applyGrades(grader.finish());
            this.settlePass(item.iteration, item.final);
        }

        const expectedPitches = grader.upcoming(now - 60, now + 200);
        if (expectedPitches.join() !== this.snapshot.expectedPitches.join()) this.update({ expectedPitches });
    }

    private settlePass(iteration: number, final: boolean): void {
        if (!this.grader || !this.options || !this.timeline) return;
        const timeline = this.timeline;
        const events = this.grader.events.filter((e) => e.iteration === iteration);
        const stats = computeStats(events, this.options.toleranceMs, (m) => measureLabel(timeline, m));
        const passStart = this.passStartTimes.get(iteration) ?? this.startTime;
        const now = this.deps.clock.now();
        const result: RunResult = {
            mode: "play",
            startedAt: Date.now() - (now - passStart),
            durationMs: now - passStart,
            bpm: this.options.bpm,
            measureRange: this.options.loop,
            rhythmOnly: this.options.rhythmOnly,
            stats,
            iteration,
        };
        if (final) {
            this.scheduler?.stop(true);
            this.scheduler = null;
            this.grader = null;
            this.display?.hideCursor();
            this.update({ status: "finished", lastResult: result, expectedPitches: [] });
        } else {
            this.update({ lastResult: result });
        }
        this.deps.onResult?.(result);
    }

    private onPlayPress(pitch: number, eventTime: number): void {
        const grader = this.grader;
        const scheduler = this.scheduler;
        const timeline = this.timeline;
        if (!grader || !scheduler || !timeline || !this.options) return;
        // Latency compensation: when I actually played it.
        const time = eventTime - this.options.latencyOffsetMs;
        const iteration = scheduler.iterationAt(time);
        let beat = scheduler.beatAt(time);
        if (beat < 0 && iteration < scheduler.currentIteration) beat += timeline.totalBeats;
        const measure = measureAtBeat(timeline, Math.max(0, beat));
        const events = grader.press(pitch, time, measure?.measureIndex ?? 0, iteration);
        if (events.length === 0) this.pendingExtraPosition.set(time, { measureIndex: measure?.measureIndex ?? 0, onset: Math.max(0, beat - (measure?.startBeats ?? 0)) });
        this.applyGrades(events);
    }

    /** Where unmatched presses happened, so an "extra" can be marked in the score. */
    private pendingExtraPosition = new Map<number, { measureIndex: number; onset: number }>();

    private applyGrades(events: GradeEvent[]): void {
        if (events.length === 0) return;
        const counts = { ...this.snapshot.counts };
        for (const event of events) {
            const current = event.iteration === this.snapshot.iteration;
            if (event.kind === "hit") {
                const color = event.grade === "good" ? "good" : "timing";
                for (const note of event.expected.notes) this.display?.colorNote(note, color);
                this.flash(event.expected.midi, event.grade === "good" ? "good" : "timing");
                if (current) {
                    if (event.grade === "good") counts.good++;
                    else counts.timing++;
                }
            } else if (event.kind === "missed") {
                for (const note of event.expected.notes) this.display?.colorNote(note, "bad");
                if (current) counts.missed++;
            } else {
                const position = this.pendingExtraPosition.get(event.time);
                this.pendingExtraPosition.delete(event.time);
                if (position && current) this.display?.markExtra?.(position.measureIndex, position.onset);
                if (current) counts.extra++;
            }
        }
        this.update({ counts });
    }

    // ---------- Shared ----------

    private onCue(cue: CueEvent): void {
        // Wait-for-me: the cursor only follows app-only steps; it already moved on from the step I completed.
        if (this.wait && (this.snapshot.status === "waiting" || cue.beat <= this.segmentFrom + 1e-9)) return;
        this.moveCursor(cue.measureIndex, cue.onsetInMeasure);
    }

    private moveCursor(measureIndex: number, onsetInMeasure: number): void {
        this.display?.moveCursor(measureIndex, onsetInMeasure);
        this.deps.onCursor?.(measureIndex, onsetInMeasure);
        if (this.snapshot.currentMeasure !== measureIndex) this.update({ currentMeasure: measureIndex });
    }

    private onInput(event: MidiInputEvent): void {
        if (event.type === "noteon") {
            this.held.add(event.note);
            this.update({ heldKeys: [...this.held] });
            if (this.wait && (this.snapshot.status === "waiting" || this.snapshot.status === "playing")) this.onWaitPress(event.note);
            else if (this.grader && (this.snapshot.status === "playing" || this.snapshot.status === "countIn")) this.onPlayPress(event.note, event.time);
        } else if (event.type === "noteoff") {
            this.held.delete(event.note);
            this.update({ heldKeys: [...this.held] });
        }
    }

    private flash(pitch: number, kind: KeyFeedback): void {
        this.feedback.set(pitch, { kind, until: this.deps.clock.now() + FEEDBACK_MS });
        this.publishFeedback();
        if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
        this.feedbackTimer = setTimeout(() => this.publishFeedback(), FEEDBACK_MS + 20);
    }

    private publishFeedback(): void {
        const now = this.deps.clock.now();
        const keyFeedback: Record<number, KeyFeedback> = {};
        for (const [pitch, { kind, until }] of this.feedback) {
            if (until > now) keyFeedback[pitch] = kind;
            else this.feedback.delete(pitch);
        }
        this.update({ keyFeedback });
    }
}

function range(from: number, to: number): number[] {
    const result: number[] = [];
    for (let i = Math.min(from, to); i <= Math.max(from, to); i++) result.push(i);
    return result;
}
