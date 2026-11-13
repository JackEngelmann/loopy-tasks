// What the normal-mode keys do. Each changes ui and/or the data; the caller re-renders.

import { state, mutate, undo as undoChange } from '../model/store.js';
import { toggleToken, stripToken, stripTime, isWaiting, isNotNow, timeOf } from '../model/markers.js';
import { INBOX_ID, CHECK_EVERY, openTasks } from '../model/queries.js';
import { ui, enter, narrow, PANES, db, virtuals, loopsList, currentLoop, currentTasks, selTask, selItem, loopById } from './view.js';
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
    if (!a || !b || isNotNow(a) !== isNotNow(b)) return;   // z moves between the two parts
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
  if (item && item.id && !item.kind) enter('insert', { editing: { kind: 'rename', id: item.id } });
}

export function remove() {
  if (ui.focus === 'loops') {
    const loop = currentLoop();
    if (loop.kind) return;   // the virtual entries stay
    // deleting a loop keeps its tasks: they go to the Inbox (settle() does that)
    mutate(() => {
      const d = db();
      // a template's tasks go with it, and so does a one-step loop's task
      if (ui.templates || loop.single) d.tasks = d.tasks.filter(t => t.loopId !== loop.id);
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
  else if (ui.focus === 'loops') finishLoop();
}

// space on a loop's row: it's done and goes away, once nothing in it is open
function finishLoop() {
  const loop = currentLoop();
  if (loop.kind) return;
  const open = openTasks(state, loop.id).length;
  if (open) {
    ui.flash = { text: `${open} open ${open === 1 ? 'task' : 'tasks'} left · d deletes the loop, its tasks go to the Inbox` };
    return;
  }
  mutate(() => {
    state.loops = state.loops.filter(l => l.id !== loop.id);
    state.tasks = state.tasks.filter(t => t.loopId !== loop.id);
  });
  ui.flash = { text: `finished "${loop.title}" · u to undo` };
}

// .: looked at what's waiting; it asks again in CHECK_EVERY minutes. On a loop's row,
// all of that loop's waits at once (several agents in one project are looked at together)
export function markChecked() {
  if (ui.templates) return;
  const one = ui.focus === 'tasks' || currentLoop().single;
  const waits = (one ? [selTask()] : currentTasks()).filter(t => t && isWaiting(t));
  if (!waits.length) { ui.flash = { text: 'nothing waiting here' }; return; }
  const now = Date.now();
  mutate(() => waits.forEach(t => { t.checkedAt = now; }));
  ui.flash = { text: `checked${waits.length > 1 ? ` ${waits.length}` : ''} · again in ${CHECK_EVERY}m` };
}

// S: a one-step loop, a single thing to do with its own place in your order
export function addSingle() {
  if (ui.templates) return;
  const i = ui.loopIdx - virtuals().length;
  ui.focus = 'loops';
  enter('insert', { editing: { kind: 'new-single', at: i < 0 ? 0 : i + 1 } });
}

export function toggleMarker(tok) {
  const task = selTask();
  if (!task || task.done) return;
  // not now belongs to a loop; elsewhere, :park hands it to Todoist
  if (tok === '@n' && !isNotNow(task) && (task.loopId === INBOX_ID || !loopById(task.loopId))) {
    ui.flash = { text: 'not now is for tasks in a loop · :park sends it to Todoist' };
    return;
  }
  // ending a wait also drops its check-back time
  const endsWait = tok === '@w' && isWaiting(task);
  // waiting and not now exclude each other: someone else has it, or you hold it back
  const other = { '@w': '@n', '@n': '@w' }[tok];
  mutate(() => {
    const title = other ? stripToken(task.title, other) : task.title;
    task.title = toggleToken(endsWait ? stripTime(title) : title, tok);
  });
  // handing something off is a good moment to write down where you are,
  // and to say when to look again
  if (tok === '@w' && isWaiting(task)) {
    ui.flash = { text: timeOf(task) === null
      ? '+20m in the title (r) sets a check-back · m to note where you left off'
      : 'm to note where you left off' };
  }
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
