# Build the MusicHelper practice section (v1)

## Context
Repo: Dorito009/MusicHelper, branch `dev`. Vite + React 19 + TypeScript +
TanStack Router (file-based) + MUI 7, npm workspaces (`musiclib`, `frontend`),
deployed to GitHub Pages under `/MusicHelper/`. Read CLAUDE.md first and follow
it. The site already has a theory section (`routes/_theory`, `features/theory`)
and an empty practice section (`routes/practice`, `features/practice`) with a
shared `AppHeader`.

Build the practice section: a tool for practicing sheet music on a MIDI
keyboard, focused on **tempo practice** and **sight-reading**. It loads MusicXML,
shows the score, plays the parts I don't play, and checks what I play.

**There is no built-in sound.** All sound goes out as MIDI to a port and
channels I choose, so I can use my own sampler (Kontakt/Spitfire in Cubase,
through a virtual MIDI port such as loopMIDI). Do not add any audio or sample
library.

## Before you start
1. Create a branch `practice-v1` from `dev`.
2. Save this whole prompt as `docs/practice-spec.md` in the repo, so later
   sessions can refer to it.
3. Read `musiclib` (notes, scales, spelling) because the sight-reading generator
   should use it.
4. Build in the milestones below and commit after each one. If something in this
   spec is unclear or conflicts with the code, make a reasonable choice, keep
   going, and list the decision in the PR.

## Pages (all under the practice layout)
- `/practice`: score library. Import `.musicxml`, `.xml` and `.mxl` files
  (file picker and drag-and-drop). List each score with title, composer, number
  of staves, last practiced, and best accuracy. Rename and delete scores.
- `/practice/play/$scoreId`: the player (details below), with a history panel
  showing past sessions for this score.
- `/practice/sight-reading`: generates exercises and opens them in the same
  player component.
- `/practice/settings`: all practice settings as a full page.

The practice header shows these pages plus the collapsed "Theory" menu from the
restructure.

## Score engine (plain TypeScript, no React)
Put this in `features/practice/engine/`. Nothing in the engine may import
React, MUI or OSMD types.

- **Own timeline type.** Parse MusicXML yourself with `DOMParser` into a
  `ScoreTimeline`: a list of note events
  `{ id, partId, staff, voice, midi, step, alter, octave, measureIndex,
  onsetBeats, durationBeats, velocity, tieContinuation, isGrace }`, plus measure
  start times, time signatures and tempo changes.
- **Handle:** `divisions`, `backup`/`forward`, chords, multiple voices and
  staves, ties (a tied continuation is not a new note to play),
  `<transpose>` (MIDI uses the sounding pitch), tempo from `<sound tempo>` and
  `<metronome>` (default 120 if there is none), and velocity from
  `<note dynamics>`, `<sound dynamics>` or dynamic marks via a sensible table.
- **Repeats:** expand simple repeat barlines and 1st/2nd endings into playback
  order. D.C., D.S., Fine and Coda are out of scope for v1: play straight
  through, and show a small notice when the score contains them.
- **.mxl:** unzip with `fflate`, find the root file via
  `META-INF/container.xml`, and store the plain XML.
- **Formats:** support `score-partwise`; for `score-timewise`, show a clear
  error.
- **OSMD adapter:** one module (`features/practice/osmd/`) renders the score
  with OpenSheetMusicDisplay 2.x. It maps timeline notes to OSMD graphical notes
  by measure index, onset within the measure, staff and pitch. It moves the
  cursor and colours noteheads. For feedback colours, change the SVG elements
  directly instead of re-rendering the whole score on every note.

## MIDI and timing
Use `webmidi` (v3, already installed) for both input and output.

- **One clock:** everything runs on `performance.now()` / `WebMidi.time`.
  Schedule outgoing notes with absolute `time` values, using a lookahead of
  about 120 ms.
- **Tick in a Web Worker:** drive the scheduler tick from a small Web Worker
  (about every 25 ms). Chrome throttles main-thread timers when the window is
  covered, for example by Cubase.
- **Abstractions:** put input behind an `InputSource` interface (Web MIDI,
  computer keyboard, test fake) and output behind an `OutputSink` interface
  (Web MIDI, test fake that records messages with timestamps).
- **MIDI thru:** forward my input to a "my playing" channel immediately, with
  no added delay, so the sampler only needs the one virtual port. Also forward
  sustain (CC64). Thru can be turned off.
