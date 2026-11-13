// The parts of the loops pane that the one-list views add (see ui/views.js): Now and
// today's times on top, G's Check block, and the outline that is the whole of view i.

import { state } from '../../model/store.js';
import { attention, timedTasks, openTasks, activeTasks, isNext, loopStatus, checkDue } from '../../model/queries.js';
import { isWaiting, isImportant, isNotNow, timeOf, fmtTime, nowMinutes, displayTitle } from '../../model/markers.js';
import { ui, loopById, singleTask } from '../view.js';
import { firstDoable, firstTaskOf, checksByLoop, outlineItems, outlinePos, isOpen } from '../views.js';
import { highlight } from '../../features/search.js';
import { editInput } from '../inline-edit.js';
import { taskRow, noteLine } from './rows.js';
import { esc, age, duration } from '../../util.js';

// Now (its time has come) and the times still ahead today, in one quiet line
export function topBlock() {
  const now = nowMinutes();
  const g = attention(state, now);
  const rows = [];
  if (g.now.length) {
    rows.push('<li class="tier now">Now</li>');
    g.now.forEach(t => {
      const loop = loopById(t.loopId);
      const below = [loop && esc(loop.title), `<span class="when">${duration(now - timeOf(t))} late</span>`].filter(Boolean).join(' · ');
      rows.push(taskRow(t, -1, { below, cls: 'top-row' }));
    });
  }
  const ahead = timedTasks(state.tasks).filter(t => timeOf(t) > now);
  if (ahead.length) {
    rows.push(`<li class="timeline"><span class="label">Today</span>${ahead.map(t =>
      `<span><span class="time">${fmtTime(timeOf(t))}</span> ${isWaiting(t) ? '◷ ' : ''}${esc(displayTitle(t))}</span>`).join('')}</li>`);
  }
  return rows.join('');
}

// G: one row per loop with waits due for a look, in loop order; a click selects the loop
export function checkBlock(loopIdxOf) {
  const checks = checksByLoop();
  if (!checks.length) return '';
  return '<li class="tier check">Check</li>' + checks.map(c => {
    const of = c.waits > 1 ? `${c.due} of ${c.waits}` : '1';
    return `<li class="row check-row" data-i="${loopIdxOf(c.loop)}"><span class="check">◷</span><span class="name">${esc(c.loop.title)}</span><span class="when">${of} · ${c.due > 1 ? 'oldest ' : ''}${age(c.oldest)}</span></li>`;
  }).join('');
}

// ── The outline (i) ───────────────────────────────────────────────────────────

export function renderOutline() {
  const items = outlineItems();
  const ed = ui.mode === 'insert' ? ui.editing : null;
  const adding = ed && ['new-loop', 'new-single', 'new-task'].includes(ed.kind);
  const pos = outlinePos(items);
  const first = firstDoable();
  const green = first && firstTaskOf(first);
  const input = indent => `<li class="row sel ol-row" style="--lvl:${indent}"><span class="fold"></span>${editInput('')}</li>`;

  const rows = [topBlock(), '<li class="divider">Loops</li>'];
  items.forEach((it, k) => {
    const selected = k === pos && !adding;
    const loopPos = state.loops.indexOf(it.loop);
    if (it.kind === 'loop') {
      // new loops go before the loop at their position, or after the last one
      if (ed && (ed.kind === 'new-loop' || ed.kind === 'new-single') && ed.at === loopPos) rows.push(input(0));
      if (ed && (ed.kind === 'new-loop' || ed.kind === 'new-single') && ed.at === state.loops.length && it.loop.kind === 'inbox') rows.push(input(0));
      rows.push(headerRow(it.loop, k, selected, ed, it.loop === first));
      if (selected && it.loop.note) rows.push(noteLine(it.loop, 'loop-note ol-note', true));
      // adding the first task of an empty loop
      if (ed && ed.kind === 'new-task' && it.loopIdx === ui.loopIdx && !openTasks(state, it.loop.id).length) rows.push(input(1));
      return;
    }
    const prev = items[k - 1];
    if (isNotNow(it.task) && !(prev.kind === 'task' && isNotNow(prev.task))) {
      const n = tasksOfLoop(it.loop).filter(isNotNow).length;
      rows.push(`<li class="tier not-now ol-tier">Not now <span class="count">${n}</span></li>`);
    }
    const mine = ed && ed.kind === 'new-task' && it.loopIdx === ui.loopIdx;
    if (mine && ed.at === it.taskIdx) rows.push(input(1));
    rows.push(taskRow(it.task, it.taskIdx, { selected, marks: true, notes: true, cls: 'ol-row' + (it.task === green ? ' first' : '') })
      .replace('data-i=', `style="--lvl:1" data-oi="${k}" data-ti=`));
    const last = !items[k + 1] || items[k + 1].kind === 'loop';
    if (mine && last && ed.at === it.taskIdx + 1) rows.push(input(1));
  });
  // no loops yet: the input goes at the top
  if (ed && (ed.kind === 'new-loop' || ed.kind === 'new-single') && !items.some(it => it.loop.kind === 'inbox')) rows.push(input(0));
  document.getElementById('loops').innerHTML = rows.join('');
  document.getElementById('loopsTitle').textContent = 'Loops';
}

const tasksOfLoop = loop => openTasks(state, loop.id);

// a loop as one line: fold mark, name, and what's going on in it
function headerRow(loop, k, selected, ed, isFirst) {
  const single = singleTask(loop);
  const open = isOpen(loop);
  const status = loop.kind ? 'ok' : loopStatus(state, loop);
  const tasks = activeTasks(tasksOfLoop(loop));
  const waits = tasks.filter(isWaiting);
  const due = waits.filter(t => checkDue(t)).length;
  const cls = ['row', 'ol-row', 'ol-loop', selected && 'sel', single && 'single',
    status === 'stale' && 'stale', status === 'waiting' && 'waiting-loop', due && 'has-check',
    loop.kind === 'inbox' && tasks.length && 'inbox-full', isFirst && single && 'first'].filter(Boolean).join(' ');

  const renaming = ed && ed.kind === 'rename' && (ed.id === loop.id || (single && ed.id === single.id));
  let name;
  if (renaming) name = editInput(single ? single.title : loop.title);
  else if (single) {
    const time = timeOf(single);
    name = `${isWaiting(single) ? '<span class="check">◷</span>' : ''}${isImportant(single) ? '<span class="star">★</span>' : ''}${time !== null ? `<span class="time">${fmtTime(time)}</span>` : ''}<span class="name">${highlight(displayTitle(single), 'loops')}</span>`;
  } else name = `<span class="name">${highlight(loop.title, 'loops')}</span>`;

  // folded loops say what's next; open ones only how many are waiting
  const next = tasks.find(t => isNext(state, t));
  const summary = single ? (isWaiting(single) && single.waitingSince ? `<span class="wait-age">${age(single.waitingSince)}</span>` : '')
    : [
      waits.length && `<span class="${due ? 'due-check' : 'wait-age'}">◷ ${waits.length}${due ? ` · ${due} to check` : ''}</span>`,
      !open && (next ? `<span class="ol-next">▸ ${esc(displayTitle(next))}</span>`
        : loop.kind === 'inbox' ? (tasks.length ? `<span class="ol-next">${tasks.length} to sort</span>` : '')
        : !tasks.length || !waits.length ? '<span class="ol-next">no next action</span>' : ''),
    ].filter(Boolean).join(' ');
  return `<li class="${cls}" style="--lvl:0" data-oi="${k}"><span class="fold">${single ? '' : open ? '▾' : '▸'}</span>${name}<span class="ol-summary">${summary}</span></li>`;
}
