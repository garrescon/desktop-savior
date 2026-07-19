import { verifySheet, type AsepriteSheet, type FrameTag } from "$lib/sprite/types";

export type Termination =
    | { kind: "animationEnd" }
    | { kind: "duration"; minMs: number; maxMs: number };

export type Movement = { kind: "walk"; speed: number }

export interface BehaviorDef {
    id: string;
    weight: number;
    termination: Termination;
    movement?: Movement
}

export interface Behavior extends BehaviorDef {
    src: string;
    sheet: AsepriteSheet;
    intro?: FrameTag;
    loop: FrameTag;
    outro?: FrameTag;
}

export async function loadBehaviors(defs: BehaviorDef[]): Promise<Behavior[]> {
    const problems: string[] = [];

    const results = await Promise.all(defs.map(async (def): Promise<Behavior | null> => {
        const response = await fetch(`/anims/${def.id}.json`);
        if (!response.ok) {
            problems.push(`${def.id}.json not found in /anims/`);
            return null;
        }
        const sheet = verifySheet(await response.json());
        const tags = new Map(sheet.meta.frameTags.map((t) => [t.name, t]));

        // No tags, mark the whole animation as the loop
        // Any tags, loop must be already assigned
        let loop = tags.get("loop");
        if (!loop) {
            if (tags.size > 0) {
                problems.push(`No "loop" in ${def.id}, found tags are: (${[...tags.keys()].join(", ")}) `)
                return null;
            }
            
            loop = { name: "loop", from: 0, to: sheet.frames.length - 1, direction: "forward" };
        };
        
        return {
            ...def,
            src: `/anims/${def.id}.png`,
            sheet,
            loop,
            intro: tags.get("intro"),
            outro: tags.get("outro"),
        };
    }));

    if (problems.length > 0) {
        throw new Error(`Behavior loading failed:\n${problems.map((p) => `- ${p}`).join("\n")}`);
    }
    return results.filter((r) => r !== null);
}