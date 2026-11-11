// UI state: what's selected, which mode the keyboard is in, and the lists as the panes show them.

import { state } from '../model/store.js';
import { openTasks } from '../model/queries.js';

// navigable panes; the right column is informational only
export const PANES = ['loops', 'tasks'];

// what keys do depends on the mode:
//   normal  move around and act on items (commands.js)
//   insert  typing in an inline input (o, O, r)            ui.editing = { kind: 'new-loop' | 'new-task' | 'rename', ... }
//   modal   the vim-style editor (m note, R rename)        ui.editing = { kind: 'note' | 'title', id }
//   search  typing a "/" query                              ui.search
//   picker  choosing a template (t)                         ui.picker = { idx }
export const ui = {
  mode: 'normal',
  focus: 'loops',     // one of PANES
  loopIdx: 0,         // indexes loopsList(): virtual views first, then the real loops
  taskIdx: 0,
  editing: null,      // see above; also id, at, anchorId, below for inline edits
  cutId: null,
  search: null,       // see features/search.js; stays after the query is confirmed, for n/N
  flash: null,        // { text, error? } note in the status bar, cleared on the next key
  templates: false,   // template mode: the panes edit templates instead of loops
  otherCursor: null,  // cursor of the mode you're not in, restored on T
  picker: null,
  sideOpen: false,    // right column shown as an overlay on narrow windows (s)
};

export const isEditing = () => ui.mode === 'insert' || ui.mode === 'modal';

export function enter(mode, payload = {}) {
  ui.mode = mode;
  Object.assign(ui, payload);
}

// back to normal mode, dropping the payload of the mode we leave
export function leave() {
  ui.mode = 'normal';
  ui.editing = null;
  ui.picker = null;
}

// the virtual "All" loop has no id, so tasks created there get no loop;
// it sits above the real loops
export const ALL = { id: null, title: 'All', kind: 'all' };
export const VIRTUAL = [ALL];
// stand-in when template mode has no templates yet
export const NONE = { id: null, title: 'No templates', kind: 'none' };

// the data the panes edit: your loops, or the templates in template mode.
// the right column always shows your real tasks (state.tasks).
export const db = () => ui.templates ? state.templates : state;
export const isTemplate = t => state.templates.tasks.includes(t);
export const virtuals = () => ui.templates ? [] : VIRTUAL;
export const loopsList = () => [...virtuals(), ...db().loops];
export const currentLoop = () => loopsList()[ui.loopIdx] || NONE;
// ids are unique across both, so tags resolve in either mode
export const loopById = id => state.loops.find(l => l.id === id) || state.templates.loops.find(l => l.id === id);
export const itemById = id => loopById(id) || db().tasks.find(t => t.id === id);

// middle pane: open tasks in order (waiting ones included); done tasks are hidden
export const currentTasks = () => openTasks(db(), currentLoop().id);
export const selTask = () => ui.focus === 'tasks' ? currentTasks()[ui.taskIdx] : null;
// the loop or task the cursor is on
export const selItem = () => ui.focus === 'loops' ? currentLoop() : selTask();

// narrow windows (e.g. half a screen) fold the right column into a summary line
export const narrow = window.matchMedia('(max-width: 1100px)');

export function clamp() {
  const fit = (i, n) => Math.max(0, Math.min(i, n - 1));
  ui.loopIdx = fit(ui.loopIdx, loopsList().length);
  ui.taskIdx = fit(ui.taskIdx, currentTasks().length);
}
