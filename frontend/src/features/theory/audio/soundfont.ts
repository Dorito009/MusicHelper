import Soundfont from "soundfont-player";
import type {Chord, Scale} from "musiclib"
import type {InstrumentName, Player} from "soundfont-player";

export const DEFAULT_INSTRUMENT_NAME: InstrumentName = "acoustic_grand_piano";

export const SOUND_FONT_INSTRUMENTS: InstrumentName[] = [
    "accordion",
    "acoustic_bass",
    "acoustic_grand_piano",
    "acoustic_guitar_nylon",
    "acoustic_guitar_steel",
    "agogo",
    "alto_sax",
    "applause",
    "bagpipe",
    "banjo",
    "baritone_sax",
    "bassoon",
    "bird_tweet",
    "blown_bottle",
    "brass_section",
    "breath_noise",
    "bright_acoustic_piano",
    "celesta",
    "cello",
    "choir_aahs",
    "church_organ",
    "clarinet",
    "clavinet",
    "contrabass",
    "distortion_guitar",
    "drawbar_organ",
    "dulcimer",
    "electric_bass_finger",
    "electric_bass_pick",
    "electric_grand_piano",
    "electric_guitar_clean",
    "electric_guitar_jazz",
    "electric_guitar_muted",
    "electric_piano_1",
    "electric_piano_2",
    "english_horn",
    "fiddle",
    "flute",
    "french_horn",
    "fretless_bass",
    "fx_1_rain",
    "fx_2_soundtrack",
    "fx_3_crystal",
    "fx_4_atmosphere",
    "fx_5_brightness",
    "fx_6_goblins",
    "fx_7_echoes",
    "fx_8_scifi",
    "glockenspiel",
    "guitar_fret_noise",
    "guitar_harmonics",
    "gunshot",
    "harmonica",
    "harpsichord",
    "helicopter",
    "honkytonk_piano",
    "kalimba",
    "koto",
    "lead_1_square",
    "lead_2_sawtooth",
    "lead_3_calliope",
    "lead_4_chiff",
    "lead_5_charang",
    "lead_6_voice",
    "lead_7_fifths",
    "lead_8_bass__lead",
    "marimba",
    "melodic_tom",
    "music_box",
    "muted_trumpet",
    "oboe",
    "ocarina",
    "orchestra_hit",
    "orchestral_harp",
    "overdriven_guitar",
    "pad_1_new_age",
    "pad_2_warm",
    "pad_3_polysynth",
    "pad_4_choir",
    "pad_5_bowed",
    "pad_6_metallic",
    "pad_7_halo",
    "pad_8_sweep",
    "pan_flute",
    "percussive_organ",
    "piccolo",
    "pizzicato_strings",
    "recorder",
    "reed_organ",
    "reverse_cymbal",
    "rock_organ",
    "seashore",
    "shakuhachi",
    "shamisen",
    "shanai",
    "sitar",
    "slap_bass_1",
    "slap_bass_2",
    "soprano_sax",
    "steel_drums",
    "string_ensemble_1",
    "string_ensemble_2",
    "synth_bass_1",
    "synth_bass_2",
    "synth_brass_1",
    "synth_brass_2",
    "synth_choir",
    "synth_drum",
    "synth_strings_1",
    "synth_strings_2",
    "taiko_drum",
    "tango_accordion",
    "telephone_ring",
    "tenor_sax",
    "timpani",
    "tinkle_bell",
    "tremolo_strings",
    "trombone",
    "trumpet",
    "tuba",
    "tubular_bells",
    "vibraphone",
    "viola",
    "violin",
    "voice_oohs",
    "whistle",
    "woodblock",
    "xylophone",
];

export const ORCHESTRATION_INSTRUMENTS: InstrumentName[] = [
    "acoustic_grand_piano",
    "bright_acoustic_piano",
    "harpsichord",
    "celesta",
    "glockenspiel",
    "music_box",
    "vibraphone",
    "marimba",
    "xylophone",
    "church_organ",
    "drawbar_organ",
    "reed_organ",
    "accordion",
    "tango_accordion",
    "acoustic_guitar_nylon",
    "acoustic_guitar_steel",
    "orchestral_harp",
    "violin",
    "viola",
    "cello",
    "contrabass",
    "pizzicato_strings",
    "tremolo_strings",
    "string_ensemble_1",
    "string_ensemble_2",
    "timpani",
    "taiko_drum",
    "trumpet",
    "trombone",
    "tuba",
    "french_horn",
    "muted_trumpet",
    "brass_section",
    "synth_brass_1",
    "synth_brass_2",
    "piccolo",
    "flute",
    "recorder",
    "pan_flute",
    "blown_bottle",
    "shakuhachi",
    "whistle",
    "ocarina",
    "clarinet",
    "oboe",
    "english_horn",
    "bassoon",
    "soprano_sax",
    "alto_sax",
    "tenor_sax",
    "baritone_sax",
    "choir_aahs",
    "voice_oohs",
    "synth_choir",
    "orchestra_hit",
];

