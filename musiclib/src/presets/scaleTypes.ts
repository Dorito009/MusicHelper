import rawScaleTypes from "./scaleTypes.json" with { type: "json" };
import type { ScaleType } from "../types/scaleTypes.js";

const scaleTypes = Object.freeze(
    (rawScaleTypes as ScaleType[]).map((scaleType) => Object.freeze({ ...scaleType }))
) as readonly Readonly<ScaleType>[];

const scaleTypesById: ReadonlyMap<string, Readonly<ScaleType>> = new Map(
    scaleTypes.map((scaleType) => [scaleType.id, scaleType])
);

export function getScaleTypeById(id: string): Readonly<ScaleType> | undefined {
    return scaleTypesById.get(id);
}

export function getAllScaleTypes(): readonly Readonly<ScaleType>[] {
    return scaleTypes;
}
