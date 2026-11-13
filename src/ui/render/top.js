// The top of the loops pane: Doing (what's in progress), Now (its time has come), today's
// remaining times, and Check (the waits due for a look). Not in template mode.

import { state } from '../../model/store.js';
import { attention, timedTasks, inProgress, dueSince } from '../../model/queries.js';
import { isWaiting, timeOf, fmtTime, nowMinutes, displayTitle } from '../../model/markers.js';
import { ui, loopById } from '../view.js';
import { checkTasks } from '../attention.js';
import { taskRow } from './rows.js';
import { setTitleCount } from '../../features/reminders.js';
import { esc, age, duration } from '../../util.js';

export function topBlock() {
  if (ui.templates) return '';
  const now = nowMinutes();
  const rows = [doingBlock()];
  const due = attention(state, now).now;
  if (due.length) {
    rows.push('<li class="tier now">Now</li>');
    due.forEach(t => {
      const loop = loopById(t.loopId);
      const below = [loop && esc(loop.title), `<span class="when">${duration(now - timeOf(t))} late</span>`].filter(Boolean).join(' · ');
      // not a loop row: no data-i, so a click doesn't select a loop
      rows.push(taskRow(t, -1, { below, cls: 'top-row' }).replace(' data-i="-1"', ''));
    });
  }
  // appointments only: a wait's time is when to look next, and shows in Check when it comes
  const ahead = timedTasks(state.tasks).filter(t => timeOf(t) > now && !isWaiting(t));
  if (ahead.length) {
    rows.push(`<li class="timeline"><span class="label">Today</span>${ahead.map(t =>
      `<span><span class="time">${fmtTime(timeOf(t))}</span> ${esc(displayTitle(t))}</span>`).join('')}</li>`);
  }
  rows.push(checkBlock());
  if (rows.some(Boolean)) rows.push('<li class="divider">Loops</li>');
  return rows.join('');
}

const cursorOn = (kind, id) => ui.focus === 'loops' && ui.mode !== 'insert' && ui.topOn && ui.topOn.kind === kind && ui.topOn.id === id;

// what you're working on, longest first, with its loop and how long; the cursor can stand on them
function doingBlock() {
  const doing = inProgress(state);
  if (!doing.length) return '';
  return '<li class="tier doing">Doing</li>' + doing.map(t => taskRow(t, -1, {
    selected: cursorOn('doing', t.id), showTag: true, label: age(t.progressSince), cls: 'top-row', editAs: 'doing',
  }).replace(' data-i="-1"', ` data-doing="${esc(t.id)}"`)).join('');
}

// the waits due for a look, in loop order, with their loop and since when; the cursor can
// stand on them (ui.topOn, see attention.js)
function checkBlock() {
  const due = checkTasks();
  if (!due.length) return '';
  return '<li class="tier check">Check</li>' + due.map(t => taskRow(t, -1, {
    selected: cursorOn('check', t.id), showTag: true, label: age(dueSince(t)), cls: 'top-row check-row', editAs: 'check',
  }).replace(' data-i="-1"', ` data-check="${esc(t.id)}"`)).join('');
}

// the tab title counts what's in Now, for when the tab is in the background
export function renderTitleCount() {
  setTitleCount(attention(state, nowMinutes()).now.length);
}
