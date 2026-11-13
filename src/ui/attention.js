// What needs you, at the top of the loops pane: what you're working on (the Doing rows), the
// loops whose waits are due for a look (the Check rows), and the first thing you can do (the
// green loop). ] / [ go from one to the next. The cursor can stand on the Doing and Check
// rows; ui.loopIdx follows it, so the middle pane shows that loop and loop keys work there.

import { state } from '../model/store.js';
import { timeOf } from '../model/markers.js';
import { doable, checkDue, inProgress } from '../model/queries.js';
import { ui, loopsList, tasksOf, VIRTUAL } from './view.js';

// the first thing you can do now, going down your loops: timed tasks don't count, they
// belong to the clock (and show in Now when it's time)
export const firstTaskOf = loop => doable(state, loop.id).find(t => timeOf(t) === null) || null;
export const firstDoable = () => state.loops.find(firstTaskOf) || null;

// the waits due for a look, in loop order and in order within each loop (the Inbox and
// timed tasks without a loop last)
export function checkTasks(nowMs = Date.now()) {
  if (ui.templates) return [];
  const ids = [...state.loops.map(l => l.id), ...VIRTUAL.filter(v => v.kind === 'inbox').map(v => v.id), null];
  return ids.flatMap(id => state.tasks.filter(t => t.loopId === id && checkDue(t, nowMs)));
}

// ── The cursor on a top row ───────────────────────────────────────────────────
// Above your loops, the cursor can stand on the Doing rows (tasks in progress) and the Check
// rows (waits due for a look), in that order; both are tasks. ui.topOn is { kind: 'doing' | 'check', id }.

export function topStops() {
  if (ui.templates) return [];
  return [
    ...inProgress(state).map(t => ({ kind: 'doing', id: t.id, loopId: t.loopId })),
    ...checkTasks().map(t => ({ kind: 'check', id: t.id, loopId: t.loopId })),
  ];
}
const isHere = s => ui.topOn !== null && s.kind === ui.topOn.kind && s.id === ui.topOn.id;

export function onTop(stop) {
  ui.topOn = { kind: stop.kind, id: stop.id };
  ui.loopIdx = Math.max(0, loopsList().findIndex(l => l.id === stop.loopId));
  ui.focus = 'loops';
  ui.taskIdx = 0;
}

// a top row goes away once it's done with (finished, checked, or no longer due)
export function syncTop() {
  if (ui.topOn !== null && !topStops().some(isHere)) ui.topOn = null;
}

// j / k: the top rows sit above the first loop row
export function moveAcrossTop(delta) {
  if (ui.focus !== 'loops') return false;
  const stops = topStops();
  const i = stops.findIndex(isHere);
  if (i >= 0) {
    if (i + delta >= stops.length) Object.assign(ui, { topOn: null, loopIdx: 0 });
    else if (i + delta >= 0) onTop(stops[i + delta]);
    return true;
  }
  if (delta < 0 && ui.loopIdx === 0 && stops.length) {
    onTop(stops.at(-1));
    return true;
  }
  return false;
}

// g: the first top row, if there is one
export function jumpToTop() {
  const stops = topStops();
  if (!stops.length) return false;
  onTop(stops[0]);
  return true;
}

// l / enter on a top row: into the loop, on that task
export function openTop() {
  if (ui.topOn === null) return false;
  const at = tasksOf(loopsList()[ui.loopIdx]).findIndex(t => t.id === ui.topOn.id);
  Object.assign(ui, { topOn: null, focus: 'tasks', taskIdx: Math.max(0, at) });
  return true;
}

// after . on a Check row: on to the next one, or to the green loop when they're all done
export function afterCheck(before) {
  const left = checkTasks().map(t => t.id);
  const next = before.slice(before.indexOf(ui.topOn.id) + 1).find(id => left.includes(id)) ?? left[0];
  if (next !== undefined) return onTop(topStops().find(s => s.kind === 'check' && s.id === next));
  ui.topOn = null;
  const green = firstDoable();
  if (green) Object.assign(ui, { loopIdx: loopsList().indexOf(green), focus: 'loops', taskIdx: 0 });
}

// ── ] / [ ─────────────────────────────────────────────────────────────────────
// the stops are the top rows (Doing, Check), then the green loop

export function nextAttention(dir) {
  const green = firstDoable();
  const stops = [...topStops(), ...(green ? [{ green }] : [])];
  if (!stops.length) {
    ui.flash = { text: 'nothing needs you right now' };
    return;
  }
  const here = ui.topOn !== null ? stops.findIndex(s => !s.green && isHere(s))
    : green && loopsList()[ui.loopIdx] === green ? stops.length - 1 : -1;
  const to = stops[here < 0 ? (dir > 0 ? 0 : stops.length - 1) : (here + dir + stops.length) % stops.length];
  if (to.green) Object.assign(ui, { topOn: null, loopIdx: loopsList().indexOf(to.green), focus: 'loops', taskIdx: 0 });
  else onTop(to);
}

// ── Focus (f) ─────────────────────────────────────────────────────────────────
// everything except what's in progress (and Now, Check) goes quiet; it ends by itself once
// nothing is in progress

export function toggleFocus() {
  const doing = inProgress(state);
  if (!ui.focusMode && !doing.length) {
    ui.flash = { text: 'nothing in progress · i puts a task in progress' };
    return;
  }
  ui.focusMode = !ui.focusMode;
  if (!ui.focusMode) return;
  // open the first task in progress, its note in full
  onTop({ kind: 'doing', id: doing[0].id, loopId: doing[0].loopId });
  openTop();
}

export function syncFocus() {
  if (ui.focusMode && !inProgress(state).length) ui.focusMode = false;
}
