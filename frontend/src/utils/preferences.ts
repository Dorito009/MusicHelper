import * as React from "react";

const SETTINGS_EVENT = "music-helper:settings-changed";
const PREFER_SIMPLE_SPELLINGS_KEY = "music-helper:prefer-simple-spellings";

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

function writeBooleanSetting(key: string, value: boolean) {
    window.localStorage.setItem(key, String(value));
    window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: { key, value } }));
}

function writeStringSetting(key: string, value: string) {
    window.localStorage.setItem(key, value);
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
