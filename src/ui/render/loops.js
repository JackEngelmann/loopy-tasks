// Left pane: Now, today's times and the Check rows on top (top.js), then your loops, most
// important first (or the templates in template mode), and All and the Inbox at the bottom.

import { openTasks, activeTasks, nextOf, loopStatus } from '../../model/queries.js';
import { isWaiting, isImportant, displayTitle, timeOf, fmtTime } from '../../model/markers.js';
import { ui, db, virtuals, tasksOf, singleTask } from '../view.js';
import { firstDoable, firstTaskOf } from '../attention.js';
import { topBlock } from './top.js';
import { highlight } from '../../features/search.js';
import { editInput } from '../inline-edit.js';
import { noteLine } from './rows.js';
import { esc } from '../../util.js';

export function renderLoops() {
  const d = db();
  // the first loop you can do something in is green
  const first = ui.templates ? null : firstDoable();
  const ed = ui.mode === 'insert' ? ui.editing : null;
  const adding = ed && (ed.kind === 'new-loop' || ed.kind === 'new-single');
  const sel = i => i === ui.loopIdx && !adding && ui.checkOn === null;   // else the cursor is on a Check row

  const rows = [];

  d.loops.forEach((l, j) => {
    const i = j;
    const single = singleTask(l);
    if (single) return rows.push(singleRow(l, single, i, sel(i), ed, l === first));
    const open = activeTasks(openTasks(d, l.id));
    const next = l === first ? firstTaskOf(l) : nextOf(d, l.id);   // green: the thing to do now
    const status = loopStatus(d, l);
    // waiting count, then all open tasks (like All and Standalone)
    const waiting = open.filter(isWaiting).length;
    const counts = waiting ? `◷ ${waiting}` : '';
    const nextLine = next ? `▸ ${esc(displayTitle(next))}`
      : ui.templates ? 'Empty template'
      : status === 'waiting' ? 'Waiting on something'
      : openTasks(d, l.id).length ? 'Only not-now tasks'
      : 'No next action';
    // templates never go yellow/teal: they aren't work in progress
    const cls = ['row', 'loop', sel(i) && 'sel', l === first && 'first',
      !ui.templates && status === 'stale' && 'stale',
      !ui.templates && status === 'waiting' && 'waiting-loop'].filter(Boolean).join(' ');
    const name = ed && ed.kind === 'rename' && ed.id === l.id
      ? editInput(l.title)
      : `<span class="name">${highlight(l.title, 'loops')}</span>`;
    const star = open.some(isImportant) ? `<span class="star">★</span>` : '';
    rows.push(`<li class="${cls}" data-i="${i}">
      <div class="loop-line">${name}${star}<span class="counts">${counts}</span><span class="count">${open.length}</span></div>
      <div class="loop-next"><span class="name">${nextLine}</span></div>
      ${noteLine(l, 'loop-note')}
    </li>`);
  });
  if (adding) rows.splice(ed.at, 0, `<li class="row sel">${editInput('')}</li>`);
  const n = d.loops.length;
  const virtualRows = virtuals().map((l, k) => {
    const i = n + k;
    const ts = activeTasks(tasksOf(l));   // not-now tasks don't count
    const listed = l.kind === 'inbox';
    // anything in the Inbox still needs sorting
    const cls = ['row', 'virtual', `virtual-${l.kind}`, listed && 'loop', sel(i) && 'sel',
      l.kind === 'inbox' && ts.length && 'inbox-full'].filter(Boolean).join(' ');
    const name = `<span class="name">${highlight(l.title, 'loops')}</span><span class="count">${ts.length}</span>`;
    if (!listed) return `<li class="${cls}" data-i="${i}">${name}</li>`;
    // like a loop: the first task and how many follow
    const first = ts[0];
    const empty = 'Nothing to sort';
    return `<li class="${cls}" data-i="${i}">
      <div class="loop-line">${name}</div>
      <div class="loop-next"><span class="name">${first ? `▸ ${esc(displayTitle(first))}` : empty}</span></div>
    </li>`;
  });
  // All and the Inbox sit at the bottom of the pane: the filler takes the room in between
  if (virtualRows.length) rows.push('<li class="filler" aria-hidden="true"></li>', ...virtualRows);
  rows.unshift(topBlock());
  if (!rows.length) rows.push(`<li class="empty">No templates yet. Press o to create one.</li>`);
  document.getElementById('loops').innerHTML = rows.join('');
  document.getElementById('loopsTitle').textContent = ui.templates ? 'Templates' : 'Loops';
}

// a one-step loop is one line: its task, with the task's markers
function singleRow(l, t, i, selected, ed, isFirst) {
  const status = loopStatus(db(), l);
  const cls = ['row', 'loop', 'single', selected && 'sel', isFirst && 'first',
    status === 'stale' && 'stale', status === 'waiting' && 'waiting-loop'].filter(Boolean).join(' ');
  const time = timeOf(t);
  const name = ed && ed.kind === 'rename' && ed.id === t.id
    ? editInput(t.title)
    : `<span class="name">${highlight(displayTitle(t), 'loops')}</span>`;
  return `<li class="${cls}" data-i="${i}">
    <div class="loop-line"><span class="check">${isWaiting(t) ? '◷' : ''}</span>${isImportant(t) ? '<span class="star">★</span>' : ''}${time !== null ? `<span class="time">${fmtTime(time)}</span>` : ''}${name}</div>
    ${noteLine(t, 'loop-note')}
  </li>`;
}
