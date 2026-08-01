<script lang="ts">
    import "$lib/styles/companion.css";
    import { fade } from "svelte/transition";
    import { MediaQuery } from "svelte/reactivity";
    import { emit, listen } from "@tauri-apps/api/event";
    import { openUrl } from "@tauri-apps/plugin-opener";
    import {
        getChapterLengths, getBooks, VERSION_ID,
        type ChapterLength, type Book,
    } from "$lib/youversion/api";
    import {
        loadPlan, savePlan, setPace, advance, versesRead, selectBook, addToPlans,
        readingFor, totalVerses,
    } from "$lib/reading/plan";
    import type { ReminderTheme } from "$lib/reminder/themes";
    import {
<<<<<<< HEAD
        dayKey, loadLog, saveLog,
        addVerses, progressFor, ring, CONNECT_GOAL, type DayLog,
=======
        dayKey, loadLog, saveLog, loadSettings, saveSettings, setPrayerGoal, setTradition,
        addVerses, progressFor, ring, CONNECT_GOAL, type DayLog, type Tradition,
>>>>>>> b90a09e8e3c1287187510faf39de38285d904764
    } from "$lib/day/progress";
    import {
        loadSettings, saveSettings, setPrayerGoal, setTradition, type Tradition,
    } from "$lib/settings/settings";
    import { loadPool, savePool, doneOn, add, remove, toggle as toggleItem } from "$lib/todo/pool";
    import { loadShelf, saveShelf, drop, annotate } from "$lib/shelf/shelf";

    import Seal from "$lib/day/Seal.svelte";
    import PrayCard from "$lib/day/PrayCard.svelte";
    import TodoList from "$lib/todo/List.svelte";
    import ReadingPlan from "$lib/reading/Plan.svelte";
    import Plans from "$lib/reading/Plans.svelte";
    import Invocation from "$lib/reminder/Invocation.svelte";
    import Feelings from "$lib/feelings/Feelings.svelte";
    import SettingsPage from "$lib/settings/Settings.svelte";
    import Shelf from "$lib/shelf/Shelf.svelte";
    import Discover from "$lib/discover/Discover.svelte";
<<<<<<< HEAD
    import Topics from "$lib/topics/Topics.svelte";
