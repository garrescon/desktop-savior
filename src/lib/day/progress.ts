import { load, save, whole } from "$lib/store";

export interface DayProgress {
    verses: number;
    seconds: number;
}

export type DayLog = Record<string, DayProgress>;

export const CONNECT_GOAL = 1;

const LOG_KEY = "desktop-savior:day:v1";

// local calendar day
export function dayKey(date = new Date()): string {
    const month = String(date.getMonth() + 1).padStart(2, "0");  // getMonth is 0-based
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

export function emptyProgress(): DayProgress {
    return { verses: 0, seconds: 0 };
}

export function loadLog(): DayLog {
    return load(LOG_KEY, (raw) => {
        const log: DayLog = {};
        // clamp rather than reject, so one bad day can't wipe the rest
        for (const [day, value] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
            if (!value || typeof value !== "object") continue;
            const p = value as Partial<DayProgress>;
            log[day] = { verses: whole(p.verses), seconds: whole(p.seconds) };
        }
        return log;
    }, () => ({}));
}

export function saveLog(log: DayLog): void {
    save(LOG_KEY, log);
}

// missing days read as zeros
export function progressFor(log: DayLog, day: string): DayProgress {
    return log[day] ?? emptyProgress();
}

function write(log: DayLog, day: string, patch: Partial<DayProgress>): DayLog {
    const current = progressFor(log, day);
    return {
        ...log,
        [day]: {
            verses: whole(patch.verses ?? current.verses),
            seconds: whole(patch.seconds ?? current.seconds),
        },
    };
}

export function addVerses(log: DayLog, day: string, delta: number): DayLog {
    return write(log, day, { verses: progressFor(log, day).verses + delta });
}

export function addSeconds(log: DayLog, day: string, seconds: number): DayLog {
    return write(log, day, { seconds: progressFor(log, day).seconds + seconds });
}

export interface Ring {
    done: number;
    goal: number;
    fraction: number;
    complete: boolean;
}

// a goal of zero never reads as complete
export function ring(done: number, goal: number): Ring {
    return {
        done,
        goal,
        fraction: goal > 0 ? Math.min(1, done / goal) : 0,
        complete: goal > 0 && done >= goal,
    };
}
