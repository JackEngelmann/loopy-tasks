// Everything is redrawn from state after each change; the lists are small.

import { clamp } from '../view.js';
import { dropStaleSearch, renderSearchBox } from '../../features/search.js';
import { renderPicker } from '../../features/templates.js';
import { renderNotifyBtn } from '../../features/reminders.js';
import { renderModal } from '../../editor/modal.js';
import { focusInlineEdit } from '../inline-edit.js';
import { renderLoops } from './loops.js';
import { renderTasks } from './tasks.js';
import { renderSide } from './side.js';
import { renderChrome } from './chrome.js';

export function render() {
  clamp();
  dropStaleSearch();
  renderPicker();
  renderModal();
  renderLoops();
  renderTasks();
  renderSide();
  renderChrome();
  renderSearchBox();
  renderNotifyBtn();

  document.querySelectorAll('.row.sel').forEach(el => el.scrollIntoView({ block: 'nearest' }));
  focusInlineEdit();
}
