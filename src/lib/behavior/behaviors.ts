import type { BehaviorDef } from "./types";

export const behaviorDefs: BehaviorDef[] = [
    { id: "savior-generic-idle", weight: 10,
        termination:{ kind: "duration", minMs: 5000, maxMs: 10000 } },

    { id: "savior-generic-walk", weight: 10,
        movement:{kind: "walk", speed: 60 },
        termination: { kind: "duration", minMs: 5000, maxMs: 10000 } },

    { id: "savior-oneshot-blink", weight: 10,
        termination: { kind: "animationEnd" } },

    { id: "savior-oneshot-sneeze", weight: 10,
        termination: { kind: "animationEnd" } },
];