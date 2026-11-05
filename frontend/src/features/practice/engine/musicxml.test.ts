import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import simpleMelody from "./__fixtures__/simple-melody.musicxml?raw";
import pianoChords from "./__fixtures__/piano-chords.musicxml?raw";
import ties from "./__fixtures__/ties.musicxml?raw";
import voltas from "./__fixtures__/voltas.musicxml?raw";
import tempoChange from "./__fixtures__/tempo-change.musicxml?raw";
import transposing from "./__fixtures__/transposing.musicxml?raw";
import { parseMusicXml, ScoreParseError } from "./musicxml.ts";
import { buildTimeline } from "./timeline.ts";
import { expandRepeats } from "./repeats.ts";
import { extractMxl, scoreXmlFromBytes } from "./mxl.ts";
import { TempoMap } from "./tempo.ts";
import type { NoteEvent } from "./types.ts";

function pitches(notes: NoteEvent[]) {
    return notes.map((n) => n.midi);
}

describe("parseMusicXml: simple melody", () => {
    const score = parseMusicXml(simpleMelody);
    const timeline = buildTimeline(score);

    it("reads title, composer, parts and staves", () => {
        expect(score.title).toBe("Simple melody");
        expect(score.composer).toBe("Test Composer");
        expect(score.parts).toEqual([{ id: "P1", name: "Flute", staves: 1 }]);
        expect(score.staves.map((s) => s.key)).toEqual(["P1:1"]);
        expect(score.staves[0].clef).toBe("G");
    });

    it("reads pitches, accidentals, onsets and durations; skips rests", () => {
        expect(pitches(timeline.notes)).toEqual([60, 62, 64, 66, 67, 70]);
        expect(timeline.notes.map((n) => n.onsetBeats)).toEqual([0, 1, 2, 3, 4, 7]);
        expect(timeline.notes[4].durationBeats).toBe(2);
        const fSharp = timeline.notes[3];
        expect([fSharp.step, fSharp.alter, fSharp.octave]).toEqual(["F", 1, 4]);
        expect(timeline.notes[5]).toMatchObject({ step: "B", alter: -1, measureIndex: 1, onsetInMeasure: 3 });
    });

    it("builds measures and time signatures", () => {
        expect(timeline.measures.map((m) => [m.startBeats, m.durationBeats])).toEqual([[0, 4], [4, 4]]);
        expect(timeline.timeSignatures).toEqual([{ beats: 0, measurePosition: 0, timeSignature: { beats: 4, beatType: 4 } }]);
        expect(timeline.totalBeats).toBe(8);
    });

    it("reads the tempo from <sound tempo>", () => {
        expect(score.initialTempo).toBe(100);
        expect(timeline.tempoChanges).toEqual([{ beats: 0, bpm: 100 }]);
        expect(timeline.baseTempo).toBe(100);
    });

    it("gives every note the default velocity when there are no dynamics", () => {
        expect(new Set(timeline.notes.map((n) => n.velocity))).toEqual(new Set([80]));
    });

    it("gives every event the fields from the spec", () => {
        const keys = ["id", "partId", "staff", "voice", "midi", "step", "alter", "octave", "measureIndex",
            "onsetBeats", "durationBeats", "velocity", "tieContinuation", "isGrace"];
        for (const key of keys) expect(timeline.notes[0]).toHaveProperty(key);
        expect(new Set(timeline.notes.map((n) => n.id)).size).toBe(timeline.notes.length);
    });
});

