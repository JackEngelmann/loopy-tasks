// The data and every change to it. `state` is never reassigned (other modules hold it),
// so undo and import swap its contents with replace().

import { isWaiting } from './markers.js';

export const STORAGE_KEY = 'loops-v1';

// ── Schema ────────────────────────────────────────────────────────────────────
// stored data (and exports) carry `version`; data without one is version 0.
// MIGRATIONS[n] upgrades version n to n + 1. To change the data shape, append one.

export const SCHEMA_VERSION = 2;

// templates have the same shape as the main data: loops with tasks
export const emptyState = () => ({ version: SCHEMA_VERSION, loops: [], tasks: [], templates: { loops: [], tasks: [] } });
export const state = emptyState();

const MIGRATIONS = [
  // 0 → 1: templates arrived
  d => { d.templates = d.templates || { loops: [], tasks: [] }; },
  // 1 → 2: waiting tasks remember since when; ones that were already waiting count from now
  d => stampWaiting(d),
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
  persist();
}

export function undo() {
  if (!history.length) return;
  replace(JSON.parse(history.pop()));
  persist();
}

// remember when a task started waiting, however @w got there (w, typing, import, template)
export function stampWaiting(d, now = Date.now()) {
  d.tasks.forEach(t => {
    if (isWaiting(t) && !t.done) t.waitingSince = t.waitingSince || now;
    else delete t.waitingSince;
  });
}
