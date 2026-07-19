<script lang="ts">
    import type { Passage } from "$lib/youversion/api"

    let { passage, lifetimeMs = 20_000, onDismiss }: {
        passage: Passage
        lifetimeMs?: number;
        onDismiss: () => void;
    } = $props();

    $effect(() => {
        const id = setTimeout(onDismiss, lifetimeMs);
        return () => clearTimeout(id);
    });
</script>

<button class = "bubble" onclick={onDismiss} title="dismiss">
    <p>{passage.text}</p>
    <small>{passage.reference} ({passage.versionTitle})</small>
    <small class="copyright">{passage.copyright}</small>
</button>

<style>
    .bubble {
        max-width: 240px;
        background: #fffdf5;
        border: 1px solid #d9d2bf;
        border-radius: 12px;
        padding: 10px 12px;
        margin-bottom: 8px;
        font: inherit;
        text-align: left;
        cursor: pointer;
    }
    .bubble p { margin: 0 0 6px; }
    .copyright { display: block; font-size: 0.6rem; opacity: 0.7; }
</style>