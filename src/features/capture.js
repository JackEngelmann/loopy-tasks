// c: put something in the Inbox from anywhere, without leaving what you're on.
// A one-line input in the status bar; enter adds it, esc cancels. Sorting comes later (x / p).

import { state, mutate } from '../model/store.js';
import { resolveRelative, displayTitle } from '../model/markers.js';
import { INBOX_ID } from '../model/queries.js';
import { ui, enter, leave } from '../ui/view.js';
import { render } from '../ui/render/index.js';
import { uid } from '../util.js';

const input = document.getElementById('captureInput');

export function startCapture() {
  if (ui.templates) return;
  enter('capture');
  input.value = '';
}

function finish(value) {
  leave();
  input.blur();
  value = value.trim();
  if (value) {
    const task = { id: uid(), title: resolveRelative(value), loopId: INBOX_ID, done: false, createdAt: Date.now() };
    mutate(() => state.tasks.push(task));
    ui.flash = { text: `in the Inbox: ${displayTitle(task)}` };
  }
  render();
}

input.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter') { e.preventDefault(); finish(input.value); }
  else if (e.key === 'Escape') { e.preventDefault(); finish(''); }
});

input.addEventListener('blur', () => {
  if (ui.mode === 'capture') finish('');
});

export function renderCaptureBox() {
  const open = ui.mode === 'capture';
  document.getElementById('captureBox').hidden = !open;
  if (open && document.activeElement !== input) input.focus();
}
