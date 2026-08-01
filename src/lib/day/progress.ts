import { load, save, whole } from "$lib/store";

export interface DayProgress {
    verses: number;
    seconds: number;
}

export type DayLog = Record<string, DayProgress>;

<<<<<<< HEAD
=======
// the lens Gloo answers through
// "default" is sent as nothing at all so the model keeps its general perspective
export const TRADITIONS = ["default", "evangelical", "catholic", "mainline"] as const;
export type Tradition = (typeof TRADITIONS)[number];
export const DEFAULT_TRADITION: Tradition = "default";

// the Bible goal is not here because it lives on plan.pace
export interface Settings {
    prayerMinutes: number;
    tradition: Tradition;
}

export const MIN_PRAYER = 1, MAX_PRAYER = 120, DEFAULT_PRAYER = 10;

>>>>>>> b90a09e8e3c1287187510faf39de38285d904764
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

<<<<<<< HEAD
=======
export function loadSettings(): Settings {
    return load(SETTINGS_KEY, (raw) => {
        const parsed = raw as Partial<Settings>;
        return {
            prayerMinutes: Number.isFinite(parsed?.prayerMinutes)
                ? clamp(parsed!.prayerMinutes!, MIN_PRAYER, MAX_PRAYER)
                : DEFAULT_PRAYER,
            // settings saved before this existed read as the default
            tradition: TRADITIONS.includes(parsed?.tradition as Tradition)
                ? (parsed!.tradition as Tradition)
                : DEFAULT_TRADITION,
        };
    }, () => ({ prayerMinutes: DEFAULT_PRAYER, tradition: DEFAULT_TRADITION }));
}

export function saveSettings(settings: Settings): void {
    save(SETTINGS_KEY, settings);
}

export function setPrayerGoal(settings: Settings, delta: number): Settings {
    return { ...settings, prayerMinutes: clamp(settings.prayerMinutes + delta, MIN_PRAYER, MAX_PRAYER) };
}

export function setTradition(settings: Settings, tradition: Tradition): Settings {
    return { ...settings, tradition };
}

>>>>>>> b90a09e8e3c1287187510faf39de38285d904764
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
