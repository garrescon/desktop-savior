import type { ChapterLength } from "$lib/youversion/api";
import { load, save, clamp, whole } from "$lib/store";

export const DEFAULT_BOOK = "LUK";

export const MIN_PACE = 1, MAX_PACE = 40, DEFAULT_PACE = 10;

// mirrors MAX_SPAN in gloo.rs, which rejects a reference whose range runs longer
export const MAX_SPAN = 12;

// one bookmark per book so switching is never destructive
// still separate from the day log's verses which is whatever a day held
export interface Plan {
    book: string;
    books: Record<string, number>;
    pace: number;
}

const STORAGE_KEY = "desktop-savior:reading";

// TODO: no way to start over. A book can only be read once in your life. Memorize it well.

function defaultPlan(): Plan {
    return { book: DEFAULT_BOOK, books: {}, pace: DEFAULT_PACE };
}

export function loadPlan(): Plan {
    return load(STORAGE_KEY, (raw) => {
        const parsed = (raw ?? {}) as Record<string, unknown>;
        const plan = defaultPlan();

        if (Number.isFinite(parsed.pace)) plan.pace = clamp(parsed.pace as number, MIN_PACE, MAX_PACE);
        if (typeof parsed.book === "string" && parsed.book) plan.book = parsed.book;

        // v1 stored one count and only ever read Luke
        // carrying it into the map keeps an existing reader's place
        if (!parsed.books && typeof parsed.versesRead !== "undefined") {
            plan.books = { [DEFAULT_BOOK]: whole(parsed.versesRead) };
            return plan;
        }

        // clamp rather than reject, so one bad entry can't wipe the rest
        if (parsed.books && typeof parsed.books === "object") {
            for (const [book, count] of Object.entries(parsed.books as Record<string, unknown>)) {
                plan.books[book] = whole(count);
            }
        }
        return plan;
    }, defaultPlan);
}

// a book never opened reads as none
export function versesRead(plan: Plan, book = plan.book): number {
    return plan.books[book] ?? 0;
}

export function selectBook(plan: Plan, book: string): Plan {
    return { ...plan, book };
}

export function savePlan(plan: Plan): void {
    save(STORAGE_KEY, plan);
}

export function setPace(plan: Plan, delta: number): Plan {
    return { ...plan, pace: clamp(plan.pace + delta, MIN_PACE, MAX_PACE) };
}

// the active book's bookmark moves by whatever today's count moved by
export function advance(plan: Plan, delta: number, total: number): Plan {
    const next = Math.max(0, Math.min(total, versesRead(plan) + delta));
    return { ...plan, books: { ...plan.books, [plan.book]: next } };
}

export function totalVerses(lengths: ChapterLength[]): number {
    return lengths.reduce((sum, c) => sum + c.verses, 0);
}

export interface Reading {
    from: { chapter: number; verse: number };
    to: { chapter: number; verse: number };
    count: number;
    label: string;
    // the start verse only
    startUsfm: string;
    // the whole reading where it fits in one reference, otherwise its first verse
    usfm: string;
}

function locate(lengths: ChapterLength[], offset: number) {
    let left = offset;
    for (const { chapter, verses } of lengths) {
        if (left <= verses) return { chapter, verse: left };
        left -= verses;
    }
    return null;
}

// `read` rather than versesRead, so the parameter doesn't shadow the accessor
export function readingFor(book: string, lengths: ChapterLength[], read: number, pace: number): Reading | null {
    const total = totalVerses(lengths);
    const start = read + 1;
    if (!lengths.length || start > total) return null;   // book finished

    const end = Math.min(read + pace, total);
    const from = locate(lengths, start);
    const to = locate(lengths, end);
    // unreachable after the bounds check above
    if (!from || !to) return null;

    return {
        from,
        to,
        count: end - start + 1,
        label: from.chapter === to.chapter
            ? `${from.chapter}:${from.verse}–${to.verse}`
            : `${from.chapter}:${from.verse}–${to.chapter}:${to.verse}`,
        startUsfm: `${book}.${from.chapter}.${from.verse}`,
        // a usfm range cannot cross a chapter and gloo.rs caps a span at MAX_SPAN
        // a reading that breaks either rule falls back to the verse it starts on
        usfm: from.chapter === to.chapter && to.verse - from.verse < MAX_SPAN
            ? `${book}.${from.chapter}.${from.verse}-${to.verse}`
            : `${book}.${from.chapter}.${from.verse}`,
    };
}

// setDate past the month's end rolls over on its own, and stays in local time
// like dayKey()
export function finishedBy(remaining: number, pace: number, from = new Date()): Date {
    const date = new Date(from);
    date.setDate(date.getDate() + Math.ceil(remaining / pace));
    return date;
}