import * as React from "react";
import {
    buildChord,
    formatNoteASCII,
    getChordTypeById,
    invertChord as invertMusiclibChord,
    noteFromString,
    type Chord,
    type ChordType,
    type Note,
} from "musiclib";
import { useStringPreference } from "./preferences.ts";

type SavedChord = {
    uid?: string;
    root: string;
    typeId: string;
    inversion: number;
};

export type SavedChordEntry = {
    uid: string;
    chord: Chord;
};

function createChordUid(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `chord-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createChordEntry(chord: Chord, uid: string = createChordUid()): SavedChordEntry {
    return {
        uid,
        chord: {
            ...chord,
            inversion: chord.inversion ?? 0,
        },
    };
}

function createStoredChord(root: Note, type: ChordType, inversion: number = 0): Chord {
    const chord = buildChord(root, type);

    if (!Number.isFinite(inversion) || inversion <= 0) {
        return {
            ...chord,
            inversion: 0,
        };
    }

    return invertMusiclibChord(
        {
            ...chord,
            inversion: 0,
        },
        Math.floor(inversion)
    );
}

function changeCordInversion(chord: Chord, direction: -1 | 1): Chord {
    if (direction > 0) {
        const maxInversion = Math.max(chord.notes.length - 1, 0);

        if ((chord.inversion ?? 0) >= maxInversion) {
            return chord;
        }

        return invertMusiclibChord(chord, (chord.inversion ?? 0) + 1);
    }

    const currentInversion = chord.inversion ?? 0;

    if (currentInversion <= 0) {
        return chord;
    }

    return invertMusiclibChord(chord, currentInversion - 1);
}

function serializeChords(chordEntries: SavedChordEntry[]): string {
    const payload: SavedChord[] = chordEntries.map(({ uid, chord }) => ({
        uid,
        root: formatNoteASCII(chord.root),
        typeId: chord.type.id,
        inversion: chord.inversion ?? 0,
    }));

    return JSON.stringify(payload);
}
function parseChords(value: string): SavedChordEntry[] {
    try {
        const parsed = JSON.parse(value);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.flatMap((entry) => {
            if (
                !entry ||
                typeof entry.root !== "string" ||
                typeof entry.typeId !== "string"
            ) {
                return [];
            }

            const root = noteFromString(entry.root);
            const type = getChordTypeById(entry.typeId);
            const inversion = Number.isFinite(entry.inversion) ? entry.inversion : 0;

            if (!root || !type) {
                return [];
            }

            return [
                createChordEntry(
                    createStoredChord(root, type, inversion),
                    typeof entry.uid === "string" && entry.uid !== "" ? entry.uid : createChordUid()
                ),
            ];
        });
    } catch {
        return [];
    }
}

function reorderChordEntries(entries: SavedChordEntry[], fromIndex: number, toIndex: number): SavedChordEntry[] {
    if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= entries.length ||
        toIndex >= entries.length ||
        fromIndex === toIndex
    ) {
        return entries;
    }

    const next = [...entries];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
}

type UseSavedChordsResult = {
    chordEntries: SavedChordEntry[];
    chords: Chord[];
    addChord: (chord: Chord) => void;
    removeChord: (index: number) => void;
    moveChord: (index: number, direction: -1 | 1) => void;
    reorderChords: (fromUid: string, toUid: string) => void;
    invertChord: (index: number, direction: -1 | 1) => void;
    clearChords: () => void;
}




export function useSavedChords(storageKey: string): UseSavedChordsResult {
    const [savedValue, setSavedValue] = useStringPreference(storageKey, "[]");
    const [chordEntries, setChordEntries] = React.useState<SavedChordEntry[]>(() => parseChords(savedValue));

    const chords = React.useMemo(() => chordEntries.map(({ chord }) => chord), [chordEntries]);

    React.useEffect(() => {
        setSavedValue(serializeChords(chordEntries));
    }, [chordEntries, setSavedValue]);

    const addChord = React.useCallback((chord: Chord) => {
        setChordEntries((prev) => [...prev, createChordEntry(chord)]);
    }, []);

    const removeChord = React.useCallback((index: number) => {
        setChordEntries((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const moveChord = React.useCallback((index: number, direction: -1 | 1) => {
        setChordEntries((prev) => {
            const targetIndex = index + direction;

            return reorderChordEntries(prev, index, targetIndex);
        });
    }, []);

    const reorderChords = React.useCallback((fromUid: string, toUid: string) => {
        setChordEntries((prev) => {
            const fromIndex = prev.findIndex((entry) => entry.uid === fromUid);
            const toIndex = prev.findIndex((entry) => entry.uid === toUid);

            return reorderChordEntries(prev, fromIndex, toIndex);
        });
    }, []);

    const invertChord = React.useCallback((index: number, direction: -1 | 1) => {
        setChordEntries((prev) =>
            prev.map((entry, i) => {
                if (i !== index) {
                    return entry;
                }

                return {
                    ...entry,
                    chord: changeCordInversion(entry.chord, direction),
                };
            })
        );
    }, []);

    const clearChords = React.useCallback(() => {
        setChordEntries([]);
    }, []);

    return {
        chordEntries,
        chords,
        addChord,
        removeChord,
        moveChord,
        reorderChords,
        invertChord,
        clearChords,
    };
}




