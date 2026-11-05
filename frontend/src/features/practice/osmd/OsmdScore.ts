// The only module that talks to OpenSheetMusicDisplay.
// Renders the score, maps timeline notes to OSMD graphical notes, draws the cursor and loop overlays,
// and colours noteheads by editing the SVG directly (no re-render per note).

import { OpenSheetMusicDisplay, type GraphicalNote, type GraphicalMeasure } from "opensheetmusicdisplay";
import type { NoteEvent, StaffKey } from "../engine/types.ts";

/** OSMD's halfTone is the MIDI number minus this. */
const OSMD_HALFTONE_OFFSET = 12;
/** OSMD layout units are 10 px at zoom 1. */
const UNIT_PX = 10;

export type NoteColor = "good" | "timing" | "bad" | "expected" | "played";

const COLORS: Record<NoteColor, string> = {
    good: "#66bb6a",
    timing: "#ffa726",
    bad: "#ef5350",
    expected: "#4fc3f7",
    played: "#ba68c8",
};

interface IndexedNote {
    note: GraphicalNote;
    halfTone: number;
    /** Absolute x of the staff entry, in OSMD units. */
    x: number;
}

export interface MeasureBox {
    measureIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

export class OsmdScore {
    private readonly container: HTMLElement;
    private readonly host: HTMLDivElement;
    private readonly cursorEl: HTMLDivElement;
    private readonly loopLayer: HTMLDivElement;
    private readonly markerLayer: HTMLDivElement;
    private markers: Array<{ measureIndex: number; onset: number }> = [];
    private readonly osmd: OpenSheetMusicDisplay;
    /** OSMD staff index for each of our staff keys, in score order. */
    private staffIndex = new Map<StaffKey, number>();
    private noteIndex = new Map<string, IndexedNote[]>();
    /** Colour wanted for each written note, re-applied after a re-render. */
    private wantedColors = new Map<number, { note: NoteEvent; color: NoteColor }>();
    private noteCache = new Map<string, GraphicalNote | null>();
    private measureBoxes: MeasureBox[] = [];
    private zoom = 1;
    private loaded = false;
    private cursorPosition: { measureIndex: number; onset: number } | null = null;
    private loopRange: { from: number; to: number } | null = null;

    constructor(container: HTMLElement) {
        this.container = container;
        container.style.position = "relative";
        this.host = document.createElement("div");
        this.loopLayer = document.createElement("div");
        this.loopLayer.style.cssText = "position:absolute;inset:0;pointer-events:none;";
        this.markerLayer = document.createElement("div");
        this.markerLayer.style.cssText = "position:absolute;inset:0;pointer-events:none;";
        this.cursorEl = document.createElement("div");
        this.cursorEl.dataset.testid = "score-cursor";
        this.cursorEl.style.cssText =
            "position:absolute;width:3px;background:rgba(79,195,247,0.85);box-shadow:0 0 6px rgba(79,195,247,0.8);" +
            "pointer-events:none;display:none;border-radius:2px;transition:left 60ms linear, top 60ms linear;";
        container.append(this.host, this.loopLayer, this.markerLayer, this.cursorEl);

        this.osmd = new OpenSheetMusicDisplay(this.host, {
            autoResize: false,
            backend: "svg",
            drawTitle: true,
            drawComposer: true,
            drawPartNames: true,
            darkMode: true,
            pageBackgroundColor: "#00000000",
            autoGenerateMultipleRestMeasuresFromRestMeasures: false,
            followCursor: false,
            drawingParameters: "default",
        });
    }

    /** Loads and renders MusicXML. `staffKeys` lists our staves in score order (matches OSMD's order). */
    async load(xml: string, staffKeys: StaffKey[]): Promise<void> {
        await this.osmd.load(xml);
        this.staffIndex = new Map(staffKeys.map((key, i) => [key, i]));
        this.loaded = true;
        this.render();
    }

    setZoom(zoom: number): void {
        this.zoom = zoom;
        if (!this.loaded) return;
        this.render();
    }

