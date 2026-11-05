// Maps MusicXML dynamics to MIDI velocity (1-127).

export const DEFAULT_VELOCITY = 80; // mf

/** Velocity for each sustained dynamic level. */
const LEVELS: Record<string, number> = {
    pppppp: 8,
    ppppp: 12,
    pppp: 16,
    ppp: 24,
    pp: 36,
    p: 50,
    mp: 64,
    mf: 80,
    f: 96,
    ff: 110,
    fff: 120,
    ffff: 127,
    fffff: 127,
    ffffff: 127,
    n: 8,
};

/** Accents that apply to the note they are attached to, and optionally change the level after it. */
const MOMENTARY: Record<string, { velocity: number; then?: number }> = {
    sf: { velocity: 110 },
    sfz: { velocity: 110 },
    sffz: { velocity: 122 },
    fz: { velocity: 110 },
    rf: { velocity: 100 },
    rfz: { velocity: 104 },
    sfp: { velocity: 110, then: LEVELS.p },
    sfpp: { velocity: 110, then: LEVELS.pp },
    fp: { velocity: 96, then: LEVELS.p },
    sfzp: { velocity: 110, then: LEVELS.p },
    pf: { velocity: 50, then: LEVELS.f },
};

export interface DynamicMark {
    /** Velocity of the note at the mark's position. */
    velocity: number;
    /** True when only the note at this position is affected. */
    momentary: boolean;
    /** Level that applies after a momentary mark (e.g. "fp" continues at p). */
    then?: number;
}

export function dynamicMarkFromName(name: string): DynamicMark | null {
    const key = name.trim().toLowerCase();
    if (key in LEVELS) {
        return { velocity: LEVELS[key], momentary: false };
    }
    const momentary = MOMENTARY[key];
    if (momentary) {
        return { velocity: momentary.velocity, momentary: true, then: momentary.then };
    }
    return null;
}

/**
 * MusicXML `dynamics` attributes are a percentage of the default forte velocity (90),
 * so dynamics="100" means velocity 90.
 */
export function velocityFromPercent(percent: number): number {
    return clampVelocity(Math.round((percent / 100) * 90));
}

export function clampVelocity(value: number): number {
    if (!Number.isFinite(value)) return DEFAULT_VELOCITY;
    return Math.min(127, Math.max(1, Math.round(value)));
}
