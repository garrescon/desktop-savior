export interface FrameDim {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface SpriteFrame {
    frame: FrameDim;
    duration: number;
}

export interface FrameTag {
    name: string;
    from: number;
    to: number;
    direction: "forward" | "reverse" | "pingpong"; // unhandled for now
}

export interface AsepriteSheet {
    frames: SpriteFrame[];
    meta: {
        size: { w: number; h: number };
        frameTags: FrameTag[];
    }
}

export function verifySheet(data: unknown): AsepriteSheet {
    const sheet = data as AsepriteSheet;
    if (!Array.isArray(sheet?.frames)) {
        throw new Error("Frames array is missing in spritesheet JSON, ensure Array is selected when exporting.");
    }
    return sheet;
}