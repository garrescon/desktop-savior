<script lang="ts">
    import type { Snippet } from "svelte";
    import type { Passage } from "$lib/youversion/api";

    export type Entry = Passage & { usfm: string };

    let { entries, action }: {
        entries: Entry[];
        action?: Snippet<[Entry]>;
    } = $props();

    let opened = $state<string | null>(null);

    // first verse is open
    const open = $derived(
        entries.some((e) => e.usfm === opened) ? opened : entries[0]?.usfm ?? null,
    );
</script>

<div class="stack">
    {#each entries as entry (entry.usfm)}
        {#if entry.usfm === open}
            <blockquote class="verse-plate">
                <span class="verse-mark" aria-hidden="true">“</span>
                <div class="verse-frame">
                    <p class="verse-text">{entry.text}</p>
                    <div class="verse-ref">
                        <span class="verse-rule" aria-hidden="true"></span>
                        <cite>{entry.reference}</cite>
                    </div>
                    <p class="verse-credit">{entry.versionTitle} · {entry.copyright}</p>
                    {#if action}
                        <div class="verse-act">{@render action(entry)}</div>
                    {/if}
                </div>
            </blockquote>
        {:else}
            <button class="row" onclick={() => (opened = entry.usfm)}>
                <span class="row-caret" aria-hidden="true">›</span>
                <span class="row-ref">{entry.reference}</span>
            </button>
        {/if}
    {/each}
</div>

<style>
    .stack { flex-shrink: 0; }

    .verse-plate {
        margin: 16px 0 0;
        padding: 14px;
        background: var(--surface);
        border: 1px solid rgba(var(--gold), 0.45);
        position: relative;
        overflow: hidden;
    }
    /* big quote mark, clipped by the overflow on .verse-plate */
    .verse-mark {
        position: absolute;
        top: 2px;
        left: 6px;
        font: 400 108px/0.86 var(--display);
        color: var(--mustard);
        opacity: 0.12;
        pointer-events: none;
    }
    .verse-frame {
        position: relative;
        border: 1px solid rgba(var(--gold), 0.3);
        padding: 26px 22px 20px;
    }
    .verse-text {
        margin: 0;
        font: 400 23px/1.55 var(--display);
        text-wrap: pretty;
    }
    .verse-ref {
        margin-top: 18px;
        display: flex;
        align-items: center;
        gap: 10px;
        font: 400 11px/1 var(--body);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--maroon);
        font-variant-numeric: tabular-nums;
    }
    /* <cite> is italic by default, the reference is set in caps */
    .verse-ref cite { font-style: normal; }
    .verse-rule { width: 18px; height: 1px; background: var(--maroon); }
    .verse-credit {
        margin: 8px 0 0;
        font: 400 9.5px/1.5 var(--body);
        color: rgba(var(--ink), 0.42);
    }
    .verse-act {
        margin-top: 16px;
        padding-top: 13px;
        border-top: 1px solid var(--hair);
        display: flex;
        justify-content: flex-end;
    }

    /* --- the closed rows --- */
    .row {
        display: grid;
        grid-template-columns: 10px 1fr;
        gap: 10px;
        align-items: baseline;
        width: 100%;
        text-align: left;
        padding: 12px 0;
        background: transparent;
        border: none;
        border-bottom: 1px solid rgba(var(--ink), 0.12);
        cursor: pointer;
        color: inherit;
        transition: color var(--tick) ease;
    }
    .row:hover { color: var(--maroon); }
    .row-caret { font: 400 12px/1 var(--body); color: rgba(var(--ink), 0.4); }
    .row-ref {
        font: 400 11px/1 var(--body);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        font-variant-numeric: tabular-nums;
    }
</style>
