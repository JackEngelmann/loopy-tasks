// What the normal-mode keys do. Each changes ui and/or the data; the caller re-renders.

import { mutate, undo as undoChange } from '../model/store.js';
import { toggleToken, isWaiting } from '../model/markers.js';
import { ui, enter, narrow, PANES, db, virtuals, loopsList, currentLoop, currentTasks, selTask, selItem } from './view.js';
import { swap } from '../util.js';

export function move(delta) {
  if (ui.focus === 'loops') {
    ui.loopIdx += delta;
    ui.taskIdx = 0;
  } else {
    ui.taskIdx += delta;
  }
}

export function jump(toEnd) {
  if (ui.focus === 'loops') {
    ui.loopIdx = toEnd ? loopsList().length - 1 : 0;
    ui.taskIdx = 0;
  } else {
    ui.taskIdx = toEnd ? currentTasks().length - 1 : 0;
  }
}

export function focusPane(delta) {
  const i = PANES.indexOf(ui.focus) + delta;
  if (i >= 0 && i < PANES.length) ui.focus = PANES[i];
}

// J/K: move the selected item down/up; the virtual views stay pinned on top
export function shift(delta) {
  if (ui.focus === 'loops') {
    const i = ui.loopIdx - virtuals().length, j = i + delta;
    if (i < 0 || j < 0 || j >= db().loops.length) return;
    mutate(() => swap(db().loops, i, j));
    ui.loopIdx += delta;
  } else {
    // swap with the visible neighbour, so it works inside a filtered view
    const ts = currentTasks();
    const a = ts[ui.taskIdx], b = ts[ui.taskIdx + delta];
    if (!a || !b) return;
    mutate(() => { const ts = db().tasks; swap(ts, ts.indexOf(a), ts.indexOf(b)); });
    ui.taskIdx += delta;
  }
}

// o / O: new item below / above the selected one; `at` is where the input row shows
export function add(below) {
  if (ui.focus === 'loops') {
    // on "All", new loops go to the top of the real loops
    const i = ui.loopIdx - virtuals().length;
    enter('insert', { editing: { kind: 'new-loop', at: i < 0 ? 0 : i + (below ? 1 : 0) } });
  } else {
    if (currentLoop().kind === 'none') return;   // no template to add tasks to
    const anchor = selTask();
    enter('insert', {
      editing: {
        kind: 'new-task',
        anchorId: anchor && anchor.id,
        below,
        at: anchor ? ui.taskIdx + (below ? 1 : 0) : currentTasks().length,
      },
    });
  }
}

export function rename() {
  const item = selItem();
  if (item && item.id) enter('insert', { editing: { kind: 'rename', id: item.id } });
}

export function remove() {
  if (ui.focus === 'loops') {
    const loop = currentLoop();
    if (!loop.id) return;
    // deleting a loop keeps its tasks, unassigned
    mutate(() => {
      const d = db();
      if (ui.templates) d.tasks = d.tasks.filter(t => t.loopId !== loop.id);   // a template's tasks go with it
      else d.tasks.forEach(t => { if (t.loopId === loop.id) t.loopId = null; });
      d.loops = d.loops.filter(l => l.id !== loop.id);
    });
  } else {
    const task = selTask();
    if (task) mutate(() => { db().tasks = db().tasks.filter(t => t.id !== task.id); });
  }
}

export function toggleDone() {
  if (ui.templates) return;   // templates are never done; their copies are
  const task = selTask();
  if (task) mutate(() => { task.done = !task.done; task.doneAt = task.done ? Date.now() : null; });
}

export function toggleMarker(tok) {
  const task = selTask();
  if (!task || task.done) return;
  mutate(() => { task.title = toggleToken(task.title, tok); });
  // handing something off is a good moment to write down where you are
  if (tok === '@w' && isWaiting(task)) ui.flash = { text: 'm to note where you left off' };
}

export function cut() {
  const task = selTask();
  if (task) ui.cutId = ui.cutId === task.id ? null : task.id;
}

// pasting into "All" unassigns the task
export function paste() {
  const task = db().tasks.find(t => t.id === ui.cutId);
  if (!task) return;
  mutate(() => { task.loopId = currentLoop().id; });
  ui.cutId = null;
}

export const undo = undoChange;

// s: the right column as an overlay, on narrow windows only
export function toggleSide() {
  ui.sideOpen = narrow.matches && !ui.sideOpen;
}

export function clearMarks() {
  ui.cutId = null;
  ui.search = null;
  ui.sideOpen = false;
}
