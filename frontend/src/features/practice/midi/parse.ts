import type { MidiInputEvent } from "./types.ts";

/** Turns raw MIDI bytes into an input event. Returns null for messages we don't use. */
export function parseMidiMessage(data: ArrayLike<number>, time: number): MidiInputEvent | null {
    if (data.length < 2) return null;
    const status = data[0] & 0xf0;
    const channel = (data[0] & 0x0f) + 1;
    const a = data[1] ?? 0;
    const b = data[2] ?? 0;
    switch (status) {
        case 0x90:
            return b > 0
                ? { type: "noteon", note: a, velocity: b, channel, time }
                : { type: "noteoff", note: a, velocity: 0, channel, time };
        case 0x80:
            return { type: "noteoff", note: a, velocity: b, channel, time };
        case 0xb0:
            return { type: "cc", controller: a, value: b, channel, time };
        default:
            return null;
    }
}
