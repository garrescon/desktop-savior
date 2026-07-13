<script lang="ts">
  import Sprite from "../lib/sprite/Sprite.svelte";
  import { validateSheet, type AsepriteSheet } from "../lib/sprite/types";

  let sheet = $state<AsepriteSheet | null>(null);
  let tag = $state<string>('Loop');

  async function load() {
    const response = await fetch('/savior.json');
    sheet = validateSheet(await response.json());
  }
  load();
</script>

{#if sheet}
  <div data-tauri-drag-region>
    <Sprite src="/savior-sheet.png" {sheet} {tag} />
  </div>
{:else}
  <p>broke</p>
{/if}

<style>
  :global(html),
  :global(body) {
    background: transparent;
    margin: 0;
    overflow: hidden;
  }
</style>