=======
>>>>>>> b90a09e8e3c1287187510faf39de38285d904764
    import Marks from "$lib/shell/Marks.svelte";

    type Tab = "day" | "book" | "settings";
    const TABS: { id: Tab; label: string }[] = [
        { id: "day", label: "the day" },
        { id: "book", label: "Find Verses" },
        { id: "settings", label: "settings" },
    ];

    let tab = $state<Tab>("day");
    let feelings = $state(false);

    const reduceMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
    const fadeMs = $derived(reduceMotion.current ? 0 : 150);

    let log = $state(loadLog());
    let settings = $state(loadSettings());
    let pool = $state(loadPool());
    // read once at load and refreshed before every write
    // what is already drawn still goes stale at midnight until something is clicked
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

    // the sitting runs in His window so this is the only record here that one is open
    let sitting = $state(false);

    // Jesus finished and wrote to the log
    $effect(() => {
        let disposed = false;
        let unlisten: (() => void) | undefined;

        listen("prayed", () => {
            log = loadLog();
            sitting = false;
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

    let books = $state<Book[]>([]);
    $effect(() => {
        let disposed = false;
        getBooks()
            .then((b) => { if (!disposed) books = b; })
            .catch(console.warn);
        return () => { disposed = true; };
    });

    $effect(() => {
        const book = plan.book;
        let disposed = false;
        lengths = null;
        planError = false;
        getChapterLengths(book)
            .then((l) => { if (!disposed) lengths = l; })
            .catch(() => { if (!disposed) planError = true; });
        return () => { disposed = true; };
    });

    // falls back to the USFM
    const bookName = $derived(books.find((b) => b.usfm === plan.book)?.name ?? plan.book);

    const total = $derived(lengths ? totalVerses(lengths) : 0);
    const reading = $derived(
        lengths ? readingFor(plan.book, lengths, versesRead(plan), plan.pace) : null,
    );

    // plan.pace is the Bible goal, the day log holds what each day held
    const progress = $derived(progressFor(log, today));
    // hoisted so the card and the seal cannot drift onto different measures
    const prayRing = $derived(ring(progress.seconds, settings.prayerMinutes * 60));
    const measures = $derived([
        { name: "Bible", tint: "var(--green)", ring: ring(progress.verses, plan.pace) },
        { name: "Pray", tint: "var(--maroon)", ring: prayRing },
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

    let shelf = $state(loadShelf());

    // Jesus kept a passage from a reminder bubble. same shape as "prayed" —
    // the payload would only duplicate something we can read off disk
    $effect(() => {
        let disposed = false;
        let unlisten: (() => void) | undefined;

        listen("kept", () => {
            shelf = loadShelf();
        }).then((fn) => {
            if (disposed) { fn(); return; }
            unlisten = fn;
        }).catch(console.warn);

        return () => {
            disposed = true;
            unlisten?.();
        };
    });

    function leaveFeelings() {
        feelings = false;
        shelf = loadShelf();
    }

    function dropKept(usfm: string) {
        shelf = drop(loadShelf(), usfm);
        saveShelf(shelf);
    }

<<<<<<< HEAD
    // re-reads first, this shelf has more than one writer
=======
    // re-reads first, same as every other shelf write — feelings shares this key
>>>>>>> b90a09e8e3c1287187510faf39de38285d904764
    function annotateKept(usfm: string, note: string) {
        shelf = annotate(loadShelf(), usfm, note);
        saveShelf(shelf);
    }

    // each book keeps its own bookmark, so this is never destructive
    function chooseBook(usfm: string) {
        plan = selectBook(plan, usfm);
        savePlan(plan);
    }

    // a recommendation joins the list without moving you off what you are reading
    function addBook(usfm: string) {
        plan = addToPlans(plan, usfm);
        savePlan(plan);
    }
    
    function setVersesToday(next: number) {
        refreshToday();
        if (!Number.isFinite(next) || !total) return;

        const current = progressFor(loadLog(), today).verses;
        const room = total - versesRead(plan);   // what is left of the active book
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
        sitting = true;
        emit("pray").catch(console.warn);
    }

    function endPrayer() {
        emit("amen").catch(console.warn);
    }

    function prayerGoal(delta: number) {
        settings = setPrayerGoal(settings, delta);
        saveSettings(settings);
    }

    function tradition(next: Tradition) {
        settings = setTradition(settings, next);
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
        <button class="back" onclick={leaveFeelings} aria-label="Back to home">←</button>
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
              <Seal {measures} label="today's three measures" />
            </div>

            {#if allDone}
              <p class="action-caption">All done! Great work :)</p>
            {/if}
          </section>

          <section class="section">
            <span class="eyebrow">
              <span class="numeral">II</span> · Reading plan · {bookName}
            </span>

            <ReadingPlan
              {plan}
              {bookName}
              {reading}
              {total}
              loaded={lengths !== null}
              error={planError}
              versesToday={progress.verses}
              onVerses={setVersesToday}
              onOpen={openBible}
            />

            <!-- lives in II because it switches the book II is about -->
            <Plans {plan} {books} onSelect={chooseBook} />
          </section>

          <section class="section">
            <span class="eyebrow"><span class="numeral">III</span> · time with Him</span>

            <PrayCard ring={prayRing} {sitting} onBegin={beginPrayer} onEnd={endPrayer} />
          </section>

          <section class="section">
            <span class="eyebrow"><span class="numeral">IV</span> · Outreach</span>

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
            <span class="eyebrow">Lighting the Lamp</span>

            <Invocation onRemind={remind} onFeelings={() => (feelings = true)} />
          </section>

          <section class="section">
<<<<<<< HEAD
            <span class="eyebrow">Read About</span>

            <Topics {plan} {books} onAdd={addBook} />
          </section>

          <section class="section">
            <span class="eyebrow">go looking</span>

=======
            <span class="eyebrow">go looking</span>

>>>>>>> b90a09e8e3c1287187510faf39de38285d904764
            <Discover {books} book={plan.book} {reading} />
          </section>

          <section class="section">
            <span class="eyebrow">what you've kept</span>

            <Shelf {shelf} onDrop={dropKept} onAnnotate={annotateKept} />
          </section>
        </div>

      {:else if tab === "settings"}
        <div class="body ledger" in:fade={{ duration: fadeMs }}>
          <section class="section">
            <span class="eyebrow">settings</span>

            <SettingsPage
              {settings}
              {plan}
              {books}
              onPrayerGoal={prayerGoal}
              onPace={pace}
              onBook={chooseBook}
              onTradition={tradition}
            />
          </section>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
    /* everything under the masthead scrolls */
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

    /* one masthead band per view */
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

    /* the rule sits above the heading, where a full line across is a boundary you can
       find without reading it
       --rule rather than --hair because this one is carrying that job */
    .section {
        padding: 16px var(--pad) 20px calc(var(--margin) + 18px);
        border-top: 1px solid var(--rule);
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
