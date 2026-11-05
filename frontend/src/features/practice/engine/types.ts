// Score engine types. Plain data, no React / MUI / OSMD.
// All positions and durations are in quarter-note beats.

/** Identifies one staff of one part, e.g. "P1:2" for the second staff of part P1. */
export type StaffKey = string;

export function staffKey(partId: string, staff: number): StaffKey {
    return `${partId}:${staff}`;
}

export type ClefSign = "G" | "F" | "C" | "percussion" | "TAB" | "none";

export interface StaffInfo {
    key: StaffKey;
    partId: string;
    partName: string;
    /** 1-based staff number within the part. */
    staff: number;
    /** Number of staves in this part (2 for a piano part). */
    stavesInPart: number;
    clef: ClefSign;
}

export interface PartInfo {
    id: string;
    name: string;
    staves: number;
}

export interface TimeSignature {
    beats: number;
    beatType: number;
}

/** A measure as written in the file (before repeats are expanded). */
export interface ParsedMeasure {
    /** 0-based index in the file. */
    index: number;
    /** The measure number label from the file ("1", "2", "X1"...). */
    number: string;
    /** Actual length from its contents (pickup measures are shorter). */
    durationBeats: number;
    /** Length implied by the time signature. */
    nominalBeats: number;
    timeSignature: TimeSignature;
    repeatForward: boolean;
    repeatBackward: boolean;
    /** Total number of times a backward-repeat section is played (default 2). */
    repeatTimes: number;
    /** Volta numbers this measure belongs to, or null if it is not in an ending. */
    endingNumbers: number[] | null;
}

/** A note as written in the file. */
export interface WrittenNote {
    /** Index in ParsedScore.notes. */
    index: number;
    partId: string;
    staff: number;
    staffKey: StaffKey;
    voice: string;
    /** Sounding pitch (after <transpose>). This is what goes out over MIDI. */
    midi: number;
    /** Written pitch, as shown in the score. */
    writtenMidi: number;
    step: string;
    alter: number;
    octave: number;
    measureIndex: number;
    onsetInMeasure: number;
    durationBeats: number;
    velocity: number;
    tieStart: boolean;
    tieStop: boolean;
    isGrace: boolean;
}

export interface WrittenTempo {
    measureIndex: number;
    onsetInMeasure: number;
    /** Quarter notes per minute. */
    bpm: number;
}

export interface ParsedScore {
    title: string;
    composer: string;
    parts: PartInfo[];
    staves: StaffInfo[];
    measures: ParsedMeasure[];
    notes: WrittenNote[];
    tempos: WrittenTempo[];
    /** Quarter-note BPM at the start of the score (120 when the file has none). */
    initialTempo: number;
    /** True when the file uses D.C., D.S., Fine, Segno or Coda. */
    hasJumps: boolean;
    /** Short messages to show the player, e.g. about unsupported features. */
    notices: string[];
}

/** One note in playback order (repeats expanded). */
export interface NoteEvent {
    /** Unique within a timeline. */
    id: string;
    partId: string;
    staff: number;
    staffKey: StaffKey;
    voice: string;
    /** Sounding MIDI pitch. */
    midi: number;
    writtenMidi: number;
    step: string;
    alter: number;
    octave: number;
    /** Written measure index (for mapping to the rendered score). */
    measureIndex: number;
    /** Position of the measure in playback order. */
    measurePosition: number;
    onsetInMeasure: number;
    /** Absolute onset in playback order. */
    onsetBeats: number;
    /** Notated duration of this note alone. */
    durationBeats: number;
    /** How long it sounds, including tied continuations. 0 for tie continuations. */
    playDurationBeats: number;
    velocity: number;
    /** A tied continuation: shown, but not a new note to play. */
    tieContinuation: boolean;
    isGrace: boolean;
    /** Index of the written note this event came from. */
    writtenIndex: number;
}

export interface TimelineMeasure {
    /** Position in playback order. */
    position: number;
    /** Written measure index. */
    measureIndex: number;
    number: string;
    startBeats: number;
    durationBeats: number;
    nominalBeats: number;
    timeSignature: TimeSignature;
}

export interface TempoChange {
    beats: number;
    /** Quarter notes per minute, as written (before the player's tempo factor). */
    bpm: number;
}

export interface TimeSignatureChange {
    beats: number;
    measurePosition: number;
    timeSignature: TimeSignature;
}

export interface ScoreTimeline {
    notes: NoteEvent[];
    measures: TimelineMeasure[];
    timeSignatures: TimeSignatureChange[];
    tempoChanges: TempoChange[];
    totalBeats: number;
    /** The score's starting tempo, used as 100 % for the tempo control. */
    baseTempo: number;
}

/** Beats are snapped to this grid to avoid floating-point drift (divisible by 2..16, triplets, quintuplets...). */
const BEAT_GRID = 100800;

export function snapBeats(value: number): number {
    return Math.round(value * BEAT_GRID) / BEAT_GRID;
}

export const BEAT_EPSILON = 1 / BEAT_GRID;
