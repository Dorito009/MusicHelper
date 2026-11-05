import { expandRepeats } from "./repeats.ts";
import { DEFAULT_TEMPO } from "./tempo.ts";
import {
    type NoteEvent,
    type ParsedScore,
    snapBeats,
    type ScoreTimeline,
    type TempoChange,
    type TimelineMeasure,
    type TimeSignatureChange,
    type WrittenNote,
} from "./types.ts";

/**
 * Builds the playback timeline for a list of written measure indices.
 * Without `order`, repeats are expanded. For a loop, pass the measures straight (e.g. [3, 4, 5]).
 */
export function buildTimeline(score: ParsedScore, order: readonly number[] = expandRepeats(score.measures)): ScoreTimeline {
    const notesByMeasure = new Map<number, WrittenNote[]>();
    for (const note of score.notes) {
        const list = notesByMeasure.get(note.measureIndex);
        if (list) list.push(note);
        else notesByMeasure.set(note.measureIndex, [note]);
    }

    const measures: TimelineMeasure[] = [];
    const notes: NoteEvent[] = [];
    const tempoChanges: TempoChange[] = [];
    const timeSignatures: TimeSignatureChange[] = [];
    let beat = 0;
    let currentBpm: number | null = null;

    const pushTempo = (at: number, bpm: number) => {
        if (currentBpm !== null && Math.abs(currentBpm - bpm) < 1e-9) return;
        const last = tempoChanges[tempoChanges.length - 1];
        if (last && Math.abs(last.beats - at) < 1e-9) {
            last.bpm = bpm;
        } else {
            tempoChanges.push({ beats: at, bpm });
        }
        currentBpm = bpm;
    };

    order.forEach((measureIndex, position) => {
        const written = score.measures[measureIndex];
        if (!written) return;
        const start = snapBeats(beat);

        measures.push({
            position,
            measureIndex,
            number: written.number,
            startBeats: start,
            durationBeats: written.durationBeats,
            nominalBeats: written.nominalBeats,
            timeSignature: written.timeSignature,
        });

        const previousSig = timeSignatures[timeSignatures.length - 1]?.timeSignature;
        if (!previousSig || previousSig.beats !== written.timeSignature.beats || previousSig.beatType !== written.timeSignature.beatType) {
            timeSignatures.push({ beats: start, measurePosition: position, timeSignature: written.timeSignature });
        }

        // Re-assert the tempo in effect where this measure starts (matters after a repeat jump or for loops).
        pushTempo(start, tempoAtMeasureStart(score, measureIndex));
        for (const tempo of score.tempos) {
            if (tempo.measureIndex === measureIndex && tempo.onsetInMeasure > 0) {
                pushTempo(snapBeats(start + tempo.onsetInMeasure), tempo.bpm);
            } else if (tempo.measureIndex === measureIndex && tempo.onsetInMeasure === 0) {
                pushTempo(start, tempo.bpm);
            }
        }

        for (const note of notesByMeasure.get(measureIndex) ?? []) {
            notes.push({
                id: `${position}:${note.index}`,
                partId: note.partId,
                staff: note.staff,
                staffKey: note.staffKey,
                voice: note.voice,
                midi: note.midi,
                writtenMidi: note.writtenMidi,
                step: note.step,
                alter: note.alter,
                octave: note.octave,
                measureIndex,
                measurePosition: position,
                onsetInMeasure: note.onsetInMeasure,
                onsetBeats: snapBeats(start + note.onsetInMeasure),
                durationBeats: note.durationBeats,
                playDurationBeats: note.durationBeats,
                velocity: note.velocity,
                tieContinuation: false,
                isGrace: note.isGrace,
                writtenIndex: note.index,
            });
        }

        beat = start + written.durationBeats;
    });

    notes.sort((a, b) => a.onsetBeats - b.onsetBeats || a.staffKey.localeCompare(b.staffKey) || a.midi - b.midi);
    resolveTies(notes, score);

    if (tempoChanges.length === 0) tempoChanges.push({ beats: 0, bpm: DEFAULT_TEMPO });

    return {
        notes,
        measures,
        timeSignatures,
        tempoChanges,
        totalBeats: snapBeats(beat),
        baseTempo: score.initialTempo,
    };
}

/** Tempo in effect at the start of a written measure. */
export function tempoAtMeasureStart(score: ParsedScore, measureIndex: number): number {
    let bpm = DEFAULT_TEMPO;
    for (const tempo of score.tempos) {
        if (tempo.measureIndex < measureIndex || (tempo.measureIndex === measureIndex && tempo.onsetInMeasure === 0)) {
            bpm = tempo.bpm;
        }
    }
    return bpm;
}

/**
 * Marks tied continuations and extends the first note of each tie chain.
 * A continuation whose start isn't in the timeline (e.g. the loop starts mid-tie) is played as a normal note.
 */
function resolveTies(notes: NoteEvent[], score: ParsedScore): void {
    const open = new Map<string, NoteEvent>();
    for (const note of notes) {
        const written = score.notes[note.writtenIndex];
        const key = `${note.staffKey}|${note.midi}`;
        const chainStart = open.get(key);

        if (written.tieStop && chainStart && Math.abs(chainStart.onsetBeats + chainStart.playDurationBeats - note.onsetBeats) < 1e-6) {
            note.tieContinuation = true;
            note.playDurationBeats = 0;
            chainStart.playDurationBeats = snapBeats(note.onsetBeats + note.durationBeats - chainStart.onsetBeats);
            if (!written.tieStart) open.delete(key);
            continue;
        }

        if (written.tieStart) open.set(key, note);
        else open.delete(key);
    }
}

/** Notes that are new attacks (not tie continuations, not grace notes). */
export function isPlayableAttack(note: NoteEvent): boolean {
    return !note.tieContinuation && !note.isGrace;
}

/** The playback-order measure that contains a beat (last measure if past the end). */
export function measureAtBeat(timeline: ScoreTimeline, beat: number): TimelineMeasure | undefined {
    let found: TimelineMeasure | undefined;
    for (const measure of timeline.measures) {
        if (measure.startBeats <= beat + 1e-9) found = measure;
        else break;
    }
    return found ?? timeline.measures[0];
}
