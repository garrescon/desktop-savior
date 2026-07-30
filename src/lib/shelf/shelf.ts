import { load, save } from "$lib/store";
import type { Passage } from "$lib/youversion/api";

export interface Kept extends Passage {
    usfm: string;
    saved: number;
}

export type Shelf = Kept[];

const STORAGE_KEY = "desktop-savior:shelf:v1";

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
            shelf.push({
                usfm: k.usfm,
                text: k.text,
                reference: k.reference,
                versionTitle: typeof k.versionTitle === "string" ? k.versionTitle : "",
                copyright: typeof k.copyright === "string" ? k.copyright : "",
                saved: Number.isFinite(k.saved) ? (k.saved as number) : 0,
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

export function keep(shelf: Shelf, usfm: string, passage: Passage): Shelf {
    if (isKept(shelf, usfm)) return shelf;
    return [{ ...passage, usfm, saved: Date.now() }, ...shelf];
}

export function drop(shelf: Shelf, usfm: string): Shelf {
    return shelf.filter((k) => k.usfm !== usfm);
}
