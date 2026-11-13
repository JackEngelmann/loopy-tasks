// The modal editor: m edits the note of the selected loop or task, R its title.
// Keys go through the pure vim core (vim.js); this file connects it to the textarea and the data.

import { mutate } from '../model/store.js';
import { resolveRelative, displayTitle } from '../model/markers.js';
import { ui, enter, leave, selItem, itemById, loopById } from '../ui/view.js';
import { render } from '../ui/render/index.js';
import { initialVim, vimKey, clampNormal } from './vim.js';
import { isShortcut } from '../util.js';

const box = document.getElementById('noteBox');
const input = document.getElementById('noteInput');

// vim state between keys; text and cursor are read from the textarea each time
export let vim = initialVim('');

export function openModal(kind) {
  const item = selItem();
  if (!item || !item.id || item.kind) return;   // not on the virtual entries
  enter('modal', { editing: { kind, id: item.id } });
  input.value = kind === 'note' ? item.note || '' : item.title;
  vim = initialVim(input.value, vim.reg);   // the register survives closing the editor
  setCursor(0);
  document.getElementById('noteHead').textContent =
    `${kind === 'note' ? 'Note' : 'Rename'} · ${loopById(item.id) ? item.title : displayTitle(item)}`;
}

const cleanNote = value => value.replace(/[ \t]+$/gm, '').trim();
// titles are one line
const cleanTitle = value => value.replace(/\s*\n\s*/g, ' ').trim();
const editedItem = () => itemById(ui.editing.id);
const changed = () => ui.editing.kind === 'note'
  ? cleanNote(input.value) !== (editedItem().note || '')
  : cleanTitle(input.value) !== editedItem().title;

function save() {
  const item = editedItem();
  if (!item) return;
  if (ui.editing.kind === 'note') {
    // an empty note removes it
    const value = cleanNote(input.value);
    if (value !== (item.note || '')) mutate(() => {
      if (value) Object.assign(item, { note: value, noteAt: Date.now() });
      else { delete item.note; delete item.noteAt; }
    });
  } else {
    // same as inline rename: an empty title changes nothing
    let value = cleanTitle(input.value);
    if (!value) return;
    if (!loopById(item.id) && !ui.templates) value = resolveRelative(value);
    if (value !== item.title) mutate(() => { item.title = value; });
  }
}

function close(keep) {
  ui.help = false;
  if (keep) save();
  leave();
  render();
}

// show the cursor as a one-character selection in normal mode; on an empty line there's
// no character to select, so a drawn block stands in (a thin caret would look like insert mode)
function setCursor(p, mode = vim.mode) {
  const v = input.value;
  if (mode === 'normal') {
    p = clampNormal(v, p);
    const onChar = !!v[p] && v[p] !== '\n';
    input.setSelectionRange(p, onChar ? p + 1 : p);
    placeBlock(onChar ? null : p);
  } else {
    input.setSelectionRange(p, p);
    placeBlock(null);
  }
}

const block = document.getElementById('noteCursor');

// where position p is drawn: a hidden copy of the textarea with a marker at p
function placeBlock(p) {
  block.hidden = p === null;
  if (p === null) return;
  const style = getComputedStyle(input);
  const mirror = document.createElement('div');
  for (const prop of ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing']) mirror.style[prop] = style[prop];
  Object.assign(mirror.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', borderStyle: 'solid' });
  mirror.textContent = input.value.slice(0, p);
  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  mirror.append(marker);
  box.append(mirror);
  Object.assign(block.style, {
    top: `${input.offsetTop + marker.offsetTop - input.scrollTop}px`,
    left: `${input.offsetLeft + marker.offsetLeft - input.scrollLeft}px`,
    height: style.lineHeight,
  });
  mirror.remove();
}
input.addEventListener('scroll', () => { if (!block.hidden) setCursor(input.selectionStart); });

function runEffect(effect) {
  if (effect === 'escape') {
    // esc closes when there's nothing to lose; with changes use :wq or :q!
    if (!changed()) close(false);
    return;
  }
  if (effect === 'save') return close(true);
  if (effect === 'discard' || (effect === 'quit' && !changed())) return close(false);
  if (effect === 'quit') vim.msg = 'E37: no write since last change (add ! to override)';
  if (effect === 'write') {
    save();
    if (ui.editing.kind === 'title') input.value = editedItem().title;   // shows a resolved +20m
    vim.msg = 'written';
  }
  render();
}

input.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    return close(true);
  }
  if (isShortcut(e)) return;   // copy, select all, ...

  // ? in normal mode shows the help over the editor; any key closes it again
  if (ui.help) {
    e.preventDefault();
    ui.help = false;
    return render();
  }
  if (e.key === '?' && vim.mode === 'normal' && vim.cmd === null && !vim.pending) {
    e.preventDefault();
    ui.help = true;
    return render();
  }

  const before = vim;
  vim = vimKey({ ...vim, text: input.value, cursor: input.selectionStart }, e.key, { singleLine: ui.editing.kind === 'title' });
  if (!vim.handled) return;
  e.preventDefault();
  if (vim.text !== input.value) input.value = vim.text;
  if (vim.effect) return runEffect(vim.effect);
  if (vim.mode !== before.mode || vim.cmd !== before.cmd || vim.msg !== before.msg) render();   // labels and hints
  setCursor(vim.cursor);
});

// a click in normal mode puts the block cursor there
input.addEventListener('mouseup', () => {
  if (vim.mode === 'normal' && input.selectionStart === input.selectionEnd) setCursor(input.selectionStart);
});

// clicking elsewhere saves too, so a long note is never lost
input.addEventListener('blur', () => {
  if (ui.mode === 'modal') close(true);
});

export function renderModal() {
  const open = ui.mode === 'modal';
  box.hidden = !open;
  if (!open) block.hidden = true;
  box.classList.toggle('normal', open && vim.mode === 'normal');
  box.classList.toggle('title', open && ui.editing.kind === 'title');
  const label = document.getElementById('noteMode');
  label.textContent = vim.cmd !== null ? `:${vim.cmd}▏` : vim.msg || vim.mode.toUpperCase();
  label.classList.toggle('error', vim.msg.startsWith('E'));
  if (open && document.activeElement !== input) input.focus();
  // the block can only be measured once the box is visible
  if (open && vim.mode === 'normal') setCursor(input.selectionStart);
}
