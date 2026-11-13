// Every key, defined once: what it does and how it shows in the hint line and the ? help.
//
//   modes      where the row applies ('normal', 'picker', 'command', 'help'; or a typing
//              mode for hint-only rows)
//   keys       { key: action }; rows without keys only add a hint (the typing modes handle
//              their own keys, and some keys have different hints per pane)
//   hint       the keys as listed; label: text after it, may be a function of the context
//   show       (ctx) => whether to list it; keys work regardless, as long as the mode matches
//   essential  normal mode and the editor's normal mode list only these in the hint line;
//              ? shows everything (except `short` rows, which only exist for the hint line)
//   help       [keys, label] for the ? help when the row has no hint of its own
//
// ctx = { pane, templates, kind } — kind is the item being edited ('note', 'title', ...)

import * as act from './actions.js';
import { ui, leave, enter } from './view.js';
import { startSearch, searchNext } from '../features/search.js';
import { toggleTemplates, openPicker, pickerMove, pickerChoose } from '../features/templates.js';
import { startCommand } from '../features/cmdline.js';
import { startCapture } from '../features/capture.js';
import { openTodoist, todoistMove, todoistMark, todoistChoose } from '../features/todoist.js';
import { openModal } from '../editor/modal.js';

const inLoops = ctx => ctx.pane === 'loops' && !ctx.templates;
const inTasks = ctx => ctx.pane === 'tasks' && !ctx.templates;
const inTemplates = ctx => ctx.templates;
const notTemplates = ctx => !ctx.templates;
const isNote = ctx => ctx.kind === 'note';

