<script lang="ts">
    import "$lib/styles/companion.css";
    import { fade } from "svelte/transition";
    import { MediaQuery } from "svelte/reactivity";
    import { emit, listen } from "@tauri-apps/api/event";
    import { openUrl } from "@tauri-apps/plugin-opener";
    import { getChapterLengths, VERSION_ID, type ChapterLength } from "$lib/youversion/api";
    import {
        PLAN_BOOK, PLAN_BOOK_NAME,
        loadPlan, savePlan, setPace, advance,
        readingFor, totalVerses,
    } from "$lib/reading/plan";
    import type { ReminderTheme } from "$lib/reminder/themes";
    import {
        dayKey, loadLog, saveLog, loadSettings, saveSettings, setPrayerGoal,
        addVerses, progressFor, ring, CONNECT_GOAL, type DayLog,
    } from "$lib/day/progress";
    import { loadPool, savePool, doneOn, add, remove, toggle as toggleItem } from "$lib/todo/pool";

    import Seal from "$lib/day/Seal.svelte";
    import PrayCard from "$lib/day/PrayCard.svelte";
    import TodoList from "$lib/todo/List.svelte";
    import ReadingPlan from "$lib/reading/Plan.svelte";
    import Invocation from "$lib/reminder/Invocation.svelte";
    import Feelings from "$lib/feelings/Feelings.svelte";
    import SettingsPage from "$lib/settings/Settings.svelte";
    import Marks from "$lib/shell/Marks.svelte";

    type Tab = "day" | "book" | "settings";
    const TABS: { id: Tab; label: string }[] = [
        { id: "day", label: "[the day]" },
        { id: "book", label: "[the book]" },
        { id: "settings", label: "[settings]" },
    ];

    let tab = $state<Tab>("day");
    let feelings = $state(false);

    // honor "reduce motion"
    const reduceMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
    const fadeMs = $derived(reduceMotion.current ? 0 : 150);

    let log = $state(loadLog());
    let settings = $state(loadSettings());
    let pool = $state(loadPool());
    // read once at load and refresh before every write
    // TODO?: technically what's already drawn still goes stale at
    // midnight until something is clicked
    let today = $state(dayKey());

    function refreshToday() {
        today = dayKey();
    }

    // this one records verses, Jesus records prayer. Applying a change to
    // the copy loaded at startup would drop whatever the other window wrote
    function mutateLog(change: (current: DayLog) => DayLog) {
        log = change(loadLog());
        saveLog(log);
    }

    // Jesus finished and wrote to the log
    $effect(() => {
        let disposed = false;
        let unlisten: (() => void) | undefined;

        listen("prayed", () => {
            log = loadLog();
        }).then((fn) => {
            if (disposed) { fn(); return; }
            unlisten = fn;
        }).catch(console.warn);

        return () => {
            disposed = true;
            unlisten?.();
        };
    });

    // --- reading plan ---
    let plan = $state(loadPlan());
    let lengths = $state<ChapterLength[] | null>(null);
    let planError = $state(false);

    // the book is fetched once, getChapterLengths caches it
    $effect(() => {
        let disposed = false;
        getChapterLengths(PLAN_BOOK)
            .then((l) => { if (!disposed) lengths = l; })
            .catch(() => { if (!disposed) planError = true; });
        return () => { disposed = true; };
    });

    const total = $derived(lengths ? totalVerses(lengths) : 0);
    const reading = $derived(lengths ? readingFor(lengths, plan.versesRead, plan.pace) : null);

    // plan.pace is the Bible goal, the day log holds what each day held
    const progress = $derived(progressFor(log, today));
    const measures = $derived([
        { name: "Bible", tint: "var(--green)", ring: ring(progress.verses, plan.pace) },
        { name: "Pray", tint: "var(--maroon)", ring: ring(progress.seconds, settings.prayerMinutes * 60) },
        { name: "Connect", tint: "var(--mustard)", ring: ring(doneOn(pool, today), CONNECT_GOAL) },
    ]);

    const allDone = $derived(measures.every((m) => m.ring.complete));

    function addTodo(text: string) {
        pool = add(pool, text);
        savePool(pool);
    }

    function toggleTodo(id: string) {
        refreshToday();
        pool = toggleItem(pool, id, today);
        savePool(pool);
    }

    function removeTodo(id: string) {
        pool = remove(pool, id);
        savePool(pool);
    }

    function pace(delta: number) {
        plan = setPace(plan, delta);
        savePlan(plan);
    }
    
    function setVersesToday(next: number) {
        refreshToday();
        if (!Number.isFinite(next) || !total) return;

        const current = progressFor(loadLog(), today).verses;
        const room = total - plan.versesRead;
        const delta = Math.max(0, Math.min(next, current + room)) - current;
        if (!delta) return;

        mutateLog((log) => addVerses(log, today, delta));
        plan = advance(plan, delta, total);
        savePlan(plan);
    }

    function openBible() {
        if (reading) openUrl(`https://www.bible.com/bible/${VERSION_ID}/${reading.startUsfm}`).catch(console.warn);
    }

    function beginPrayer() {
        emit("pray").catch(console.warn);
    }

    function prayerGoal(delta: number) {
        settings = setPrayerGoal(settings, delta);
        saveSettings(settings);
    }

    function remind(theme: ReminderTheme) {
        emit("reminder", theme).catch(console.warn);
    }
