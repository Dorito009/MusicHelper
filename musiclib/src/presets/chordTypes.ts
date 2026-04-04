import rawChordTypes from "./chordTypes.json" with { type: "json" };
import {ChordFamily, ChordType, ChordTypeId,} from "../types/chordType.js";

const ChordTypes = Object.freeze(
    (rawChordTypes as ChordType[]).map((chordType) => Object.freeze({ ...chordType }))
) as readonly Readonly<ChordType>[];

const chordTypeById: ReadonlyMap<ChordType["id"], Readonly<ChordType>> = new Map(
    ChordTypes.map((chordType) => [chordType.id, chordType])
);

const chordTypesByFamily: ReadonlyMap<ChordFamily, readonly Readonly<ChordType>[]> = new Map(
    Object.entries(
        ChordTypes.reduce<Record<ChordFamily, Readonly<ChordType>[]>>((acc, chordType) => {
            if (!acc[chordType.family]) {
                acc[chordType.family] = [];
            }

            acc[chordType.family].push(chordType);
            return acc;
        }, {} as Record<ChordFamily, Readonly<ChordType>[]>)
    ) as [ChordFamily, readonly Readonly<ChordType>[]][]
);

export function getChordTypeById(id: string | ChordTypeId): ChordType | undefined {
    return chordTypeById.get(id as ChordTypeId)
}

export function getChordTypesByFamily(family: string | ChordFamily): readonly Readonly<ChordType>[] | undefined {
    return chordTypesByFamily.get(family as ChordFamily);
}

export function getAllChordTypes(): readonly Readonly<ChordType>[] {
    return ChordTypes
}

export function getAllChordFamilies(): readonly ChordFamily[] {
    return Object.keys(chordTypesByFamily) as ChordFamily[];
}