export function formatInstrumentLabel(instrumentName: InstrumentName) {
    return instrumentName
        .replace(/__/g, " / ")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function normalizeInstrumentName(instrumentName: string): InstrumentName {
    if (SOUND_FONT_INSTRUMENTS.includes(instrumentName as InstrumentName)) {
        return instrumentName as InstrumentName;
    }

    return DEFAULT_INSTRUMENT_NAME;
}

let audioContext: AudioContext | null = null;
let currentInstrument: Player | null = null;
let currentInstrumentName = "";
let isMuted = false;

function getAudioContext() {
    if (!audioContext) {
        const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) {
            throw new Error("Web Audio is not supported in this browser.");
        }
        audioContext = new Ctx();
    }
    return audioContext;
}

export async function loadInstrument(instrumentName: InstrumentName = DEFAULT_INSTRUMENT_NAME) {
    const context = getAudioContext();

    if (context.state === "suspended") {
        await context.resume();
    }

    if (currentInstrument && currentInstrumentName === instrumentName) {
        return currentInstrument;
    }

    currentInstrument = await Soundfont.instrument(context, instrumentName as InstrumentName, {
        soundfont: "MusyngKite",
    });

    currentInstrumentName = instrumentName;
    return currentInstrument;
}

export async function warmupAudio(instrumentName: InstrumentName = DEFAULT_INSTRUMENT_NAME) {
    try {
        await loadInstrument(instrumentName);
    } catch {
        return;
    }
}

export function constructChordOctaves(notes: Array<{ pitch: number }>, lowestOctave: number = 3): number[] {
    if (!notes || notes.length === 0) return [];
    if (notes.length === 1) return [notes[0].pitch + lowestOctave * 12];

    const result: number[] = [];
    const firstNotePitch = notes[0].pitch + lowestOctave * 12;
    result.push(firstNotePitch);

    for (let i = 1; i < notes.length; i++) {
        const prevNote = result[i - 1];
        const currentNotePitch = notes[i].pitch;
        let adjustedPitch = currentNotePitch + lowestOctave * 12;

        // If the note is lower than the previous note, move it to the next octave
        while (adjustedPitch <= prevNote) {
            adjustedPitch += 12;
        }

        result.push(adjustedPitch);
    }

    return result;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function pitchToNoteName(pitch: number): string {
    const pitchClass = ((pitch % 12) + 12) % 12;
    const octave = Math.floor(pitch / 12) - 1;
    return `${NOTE_NAMES[pitchClass]}${octave}`;
}

export async function playChord(
    chord: Chord,
    durationSeconds: number = 1,
    instrumentName: InstrumentName = DEFAULT_INSTRUMENT_NAME,
    lowestOctave: number = 4,
    ) {
    if (isMuted) {
        return;
    }

    const instrument = await loadInstrument(instrumentName);
    const now = getAudioContext().currentTime;

    const pitches = constructChordOctaves(chord.notes, lowestOctave);

    pitches.map((p => {
        const noteName = pitchToNoteName(p);
        instrument.play(noteName, now, {
            duration: durationSeconds,
            gain: 1,
        });
    }))
}

export async function playInstrumentPreview(
    instrumentName: InstrumentName = DEFAULT_INSTRUMENT_NAME,
    noteName = "C4",
    durationSeconds = 1,
) {
    if (isMuted) {
        return;
    }

    const instrument = await loadInstrument(instrumentName);
    const now = getAudioContext().currentTime;

    instrument.play(noteName, now, {
        duration: durationSeconds,
        gain: 1,
    });
}

export async function playScale(
    scale: Scale,
    instrumentName: InstrumentName = DEFAULT_INSTRUMENT_NAME,
    startOctave = 4,
    noteSpacingSeconds = 0.42,
    noteDurationSeconds = 0.48,
    onNoteStart?: (pitchClass: number) => void,
    onComplete?: () => void,
) {
    if (isMuted) {
        onComplete?.();
        return;
    }

    const instrument = await loadInstrument(instrumentName);
    const now = getAudioContext().currentTime;
    const tonicBaseMidi = (startOctave + 1) * 12 + scale.tonic.pitch;
    const midiSequence = [
        ...scale.degrees.map((degree) => tonicBaseMidi + degree.step),
        tonicBaseMidi + 12,
    ];

    midiSequence.forEach((midi, index) => {
        window.setTimeout(() => {
            onNoteStart?.(midi % 12);
        }, index * noteSpacingSeconds * 1000);

        instrument.play(pitchToNoteName(midi), now + index * noteSpacingSeconds, {
            duration: noteDurationSeconds,
            gain: 1,
        });
    });

    window.setTimeout(() => {
        onComplete?.();
    }, Math.max(0, (midiSequence.length - 1) * noteSpacingSeconds * 1000 + noteDurationSeconds * 1000));
}

export function setMuted(muted: boolean) {
    isMuted = muted;
}

export function getMuted() {
    return isMuted;
}