    /** Re-lays out the score (after a zoom or width change). Keeps cursor, loop and colours. */
    render(): void {
        if (!this.loaded) return;
        this.osmd.zoom = this.zoom;
        this.osmd.render();
        this.buildIndex();
        for (const { note, color } of this.wantedColors.values()) this.paint(note, color);
        this.updateLoopOverlay();
        this.drawMarkers();
        if (this.cursorPosition) this.moveCursor(this.cursorPosition.measureIndex, this.cursorPosition.onset);
    }

    dispose(): void {
        this.osmd.clear();
        this.container.replaceChildren();
    }

    private buildIndex(): void {
        this.noteIndex.clear();
        this.noteCache.clear();
        this.measureBoxes = [];
        const measureList = this.osmd.GraphicSheet?.MeasureList ?? [];
        measureList.forEach((staffMeasures, measureIndex) => {
            let box: { x0: number; y0: number; x1: number; y1: number } | null = null;
            staffMeasures.forEach((measure, staffIdx) => {
                if (!measure) return;
                const b = measureBounds(measure);
                if (b) {
                    box = box
                        ? { x0: Math.min(box.x0, b.x0), y0: Math.min(box.y0, b.y0), x1: Math.max(box.x1, b.x1), y1: Math.max(box.y1, b.y1) }
                        : b;
                }
                for (const staffEntry of measure.staffEntries) {
                    const onset = round(staffEntry.relInMeasureTimestamp.RealValue * 4);
                    const entryX = staffEntry.PositionAndShape.AbsolutePosition.x;
                    for (const voiceEntry of staffEntry.graphicalVoiceEntries) {
                        for (const note of voiceEntry.notes) {
                            const source = note.sourceNote;
                            if (!source || source.isRest()) continue;
                            const key = `${measureIndex}|${staffIdx}|${onset}`;
                            const list = this.noteIndex.get(key) ?? [];
                            list.push({ note, halfTone: source.halfTone, x: entryX });
                            this.noteIndex.set(key, list);
                        }
                    }
                }
            });
            if (box) {
                const { x0, y0, x1, y1 } = box;
                this.measureBoxes.push({
                    measureIndex,
                    x: x0 * this.unit(),
                    y: y0 * this.unit(),
                    width: (x1 - x0) * this.unit(),
                    height: (y1 - y0) * this.unit(),
                });
            }
        });
    }

    private unit(): number {
        return UNIT_PX * this.zoom;
    }

    /** Pixel offset of the rendered SVG inside the container. */
    private svgOffset(): { x: number; y: number } {
        const svg = this.host.querySelector("svg");
        if (!svg) return { x: 0, y: 0 };
        const svgRect = svg.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        return { x: svgRect.left - containerRect.left, y: svgRect.top - containerRect.top };
    }

    /** Finds the OSMD note for a timeline note (by measure, staff, onset and written pitch). */
    findNote(note: Pick<NoteEvent, "measureIndex" | "staffKey" | "onsetInMeasure" | "writtenMidi" | "writtenIndex">): GraphicalNote | null {
        const cacheKey = `${note.writtenIndex}`;
        if (this.noteCache.has(cacheKey)) return this.noteCache.get(cacheKey) ?? null;
        const staffIdx = this.staffIndex.get(note.staffKey);
        let found: GraphicalNote | null = null;
        if (staffIdx !== undefined) {
            const candidates = this.noteIndex.get(`${note.measureIndex}|${staffIdx}|${round(note.onsetInMeasure)}`) ?? [];
            const halfTone = note.writtenMidi - OSMD_HALFTONE_OFFSET;
            found = candidates.find((c) => c.halfTone === halfTone)?.note ?? null;
        }
        this.noteCache.set(cacheKey, found);
        return found;
    }

