// Entry point: load the data, wire up keys and mouse, start the timers.

import { state, load } from './model/store.js';
import { ui, narrow, isEditing } from './ui/view.js';
import { commandFor } from './ui/commands.js';
import { toggleSide } from './ui/actions.js';
import { render } from './ui/render/index.js';
import { checkReminders } from './features/reminders.js';
import { seed } from './features/seed.js';
import './features/io.js';
import { initSplitter } from './ui/splitter.js';
import { loadView, outlineItems, outlineSelect } from './ui/views.js';

// ── Keys ──────────────────────────────────────────────────────────────────────
// normal and picker mode keys come from the command table; the typing modes
// (inline input, search, modal editor) handle keys in their own elements.

document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (!['normal', 'picker', 'todoist', 'help'].includes(ui.mode)) return;
  const run = commandFor(ui.mode, e.key);
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
  // view i: the outline's rows, loops and tasks alike
  const item = e.target.closest('.row[data-oi]');
  if (item) { outlineSelect(outlineItems()[+item.dataset.oi]); render(); return; }
  const row = e.target.closest('.row[data-i]');
  if (!row) return;
  if (+row.dataset.i !== ui.loopIdx) ui.taskIdx = 0;
  ui.loopIdx = +row.dataset.i;
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

document.getElementById('summary').addEventListener('click', () => { toggleSide(); render(); });
// widening the window brings the column back in place, so drop the overlay state
narrow.addEventListener('change', () => { ui.sideOpen = false; render(); });

// ── Init ──────────────────────────────────────────────────────────────────────

load();
loadView();
if (!state.loops.length && !state.tasks.length) seed();
initSplitter();
render();

// keep "due" highlighting and ages current; skip while typing so the input isn't reset
setInterval(() => { if (!isEditing()) render(); }, 60_000);
checkReminders();
setInterval(checkReminders, 15_000);
