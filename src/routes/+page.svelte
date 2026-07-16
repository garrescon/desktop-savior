<script lang="ts">
  import Savior from "../lib/behavior/Savior.svelte";
  import { loadBehaviors, type Behavior } from "$lib/behavior/types";
  import { behaviorDefs } from "$lib/behavior/behaviors";

  let behaviors = $state<Behavior[] | null>(null);
  let loadError = $state<string | null>(null);
  
  async function load() {
    try {
      behaviors = await loadBehaviors(behaviorDefs);
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err); 
    }
  }
  load(); 
</script>

{#if behaviors}
  <Savior {behaviors} />
{:else if loadError}
  <p>{loadError}</p>
{:else}
  <p>Loading...</p>
{/if}

<style>
  :global(html),
  :global(body) {
    background: transparent;
    margin: 0;
    overflow: hidden;
  }
</style>
