<script lang="ts">
    import Sprite from "$lib/sprite/Sprite.svelte";
    import type { Behavior } from "./types";
    import { hitbox } from "$lib/stage/hitbox";

    let { behavior, onRestore }: {
        behavior: Behavior | null;
        onRestore: () => void;
    } = $props();

    const HOLD_MS = 400;

    let holdTimer: ReturnType<typeof setTimeout> | undefined;

    // the sheet has no outro so He leans out once and stays leaning
    let segment = $state<"intro" | "loop">("loop");
    $effect(() => {
        if (behavior?.intro) segment = "intro";
    });
    const tag = $derived(
        segment === "intro" && behavior?.intro ? behavior.intro : behavior?.loop,
    );

    function beginHold() {
        holdTimer = setTimeout(onRestore, HOLD_MS);
    }
    function cancelHold() {
        clearTimeout(holdTimer);
    }
</script>

<!-- deliberately not a drag region. hold-to-restore -->
<!-- the only clickable thing in the window while stashed, so without this rect
     He could never be brought back -->
<button
    class="stash"
    use:hitbox
    onpointerdown={beginHold}
    onpointerup={cancelHold}
    onpointerleave={cancelHold}
    aria-label="Bring Him back"
>
    {#if behavior && tag}
        <Sprite
            src={behavior.src}
            sheet={behavior.sheet}
            {tag}
            loop={segment === "loop"}
            grabbable={false}
            onComplete={() => (segment = "loop")}
        />
    {/if}
</button>

<style>
    /* pinned rather than centred so a window taller than asked for cannot lift Him */
    .stash {
        position: absolute;
        left: 0;
        bottom: 0;
        display: block;
        padding: 0;
        line-height: 0;
        background: transparent;
        border: none;
        cursor: pointer;
        /* a sheet that failed to load still leaves something to grab */
        min-width: 44px;
        min-height: 44px;
    }
</style>
