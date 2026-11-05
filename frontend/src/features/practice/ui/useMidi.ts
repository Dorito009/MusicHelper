import * as React from "react";
import { midiManager, type MidiState } from "../midi/webmidi.ts";
import { usePracticeSettings } from "../settings/store.ts";

/** MIDI access state and device lists; starts the permission check on first use. */
export function useMidiState(): MidiState {
    React.useEffect(() => {
        void midiManager.init();
    }, []);
    return React.useSyncExternalStore(midiManager.subscribe, midiManager.getState, midiManager.getState);
}

export interface SelectedDevices {
    midi: MidiState;
    inputName: string | null;
    outputName: string | null;
    inputConnected: boolean;
    outputConnected: boolean;
    /** True when the computer keyboard should act as a note input. */
    useComputerKeyboard: boolean;
}

/** The selected devices (remembered by name) and whether they're connected right now. */
export function useSelectedDevices(): SelectedDevices {
    const midi = useMidiState();
    const inputName = usePracticeSettings((s) => s.midi.inputName);
    const outputName = usePracticeSettings((s) => s.midi.outputName);
    const keyboardSetting = usePracticeSettings((s) => s.input.computerKeyboard);
    const update = usePracticeSettings((s) => s.update);

    const inputConnected = inputName !== null && midi.inputs.some((p) => p.name === inputName);
    const outputConnected = outputName !== null && midi.outputs.some((p) => p.name === outputName);

    // With exactly one MIDI input and none chosen yet, use it.
    React.useEffect(() => {
        if (midi.status === "ready" && inputName === null && midi.inputs.length === 1) {
            update("midi", { inputName: midi.inputs[0].name });
        }
    }, [midi.status, midi.inputs, inputName, update]);

    const useComputerKeyboard = keyboardSetting === "on" || (keyboardSetting === "auto" && !inputConnected);
    return { midi, inputName, outputName, inputConnected, outputConnected, useComputerKeyboard };
}
