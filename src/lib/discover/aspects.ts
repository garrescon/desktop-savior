// the only questions that can be asked about a passage
// ids mirror ASPECTS in gloo.rs and each is described in explore_prompt.txt
// the reader picks one from a button so nothing they type is ever read as an instruction
export interface Aspect {
    id: string;
    label: string;
}

export const ASPECTS: Aspect[] = [
    { id: "setting", label: "When and where" },
    { id: "people", label: "Who is here" },
    { id: "around", label: "What surrounds it" },
    { id: "author", label: "Who wrote it" },
    { id: "custom", label: "What I'd miss" },
];

// a kept passage files under the aspect it was found through so the chip needs the label back
export function aspectLabel(id: string): string | null {
    return ASPECTS.find((a) => a.id === id)?.label ?? null;
}
