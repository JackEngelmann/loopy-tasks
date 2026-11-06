# loopy-tasks

A small keyboard-driven work organizer built around **loops** (open workstreams) and their **next actions**. Navigation is inspired by [yazi](https://github.com/sxyazi/yazi).

Single HTML file, no build step. Open `index.html` in a browser. Data is stored in the browser's `localStorage`.

## Layout

- **Left:** loops. `All`, `Waiting` and `Important` are virtual views. A loop without an open task is marked yellow (`!`); a loop where everything is waiting is teal (`◷`).
- **Middle:** tasks of the selected loop.
- **Right (read-only):** Important, Waiting and Timed tasks across all loops.

## Markers in task text

| Marker  | Meaning                                        |
|---------|------------------------------------------------|
| `@w`    | waiting — moves the task to Waiting            |
| `@i`    | important — shown with ★ and in Important      |
| `14:30` | timed — listed in Timed, ordered by time       |

## Keys

| Key           | Action                                  |
|---------------|-----------------------------------------|
| `j` / `k`     | select down / up                        |
| `J` / `K`     | move item down / up                     |
| `g` / `G`     | first / last                            |
| `l` / `h`     | into tasks / back to loops              |
| `a`           | new loop or task                        |
| `r`           | rename                                  |
| `d`           | delete                                  |
| `space`       | toggle done                             |
| `w` / `i`     | toggle waiting / important              |
| `x` / `p`     | cut task / paste into selected loop     |
| `.`           | show / hide done tasks                  |
| `u`           | undo                                    |
| `enter`/`esc` | save / cancel while editing             |
