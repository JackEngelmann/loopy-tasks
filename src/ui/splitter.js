// Drag the edge between the panes to resize them; double-click resets it.
//   loops | tasks   sets the loops pane width (--loops-w)
// The tasks pane takes the rest. Widths are remembered per window size (wide, narrow),
// as { "loops-wide": 420, "loops-narrow": 300 }.

import { narrow } from './view.js';

const LAYOUT_KEY = 'loopy-layout';
const MIN_PANE = 180;
const MIN_TASKS = 260;
const GAP = 8;   // main's side padding and the gap between panes

const main = document.querySelector('main');
const layoutName = () => narrow.matches ? 'narrow' : 'wide';
const width = sel => document.querySelector(sel).offsetWidth;

const EDGES = [
  {
    name: 'loops',
    handle: 'loopsSplitter',
    cssVar: '--loops-w',
    current: () => width('#loopsPane'),
    fromPointer: x => x - main.getBoundingClientRect().left - GAP,
    others: () => 0,
  },
];

function loadWidths() {
  try { return JSON.parse(localStorage.getItem(LAYOUT_KEY)) || {}; } catch { return {}; }
}

const key = edge => `${edge.name}-${layoutName()}`;

// px, or null for the default from style.css
function apply(edge, px) {
  if (px) main.style.setProperty(edge.cssVar, `${px}px`);
  else main.style.removeProperty(edge.cssVar);
}

function save(edge, px) {
  const widths = loadWidths();
  if (px) widths[key(edge)] = px;
  else delete widths[key(edge)];
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(widths));
}

// keep every pane usable: the tasks pane gets at least MIN_TASKS
function clampWidth(edge, px) {
  const max = main.getBoundingClientRect().width - 2 * GAP - GAP - edge.others() - MIN_TASKS;
  return Math.round(Math.max(MIN_PANE, Math.min(px, max)));
}

const applySaved = () => EDGES.forEach(edge => apply(edge, loadWidths()[key(edge)]));

export function initSplitter() {
  applySaved();
  narrow.addEventListener('change', applySaved);
  EDGES.forEach(initEdge);
}

function initEdge(edge) {
  const handle = document.getElementById(edge.handle);
  let px = null;   // the width while dragging
  handle.addEventListener('pointerdown', e => {
    e.preventDefault();   // don't move focus or start a text selection
    try { handle.setPointerCapture(e.pointerId); } catch {}
    document.body.classList.add('resizing');
    px = edge.current();
  });
  handle.addEventListener('pointermove', e => {
    if (px === null) return;
    px = clampWidth(edge, edge.fromPointer(e.clientX));
    apply(edge, px);
  });
  const end = () => {
    if (px === null) return;
    save(edge, px);
    px = null;
    document.body.classList.remove('resizing');
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  handle.addEventListener('dblclick', () => {
    save(edge, null);
    apply(edge, null);
  });
}
