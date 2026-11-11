// Left pane: All, then the loops (or the templates in template mode).

import { state } from '../../model/store.js';
import { openTasks, doable, nextOf, loopStatus } from '../../model/queries.js';
import { isWaiting, isImportant, displayTitle } from '../../model/markers.js';
import { ui, db, virtuals, VIRTUAL } from '../view.js';
import { highlight } from '../../features/search.js';
import { editInput } from '../inline-edit.js';
import { noteLine } from './rows.js';
import { esc } from '../../util.js';

export function renderLoops() {
  const d = db();
  const ed = ui.mode === 'insert' ? ui.editing : null;
  const sel = i => i === ui.loopIdx && !(ed && ed.kind === 'new-loop');

  const rows = virtuals().map((l, i) => {
    const n = openTasks(d, null).length;
    const cls = ['row', 'virtual', `virtual-${l.kind}`, sel(i) && 'sel', i === VIRTUAL.length - 1 && 'gap-after']
      .filter(Boolean).join(' ');
    return `<li class="${cls}" data-i="${i}"><span class="name">${highlight(l.title, 'loops')}</span><span class="count">${n}</span></li>`;
  });

  d.loops.forEach((l, j) => {
    const i = virtuals().length + j;
    const open = openTasks(d, l.id);
    const next = nextOf(d, l.id);
    const status = loopStatus(d, l);
    // waiting count by the title; "+N" = doable tasks queued after the next action
    const waiting = open.filter(isWaiting).length;
    const more = Math.max(0, doable(d, l.id).length - 1);
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
      <div class="loop-line">${name}${star}<span class="counts">${counts}</span></div>
      <div class="loop-next"><span class="name">${nextLine}</span>${more ? `<span class="counts">+${more}</span>` : ''}</div>
      ${noteLine(l, 'loop-note')}
    </li>`);
  });
  if (ed && ed.kind === 'new-loop') rows.splice(virtuals().length + ed.at, 0, `<li class="row sel">${editInput('')}</li>`);
  if (!rows.length) rows.push(`<li class="empty">No templates yet. Press o to create one.</li>`);
  document.getElementById('loops').innerHTML = rows.join('');
  document.getElementById('loopsTitle').textContent = ui.templates ? 'Templates' : 'Loops';

  const stale = state.loops.filter(l => loopStatus(state, l) === 'stale').length;
  const waiting = state.loops.filter(l => loopStatus(state, l) === 'waiting').length;
  document.getElementById('loopsMeta').textContent = ui.templates
    ? `${state.templates.loops.length}`
    : [stale && `! ${stale}`, waiting && `◷ ${waiting}`].filter(Boolean).join('  ');
}
