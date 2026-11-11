// Header breadcrumb and the status bar: mode, clipboard, flash and the key hints.

import { displayTitle } from '../../model/markers.js';
import { ui, PANES, db, currentLoop, selTask } from '../view.js';
import { hintsFor } from '../commands.js';
import { vim } from '../../editor/modal.js';
import { esc } from '../../util.js';

// the modal editor has its own vim modes, each with its own hints
const hintMode = () => ui.mode !== 'modal' ? ui.mode
  : vim.cmd !== null ? 'vim-command' : `vim-${vim.mode}`;

function modeLabel() {
  if (ui.mode === 'modal') {
    return `${ui.editing.kind === 'note' ? 'NOTE' : 'RENAME'} ${vim.cmd !== null ? 'COMMAND' : vim.mode.toUpperCase()}`;
  }
  return { insert: 'INSERT', search: 'SEARCH', picker: 'TEMPLATE' }[ui.mode] || ui.focus.toUpperCase();
}

export function renderChrome() {
  PANES.forEach(p => document.getElementById(p + 'Pane').classList.toggle('focused', ui.focus === p));
  document.body.classList.toggle('template-mode', ui.templates);

  const loop = currentLoop();
  const task = selTask();
  document.getElementById('crumb').innerHTML =
    `${ui.templates ? 'templates' : 'loops'} / <b>${esc(loop.title)}</b>` + (task ? ` / ${esc(displayTitle(task))}` : '');

  const cut = db().tasks.find(t => t.id === ui.cutId);
  document.getElementById('mode').textContent = modeLabel();
  document.getElementById('tplBadge').hidden = !ui.templates;
  document.getElementById('clip').textContent = cut ? `cut: ${displayTitle(cut)}` : '';
  const flash = document.getElementById('flash');
  flash.textContent = ui.flash ? ui.flash.text : '';
  flash.classList.toggle('error', !!(ui.flash && ui.flash.error));
  document.getElementById('hints').innerHTML =
    hintsFor(hintMode(), { pane: ui.focus, templates: ui.templates, kind: ui.editing && ui.editing.kind });
}
