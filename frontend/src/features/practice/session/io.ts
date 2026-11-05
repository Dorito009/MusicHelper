import { ComputerKeyboardInput } from "../midi/keyboardInput.ts";
import { InputHub } from "../midi/inputHub.ts";
import { MidiOut } from "../midi/midiOut.ts";
import { connectThru } from "../midi/thru.ts";
import type { Clock, InputSource, OutputSink } from "../midi/types.ts";
import { midiManager } from "../midi/webmidi.ts";
import { getPracticeSettings, usePracticeSettings } from "../settings/store.ts";

/**
 * Everything a practice page needs for MIDI: one clock, the output (chosen by name),
 * all note inputs merged, MIDI thru, and panic on pagehide.
 */
export class PracticeIo {
    readonly clock: Clock = { now: () => midiManager.now() };
    readonly input = new InputHub();
    readonly out: MidiOut;
    private sinkName: string | null = null;
    private sink: OutputSink | null = null;
    private keyboard: ComputerKeyboardInput | null = null;
    private readonly disposers: Array<() => void> = [];

    constructor() {
        this.out = new MidiOut(this.clock, () => this.currentSink());
        this.disposers.push(
            connectThru(this.input, this.out, {
                isEnabled: () => getPracticeSettings().midi.thruEnabled,
                getChannel: () => getPracticeSettings().midi.thruChannel,
            }),
        );
        const onPageHide = () => this.panic();
        window.addEventListener("pagehide", onPageHide);
        this.disposers.push(() => window.removeEventListener("pagehide", onPageHide));
        this.disposers.push(midiManager.subscribe(() => {
            this.sinkName = null; // devices changed: look the output up again
        }));
    }

    /** Re-reads which inputs to listen to. Call when settings or devices change. */
    configureInputs(options: { midiInputName: string | null; useComputerKeyboard: boolean; keyboardOctave: number }): void {
        const sources: InputSource[] = [];
        if (options.midiInputName) sources.push(midiManager.inputSource(options.midiInputName));
        if (options.useComputerKeyboard) {
            if (!this.keyboard) {
                this.keyboard = new ComputerKeyboardInput({
                    octave: options.keyboardOctave,
                    onOctaveChange: (octave) => usePracticeSettings.getState().update("input", { keyboardOctave: octave }),
                });
            } else {
                this.keyboard.setOctave(options.keyboardOctave);
            }
            sources.push(this.keyboard);
        } else if (this.keyboard) {
            this.keyboard.dispose();
            this.keyboard = null;
        }
        this.input.setSources(sources);
    }

    private currentSink(): OutputSink | null {
        const name = getPracticeSettings().midi.outputName;
        if (name !== this.sinkName) {
            this.sinkName = name;
            this.sink = midiManager.outputSink(name);
        }
        return this.sink;
    }

    /** Channels panic always covers, even before anything was sent on them. */
    panicChannels(): number[] {
        const { midi } = getPracticeSettings();
        return [midi.thruChannel, midi.metronomeChannel];
    }

    panic(): void {
        this.out.panic(this.panicChannels());
    }

    dispose(): void {
        this.panic();
        for (const dispose of this.disposers) dispose();
        this.keyboard?.dispose();
        this.input.dispose();
    }
}
