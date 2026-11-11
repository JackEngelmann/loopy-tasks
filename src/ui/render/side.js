// Right column (read-only): important, waiting and timed tasks across all loops.
// On narrow windows it folds into a one-line summary; s shows it as an overlay.

import { state } from '../../model/store.js';
import { importantTasks, waitingTasks, timedTasks } from '../../model/queries.js';
import { timeOf, fmtTime, nowMinutes, displayTitle } from '../../model/markers.js';
import { ui, currentLoop } from '../view.js';
import { taskRow } from './rows.js';
import { esc } from '../../util.js';

export function renderSide() {
  renderPanel('important', importantTasks(state.tasks), 'Nothing important. Press i on a task.');
  renderPanel('waiting', waitingTasks(state.tasks), 'Nothing waiting.');
  renderPanel('timed', timedTasks(state.tasks), 'Nothing timed. Put a time like 14:30 in a task.');
  renderSummary();
}

function renderPanel(id, ts, emptyMsg) {
  const loop = currentLoop();
  const rows = ts.map((t, i) => taskRow(t, i, {
    showTag: true,
    other: !ui.templates && loop.id !== null && t.loopId !== loop.id,
  }));
  if (!rows.length) rows.push(`<li class="empty">${emptyMsg}</li>`);
  document.getElementById(id).innerHTML = rows.join('');
  document.getElementById(id + 'Meta').textContent = panelMeta(ts, loop);
}

function panelMeta(ts, loop) {
  if (!ts.length) return '';
  if (loop.id === null || ui.templates) return `${ts.length}`;
  return `${ts.filter(t => t.loopId === loop.id).length} here · ${ts.length} total`;
}

function renderSummary() {
  const now = nowMinutes();
  const imp = importantTasks(state.tasks).length;
  const wait = waitingTasks(state.tasks).length;
  const timed = timedTasks(state.tasks);
  const due = timed.filter(t => timeOf(t) <= now).length;
  const upcoming = timed.find(t => timeOf(t) > now);
  const parts = [
    imp && `<span><span class="star">★</span> ${imp} important</span>`,
    wait && `<span class="wait">◷ ${wait} waiting</span>`,
    due && `<span class="due">${due} due</span>`,
    upcoming && `<span>next <span class="time">${fmtTime(timeOf(upcoming))}</span> ${esc(displayTitle(upcoming))}</span>`,
  ].filter(Boolean);
  document.getElementById('summary').innerHTML = (parts.length ? parts.join('') : '<span>nothing important, waiting or timed</span>')
    + `<span class="hint">s ${ui.sideOpen ? 'hide' : 'details'}</span>`;
  document.body.classList.toggle('side-open', ui.sideOpen);
}
