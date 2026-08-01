import { load, save, clamp } from "$lib/store";

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

const SETTINGS_KEY = "desktop-savior:settings:v1";

// the Gloo surfaces call this at ask time rather than taking a prop, because settings
// live in another tab and can change between one ask and the next
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
