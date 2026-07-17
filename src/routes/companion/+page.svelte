<script lang="ts">
    import { invoke } from "@tauri-apps/api/core"
    import { getPassage, type Passage } from "$lib/youversion/api";
    
    interface Guidance { references: string[]; note: string; }

    const FEELINGS = [
        "Peaceful", "Accomplished", "Loved",
        "Unforgiving", "Lonely", "Unmotivated",
    ];

    let note = $state<string | null>(null);
    let passages = $state<Passage[]>([]);
    let asking = $state(false);
    let askError = $state<string | null>(null);

    async function ask(feeling: string) {
        asking = true;
        askError = null;
        note = null;
        passages = [];
        try {
            const guidance = await invoke<Guidance>("ask_gloo", { feelings: [feeling] });
            passages = await Promise.all(guidance.references.map(getPassage));
            note = guidance.note;
        } catch (err) {
            askError = err instanceof Error ? err.message : String(err);
        } finally {
            asking = false;
        }
    }

</script>

{#each FEELINGS as feeling}
  <button onclick={() => ask(feeling)} disabled={asking}>{feeling}</button>
{/each}

{#if note}<p><em>{note}</em></p>{/if}
{#each passages as p}
  <blockquote>
    <p>{p.text}</p>
    <footer>{p.reference} ({p.versionTitle}) <small>{p.copyright}</small></footer>
  </blockquote>
{/each}
{#if askError}<p>Something went wrong: {askError}</p>{/if}