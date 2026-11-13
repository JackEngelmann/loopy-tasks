// ctrl+.: looked at a wait, and say when to look next ("1h", "20m", "14:30"). That becomes its
// check-back time, so it comes back to Check then instead of after the usual interval.
// On a loop's row it's all of that loop's waits, like . (see waitsHere() in actions.js).

import { parseWhen } from '../model/markers.js';
import { ui, enter, leave } from '../ui/view.js';
import { waitsHere, checkWaits } from '../ui/actions.js';
import { render } from '../ui/render/index.js';

const input = document.getElementById('nextCheckInput');
let waits = [];   // what was under the cursor when ctrl+. was pressed

export function startNextCheck() {
  if (ui.templates) return;
  waits = waitsHere();
  if (!waits.length) {
    ui.flash = { text: 'nothing waiting here' };
    return;
  }
  enter('next-check');
  input.value = '';
}

function finish(value) {
  leave();
  input.blur();
  value = value.trim();
  if (value) {
    const at = parseWhen(value);
    if (at === null) ui.flash = { text: `not a time: ${value} (like 1h, 20m or 14:30)`, error: true };
    else checkWaits(waits, at);
  }
  render();
}

input.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter') { e.preventDefault(); finish(input.value); }
  else if (e.key === 'Escape') { e.preventDefault(); finish(''); }
});

input.addEventListener('blur', () => {
  if (ui.mode === 'next-check') finish('');
});

export function renderNextCheckBox() {
  const open = ui.mode === 'next-check';
  document.getElementById('nextCheckBox').hidden = !open;
  if (open && document.activeElement !== input) input.focus();
}