    /** Colours a note's notehead(s). `null` restores the default colour. */
    colorNote(note: NoteEvent, color: NoteColor | null): void {
        if (color === null) this.wantedColors.delete(note.writtenIndex);
        else this.wantedColors.set(note.writtenIndex, { note, color });
        this.paint(note, color);
    }

    clearColors(): void {
        for (const { note } of this.wantedColors.values()) this.paint(note, null);
        this.wantedColors.clear();
    }

    private paint(note: NoteEvent, color: NoteColor | null): void {
        const graphical = this.findNote(note);
        if (!graphical) return;
        const fill = color === null ? null : COLORS[color];
        for (const element of noteheadElements(graphical)) {
            for (const target of [element, ...Array.from(element.querySelectorAll<SVGElement>("path"))]) {
                if (fill === null) {
                    target.style.removeProperty("fill");
                    target.style.removeProperty("stroke");
                } else {
                    target.style.fill = fill;
                    target.style.stroke = fill;
                }
            }
        }
    }

    /** Moves the cursor to a position in a written measure. Returns its box (container pixels). */
    moveCursor(measureIndex: number, onsetInMeasure: number): DOMRect | null {
        this.cursorPosition = { measureIndex, onset: onsetInMeasure };
        const box = this.measureBoxes.find((b) => b.measureIndex === measureIndex);
        if (!box) {
            this.cursorEl.style.display = "none";
            return null;
        }
        const offset = this.svgOffset();
        const x = this.xForOnset(measureIndex, onsetInMeasure) ?? box.x;
        const left = offset.x + x;
        const top = offset.y + box.y - 4;
        const height = box.height + 8;
        Object.assign(this.cursorEl.style, { display: "block", left: `${left - 1}px`, top: `${top}px`, height: `${height}px` });
        return new DOMRect(left, top, 3, height);
    }

    hideCursor(): void {
        this.cursorPosition = null;
        this.cursorEl.style.display = "none";
    }

    /** X position (svg pixels) of the notes at an onset, falling back to a proportional position. */
    private xForOnset(measureIndex: number, onset: number): number | null {
        const key = round(onset);
        const xs: number[] = [];
        for (let staffIdx = 0; staffIdx < this.staffIndex.size; staffIdx++) {
            for (const entry of this.noteIndex.get(`${measureIndex}|${staffIdx}|${key}`) ?? []) {
                xs.push(entry.x * this.unit());
            }
        }
        if (xs.length > 0) return Math.min(...xs) - 6;

        // No note starts here (e.g. a rest): use the staff entries of the measure, or interpolate.
        const measures = this.osmd.GraphicSheet?.MeasureList?.[measureIndex] ?? [];
        let best: { x: number; distance: number } | null = null;
        for (const measure of measures) {
            for (const entry of measure?.staffEntries ?? []) {
                const entryOnset = entry.relInMeasureTimestamp.RealValue * 4;
                const distance = Math.abs(entryOnset - onset);
                if (distance < 1e-6) {
                    const x = entry.PositionAndShape.AbsolutePosition.x * this.unit() - 6;
                    if (!best || distance < best.distance) best = { x, distance };
                }
            }
        }
        if (best) return best.x;
        const box = this.measureBoxes.find((b) => b.measureIndex === measureIndex);
        const duration = measures[0]?.parentSourceMeasure?.Duration?.RealValue;
        if (box && duration) return box.x + Math.min(1, onset / (duration * 4)) * box.width;
        return null;
    }

    /** A red marker above the staff where an extra (unmatched) note was played. */
    markExtra(measureIndex: number, onsetInMeasure: number): void {
        this.markers.push({ measureIndex, onset: onsetInMeasure });
        this.drawMarker(measureIndex, onsetInMeasure);
    }

    clearMarkers(): void {
        this.markers = [];
        this.markerLayer.replaceChildren();
    }

    private drawMarkers(): void {
        this.markerLayer.replaceChildren();
        for (const marker of this.markers) this.drawMarker(marker.measureIndex, marker.onset);
    }

