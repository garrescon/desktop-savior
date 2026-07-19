<script lang="ts">
  import { loadBehaviors, type Behavior } from "$lib/behavior/types";
  import { behaviorDefs } from "$lib/behavior/behaviors";
  import { getVerseOfTheDay, type Passage } from "$lib/youversion/api";
  import { getCurrentWindow, currentMonitor, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";

  import Savior from "$lib/behavior/Savior.svelte";
  import Stash from "$lib/behavior/Stash.svelte";
  import Bubble from "$lib/effects/Bubble.svelte"
  
  const DEV = true;
  const QUIET_MIN_MS = DEV ? 15_000 : 2 * 60 * 60 * 1000;
  const QUIET_MAX_MS = DEV ? 25_000 : 3 * 60 * 60 * 1000;
  const STASH_PX = 72;
  const UNSTASHED_W = 280, UNSTASHED_H = 360;

  type Mode = "active" | "stashed";
  let mode = $state<Mode>("active");
  let geometryReady = $state(false);

  let bubble = $state<Passage | null>(null);
  let behaviors = $state<Behavior[] | null>(null);
  let loadError = $state<string | null>(null);
  
  function stash() {
    bubble = null;
    mode = "stashed";
  }
  
  function restore() {
    mode = "active";
  }

  async function load() {
    try {
      behaviors = await loadBehaviors(behaviorDefs);
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err); 
    }
  }

  $effect(() => {
    let disposed = false;
    let timerId: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      if (mode !== "active") return
      const quiet = QUIET_MIN_MS + Math.random()* (QUIET_MAX_MS - QUIET_MIN_MS);
      timerId = setTimeout(async () => {
        try {
          const passage = await getVerseOfTheDay()
          if (disposed) return
          bubble = passage;
        } catch (err) {
          console.warn("encouragement skipped:", err);
        }
        if (disposed) return
        scheduleNext();
      }, quiet);
    }

    scheduleNext();
    return ()=> {
      disposed = true;
      clearTimeout(timerId);
    }
  });

  $effect(() => {
    const stashed = mode === "stashed";
    let disposed = false;
    geometryReady = false;

    (async () => {
      const win = getCurrentWindow();
      const monitor = await currentMonitor();
      if (disposed || !monitor) return;
      const area = monitor.workArea;

      if (stashed) {
        await win.setSize(new PhysicalSize(STASH_PX, STASH_PX));
        if (disposed) return;
        await win.setPosition(new PhysicalPosition(
          area.position.x + area.size.width - STASH_PX,
          area.position.y + area.size.height - STASH_PX,
        ));
      } else {
        await win.setSize(new PhysicalSize(UNSTASHED_W, UNSTASHED_H));
        if (disposed) return;
        await win.setPosition(new PhysicalPosition(
          area.position.x + Math.round((area.size.width - UNSTASHED_W) / 2),
          area.position.y + area.size.height - UNSTASHED_H,
        ));
      }
      if (disposed) return;
      geometryReady = true;
    })().catch(console.warn);
      
    return () => { disposed = true; }
  });
  load(); 
</script>

<main>
  {#if mode === "stashed"}
    <Stash onRestore={restore} />
  {:else}
    {#if bubble}
      <Bubble passage={bubble} onDismiss={() => (bubble = null)} />
    {/if}
    {#if behaviors && geometryReady}
      <Savior {behaviors} onStash={stash} />
    {:else if loadError}
      <p>{loadError}</p>
    {/if}
  {/if}
</main>

<style>
  :global(html),
  :global(body) {
    background: transparent;
    margin: 0;
    overflow: hidden;
    height: 100%;
  }
  main {
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
  }
</style>