export const COMMANDS = [
  // ── normal ──
  { modes: ['normal'], hint: 'T', label: 'back to loops', show: inTemplates, essential: true },
  { modes: ['normal'], hint: 'j/k', label: 'select',
    keys: { j: () => act.move(1), ArrowDown: () => act.move(1), k: () => act.move(-1), ArrowUp: () => act.move(-1) } },
  { modes: ['normal'], hint: 'J/K', label: 'reorder', keys: { J: () => act.shift(1), K: () => act.shift(-1) } },
  { modes: ['normal'], hint: 'g/G', label: 'first/last', keys: { g: () => act.jump(false), G: () => act.jump(true) } },
  { modes: ['normal'], hint: 'l', label: 'open', show: inLoops, essential: true,
    keys: { l: () => act.focusPane(1), ArrowRight: () => act.focusPane(1) } },
  { modes: ['normal'], hint: 'h', label: 'back', keys: { h: () => act.focusPane(-1), ArrowLeft: () => act.focusPane(-1) } },
  { modes: ['normal'], help: ['enter', 'open the loop / done'],
    keys: { Enter: () => { if (ui.focus === 'loops') ui.focus = 'tasks'; else act.toggleDone(); } } },
  { modes: ['normal'], hint: 'c', label: 'to the Inbox', show: notTemplates, keys: { c: startCapture } },
  { modes: ['normal'], hint: 'o/O',
    label: ctx => `new ${ctx.templates ? (ctx.pane === 'loops' ? 'template ' : 'task ') : ctx.pane === 'loops' ? 'loop ' : ''}below/above`,
    essential: true, keys: { o: () => act.add(true), O: () => act.add(false) } },
  { modes: ['normal'], hint: 't', label: 'new from template', show: inLoops, essential: true, keys: { t: openPicker } },
  { modes: ['normal'], hint: 'T', label: 'edit templates', keys: { T: toggleTemplates } },
  { modes: ['normal'], hint: 'a', label: 'add from Todoist', show: notTemplates, keys: { a: openTodoist } },
  { modes: ['normal'], hint: 'space', label: 'done', show: inTasks, essential: true, keys: { ' ': act.toggleDone } },
  { modes: ['normal'], hint: 'space', label: 'finish', show: inLoops, help: ['space', 'done; on a loop: finish it'] },
  { modes: ['normal'], hint: '.', label: 'checked', show: notTemplates, essential: true, keys: { '.': act.markChecked } },
  { modes: ['normal'], hint: 'S', label: 'one-step loop', show: notTemplates, keys: { S: act.addSingle } },
  { modes: ['normal'], hint: 'w', label: 'waiting', show: inTasks, essential: true, keys: { w: () => act.toggleMarker('@w') } },
  { modes: ['normal'], hint: 'i', label: 'important', keys: { i: () => act.toggleMarker('@i') } },
  { modes: ['normal'], hint: 'z', label: 'not now', show: inTasks, keys: { z: () => act.toggleMarker('@n') } },
  { modes: ['normal'], hint: 'r', label: 'rename', keys: { r: act.rename } },
  { modes: ['normal'], hint: 'R', label: 'rename in the editor', keys: { R: () => openModal('title') } },
  { modes: ['normal'], hint: 'm', label: 'note', show: notTemplates, essential: true,
    keys: { m: () => openModal('note'), M: () => openModal('note') } },
  { modes: ['normal'], hint: 'x', label: 'cut', keys: { x: act.cut } },
  { modes: ['normal'], hint: 'p', label: 'paste into the selected loop', keys: { p: act.paste } },
  { modes: ['normal'], hint: 'd', label: 'delete', keys: { d: act.remove } },
  { modes: ['normal'], hint: '/', label: 'search', keys: { '/': startSearch } },
  { modes: ['normal'], hint: 'n/N', label: 'next/prev match', keys: { n: () => searchNext(1), N: () => searchNext(-1) } },
  { modes: ['normal'], hint: 'u', label: 'undo', keys: { u: act.undo } },
  { modes: ['normal'], hint: 's', label: 'Today panel (narrow windows)', keys: { s: act.toggleSide } },
  { modes: ['normal'], help: ['esc', 'clear cut and search'], keys: { Escape: act.clearMarks } },
  { modes: ['normal'], hint: ':', label: 'commands (:pick, :park, :export, :import)', keys: { ':': startCommand } },
  { modes: ['normal'], hint: '?', label: 'all keys', essential: true, keys: { '?': () => enter('help') } },

  // ── picker (t) ──
  { modes: ['picker'], hint: 'j/k', label: 'select',
    keys: { j: () => pickerMove(1), ArrowDown: () => pickerMove(1), k: () => pickerMove(-1), ArrowUp: () => pickerMove(-1) } },
  { modes: ['picker'], hint: 'enter', label: 'create loop', keys: { Enter: pickerChoose } },
  { modes: ['picker'], hint: 'esc', label: 'cancel', keys: { Escape: leave } },

  // ── Todoist (a) ──
  { modes: ['todoist'], hint: 'j/k', label: 'select',
    keys: { j: () => todoistMove(1), ArrowDown: () => todoistMove(1), k: () => todoistMove(-1), ArrowUp: () => todoistMove(-1) } },
  { modes: ['todoist'], hint: 'space', label: 'mark', keys: { ' ': todoistMark } },
  { modes: ['todoist'], hint: 'enter', label: 'add to the selected loop', keys: { Enter: todoistChoose } },
  { modes: ['todoist'], hint: 'esc', label: 'cancel', keys: { Escape: leave, q: leave } },

  // ── typing modes: their inputs handle the keys, these rows are hints only ──
  { modes: ['insert'], hint: 'enter', label: 'save' },
  { modes: ['insert'], hint: 'esc', label: 'cancel' },
  { modes: ['insert'], hint: '@w', label: 'waiting' },
  { modes: ['insert'], hint: '@i', label: 'important' },
  { modes: ['insert'], hint: '@n', label: 'not now' },
  { modes: ['insert'], hint: '14:30 / +20m', label: 'timed' },
  { modes: ['help'], hint: 'esc', label: 'close', keys: { Escape: leave, '?': leave, q: leave } },
  // short in the status bar, in full in the ? help
  { modes: ['command'], hint: ':pick [filter]', label: 'from Todoist', help: [':pick [filter]', 'add tasks from Todoist (a); a filter like @arbeit'] },
  { modes: ['command'], hint: ':park [when]', label: 'to Todoist', help: [':park [when]', 'move the task to Todoist ("tomorrow", "fri")'] },
  { modes: ['command'], hint: ':export', label: 'download', help: [':export', 'download all data as a file'] },
  { modes: ['command'], hint: ':import', label: 'replace from file', help: [':import', 'replace all data from a file'] },
  { modes: ['command'], hint: 'enter', label: 'run' },
  { modes: ['command'], hint: 'esc', label: 'cancel' },
  { modes: ['capture'], hint: 'enter', label: 'add to the Inbox' },
  { modes: ['capture'], hint: 'esc', label: 'cancel' },
  { modes: ['search'], hint: 'enter', label: 'confirm' },
  { modes: ['search'], hint: 'esc', label: 'cancel' },
  { modes: ['vim-normal'], hint: 'i', label: 'insert', essential: true, short: true },
  { modes: ['vim-normal'], hint: 'hjkl w/b/e 0/$ gg/G', label: 'move' },
  { modes: ['vim-normal'], hint: 'i/a/I/A/o/O', label: 'insert' },
  { modes: ['vim-normal'], hint: 'x dd D d/c+w/e/b/$/0/iw cc C', label: 'delete/change' },
  { modes: ['vim-normal'], hint: 'yy y+w/e/b/$/0/iw p/P', label: 'yank, paste after/before' },
  { modes: ['vim-normal'], hint: ':wq/ZZ', label: 'save', essential: true },
  { modes: ['vim-normal'], hint: ':w', label: 'save, stay' },
  { modes: ['vim-normal'], hint: ':q!', label: 'discard', essential: true },
  { modes: ['vim-normal'], hint: 'esc', label: 'close if unchanged' },
  { modes: ['vim-normal'], hint: '?', label: 'all keys', essential: true, short: true },
  { modes: ['vim-normal'], label: 'empty removes the note', show: isNote },
  { modes: ['vim-insert'], hint: 'esc', label: 'normal mode' },
  { modes: ['vim-insert'], hint: '⌘/ctrl+enter', label: 'save' },
  { modes: ['vim-insert'], hint: 'enter', label: 'new line', show: isNote },
  { modes: ['vim-command'], hint: 'enter', label: 'run' },
  { modes: ['vim-command'], hint: 'esc', label: 'cancel' },
  { modes: ['vim-command'], hint: ':w', label: 'save' },
  { modes: ['vim-command'], hint: ':wq/:x', label: 'save and close' },
  { modes: ['vim-command'], hint: ':q', label: 'close' },
  { modes: ['vim-command'], hint: ':q!', label: 'discard' },
];

