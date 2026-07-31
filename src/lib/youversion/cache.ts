import { load, save } from "$lib/store";
import { getPassage, VERSION_ID, type Passage } from "./api";

const STORAGE_KEY = "desktop-savior:verses:v1";
const MAX_ENTRIES = 240;

interface CacheFile {
    version: number;
    passages: Record<string, Passage>;
}

function readPassage(value: unknown): Passage | null {
    if (!value || typeof value !== "object") return null;
    const p = value as Partial<Passage>;
    if (typeof p.text !== "string" || !p.text) return null;
    if (typeof p.reference !== "string") return null;
    return {
        text: p.text,
        reference: p.reference,
        versionTitle: typeof p.versionTitle === "string" ? p.versionTitle : "",
        copyright: typeof p.copyright === "string" ? p.copyright : "",
    };
}

function loadCache(): Record<string, Passage> {
    return load(STORAGE_KEY, (raw) => {
        if (!raw || typeof raw !== "object") return {};
        const file = raw as Partial<CacheFile>;
        // a cache written under another translation is not this translation
        if (file.version !== VERSION_ID) return {};
        if (!file.passages || typeof file.passages !== "object") return {};
        const passages: Record<string, Passage> = {};
        for (const [usfm, value] of Object.entries(file.passages)) {
            const passage = readPassage(value);
            if (passage) passages[usfm] = passage;
        }
        return passages;
    }, () => ({}));
}

function saveCache(passages: Record<string, Passage>): void {
    // the oldest writes sit at the front
    const keys = Object.keys(passages);
    const kept = keys.length > MAX_ENTRIES ? keys.slice(keys.length - MAX_ENTRIES) : keys;
    const trimmed: Record<string, Passage> = {};
    for (const usfm of kept) trimmed[usfm] = passages[usfm];
    const file: CacheFile = { version: VERSION_ID, passages: trimmed };
    save(STORAGE_KEY, file);
}

function cachedPassage(usfm: string): Passage | null {
    return loadCache()[usfm] ?? null;
}

export async function getCachedPassage(usfm: string): Promise<Passage> {
    const hit = cachedPassage(usfm);
    if (hit) return hit;

    const passage = await getPassage(usfm);
    const fresh = loadCache();
    // deleting first moves a re-read to the newest end
    delete fresh[usfm];
    fresh[usfm] = passage;
    saveCache(fresh);
    return passage;
}
