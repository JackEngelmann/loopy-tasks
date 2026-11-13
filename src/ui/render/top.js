// The top of the loops pane: Now (its time has come), today's remaining times, and the
// Check rows (one per loop with waits due for a look). Not in template mode.

import { state } from '../../model/store.js';
import { attention, timedTasks } from '../../model/queries.js';
import { isWaiting, timeOf, fmtTime, nowMinutes, displayTitle } from '../../model/markers.js';
import { ui, loopById } from '../view.js';
import { checksByLoop } from '../attention.js';
import { taskRow } from './rows.js';
import { setTitleCount } from '../../features/reminders.js';
import { esc, age, duration } from '../../util.js';

export function topBlock() {
  if (ui.templates) return '';
  const now = nowMinutes();
  const rows = [];
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
  const ahead = timedTasks(state.tasks).filter(t => timeOf(t) > now);
  if (ahead.length) {
    rows.push(`<li class="timeline"><span class="label">Today</span>${ahead.map(t =>
      `<span><span class="time">${fmtTime(timeOf(t))}</span> ${isWaiting(t) ? '◷ ' : ''}${esc(displayTitle(t))}</span>`).join('')}</li>`);
  }
  rows.push(checkBlock());
  if (rows.some(Boolean)) rows.push('<li class="divider">Loops</li>');
  return rows.join('');
}

// in loop order; the cursor can stand on them (ui.checkOn, see attention.js)
function checkBlock() {
  const checks = checksByLoop();
  if (!checks.length) return '';
  const cursor = ui.focus === 'loops' && ui.mode !== 'insert';
  return '<li class="tier check">Check</li>' + checks.map(c => {
    const of = c.waits > 1 ? `${c.due} of ${c.waits}` : '1';
    const sel = cursor && ui.checkOn === c.loop.id ? ' sel' : '';
    return `<li class="row check-row${sel}" data-check="${esc(c.loop.id)}"><span class="check">◷</span><span class="name">${esc(c.loop.title)}</span><span class="when">${of} · ${c.due > 1 ? 'oldest ' : ''}${age(c.oldest)}</span></li>`;
  }).join('');
}

// the header badge and the tab title count what's in Now
export function renderNowBadge() {
  const n = attention(state, nowMinutes()).now.length;
  const badge = document.getElementById('nowBadge');
  badge.hidden = !n;
  badge.textContent = `! ${n}`;
  setTitleCount(n);
}
