<script lang="ts">
    import { listen } from "@tauri-apps/api/event";
    import Sprite from "$lib/sprite/Sprite.svelte";
    import type { Behavior } from "./types";
    import { pickWeighted } from "./random";
    
    let { behaviors }: { behaviors: Behavior[] } = $props();
    let generation = $state(0);

    type Segment = "intro" | "loop" | "outro";

    // svelte-ignore state_referenced_locally
    let behavior = $state<Behavior>(pickWeighted(behaviors, (b) => b.weight));
    // svelte-ignore state_referenced_locally
    let segment = $state<Segment>(behavior.intro ? "intro" : "loop");

    const currentTag = $derived(
        segment === "intro" ? behavior.intro ?? behavior.loop
        : segment === "outro" ? behavior.outro ?? behavior.loop
        : behavior.loop
    );

    const looping = $derived(
        segment === "loop" && behavior.termination.kind === "duration"
    );

    function advance() {
        if (segment === "intro") {
            segment = "loop";
        } else if (segment === "loop" && behavior.outro) {
            segment = "outro";
        } else {
            startNextBehavior();
        }
    }

    function startNextBehavior() {
        const next = pickWeighted(behaviors, (b) => b.weight);
        behavior = next;
        segment = next.intro ? "intro" : "loop";
        generation++;
    }

    $effect(() => {
        void generation;
        if (segment !== "loop" || behavior.termination.kind !== "duration") return;
        const { minMs, maxMs } = behavior.termination;
        const id = setTimeout(advance, minMs + Math.random() * (maxMs - minMs));
        return () => clearTimeout(id);
    });
</script>

{#key generation}
    <Sprite src={behavior.src} sheet={behavior.sheet} tag={currentTag} loop={looping} onComplete={advance} />
{/key}