import type { ParsedScore, StaffKey } from "./types.ts";

/** "me" = I play it (graded, not sent). "app" = the app plays it over MIDI. "off" = shown only. */
export type StaffRole = "me" | "app" | "off";

/** How dynamics reach the sampler: note velocity, CC1 (mod wheel), or both. */
export type DynamicsMode = "velocity" | "cc1" | "both";

export interface StaffConfig {
    role: StaffRole;
    /** MIDI channel 1-16. */
    channel: number;
    dynamics: DynamicsMode;
}

/** Written measure indices, inclusive, 0-based. */
export interface LoopRange {
    from: number;
    to: number;
}

export interface TempoTrainerState {
    enabled: boolean;
    startBpm: number;
    targetBpm: number;
    stepBpm: number;
    /** Accuracy % needed to step up. */
    threshold: number;
    /** Where the trainer is now. */
    currentBpm: number;
}

export interface ScoreConfig {
    staves: Record<StaffKey, StaffConfig>;
    /** Last tempo used, as quarter-note BPM (null = score tempo). */
    lastBpm: number | null;
    loop: LoopRange | null;
    trainer: TempoTrainerState | null;
}

export interface ChannelDefaults {
    /** First channel for "app plays" staves (2 by default). */
    firstAccompanimentChannel: number;
    /** Channels to skip when assigning (thru and metronome). */
    reservedChannels: number[];
}

/**
 * Defaults for a new score: the first staff, or both staves of a two-staff first part (piano),
 * is "I play". Every other staff is "App plays" on its own channel: 2, 3, 4 and so on.
 */
export function defaultScoreConfig(score: Pick<ParsedScore, "staves">, defaults: ChannelDefaults): ScoreConfig {
    const staves: Record<StaffKey, StaffConfig> = {};
    const first = score.staves[0];
    const myStaves = new Set<StaffKey>();
    if (first) {
        myStaves.add(first.key);
        if (first.stavesInPart === 2) {
            for (const staff of score.staves) if (staff.partId === first.partId) myStaves.add(staff.key);
        }
    }

    const reserved = new Set(defaults.reservedChannels);
    let next = clampChannel(defaults.firstAccompanimentChannel);
    const takeChannel = () => {
        for (let attempts = 0; attempts < 16; attempts++) {
            const channel = next;
            next = next >= 16 ? 1 : next + 1;
            if (!reserved.has(channel)) return channel;
        }
        return clampChannel(defaults.firstAccompanimentChannel);
    };

    for (const staff of score.staves) {
        if (myStaves.has(staff.key)) {
            staves[staff.key] = { role: "me", channel: 1, dynamics: "velocity" };
        } else {
            staves[staff.key] = { role: "app", channel: takeChannel(), dynamics: "velocity" };
        }
    }

    return { staves, lastBpm: null, loop: null, trainer: null };
}

/** Fills in staves that are missing from a stored config (e.g. after the file changed). */
export function completeScoreConfig(config: ScoreConfig | undefined, score: Pick<ParsedScore, "staves">, defaults: ChannelDefaults): ScoreConfig {
    const fresh = defaultScoreConfig(score, defaults);
    if (!config) return fresh;
    const staves: Record<StaffKey, StaffConfig> = {};
    for (const staff of score.staves) {
        staves[staff.key] = config.staves?.[staff.key] ?? fresh.staves[staff.key];
    }
    return { ...fresh, ...config, staves };
}

export function clampChannel(channel: number): number {
    if (!Number.isFinite(channel)) return 1;
    return Math.min(16, Math.max(1, Math.round(channel)));
}