// key → action for one mode; checked at startup so a key can't be bound twice by accident
const keymaps = {};
for (const c of COMMANDS) {
  for (const mode of c.modes) {
    for (const [key, run] of Object.entries(c.keys || {})) {
      keymaps[mode] = keymaps[mode] || {};
      if (keymaps[mode][key]) throw new Error(`key "${key}" is bound twice in ${mode} mode`);
      keymaps[mode][key] = run;
    }
  }
}

export const commandFor = (mode, key) => keymaps[mode] && keymaps[mode][key];

const kbd = keys => keys.split(' ').map(k => `<kbd>${k}</kbd>`).join(' ');
const labelOf = (c, ctx) => typeof c.label === 'function' ? c.label(ctx) : c.label;

export function hintsFor(mode, ctx) {
  return COMMANDS
    .filter(c => c.modes.includes(mode) && (c.hint || c.label) && (!c.show || c.show(ctx)))
    .filter(c => (mode !== 'normal' && mode !== 'vim-normal') || c.essential)
    .map(c => c.hint ? `${kbd(c.hint)} ${labelOf(c, ctx)}` : labelOf(c, ctx))
    .join('  ');
}

// the ? help: every key, by where it applies, as [keys, label] pairs
export function helpSections() {
  const ctx = { pane: 'tasks', templates: false };
  const rows = mode => COMMANDS
    .filter(c => c.modes.includes(mode) && (c.help || c.hint) && !c.short)
    .filter(c => mode !== 'normal' || c.keys)   // skip the per-pane display duplicates
    .map(c => c.help ? [kbd(c.help[0]), c.help[1]] : [kbd(c.hint), labelOf(c, ctx) || ''])
    .filter(([, label]) => label);
  return [
    ['Lists', rows('normal')],
    ['Commands', rows('command').slice(0, -2)],
    ['Typing a task', rows('insert').slice(2)],
    ['Note editor (m, R)', [...rows('vim-normal'), ...rows('vim-insert').slice(1)]],
  ];
}
