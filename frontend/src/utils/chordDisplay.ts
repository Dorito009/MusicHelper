import {simplifyChord, simplifyScale, type Chord, type Scale} from "musiclib";

export function getDisplayChord(chord: Chord, preferSimpleSpellings: boolean): Chord {
    return preferSimpleSpellings
        ? simplifyChord(chord, "sharp")
        : chord;
}

export function getDisplayScale(scale: Scale, preferSimpleSpellings: boolean): Scale {
    return preferSimpleSpellings
        ? simplifyScale(scale, "sharp")
        : scale;
}
