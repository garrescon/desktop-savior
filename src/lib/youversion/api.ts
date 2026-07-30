import { ApiClient, BibleClient, type BiblePassage, type BibleVersion } from "@youversion/platform-core";

// PUBLIC BY DESIGN
// YouVersion intends app keys for client-side distribution
const APP_KEY="RcYLUrApDgLGOyI5AoOyLKyjq7LSz0epal9gpakY7928EgXT";

// TODO: make translation selectable
// requires cache invalidation on versionPromise when this changes
export const VERSION_ID = 111;

const bible = new BibleClient(new ApiClient({ appKey: APP_KEY }));

export function dayOfYear(d = new Date()): number {
    // day-zero of January (Dec 31) as the origin makes Jan 1 come out as day 1
    const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 0);
    const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return Math.floor((today - startOfYear) / 86_400_000);
}

export interface Passage {
    text: string;
    reference: string;
    versionTitle: string;
    copyright: string;
}

let versionPromise: Promise<BibleVersion> | undefined;
function getVersion(): Promise<BibleVersion> {
    versionPromise ??= bible.getVersion(VERSION_ID);
    return versionPromise;
}
export async function getPassage(usfm: string): Promise<Passage> {
    const [passage, version] = await Promise.all([
        bible.getPassage(VERSION_ID, usfm, "text"),
        getVersion(),
    ]);
    return {
        text: passage.content,
        reference: passage.reference,
        versionTitle: version.localized_title,
        copyright: version.copyright ?? `© ${version.title}`,
    };
}

export interface Book {
    usfm: string;
    name: string;
}

let booksPromise: Promise<Book[]> | undefined;
export function getBooks(): Promise<Book[]> {
    if (!booksPromise) {
        booksPromise = bible.getBooks(VERSION_ID).then((books) =>
            books.data.map((b) => ({ usfm: b.id, name: b.title })),
        );
        // if it fails, wipe it to try again
        booksPromise.catch(() => { booksPromise = undefined; });
    }
    return booksPromise;
}

export interface ChapterLength {
    chapter: number;
    verses: number;
}

// one request covers a whole book and the promise is cached
const chapterPromises = new Map<string, Promise<ChapterLength[]>>();
export function getChapterLengths(book: string): Promise<ChapterLength[]> {
    let promise = chapterPromises.get(book);
    if (!promise) {
        promise = bible.getChapters(VERSION_ID, book).then((chapters) =>
            chapters.data.map((c) => ({
                chapter: Number(c.id),
                verses: c.verses?.length ?? 0,
            })),
        );
        // if it fails, wipe it to try again
        promise.catch(() => chapterPromises.delete(book));
        chapterPromises.set(book, promise);
    }
    return promise;
}

export async function getVerseOfTheDay(): Promise<Passage> {
    const votd = await bible.getVOTD(dayOfYear());
    return getPassage(votd.passage_id);
}