// MusicXML (score-partwise) parser. Produces a ParsedScore in written order.
// Repeats are expanded later, in timeline.ts.

import { clampVelocity, DEFAULT_VELOCITY, dynamicMarkFromName, velocityFromPercent } from "./dynamics.ts";
import { DEFAULT_TEMPO } from "./tempo.ts";
import {
    type ClefSign,
    type ParsedMeasure,
    type ParsedScore,
    type PartInfo,
    snapBeats,
    type StaffInfo,
    staffKey,
    type TimeSignature,
    type WrittenNote,
    type WrittenTempo,
} from "./types.ts";

export class ScoreParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ScoreParseError";
    }
}

const STEP_PITCH: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const BEAT_UNIT_QUARTERS: Record<string, number> = {
    maxima: 32,
    long: 16,
    breve: 8,
    whole: 4,
    half: 2,
    quarter: 1,
    eighth: 0.5,
    "16th": 0.25,
    "32nd": 0.125,
    "64th": 0.0625,
};

const JUMP_WORDS = /\b(d\.?\s?c\.?|d\.?\s?s\.?|da\s+capo|dal\s+segno|fine|to\s+coda|coda)\b/i;

interface DynamicEvent {
    measureIndex: number;
    onset: number;
    /** null = applies to every staff of the part. */
    staff: number | null;
    velocity: number;
    momentary: boolean;
    then?: number;
}

interface MeasureDraft {
    number: string;
    durationBeats: number;
    timeSignature: TimeSignature | null;
    repeatForward: boolean;
    repeatBackward: boolean;
    repeatTimes: number;
    endingStart: number[] | null;
    endingStop: boolean;
}

function childElements(el: Element, name?: string): Element[] {
    const result: Element[] = [];
    for (const child of Array.from(el.children)) {
        if (name === undefined || child.tagName === name) result.push(child);
    }
    return result;
}

function firstChild(el: Element, name: string): Element | null {
    for (const child of Array.from(el.children)) {
        if (child.tagName === name) return child;
    }
    return null;
}

function childText(el: Element, name: string): string | null {
    const child = firstChild(el, name);
    return child?.textContent?.trim() ?? null;
}

function childNumber(el: Element, name: string): number | null {
    const text = childText(el, name);
    if (text === null || text === "") return null;
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
}

function parseEndingNumbers(value: string | null): number[] {
    if (!value) return [];
    return value
        .split(/[\s,]+/)
        .map((part) => Number.parseInt(part, 10))
        .filter((n) => Number.isFinite(n) && n > 0);
}

function parseXml(xml: string): Document {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) {
        throw new ScoreParseError("This file isn't valid XML, so it can't be read as MusicXML.");
    }
    return doc;
}

