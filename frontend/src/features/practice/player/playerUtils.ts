import type { StaffInfo } from "../engine/types.ts";

export const MIN_BPM = 10;
export const MAX_BPM = 400;

export function clampBpm(bpm: number): number {
    return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

const CLEF_NAMES: Record<string, string> = { G: "treble", F: "bass", C: "C clef", percussion: "percussion", TAB: "tab", none: "" };

export function staffLabel(staff: StaffInfo): string {
    const clef = CLEF_NAMES[staff.clef] ?? "";
    if (staff.stavesInPart > 1) return `${staff.partName}, staff ${staff.staff}${clef ? ` (${clef})` : ""}`;
    return staff.partName;
}

/** "You tend to play 18 ms late." */
export function describeOffset(mean: number | null): string {
    if (mean === null) return "";
    const ms = Math.round(Math.abs(mean));
    if (ms < 5) return "Your timing is right on the beat on average.";
    return `You tend to play ${ms} ms ${mean < 0 ? "early" : "late"}.`;
}
