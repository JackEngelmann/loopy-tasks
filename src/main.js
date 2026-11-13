// Entry point: load the data, wire up keys and mouse, start the timers.

import { state, load } from './model/store.js';
import { ui, isEditing } from './ui/view.js';
import { commandFor } from './ui/commands.js';
import { render } from './ui/render/index.js';
import { checkReminders } from './features/reminders.js';
import { seed } from './features/seed.js';
import './features/io.js';
import { initSplitter } from './ui/splitter.js';
import { isShortcut } from './util.js';
import { onTop, topStops } from './ui/attention.js';
import { loadCheckEvery } from './features/check-every.js';

// ── Keys ──────────────────────────────────────────────────────────────────────
// normal and picker mode keys come from the command table; the typing modes
// (inline input, search, modal editor) handle keys in their own elements.

// ctrl+key reaches the command table as "C-key" (ctrl+. sets the next check); unbound ones,
// and other shortcuts, stay with the browser
document.addEventListener('keydown', e => {
  const key = !isShortcut(e) ? e.key : e.ctrlKey && !e.metaKey && !e.altKey ? `C-${e.key}` : null;
  if (key === null) return;
  if (!['normal', 'picker', 'todoist', 'help'].includes(ui.mode)) return;
  const run = commandFor(ui.mode, key);
  if (!run && key.startsWith('C-')) return;
  if (ui.mode !== 'normal') e.preventDefault();   // the pickers and the help take every key while open
  if (!run) return;
  e.preventDefault();
  if (ui.mode === 'normal') ui.flash = null;
  run();
  render();
});

// ── Mouse ─────────────────────────────────────────────────────────────────────

document.getElementById('loops').addEventListener('click', e => {
  if (isEditing()) return;
  // the rows on top: Doing (a task) and Check (a loop)
  const top = e.target.closest('[data-doing], [data-check]');
  if (top) {
    const id = top.dataset.doing ?? top.dataset.check;
    const stop = topStops().find(s => s.id === id && s.kind === (top.dataset.doing ? 'doing' : 'check'));
    if (stop) onTop(stop);
    render();
    return;
  }
  const row = e.target.closest('.row[data-i]');
  if (!row) return;
  if (+row.dataset.i !== ui.loopIdx) ui.taskIdx = 0;
  ui.loopIdx = +row.dataset.i;
  ui.topOn = null;
  ui.focus = 'loops';
  render();
});

document.getElementById('tasks').addEventListener('click', e => {
  if (isEditing()) return;
  const row = e.target.closest('.row[data-i]');
  ui.focus = 'tasks';
  if (row) ui.taskIdx = +row.dataset.i;
  render();
});


// ── Init ──────────────────────────────────────────────────────────────────────

load();
loadCheckEvery();
if (!state.loops.length && !state.tasks.length) seed();
initSplitter();
render();

// keep "due" highlighting and ages current; skip while typing so the input isn't reset
setInterval(() => { if (!isEditing()) render(); }, 60_000);
checkReminders();
setInterval(checkReminders, 15_000);
