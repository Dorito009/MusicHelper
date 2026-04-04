import * as React from "react";

const SETTINGS_EVENT = "music-helper:settings-changed";
const PREFER_SIMPLE_SPELLINGS_KEY = "music-helper:prefer-simple-spellings";
const PREFER_SIMPLE_CHORD_LABELS_KEY = "music-helper:prefer-simple-chord-labels";
const CHORD_VISIBILITY_KEY = "music-helper:chord-visibility";
const SOUND_MUTED_KEY = "music-helper:sound-muted";
const INSTRUMENT_KEY = "music-helper:instrument";
const ACCIDENTAL_DISPLAY_KEY = "music-helper:accidental-display";

export type ChordVisibilityKey = "sus2" | "triads" | "sus4" | "sevenths" | "fifths" | "sixths" | "add9";

export type ChordVisibilitySettings = Record<ChordVisibilityKey, boolean>;

export type AccidentalDisplay = {
    sharp: "ascii" | "unicode";
    flat: "ascii" | "unicode";
    doubleSharp: "ascii" | "unicode" | "repeated-unicode";
    doubleFlat: "ascii" | "unicode" | "repeated-unicode";
};

type AccidentalDisplayValue = AccidentalDisplay[keyof AccidentalDisplay];

const DEFAULT_CHORD_VISIBILITY_SETTINGS: ChordVisibilitySettings = {
    sus2: true,
    triads: true,
    sus4: true,
    sevenths: true,
    fifths: false,
    sixths: false,
    add9: false,
};

export const DEFAULT_ACCIDENTAL_DISPLAY: AccidentalDisplay = {
    sharp: "unicode",
    flat: "unicode",
    doubleSharp: "unicode",
    doubleFlat: "unicode",
};

function isMobileLikeDevice() {
    if (typeof window === "undefined") {
        return false;
    }

    const isMobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent);
    const isCoarsePointer = typeof window.matchMedia === "function"
        ? window.matchMedia("(pointer: coarse)").matches
        : false;

    return isMobileUserAgent || isCoarsePointer;
}

function getDefaultAccidentalDisplay(): AccidentalDisplay {
    if (isMobileLikeDevice()) {
        return {
            sharp: "unicode",
            flat: "unicode",
            doubleSharp: "repeated-unicode",
            doubleFlat: "unicode",
        };
    }

    return DEFAULT_ACCIDENTAL_DISPLAY;
}

function readStringSetting(key: string, defaultValue: string): string {
    if (typeof window === "undefined") {
        return defaultValue;
    }

    return window.localStorage.getItem(key) ?? defaultValue;
}

function readBooleanSetting(key: string, defaultValue: boolean): boolean {
    if (typeof window === "undefined") {
        return defaultValue;
    }

    const storedValue = window.localStorage.getItem(key);

    if (storedValue === null) {
        return defaultValue;
    }

    return storedValue === "true";
}

function readJsonSetting<T extends object>(key: string, defaultValue: T): T {
    if (typeof window === "undefined") {
        return defaultValue;
    }

    const storedValue = window.localStorage.getItem(key);

    if (storedValue === null) {
        return defaultValue;
    }

    try {
        const parsedValue = JSON.parse(storedValue);

        if (parsedValue && typeof parsedValue === "object") {
            return {
                ...defaultValue,
                ...parsedValue,
            };
        }
    } catch {
        return defaultValue;
    }

    return defaultValue;
}

function writeBooleanSetting(key: string, value: boolean) {
    window.localStorage.setItem(key, String(value));
    window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: { key, value } }));
}

function writeStringSetting(key: string, value: string) {
    window.localStorage.setItem(key, value);
    window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: { key, value } }));
}

function writeJsonSetting<T extends object>(key: string, value: T) {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: { key, value } }));
}

export function useBooleanPreference(key: string, defaultValue: boolean) {
    const [value, setValue] = React.useState(() => readBooleanSetting(key, defaultValue));

    React.useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key !== key) {
                return;
            }

            setValue(event.newValue === null ? defaultValue : event.newValue === "true");
        };

        const handleSettingsChange = (event: Event) => {
            const customEvent = event as CustomEvent<{ key?: string; value?: boolean }>;

            if (customEvent.detail?.key === key && typeof customEvent.detail.value === "boolean") {
                setValue(customEvent.detail.value);
            }
        };

        window.addEventListener("storage", handleStorage);
        window.addEventListener(SETTINGS_EVENT, handleSettingsChange as EventListener);

        return () => {
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener(SETTINGS_EVENT, handleSettingsChange as EventListener);
        };
    }, [defaultValue, key]);

    const updateValue = React.useCallback(
        (nextValue: boolean) => {
            setValue(nextValue);
            writeBooleanSetting(key, nextValue);
        },
        [key]
    );

    return [value, updateValue] as const;
}

