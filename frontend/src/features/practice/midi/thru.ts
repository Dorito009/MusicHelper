import type { MidiOut } from "./midiOut.ts";
import { CC, type InputSource, STATUS } from "./types.ts";

export interface ThruOptions {
    isEnabled: () => boolean;
    /** The "my playing" channel, 1-16. */
    getChannel: () => number;
}

/**
 * Forwards my playing to the output right away (no timestamp, so no added delay),
 * on the "my playing" channel. Notes and sustain (CC64) are forwarded.
 */
export function connectThru(input: InputSource, out: MidiOut, options: ThruOptions): () => void {
    return input.subscribe((event) => {
        if (!options.isEnabled()) return;
        const channel = options.getChannel();
        const status = channel - 1;
        if (event.type === "noteon") {
            out.sendRaw([STATUS.noteOn | status, event.note, event.velocity]);
        } else if (event.type === "noteoff") {
            out.sendRaw([STATUS.noteOff | status, event.note, event.velocity]);
        } else if (event.type === "cc" && event.controller === CC.sustain) {
            out.sendRaw([STATUS.controlChange | status, CC.sustain, event.value]);
        }
    });
}
