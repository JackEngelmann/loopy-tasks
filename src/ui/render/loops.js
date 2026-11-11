// Left pane: All and Standalone, then the loops (or the templates in template mode).

import { openTasks, nextOf, loopStatus } from '../../model/queries.js';
import { isWaiting, isImportant, displayTitle } from '../../model/markers.js';
import { ui, db, virtuals, tasksOf, VIRTUAL } from '../view.js';
import { highlight } from '../../features/search.js';
import { editInput } from '../inline-edit.js';
import { noteLine } from './rows.js';
import { esc } from '../../util.js';

export function renderLoops() {
  const d = db();
  const ed = ui.mode === 'insert' ? ui.editing : null;
  const sel = i => i === ui.loopIdx && !(ed && ed.kind === 'new-loop');

  const rows = virtuals().map((l, i) => {
    const ts = tasksOf(l);
    const cls = ['row', 'virtual', `virtual-${l.kind}`, l.kind === 'standalone' && 'loop', sel(i) && 'sel',
      i === VIRTUAL.length - 1 && 'gap-after'].filter(Boolean).join(' ');
    const name = `<span class="name">${highlight(l.title, 'loops')}</span><span class="count">${ts.length}</span>`;
    if (l.kind !== 'standalone') return `<li class="${cls}" data-i="${i}">${name}</li>`;
    // like a loop: the first standalone task and how many follow
    const first = ts[0];
    return `<li class="${cls}" data-i="${i}">
      <div class="loop-line">${name}</div>
      <div class="loop-next"><span class="name">${first ? `▸ ${esc(displayTitle(first))}` : 'No standalone tasks'}</span></div>
    </li>`;
  });

  d.loops.forEach((l, j) => {
    const i = virtuals().length + j;
    const open = openTasks(d, l.id);
    const next = nextOf(d, l.id);
    const status = loopStatus(d, l);
    // waiting count, then all open tasks (like All and Standalone)
    const waiting = open.filter(isWaiting).length;
    const counts = waiting ? `◷ ${waiting}` : '';
    const nextLine = next ? `▸ ${esc(displayTitle(next))}`
      : ui.templates ? 'Empty template'
      : status === 'waiting' ? 'Waiting on something'
      : 'No next action';
    // templates never go yellow/teal: they aren't work in progress
    const cls = ['row', 'loop', sel(i) && 'sel',
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
  if (ed && ed.kind === 'new-loop') rows.splice(virtuals().length + ed.at, 0, `<li class="row sel">${editInput('')}</li>`);
  if (!rows.length) rows.push(`<li class="empty">No templates yet. Press o to create one.</li>`);
  document.getElementById('loops').innerHTML = rows.join('');
  document.getElementById('loopsTitle').textContent = ui.templates ? 'Templates' : 'Loops';
}
