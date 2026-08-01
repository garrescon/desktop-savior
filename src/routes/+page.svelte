<script lang="ts">
  // Jesus's Window

  import { getCurrentWindow, currentMonitor, PhysicalPosition, LogicalSize } from "@tauri-apps/api/window";
  import { listen, emit } from "@tauri-apps/api/event";
  import { invoke } from "@tauri-apps/api/core";

  import { loadBehaviors, type Behavior } from "$lib/behavior/types";
  import { behaviorDefs, PRAYER_ID, PEEK_ID } from "$lib/behavior/behaviors";
  import "$lib/styles/tokens.css";
  import { getVerseOfTheDay, type Passage } from "$lib/youversion/api";
  import { getCachedPassage } from "$lib/youversion/cache";
  import {
    loadShelf, saveShelf, keep, isKept, type Origin,
  } from "$lib/shelf/shelf";
  import { REMINDERS, type ReminderTheme } from "$lib/reminder/themes";
  import { nextRef } from "$lib/reminder/rotation";
  import { dayKey, loadLog, saveLog, addSeconds } from "$lib/day/progress";
  import { loadSettings } from "$lib/settings/settings";
  import { DEMO_MODE, trace, reportErrors } from "$lib/dev";

  import Savior from "$lib/behavior/Savior.svelte";
  import Stash from "$lib/behavior/Stash.svelte";
  import Bubble from "$lib/effects/Bubble.svelte"
  import Dots from "$lib/effects/Dots.svelte"
  import PraySession from "$lib/day/PraySession.svelte"


  const QUIET_MIN_MS = DEMO_MODE ? 15_000 : 2 * 60 * 60 * 1000;
  const QUIET_MAX_MS = DEMO_MODE ? 25_000 : 3 * 60 * 60 * 1000;
  // these are CSS pixels and not physical
  // LogicalSize gives the webview the same room to lay out on every display
  // sized physically a 280px window is only 187 CSS px wide at 150% scaling
  // the peek sheet's 24px frame at Sprite's default scale of 4
  // any bigger and the window is a transparent rectangle eating clicks around Him
  const STASH_PX = 96;
  const UNSTASHED_W = 280, UNSTASHED_H = 360;
  const PRAYER_W = 400, PRAYER_H = 560;
  const REMINDER_BUBBLE_MS = 45_000;

  type Mode = "active" | "stashed" | "praying";
  let mode = $state<Mode>("active");
  let prayerGoal = $state(0);
  // false while a mode change is resizing/moving the window
  // anything that uses geometry obeys it
  let geometryReady = $state(false);

  // keep is present only for reminder bubbles
  // the verse of the day is filed nowhere so it offers no keep button
  interface Said {
    passage: Passage;
    keep?: { usfm: string; origin: Origin };
  }
  let bubble = $state<Said | null>(null);
  // false while it is still the unopened nub
  let opened = $state(false);
  // one held back so a message being read is never replaced under you
  let waiting = $state<Said | null>(null);

  // one slot so a new passage never stacks into a queue of things owed
  // a verse He was asked for opens straight away because the nub is for unbidden ones
  function say(said: Said, open = false) {
    // an open message is being read so the newcomer takes the waiting slot
    if (bubble && opened) {
      waiting = said;
      return;
    }
    bubble = said;
    opened = open;
  }

  // the held one arrives as the nub because the moment it was asked for has passed
  function dismiss() {
    bubble = waiting;
    opened = false;
    waiting = null;
  }
  // bumped to ask Savior for the attention one-shot
  let attention = $state(0);
  // reset on arrival because a leftover count would hop again on remount
  let summon = $state(0);
  let shelf = $state(loadShelf());
  let behaviors = $state<Behavior[] | null>(null);
  let loadError = $state<string | null>(null);
  
  const bubbleKept = $derived(
    bubble?.keep ? isKept(shelf, bubble.keep.usfm) : false,
  );

  // the companion writes this same key so re-read from disk first
  function keepFromBubble() {
    const said = bubble;
    if (!said?.keep) return;
    shelf = keep(loadShelf(), said.keep.usfm, said.passage, said.keep.origin);
    saveShelf(shelf);
    // the companion re-reads on this
    // a payload would only be a second source of truth
    emit("kept").catch(console.warn);
  }

  // both are one-shot requests to a Savior that is about to be torn down
  // a leftover count fires again the moment one mounts
  function stash() {
    bubble = null;
    waiting = null;
    attention = 0;
    summon = 0;
    mode = "stashed";
  }

  function restore() {
    attention = 0;
    summon = 0;
    mode = "active";
  }

  // deliberately not $state so the geometry effect can clear it without re-running
  let pendingLift = 0;

  function finishPrayer(seconds: number, liftCss: number) {
    if (seconds > 0) saveLog(addSeconds(loadLog(), dayKey(), seconds));
    // the companion holds its own copy and has no way to know
    // it fires even at zero seconds because the button stays Finished until it hears this
    emit("prayed", seconds).catch(console.warn);
    attention = 0;
    pendingLift = liftCss;
    mode = "active";
  }

  async function loadBehaviorAssets() {
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
          say({ passage });
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
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen<string>("reminder", (e) => {
      if (!(e.payload in REMINDERS)) {
        console.warn("unknown reminder theme:", e.payload);
        return;
      }
      const theme = e.payload as ReminderTheme;
      const usfm = nextRef(theme, REMINDERS[theme].refs);
      if (!usfm) {
        console.warn(`reminder: no references authored for ${theme}`);
        return;
      }

      // stashed He should still surface
      // praying the bubble waits because interrupting a sitting would be rude
      if (mode === "stashed") mode = "active";

      getCachedPassage(usfm).then((passage) => {
        if (disposed) return;
        shelf = loadShelf();
        say({
          passage,
          keep: { usfm, origin: { kind: "theme", ids: [theme] } },
        }, true);
        attention += 1;
      }).catch((err) => console.warn(`reminder: ${usfm} unavailable`, err));
    }).then((fn) => {
      if (disposed) { fn(); return; }
      unlisten = fn;
    }).catch(console.warn);

    return () => {
      disposed = true;
      unlisten?.();
    };
  });

  // the tray label follows the window since a drag into the corner also stashes
  $effect(() => {
    invoke("set_savior_mode", { mode }).catch(console.warn);
  });

  // the tray only asks and His window decides what stashing means
  $effect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen("toggle-stash", () => {
      if (mode === "stashed") restore();
      else if (mode === "active") stash();
    }).then((fn) => {
      if (disposed) { fn(); return; }
      unlisten = fn;
    }).catch(console.warn);

    return () => {
      disposed = true;
      unlisten?.();
    };
  });

  // the goal is read off disk so there's no conflict
  $effect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen("pray", () => {
      prayerGoal = loadSettings().prayerMinutes * 60;
      bubble = null;
      waiting = null;
      // only a mounted Savior can make the trip and nothing else clears the ask
      if (mode === "active" && behaviors && geometryReady) summon += 1;
      else mode = "praying";
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
    let parkStash = false;
    let settleId: ReturnType<typeof setTimeout>;
    geometryReady = false;

    (async () => {
      const win = getCurrentWindow();
      const monitor = await currentMonitor();
      if (disposed || !monitor) return;
      const area = monitor.workArea;
      const from = await win.outerPosition();
      const fromSize = await win.outerSize();
      if (disposed) return;
      trace(
        `[geom] -> ${m} from=(${from.x},${from.y}) size=${fromSize.width}x${fromSize.height}` +
        ` area=(${area.position.x},${area.position.y} ${area.size.width}x${area.size.height})` +
        ` scale=${monitor.scaleFactor} lift=${pendingLift}`,
      );

      // sizes go in as CSS px and positions come out physical because workArea is physical
      switch (m) {
        case "stashed": {
          await win.setSize(new LogicalSize(STASH_PX, STASH_PX));
          if (disposed) return;
          const size = await win.outerSize();
          if (disposed) return;
          // the left edge because that is the side He is drawn leaning out from
          const corner = new PhysicalPosition(
            area.position.x,
            area.position.y + area.size.height - size.height,
          );

          // awaited here so the settled-at trace below reports the real position
          await win.setPosition(corner);
          if (disposed) return;

          // a live OS move loop ignores setPosition and holds the window where it was
          // it swallows pointerup too so no event can tell us the loop has ended
          // whether the move stuck is the only honest test
          parkStash = true;
          (async () => {
            for (let attempt = 1; attempt <= 40; attempt++) {
              await new Promise((resolve) => { settleId = setTimeout(resolve, 200); });
              if (disposed || !parkStash) return;
              const at = await win.outerPosition();
              if (disposed || !parkStash) return;
              if (at.x === corner.x && at.y === corner.y) {
                if (attempt > 1) trace(`[geom] stash parked after ${attempt} tries`);
                return;
              }
              trace(`[geom] stash pulled to (${at.x},${at.y}), asking again (#${attempt})`);
              await win.setPosition(corner);
              if (disposed || !parkStash) return;
            }
            trace("[geom] stash would not stay in its corner, use the tray");
          })().catch(console.warn);
          break;
        }
        case "active": {
          // keep the x He is already at instead of recentring
          // being teleported back to the middle after a stash is what this avoids
          // clamped because this window is wider than the stash He may be leaving
          const lift = pendingLift;
          pendingLift = 0;
          const before = await win.outerPosition();
          if (disposed) return;
          const wasWide = (await win.outerSize()).width;
          if (disposed) return;
          await win.setSize(new LogicalSize(UNSTASHED_W, UNSTASHED_H));
          if (disposed) return;
          const size = await win.outerSize();
          if (disposed) return;
          const minX = area.position.x;
          const maxX = area.position.x + area.size.width - size.width;
          // He is drawn centred so holding the centre is what keeps Him still
          const centred = before.x + Math.round((wasWide - size.width) / 2);
          // the ratio is measured rather than assumed from scaleFactor
          const liftPx = Math.round(lift * (size.height / UNSTASHED_H));
          await win.setPosition(new PhysicalPosition(
            Math.min(Math.max(centred, minX), maxX),
            area.position.y + area.size.height - size.height - liftPx,
          ));
          break;
        }
        case "praying": {
          await win.setSize(new LogicalSize(PRAYER_W, PRAYER_H));
          if (disposed) return;
          const size = await win.outerSize();
          if (disposed) return;
          await win.setPosition(new PhysicalPosition(
            area.position.x + Math.round((area.size.width - size.width) / 2),
            area.position.y + area.size.height - size.height,
          ));
          break;
        }
        default:
          m satisfies never;
      }

      if (disposed) return;
      const landed = await win.outerPosition();
      const landedSize = await win.outerSize();
      if (disposed) return;
      trace(`[geom] ${m} settled at (${landed.x},${landed.y}) size=${landedSize.width}x${landedSize.height}`);
      geometryReady = true;
    })().catch(console.warn);
      
    return () => {
      disposed = true;
      parkStash = false;
      clearTimeout(settleId);
    };
  });
  reportErrors();
  loadBehaviorAssets();
</script>

<main>
  {#if mode === "stashed"}
    <Stash
      behavior={behaviors?.find((b) => b.id === PEEK_ID) ?? null}
      onRestore={restore}
    />
  {:else if mode === "praying"}
    {#if geometryReady}
      <PraySession
        behavior={behaviors?.find((b) => b.id === PRAYER_ID) ?? null}
        goalSeconds={prayerGoal}
        onDone={finishPrayer}
      />
    {/if}
  {:else if mode === "active"}
    {#if bubble && opened}
      <Bubble
        passage={bubble.passage}
        lifetimeMs={bubble.keep ? REMINDER_BUBBLE_MS : undefined}
        kept={bubbleKept}
        onKeep={bubble.keep ? keepFromBubble : undefined}
        onDismiss={dismiss}
      />
    {:else if bubble}
      <Dots onOpen={() => (opened = true)} />
    {/if}
    {#if behaviors && geometryReady}
      <Savior
        {behaviors}
        {attention}
        {summon}
        onSummoned={() => { summon = 0; mode = "praying"; }}
        onStash={stash}
      />
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
