// Insert mode: the one-line input that o, O and r open in a row. Enter saves, esc cancels.

import { mutate } from '../model/store.js';
import { resolveRelative } from '../model/markers.js';
import { ui, leave, db, virtuals, currentLoop, currentTasks, loopById, itemById } from './view.js';
import { render } from './render/index.js';
import { esc, uid } from '../util.js';

export function editInput(value) {
  return `<input class="edit" value="${esc(value)}" autocomplete="off" spellcheck="false">`;
}

function commitEdit(value) {
  const ed = ui.editing;
  leave();
  value = value.trim();
  if (!value) return render();
  // relative times only mean something for real tasks; a template has no "now"
  const isTask = ed.kind === 'new-task' || (ed.kind === 'rename' && !loopById(ed.id));
  if (isTask && !ui.templates) value = resolveRelative(value);

  if (ed.kind === 'new-loop') {
    mutate(() => db().loops.splice(ed.at, 0, { id: uid(), title: value, createdAt: Date.now() }));
    ui.loopIdx = virtuals().length + ed.at;
  } else if (ed.kind === 'new-task') {
    const task = { id: uid(), title: value, loopId: currentLoop().id, done: false, createdAt: Date.now() };
    mutate(() => {
      // insert next to the task the cursor was on, or at the end if there was none
      const tasks = db().tasks;
      const anchor = tasks.findIndex(t => t.id === ed.anchorId);
      if (anchor < 0) tasks.push(task);
      else tasks.splice(anchor + (ed.below ? 1 : 0), 0, task);
    });
    ui.focus = 'tasks';
    ui.taskIdx = currentTasks().indexOf(task);
  } else if (ed.kind === 'rename') {
    const item = itemById(ed.id);
    if (item) mutate(() => { item.title = value; });
  }
  render();
}

function cancelEdit() {
  leave();
  render();
}

// the input is re-created on every render, so listen on the document
document.addEventListener('keydown', e => {
  if (!e.target.classList.contains('edit')) return;
  e.stopPropagation();
  if (e.key === 'Enter') commitEdit(e.target.value);
  else if (e.key === 'Escape') cancelEdit();
}, true);

document.addEventListener('focusout', e => {
  if (e.target.classList.contains('edit') && ui.mode === 'insert') cancelEdit();
});

// focus the input after a render put it in place
export function focusInlineEdit() {
  const inp = document.querySelector('.edit');
  if (!inp) return;
  inp.focus();
  inp.setSelectionRange(inp.value.length, inp.value.length);
}
