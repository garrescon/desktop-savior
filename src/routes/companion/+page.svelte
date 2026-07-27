<script lang="ts">
    import { fade } from "svelte/transition";
    import { MediaQuery } from "svelte/reactivity";
    import { emit } from "@tauri-apps/api/event";
    import { invoke } from "@tauri-apps/api/core";
    import { openUrl } from "@tauri-apps/plugin-opener";
    import { getPassage, getChapterLengths, VERSION_ID, type Passage, type ChapterLength } from "$lib/youversion/api";
    import {
        PLAN_BOOK, PLAN_BOOK_NAME,
        loadPlan, savePlan, setPace, markRead, undoRead,
        readingFor, totalVerses, finishedBy,
    } from "$lib/reading/plan";
    import { REMINDERS, type ReminderTheme } from "$lib/reminder/themes";
    import { HABITS, dayKey, loadLog, saveLog, toggle as toggleLog, type HabitName } from "$lib/habits/habits";

    // keep in sync with Guidance struct in src-tauri/src/gloo.rs
    interface Guidance { references: string[]; note: string; }

    const FEELINGS = [
        "Peaceful", "Accomplished", "Loved", 
        "Unforgiving", "Lonely", "Unmotivated",
    ];

    // TODO: PLACEHOLDER
    const NAME = "Garrett";

    const themes = Object.entries(REMINDERS) as [ReminderTheme, typeof REMINDERS[ReminderTheme]][];

    // in-page nav
    type View = "home" | "feelings";
    let view = $state<View>("home");

    // honor "reduce motion"
    const reduceMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
    const fadeMs = $derived(reduceMotion.current ? 0 : 150);

    let log = $state(loadLog());
    // read once at load and refresh before every write
    // TODO?: technically what's already drawn still goes stale at
    // midnight until something is clicked
    let today = $state(dayKey());

    function refreshToday() {
        today = dayKey();
    }

    const doneToday = $derived(HABITS.filter((h) => log[h].includes(today)).length);
    const habitLine = $derived(
        doneToday === HABITS.length
            ? "All done! Great work :)"
            : "What a beautiful day the Lord has made!",
    );

    function toggleHabit(name: HabitName) {
        refreshToday();
        log = toggleLog(log, name, today);
        saveLog(log);
    }

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
    const readToday = $derived(plan.lastRead?.day === today);
    const percent = $derived(total ? Math.min(100, (plan.versesRead / total) * 100) : 0);
    const finish = $derived(
        finishedBy(total - plan.versesRead, plan.pace)
            .toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    );

    function pace(delta: number) {
        plan = setPace(plan, delta);
        savePlan(plan);
    }

    function toggleRead() {
        refreshToday();
        if (readToday) plan = undoRead(plan);
        // count comes from reading and not the pace so versesRead
        // doesn't go past the book's end
        else if (reading) plan = markRead(plan, today, reading.count);
        else return;
        savePlan(plan);
    }

    function openBible() {
        if (reading) openUrl(`https://www.bible.com/bible/${VERSION_ID}/${reading.startUsfm}`).catch(console.warn);
    }

    let selected = $state<string[]>([]);
    let note = $state<string | null>(null);
    let passages = $state<Passage[]>([]);
    let shownIndex = $state(0);
    let asking = $state(false);
    let askError = $state<string | null>(null);

    // one passage reads as the answer; the rest wait on the shelf below it
    const shown = $derived(passages[shownIndex] ?? null);
    const shelf = $derived(
        passages.map((p, i) => ({ p, i })).filter(({ i }) => i !== shownIndex),
    );

    const prompt = $derived(
        selected.length
            ? "Pick as many as you'd like."
            : "How do you feel?",
    );

    // word cycling in "Remind me of His ..."
    let wordIndex = $state(0);
    let wordFading = $state(false);
    let menuOpen = $state(false);

    const CYCLE_MS = 2600, FADE_MS = 240;
    const cycleWord = $derived(themes[wordIndex % themes.length][1].label);

    $effect(() => {
        if (view !== "home" || menuOpen || reduceMotion.current || themes.length < 2) return;

        let swap: ReturnType<typeof setTimeout>;
        const tick = setInterval(() => {
            wordFading = true;
            swap = setTimeout(() => {
                wordIndex += 1;
                wordFading = false;
            }, FADE_MS);
        }, CYCLE_MS);

        return () => {
            clearInterval(tick);
            clearTimeout(swap);
            wordFading = false;   // prevents word-stranding mid-fade
        };
    });

    function toggleFeeling(feeling: string) {
        selected = selected.includes(feeling)
            ? selected.filter((f) => f !== feeling)
            : [...selected, feeling];
    }

    // one line per row
    // end on the first punctuation if it's far enough
    function snippet(text: string): string {
        const cut = text.search(/[,;:.]/);
        const head = cut > 24 ? text.slice(0, cut) : text;
        return head.length > 44 ? `${head.slice(0, 44).trimEnd()}…` : head;
    }

    async function ask() {
        asking = true;
        askError = null;
        note = null;
        passages = [];
        shownIndex = 0;
        try {
            const guidance = await invoke<Guidance>("ask_gloo", { feelings: selected });
            passages = await Promise.all(guidance.references.map(getPassage));
            note = guidance.note;
        } catch (err) {
            askError = err instanceof Error ? err.message : String(err);
        } finally {
            asking = false;
        }
    }

    // hand the reminder word to Jesus
    function remind(theme: ReminderTheme) {
        emit("reminder", theme).catch(console.warn);
        menuOpen = false;
    }

    function goHome() {
        // leaving the view clears the last answer so a return visit starts fresh
        view = "home";
        selected = [];
        note = null;
        passages = [];
        shownIndex = 0;
        askError = null;
    }