</script>

<div class="app">
  {#if feelings}
    <div class="screen" in:fade={{ duration: fadeMs }}>
      <header class="masthead bar green">
        <button class="back" onclick={() => (feelings = false)} aria-label="Back to home">←</button>
        <span class="bar-title">Feelings to Verses</span>
      </header>

      <div class="body">
        <Feelings />
      </div>
    </div>

  {:else}
    <div class="screen">
      <header class="masthead walnut">
        <h1>Welcome back!</h1>

        <Marks tabs={TABS} current={tab} onSelect={(id) => (tab = id)} />
      </header>

      {#if tab === "day"}
        <div class="body ledger" in:fade={{ duration: fadeMs }}>
          <section class="section">
            <span class="eyebrow"><span class="numeral">I</span> · Three actions</span>

            <div class="day">
              <Seal {measures} label="[today's three measures]" />
            </div>

            {#if allDone}
              <p class="action-caption">All done! Great work :)</p>
            {/if}
          </section>

          <section class="section">
            <span class="eyebrow">
              <span class="numeral">II</span> · Reading plan · {PLAN_BOOK_NAME}
            </span>

            <ReadingPlan
              {plan}
              {reading}
              {total}
              loaded={lengths !== null}
              error={planError}
              versesToday={progress.verses}
              onVerses={setVersesToday}
              onOpen={openBible}
            />
          </section>

          <section class="section">
            <span class="eyebrow"><span class="numeral">III</span> · [time with Him]</span>

            <PrayCard ring={measures[1].ring} onBegin={beginPrayer} />
          </section>

          <section class="section">
            <span class="eyebrow"><span class="numeral">IV</span> · [for the Lord]</span>

            <TodoList
              {pool}
              {today}
              onAdd={addTodo}
              onToggle={toggleTodo}
              onRemove={removeTodo}
            />
          </section>
        </div>

      {:else if tab === "book"}
        <div class="body ledger" in:fade={{ duration: fadeMs }}>
          <section class="section">
            <span class="eyebrow">Open the book</span>

            <Invocation onRemind={remind} onFeelings={() => (feelings = true)} />
          </section>
        </div>

      {:else if tab === "settings"}
        <div class="body ledger" in:fade={{ duration: fadeMs }}>
          <section class="section">
            <span class="eyebrow">[settings]</span>

            <SettingsPage {settings} {plan} onPrayerGoal={prayerGoal} onPace={pace} />
          </section>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
    /* everything under masthead scrolls*/
    .app { height: 100vh; overflow: hidden; }
    .screen { height: 100%; display: flex; flex-direction: column; }

    .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        scrollbar-width: thin;
        scrollbar-color: rgba(var(--gold), 0.45) transparent;
    }
    /* .body is a flex column so margin: auto can push content to the foot */
    .body > * { flex-shrink: 0; }

    /* one band per view masthead */
    .masthead { flex: none; color: var(--cream); }
    /* no bottom padding — the marks sit on the band's edge */
    .walnut { background: var(--walnut); padding: 24px var(--pad) 0; }
    .green { background: var(--green); }

    h1 {
        margin: 0;
        font: 300 30px/1 var(--display);
        letter-spacing: 0.01em;
    }
    .bar {
        padding: 22px var(--pad);
        display: flex;
        align-items: center;
        gap: 14px;
    }
    .bar-title { font: 400 25px/1 var(--display); }
    .back {
        flex: none;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: transparent;
        border: 1px solid rgba(241, 231, 210, 0.45);
        color: var(--cream);
        font: 400 14px/1 var(--body);
        cursor: pointer;
        transition: background-color var(--tick) ease;
    }
    .back:hover { background: rgba(241, 231, 210, 0.14); }

    /* the ledger */
    .ledger { position: relative; }
    .ledger::before {
        content: "";
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: var(--margin);
        border-right: 1px solid rgba(var(--gold), 0.45);
        pointer-events: none;
    }

    .section {
        padding: 16px var(--pad) 20px calc(var(--margin) + 18px);
        border-top: 1px solid var(--hair);
    }
    .section:first-child { border-top: none; padding-top: 18px; }

    .section > :global(.eyebrow + *) { margin-top: var(--head-gap); }

    /* --- the three actions --- */

    .action-caption {
        margin: 12px 0 0;
        font: italic 400 12px/1.5 var(--body);
        color: rgba(var(--ink), 0.55);
        text-wrap: pretty;
    }

</style>
