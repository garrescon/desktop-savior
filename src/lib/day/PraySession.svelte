<script lang="ts">
    import Sprite from "$lib/sprite/Sprite.svelte";
    import type { Behavior } from "$lib/behavior/types";

    let { behavior, goalSeconds, onDone }: {
        behavior: Behavior | null;
        goalSeconds: number;
        onDone: (seconds: number) => void;
    } = $props();

    const started = Date.now();
    let elapsed = $state(0);

    $effect(() => {
        const id = setInterval(() => {
            elapsed = Math.floor((Date.now() - started) / 1000);
        }, 1000);
        return () => clearInterval(id);
    });

    // anti-stopwatch arc
    const fraction = $derived(goalSeconds > 0 ? Math.min(1, elapsed / goalSeconds) : 0);
    const closed = $derived(goalSeconds > 0 && elapsed >= goalSeconds);

    // button shows a temp message for 4 seconds to confirm the clock has started
    const CONFIRM_S = 4;
    const confirming = $derived(elapsed < CONFIRM_S);
</script>

<div class="sitting">
    <div class="dial">
        <svg viewBox="0 0 120 120" role="img" aria-label="[time with Him]">
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

        {#if behavior}
            <div class="sprite">
                <Sprite src={behavior.src} sheet={behavior.sheet} tag={behavior.loop} />
            </div>
        {/if}
    </div>

    <p class="breath">[breath]</p>

    <button class="done" onclick={() => onDone(elapsed)}>
        {confirming ? "[the sitting has begun]" : "[amen]"}
    </button>
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

    .breath {
        margin: 0;
        max-width: 300px;
        font: italic 400 17px/1.6 var(--display);
        color: var(--walnut);
        text-align: center;
        text-wrap: pretty;
    }

    .done {
        padding: 11px 26px;
        background: transparent;
        color: var(--walnut);
        border: 1px solid rgba(var(--ink), 0.4);
        font: 400 11px/1 var(--body);
        letter-spacing: 0.2em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background-color var(--tick) ease;
    }
    .done:hover { background: rgba(var(--ink), 0.07); }
    .done:focus-visible { outline: 1px solid var(--mustard); outline-offset: 2px; }

    @media (prefers-reduced-motion: reduce) {
        .arc, .done { transition: none; }
    }
</style>
