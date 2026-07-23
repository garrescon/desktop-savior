<script lang="ts">
  import Sprite from "$lib/sprite/Sprite.svelte";
  import type { Behavior } from "$lib/behavior/types";
  import type { Passage } from "$lib/youversion/api";
  import type { ReminderDef } from "./themes";

  let { def, behavior, verses, onDone }: {
    def: ReminderDef;
    behavior: Behavior | null;  // null means no sprite, moment still happens
    verses: Passage[];          // empty means no verse card, moment still happens
    onDone: () => void;
  } = $props();

  // one verse per moment
  // lookup stays reactive so a pool that lands mid-moment still shows up
  const pick = Math.random();
  const verse = $derived(
    verses.length > 0 ? verses[Math.floor(pick * verses.length)] : null,
  );
</script>

<div class="moment">
  {#if behavior}
    <Sprite src={behavior.src} sheet={behavior.sheet} tag={behavior.loop} />
  {/if}
  <p class="breath">{def.breath}</p>
  {#if verse}
    <blockquote>
      <p>{verse.text}</p>
      <footer>{verse.reference} ({verse.versionTitle}) <small>{verse.copyright}</small></footer>
    </blockquote>
  {/if}
  <button class="done" onclick={onDone}>{def.exit}</button>
</div>

<style>
  .moment {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px;
  }
  .done {
    font-size: 1.1rem;
    padding: 10px 24px;
  }
</style>