# loopy-tasks

A small keyboard-driven organizer for the work of today, built around **loops** (open workstreams) and their **next actions**. Navigation is inspired by [yazi](https://github.com/sxyazi/yazi).

No build step and no dependencies. Data is stored in the browser's `localStorage`.

## Run

The app is plain ES modules, which browsers don't load from `file://`, so serve the folder:

```sh
python3 -m http.server
```

and open <http://localhost:8000>. Reminders (system notifications for timed tasks) also need this.

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
| `s`             | show the right column (narrow windows)          |
| `u`             | undo                                            |
| `?`             | all keys                                        |
| `:export` / `:import` | download all data / replace it from a file |

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
  ui/
    view.js            ui state, the current mode, what the panes show
    commands.js        every key: what it does and its hint (one table)
    actions.js         what the normal-mode keys do
    inline-edit.js     the one-line input (o, O, r)
    render/            loops, tasks, side column, status bar
  editor/
    vim.js             pure vim core: (state, key) → state
    modal.js           the note / rename editor around it
  features/            search, templates, reminders, export/import, seed data
tests/
```

- **A new key:** add a row to `src/ui/commands.js`. The hint line is generated from it.
- **A change to the data shape:** bump `SCHEMA_VERSION` in `src/model/store.js` and append a migration. Stored data and imported files are upgraded with it.

## Tests

```sh
python3 tests/run.py          # everything
python3 tests/run.py unit     # pure modules only
python3 tests/run.py e2e      # the app in a browser, driven by keys
```

Runs headless Chrome (set `CHROME` if it isn't in the default macOS location). With the server running, <http://localhost:8000/tests/> shows the same results in the browser.