export function parseMusicXml(xml: string): ParsedScore {
    const doc = parseXml(xml);
    const root = doc.documentElement;

    if (root.tagName === "score-timewise") {
        throw new ScoreParseError(
            "This file uses the MusicXML \"score-timewise\" layout, which isn't supported. " +
            "Export it again as standard (partwise) MusicXML, the default in MuseScore, Dorico, Finale and Sibelius.",
        );
    }
    if (root.tagName !== "score-partwise") {
        throw new ScoreParseError("This file isn't a MusicXML score (no <score-partwise> element found).");
    }

    const notices: string[] = [];
    let hasJumps = false;
    let skippedUnpitched = false;

    // Title and composer.
    const work = firstChild(root, "work");
    const title =
        (work && childText(work, "work-title")) ||
        childText(root, "movement-title") ||
        "";
    let composer = "";
    const identification = firstChild(root, "identification");
    if (identification) {
        for (const creator of childElements(identification, "creator")) {
            if (creator.getAttribute("type") === "composer" && creator.textContent?.trim()) {
                composer = creator.textContent.trim();
                break;
            }
        }
    }

    // Part names, in part-list order.
    const partNames = new Map<string, string>();
    const partOrder: string[] = [];
    const partList = firstChild(root, "part-list");
    if (partList) {
        for (const scorePart of childElements(partList, "score-part")) {
            const id = scorePart.getAttribute("id") ?? "";
            partOrder.push(id);
            partNames.set(id, childText(scorePart, "part-name") || childText(scorePart, "part-abbreviation") || id);
        }
    }

    const partElements = childElements(root, "part");
    if (partElements.length === 0) {
        throw new ScoreParseError("This MusicXML file has no parts.");
    }
    partElements.sort((a, b) => {
        const ia = partOrder.indexOf(a.getAttribute("id") ?? "");
        const ib = partOrder.indexOf(b.getAttribute("id") ?? "");
        return (ia === -1 ? 1e9 : ia) - (ib === -1 ? 1e9 : ib);
    });

    const measureDrafts: MeasureDraft[] = [];
    const notes: WrittenNote[] = [];
    const tempos: WrittenTempo[] = [];
    const parts: PartInfo[] = [];
    const staves: StaffInfo[] = [];

    for (const partEl of partElements) {
        const partId = partEl.getAttribute("id") ?? `P${parts.length + 1}`;
        let divisions = 1;
        let transposeSemitones = 0;
        let staffCount = 1;
        const clefs = new Map<number, ClefSign>();
        const dynamicEvents: DynamicEvent[] = [];
        const partNotes: WrittenNote[] = [];
        const noteDynamicsOverride = new Map<WrittenNote, number>();

        const measureEls = childElements(partEl, "measure");
        measureEls.forEach((measureEl, measureIndex) => {
            let draft = measureDrafts[measureIndex];
            if (!draft) {
                draft = {
                    number: measureEl.getAttribute("number") ?? String(measureIndex + 1),
                    durationBeats: 0,
                    timeSignature: null,
                    repeatForward: false,
                    repeatBackward: false,
                    repeatTimes: 2,
                    endingStart: null,
                    endingStop: false,
                };
                measureDrafts[measureIndex] = draft;
            }

            let pos = 0;
            let lastOnset = 0;
            let maxPos = 0;

            const readSound = (sound: Element, onset: number) => {
                const tempo = sound.getAttribute("tempo");
                if (tempo !== null && Number(tempo) > 0) {
                    tempos.push({ measureIndex, onsetInMeasure: onset, bpm: Number(tempo) });
                }
                const dyn = sound.getAttribute("dynamics");
                if (dyn !== null && Number.isFinite(Number(dyn))) {
                    dynamicEvents.push({ measureIndex, onset, staff: null, velocity: velocityFromPercent(Number(dyn)), momentary: false });
                }
                for (const attr of ["dacapo", "dalsegno", "segno", "coda", "tocoda", "fine"]) {
                    if (sound.hasAttribute(attr)) hasJumps = true;
                }
                return tempo !== null && Number(tempo) > 0;
            };

            for (const child of Array.from(measureEl.children)) {
                switch (child.tagName) {
                    case "attributes": {
                        const div = childNumber(child, "divisions");
                        if (div && div > 0) divisions = div;
                        const stavesValue = childNumber(child, "staves");
                        if (stavesValue && stavesValue > 0) staffCount = Math.max(staffCount, stavesValue);
                        const time = firstChild(child, "time");
                        if (time) {
                            const beats = Number.parseInt(childText(time, "beats") ?? "", 10);
                            const beatType = Number.parseInt(childText(time, "beat-type") ?? "", 10);
                            if (beats > 0 && beatType > 0 && !draft.timeSignature) {
                                draft.timeSignature = { beats, beatType };
                            }
                        }
                        const transpose = firstChild(child, "transpose");
                        if (transpose) {
                            const chromatic = childNumber(transpose, "chromatic") ?? 0;
                            const octaveChange = childNumber(transpose, "octave-change") ?? 0;
                            transposeSemitones = chromatic + 12 * octaveChange;
                        }
                        for (const clef of childElements(child, "clef")) {
                            const number = Number.parseInt(clef.getAttribute("number") ?? "1", 10) || 1;
                            const sign = (childText(clef, "sign") ?? "G") as ClefSign;
                            if (!clefs.has(number)) clefs.set(number, sign);
                        }
                        break;
                    }
                    case "note": {
                        const isChord = firstChild(child, "chord") !== null;
                        const isGrace = firstChild(child, "grace") !== null;
                        const isCue = firstChild(child, "cue") !== null;
                        const duration = isGrace ? 0 : (childNumber(child, "duration") ?? 0) / divisions;
                        let onset: number;
                        if (isChord) {
                            onset = lastOnset;
                        } else {
                            onset = pos;
                            lastOnset = pos;
                            pos = snapBeats(pos + duration);
                        }
                        maxPos = Math.max(maxPos, snapBeats(onset + duration));

                        const pitch = firstChild(child, "pitch");
                        if (!pitch) {
                            if (firstChild(child, "unpitched")) skippedUnpitched = true;
                            break;
                        }
                        if (isCue) break;

                        const step = (childText(pitch, "step") ?? "C").toUpperCase();
                        const alter = Math.round(childNumber(pitch, "alter") ?? 0);
                        const octave = childNumber(pitch, "octave") ?? 4;
                        const writtenMidi = (octave + 1) * 12 + (STEP_PITCH[step] ?? 0) + alter;
                        const staff = childNumber(child, "staff") ?? 1;
                        staffCount = Math.max(staffCount, staff);

                        let tieStart = false;
                        let tieStop = false;
                        const ties = childElements(child, "tie");
                        const notations = firstChild(child, "notations");
                        const tied = notations ? childElements(notations, "tied") : [];
                        for (const tie of [...ties, ...tied]) {
                            const type = tie.getAttribute("type");
                            if (type === "start") tieStart = true;
                            if (type === "stop") tieStop = true;
                        }

                        const note: WrittenNote = {
                            index: -1,
                            partId,
                            staff,
                            staffKey: staffKey(partId, staff),
                            voice: childText(child, "voice") ?? "1",
                            midi: writtenMidi + transposeSemitones,
                            writtenMidi,
                            step,
                            alter,
                            octave,
                            measureIndex,
                            onsetInMeasure: snapBeats(onset),
                            durationBeats: snapBeats(duration),
                            velocity: DEFAULT_VELOCITY,
                            tieStart,
                            tieStop,
                            isGrace,
                        };
                        const noteDynamics = child.getAttribute("dynamics");
                        if (noteDynamics !== null && Number.isFinite(Number(noteDynamics))) {
                            noteDynamicsOverride.set(note, velocityFromPercent(Number(noteDynamics)));
                        }
                        partNotes.push(note);
                        break;
                    }
                    case "backup": {
                        pos = snapBeats(Math.max(0, pos - (childNumber(child, "duration") ?? 0) / divisions));
                        break;
                    }
                    case "forward": {
                        pos = snapBeats(pos + (childNumber(child, "duration") ?? 0) / divisions);
                        maxPos = Math.max(maxPos, pos);
                        break;
                    }
                    case "direction": {
                        const offset = (childNumber(child, "offset") ?? 0) / divisions;
                        const onset = snapBeats(Math.max(0, pos + offset));
                        const staffNumber = childNumber(child, "staff");
                        let hasSoundTempo = false;
                        const sound = firstChild(child, "sound");
                        if (sound) hasSoundTempo = readSound(sound, onset);

                        for (const directionType of childElements(child, "direction-type")) {
                            for (const item of Array.from(directionType.children)) {
                                if (item.tagName === "dynamics") {
                                    for (const mark of Array.from(item.children)) {
                                        const dynamic = dynamicMarkFromName(mark.tagName);
                                        if (dynamic) {
                                            dynamicEvents.push({ measureIndex, onset, staff: staffNumber, ...dynamic });
                                        }
                                    }
                                } else if (item.tagName === "metronome" && !hasSoundTempo) {
                                    const unit = childText(item, "beat-unit");
                                    const perMinute = childNumber(item, "per-minute");
                                    if (unit && perMinute && perMinute > 0 && BEAT_UNIT_QUARTERS[unit]) {
                                        const dots = childElements(item, "beat-unit-dot").length;
                                        let quarters = BEAT_UNIT_QUARTERS[unit];
                                        let add = quarters / 2;
                                        for (let d = 0; d < dots; d++) {
                                            quarters += add;
                                            add /= 2;
                                        }
                                        tempos.push({ measureIndex, onsetInMeasure: onset, bpm: perMinute * quarters });
                                    }
                                } else if (item.tagName === "segno" || item.tagName === "coda") {
                                    hasJumps = true;
                                } else if (item.tagName === "words" && JUMP_WORDS.test(item.textContent ?? "")) {
                                    hasJumps = true;
                                }
                            }
                        }
                        break;
                    }
                    case "sound": {
                        readSound(child, pos);
                        break;
                    }
                    case "barline": {
                        const repeat = firstChild(child, "repeat");
                        if (repeat) {
                            const direction = repeat.getAttribute("direction");
                            if (direction === "forward") draft.repeatForward = true;
                            if (direction === "backward") {
                                draft.repeatBackward = true;
                                const times = Number.parseInt(repeat.getAttribute("times") ?? "", 10);
                                if (times > 1) draft.repeatTimes = times;
                            }
                        }
                        const ending = firstChild(child, "ending");
                        if (ending) {
                            const type = ending.getAttribute("type");
                            if (type === "start") {
                                const numbers = parseEndingNumbers(ending.getAttribute("number"));
                                if (numbers.length > 0) draft.endingStart = numbers;
                            }
                            if (type === "stop" || type === "discontinue") draft.endingStop = true;
                        }
                        if (firstChild(child, "segno") || firstChild(child, "coda")) hasJumps = true;
                        break;
                    }
                    default:
                        break;
                }
            }

            draft.durationBeats = Math.max(draft.durationBeats, maxPos, pos);
        });

        // Apply dynamics to the part's notes.
        dynamicEvents.sort((a, b) => a.measureIndex - b.measureIndex || a.onset - b.onset);
        for (const note of partNotes) {
            const override = noteDynamicsOverride.get(note);
            note.velocity = override ?? velocityAt(dynamicEvents, note);
        }

        for (const note of partNotes) {
            note.index = notes.length;
            notes.push(note);
        }

        parts.push({ id: partId, name: partNames.get(partId) ?? partId, staves: staffCount });
        for (let s = 1; s <= staffCount; s++) {
            staves.push({
                key: staffKey(partId, s),
                partId,
                partName: partNames.get(partId) ?? partId,
                staff: s,
                stavesInPart: staffCount,
                clef: clefs.get(s) ?? (s === 1 ? "G" : "F"),
            });
        }
    }

    const measures = finishMeasures(measureDrafts);

    // Tempo: dedupe events at the same position (several parts often repeat the mark).
    const tempoByPosition = new Map<string, WrittenTempo>();
    for (const tempo of tempos) {
        const key = `${tempo.measureIndex}:${tempo.onsetInMeasure}`;
        if (!tempoByPosition.has(key)) tempoByPosition.set(key, tempo);
    }
    const uniqueTempos = [...tempoByPosition.values()].sort(
        (a, b) => a.measureIndex - b.measureIndex || a.onsetInMeasure - b.onsetInMeasure,
    );
    const initialTempo =
        uniqueTempos.length > 0 && uniqueTempos[0].measureIndex === 0 && uniqueTempos[0].onsetInMeasure === 0
            ? uniqueTempos[0].bpm
            : DEFAULT_TEMPO;

    if (hasJumps) {
        notices.push("This score uses D.C., D.S., Fine or Coda. Those jumps aren't supported yet, so it plays straight through.");
    }
    if (skippedUnpitched) {
        notices.push("Unpitched (percussion) notes are shown but not played or graded.");
    }
    if (notes.length === 0) {
        notices.push("This score has no pitched notes to play.");
    }

    return {
        title,
        composer,
        parts,
        staves,
        measures,
        notes,
        tempos: uniqueTempos,
        initialTempo,
        hasJumps,
        notices,
    };
}

