import { describe, expect, it } from "vitest";
import type { Program } from "../engine/program.ts";
import { buildProgram } from "../engine/program.ts";
import { parseMusicXml } from "../engine/musicxml.ts";
import { buildTimeline } from "../engine/timeline.ts";
import { defaultScoreConfig } from "../engine/scoreConfig.ts";
import pianoChords from "../engine/__fixtures__/piano-chords.musicxml?raw";
import { FakeClock, FakeInputSource, ManualTicker, RecordingSink, runFor } from "./fakes.ts";
import { MidiOut } from "./midiOut.ts";
import { Scheduler, type MetronomeSettings } from "./scheduler.ts";
import { connectThru } from "./thru.ts";
import { parseMidiMessage } from "./parse.ts";
import { ComputerKeyboardInput } from "./keyboardInput.ts";

const METRONOME: MetronomeSettings = { enabled: false, channel: 10, downbeatNote: 76, beatNote: 77, velocity: 100 };

function note(beat: number, midi: number, durationBeats = 1, channel = 2): Program["events"][number] {
    return { kind: "note", beat, durationBeats, channel, midi, velocity: 90, cc1: null, noteId: `${beat}-${midi}` };
}

function setup(program: Program, options: { metronome?: Partial<MetronomeSettings>; offLookaheadMs?: number } = {}) {
    const clock = new FakeClock(1000);
    const sink = new RecordingSink(clock);
    const out = new MidiOut(clock, () => sink);
    const ticker = new ManualTicker();
    const metronome = { ...METRONOME, ...options.metronome };
    const scheduler = new Scheduler({ clock, out, ticker, lookaheadMs: 120, getMetronome: () => metronome, offLookaheadMs: options.offLookaheadMs });
    scheduler.load(program);
    return { clock, sink, out, ticker, scheduler, metronome };
}

// 120 BPM: one beat = 500 ms.
const fourQuarters: Program = {
    events: [note(0, 60), note(1, 62), note(2, 64), note(3, 65)],
    startBeat: 0,
    endBeat: 4,
    tempoChanges: [{ beats: 0, bpm: 120 }],
};

describe("Scheduler timing", () => {
    it("sends notes with absolute timestamps, only within the lookahead", () => {
        const { clock, sink, ticker, scheduler } = setup(fourQuarters);
        scheduler.start({ startTime: 1100 });
        // At t=1000 only the note at 1100 is inside the 120 ms window.
        expect(sink.noteOns().map((m) => m.time)).toEqual([1100]);
        runFor(clock, ticker, 2000);
        expect(sink.noteOns().map((m) => [m.data[1], m.time])).toEqual([[60, 1100], [62, 1600], [64, 2100], [65, 2600]]);
        // Every message was sent before its timestamp, but no more than the lookahead (+ one tick) early.
        for (const m of sink.noteOns()) {
            expect(m.time - m.sentAt).toBeGreaterThanOrEqual(0);
            expect(m.time - m.sentAt).toBeLessThanOrEqual(120);
        }
    });

    it("ends each note just before its notated end", () => {
        const { clock, sink, ticker, scheduler } = setup(fourQuarters);
        scheduler.start({ startTime: 1100 });
        runFor(clock, ticker, 3000);
        expect(sink.noteOffs().map((m) => [m.data[1], m.time])).toEqual([[60, 1598], [62, 2098], [64, 2598], [65, 3098]]);
    });

    it("defaults the start to after the lookahead, so a panic before it can't cut the first note", () => {
        const { sink, scheduler } = setup(fourQuarters);
        scheduler.start();
        expect(sink.noteOns()[0]?.time ?? 1170).toBe(1170);
    });

    it("applies a tempo change live, without moving the current position", () => {
        const { clock, sink, ticker, scheduler } = setup(fourQuarters);
        scheduler.start({ startTime: 1000 });
        runFor(clock, ticker, 500); // now = 1500, beat 1 (already sent at 1500)
        scheduler.setTempoFactor(2); // 240 BPM from here: 250 ms per beat
        runFor(clock, ticker, 1000);
        expect(sink.noteOns().map((m) => m.time)).toEqual([1000, 1500, 1750, 2000]);
        expect(scheduler.beatAt(1500)).toBeCloseTo(1);
        expect(scheduler.beatAt(2000)).toBeCloseTo(3);
    });

    it("follows tempo changes written in the score", () => {
        const program: Program = { ...fourQuarters, tempoChanges: [{ beats: 0, bpm: 120 }, { beats: 2, bpm: 60 }] };
        const { clock, sink, ticker, scheduler } = setup(program);
        scheduler.start({ startTime: 1000 });
        runFor(clock, ticker, 4000);
        expect(sink.noteOns().map((m) => m.time)).toEqual([1000, 1500, 2000, 3000]);
    });

    it("plays the metronome on its own channel with separate downbeat and beat notes", () => {
        const program: Program = {
            events: [
                { kind: "click", beat: -2, downbeat: true, countIn: true },
                { kind: "click", beat: -1, downbeat: false, countIn: true },
                { kind: "click", beat: 0, downbeat: true, countIn: false },
                { kind: "click", beat: 1, downbeat: false, countIn: false },
            ],
            startBeat: -2,
            endBeat: 2,
            tempoChanges: [{ beats: 0, bpm: 120 }],
        };
        const on = setup(program, { metronome: { enabled: true } });
        on.scheduler.start({ startTime: 1000 });
        runFor(on.clock, on.ticker, 2000);
        expect(on.sink.noteOns().map((m) => [m.data[0] & 0x0f, m.data[1], m.time])).toEqual([
            [9, 76, 1000], [9, 77, 1500], [9, 76, 2000], [9, 77, 2500],
        ]);

        // With the metronome off, only the count-in clicks sound.
        const off = setup(program, { metronome: { enabled: false } });
        off.scheduler.start({ startTime: 1000 });
        runFor(off.clock, off.ticker, 2000);
        expect(off.sink.noteOns().map((m) => m.time)).toEqual([1000, 1500]);
    });

    it("sends CC1 before the note when dynamics go out as CC1", () => {
        const program: Program = {
            events: [{ ...note(0, 60), cc1: 50 } as Program["events"][number], { ...note(1, 62), cc1: 50 } as Program["events"][number], { ...note(2, 64), cc1: 96 } as Program["events"][number]],
            startBeat: 0,
            endBeat: 3,
            tempoChanges: [{ beats: 0, bpm: 120 }],
        };
        const { clock, sink, ticker, scheduler } = setup(program);
        scheduler.start({ startTime: 1000 });
        runFor(clock, ticker, 1500);
        // CC1 is only re-sent when the value changes.
        expect(sink.controlChanges(1).map((m) => [m.data[2], m.time])).toEqual([[50, 1000], [96, 1999]]);
    });
});