- **Metronome:** goes out as MIDI on its own channel, with separate notes for
  the downbeat and other beats, so it has the same latency as the music.
- **Panic:** on stop, seek, loop restart, mode change and `pagehide`, send All
  Notes Off (CC123) on every channel used, once immediately and again just
  after the lookahead window. Also add a Panic button in the transport.
- **Devices:** remember them by name, handle connect/disconnect events, and
  handle the permission prompt and permission denial. Show a clear banner when
  Web MIDI is unsupported (Safari) or when there is no secure context.
- **No output selected:** show "No MIDI output selected, nothing will sound"
  instead of failing silently.
- **Latency compensation:** subtract the calibrated latency offset from my
  input timestamps before grading.

## Staff roles (per score)
Each staff gets a role:
- **I play:** graded, and not sent to the output (I hear myself through thru).
- **App plays:** sent to its MIDI channel.
- **Off:** neither sent nor graded, but still displayed.

Defaults for a new score: the first staff (or both staves of a piano part) is
"I play", and the others are "App plays" on channels 2, 3, 4 and so on. Per
staff, dynamics can be sent as velocity, as CC1, or both (CC1 matters for
Spitfire long notes).

## Practice modes
- **Wait for me.** The cursor stops at each step (the set of new notes at one
  onset in the "I play" staves). It advances once every expected pitch has been
  pressed, in any order. Wrong notes are counted but don't advance the cursor.
  Accompaniment notes of a step sound when I complete that step, and stop after
  their notated duration at the current tempo or when the next step starts,
  whichever comes first. Steps with only accompaniment play on their own at
  tempo. No metronome in this mode.
- **Play along.** The music runs at tempo with an optional count-in and
  metronome.
  - Each expected note has a window of ± tolerance.
  - A press of the right pitch is matched to the earliest unmatched expected
    note whose window contains it.
  - Within half the tolerance is "good" (green). Within the tolerance is
    "early" or "late" (orange). A window that passes with no match is "missed"
    (red). Any unmatched press is "extra" (red marker).
  - Record each timing offset in ms.
- **Rhythm only** (toggle, works in Play along): pitch is ignored, and any key
  counts. Only timing is graded.
- **Not graded in v1:** grace notes. Show them, but skip them in grading.

## Transport and tempo practice
- **Basic controls:** start/stop, restart from loop start, and tempo as BPM and
  as a percentage of the score tempo. Tempo changes in the score scale
  proportionally. Tempo changes apply live during playback without jumps.
- **Count-in:** 0, 1 or 2 bars.
- **Loop a measure range:** set it with from/to inputs and by shift-clicking
  measures in the score.
- **Tempo trainer:** start BPM, target BPM, step, and the required accuracy to
  step up. When the loop ends with accuracy at or above the threshold, the tempo
  goes up by the step. Show progress toward the target.
- **Results after each run:**
  - Accuracy %, and counts of good, early/late, missed and extra notes.
  - Mean and spread of the timing offset ("you tend to play 18 ms late").
  - A small histogram of offsets.
  - A list of the worst measures, each with a button that loops that measure.
- **History:** save each run as a session.
- **On-screen piano (toggle):** expected notes, held notes, and correct/wrong
  feedback.
- **Follow cursor:** auto-scroll, and zoom.
- **Keyboard shortcuts:** Space start/stop, R restart, +/− tempo, M metronome,
  Esc panic. Shortcuts must not clash with computer-keyboard note input.

## Sight-reading generator
**Options:** clef (treble, bass, grand staff), key and scale type (from
musiclib), lowest and highest note, allowed note values (whole to eighth,
dotted on/off, rests on/off), maximum leap, accidentals outside the key on/off,
time signature, and number of measures (4–32). For a grand staff, the left hand
plays simple chord tones in longer values.

**Generating:**
- Produce valid MusicXML with correct spelling for the key (use musiclib).
- Use a visible seed, so an exercise can be regenerated.
- "Next exercise" generates a new one. "Save to library" stores it.
- Runs use the same player and the same grading, and are saved to history.

## Settings
**Global practice settings** (`/practice/settings`). Store them in a zustand
store with `persist` under `music-helper:practice:settings`, with `version` and
a zod-validated `migrate`. Never read the theory preferences.

