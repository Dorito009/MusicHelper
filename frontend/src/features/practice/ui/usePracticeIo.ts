import * as React from "react";
import { PracticeIo } from "../session/io.ts";
import { usePracticeSettings } from "../settings/store.ts";
import type { SelectedDevices } from "./useMidi.ts";

/** One PracticeIo for the lifetime of a page, kept in sync with the selected devices. */
export function usePracticeIo(devices: SelectedDevices): PracticeIo | null {
    const [io, setIo] = React.useState<PracticeIo | null>(null);
    const keyboardOctave = usePracticeSettings((s) => s.input.keyboardOctave);

    React.useEffect(() => {
        const created = new PracticeIo();
        setIo(created);
        return () => created.dispose();
    }, []);

    React.useEffect(() => {
        io?.configureInputs({
            midiInputName: devices.inputConnected ? devices.inputName : null,
            useComputerKeyboard: devices.useComputerKeyboard,
            keyboardOctave,
        });
    }, [io, devices.inputConnected, devices.inputName, devices.useComputerKeyboard, keyboardOctave, devices.midi.inputs]);

    return io;
}