describe("Scheduler loops", () => {
    it("restarts at the loop start and silences the boundary with a timestamped All Notes Off", () => {
        const program: Program = { ...fourQuarters, events: [note(0, 60), note(1, 62)], endBeat: 2 };
        const { clock, sink, ticker, scheduler } = setup(program);
        const passes: number[] = [];
        scheduler.hooks = { onIterationEnd: (iteration, time) => passes.push(iteration, time) };
        scheduler.start({ startTime: 1000, loop: true });
        runFor(clock, ticker, 2600);
        expect(sink.noteOns().map((m) => [m.data[1], m.time])).toEqual([[60, 1000], [62, 1500], [60, 2000], [62, 2500], [60, 3000], [62, 3500]]);
        const boundary = sink.controlChanges(123).map((m) => m.time);
        expect(boundary).toContain(1999);
        expect(boundary).toContain(2999);
        expect(passes).toEqual([0, 2000, 1, 3000]);
    });

    it("keeps the count-in only for the first pass", () => {
        const program: Program = {
            events: [{ kind: "click", beat: -1, downbeat: true, countIn: true }, note(0, 60)],
            startBeat: -1,
            endBeat: 1,
            tempoChanges: [{ beats: 0, bpm: 120 }],
        };
        const { clock, sink, ticker, scheduler } = setup(program);
        scheduler.start({ startTime: 1000, loop: true });
        runFor(clock, ticker, 1800);
        expect(sink.noteOns().map((m) => [m.data[1], m.time])).toEqual([[76, 1000], [60, 1500], [60, 2000], [60, 2500]]);
    });
});