- **MIDI:**
  - Input device and output device.
  - Thru on/off and thru channel.
  - Default channels for new staves.
  - Metronome channel, downbeat note, beat note and click velocity.
  - Test buttons: send a test note, and play the click.
  - Panic.
- **Playback:** default mode, count-in bars, metronome on/off by default.
- **Grading:** timing tolerance in ms (default 100), rhythm-only by default
  on/off.
- **Latency:**
  - The offset in ms.
  - A calibration screen: it plays 16 clicks at 90 BPM through the MIDI click
    channel, and I tap any key on each beat.
  - It ignores the first 4 taps, saves the median offset, and shows the spread.
- **Tempo trainer defaults:** step and threshold.
- **Display:** zoom, follow cursor, on-screen piano.
- **Input:** computer keyboard as a note input on/off and its octave. Use a
  DAW-style layout (A W S E D F T G Y H U J K, Z/X to change octave). It is on
  by default when there is no MIDI input.
- **Reset:** reset all settings to defaults.

**Per-score settings** are stored with the score: staff roles, channels,
dynamics mode per staff, last BPM, last loop range, and tempo trainer state.

## Storage
Use IndexedDB via Dexie, with `dexie-react-hooks`.
- **`scores`:** id, title, composer, fileName, xml, addedAt, lastPracticedAt,
  config.
- **`sessions`:** id, scoreId, startedAt, mode, bpm, measure range, rhythmOnly,
  and stats (counts, accuracy, offset mean/spread, worst measures).

## UI
- Use MUI, consistent with the rest of the site, in dark mode.
- It must work on a laptop next to a keyboard. Make it responsive; on narrow
  screens the transport stays reachable and settings go into a drawer.
- Use clear empty states: no scores yet, no MIDI devices, permission denied.
- Copy is in English, sentence case, and says exactly what each button does.

## Libraries and setup
- **Add:** `opensheetmusicdisplay` (2.x), `fflate`, `dexie`,
  `dexie-react-hooks`, and `vitest` as a dev dependency.
- **Already present:** `webmidi`, `zustand`, `zod`, and `musiclib`.
- **Versions:** use current stable versions that work with React 19.
- **Code splitting:** OSMD may only load on the player and sight-reading routes;
  keep `autoCodeSplitting` working.
- **Dependency rule:** follow the CLAUDE.md boundary. `features/practice` never
  imports from `features/theory`.

## Out of scope for v1
Built-in sound, Safari support, D.C./D.S./Coda, grace notes and ornaments in
grading, score-timewise, editing scores, MIDI file import, and accounts or sync.

## Milestones (commit after each)
1. Engine: MusicXML parser, timeline, repeats, .mxl, with unit tests.
2. Library page and Dexie storage.
3. Player: OSMD rendering, cursor, adapter mapping.
4. MIDI layer: input/output abstractions, worker scheduler, thru, panic,
   metronome, device handling.
5. Wait-for-me mode.
6. Play-along mode, grading, results, history.
7. Tempo trainer and loop tools.
8. Settings page and latency calibration.
9. Sight-reading generator.
10. Polish: shortcuts, on-screen piano, empty states, responsive layout.

## Testing
- **Vitest unit tests for:**
  - The parser, with hand-written fixtures: a simple melody, a two-staff piano
    piece with chords, backup/forward, ties, voltas, a tempo change, a
    transposing instrument, and an .mxl file.
  - The matcher/grader (good, early, late, missed, extra, chords, rhythm-only).
  - Wait-mode stepping.
  - The scheduler, with a fake clock and the recording output sink: correct
    timestamps, live tempo change, loop restart, panic messages.
  - The generator: valid MusicXML, notes in range, correct key spelling, and
    the same seed giving the same output.
- **In the browser:** use the computer-keyboard input. If Playwright can run in
  your environment, add a smoke test that imports a fixture, plays through it
  in Wait-for-me mode, and checks the results.
- **Before finishing:** `npm run build`, `npm run lint` and the tests all pass.
- **Never run `npm run deploy`.**

## Pull request
Push the branch and open a PR into `dev`. The description should cover what was
built per milestone, the decisions you made yourself, known limitations, and a
checklist of what I must test by hand with a real keyboard and sampler (MIDI
permission, device names, thru latency, click alignment, calibration, stuck
notes).
