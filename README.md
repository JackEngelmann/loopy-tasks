# loopy-tasks

A small keyboard-driven organizer for the work of today, built around **loops** (open workstreams) and their **next actions**. Navigation is inspired by [yazi](https://github.com/sxyazi/yazi).

No build step and no dependencies. Data is stored in the browser's `localStorage`.

## Run

The app is plain ES modules, which browsers don't load from `file://`, so serve the folder:

```sh
python3 serve.py          # or: python3 serve.py 8123
```

and open <http://localhost:8000>. Reminders (system notifications for timed tasks) also need this. `serve.py` listens on this machine only, never serves dotfiles like `.env`, and passes Loopy's Todoist requests on (see below).

## Layout

- **Left:** `All`, `Standalone` (tasks without a loop), then your loops. A loop without a next action is yellow; one where everything is waiting is teal. The second line is the loop's next action (its first open, non-waiting task).
- **Middle:** the selected loop's note and open tasks.
- **Right (read-only): Today**, what needs you across all loops, most urgent first: **Now** (its time has come, including check-backs of waiting tasks), **Soon** (within 30 min), **Important**, **Later**, and **Plan** (loops without a next action). When nothing is due it says so. The header badge and the tab title count what's in Now. On narrow windows this folds into a line above the panes: a yellow strip while something is due now or soon, a quiet line otherwise; `s` shows the panel as an overlay.

## Markers in task text

| Marker          | Meaning                                                  |
|-----------------|----------------------------------------------------------|
| `@w`            | waiting (shows how long); add a time for when to check back |
| `@i`            | important                                                 |
| `14:30`         | timed: listed in Timed, reminded at that time             |
| `+20m` `+1h30`  | becomes a clock time when saved                           |

## Keys

The bottom line shows the main keys for where you are; `?` lists all of them. In short:

| Key             | Action                                          |
|-----------------|-------------------------------------------------|
| `j` / `k`, `J` / `K` | select / move item down, up                |
| `g` / `G`       | first / last                                    |
| `l` / `h`       | into tasks / back to loops                      |
| `o` / `O`       | new item below / above                          |
| `r` / `R`       | rename inline / in the editor                   |
| `m`             | note on the loop or task (multi-line editor)    |
| `space`         | done                                            |
| `w` / `i`       | toggle waiting / important                      |
| `x` / `p`       | cut task / paste into the selected loop         |
| `d`             | delete                                          |
| `/`, `n` / `N`  | search, next / previous match                   |
| `t` / `T`       | new loop from a template / edit templates       |
| `a`, `:pick [filter]` | add tasks from Todoist (see below)        |
| `s`             | show the right column (narrow windows)          |
| `u`             | undo                                            |
| `?`             | all keys                                        |
| `:export` / `:import` | download all data / replace it from a file |
| `:park [when]`  | move the task to Todoist (see below)            |

## Todoist

Loopy doesn't sync with Todoist, but tasks can move between them by hand. Todoist holds the long-term to-dos and Loopy holds today.

- **Set up:** put your API token (Todoist → Settings → Integrations → Developer) in `.env` as `TODOIST_TOKEN=…` (see `.env.example`; `.env` is gitignored). `serve.py` reads it on every request, so no restart is needed, and adds it to Loopy's Todoist requests: the browser never sees the token. It passes on only what Loopy does (list tasks and projects, add a task, change a task's date), and only from Loopy's own pages.
- **`a`** (or `:pick`) lists Todoist's today and overdue tasks with their project. `:pick <filter>` takes any [Todoist filter](https://todoist.com/help/articles/introduction-to-filters-V98wIH) instead: `:pick @arbeit` lists everything labelled arbeit, `:pick today & @arbeit` only today's. `space` marks several, `enter` copies the marked ones (or the selected one) into the selected loop. A time due today becomes a time marker, p1 becomes `@i`, and the description becomes the note. Todoist is not changed: a task finished here still needs ticking off there. Tasks already picked show a ✓ and can't be added twice.
- **`:park [when]`** moves the selected task to Todoist: it becomes a new Inbox task (`when` is Todoist's own date text, like `tomorrow` or `fri`) and leaves Loopy. A task that came from Todoist is still there, so parking only removes it here, and moves its date if you give one.

The note editor opens in normal mode with a few vim keys (motions, `d`/`c` with `w e b $ 0 iw`, `dd`, `cc`, `C`, counts) and `:w`, `:wq`, `:x`, `:q`, `:q!`.

## Code

```
index.html, style.css
src/
  main.js              init, keys and mouse wiring
  util.js
  model/               data, no DOM
    markers.js         @w / @i / times / +20m in titles
    queries.js         next actions, loop status, what needs you today, due reminders
    store.js           state, localStorage, schema version + migrations, undo
    import.js          reading an export file
    todoist.js         what a picked Todoist task becomes, the picker's order
  ui/
    view.js            ui state, the current mode, what the panes show
    commands.js        every key: what it does and its hint (one table)
    actions.js         what the normal-mode keys do
    inline-edit.js     the one-line input (o, O, r)
    render/            loops, tasks, side column, status bar
  editor/
    vim.js             pure vim core: (state, key) → state
    modal.js           the note / rename editor around it
  features/            search, templates, reminders, export/import, Todoist, seed data
tests/
```

- **A new key:** add a row to `src/ui/commands.js`. The hint line is generated from it.
- **A change to the data shape:** bump `SCHEMA_VERSION` in `src/model/store.js` and append a migration. Stored data and imported files are upgraded with it.

## Tests

```sh
python3 tests/run.py          # everything
python3 tests/run.py unit     # pure modules only
python3 tests/run.py e2e      # the app in a browser, driven by keys
python3 tests/run.py server   # serve.py: what it serves and passes on
```

The browser tests run headless Chrome (set `CHROME` if it isn't in the default macOS location). With the server running, <http://localhost:8000/tests/> shows the same results in the browser.