</script>

<div class="app">
  {#if view === "home"}
    <div class="screen" in:fade={{ duration: fadeMs }}>
      <header class="masthead walnut">
        <h1>
          <span class="salutation">Welcome back,</span>
          <span class="name">{NAME}</span>
        </h1>
        <p class="subtitle">Sit down a minute. There's nothing here to keep up with.</p>
      </header>

      <div class="body ledger">
        <section class="section">
          <span class="eyebrow"><span class="numeral">I</span> · Three actions</span>

          <div class="actions">
            {#each HABITS as name}
              {@const done = log[name].includes(today)}
              <button
                class="action"
                class:done
                data-habit={name}
                aria-pressed={done}
                onclick={() => toggleHabit(name)}
              >
                <span class="action-name">{name}</span>
                <span class="action-box">{done ? "✓" : ""}</span>
              </button>
            {/each}
          </div>

          <p class="action-caption">{habitLine}</p>
        </section>

        <section class="section">
          <span class="eyebrow">
            <span class="numeral">II</span> · Reading plan · {PLAN_BOOK_NAME}
          </span>

          {#if reading}
            <div class="plan">
              <div class="plan-today">
                <div>
                  <div class="plan-label">Start here today</div>
                  <div class="plan-ref">{PLAN_BOOK_NAME} {reading.label}</div>
                </div>
                <button class="plan-open" onclick={openBible}>Open Bible →</button>
              </div>

              <div class="plan-progress">
                <div class="plan-meter">
                  <div class="meter"><div class="meter-fill" style="width: {percent}%"></div></div>
                  <div class="plan-count">
                    {plan.versesRead} of {total} verses · finished by {finish}
                  </div>
                </div>

                <div class="stepper">
                  <button onclick={() => pace(-1)} aria-label="Fewer verses a day">–</button>
                  <span>{plan.pace} a day</span>
                  <button onclick={() => pace(1)} aria-label="More verses a day">+</button>
                </div>
              </div>

              <button class="plan-done" class:done={readToday} onclick={toggleRead}>
                {readToday ? "Undo today's reading" : "Mark today's reading done"}
              </button>
            </div>
          {:else if planError}
            <p class="plan-status">Couldn't load the reading plan, try again later.</p>
          {:else if lengths}
            <div class="plan">
              <p class="plan-finished">
                {PLAN_BOOK_NAME} is finished!
              </p>
              <!-- finishing on a misclick would otherwise be unrecoverable -->
              {#if readToday}
                <button class="plan-done done" onclick={toggleRead}>Undo today's reading</button>
              {/if}
            </div>
          {:else}
            <p class="plan-status">Opening {PLAN_BOOK_NAME}…</p>
          {/if}
        </section>

        <section class="section">
          <span class="eyebrow"><span class="numeral">III</span> · Open the book</span>

          <div class="plate">
            <div class="plate-frame">
              <p class="invocation">
                <span>Remind me of His ...</span>
                <span class="word-slot"
                  ><button
                    class="word"
                    class:fading={wordFading}
                    onclick={() => (menuOpen = !menuOpen)}
                    aria-expanded={menuOpen}
                  >{cycleWord}</button><span class="caret" aria-hidden="true">▾</span></span>
              </p>

              {#if menuOpen}
                <div class="word-menu">
                  <div class="word-menu-label">Every theme</div>
                  <div class="word-grid">
                    {#each themes as [theme, def]}
                      <button class="word-option" onclick={() => remind(theme)}>
                        <span>{def.label}</span>
                        <span class="word-count">{def.refs.length}</span>
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}

              <button class="feel-link" onclick={() => (view = "feelings")}>
                Or name how you feel >
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>

  {:else if view === "feelings"}
    <div class="screen" in:fade={{ duration: fadeMs }}>
      <header class="masthead bar green">
        <button class="back" onclick={goHome} aria-label="Back to home">←</button>
        <span class="bar-title">Feelings to Verses</span>
      </header>

      <div class="body">
        <div class="gutter">
          <p class="lede">{prompt}</p>

          <div class="pill-wrap">
            {#each FEELINGS as feeling}
              <button
                class="pill feeling"
                class:selected={selected.includes(feeling)}
                aria-pressed={selected.includes(feeling)}
                onclick={() => toggleFeeling(feeling)}
                disabled={asking}
              >{feeling}</button>
            {/each}
          </div>

          <button class="ask" onclick={ask} disabled={asking || selected.length === 0}>
            {selected.length ? "Ask" : "Pick a word first"}
          </button>
        </div>

        {#if note}
          <p class="note">{note}</p>
        {/if}

        {#if shown}
          <blockquote class="verse-plate">
            <span class="verse-mark" aria-hidden="true">“</span>
            <div class="verse-frame">
              <p class="verse-text">{shown.text}</p>
              <div class="verse-ref">
                <span class="verse-rule" aria-hidden="true"></span>
                <cite>{shown.reference}</cite>
              </div>
              <p class="verse-credit">{shown.versionTitle} · {shown.copyright}</p>
            </div>
          </blockquote>

          {#if shelf.length}
            <div class="gutter shelf">
              <div class="rule-head">
                <span class="eyebrow">Also on the shelf tonight</span>
                <span class="rule" aria-hidden="true"></span>
              </div>
              {#each shelf as { p, i }}
                <button class="shelf-row" onclick={() => (shownIndex = i)}>
                  <span class="shelf-snippet">{snippet(p.text)}</span>
                  <span class="shelf-ref">{p.reference}</span>
                </button>
              {/each}
            </div>
          {/if}

        {:else if asking}
          <p class="placeholder">Finding verses…</p>
        {:else if askError}
          <p class="placeholder error">Couldn't reach the library, try again later.</p>
        {:else}
          <p class="placeholder">Choose a word or two above, then ask.</p>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
    :global(:root) {
        /* -- PALLETE --
           walnut = fill, glyphs, body text;
           mustard = rules and the small things;
           maroon = live things;
           green = Feelings to Verses */
        --paper: #ece1c9;      /* the window itself                       */
        --surface: #fbf7ec;    /* plates and pills sit on this            */
        --walnut: #4e3629;
        --cream: #f1e7d2;      /* type on walnut/green                    */
        --mustard: #8c6b2f;
        --maroon: #800000;
        --green: #384e36;

        /* the same three colours as rgb, so tins can be mixed */
        --ink: 78, 54, 41;     /* walnut  */
        --gold: 140, 107, 47;  /* mustard */
        --red: 128, 0, 0;      /* maroon  */

        --display: "Cormorant Garamond", Georgia, serif;
        --body: Lora, Georgia, "Times New Roman", serif;

        /* the ledger margin */
        --margin: 58px;
        --pad: 26px;
    }

    :global(body) {
        margin: 0;
        background: var(--paper);
        color: var(--walnut);
        font-family: var(--body);
    }

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

    .gutter { padding: 0 var(--pad); }

    /* one band per view masthead */
    .masthead { flex: none; color: var(--cream); }
    .walnut { background: var(--walnut); padding: 24px var(--pad) 20px; }
    .green { background: var(--green); }

    h1 {
        margin: 0;
        font: 300 42px/1 var(--display);
        letter-spacing: -0.015em;
    }
    .salutation {
        display: block;
        font-size: 23px;
        letter-spacing: 0.02em;
        opacity: 0.8;
    }
    .name {
        display: block;
        margin-top: 3px;
        font-size: 44px;
        font-style: italic;
    }
    .subtitle {
        margin: 11px 0 0;
        font: italic 400 13px/1.6 var(--body);
        opacity: 0.82;
        text-wrap: pretty;
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
        transition: background-color 140ms ease;
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
        border-top: 1px solid rgba(var(--ink), 0.13);
    }
    .section:first-child { border-top: none; padding-top: 18px; }

    /* the small caps label that names each section */
    .eyebrow {
        font: 400 10px/1 var(--body);
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--mustard);
    }
    .numeral { font-variant-numeric: tabular-nums; }

    /* --- the three actions --- */
    .actions {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 11px;
        margin-top: 12px;
    }

    /* name and box are one control */
    .action {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 11px 0 0;
        background: transparent;
        border: none;
        border-top: 2px solid var(--rule);
        cursor: pointer;
        font: inherit;
        color: inherit;
    }
    /* action boxes */
    .action[data-habit="Bible"] { --rule: var(--green); }
    .action[data-habit="Pray"] { --rule: var(--maroon); }
    .action[data-habit="Connect"] { --rule: var(--mustard); }

    .action-name {
        padding-bottom: 2px;
        font: 400 9.5px/1 var(--body);
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: rgba(var(--ink), 0.6);
        border-bottom: 1px dotted rgba(var(--ink), 0.3);
        transition: color 140ms ease, border-color 140ms ease;
    }
    .action:hover .action-name { color: var(--maroon); border-color: var(--maroon); }

    .action-box {
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        font: 400 16px/1 var(--body);
        background: var(--surface);
        border: 1px solid rgba(var(--ink), 0.3);
        color: var(--walnut);
        transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
    }
    /* walnut fill */
    .action.done .action-box {
        background: var(--walnut);
        border-color: var(--walnut);
        color: var(--cream);
    }

    .action-caption {
        margin: 12px 0 0;
        font: italic 400 12px/1.5 var(--body);
        color: rgba(var(--ink), 0.55);
        text-wrap: pretty;
    }

    /* -- the reading plan -- */
    .plan {
        margin-top: 9px;
        border-top: 2px solid rgba(var(--gold), 0.55);
        padding-top: 11px;
    }

    .plan-today {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 12px;
    }
    .plan-label {
        font: 400 9.5px/1 var(--body);
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: rgba(var(--ink), 0.45);
    }

    .plan-ref {
        margin-top: 7px;
        font: 400 28px/1 var(--display);
        font-variant-numeric: tabular-nums;
        color: var(--walnut);
    }
    .plan-open {
        flex: none;
        white-space: nowrap;
        padding: 10px 13px;
        background: transparent;
        color: var(--maroon);
        border: 1px solid var(--maroon);
        font: 400 10px/1 var(--body);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background-color 140ms ease;
    }
    .plan-open:hover { background: rgba(var(--red), 0.07); }

    .plan-progress {
        display: flex;
        align-items: flex-end;
        gap: 12px;
        margin-top: 12px;
    }
    .plan-meter { flex: 1; min-width: 0; }
    .meter { height: 3px; background: rgba(var(--ink), 0.13); position: relative; }
    .meter-fill {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        background: var(--mustard);
        transition: width 200ms ease;
    }
    .plan-count {
        margin-top: 7px;
        font: 400 10px/1.3 var(--body);
        color: rgba(var(--ink), 0.5);
        font-variant-numeric: tabular-nums;
    }

    /* hairline box split by dividers */
    .stepper {
        flex: none;
        display: flex;
        align-items: stretch;
        border: 1px solid rgba(var(--ink), 0.25);
    }
    .stepper button {
        width: 25px;
        background: transparent;
        border: none;
        cursor: pointer;
        font: 400 14px/1 var(--body);
        color: var(--walnut);
        transition: background-color 140ms ease;
    }
    .stepper button:first-child { border-right: 1px solid rgba(var(--ink), 0.2); }
    .stepper button:last-child { border-left: 1px solid rgba(var(--ink), 0.2); }
    .stepper button:hover { background: rgba(var(--gold), 0.1); }
    .stepper span {
        padding: 8px 9px;
        white-space: nowrap;
        font: 400 10.5px/1 var(--body);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--walnut);
        font-variant-numeric: tabular-nums;
    }

    /* dotted underline like .feel-link */
    .plan-done {
        display: block;
        margin-top: 12px;
        padding: 0 0 2px;
        text-align: left;
        background: transparent;
        border: none;
        border-bottom: 1px dotted rgba(var(--ink), 0.32);
        cursor: pointer;
        font: 400 10px/1 var(--body);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(var(--ink), 0.5);
        transition: color 140ms ease, border-color 140ms ease;
    }
    .plan-done:hover { color: var(--maroon); border-color: var(--maroon); }
    .plan-done.done { color: var(--green); border-color: rgba(56, 78, 54, 0.5); }

    .plan-status, .plan-finished {
        margin: 9px 0 0;
        font: italic 400 12px/1.5 var(--body);
        color: rgba(var(--ink), 0.5);
    }
    .plan-finished { margin: 0; }

    /* -- the plate -- */
    .plate {
        margin-top: 9px;
        padding: 6px;
        background: var(--surface);
        border: 1px solid rgba(var(--gold), 0.55);
    }
    .plate-frame {
        border: 1px solid rgba(var(--gold), 0.35);
        padding: 18px 18px 17px;
    }

    /* "Remind me of His ..." */
    .invocation {
        margin: 0;
        font: 400 27px/1.25 var(--display);
        color: var(--walnut);
    }
    .word-slot { position: relative; display: inline-block; }
    /* word button */
    .word {
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
        font: italic 400 27px/1.25 var(--display);
        color: var(--maroon);
        border-bottom: 1px dashed rgba(var(--red), 0.5);
        opacity: 1;
        transition: opacity 220ms ease;
    }
    .word:hover { border-bottom-style: solid; }

    .word.fading { opacity: 0.18; }
    .caret {
        margin-left: 5px;
        font: 400 12px/1 var(--body);
        color: rgba(var(--red), 0.55);
    }

    .word-menu {
        margin-top: 14px;
        border-top: 1px solid rgba(var(--gold), 0.45);
        padding-top: 12px;
    }
    .word-menu-label {
        margin-bottom: 10px;
        font: 400 9.5px/1 var(--body);
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--mustard);
    }
    .word-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 14px; }
    .word-option {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        text-align: left;
        background: transparent;
        border: none;
        border-bottom: 1px solid rgba(var(--ink), 0.1);
        padding: 6px 0;
        cursor: pointer;
        font: 400 17px/1.15 var(--display);
        color: var(--walnut);
        transition: color 140ms ease;
    }
    .word-option:hover { color: var(--maroon); }
    .word-count {
        font: 400 9.5px/1 var(--body);
        color: rgba(var(--ink), 0.35);
        font-variant-numeric: tabular-nums;
    }

    /* the second way out of the plate */
    .feel-link {
        display: block;
        margin-top: 15px;
        padding: 0 0 2px;
        text-align: left;
        background: transparent;
        border: none;
        border-bottom: 1px dotted rgba(var(--ink), 0.32);
        cursor: pointer;
        font: italic 400 13px/1.5 var(--body);
        color: rgba(var(--ink), 0.62);
        transition: color 140ms ease, border-color 140ms ease;
    }
    .feel-link:hover { color: var(--maroon); border-color: var(--maroon); }

    /* feeling button */
    .pill {
        flex: none;
        font: 400 16px/1 var(--display);
        color: var(--walnut);
        background: var(--surface);
        border: 1px solid rgba(var(--gold), 0.55);
        border-radius: 999px;
        padding: 8px 14px 9px;
        cursor: pointer;
        white-space: nowrap;
        transition: color 140ms ease, border-color 140ms ease, background-color 140ms ease;
    }
    .pill:hover:not(:disabled) {
        color: var(--maroon);
        border-color: var(--maroon);
        background: #fffdf6;
    }

    .pill-wrap { display: flex; flex-wrap: wrap; gap: 7px; }
    .feeling {
        padding: 10px 15px 11px;
        border-color: rgba(var(--ink), 0.22);
    }
    /* mustard button fill */
    .feeling.selected,
    .feeling.selected:hover {
        background: var(--mustard);
        border-color: var(--mustard);
        color: var(--surface);
    }
    .feeling:disabled { opacity: 0.5; cursor: default; }

    /* the full-width action */
    .ask {
        width: 100%;
        margin-top: 16px;
        padding: 13px;
        background: transparent;
        color: var(--walnut);
        border: 1px solid var(--walnut);
        font: 400 12px/1 var(--body);
        letter-spacing: 0.22em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background-color 140ms ease;
    }
    .ask:hover:not(:disabled) { background: rgba(var(--ink), 0.08); }
    .ask:disabled {
        color: rgba(var(--ink), 0.4);
        border-color: rgba(var(--ink), 0.25);
        cursor: default;
    }

    /* -- running copy -- */
    .lede {
        margin: 22px 0 14px;
        font: italic 400 13.5px/1.6 var(--body);
        color: rgba(var(--ink), 0.7);
        text-wrap: pretty;
    }
    /* gloo's note */
    .note {
        margin: 20px var(--pad) 0;
        font: italic 400 13.5px/1.6 var(--body);
        color: rgba(var(--ink), 0.68);
        text-wrap: pretty;
    }
    .placeholder {
        margin: auto var(--pad);
        padding: 40px 14px;
        font: italic 400 15px/1.7 var(--display);
        color: rgba(var(--ink), 0.45);
        text-align: center;
        text-wrap: pretty;
    }
    .error { color: rgba(var(--red), 0.65); }

    /* the verse */
    .verse-plate {
        margin: 20px var(--pad) 0;
        padding: 14px;
        background: var(--surface);
        border: 1px solid rgba(var(--gold), 0.45);
        position: relative;
        overflow: hidden;
    }
    /* big quote mark, clipped by the overflow on .verse-plate */
    .verse-mark {
        position: absolute;
        top: 2px;
        left: 6px;
        font: 400 108px/0.86 var(--display);
        color: var(--mustard);
        opacity: 0.12;
        pointer-events: none;
    }
    .verse-frame {
        position: relative;
        border: 1px solid rgba(var(--gold), 0.3);
        padding: 26px 22px 20px;
    }
    .verse-text {
        margin: 0;
        font: 400 23px/1.55 var(--display);
        text-wrap: pretty;
    }
    .verse-ref {
        margin-top: 18px;
        display: flex;
        align-items: center;
        gap: 10px;
        font: 400 11px/1 var(--body);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--maroon);
        font-variant-numeric: tabular-nums;
    }
    /* <cite> is italic by default, the reference is set in caps */
    .verse-ref cite { font-style: normal; }
    .verse-rule { width: 18px; height: 1px; background: var(--maroon); }
    .verse-credit {
        margin: 8px 0 0;
        font: 400 9.5px/1.5 var(--body);
        color: rgba(var(--ink), 0.42);
    }

    /* the shelf */
    .shelf { padding-top: 24px; padding-bottom: 24px; }
    .rule-head { display: flex; align-items: baseline; gap: 10px; }
    .rule { flex: 1; height: 1px; background: rgba(var(--gold), 0.5); }

    .shelf-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: baseline;
        width: 100%;
        text-align: left;
        padding: 11px 0;
        background: transparent;
        border: none;
        border-bottom: 1px solid rgba(var(--ink), 0.12);
        cursor: pointer;
        font: inherit;
        color: inherit;
        transition: background-color 140ms ease;
    }
    .shelf-row:hover { background: rgba(var(--gold), 0.06); }
    .shelf-snippet {
        font: 400 18px/1.3 var(--display);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .shelf-ref {
        font: 400 10px/1 var(--body);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(var(--ink), 0.45);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    /* mustard hairline*/
    .action:focus-visible,
    .plan-open:focus-visible,
    .plan-done:focus-visible,
    .stepper button:focus-visible,
    .word:focus-visible,
    .word-option:focus-visible,
    .feel-link:focus-visible,
    .pill:focus-visible,
    .ask:focus-visible,
    .back:focus-visible,
    .shelf-row:focus-visible {
        outline: 1px solid var(--mustard);
        outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
        .action-name, .action-box, .word, .word-option, .feel-link,
        .pill, .ask, .back, .shelf-row,
        .plan-open, .plan-done, .stepper button, .meter-fill {
            transition: none;
        }
    }
</style>
