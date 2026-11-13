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

Two panes, read from the top. The idea: what needs a look comes first, and your eye stops at the first thing you can do.

- **Left, on top:** **Doing**: the tasks in progress (`i`), with their loop and how long, longest first. Then **Now** (appointments whose time has come), then today's remaining times in one line, then **Check**: one row per loop whose waits are due for a look, in loop order, with how many and since when. A wait is due once it hasn't been looked at for a while (10 min; `:check` changes it), or, if it has a check-back time (`@w +10m`), once that time comes; you also get a reminder then. `.` resets it, and drops a check-back time: from then on the interval applies. The cursor can stand on the Doing and Check rows (above the first loop; `g` goes to the first one). On a Doing row, task keys act on that task (`space` finishes it, `i` stops it) and `l` opens its loop on it. On a Check row, `.` checks all of that loop's waits and moves on to the next row, `l` opens the loop on its first wait that's due. `]` / `[` go through the Doing and Check rows and end at the green loop. **Focus** (`f`, while something is in progress): every loop and task that isn't in progress goes quiet, and the first task in progress opens with its note; `f` or `esc` ends it, and so does finishing the last task in progress. The tab title counts what's in Now (`(1) loops`), for when the tab is in the background. There is no top bar, so nothing above the panes appears or disappears; "enable reminders" sits in the status bar until reminders are on.
- **Left, below:** your loops, most important first, and at the bottom of the pane `Inbox` (captured, not sorted yet; yellow while anything is in it) and `All`. The first loop with something you can do now is **green** (timed tasks don't count: they belong to the clock). A loop without a next action is yellow; one where everything is waiting is teal. The second line is the loop's next action. A single thing to do (a message to answer) is a **one-step loop** (`S`): one line, keys on it act on its task, and it goes away when the task is done. Every task belongs to a loop or the Inbox, except timed ones (a meeting with nothing to prepare), which may have no loop and show in All and on top.
- **Middle:** the selected loop's note and open tasks; not-now tasks (`z`) last, under a quiet heading. They are never a next action, don't count, and stay out of Now, Check and reminders, so a loop with only those left is yellow.

## Markers in task text

| Marker          | Meaning                                                  |
|-----------------|----------------------------------------------------------|
| `@w`            | waiting (shows how long); a time (`+10m`) says when the first look is due |
| `@p`            | in progress: what you're working on now (`i`); waiting, not now and in progress exclude each other |
| `@n`            | not now: kept with its loop (an idea, held back), but not work |
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
| `S`             | new one-step loop below                         |
| `c`             | capture into the Inbox, from anywhere           |
| `r` / `R`       | rename inline / in the editor                   |
| `m`             | note on the loop or task (multi-line editor)    |
| `space`         | done; on a loop's row: finish the loop (once nothing is open) |
| `.`             | checked: a waiting task, or all waits of a loop; asks again after the check interval |
| `]` / `[`       | next / previous Check row, then the green loop  |
| `w` / `i`       | toggle waiting / in progress                    |
| `f`             | focus on what's in progress (`esc` ends it)     |
| `z`             | toggle not now (tasks in a loop)                |
| `x` / `p`       | cut task / paste into the selected loop         |
| `d`             | delete (a deleted loop's tasks go to the Inbox) |
| `/`, `n` / `N`  | search, next / previous match                   |
| `t` / `T`       | new loop from a template / edit templates       |
| `a`, `:pick [filter]` | add tasks from Todoist (see below)        |
| `u`             | undo                                            |
| `?`             | all keys                                        |
| `:export` / `:import` | download all data / replace it from a file |
| `:check [min]`  | how long a wait goes without a look (10)        |
| `:park [when]`  | move the task to Todoist (see below)            |

## Todoist

Loopy doesn't sync with Todoist, but tasks can move between them by hand. Todoist holds the long-term to-dos and Loopy holds today.

- **Set up:** put your API token (Todoist → Settings → Integrations → Developer) in `.env` as `TODOIST_TOKEN=…` (see `.env.example`; `.env` is gitignored). `serve.py` reads it on every request, so no restart is needed, and adds it to Loopy's Todoist requests: the browser never sees the token. It passes on only what Loopy does (list tasks and projects, add a task, change a task's date), and only from Loopy's own pages.
- **`a`** (or `:pick`) lists Todoist's today and overdue tasks with their project. `:pick <filter>` takes any [Todoist filter](https://todoist.com/help/articles/introduction-to-filters-V98wIH) instead: `:pick @arbeit` lists everything labelled arbeit, `:pick today & @arbeit` only today's. `space` marks several, `enter` copies the marked ones (or the selected one) into the selected loop. A time due today becomes a time marker, and the description becomes the note. Todoist is not changed: a task finished here still needs ticking off there. Tasks already picked show a ✓ and can't be added twice.
- **`:park [when]`** moves the selected task to Todoist: it becomes a new task in your Todoist Inbox (`when` is Todoist's own date text, like `tomorrow` or `fri`) and leaves Loopy. A task that came from Todoist is still there, so parking only removes it here, and moves its date if you give one.

The note editor opens in normal mode with a few vim keys (motions, `d`/`c` with `w e b $ 0 iw`, `dd`, `cc`, `C`, counts) and `:w`, `:wq`, `:x`, `:q`, `:q!`.

## Code

```
index.html, style.css
src/
  main.js              init, keys and mouse wiring
  util.js
  model/               data, no DOM
    markers.js         @w / @p / @n / times / +20m in titles
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
  features/            search, templates, reminders, export/import, Inbox capture, Todoist, seed data
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
