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
import { renderNowBadge } from './top.js';
import { syncCheck } from '../attention.js';
import { renderChrome } from './chrome.js';
import { renderHelp } from './help.js';
import { renderCmdBox } from '../../features/cmdline.js';
import { renderCaptureBox } from '../../features/capture.js';

export function render() {
  clamp();
  syncCheck();
  dropStaleSearch();
  renderPicker();
  renderTodoist();
  renderModal();
  renderLoops();
  renderTasks();
  renderNowBadge();
  renderChrome();
  renderSearchBox();
  renderCmdBox();
  renderCaptureBox();
  renderHelp();
  document.getElementById('backdrop').hidden = !['modal', 'picker', 'todoist', 'help'].includes(ui.mode);
  renderNotifyBtn();

  document.querySelectorAll('.row.sel').forEach(el => el.scrollIntoView({ block: 'nearest' }));
  focusInlineEdit();
}
