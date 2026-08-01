import { load, save } from "$lib/store";
import type { Passage } from "$lib/youversion/api";

export type OriginKind = "feeling" | "theme" | "aspect";

export interface Origin {
    kind: OriginKind;
    // ids rather than labels so rewriting a feeling word retitles its chips
    ids: string[];
}

// getPassage drops the usfm so whoever fetched it carries it here
export type Keepable = Passage & { usfm: string };

export interface Kept extends Keepable {
    saved: number;
    // absent until you write one and absent again once you clear it
    note?: string;
    from?: Origin;
}

export type Shelf = Kept[];

const STORAGE_KEY = "desktop-savior:shelf:v1";

// anything malformed reads as no origin instead of dropping the passage
function readOrigin(value: unknown): Origin | undefined {
    if (!value || typeof value !== "object") return undefined;
    const origin = value as Partial<Origin>;
    if (origin.kind !== "feeling" && origin.kind !== "theme" && origin.kind !== "aspect") {
        return undefined;
    }
    if (!Array.isArray(origin.ids)) return undefined;
    // deduped so one passage never lists the same word twice
    const ids = [...new Set(
        origin.ids.filter((id): id is string => typeof id === "string" && id !== ""),
    )];
    return ids.length ? { kind: origin.kind, ids } : undefined;
}

// the text is stored alongside the reference so a kept passage opens offline
export function loadShelf(): Shelf {
    return load(STORAGE_KEY, (raw) => {
        if (!Array.isArray(raw)) return [];
        const shelf: Shelf = [];
        for (const value of raw) {
            if (!value || typeof value !== "object") continue;
            const k = value as Partial<Kept>;
            if (typeof k.usfm !== "string" || typeof k.text !== "string") continue;
            if (typeof k.reference !== "string") continue;
            const from = readOrigin(k.from);
            shelf.push({
                usfm: k.usfm,
                text: k.text,
                reference: k.reference,
                versionTitle: typeof k.versionTitle === "string" ? k.versionTitle : "",
                copyright: typeof k.copyright === "string" ? k.copyright : "",
                saved: Number.isFinite(k.saved) ? (k.saved as number) : 0,
                // a shelf written before notes or origins has neither
                ...(typeof k.note === "string" && k.note ? { note: k.note } : {}),
                ...(from ? { from } : {}),
            });
        }
        return shelf;
    }, () => []);
}

export function saveShelf(shelf: Shelf): void {
    save(STORAGE_KEY, shelf);
}

export function isKept(shelf: Shelf, usfm: string): boolean {
    return shelf.some((k) => k.usfm === usfm);
}

export function keep(shelf: Shelf, usfm: string, passage: Passage, from?: Origin): Shelf {
    if (isKept(shelf, usfm)) return shelf;
    return [{ ...passage, usfm, saved: Date.now(), ...(from ? { from } : {}) }, ...shelf];
}

export function drop(shelf: Shelf, usfm: string): Shelf {
    return shelf.filter((k) => k.usfm !== usfm);
}

// a blank clears the note instead of storing an empty string
export function annotate(shelf: Shelf, usfm: string, note: string): Shelf {
    const written = note.trim();
    return shelf.map((k) => {
        if (k.usfm !== usfm) return k;
        const { note: _dropped, ...rest } = k;
        return written ? { ...rest, note: written } : rest;
    });
}

export function noteFor(shelf: Shelf, usfm: string): string {
    return shelf.find((k) => k.usfm === usfm)?.note ?? "";
}

export function originFor(shelf: Shelf, usfm: string): Origin | undefined {
    return shelf.find((k) => k.usfm === usfm)?.from;
}
