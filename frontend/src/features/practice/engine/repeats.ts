import type { ParsedMeasure } from "./types.ts";

/** Safety limit so a malformed file can't create an endless playback order. */
const MAX_PLAYBACK_MEASURES = 20000;

/**
 * Expands repeat barlines and 1st/2nd endings into the order measures are played.
 * Returns written measure indices. D.C./D.S./Coda are not followed.
 */
export function expandRepeats(measures: readonly ParsedMeasure[]): number[] {
    const order: number[] = [];
    let sectionStart = 0;
    let pass = 1;
    let jumpedTo: number | null = null;
    const timesRepeated = new Map<number, number>();
    let i = 0;

    while (i < measures.length && order.length < MAX_PLAYBACK_MEASURES) {
        const measure = measures[i];

        if (measure.repeatForward && jumpedTo !== i) {
            sectionStart = i;
            pass = 1;
        }
        jumpedTo = null;

        // Skip endings that don't belong to this pass.
        if (measure.endingNumbers && !measure.endingNumbers.includes(pass)) {
            i++;
            continue;
        }

        order.push(i);

        if (measure.repeatBackward) {
            const done = timesRepeated.get(i) ?? 0;
            if (done < effectiveRepeatTimes(measures, i) - 1) {
                timesRepeated.set(i, done + 1);
                pass++;
                i = sectionStart;
                jumpedTo = sectionStart;
                continue;
            }
            // Leaving the repeated section.
            timesRepeated.delete(i);
            pass = 1;
            sectionStart = i + 1;
        } else if (measure.endingNumbers && isLastMeasureOfEnding(measures, i)) {
            // End of the final ending: the volta structure is finished.
            const next = measures[i + 1];
            const nextIsAnotherEnding = next?.endingNumbers && next.endingNumbers !== measure.endingNumbers;
            if (!nextIsAnotherEnding) {
                pass = 1;
                sectionStart = i + 1;
            }
        }

        i++;
    }

    return order;
}

/**
 * How many times a backward repeat is played. Inside an ending, the endings that follow decide it:
 * endings "1, 2" then "3" mean three passes even when the file doesn't set `times`.
 */
function effectiveRepeatTimes(measures: readonly ParsedMeasure[], index: number): number {
    const measure = measures[index];
    let times = measure.repeatTimes;
    if (!measure.endingNumbers) return times;
    for (let j = index; j < measures.length && measures[j].endingNumbers; j++) {
        times = Math.max(times, ...measures[j].endingNumbers!);
    }
    return times;
}

function isLastMeasureOfEnding(measures: readonly ParsedMeasure[], index: number): boolean {
    const current = measures[index].endingNumbers;
    const next = measures[index + 1];
    return !next || next.endingNumbers !== current;
}

export function hasRepeats(measures: readonly ParsedMeasure[]): boolean {
    return measures.some((m) => m.repeatBackward || m.repeatForward || m.endingNumbers !== null);
}
