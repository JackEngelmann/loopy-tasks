// "/" finds things in the focused pane and jumps to them (yazi style); nothing is hidden.
// ui.search = { pane, loopIdx, query, origin: { loopIdx, taskIdx } }; while typing, ui.mode is 'search'.
// After enter the search stays for n/N until you leave its pane (or its loop, for tasks).

import { timeOf, fmtTime, displayTitle } from '../model/markers.js';
import { ui, enter, leave, loopsList, currentLoop, currentTasks, loopById } from '../ui/view.js';
import { render } from '../ui/render/index.js';
import { esc } from '../util.js';

const searchInput = document.getElementById('searchInput');

// smart case: lowercase queries ignore case, any capital makes it exact
export function findAll(text, q) {
  const exact = q !== q.toLowerCase();
  const hay = exact ? text : text.toLowerCase();
  const needle = exact ? q : q.toLowerCase();
  const found = [];
  for (let j = hay.indexOf(needle); j !== -1; j = hay.indexOf(needle, j + needle.length)) found.push(j);
  return found;
}

const searching = pane => ui.search && ui.search.query && ui.search.pane === pane;

export function highlight(text, pane) {
  if (!searching(pane)) return esc(text);
  const q = ui.search.query;
  let out = '', i = 0;
  for (const j of findAll(text, q)) {
    out += esc(text.slice(i, j)) + `<mark>${esc(text.slice(j, j + q.length))}</mark>`;
    i = j + q.length;
  }
  return out + esc(text.slice(i));
}

// the text of each row as shown on screen, in list order
function searchTexts(pane) {
  if (pane === 'loops') return loopsList().map(l => l.title);
  const inAll = currentLoop().kind === 'all';
  return currentTasks().map(t => {
    const time = timeOf(t), l = loopById(t.loopId);
    return [time !== null && fmtTime(time), inAll && l && l.title, displayTitle(t)].filter(Boolean).join(' ');
  });
}

function matchIndexes() {
  const s = ui.search;
  if (!s || !s.query) return [];
  return searchTexts(s.pane).flatMap((txt, i) => findAll(txt, s.query).length ? [i] : []);
}

const searchCursor = () => ui.search.pane === 'loops' ? ui.loopIdx : ui.taskIdx;
function setSearchCursor(i) {
  if (ui.search.pane === 'tasks') return void (ui.taskIdx = i);
  if (i !== ui.loopIdx) ui.taskIdx = 0;
  ui.loopIdx = i;
}

// move to the nearest match in `dir`, wrapping around; `inclusive` lets the start row count
function jumpToMatch(from, dir, inclusive) {
  const hits = matchIndexes();
  const n = searchTexts(ui.search.pane).length;
  for (let k = inclusive ? 0 : 1; k <= n && hits.length; k++) {
    const i = ((from + dir * k) % n + n) % n;
    if (!hits.includes(i)) continue;
    ui.flash = (dir > 0 ? from + k >= n : from - k < 0) ? { text: 'search wrapped' } : null;
    setSearchCursor(i);
    return;
  }
}

export function startSearch() {
  enter('search', {
    search: { pane: ui.focus, loopIdx: ui.loopIdx, query: '', origin: { loopIdx: ui.loopIdx, taskIdx: ui.taskIdx } },
  });
  searchInput.value = '';
}

function endSearchTyping(confirm) {
  const s = ui.search;
  if (!confirm) {
    ui.loopIdx = s.origin.loopIdx;
    ui.taskIdx = s.origin.taskIdx;
  }
  leave();
  if (!confirm || !s.query) ui.search = null;
  searchInput.blur();
  render();
}

export function searchNext(dir) {
  const s = ui.search;
  if (s && s.query && s.pane === ui.focus) jumpToMatch(searchCursor(), dir, false);
}

export function searchInfo() {
  const s = ui.search;
  if (!s || !s.query) return '';
  const prefix = ui.mode === 'search' ? '' : `/${esc(s.query)}  `;
  const hits = matchIndexes();
  if (!hits.length) return `${prefix}<span class="no-match">no match</span>`;
  const pos = hits.indexOf(searchCursor()) + 1;
  return `${prefix}${pos || '-'}/${hits.length}`;
}

// a confirmed search ends once you leave its pane, or its loop for a task search
export function dropStaleSearch() {
  const s = ui.search;
  if (!s || ui.mode === 'search') return;
  if (s.pane !== ui.focus || (s.pane === 'tasks' && s.loopIdx !== ui.loopIdx)) ui.search = null;
}

export function renderSearchBox() {
  const typing = ui.mode === 'search';
  document.getElementById('searchBox').hidden = !typing;
  document.getElementById('searchInfo').innerHTML = searchInfo();
  if (typing && document.activeElement !== searchInput) searchInput.focus();
}

// typing re-searches from where the cursor was when "/" was pressed
searchInput.addEventListener('input', () => {
  const s = ui.search;
  s.query = searchInput.value;
  ui.loopIdx = s.origin.loopIdx;
  ui.taskIdx = s.origin.taskIdx;
  if (s.query) jumpToMatch(searchCursor(), 1, true);
  render();
});

searchInput.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter') { e.preventDefault(); endSearchTyping(true); }
  else if (e.key === 'Escape') { e.preventDefault(); endSearchTyping(false); }
});

searchInput.addEventListener('blur', () => {
  if (ui.mode === 'search') endSearchTyping(true);
});
