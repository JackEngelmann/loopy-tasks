// Middle pane: the selected loop's note and open tasks.

import { ui, currentLoop, currentTasks } from '../view.js';
import { editInput } from '../inline-edit.js';
import { taskRow } from './rows.js';
import { isNotNow } from '../../model/markers.js';
import { esc, age } from '../../util.js';

export function renderTasks() {
  const loop = currentLoop();
  const adding = ui.mode === 'insert' && ui.editing.kind === 'new-task';
  const ts = currentTasks();
  const rows = ts.map((t, i) => taskRow(t, i, {
    selected: ui.focus === 'tasks' && i === ui.taskIdx && !adding,
    // the [loop] tag only adds information in the virtual views
    showTag: loop.kind === 'all',
    // highlight next actions (not in templates, and not in the side panels)
    marks: !ui.templates,
    notes: true,
  }));
  if (adding) rows.splice(ui.editing.at, 0, `<li class="row sel"><span class="check"></span>${editInput('')}</li>`);
  // the not-now tasks (last in the list) under a quiet heading
  const firstNotNow = ts.findIndex(isNotNow);
  if (firstNotNow >= 0) {
    const at = firstNotNow + (adding && ui.editing.at <= firstNotNow ? 1 : 0);
    rows.splice(at, 0, `<li class="tier not-now">Not now <span class="count">${ts.length - firstNotNow}</span></li>`);
  }
  if (!rows.length) {
    rows.push(
      loop.kind === 'none' ? `<li class="empty">Create a template in the left pane first.</li>`
      : ui.templates ? `<li class="empty">Empty template. Press o to add a task.</li>`
      : loop.kind === 'inbox' ? `<li class="empty">Nothing to sort. c captures from anywhere.</li>`
      : loop.id === null ? `<li class="empty">No tasks. Press o to add one.</li>`
      : `<li class="empty stale">No next action. Press o to add one.</li>`);
  }
  // the loop's note in full above its tasks (the left pane cuts it off)
  if (loop.note) rows.unshift(`<li class="note-block"><div class="clamp">✎ ${esc(loop.note)} <span class="note-age">· ${age(loop.noteAt)}</span></div>`
    + (loop.note.split('\n').length > 6 ? '<span class="note-age">m to see all</span>' : '') + '</li>');
  document.getElementById('tasks').innerHTML = rows.join('');

  document.getElementById('tasksTitle').textContent = loop.title;
}
