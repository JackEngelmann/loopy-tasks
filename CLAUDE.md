# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

loopy-tasks: a keyboard-driven organizer for loops (open workstreams) and their next actions. Plain browser ES modules, no build step, no dependencies, data in `localStorage`. The only server code is `serve.py` (Python stdlib), which serves the files and proxies Todoist. See README.md for the user-facing behavior (markers, keys, layout).

## Commands

```sh
python3 serve.py              # serve the repo on 127.0.0.1, open http://localhost:8000 (file:// can't load ES modules);
                              # also proxies Todoist with TODOIST_TOKEN from .env
python3 tests/run.py          # all tests (serve.py's, then the browser ones in headless Chrome); exits non-zero on failure
python3 tests/run.py unit     # pure modules only
python3 tests/run.py e2e      # the app in an iframe, driven by key events
python3 tests/run.py server   # serve.py only (tests/test_serve.py, plain unittest)
```

`CHROME=/path/to/binary` if Chrome isn't at the default macOS location. With the server running, `/tests/` shows the same report in a browser. There is no way to run a single browser test; the harness (`tests/harness.js`) runs every registered `test()` in the chosen group in order.

## Architecture

- **Data (`src/model/`, no DOM).** `store.js` holds `state`, which is never reassigned (other modules import it); `replace()` swaps its contents for undo and import. Every change goes through `mutate(fn)`, which snapshots for undo, re-stamps `waitingSince`, runs `settle()` and persists. `settle()` keeps two rules: a task without a loop must be timed (others go to the Inbox), and a one-step loop (`single: true`) lives exactly as long as its one open task, is named after it, and turns normal with a second task. Waiting tasks carry `checkedAt` (set by `.`, which also strips a check-back time); `checkDue()` in `queries.js` asks for a look after `CHECK_EVERY` minutes, or at a wait's check-back time if it has one. Such waits go to Check, never to Now. Task metadata lives in the title text as markers (`@w`, `@p` in progress, `@n` not now, `14:30`, `+20m`), parsed in `markers.js`; `queries.js` derives next actions, loop status, Now and Check from that. Not-now tasks stay in `openTasks` but are left out of everything that means work (`activeTasks`, `doable`, `timedTasks`, `attention`); `tasksOf` lists them last.
- **Schema changes:** bump `SCHEMA_VERSION` in `store.js` and append to `MIGRATIONS` (index n upgrades n → n+1). Stored data and imported files both go through `migrate()`.
- **UI state (`src/ui/view.js`).** One `ui` object with a `mode` (`normal`, `insert`, `modal`, `search`, `picker`, `todoist`, `command`, `capture`, `help`) that decides who handles keys. `main.js` dispatches keys only in `normal`/`picker`/`todoist`/`help` via the command table; typing modes handle keys in their own elements. `loopsList()` is your loops, then the virtual entries (`Inbox` with the fixed loop id `INBOX_ID` from `queries.js`, `All` with `id: null`), so loop j is at `loopIdx` j and `onVirtual()` tells the rest; a filler row pins the virtual entries to the bottom of the pane; having a `kind` marks them as virtual (no rename, note or delete). On a one-step loop's row, `selTask()` / `selItem()` return its task, so task keys work there. Template mode (`T`) reuses the same panes on `state.templates` (same shape as the main data) through `db()`.
- **Keys (`src/ui/commands.js`).** Every key is one row in `COMMANDS`: action, hint label, visibility, `essential` (shown in the bottom hint line). The hint line and `?` help are generated from it, so a new key is a new row there; behavior lives in `actions.js` or a feature module. Command-mode rows keep a short `label` for the status bar and the full text in `help` for `?`.
- **What needs you (`src/ui/attention.js`, `src/ui/render/top.js`).** The loops pane starts with Now, today's remaining times and the Check rows (one per wait due, in loop order, `checkTasks()`). Doing rows (tasks in progress, `inProgress()`) come first. The cursor can stand on Doing and Check rows, both tasks: `ui.topOn` is `{ kind: 'doing' | 'check', id }` (a task id) and `ui.loopIdx` follows the task's loop, and `selTask()` / `selItem()` return that task (`topTask()`), so task keys work there; `move`/`jump`/`focusPane` in `actions.js` hand over to `attention.js`, and `syncTop()` (each render) drops `topOn` once the row is gone. Focus (`f`, `ui.focusMode`) adds `quiet` to loops and tasks not in progress and ends by itself in `syncFocus()`. `stampWaiting()` also stamps `progressSince` and strips `@p` from done tasks. `firstDoable()` (the green loop) skips timed tasks. Top rows carry no `data-i`; Doing rows carry `data-doing`, Check rows `data-check`. The check interval lives in `CHECK_EVERY` (`queries.js`, a live `let`), set by `:check` (`features/check-every.js`, stored as `loopy-check-every`).
- **`:` commands (`src/features/cmdline.js`).** `:name rest` calls `COMMANDS[name](rest)`; add a function there and a `command` row in `commands.js`.
- **Todoist (`src/features/todoist.js`, `src/model/todoist.js`, `serve.py`).** No sync: `a` / `:pick [filter]` copies Todoist tasks into the selected loop (they keep `todoistId` so they aren't picked twice) and never writes to Todoist; `:park [when]` creates a Todoist task or, for a picked one, only sets its date. The browser calls the relative `todoist/<api path>`; `serve.py` adds `TODOIST_TOKEN` from `.env` (gitignored, re-read per request) and forwards to `api.todoist.com/api/v1/`. It forwards only the method/path/body fields in its `ALLOWED` list and only from Loopy's own origin, binds 127.0.0.1, and never serves dotfiles. A new Todoist call needs an `ALLOWED` entry and a case in `tests/test_serve.py`.
- **Rendering (`src/ui/render/`).** `render()` redraws everything from state after every key; there is no diffing. A 60 s timer re-renders except while editing.
- **Note editor (`src/editor/`).** `vim.js` is a pure `(state, key) → state` vim core (unit-tested); `modal.js` wraps it in the overlay.

## Tests

`tests/unit.js` imports the pure modules directly. `tests/e2e.js` loads `index.html` in an iframe, clears `localStorage` (`loops-v1`, `loopy-notified`, `loopy-layout`, `loopy-check-every`, ...), starts from the seed data, dispatches `keydown` events, and checks the DOM and the saved JSON. New behavior reachable by keys is normally covered by an e2e test in that style. Todoist e2e tests replace the iframe's `fetch` (`fakeTodoist`) and `await settle()` for the async render; nothing reaches Todoist. `tests/run.py` serves files with a plain static server, not `serve.py`. `tests/test_serve.py` runs `serve.py`'s handler on a free port with `urlopen` and `token` mocked.

## Style

Match the existing code: short lowercase comments explaining why, `// ── Section ──` dividers, compact arrow functions, plain-English UI text. Recent commits favor a calm design: monospace only for times, numbers and keys; short hints.
