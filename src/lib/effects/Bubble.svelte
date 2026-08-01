<script lang="ts">
    import type { Passage } from "$lib/youversion/api"
    import { hitbox } from "$lib/stage/hitbox";

    let { passage, kept = false, lifetimeMs = 20_000, onKeep, onDismiss }: {
        passage: Passage
        // only reminder bubbles can be kept so the verse of the day passes neither
        kept?: boolean;
        lifetimeMs?: number;
        onKeep?: () => void;
        onDismiss: () => void;
    } = $props();

    $effect(() => {
        const id = setTimeout(onDismiss, lifetimeMs);
        return () => clearTimeout(id);
    });
</script>

<div class="bubble" use:hitbox>
    <button class="said" onclick={onDismiss} title="dismiss">
        <p>{passage.text}</p>
        <small>{passage.reference} ({passage.versionTitle})</small>
        <small class="copyright">{passage.copyright}</small>
    </button>
    {#if onKeep}
        <button class="keep" onclick={onKeep} disabled={kept}>
            {kept ? "kept" : "keep this one"}
        </button>
    {/if}
</div>

<style>
    .bubble {
        flex-shrink: 0;
        max-width: 240px;
        background: #fffdf5;
        border: 1px solid #d9d2bf;
        border-radius: 12px;
        padding: 10px 12px;
        margin-bottom: 8px;
        text-align: left;
    }

    /* the verse is still the dismiss target */
    .said {
        display: block;
        width: 100%;
        padding: 0;
        background: transparent;
        border: none;
        font: inherit;
        text-align: left;
        color: inherit;
        cursor: pointer;
    }

    /* a long verse scrolls here because the window cannot grow to fit it */
    .said p {
        margin: 0 0 6px;
        max-height: 42vh;
        overflow-y: auto;
        overscroll-behavior: contain;
    }
    .copyright { display: block; font-size: 0.6rem; opacity: 0.7; }

    .keep {
        margin-top: 8px;
        padding: 5px 9px;
        background: transparent;
        color: var(--maroon);
        border: 1px solid var(--maroon);
        border-radius: 6px;
        font: 400 9px/1 var(--body);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        cursor: pointer;
    }
    .keep:disabled {
        color: rgba(var(--ink), 0.38);
        border-color: var(--hair-firm);
        cursor: default;
    }
</style>
