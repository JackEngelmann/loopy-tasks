// Everything is redrawn from state after each change; the lists are small.

import { ui, clamp } from '../view.js';
import { dropStaleSearch, renderSearchBox } from '../../features/search.js';
import { renderPicker } from '../../features/templates.js';
import { renderTodoist } from '../../features/todoist.js';
import { renderNotifyBtn } from '../../features/reminders.js';
import { renderModal } from '../../editor/modal.js';
import { focusInlineEdit } from '../inline-edit.js';
import { renderLoops } from './loops.js';
import { renderTasks } from './tasks.js';
import { renderToday } from './today.js';
import { renderChrome } from './chrome.js';
import { renderHelp } from './help.js';
import { renderCmdBox } from '../../features/cmdline.js';

export function render() {
  clamp();
  dropStaleSearch();
  renderPicker();
  renderTodoist();
  renderModal();
  renderLoops();
  renderTasks();
  renderToday();
  renderChrome();
  renderSearchBox();
  renderCmdBox();
  renderHelp();
  document.getElementById('backdrop').hidden = !['modal', 'picker', 'todoist', 'help'].includes(ui.mode);
  renderNotifyBtn();

  document.querySelectorAll('.row.sel').forEach(el => el.scrollIntoView({ block: 'nearest' }));
  focusInlineEdit();
}
