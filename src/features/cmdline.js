// ":" in normal mode: a small command line in the status bar for things that don't
// need a key of their own. Enter runs, esc cancels.

import { ui, enter, leave } from '../ui/view.js';
import { render } from '../ui/render/index.js';
import { exportData, chooseImportFile } from './io.js';
import { openTodoist, park } from './todoist.js';
import { setView } from '../ui/views.js';

const input = document.getElementById('cmdInput');

// ":name rest" calls COMMANDS[name](rest)
const COMMANDS = {
  export: exportData,
  import: chooseImportFile,
  pick: openTodoist,   // :pick [Todoist filter]
  view: setView,       // :view g | i | classic
  park,
};

export function startCommand() {
  enter('command');
  input.value = '';
}

function run(line) {
  leave();
  input.blur();
  const [, name, arg] = line.match(/^(\S*)\s*(.*)$/);
  if (COMMANDS[name]) COMMANDS[name](arg);
  else if (name) ui.flash = { text: `not a command: ${name} (try :pick, :park, :export or :import)`, error: true };
  render();
}

input.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter') { e.preventDefault(); run(input.value.trim()); }
  else if (e.key === 'Escape' || (e.key === 'Backspace' && !input.value)) { e.preventDefault(); run(''); }
});

input.addEventListener('blur', () => {
  if (ui.mode === 'command') run('');
});

export function renderCmdBox() {
  const open = ui.mode === 'command';
  document.getElementById('cmdBox').hidden = !open;
  if (open && document.activeElement !== input) input.focus();
}
