<script lang="ts">
    import type { Ring } from "./progress";

    // names and label come from the caller — no copy lives in here
    let { measures, label = "[the day]" }: {
        measures: { name: string; tint: string; ring: Ring }[];
        label?: string;
    } = $props();

    // pathLength normalises the circle to 300, so each of the rings
    // has 100 units and the gap is subtracted from its span
    const SPAN = 100, GAP = 7;
</script>

<div class="seal">
    <svg viewBox="0 0 120 120" role="img" aria-label={label}>
        <g transform="rotate(-90 60 60)">
            {#each measures as m, i}
                {@const offset = -(i * SPAN + GAP / 2)}
                <circle
                    class="track"
                    cx="60" cy="60" r="46"
                    pathLength="300"
                    stroke-dasharray="{SPAN - GAP} 300"
                    stroke-dashoffset={offset}
                />
                <circle
                    class="arc"
                    cx="60" cy="60" r="46"
                    pathLength="300"
                    stroke={m.tint}
                    stroke-dasharray="{m.ring.fraction * (SPAN - GAP)} 300"
                    stroke-dashoffset={offset}
                />
            {/each}
        </g>
    </svg>

    <ul class="legend">
        {#each measures as m}
            <li>
                <span class="swatch" style="background: {m.tint}"></span>
                <span class="name">{m.name}</span>
                <span class="box" class:done={m.ring.complete}>{m.ring.complete ? "✓" : ""}</span>
            </li>
        {/each}
    </ul>
</div>

<style>
    .seal {
        display: flex;
        align-items: center;
        gap: 26px;
    }

    svg { width: 116px; height: 116px; flex: none; }

    .track {
        fill: none;
        stroke: var(--hair);
        stroke-width: 7;
    }
    .arc {
        fill: none;
        stroke-width: 7;
        stroke-linecap: butt;
        transition: stroke-dasharray 260ms ease;
    }

    .legend {
        flex: 1;
        min-width: 0;
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 9px;
    }
    .legend li {
        display: grid;
        grid-template-columns: 9px 1fr auto;
        align-items: center;
        gap: 11px;
    }

    .swatch { width: 9px; height: 9px; }

    .name {
        font: 400 9.5px/1 var(--body);
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: rgba(var(--ink), 0.6);
    }

    .box {
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        font: 400 14px/1 var(--body);
        background: var(--surface);
        border: 1px solid rgba(var(--ink), 0.3);
        color: var(--cream);
        transition: background-color var(--tick) ease, border-color var(--tick) ease;
    }
    .box.done {
        background: var(--walnut);
        border-color: var(--walnut);
    }
</style>
