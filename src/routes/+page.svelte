<script lang="ts">
  import { getCurrentWindow, currentMonitor, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";
  import { listen } from "@tauri-apps/api/event";

  import { loadBehaviors, type Behavior } from "$lib/behavior/types";
  import { behaviorDefs } from "$lib/behavior/behaviors";
  import { getVerseOfTheDay, getPassage, type Passage } from "$lib/youversion/api";
  import { REMINDERS, type ReminderTheme } from "$lib/reminder/themes";
  import { DEMO_MODE } from "$lib/dev";

  import Savior from "$lib/behavior/Savior.svelte";
  import Stash from "$lib/behavior/Stash.svelte";
  import Bubble from "$lib/effects/Bubble.svelte"
  import ReminderMoment from "$lib/reminder/ReminderMoment.svelte"


  const QUIET_MIN_MS = DEMO_MODE ? 15_000 : 2 * 60 * 60 * 1000;
  const QUIET_MAX_MS = DEMO_MODE ? 25_000 : 3 * 60 * 60 * 1000;
  const STASH_PX = 72;
  const UNSTASHED_W = 280, UNSTASHED_H = 360;
  const REMINDER_W = 400, REMINDER_H = 560;

  type Mode = "active" | "stashed" | "reminder";
  let mode = $state<Mode>("active");
  let reminderTheme = $state<ReminderTheme>("love");
  // false while a mode change is resizing/moving the window
  // anything that uses geometry obeys it
  let geometryReady = $state(false);

  let bubble = $state<Passage | null>(null);
  let behaviors = $state<Behavior[] | null>(null);
  let reminderVerses = $state<Partial<Record<ReminderTheme, Passage[]>>>({});
  let loadError = $state<string | null>(null);
  
  function stash() {
    bubble = null;
    mode = "stashed";
  }
  
  function restore() {
    mode = "active";
  }

  async function loadBehaviorAssets() {
    try {
      behaviors = await loadBehaviors(behaviorDefs);
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
    }
  }

  // encouragement bubble scheduler
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

  // reminder listener
  $effect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen<string>("reminder", (e) => {
      if (!(e.payload in REMINDERS)) {
        console.warn("unknown reminder theme:", e.payload);
        return;
      }
      if (!reminderVerses[e.payload as ReminderTheme]?.length) loadReminderVerses();
      bubble = null;
      reminderTheme = e.payload as ReminderTheme;
      mode = "reminder";
    }).then((fn) => {
      if (disposed) { fn(); return; }
      unlisten = fn;
    }).catch(console.warn);

    return () => {
      disposed = true;
      unlisten?.();
    };
  });

  // window geometry management
  $effect(() => {
    const m = mode;
    let disposed = false;
    geometryReady = false;

    (async () => {
      const win = getCurrentWindow();
      const monitor = await currentMonitor();
      if (disposed || !monitor) return;
      const area = monitor.workArea;
      
      switch (m) {
        case "stashed":
          await win.setSize(new PhysicalSize(STASH_PX, STASH_PX));
          if (disposed) return;
          await win.setPosition(new PhysicalPosition(
            area.position.x + area.size.width - STASH_PX,
            area.position.y + area.size.height - STASH_PX,
          ));
          break;
        case "active":
          await win.setSize(new PhysicalSize(UNSTASHED_W, UNSTASHED_H));
          if (disposed) return;
          await win.setPosition(new PhysicalPosition(
            area.position.x + Math.round((area.size.width - UNSTASHED_W) / 2),
            area.position.y + area.size.height - UNSTASHED_H,
          ));
          break;
        case "reminder":
          await win.setSize(new PhysicalSize(REMINDER_W, REMINDER_H));
          if (disposed) return;
          await win.setPosition(new PhysicalPosition(
            area.position.x + Math.round((area.size.width - REMINDER_W) / 2),
            area.position.y + area.size.height - REMINDER_H,
          ));
          break;
        default:
          m satisfies never;
      }

      if (disposed) return;
      geometryReady = true;
    })().catch(console.warn);
      
    return () => { disposed = true; }
  });
  // startup
  loadBehaviorAssets();
  loadReminderVerses();

  async function loadReminderVerses() {
    for (const [theme, def] of Object.entries(REMINDERS)) {
      const results = await Promise.allSettled(def.refs.map(getPassage));
      const verses = results
        .filter((r): r is PromiseFulfilledResult<Passage> => r.status === "fulfilled")
        .map((r) => r.value);
      reminderVerses[theme as ReminderTheme] = verses;
      const failed = results.length - verses.length;
      if (failed > 0) console.warn(`${theme} verses: ${failed}/${results.length} unavailable at launch`);
    }
  }
</script>

<main>
  {#if mode === "stashed"}
    <Stash onRestore={restore} />
  {:else if mode === "reminder"}
    {#if geometryReady}
      <ReminderMoment
        def={REMINDERS[reminderTheme]}
        behavior={behaviors?.find((b) => b.id === "savior-generic-idle") ?? null}
        verses={reminderVerses[reminderTheme] ?? []}
        onDone={() => (mode = "active")}
      />
    {/if}
  {:else if mode === "active"}
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
