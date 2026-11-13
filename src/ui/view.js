// UI state: what's selected, which mode the keyboard is in, and the lists as the panes show them.

import { state } from '../model/store.js';
import { openTasks, notNowLast, INBOX_ID } from '../model/queries.js';

// navigable panes; the right column is informational only
export const PANES = ['loops', 'tasks'];

// what keys do depends on the mode:
//   normal  move around and act on items (commands.js)
//   insert  typing in an inline input (o, O, r)            ui.editing = { kind: 'new-loop' | 'new-task' | 'rename', ... }
//   modal   the vim-style editor (m note, R rename)        ui.editing = { kind: 'note' | 'title', id }
//   search  typing a "/" query                              ui.search
//   capture typing into the Inbox from anywhere (c)       the status bar input
//   picker  choosing a template (t)                         ui.picker = { idx }
//   todoist picking Todoist tasks (a)                       ui.todoist = { idx, items, marked, error }
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
  todoist: null,
  sideOpen: false,    // right column shown as an overlay on narrow windows (s)
  help: false,        // the ? help shown over the editor (in normal mode it's ui.mode 'help')
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
  ui.todoist = null;
}

// virtual loops above the real ones: "All" shows every task, "Inbox" what's captured but
// not sorted yet. All has no id: a task created or pasted there gets no loop, which only a
// timed task keeps (store.js settle() sends the rest to the Inbox); Inbox tasks get INBOX_ID.
// Having a `kind` is what tells them apart from your loops: they can't be renamed, noted or deleted.
export const ALL = { id: null, title: 'All', kind: 'all' };
export const INBOX = { id: INBOX_ID, title: 'Inbox', kind: 'inbox' };
export const VIRTUAL = [ALL, INBOX];
// stand-in when template mode has no templates yet
export const NONE = { id: null, title: 'No templates', kind: 'none' };

// the data the panes edit: your loops, or the templates in template mode.
// the right column always shows your real tasks (state.tasks).
export const db = () => ui.templates ? state.templates : state;
export const isTemplate = t => state.templates.tasks.includes(t);
export const virtuals = () => ui.templates ? [] : VIRTUAL;
export const loopsList = () => [...virtuals(), ...db().loops];
export const currentLoop = () => loopsList()[ui.loopIdx] || NONE;
// ids are unique across both, so tags resolve in either mode; the Inbox resolves too
export const loopById = id => id === INBOX_ID ? INBOX
  : state.loops.find(l => l.id === id) || state.templates.loops.find(l => l.id === id);
export const itemById = id => loopById(id) || db().tasks.find(t => t.id === id);

// open tasks of a loop, real or virtual, in order (waiting ones included), not-now ones last
export const tasksOf = loop => notNowLast(openTasks(db(), loop.id));
// a one-step loop's task; on the loop's row, keys act on it (rename, note, done, markers)
export const singleTask = loop => loop.single ? openTasks(db(), loop.id)[0] || null : null;
// middle pane; done tasks are hidden
export const currentTasks = () => tasksOf(currentLoop());
export const selTask = () => ui.focus === 'tasks' ? currentTasks()[ui.taskIdx] : singleTask(currentLoop());
// the loop or task the cursor is on (a one-step loop is its task)
export const selItem = () => ui.focus === 'loops' ? singleTask(currentLoop()) || currentLoop() : selTask();

// narrow windows (e.g. half a screen) fold the right column into a summary line
export const narrow = window.matchMedia('(max-width: 1100px)');

export function clamp() {
  const fit = (i, n) => Math.max(0, Math.min(i, n - 1));
  ui.loopIdx = fit(ui.loopIdx, loopsList().length);
  ui.taskIdx = fit(ui.taskIdx, currentTasks().length);
}
