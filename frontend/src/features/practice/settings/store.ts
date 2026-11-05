import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { z } from "zod";

// Global practice settings. Stored under their own key; the theory preferences are never read.
export const PRACTICE_SETTINGS_KEY = "music-helper:practice:settings";
export const PRACTICE_SETTINGS_VERSION = 1;

const channel = z.number().int().min(1).max(16);
const midiNote = z.number().int().min(0).max(127);
const velocity = z.number().int().min(1).max(127);

const midiSchema = z.object({
    inputName: z.string().nullable(),
    outputName: z.string().nullable(),
    thruEnabled: z.boolean(),
    thruChannel: channel,
    firstAccompanimentChannel: channel,
    metronomeChannel: channel,
    metronomeDownbeatNote: midiNote,
    metronomeBeatNote: midiNote,
    metronomeVelocity: velocity,
});

const playbackSchema = z.object({
    defaultMode: z.enum(["wait", "play"]),
    countInBars: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    metronomeOn: z.boolean(),
});

const gradingSchema = z.object({
    toleranceMs: z.number().min(20).max(400),
    rhythmOnly: z.boolean(),
});

const latencySchema = z.object({
    offsetMs: z.number().min(-500).max(500),
    lastCalibration: z
        .object({ medianMs: z.number(), spreadMs: z.number(), taps: z.number(), at: z.number() })
        .nullable(),
});

const trainerSchema = z.object({
    stepBpm: z.number().min(1).max(40),
    threshold: z.number().min(50).max(100),
});

const displaySchema = z.object({
    zoom: z.number().min(0.4).max(2.5),
    followCursor: z.boolean(),
    showPiano: z.boolean(),
});

const inputSchema = z.object({
    /** "auto" = on when no MIDI input is selected. */
    computerKeyboard: z.enum(["auto", "on", "off"]),
    /** Octave of the A key (C of that octave). 4 = middle C. */
    keyboardOctave: z.number().int().min(0).max(8),
});

export const practiceSettingsSchema = z.object({
    midi: midiSchema,
    playback: playbackSchema,
    grading: gradingSchema,
    latency: latencySchema,
    trainer: trainerSchema,
    display: displaySchema,
    input: inputSchema,
});

export type PracticeSettings = z.infer<typeof practiceSettingsSchema>;
export type PracticeMode = PracticeSettings["playback"]["defaultMode"];

export const DEFAULT_PRACTICE_SETTINGS: PracticeSettings = {
    midi: {
        inputName: null,
        outputName: null,
        thruEnabled: true,
        thruChannel: 1,
        firstAccompanimentChannel: 2,
        metronomeChannel: 10,
        metronomeDownbeatNote: 76, // GM hi wood block
        metronomeBeatNote: 77, // GM low wood block
        metronomeVelocity: 100,
    },
    playback: { defaultMode: "wait", countInBars: 1, metronomeOn: true },
    grading: { toleranceMs: 100, rhythmOnly: false },
    latency: { offsetMs: 0, lastCalibration: null },
    trainer: { stepBpm: 5, threshold: 90 },
    display: { zoom: 1, followCursor: true, showPiano: true },
    input: { computerKeyboard: "auto", keyboardOctave: 4 },
};

type SectionKey = keyof PracticeSettings;

/**
 * Validates stored settings section by section. A section that fails validation
 * falls back to its defaults; missing fields are filled from the defaults.
 */
export function sanitizePracticeSettings(raw: unknown): PracticeSettings {
    const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const result = {} as Record<SectionKey, unknown>;
    for (const key of Object.keys(DEFAULT_PRACTICE_SETTINGS) as SectionKey[]) {
        const defaults = DEFAULT_PRACTICE_SETTINGS[key];
        const stored = source[key];
        const merged = stored && typeof stored === "object" ? { ...defaults, ...(stored as object) } : defaults;
        const parsed = practiceSettingsSchema.shape[key].safeParse(merged);
        result[key] = parsed.success ? parsed.data : defaults;
    }
    return result as PracticeSettings;
}

interface SettingsActions {
    update: <K extends SectionKey>(section: K, values: Partial<PracticeSettings[K]>) => void;
    reset: () => void;
}

export type PracticeSettingsState = PracticeSettings & SettingsActions;

export const usePracticeSettings = create<PracticeSettingsState>()(
    persist(
        (set) => ({
            ...DEFAULT_PRACTICE_SETTINGS,
            update: (section, values) =>
                set((state) => sanitizeSection(section, { ...state[section], ...values })),
            reset: () => set({ ...DEFAULT_PRACTICE_SETTINGS }),
        }),
        {
            name: PRACTICE_SETTINGS_KEY,
            version: PRACTICE_SETTINGS_VERSION,
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => {
                const settings = {} as Record<SectionKey, unknown>;
                for (const key of Object.keys(DEFAULT_PRACTICE_SETTINGS) as SectionKey[]) settings[key] = state[key];
                return settings as PracticeSettings;
            },
            // Future versions add steps here; every version ends with zod validation.
            migrate: (persisted) => sanitizePracticeSettings(persisted),
            merge: (persisted, current) => ({ ...current, ...sanitizePracticeSettings(persisted) }),
        },
    ),
);

function sanitizeSection<K extends SectionKey>(section: K, value: unknown): Partial<PracticeSettings> {
    const parsed = practiceSettingsSchema.shape[section].safeParse(value);
    return parsed.success ? ({ [section]: parsed.data } as Partial<PracticeSettings>) : {};
}

/** Reads settings outside React. */
export function getPracticeSettings(): PracticeSettings {
    return usePracticeSettings.getState();
}

export function channelDefaultsFromSettings(settings: PracticeSettings) {
    return {
        firstAccompanimentChannel: settings.midi.firstAccompanimentChannel,
        reservedChannels: [settings.midi.thruChannel, settings.midi.metronomeChannel],
    };
}
