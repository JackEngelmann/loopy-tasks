// Right column (read-only): what needs you today, most urgent first — see attention()
// in model/queries.js. On narrow windows it folds into one line above the panes:
// a yellow strip while something is due now or soon, a quiet line otherwise.

import { state } from '../../model/store.js';
import { attention, timedTasks } from '../../model/queries.js';
import { isWaiting, timeOf, fmtTime, nowMinutes, displayTitle } from '../../model/markers.js';
import { ui, loopById } from '../view.js';
import { taskRow } from './rows.js';
import { setTitleCount } from '../../features/reminders.js';
import { esc, age, duration } from '../../util.js';

// more Later items than this fold into compact lines
const LATER_ROWS = 3;

export function renderToday() {
  const now = nowMinutes();
  const g = attention(state, now);
  const rows = [];
  const tier = (cls, title, n) => rows.push(`<li class="tier ${cls}"><span>${title}</span><span>${n}</span></li>`);
  // line 1: time and title; line 2: the loop and how late / when / how long waiting
  const row = (t, when, cls) => {
    const loop = loopById(t.loopId);
    const below = [loop && esc(loop.title), when].filter(Boolean).join(' · ');
    rows.push(taskRow(t, -1, { below, cls }));
  };

  if (g.now.length) {
    tier('now', 'Now', g.now.length);
    g.now.forEach(t => row(t, `${duration(now - timeOf(t))} late`));
  }
  if (g.soon.length) {
    tier('soon', 'Soon', g.soon.length);
    g.soon.forEach(t => {
      const inMin = `in ${duration(timeOf(t) - now)}`;
      row(t, isWaiting(t) ? `check back ${inMin}` : inMin, 'soon-row');
    });
  }
  if (!g.now.length && !g.soon.length) {
    const next = g.later.find(t => timeOf(t) !== null);
    rows.push(`<li class="calm">Nothing needs you right now.${next
      ? `<br>Next: <b><span class="time">${fmtTime(timeOf(next))}</span> ${esc(displayTitle(next))}</b> in ${duration(timeOf(next) - now)}`
      : ''}</li>`);
  }
  if (g.important.length) {
    tier('important', 'Important', g.important.length);
    g.important.forEach(t => row(t, waitedFor(t)));
  }
  if (g.later.length) {
    tier('later', 'Later', g.later.length);
    if (g.later.length <= LATER_ROWS) g.later.forEach(t => row(t, waitedFor(t), 'quiet'));
    else rows.push(`<li class="compact">${g.later.map(compact).join(' · ')}</li>`);
  }
  if (g.plan.length) {
    tier('plan', 'Plan', g.plan.length);
    g.plan.forEach(l => rows.push(`<li class="plan-line">${esc(l.title)} has no next action</li>`));
  }

  document.getElementById('today').innerHTML = rows.join('');
  document.getElementById('todayClock').textContent = fmtTime(now);
  const badge = document.getElementById('nowBadge');
  badge.hidden = !g.now.length;
  badge.textContent = `! ${g.now.length}`;
  setTitleCount(g.now.length);
  renderSummary(g, now);
}

function waitedFor(t) {
  if (!t.waitingSince) return '';
  const a = age(t.waitingSince);
  return a === 'now' ? 'just started waiting' : `waiting ${a}`;
}

// one item of a folded Later list: "14:00 Design review" or "◷ Agent: audit (2h)"
function compact(t) {
  const time = timeOf(t);
  return time !== null
    ? `${isWaiting(t) ? '◷ ' : ''}${fmtTime(time)} ${esc(displayTitle(t))}`
    : `◷ ${esc(displayTitle(t))}`;
}

// narrow windows: the strip (something due now or soon) or a quiet line
function renderSummary(g, now) {
  const el = document.getElementById('summary');
  const urgent = g.now.length + g.soon.length > 0;
  const hint = `<span class="hint">s ${ui.sideOpen ? 'hide' : 'details'}</span>`;
  const item = (t, cls, label) =>
    `<span class="${cls}">${cls === 'now' ? '! ' : isWaiting(t) ? '◷ ' : ''}<span class="time">${fmtTime(timeOf(t))}</span> ${esc(displayTitle(t))} · ${label}</span>`;
  if (urgent) {
    el.innerHTML = [
      ...g.now.map(t => item(t, 'now', `${duration(now - timeOf(t))} late`)),
      ...g.soon.map(t => item(t, 'soon', `in ${duration(timeOf(t) - now)}`)),
    ].join('') + hint;
  } else {
    const next = timedTasks(state.tasks).find(t => timeOf(t) > now);
    const waiting = state.tasks.filter(t => !t.done && isWaiting(t)).length;
    el.innerHTML = [
      `<span>nothing needs you${next ? ` · next <span class="time">${fmtTime(timeOf(next))}</span> ${esc(displayTitle(next))}` : ''}</span>`,
      g.important.length && `<span><span class="star">★</span> ${g.important.length}</span>`,
      waiting && `<span class="wait">◷ ${waiting}</span>`,
    ].filter(Boolean).join('') + hint;
  }
  el.classList.toggle('urgent', urgent);
  document.body.classList.toggle('side-open', ui.sideOpen);
}