function velocityAt(events: DynamicEvent[], note: WrittenNote): number {
    let level = DEFAULT_VELOCITY;
    let momentary: number | null = null;
    for (const event of events) {
        if (event.staff !== null && event.staff !== note.staff) continue;
        const before =
            event.measureIndex < note.measureIndex ||
            (event.measureIndex === note.measureIndex && event.onset <= note.onsetInMeasure);
        if (!before) break;
        const samePosition = event.measureIndex === note.measureIndex && event.onset === note.onsetInMeasure;
        if (event.momentary) {
            if (samePosition) momentary = event.velocity;
            if (event.then !== undefined) level = event.then;
        } else {
            level = event.velocity;
        }
    }
    return clampVelocity(momentary ?? level);
}

function finishMeasures(drafts: MeasureDraft[]): ParsedMeasure[] {
    const measures: ParsedMeasure[] = [];
    let timeSignature: TimeSignature = { beats: 4, beatType: 4 };
    let currentEnding: number[] | null = null;

    drafts.forEach((draft, index) => {
        if (draft.timeSignature) timeSignature = draft.timeSignature;
        const nominalBeats = (timeSignature.beats * 4) / timeSignature.beatType;
        if (draft.endingStart) currentEnding = draft.endingStart;
        measures.push({
            index,
            number: draft.number,
            durationBeats: snapBeats(draft.durationBeats > 0 ? draft.durationBeats : nominalBeats),
            nominalBeats: snapBeats(nominalBeats),
            timeSignature,
            repeatForward: draft.repeatForward,
            repeatBackward: draft.repeatBackward,
            repeatTimes: draft.repeatTimes,
            endingNumbers: currentEnding,
        });
        if (draft.endingStop) currentEnding = null;
    });

    return measures;
}
