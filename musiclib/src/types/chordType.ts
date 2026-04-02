export type ChordFamily = "power" | "suspended" | "triad" | "seventh" | "sixth" | "added-tone";

export type ChordTypeId = "5" | "sus2" | "sus4" | "maj" | "min" | "dim" | "aug" | "7" | "maj7" | "m7" | "mmaj7" | "maj7#5" | "m7b5" | "dim7" | "6" | "m6" | "add9" | "madd9" | "6/9" | "m6/9";

export type ChordType = {
    id: ChordTypeId;
    name: string;
    shortName: string;
    family: ChordFamily;
    intervals: number[];
};