describe("Scheduler panic", () => {
    it("on stop, ends held notes and sends CC123 on every used channel now and after the lookahead", () => {
        const program: Program = { ...fourQuarters, events: [note(0, 60, 4, 2), note(0, 48, 4, 3)] };
        const { clock, sink, ticker, scheduler } = setup(program);
        scheduler.start({ startTime: 1000 });
        runFor(clock, ticker, 200); // both notes are sounding
        sink.clear();
        scheduler.stop();
        const now = clock.now();
        expect(sink.noteOffs().map((m) => [m.data[0] & 0x0f, m.data[1], m.time])).toEqual([[1, 60, now], [2, 48, now]]);
        const allOff = sink.controlChanges(123).map((m) => [(m.data[0] & 0x0f) + 1, m.time]);
        // Channels 2 and 3 (notes) and 10 (metronome), once now and once at now + 120 + 20.
        expect(allOff).toEqual(expect.arrayContaining([[2, now], [3, now], [10, now], [2, now + 140], [3, now + 140], [10, now + 140]]));
        expect(allOff).toHaveLength(6);
        // Nothing else goes out after stop.
        sink.clear();
        runFor(clock, ticker, 3000);
        expect(sink.messages).toHaveLength(0);
    });

    it("a pending note-off for the same pitch never cuts a re-struck note", () => {
        const program: Program = { ...fourQuarters, events: [note(0, 60, 2), note(1, 60, 1)], endBeat: 3 };
        const { clock, sink, ticker, scheduler } = setup(program);
        scheduler.start({ startTime: 1000 });
        runFor(clock, ticker, 3000);
        const events = sink.messages.filter((m) => m.data[1] === 60).map((m) => [(m.data[0] & 0xf0) === 0x90 ? "on" : "off", m.time]);
        expect(events).toEqual([["on", 1000], ["off", 1499], ["on", 1500], ["off", 1998]]);
    });
});

describe("Scheduler with a real score", () => {
    it("sends app staves to their channels and announces my notes", () => {
        const score = parseMusicXml(pianoChords);
        const timeline = buildTimeline(score);
        const config = defaultScoreConfig(score, { firstAccompanimentChannel: 2, reservedChannels: [1, 10] });
        // Left hand played by the app on channel 4.
        config.staves["P1:2"] = { role: "app", channel: 4, dynamics: "velocity" };
        const program = buildProgram(timeline, config, { countInBars: 0 });
        const { clock, sink, ticker, scheduler } = setup(program);
        const expected: Array<[number, number]> = [];
        scheduler.hooks = { onExpect: (n, t) => expected.push([n.midi, t]) };
        scheduler.start({ startTime: 1000 });
        runFor(clock, ticker, 5000);
        expect(sink.noteOns().map((m) => [(m.data[0] & 0x0f) + 1, m.data[1], m.time])).toEqual([
            [4, 48, 1000], [4, 43, 3000], [4, 41, 4000], [4, 45, 4000],
        ]);
        expect(expected.map(([midi]) => midi)).toEqual([72, 76, 79, 74, 76, 77, 69]);
        expect(expected[3][1]).toBe(2000);
    });
});

describe("MIDI thru, parsing and keyboard input", () => {
    it("forwards notes and sustain immediately on the thru channel", () => {
        const clock = new FakeClock(500);
        const sink = new RecordingSink(clock);
        const out = new MidiOut(clock, () => sink);
        const input = new FakeInputSource();
        let enabled = true;
        connectThru(input, out, { isEnabled: () => enabled, getChannel: () => 5 });
        input.press(60, 480);
        input.emit({ type: "cc", controller: 64, value: 127, channel: 1, time: 490 });
        input.emit({ type: "cc", controller: 7, value: 100, channel: 1, time: 490 });
        input.release(60, 495);
        expect(sink.messages.map((m) => [m.data, m.time])).toEqual([
            [[0x94, 60, 100], 500],
            [[0xb4, 64, 127], 500],
            [[0x84, 60, 0], 500],
        ]);
        enabled = false;
        input.press(62, 600);
        expect(sink.messages).toHaveLength(3);
    });

    it("parses note-on with velocity 0 as note-off", () => {
        expect(parseMidiMessage([0x93, 64, 0], 10)).toEqual({ type: "noteoff", note: 64, velocity: 0, channel: 4, time: 10 });
        expect(parseMidiMessage([0xb0, 64, 127], 10)).toEqual({ type: "cc", controller: 64, value: 127, channel: 1, time: 10 });
        expect(parseMidiMessage([0xe0, 0, 64], 10)).toBeNull();
    });

    it("plays DAW-style computer keys and changes octave with Z/X", () => {
        const input = new ComputerKeyboardInput({ octave: 4 });
        const notes: string[] = [];
        input.subscribe((e) => notes.push(`${e.type}:${"note" in e ? e.note : ""}`));
        const key = (type: "keydown" | "keyup", code: string) => window.dispatchEvent(new KeyboardEvent(type, { code }));
        key("keydown", "KeyA");
        key("keydown", "KeyA"); // held key doesn't retrigger
        key("keyup", "KeyA");
        key("keydown", "KeyW");
        key("keyup", "KeyW");
        key("keydown", "KeyX"); // octave up
        key("keydown", "KeyK");
        key("keyup", "KeyK");
        key("keydown", "KeyR"); // not a note key (restart shortcut)
        expect(notes).toEqual(["noteon:60", "noteoff:60", "noteon:61", "noteoff:61", "noteon:84", "noteoff:84"]);
        input.dispose();
    });
});
