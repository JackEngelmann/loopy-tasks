// The data and every change to it. `state` is never reassigned (other modules hold it),
// so undo and import swap its contents with replace().

import { isWaiting, isInProgress, timeOf, displayTitle, stripToken } from './markers.js';
import { INBOX_ID } from './queries.js';
import { uid } from '../util.js';

export const STORAGE_KEY = 'loops-v1';

// ── Schema ────────────────────────────────────────────────────────────────────
// stored data (and exports) carry `version`; data without one is version 0.
// MIGRATIONS[n] upgrades version n to n + 1. To change the data shape, append one.

export const SCHEMA_VERSION = 4;

// templates have the same shape as the main data: loops with tasks
export const emptyState = () => ({ version: SCHEMA_VERSION, loops: [], tasks: [], templates: { loops: [], tasks: [] } });
export const state = emptyState();

const MIGRATIONS = [
  // 0 → 1: templates arrived
  d => { d.templates = d.templates || { loops: [], tasks: [] }; },
  // 1 → 2: waiting tasks remember since when; ones that were already waiting count from now
  d => stampWaiting(d),
  // 2 → 3: no more Standalone. A task without a loop becomes a one-step loop of its own,
  // at the end; timed ones stay without a loop, they belong to the clock
  d => {
    d.tasks.filter(t => !t.done && t.loopId === null && timeOf(t) === null).forEach(t => {
      const loop = { id: uid(), title: displayTitle(t), single: true, createdAt: t.createdAt || Date.now() };
      d.loops.push(loop);
      t.loopId = loop.id;
    });
  },
  // 3 → 4: important (@i) is gone; in progress (@p) means something else, so the marks just go
  // (one-step loops are named after their task)
  d => [d.tasks, d.templates ? d.templates.tasks : [], d.loops.filter(l => l.single)].flat()
    .forEach(x => { x.title = stripToken(x.title, '@i'); }),
];

export function migrate(d) {
  for (let v = d.version || 0; v < SCHEMA_VERSION; v++) MIGRATIONS[v](d);
  d.version = SCHEMA_VERSION;
  return d;
}

// ── Storage and undo ──────────────────────────────────────────────────────────

const history = [];

export function load() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch {}
  replace(saved ? migrate(saved) : emptyState());
  settle(state);
}

export function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

export function replace(next) {
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, next);
}

// snapshot before every change so `u` can undo it
export function mutate(fn) {
  history.push(JSON.stringify(state));
  if (history.length > 200) history.shift();
  fn();
  stampWaiting(state);
  settle(state);
  persist();
}

export function undo() {
  if (!history.length) return;
  replace(JSON.parse(history.pop()));
  persist();
}

// remember when a task started waiting or went in progress, however the marker got there
// (a key, typing, import, template); a finished task is no longer in progress
export function stampWaiting(d, now = Date.now()) {
  d.tasks.forEach(t => {
    if (isWaiting(t) && !t.done) t.waitingSince = t.waitingSince || now;
    else { delete t.waitingSince; delete t.checkedAt; }
    if (t.done) t.title = stripToken(t.title, '@p');
    if (isInProgress(t)) t.progressSince = t.progressSince || now;
    else delete t.progressSince;
  });
}

// the rules every change ends with (your loops only; templates never run them):
// - a task without a loop needs a time (it belongs to the clock); without one it goes to the Inbox
// - a one-step loop lives as long as its one task and is named after it;
//   a second task makes it a normal loop
export function settle(d) {
  const ids = new Set(d.loops.map(l => l.id));
  d.tasks.forEach(t => {
    if (t.done || t.loopId === INBOX_ID || ids.has(t.loopId)) return;
    t.loopId = timeOf(t) === null ? INBOX_ID : null;
  });
  const gone = new Set();
  d.loops.forEach(l => {
    if (!l.single) return;
    const open = d.tasks.filter(t => t.loopId === l.id && !t.done);
    if (!open.length) gone.add(l.id);
    else if (open.length > 1) delete l.single;
    else l.title = displayTitle(open[0]);
  });
  if (!gone.size) return;
  d.loops = d.loops.filter(l => !gone.has(l.id));
  d.tasks = d.tasks.filter(t => !gone.has(t.loopId));
}
