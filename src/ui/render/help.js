// The ? overlay: every key, generated from the command table.

import { ui } from '../view.js';
import { helpSections } from '../commands.js';

export function renderHelp() {
  const box = document.getElementById('help');
  box.hidden = ui.mode !== 'help' && !ui.help;
  if (box.hidden) return;
  document.getElementById('helpBody').innerHTML = helpSections().map(([title, rows]) => `
    <section>
      <h3>${title}</h3>
      <dl>${rows.map(([keys, label]) => `<dt>${keys}</dt><dd>${label}</dd>`).join('')}</dl>
    </section>`).join('');
}
