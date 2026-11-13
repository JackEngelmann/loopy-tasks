// What needs you, at the top of the loops pane: the loops whose waits are due for a look
// (the Check rows) and the first thing you can do (the green loop). ] / [ go from one to
// the next.
//
// The cursor can stand on a Check row: ui.checkOn is that loop's id, and ui.loopIdx follows
// it, so the middle pane shows that loop and every loop key works as on the loop's own row.

import { state } from '../model/store.js';
import { isWaiting, timeOf } from '../model/markers.js';
import { doable, openTasks, checkDue, dueSince } from '../model/queries.js';
import { ui, loopsList, tasksOf, VIRTUAL } from './view.js';

// the first thing you can do now, going down your loops: timed tasks don't count, they
// belong to the clock (and show in Now when it's time)
export const firstTaskOf = loop => doable(state, loop.id).find(t => timeOf(t) === null) || null;
export const firstDoable = () => state.loops.find(firstTaskOf) || null;

// per loop with waits due for a look, in loop order (the Inbox last)
export function checksByLoop(nowMs = Date.now()) {
  if (ui.templates) return [];
  const list = [...state.loops, ...VIRTUAL.filter(v => v.kind === 'inbox')];
  return list.map(loop => {
    const waits = openTasks(state, loop.id).filter(isWaiting);
    const due = waits.filter(t => checkDue(t, nowMs));
    const oldest = Math.min(...due.map(t => dueSince(t, nowMs)));
    return { loop, waits: waits.length, due: due.length, oldest };
  }).filter(c => c.due);
}

// ── The cursor on a Check row ─────────────────────────────────────────────────

export function onCheck(loopId) {
  ui.checkOn = loopId;
  ui.loopIdx = loopsList().findIndex(l => l.id === loopId);
  ui.focus = 'loops';
  ui.taskIdx = 0;
}

// a Check row goes away once its loop is checked (or after a while, when it isn't due anymore)
export function syncCheck() {
  if (ui.checkOn !== null && !checksByLoop().some(c => c.loop.id === ui.checkOn)) ui.checkOn = null;
}

// j / k: the Check rows sit above the first loop row
export function moveAcrossChecks(delta) {
  if (ui.focus !== 'loops') return false;
  const checks = checksByLoop();
  const i = checks.findIndex(c => c.loop.id === ui.checkOn);
  if (i >= 0) {
    if (i + delta >= checks.length) Object.assign(ui, { checkOn: null, loopIdx: 0 });
    else if (i + delta >= 0) onCheck(checks[i + delta].loop.id);
    return true;
  }
  if (delta < 0 && ui.loopIdx === 0 && checks.length) {
    onCheck(checks.at(-1).loop.id);
    return true;
  }
  return false;
}

// g: the first Check row, if there is one
export function jumpToChecks() {
  const checks = checksByLoop();
  if (!checks.length) return false;
  onCheck(checks[0].loop.id);
  return true;
}

// l / enter on a Check row: into the loop, on its first wait that is due
export function openCheck() {
  if (ui.checkOn === null) return false;
  const due = tasksOf(loopsList()[ui.loopIdx]).findIndex(t => checkDue(t));
  Object.assign(ui, { checkOn: null, focus: 'tasks', taskIdx: Math.max(0, due) });
  return true;
}

// after . on a Check row: on to the next one, or to the green loop when they're all done
export function afterCheck(before) {
  const left = checksByLoop().map(c => c.loop.id);
  const next = before.slice(before.indexOf(ui.checkOn) + 1).find(id => left.includes(id)) ?? left[0];
  if (next !== undefined) return onCheck(next);
  ui.checkOn = null;
  const green = firstDoable();
  if (green) Object.assign(ui, { loopIdx: loopsList().indexOf(green), focus: 'loops', taskIdx: 0 });
}

// ── ] / [ ─────────────────────────────────────────────────────────────────────
// the stops are the Check rows, then the green loop

export function nextAttention(dir) {
  const green = firstDoable();
  const stops = [...checksByLoop().map(c => ({ check: c.loop.id })), ...(green ? [{ loop: green }] : [])];
  if (!stops.length) {
    ui.flash = { text: 'nothing needs you right now' };
    return;
  }
  const here = ui.checkOn !== null ? stops.findIndex(s => s.check === ui.checkOn)
    : green && loopsList()[ui.loopIdx] === green ? stops.length - 1 : -1;
  const to = stops[here < 0 ? (dir > 0 ? 0 : stops.length - 1) : (here + dir + stops.length) % stops.length];
  if (to.check !== undefined) onCheck(to.check);
  else Object.assign(ui, { checkOn: null, loopIdx: loopsList().indexOf(to.loop), focus: 'loops', taskIdx: 0 });
}
