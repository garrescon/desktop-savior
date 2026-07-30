<script lang="ts">
    import Passages, { type Entry } from "./Passages.svelte";
    import type { Shelf } from "./shelf";

    let { shelf, onDrop }: {
        shelf: Shelf;
        onDrop: (usfm: string) => void;
    } = $props();
</script>

{#snippet release(entry: Entry)}
    <button class="release" onclick={() => onDrop(entry.usfm)}>Remove</button>
{/snippet}

<div class="kept">
    {#if shelf.length}
        <Passages entries={shelf} action={release} />
    {:else}
        <p class="empty">[nothing kept yet]</p>
    {/if}
</div>

<style>
    .kept { margin-top: 4px; }

    .release {
        padding: 8px 12px;
        background: transparent;
        color: rgba(var(--ink), 0.5);
        border: 1px solid var(--hair-firm);
        font: 400 9.5px/1 var(--body);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
        transition: color var(--tick) ease, border-color var(--tick) ease;
    }
    .release:hover { color: var(--maroon); border-color: var(--maroon); }

    .empty {
        margin: 12px 0 0;
        font: italic 400 12px/1.5 var(--body);
        color: rgba(var(--ink), 0.45);
    }
</style>