describe("parseMusicXml: two-staff piano with chords, backup and forward", () => {
    const score = parseMusicXml(pianoChords);
    const timeline = buildTimeline(score);
    const byStaff = (staff: number) => timeline.notes.filter((n) => n.staff === staff);

    it("finds two staves with their clefs", () => {
        expect(score.staves.map((s) => [s.key, s.clef, s.stavesInPart])).toEqual([
            ["P1:1", "G", 2],
            ["P1:2", "F", 2],
        ]);
    });

    it("puts chord notes at the same onset", () => {
        const chord = byStaff(1).filter((n) => n.onsetBeats === 0);
        expect(pitches(chord).sort()).toEqual([72, 76, 79]);
        expect(chord.every((n) => n.durationBeats === 2)).toBe(true);
        expect(byStaff(1).filter((n) => n.measureIndex === 0).map((n) => n.onsetBeats)).toEqual([0, 0, 0, 2, 3]);
    });

    it("handles backup to the left hand", () => {
        const left = byStaff(2).filter((n) => n.measureIndex === 0);
        expect(left).toHaveLength(1);
        expect(left[0]).toMatchObject({ midi: 48, onsetBeats: 0, durationBeats: 4, voice: "5" });
    });

    it("handles forward in a second voice", () => {
        const voice2 = timeline.notes.filter((n) => n.voice === "2");
        expect(voice2).toHaveLength(1);
        expect(voice2[0]).toMatchObject({ midi: 69, onsetBeats: 6, measureIndex: 1, onsetInMeasure: 2 });
    });

    it("left-hand chord in measure 2", () => {
        const lh = byStaff(2).filter((n) => n.measureIndex === 1);
        expect(lh.map((n) => [n.midi, n.onsetInMeasure])).toEqual([[43, 0], [41, 2], [45, 2]]);
    });

    it("applies staff-specific dynamics as velocity", () => {
        const rhM1 = byStaff(1).filter((n) => n.measureIndex === 0);
        const rhM2 = byStaff(1).filter((n) => n.measureIndex === 1);
        expect(new Set(rhM1.map((n) => n.velocity))).toEqual(new Set([50])); // p
        expect(new Set(rhM2.map((n) => n.velocity))).toEqual(new Set([96])); // f
        // The dynamics were attached to staff 1, so the left hand keeps the default.
        expect(new Set(byStaff(2).map((n) => n.velocity))).toEqual(new Set([80]));
    });

    it("defaults to 120 BPM without a tempo mark", () => {
        expect(score.initialTempo).toBe(120);
        expect(timeline.tempoChanges).toEqual([{ beats: 0, bpm: 120 }]);
    });
});

describe("parseMusicXml: ties", () => {
    const timeline = buildTimeline(parseMusicXml(ties));

    it("marks tied continuations and extends the first note", () => {
        const e = timeline.notes.filter((n) => n.midi === 64);
        expect(e.map((n) => [n.onsetBeats, n.tieContinuation, n.playDurationBeats])).toEqual([
            [0, false, 2],
            [1, true, 0],
        ]);
    });

    it("ties a chord over the barline", () => {
        const c = timeline.notes.filter((n) => n.midi === 60);
        const g = timeline.notes.filter((n) => n.midi === 67);
        for (const chain of [c, g]) {
            expect(chain.map((n) => [n.onsetBeats, n.tieContinuation, n.playDurationBeats])).toEqual([
                [2, false, 6],
                [4, true, 0],
            ]);
        }
    });

    it("plays a continuation as a normal note when the loop starts in the middle of the tie", () => {
        const loop = buildTimeline(parseMusicXml(ties), [1]);
        expect(loop.notes.map((n) => [n.midi, n.tieContinuation, n.playDurationBeats])).toEqual([
            [60, false, 4],
            [67, false, 4],
        ]);
    });
});

describe("repeats and voltas", () => {
    const score = parseMusicXml(voltas);

    it("reads repeat barlines and endings", () => {
        expect(score.measures.map((m) => [m.repeatForward, m.repeatBackward, m.endingNumbers])).toEqual([
            [true, false, null],
            [false, true, [1]],
            [false, false, [2]],
            [false, false, null],
        ]);
    });

    it("expands 1st and 2nd endings into playback order", () => {
        expect(expandRepeats(score.measures)).toEqual([0, 1, 0, 2, 3]);
        const timeline = buildTimeline(score);
        expect(pitches(timeline.notes)).toEqual([72, 74, 72, 76, 77]);
        expect(timeline.notes.map((n) => n.onsetBeats)).toEqual([0, 2, 4, 6, 8]);
        expect(timeline.notes.map((n) => n.measureIndex)).toEqual([0, 1, 0, 2, 3]);
        expect(new Set(timeline.notes.map((n) => n.id)).size).toBe(5);
    });

    it("loops a measure range straight, without repeats", () => {
        expect(pitches(buildTimeline(score, [1, 2]).notes)).toEqual([74, 76]);
    });

    it("expands a plain repeat with times=3 and an implicit start", () => {
        const xml = simpleRepeatXml(3);
        expect(expandRepeats(parseMusicXml(xml).measures)).toEqual([0, 1, 0, 1, 0, 1, 2]);
    });

    it("plays endings '1, 2' twice before ending 3", () => {
        const xml = threeEndingsXml();
        expect(expandRepeats(parseMusicXml(xml).measures)).toEqual([0, 1, 0, 1, 0, 2]);
    });

    it("flags D.C. / Coda and plays straight through", () => {
        const xml = simpleMelody.replace(
            "<note><pitch><step>G</step>",
            "<direction><direction-type><words>D.C. al Fine</words></direction-type></direction><note><pitch><step>G</step>",
        );
        const parsed = parseMusicXml(xml);
        expect(parsed.hasJumps).toBe(true);
        expect(parsed.notices[0]).toMatch(/plays straight through/);
        expect(expandRepeats(parsed.measures)).toEqual([0, 1]);
    });
});

