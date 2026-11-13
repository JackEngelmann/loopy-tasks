// :view g | i | classic: two one-list layouts on trial next to the classic one. Both drop
// the Today panel and put Now and today's times at the top of the loops pane.
//   g  then a Check block, one row per loop with waits due, and your loops below
//   i  one column: an outline of your loops with their tasks under them, folded below the
//      first thing you can do. The cursor moves through loops and tasks alike; it is still
//      ui.focus / loopIdx / taskIdx underneath, so every key works as in the classic view.
// In both, the first loop (in your order) with something you can do is green, and ] / [
// go to the next / previous thing that needs you.

import { state } from '../model/store.js';
import { isWaiting, timeOf, nowMinutes } from '../model/markers.js';
import { doable, openTasks, checkDue, attention } from '../model/queries.js';
import { ui, loopsList, tasksOf, VIRTUAL } from './view.js';

const VIEW_KEY = 'loopy-view';
export const VIEWS = { classic: 'the classic three panes', g: 'G: checks on top, loops below', i: 'I: the outline' };

// template mode always uses the classic panes
export const activeView = () => ui.templates ? 'classic' : ui.view;

export function loadView() {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved in VIEWS) ui.view = saved;
  } catch {}
}

// :view <name>
export function setView(name) {
  if (!(name in VIEWS)) {
    ui.flash = { text: `views: ${Object.keys(VIEWS).join(', ')}`, error: !!name };
    return;
  }
  ui.view = name;
  try { localStorage.setItem(VIEW_KEY, name); } catch {}
  ui.flash = { text: `view ${VIEWS[name]}` };
}

// ── What needs you ────────────────────────────────────────────────────────────

// the first thing you can do now, going down your loops: timed tasks don't count, they
// belong to the clock (and show in Now when it's time)
export const firstTaskOf = loop => doable(state, loop.id).find(t => timeOf(t) === null) || null;
export const firstDoable = () => state.loops.find(firstTaskOf) || null;

// per loop with waits due for a look, in loop order (the Inbox last)
export function checksByLoop(nowMs = Date.now()) {
  const list = [...state.loops, ...VIRTUAL.filter(v => v.kind === 'inbox')];
  return list.map(loop => {
    const waits = openTasks(state, loop.id).filter(isWaiting);
    const due = waits.filter(t => checkDue(t, nowMs));
    const oldest = Math.min(...due.map(t => t.checkedAt ?? t.waitingSince ?? nowMs));
    return { loop, waits: waits.length, due: due.length, oldest };
  }).filter(c => c.due);
}

// ── The outline (i) ───────────────────────────────────────────────────────────
// your loops in order, then the Inbox; each loop's tasks under it while it's unfolded

const foldKey = loop => loop.id;

// loops down to the green one are open, the rest folded, unless you folded them by hand
export function isOpen(loop) {
  if (loop.single) return false;
  if (foldKey(loop) in ui.unfold) return ui.unfold[foldKey(loop)];
  if (loop.kind === 'inbox') return false;
  const first = firstDoable();
  return !first || state.loops.indexOf(loop) <= state.loops.indexOf(first);
}

export function outlineItems() {
  const all = loopsList();
  const order = [...all.keys()].filter(i => !all[i].kind).concat(all.findIndex(l => l.kind === 'inbox'));
  const items = [];
  order.forEach(loopIdx => {
    const loop = all[loopIdx];
    items.push({ kind: 'loop', loopIdx, loop });
    if (isOpen(loop)) tasksOf(loop).forEach((task, taskIdx) => items.push({ kind: 'task', loopIdx, taskIdx, task, loop }));
  });
  return items;
}

// where the cursor is; on an empty loop's tasks it stays on the loop
export function outlinePos(items = outlineItems()) {
  const onTask = ui.focus === 'tasks'
    ? items.findIndex(it => it.kind === 'task' && it.loopIdx === ui.loopIdx && it.taskIdx === ui.taskIdx)
    : -1;
  return onTask >= 0 ? onTask : Math.max(0, items.findIndex(it => it.kind === 'loop' && it.loopIdx === ui.loopIdx));
}

export function outlineSelect(it) {
  if (!it) return;
  ui.loopIdx = it.loopIdx;
  ui.focus = it.kind === 'loop' ? 'loops' : 'tasks';
  ui.taskIdx = it.taskIdx ?? 0;
}

export function outlineMove(delta) {
  const items = outlineItems();
  outlineSelect(items[Math.max(0, Math.min(items.length - 1, outlinePos(items) + delta))]);
}

export function outlineJump(toEnd) {
  const items = outlineItems();
  outlineSelect(items[toEnd ? items.length - 1 : 0]);
}

// l on a loop unfolds it and steps onto its first task; h on a task goes back up to its
// loop, and on a loop folds it
export function outlineSide(delta) {
  const items = outlineItems();
  const it = items[outlinePos(items)];
  if (!it) return;
  if (delta > 0 && it.kind === 'loop' && !it.loop.single) {
    ui.unfold[foldKey(it.loop)] = true;
    ui.focus = 'tasks';
    ui.taskIdx = 0;
  } else if (delta < 0) {
    if (it.kind === 'task') ui.focus = 'loops';
    else if (!it.loop.single) ui.unfold[foldKey(it.loop)] = false;
  }
}

// tab: fold or unfold the loop the cursor is in
export function toggleFold() {
  const items = outlineItems();
  const it = items[outlinePos(items)];
  if (!it || it.loop.single) return;
  ui.unfold[foldKey(it.loop)] = !isOpen(it.loop);
  ui.focus = 'loops';
}

// ── ] / [ ─────────────────────────────────────────────────────────────────────
// the outline stops at each task that needs you (its time has come, a check is due) and at
// the first thing you can do; the other views stop at the loops those are in

function attentionTasks() {
  const g = attention(state, nowMinutes());
  const first = firstDoable();
  return new Set([...g.now, ...g.check, ...(first ? [firstTaskOf(first)] : [])]);
}

export function nextAttention(dir) {
  const wanted = attentionTasks();
  if (activeView() === 'i') {
    const items = outlineItems();
    const hits = items.map((it, k) => ({ it, k }))
      .filter(({ it }) => it.kind === 'task' ? wanted.has(it.task)
        : !isOpen(it.loop) && openTasks(state, it.loop.id).some(t => wanted.has(t)));
    return step(hits.map(h => h.k), outlinePos(items), dir, k => outlineSelect(items[k]));
  }
  const all = loopsList();
  const loops = [...all.keys()].filter(i => all[i].id !== null && openTasks(state, all[i].id).some(t => wanted.has(t)));
  return step(loops, ui.loopIdx, dir, i => { ui.loopIdx = i; ui.focus = 'loops'; ui.taskIdx = 0; });
}

function step(stops, here, dir, go) {
  const next = dir > 0 ? stops.find(k => k > here) ?? stops[0] : [...stops].reverse().find(k => k < here) ?? stops.at(-1);
  if (next === undefined) ui.flash = { text: 'nothing needs you right now' };
  else go(next);
}
