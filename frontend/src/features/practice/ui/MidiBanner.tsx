import { Alert, AlertTitle, Button } from "@mui/material";
import { midiManager } from "../midi/webmidi.ts";
import type { SelectedDevices } from "./useMidi.ts";

/** Explains what's wrong with MIDI right now, if anything. Renders nothing when all is well. */
export function MidiBanner({ devices, compact = false }: { devices: SelectedDevices; compact?: boolean }) {
    const { midi } = devices;

    switch (midi.status) {
        case "unsupported":
            return (
                <Alert severity="warning">
                    <AlertTitle>This browser doesn't support Web MIDI</AlertTitle>
                    Use Chrome, Edge or Opera on a computer to connect your keyboard and sampler. You can still
                    play with the computer keyboard, but nothing will sound.
                </Alert>
            );
        case "insecure":
            return (
                <Alert severity="warning">
                    <AlertTitle>MIDI needs a secure connection</AlertTitle>
                    Web MIDI only works over https (or on localhost). Open this page with an https address.
                </Alert>
            );
        case "prompt":
        case "idle":
            return (
                <Alert
                    severity="info"
                    action={<Button color="inherit" onClick={() => void midiManager.enable()}>Allow MIDI access</Button>}
                >
                    Allow MIDI access to use your MIDI keyboard and to send notes to your sampler.
                    Your browser will ask for permission.
                </Alert>
            );
        case "requesting":
            return <Alert severity="info">Waiting for MIDI permission. Check your browser's prompt.</Alert>;
        case "denied":
            return (
                <Alert severity="error">
                    <AlertTitle>MIDI access is blocked</AlertTitle>
                    Allow MIDI for this site in your browser's site settings (the icon to the left of the address
                    bar), then reload the page. Until then you can play with the computer keyboard, but nothing will sound.
                </Alert>
            );
        case "error":
            return <Alert severity="error">MIDI couldn't be started: {midi.error}</Alert>;
        case "ready":
            break;
    }

    if (midi.outputs.length === 0) {
        return (
            <Alert severity="warning">
                <AlertTitle>No MIDI output devices found</AlertTitle>
                Start your virtual MIDI port (for example loopMIDI) or connect a device. Nothing will sound until an output is selected.
            </Alert>
        );
    }
    if (!devices.outputConnected) {
        return (
            <Alert severity="warning" data-testid="no-output-warning">
                {devices.outputName
                    ? `MIDI output “${devices.outputName}” isn't connected, nothing will sound.`
                    : "No MIDI output selected, nothing will sound."}
                {!compact && " Choose an output under MIDI devices."}
            </Alert>
        );
    }
    if (midi.inputs.length === 0 && !compact) {
        return (
            <Alert severity="info">
                No MIDI input devices found. {devices.useComputerKeyboard ? "The computer keyboard plays notes (A W S E D F T G Y H U J K, Z/X for octave)." : ""}
            </Alert>
        );
    }
    return null;
}
