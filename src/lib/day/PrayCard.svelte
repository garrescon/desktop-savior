<script lang="ts">
    import type { Ring } from "./progress";

    let { ring, sitting, onBegin, onEnd }: {
        ring: Ring;             // seconds today against the daily goal
        sitting: boolean;
        onBegin: () => void;
        onEnd: () => void;
    } = $props();

    const goalMinutes = $derived(Math.round(ring.goal / 60));
</script>

<div class="pray">
    <div class="pray-head">
        <div class="pray-goal">{goalMinutes} minutes a day</div>
        <button class="pray-begin" onclick={sitting ? onEnd : onBegin}>
            {sitting ? "Finished" : "begin →"}
        </button>
    </div>

    <div class="meter"><div class="meter-fill" style="width: {ring.fraction * 100}%"></div></div>

    {#if ring.complete}
        <p class="pray-note">you sat the whole while today</p>
    {/if}
</div>

<style>
    /* the gap above comes from .section's head rule */
    /* the one below the control row comes from --row-gap */
    .pray {
        padding-bottom: 20px;
    }

<<<<<<< HEAD
=======
    /* centered rather than baseline-aligned */
>>>>>>> b90a09e8e3c1287187510faf39de38285d904764
    /* the display face has descenders that hang below the button when bottom-aligned */
    .pray-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: var(--row-gap);
    }
    .pray-goal {
        font: 400 28px/1 var(--display);
        font-variant-numeric: tabular-nums;
        color: var(--walnut);
    }

    /* same size as the reading stepper */
    .pray-begin {
        flex: none;
        width: var(--ticker);
        white-space: nowrap;
        padding: 10px 13px;
        background: transparent;
        color: var(--maroon);
        border: 1px solid var(--maroon);
        font: 400 10px/1 var(--body);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background-color var(--tick) ease;
    }
    .pray-begin:hover { background: rgba(var(--red), 0.07); }

    .meter :global(.meter-fill) { background: var(--maroon); }

    .pray-note {
        margin: 9px 0 0;
        font: italic 400 12px/1.5 var(--body);
        color: rgba(var(--ink), 0.5);
        text-wrap: pretty;
    }
</style>
