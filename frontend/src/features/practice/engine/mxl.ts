import { unzipSync } from "fflate";
import { ScoreParseError } from "./musicxml.ts";

/** Decodes XML bytes, honouring a UTF-8 or UTF-16 byte order mark. */
export function decodeXmlBytes(bytes: Uint8Array): string {
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
        return new TextDecoder("utf-16le").decode(bytes.subarray(2));
    }
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
        return new TextDecoder("utf-16be").decode(bytes.subarray(2));
    }
    return new TextDecoder("utf-8").decode(bytes);
}

export function isZip(bytes: Uint8Array): boolean {
    return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/**
 * Extracts the score from a compressed MusicXML (.mxl) file.
 * The root file is named in META-INF/container.xml; returns its plain XML.
 */
export function extractMxl(bytes: Uint8Array): string {
    let files: Record<string, Uint8Array>;
    try {
        files = unzipSync(bytes);
    } catch {
        throw new ScoreParseError("This .mxl file couldn't be unzipped. It may be damaged.");
    }

    const container = files["META-INF/container.xml"];
    if (container) {
        const doc = new DOMParser().parseFromString(decodeXmlBytes(container), "application/xml");
        const rootfiles = Array.from(doc.getElementsByTagName("rootfile"));
        const preferred =
            rootfiles.find((rf) => {
                const type = rf.getAttribute("media-type");
                return !type || type === "application/vnd.recordare.musicxml+xml";
            }) ?? rootfiles[0];
        const path = preferred?.getAttribute("full-path");
        if (path && files[path]) {
            return decodeXmlBytes(files[path]);
        }
    }

    // Fallback: the first MusicXML file outside META-INF.
    const candidate = Object.keys(files).find(
        (name) => !name.startsWith("META-INF/") && /\.(musicxml|xml)$/i.test(name),
    );
    if (!candidate) {
        throw new ScoreParseError("This .mxl file doesn't contain a MusicXML score.");
    }
    return decodeXmlBytes(files[candidate]);
}

/** Reads an imported file (.musicxml, .xml or .mxl) into plain MusicXML text. */
export function scoreXmlFromBytes(bytes: Uint8Array): string {
    return isZip(bytes) ? extractMxl(bytes) : decodeXmlBytes(bytes);
}

export const SCORE_FILE_EXTENSIONS = [".musicxml", ".xml", ".mxl"];

export function isScoreFileName(name: string): boolean {
    const lower = name.toLowerCase();
    return SCORE_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
