// T switches the panes between your loops and the templates; each side keeps its cursor.
// t (outside template mode) picks a template and copies it into a new loop.

import { state, mutate } from '../model/store.js';
import { ui, enter, leave, onVirtual } from '../ui/view.js';
import { esc, uid } from '../util.js';

export function toggleTemplates() {
  const here = { focus: ui.focus, loopIdx: ui.loopIdx, taskIdx: ui.taskIdx };
  Object.assign(ui, ui.otherCursor || { focus: 'loops', loopIdx: 0, taskIdx: 0 });
  ui.otherCursor = here;
  ui.templates = !ui.templates;
  ui.search = null;
  ui.cutId = null;   // a cut task can't be pasted across modes
}

export function openPicker() {
  if (ui.templates) return;
  if (!state.templates.loops.length) {
    ui.flash = { text: 'no templates yet — press T to create one' };
    return;
  }
  enter('picker', { picker: { idx: 0 } });
}

export function pickerMove(delta) {
  const n = state.templates.loops.length;
  ui.picker.idx = Math.max(0, Math.min(n - 1, ui.picker.idx + delta));
}

export function pickerChoose() {
  const tpl = state.templates.loops[ui.picker.idx];
  leave();
  createFromTemplate(tpl);
}

// a new copy every time, placed below the selected loop (after the last one when on All or the Inbox)
function createFromTemplate(tpl) {
  const at = onVirtual() ? state.loops.length : ui.loopIdx + 1;
  const loop = { id: uid(), title: tpl.title, createdAt: Date.now() };
  mutate(() => {
    state.loops.splice(at, 0, loop);
    state.templates.tasks
      .filter(t => t.loopId === tpl.id && !t.done)
      .forEach(t => state.tasks.push({ id: uid(), title: t.title, loopId: loop.id, done: false, createdAt: Date.now() }));
  });
  Object.assign(ui, { loopIdx: at, taskIdx: 0, focus: 'tasks' });
  ui.flash = { text: `created "${tpl.title}" from template` };
}

export function renderPicker() {
  const box = document.getElementById('picker');
  box.hidden = ui.mode !== 'picker';
  if (box.hidden) return;
  document.getElementById('pickerList').innerHTML = state.templates.loops.map((l, i) => {
    const n = state.templates.tasks.filter(t => t.loopId === l.id).length;
    return `<li class="row${i === ui.picker.idx ? ' sel' : ''}"><span class="name">${esc(l.title)}</span><span class="count">${n}</span></li>`;
  }).join('');
}
