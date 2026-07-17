<script lang="ts">
    import { getVerseOfTheDay, type Passage } from "$lib/youversion/api";

    let votd = $state<Passage | null>(null);
    let votdError = $state<string | null>(null);

    async function loadVotd() {
        try {
            votd = await getVerseOfTheDay();
        } catch (err) {
            votdError = err instanceof Error ? err.message : String(err)
        }
    }
    loadVotd();
</script>

{#if votd}
    <blockquote>
        <p>{votd.text}</p>
        <footer>
            {votd.reference} ({votd.versionTitle})
            <small>{votd.copyright}</small>
        </footer>
    </blockquote>
{:else if votdError}
    <p>Couldn't load today's verse: {votdError}</p>
{:else}
    <p>Loading today's verse...</p>
{/if}