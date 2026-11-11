// Every key, defined once: what it does and how it shows in the hint line at the bottom.
//
//   modes  where the row applies ('normal', 'picker'; or a typing mode for hint-only rows)
//   keys   { key: action }; rows without keys only add a hint (the typing modes handle
//          their own keys, and some keys have different hints per pane)
//   hint   the keys as listed; rows without one aren't listed (they still work)
//   label  text after the hint; may be a function of the context
//   show   (ctx) => whether to list it; keys work regardless, as long as the mode matches
//
// ctx = { pane, templates, kind } — kind is the item being edited ('note', 'title', ...)

import * as act from './actions.js';
import { ui, leave } from './view.js';
import { startSearch, searchNext } from '../features/search.js';
import { toggleTemplates, openPicker, pickerMove, pickerChoose } from '../features/templates.js';
import { openModal } from '../editor/modal.js';

const inLoops = ctx => ctx.pane === 'loops' && !ctx.templates;
const inTasks = ctx => ctx.pane === 'tasks' && !ctx.templates;
const inTemplates = ctx => ctx.templates;
const notTemplates = ctx => !ctx.templates;
const isNote = ctx => ctx.kind === 'note';

export const COMMANDS = [
  // ── normal ──
  { modes: ['normal'], hint: 'T', label: 'back to loops', show: inTemplates },
  { modes: ['normal'], hint: 'j/k', label: 'select',
    keys: { j: () => act.move(1), ArrowDown: () => act.move(1), k: () => act.move(-1), ArrowUp: () => act.move(-1) } },
  { modes: ['normal'], hint: 'J/K', label: 'reorder', keys: { J: () => act.shift(1), K: () => act.shift(-1) } },
  { modes: ['normal'], keys: { g: () => act.jump(false), G: () => act.jump(true) } },
  { modes: ['normal'], hint: 'l', label: 'open', show: inLoops, keys: { l: () => act.focusPane(1), ArrowRight: () => act.focusPane(1) } },
  { modes: ['normal'], hint: 'h', label: 'back', show: inTasks, keys: { h: () => act.focusPane(-1), ArrowLeft: () => act.focusPane(-1) } },
  { modes: ['normal'], hint: 'h/l', label: 'panes', show: inTemplates },
  { modes: ['normal'], keys: { Enter: () => { if (ui.focus === 'loops') ui.focus = 'tasks'; else act.toggleDone(); } } },
  { modes: ['normal'], hint: 't', label: 'new from template', show: inLoops, keys: { t: openPicker } },
  { modes: ['normal'], hint: 'T', label: 'templates', show: inLoops, keys: { T: toggleTemplates } },
  { modes: ['normal'], hint: 'o/O',
    label: ctx => `new ${ctx.templates ? (ctx.pane === 'loops' ? 'template ' : 'task ') : ctx.pane === 'loops' ? 'loop ' : ''}below/above`,
    keys: { o: () => act.add(true), O: () => act.add(false) } },
  { modes: ['normal'], hint: 'space', label: 'done', show: inTasks, keys: { ' ': act.toggleDone } },
  { modes: ['normal'], hint: 'w', label: 'waiting', show: inTasks, keys: { w: () => act.toggleMarker('@w') } },
  { modes: ['normal'], hint: 'i', label: 'important', show: inTasks, keys: { i: () => act.toggleMarker('@i') } },
  { modes: ['normal'], hint: 'w/i', label: 'waiting/important', show: inTemplates },
  { modes: ['normal'], hint: 'r', label: 'rename', keys: { r: act.rename } },
  { modes: ['normal'], keys: { R: () => openModal('title') } },
  { modes: ['normal'], hint: 'm', label: 'note', keys: { m: () => openModal('note'), M: () => openModal('note') } },
  { modes: ['normal'], hint: 'x', label: 'cut', show: inTasks, keys: { x: act.cut } },
  { modes: ['normal'], hint: 'p', label: 'paste', show: notTemplates, keys: { p: act.paste } },
  { modes: ['normal'], hint: 'd', label: 'delete', keys: { d: act.remove } },
  { modes: ['normal'], hint: '/', label: 'search', keys: { '/': startSearch } },
  { modes: ['normal'], hint: 'n/N', label: 'next/prev', show: notTemplates, keys: { n: () => searchNext(1), N: () => searchNext(-1) } },
  { modes: ['normal'], hint: 'u', label: 'undo', keys: { u: act.undo } },
  // listed in the summary line instead
  { modes: ['normal'], keys: { s: act.toggleSide, Escape: act.clearMarks } },

  // ── picker (t) ──
  { modes: ['picker'], hint: 'j/k', label: 'select',
    keys: { j: () => pickerMove(1), ArrowDown: () => pickerMove(1), k: () => pickerMove(-1), ArrowUp: () => pickerMove(-1) } },
  { modes: ['picker'], hint: 'enter', label: 'create loop', keys: { Enter: pickerChoose } },
  { modes: ['picker'], hint: 'esc', label: 'cancel', keys: { Escape: leave } },

  // ── typing modes: their inputs handle the keys, these rows are hints only ──
  { modes: ['insert'], hint: 'enter', label: 'save' },
  { modes: ['insert'], hint: 'esc', label: 'cancel' },
  { modes: ['insert'], hint: '@w', label: 'waiting' },
  { modes: ['insert'], hint: '@i', label: 'important' },
  { modes: ['insert'], hint: '14:30 / +20m', label: 'timed' },
  { modes: ['search'], hint: 'enter', label: 'confirm' },
  { modes: ['search'], hint: 'esc', label: 'cancel' },
  { modes: ['vim-normal'], hint: 'hjkl w/b/e 0/$ gg/G', label: 'move' },
  { modes: ['vim-normal'], hint: 'i/a/I/A/o/O', label: 'insert' },
  { modes: ['vim-normal'], hint: 'x dd D d/c+w/e/b/$/0/iw cc C', label: 'delete/change' },
  { modes: ['vim-normal'], hint: ':wq/ZZ', label: 'save' },
  { modes: ['vim-normal'], hint: ':w', label: 'save, stay' },
  { modes: ['vim-normal'], hint: ':q!', label: 'discard' },
  { modes: ['vim-normal'], hint: 'esc', label: 'close if unchanged' },
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

export function hintsFor(mode, ctx) {
  return COMMANDS
    .filter(c => c.modes.includes(mode) && (c.hint || c.label) && (!c.show || c.show(ctx)))
    .map(c => {
      const label = typeof c.label === 'function' ? c.label(ctx) : c.label;
      return c.hint ? `${c.hint.split(' ').map(k => `<kbd>${k}</kbd>`).join(' ')} ${label}` : label;
    })
    .join('  ');
}
