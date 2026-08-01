import type { BehaviorDef } from "./types";

// weight 0 loads the sheet without entering the weighted pick
export const PRAYER_ID = "savior-special-pray";
export const FALL_ID = "savior-special-fall";
export const PEEK_ID = "savior-special-peak";
export const ATTENTION_ID = "savior-special-moment";

export const behaviorDefs: BehaviorDef[] = [
    { id: "savior-generic-idle", weight: 20,
        termination:{ kind: "duration", minMs: 5000, maxMs: 10000 } },

    { id: "savior-generic-walk-r", weight: 10,
        movement:{kind: "walk", speed: 60, direction: 1 },
        termination: { kind: "duration", minMs: 5000, maxMs: 10000 } },

    { id: "savior-generic-walk-l", weight: 10,
        movement:{kind: "walk", speed: 60, direction: -1 },
        termination: { kind: "duration", minMs: 5000, maxMs: 10000 } },

    { id: "savior-oneshot-love", weight: 5,
        termination: { kind: "duration", minMs: 2000, maxMs: 4000 } },

    // animationEnd plays it once and hands back to the weighted pick
    { id: ATTENTION_ID, weight: 0,
        termination: { kind: "animationEnd" } },

    { id: PRAYER_ID, weight: 0,
        termination: { kind: "animationEnd" } },

    { id: PEEK_ID, weight: 0,
        termination: { kind: "animationEnd" } },

    // duration keeps the pose looping since the timer cannot arm while suspended
    { id: FALL_ID, weight: 0,
        termination: { kind: "duration", minMs: 1000, maxMs: 1000 } },
];