import { describe, expect, it } from "vitest";
import pianoChords from "./__fixtures__/piano-chords.musicxml?raw";
import { parseMusicXml } from "./musicxml.ts";
import { buildTimeline } from "./timeline.ts";
import { defaultScoreConfig, type ScoreConfig } from "./scoreConfig.ts";
import { buildSteps } from "./steps.ts";
import { WaitModeEngine } from "./waitMode.ts";
import { buildProgram } from "./program.ts";
import { FakeClock, ManualTicker, RecordingSink, runFor } from "../midi/fakes.ts";
import { MidiOut } from "../midi/midiOut.ts";
import { Scheduler } from "../midi/scheduler.ts";

const score = parseMusicXml(pianoChords);
const timeline = buildTimeline(score);

function config(rh: "me" | "app", lh: "me" | "app"): ScoreConfig {
    const c = defaultScoreConfig(score, { firstAccompanimentChannel: 2, reservedChannels: [1, 10] });
    c.staves["P1:1"] = { role: rh, channel: 2, dynamics: "velocity" };
    c.staves["P1:2"] = { role: lh, channel: 3, dynamics: "velocity" };
    return c;
}

describe("buildSteps", () => {
    it("groups new notes by onset and splits mine from the accompaniment", () => {
        const steps = buildSteps(timeline, config("me", "app"));
        expect(steps.map((s) => [s.beat, s.expectedPitches, s.accompaniment.map((n) => n.midi)])).toEqual([
            [0, [72, 76, 79], [48]],
            [2, [74], []],
            [3, [76], []],
            [4, [77], [43]],
            [6, [69], [41, 45]],
        ]);
    });

    it("leaves out 'off' staves", () => {
        const c = config("me", "app");
        c.staves["P1:2"].role = "off";
        expect(buildSteps(timeline, c).flatMap((s) => s.accompaniment)).toEqual([]);
    });
});

describe("WaitModeEngine", () => {
    it("advances once every pitch of a chord is pressed, in any order", () => {
        const engine = new WaitModeEngine(buildSteps(timeline, config("me", "app")), timeline.totalBeats);
        expect(engine.current?.beat).toBe(0);
        expect(engine.press(79)).toMatchObject({ kind: "correct", completed: false });
        expect(engine.press(72)).toMatchObject({ kind: "correct", completed: false });
        const done = engine.press(76);
        expect(done).toMatchObject({ kind: "correct", completed: true, segment: { fromBeat: 0, toBeat: 2 }, finished: false });
        expect(engine.current?.beat).toBe(2);
    });

    it("counts wrong notes without advancing, and ignores repeats of a pitch already pressed", () => {
        const engine = new WaitModeEngine(buildSteps(timeline, config("me", "app")), timeline.totalBeats);
        expect(engine.press(60).kind).toBe("wrong");
        engine.press(72);
        expect(engine.press(72).kind).toBe("repeat");
        expect(engine.press(61).kind).toBe("wrong");
        expect(engine.current?.beat).toBe(0);
        const stats = engine.stats();
        expect(stats).toMatchObject({ wrong: 2, correct: 1, stepsDone: 0, userSteps: 5, expectedNotes: 7 });
        expect(stats.wrongByMeasure.get(0)).toBe(2);
    });

    it("plays accompaniment-only steps on their own until my next step", () => {
        // I play the left hand; the right hand's D and E (beats 2 and 3) are app-only steps.
        const engine = new WaitModeEngine(buildSteps(timeline, config("app", "me")), timeline.totalBeats);
        expect(engine.initialSegment()).toEqual({ fromBeat: 0, toBeat: 0 });
        const result = engine.press(48);
        expect(result).toMatchObject({ completed: true, segment: { fromBeat: 0, toBeat: 4 } });
        if (!result.completed) throw new Error("expected completion");
        expect(engine.autoStepsAfter(result.completedStep).map((s) => s.beat)).toEqual([2, 3]);
        expect(engine.current?.beat).toBe(4);
    });

    it("finishes after the last step and reports the remaining segment to the end", () => {
        const engine = new WaitModeEngine(buildSteps(timeline, config("me", "app")), timeline.totalBeats);
        for (const pitch of [72, 76, 79, 74, 76, 77]) engine.press(pitch);
        const last = engine.press(69);
        expect(last).toMatchObject({ completed: true, finished: true, segment: { fromBeat: 6, toBeat: 8 } });
        expect(engine.finished).toBe(true);
        expect(engine.press(60).kind).toBe("ignored");
        expect(engine.stats()).toMatchObject({ correct: 7, wrong: 0, stepsDone: 5 });
    });

    it("starts with an intro when the app plays first", () => {
        const c = config("me", "app");
        // Make the first right-hand chord "off" so the first step with my notes is beat 2.
        const steps = buildSteps(timeline, c).map((s) => (s.beat === 0 ? { ...s, expected: [], expectedPitches: [] } : s));
        const engine = new WaitModeEngine(steps, timeline.totalBeats);
        expect(engine.initialSegment()).toEqual({ fromBeat: 0, toBeat: 2 });
    });
});

describe("wait-mode accompaniment through the scheduler", () => {
    it("sounds the step's accompaniment when completed, plays app-only steps at tempo, and cuts notes at the next step", () => {
        const c = config("app", "me");
        const program = buildProgram(timeline, c, { countInBars: 0 });
        const clock = new FakeClock(10_000);
        const sink = new RecordingSink(clock);
        const out = new MidiOut(clock, () => sink);
        const ticker = new ManualTicker();
        const scheduler = new Scheduler({
            clock, out, ticker, offLookaheadMs: 0,
            getMetronome: () => ({ enabled: false, channel: 10, downbeatNote: 76, beatNote: 77, velocity: 100 }),
        });
        scheduler.load(program);
        const engine = new WaitModeEngine(buildSteps(timeline, c), timeline.totalBeats);

        // I press C3 at t=10000: the RH chord (beat 0) sounds now, D at +1000 ms, E at +1500 ms (120 BPM).
        const result = engine.press(48);
        if (!result.completed) throw new Error("expected completion");
        scheduler.start({ fromBeat: result.segment.fromBeat, toBeat: result.segment.toBeat, startTime: clock.now() });
        runFor(clock, ticker, 1200);
        expect(sink.noteOns().map((m) => [m.data[1], m.time])).toEqual([[72, 10000], [76, 10000], [79, 10000], [74, 11000]]);
        // The chord ended after its notated half note (1000 ms).
        expect(sink.noteOffs().filter((m) => m.data[1] === 72).map((m) => m.time)).toEqual([10998]);

        // I complete the next step early (t=11200), while D is still sounding: D is cut now.
        sink.clear();
        const next = engine.press(43);
        if (!next.completed) throw new Error("expected completion");
        scheduler.releaseHeldNotes();
        expect(sink.noteOffs().map((m) => [m.data[1], m.time])).toEqual([[74, 11200]]);
        scheduler.start({ fromBeat: next.segment.fromBeat, toBeat: next.segment.toBeat, startTime: clock.now() });
        expect(sink.noteOns().map((m) => [m.data[1], m.time])).toEqual([[77, 11200]]);
    });
});