export function useStringPreference(key: string, defaultValue: string) {
    const [value, setValue] = React.useState(() => readStringSetting(key, defaultValue));

    React.useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key !== key) {
                return;
            }

            setValue(event.newValue ?? defaultValue);
        };

        const handleSettingsChange = (event: Event) => {
            const customEvent = event as CustomEvent<{ key?: string; value?: string }>;

            if (customEvent.detail?.key === key && typeof customEvent.detail.value === "string") {
                setValue(customEvent.detail.value);
            }
        };

        window.addEventListener("storage", handleStorage);
        window.addEventListener(SETTINGS_EVENT, handleSettingsChange as EventListener);

        return () => {
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener(SETTINGS_EVENT, handleSettingsChange as EventListener);
        };
    }, [defaultValue, key]);

    const updateValue = React.useCallback(
        (nextValue: string) => {
            setValue(nextValue);
            writeStringSetting(key, nextValue);
        },
        [key]
    );

    return [value, updateValue] as const;
}

export function usePreferSimpleSpellings() {
    return useBooleanPreference(PREFER_SIMPLE_SPELLINGS_KEY, false);
}

export function usePreferSimpleChordLabels() {
    return useBooleanPreference(PREFER_SIMPLE_CHORD_LABELS_KEY, false);
}

export function useChordVisibilityPreferences() {
    const [value, setValue] = React.useState(() => readJsonSetting(CHORD_VISIBILITY_KEY, DEFAULT_CHORD_VISIBILITY_SETTINGS));

    React.useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key !== CHORD_VISIBILITY_KEY) {
                return;
            }

            setValue(event.newValue === null
                ? DEFAULT_CHORD_VISIBILITY_SETTINGS
                : readJsonSetting(CHORD_VISIBILITY_KEY, DEFAULT_CHORD_VISIBILITY_SETTINGS));
        };

        const handleSettingsChange = (event: Event) => {
            const customEvent = event as CustomEvent<{ key?: string; value?: ChordVisibilitySettings }>;

            if (customEvent.detail?.key === CHORD_VISIBILITY_KEY && customEvent.detail.value) {
                setValue({
                    ...DEFAULT_CHORD_VISIBILITY_SETTINGS,
                    ...customEvent.detail.value,
                });
            }
        };

        window.addEventListener("storage", handleStorage);
        window.addEventListener(SETTINGS_EVENT, handleSettingsChange as EventListener);

        return () => {
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener(SETTINGS_EVENT, handleSettingsChange as EventListener);
        };
    }, []);

    const updateValue = React.useCallback((nextValue: ChordVisibilitySettings) => {
        setValue(nextValue);
        writeJsonSetting(CHORD_VISIBILITY_KEY, nextValue);
    }, []);

    const updateSingleValue = React.useCallback((key: ChordVisibilityKey, checked: boolean) => {
        setValue((previousValue) => {
            const nextValue = {
                ...previousValue,
                [key]: checked,
            };

            writeJsonSetting(CHORD_VISIBILITY_KEY, nextValue);
            return nextValue;
        });
    }, []);

    return [value, updateValue, updateSingleValue] as const;
}

export function useAccidentalDisplayPreference() {
    const [value, setValue] = React.useState(() => readJsonSetting(ACCIDENTAL_DISPLAY_KEY, getDefaultAccidentalDisplay()));

    React.useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key !== ACCIDENTAL_DISPLAY_KEY) {
                return;
            }

            setValue(event.newValue === null
                ? getDefaultAccidentalDisplay()
                : readJsonSetting(ACCIDENTAL_DISPLAY_KEY, getDefaultAccidentalDisplay()));
        };

        const handleSettingsChange = (event: Event) => {
            const customEvent = event as CustomEvent<{ key?: string; value?: AccidentalDisplay }>;

            if (customEvent.detail?.key === ACCIDENTAL_DISPLAY_KEY && customEvent.detail.value) {
                setValue({
                    ...getDefaultAccidentalDisplay(),
                    ...customEvent.detail.value,
                });
            }
        };

        window.addEventListener("storage", handleStorage);
        window.addEventListener(SETTINGS_EVENT, handleSettingsChange as EventListener);

        return () => {
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener(SETTINGS_EVENT, handleSettingsChange as EventListener);
        };
    }, []);

    const updateValue = React.useCallback((nextValue: AccidentalDisplay) => {
        setValue(nextValue);
        writeJsonSetting(ACCIDENTAL_DISPLAY_KEY, nextValue);
    }, []);

    const updateSingleValue = React.useCallback((key: keyof AccidentalDisplay, nextValue: AccidentalDisplayValue) => {
        setValue((previousValue) => {
            const updatedValue = {
                ...previousValue,
                [key]: nextValue,
            };

            writeJsonSetting(ACCIDENTAL_DISPLAY_KEY, updatedValue);
            return updatedValue;
        });
    }, []);

    return [value, updateValue, updateSingleValue] as const;
}

export function useSoundMuted() {
    return useBooleanPreference(SOUND_MUTED_KEY, false);
}

export function useInstrument() {
    return useStringPreference(INSTRUMENT_KEY, "acoustic_grand_piano");
}