    private drawMarker(measureIndex: number, onset: number): void {
        const box = this.measureBoxes.find((b) => b.measureIndex === measureIndex);
        if (!box) return;
        const offset = this.svgOffset();
        const x = this.xForOnset(measureIndex, onset) ?? box.x;
        const dot = document.createElement("div");
        dot.dataset.testid = "extra-marker";
        dot.style.cssText =
            `position:absolute;left:${offset.x + x + 2}px;top:${offset.y + box.y - 16}px;width:8px;height:8px;` +
            `border-radius:50%;background:${COLORS.bad};box-shadow:0 0 4px ${COLORS.bad};`;
        this.markerLayer.append(dot);
    }

    /** Written measure index under a point (client coordinates), or null. */
    measureAt(clientX: number, clientY: number): number | null {
        const rect = this.container.getBoundingClientRect();
        const offset = this.svgOffset();
        const x = clientX - rect.left - offset.x;
        const y = clientY - rect.top - offset.y;
        for (const box of this.measureBoxes) {
            if (x >= box.x && x <= box.x + box.width && y >= box.y - 10 && y <= box.y + box.height + 10) return box.measureIndex;
        }
        return null;
    }

    /** Shades the measures of the loop range. */
    setLoopRange(range: { from: number; to: number } | null): void {
        this.loopRange = range;
        this.updateLoopOverlay();
    }

    private updateLoopOverlay(): void {
        this.loopLayer.replaceChildren();
        if (!this.loopRange) return;
        const offset = this.svgOffset();
        for (const box of this.measureBoxes) {
            if (box.measureIndex < this.loopRange.from || box.measureIndex > this.loopRange.to) continue;
            const shade = document.createElement("div");
            shade.style.cssText =
                `position:absolute;left:${offset.x + box.x}px;top:${offset.y + box.y - 6}px;` +
                `width:${box.width}px;height:${box.height + 12}px;background:rgba(144,202,249,0.10);` +
                "border-top:2px solid rgba(144,202,249,0.6);border-bottom:2px solid rgba(144,202,249,0.6);";
            this.loopLayer.append(shade);
        }
    }

    /** Container-pixel box of a measure, for scrolling it into view. */
    measureBox(measureIndex: number): MeasureBox | null {
        const box = this.measureBoxes.find((b) => b.measureIndex === measureIndex);
        if (!box) return null;
        const offset = this.svgOffset();
        return { ...box, x: box.x + offset.x, y: box.y + offset.y };
    }

    get measureCount(): number {
        return this.measureBoxes.length;
    }
}

function round(value: number): number {
    return Math.round(value * 10000) / 10000;
}

function measureBounds(measure: GraphicalMeasure): { x0: number; y0: number; x1: number; y1: number } | null {
    const shape = measure.PositionAndShape;
    if (!shape) return null;
    const abs = shape.AbsolutePosition;
    const x0 = abs.x + shape.BorderLeft;
    const x1 = abs.x + shape.BorderRight;
    // Use the five staff lines (0..4 units) so boxes don't include high/low notes of neighbours.
    const y0 = abs.y;
    const y1 = abs.y + 4;
    if (!(x1 > x0)) return null;
    return { x0, y0, x1, y1 };
}

function noteheadElements(note: GraphicalNote): SVGElement[] {
    const withHeads = note as GraphicalNote & {
        getNoteheadSVGs?: () => HTMLElement[];
        getSVGGElement?: () => SVGGElement;
        vfnoteIndex?: number;
    };
    const heads = (withHeads.getNoteheadSVGs?.() ?? []) as unknown as SVGElement[];
    // For a chord, VexFlow draws all heads in one note; vfnoteIndex picks this note's head.
    if (heads.length > 1 && withHeads.vfnoteIndex !== undefined && heads[withHeads.vfnoteIndex]) {
        return [heads[withHeads.vfnoteIndex]];
    }
    if (heads.length > 0) return heads;
    const group = withHeads.getSVGGElement?.();
    return group ? [group] : [];
}

export const NOTE_COLORS = COLORS;