describe("tempo changes", () => {
    const score = parseMusicXml(tempoChange);
    const timeline = buildTimeline(score);

    it("converts a dotted-quarter metronome mark and reads <sound tempo>", () => {
        expect(score.initialTempo).toBe(90);
        expect(timeline.tempoChanges).toEqual([
            { beats: 0, bpm: 90 },
            { beats: 3, bpm: 120 },
        ]);
        expect(timeline.measures.map((m) => m.nominalBeats)).toEqual([3, 3]);
    });

    it("maps beats to milliseconds across the change, scaled by the tempo factor", () => {
        const map = new TempoMap(timeline.tempoChanges);
        // 3 beats at 90 BPM = 2000 ms, then 3 beats at 120 BPM = 1500 ms.
        expect(map.durationMs(0, 6, 1)).toBeCloseTo(3500);
        expect(map.durationMs(0, 6, 0.5)).toBeCloseTo(7000);
        expect(map.beatAfter(0, 2750, 1)).toBeCloseTo(4.5);
        expect(map.beatAfter(0, 5500, 0.5)).toBeCloseTo(4.5);
        expect(map.durationMs(-3, 0, 1)).toBeCloseTo(2000);
    });
});

describe("transposing instruments", () => {
    const score = parseMusicXml(transposing);
    const [note] = buildTimeline(score).notes;

    it("uses the sounding pitch for MIDI and keeps the written pitch for display", () => {
        expect(note.writtenMidi).toBe(74); // written D5
        expect(note.midi).toBe(72); // sounds C5
        expect([note.step, note.octave]).toEqual(["D", 5]);
    });

    it("reads velocity from <note dynamics>", () => {
        expect(note.velocity).toBe(90);
    });
});

describe(".mxl files", () => {
    const container = `<?xml version="1.0" encoding="UTF-8"?>
<container><rootfiles><rootfile full-path="score/melody.musicxml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>`;

    it("finds the root file through META-INF/container.xml", () => {
        const zip = zipSync({
            mimetype: strToU8("application/vnd.recordare.musicxml"),
            "META-INF/container.xml": strToU8(container),
            "score/other.xml": strToU8("<not-a-score/>"),
            "score/melody.musicxml": strToU8(simpleMelody),
        });
        const xml = extractMxl(zip);
        expect(parseMusicXml(xml).title).toBe("Simple melody");
        expect(scoreXmlFromBytes(zip)).toBe(xml);
    });

    it("reads plain XML bytes, including UTF-16", () => {
        expect(scoreXmlFromBytes(strToU8(simpleMelody))).toBe(simpleMelody);
        const utf16 = new Uint8Array(2 + simpleMelody.length * 2);
        utf16[0] = 0xff;
        utf16[1] = 0xfe;
        for (let i = 0; i < simpleMelody.length; i++) {
            const code = simpleMelody.charCodeAt(i);
            utf16[2 + i * 2] = code & 0xff;
            utf16[3 + i * 2] = code >> 8;
        }
        expect(scoreXmlFromBytes(utf16)).toBe(simpleMelody);
    });

    it("reports an archive without a score", () => {
        const zip = zipSync({ "readme.txt": strToU8("hello") });
        expect(() => extractMxl(zip)).toThrow(ScoreParseError);
    });
});

describe("errors", () => {
    it("rejects score-timewise with a clear message", () => {
        const xml = `<?xml version="1.0"?><score-timewise version="4.0"><part-list/></score-timewise>`;
        expect(() => parseMusicXml(xml)).toThrow(/score-timewise/);
    });

    it("rejects invalid XML", () => {
        expect(() => parseMusicXml("<score-partwise><part>")).toThrow(ScoreParseError);
    });

    it("rejects non-MusicXML documents", () => {
        expect(() => parseMusicXml("<html/>")).toThrow(/isn't a MusicXML score/);
    });
});

function measureXml(number: number, body: string): string {
    return `<measure number="${number}">${body}<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>whole</type></note></measure>`;
}

function wrapPart(measures: string): string {
    return `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>X</part-name></score-part></part-list><part id="P1">${measures}</part></score-partwise>`;
}

function simpleRepeatXml(times: number): string {
    return wrapPart(
        measureXml(1, `<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>`) +
        measureXml(2, `<barline location="right"><repeat direction="backward" times="${times}"/></barline>`) +
        measureXml(3, ""),
    );
}

function threeEndingsXml(): string {
    return wrapPart(
        measureXml(1, `<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes><barline location="left"><repeat direction="forward"/></barline>`) +
        measureXml(2, `<barline location="left"><ending number="1, 2" type="start"/></barline><barline location="right"><ending number="1, 2" type="stop"/><repeat direction="backward"/></barline>`) +
        measureXml(3, `<barline location="left"><ending number="3" type="start"/></barline><barline location="right"><ending number="3" type="discontinue"/></barline>`),
    );
}
