<script lang="ts">
    import { listen } from "@tauri-apps/api/event";

    import Sprite from "$lib/sprite/Sprite.svelte";
    import { GRAVITY, type Behavior } from "$lib/behavior/types";
    import { hitbox } from "$lib/stage/hitbox";

    let { behavior, goalSeconds, onDone }: {
        behavior: Behavior | null;
        goalSeconds: number;
        // the lift is what His window spawns at so gravity takes Him down from here
        onDone: (seconds: number, liftCss: number) => void;
    } = $props();

    const started = Date.now();
    let elapsed = $state(0);

    // the segment machine lives in Savior so the sitting needs its own
    let segment = $state<"intro" | "loop">("loop");
    $effect(() => {
        if (behavior?.intro) segment = "intro";
    });
    const tag = $derived(
        segment === "intro" && behavior?.intro ? behavior.intro : behavior?.loop,
    );

    let riser = $state<HTMLDivElement | null>(null);

    // the wrapper fills the dial so the sprite itself is the thing to measure
    function spriteLift(): number {
        const drawn = riser?.firstElementChild;
        if (!drawn) return 0;
        return Math.max(0, window.innerHeight - drawn.getBoundingClientRect().bottom);
    }

    // He hops in along the floor so the dial has to be reached rather than cut to
    $effect(() => {
        const wrap = riser;
        if (!wrap) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const drop = spriteLift();
        if (drop <= 0) return;

        const rise = wrap.animate(
            [{ transform: `translateY(${drop}px)` }, { transform: "translateY(0)" }],
            {
                // the rise half of a jump to that height
                duration: Math.sqrt((2 * drop) / GRAVITY) * 1000,
                easing: "cubic-bezier(0.12, 0.68, 0.32, 1)",
            },
        );
        return () => rise.cancel();
    });

    $effect(() => {
        const id = setInterval(() => {
            elapsed = Math.floor((Date.now() - started) / 1000);
        }, 1000);
        return () => clearInterval(id);
    });

    // anti-stopwatch arc
    const fraction = $derived(goalSeconds > 0 ? Math.min(1, elapsed / goalSeconds) : 0);
    const closed = $derived(goalSeconds > 0 && elapsed >= goalSeconds);

    $effect(() => {
        let disposed = false;
        let unlisten: (() => void) | undefined;

        listen("amen", () => {
            onDone(elapsed, spriteLift());
        }).then((fn) => {
            if (disposed) { fn(); return; }
            unlisten = fn;
        }).catch(console.warn);

        return () => {
            disposed = true;
            unlisten?.();
        };
    });
</script>

<div class="sitting" use:hitbox>
    <div class="dial">
        <svg viewBox="0 0 120 120" role="img" aria-label="time with Him">
            <g transform="rotate(-90 60 60)">
                <circle class="track" cx="60" cy="60" r="52" />
                <circle
                    class="arc"
                    class:closed
                    cx="60" cy="60" r="52"
                    pathLength="100"
                    stroke-dasharray="100"
                    stroke-dashoffset={100 - fraction * 100}
                />
            </g>
        </svg>

        {#if behavior && tag}
            <div class="sprite" bind:this={riser}>
                <Sprite
                    src={behavior.src}
                    sheet={behavior.sheet}
                    {tag}
                    loop={segment === "loop"}
                    onComplete={() => (segment = "loop")}
                />
            </div>
        {/if}
    </div>
</div>

<style>
    .sitting {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 22px;
        padding: 20px;
    }

    .dial { position: relative; display: grid; place-items: center; }
    .dial svg { width: 190px; height: 190px; display: block; }
    
    .sprite {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        pointer-events: none;
    }

    .track {
        fill: none;
        stroke: rgba(var(--ink), 0.18);
        stroke-width: 5;
    }
    .arc {
        fill: none;
        stroke: var(--maroon);
        stroke-width: 5;
        stroke-linecap: butt;
        transition: stroke-dashoffset 900ms linear, stroke 400ms ease;
    }
    .arc.closed { stroke: var(--mustard); }

    @media (prefers-reduced-motion: reduce) {
        .arc { transition: none; }
    }
</style>
