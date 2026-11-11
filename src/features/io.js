// Export everything as a JSON file, import one back (replacing everything; u undoes it).

import { state, mutate, replace } from '../model/store.js';
import { parseImport } from '../model/import.js';
import { ui, leave } from '../ui/view.js';
import { render } from '../ui/render/index.js';

export function exportData() {
  const data = { app: 'loopy-tasks', exportedAt: new Date().toISOString(), ...state };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `loopy-tasks-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  ui.flash = { text: `exported ${state.loops.length} loops, ${state.tasks.length} tasks, ${state.templates.loops.length} templates` };
}

function importData(text) {
  try {
    const data = parseImport(text);
    mutate(() => replace(data));
    leave();
    Object.assign(ui, { focus: 'loops', loopIdx: 0, taskIdx: 0, cutId: null, search: null, templates: false, otherCursor: null });
    ui.flash = { text: `imported ${data.loops.length} loops, ${data.tasks.length} tasks, ${data.templates.loops.length} templates · u to undo` };
  } catch (err) {
    ui.flash = { text: `import failed: ${err.message}`, error: true };
  }
  render();
}

const importFile = document.getElementById('importFile');

// blur the buttons afterwards so space/enter keep driving the lists
document.getElementById('exportBtn').addEventListener('click', e => {
  e.currentTarget.blur();
  exportData();
  render();
});
document.getElementById('importBtn').addEventListener('click', e => {
  e.currentTarget.blur();
  importFile.click();
});
importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  importFile.value = '';   // allow re-importing the same file
  if (file) importData(await file.text());
});
