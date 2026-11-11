// A few vim keys, as a pure function: vimKey(state, key) → next state.
// state = { text, cursor, mode, pending, count, opCount, goal, cmd, msg }
//   mode     'normal' | 'insert'
//   pending  keys typed so far of a multi-key command (g, Z, d, c, di, ci)
//   count    digits typed before a command; opCount: the count before d/c (2d3w)
//   goal     column j/k try to keep
//   cmd      the ":" command being typed (null when none); msg: its result
// The result also has
//   handled  false when the browser should do its normal thing (typing in insert mode)
//   effect   'write' (:w), 'save' (:wq, :x, ZZ), 'quit' (:q), 'discard' (:q!) or null
// No undo inside the editor.

export const initialVim = text => ({
  text, cursor: 0, mode: 'normal', pending: '', count: '', opCount: 1, goal: null, cmd: null, msg: '',
});

export const lineStart = (v, p) => v.lastIndexOf('\n', p - 1) + 1;
export const lineEnd = (v, p) => { const i = v.indexOf('\n', p); return i < 0 ? v.length : i; };
// in normal mode the cursor sits on a character, so the last one is the end of the line
export const lastCol = (v, p) => Math.max(lineStart(v, p), lineEnd(v, p) - 1);
export const clampNormal = (v, p) => Math.max(0, Math.min(p, lastCol(v, p)));
const charClass = c => c === undefined || /\s/.test(c) ? 0 : /\w/.test(c) ? 1 : 2;

function vertical(s, v, p, dir) {
  const start = lineStart(v, p);
  if (s.goal === null) s.goal = p - start;
  const target = dir > 0 ? lineEnd(v, p) + 1 : start - 1;
  if (target < 0 || target > v.length) return p;
  const ts = lineStart(v, target);
  return Math.min(ts + s.goal, lastCol(v, ts));
}

// may land past the last character, which d/c need to reach the end
function wordForwardRaw(v, p) {
  const c = charClass(v[p]);
  while (p < v.length && c && charClass(v[p]) === c) p++;
  while (p < v.length && !charClass(v[p])) p++;
  return p;
}
const wordForward = (v, p) => Math.min(wordForwardRaw(v, p), Math.max(0, v.length - 1));
function wordBack(v, p) {
  p--;
  while (p > 0 && !charClass(v[p])) p--;
  const c = charClass(v[p]);
  while (p > 0 && charClass(v[p - 1]) === c) p--;
  return Math.max(0, p);
}
function wordEnd(v, p) {
  p++;
  while (p < v.length && !charClass(v[p])) p++;
  const c = charClass(v[p]);
  while (p < v.length - 1 && charClass(v[p + 1]) === c) p++;
  return Math.min(p, Math.max(0, v.length - 1));
}
const firstNonBlank = (v, p) => {
  const s = lineStart(v, p);
  const m = v.slice(s, lineEnd(v, p)).search(/\S/);
  return m < 0 ? s : s + m;
};

// (state, text, cursor) → cursor
const MOTIONS = {
  h: (s, v, p) => Math.max(lineStart(v, p), p - 1),
  l: (s, v, p) => Math.min(lastCol(v, p), p + 1),
  j: (s, v, p) => vertical(s, v, p, 1),
  k: (s, v, p) => vertical(s, v, p, -1),
  w: (s, v, p) => wordForward(v, p),
  b: (s, v, p) => wordBack(v, p),
  e: (s, v, p) => wordEnd(v, p),
  0: (s, v, p) => lineStart(v, p),
  $: (s, v, p) => lastCol(v, p),
  '^': (s, v, p) => firstNonBlank(v, p),
  G: (s, v) => lineStart(v, v.length),
  gg: () => 0,
};
const ARROWS = { ArrowLeft: 'h', ArrowRight: 'l', ArrowDown: 'j', ArrowUp: 'k', Enter: 'j' };

export function vimKey(prev, key, { singleLine = false } = {}) {
  const s = { ...prev, handled: true, effect: null };
  if (s.mode === 'insert') {
    if (key === 'Enter' && singleLine) return s;   // titles are one line
    if (key !== 'Escape') return { ...s, handled: false };   // typing works as usual
    return toMode(s, 'normal', Math.max(lineStart(s.text, s.cursor), s.cursor - 1));
  }
  if (s.cmd !== null) return commandKey(s, key);
  s.msg = '';
  if (key === 'Escape') {
    s.pending = s.count = '';
    s.opCount = 1;
    return s;
  }
  // keys like Tab or Backspace keep their browser behaviour
  if (key.length !== 1 && !ARROWS[key]) return { ...s, handled: false };
  normalKey(s, ARROWS[key] || key);
  if (s.mode === 'normal') s.cursor = clampNormal(s.text, s.cursor);
  return s;
}

function toMode(s, mode, cursor) {
  Object.assign(s, { mode, cursor, pending: '', count: '', opCount: 1, cmd: null });
  return s;
}

// replace text[from, to) with `text` and put the cursor at `at`
function splice(s, from, to, text, at, mode = s.mode) {
  s.text = s.text.slice(0, from) + text + s.text.slice(to);
  if (mode !== s.mode) toMode(s, mode, at);
  else s.cursor = at;
}

function normalKey(s, key) {
  const v = s.text, p = s.cursor;
  if (/^[1-9]$/.test(key) || (key === '0' && s.count)) { s.count += key; return; }
  const n = Math.max(1, +s.count || 1);
  const cmd = s.pending + key;
  s.pending = '';
  s.count = '';
  if (!'jk'.includes(cmd)) s.goal = null;

  // d/c followed by a motion or iw
  const op = cmd[0];
  if (cmd.length > 1 && 'dc'.includes(op) && cmd !== 'dd' && cmd !== 'cc') {
    if (cmd.length === 2 && key === 'i') { s.pending = cmd; return; }
    const range = opRange(v, p, op, cmd.slice(1), n * s.opCount);
    s.opCount = 1;
    if (!range) return;
    const [from, to] = range;
    return splice(s, from, to, '', from, op === 'c' ? 'insert' : 'normal');
  }

  if (MOTIONS[cmd]) {
    let q = p;
    for (let i = 0; i < n; i++) q = MOTIONS[cmd](s, v, q);
    s.cursor = q;
    return;
  }
  const ls = lineStart(v, p), le = lineEnd(v, p);
  switch (cmd) {
    case 'g': case 'Z': s.pending = cmd; return;
    case ':': s.cmd = ''; return;
    case 'd': case 'c': s.pending = cmd; s.opCount = n; return;
    case 'i': return toMode(s, 'insert', p);
    case 'a': return toMode(s, 'insert', Math.min(p + 1, le));
    case 'I': return toMode(s, 'insert', firstNonBlank(v, p));
    case 'A': return toMode(s, 'insert', le);
    case 'o': return splice(s, le, le, '\n', le + 1, 'insert');
    case 'O': return splice(s, ls, ls, '\n', ls, 'insert');
    case 'x': return splice(s, p, Math.min(p + n, le), '', p);
    case 'D': return splice(s, p, le, '', Math.max(ls, p - 1));
    case 'dd': {
      // n lines from here, including their line break (2dd and d2d both work)
      const lines = n * s.opCount;
      s.opCount = 1;
      let end = le;
      for (let i = 1; i < lines && end < v.length; i++) end = lineEnd(v, end + 1);
      const from = end < v.length ? ls : Math.max(0, ls - 1);
      return splice(s, from, Math.min(v.length, end + 1), '', from === ls ? ls : lineStart(v, from - 1));
    }
    case 'C': return splice(s, p, le, '', p, 'insert');
    case 'cc': return splice(s, ls, le, '', ls, 'insert');
    case 'ZZ': s.effect = 'save'; return;
  }
}

// the text a d/c command acts on, as [from, to)
function opRange(v, p, op, target, n) {
  const ls = lineStart(v, p), le = lineEnd(v, p);
  const repeat = (fn, q = p) => { for (let i = 0; i < n; i++) q = fn(v, q); return q; };
  switch (target) {
    case 'w': {
      // cw on a word changes just the word (like ce), keeping the space after it
      if (op === 'c' && charClass(v[p])) {
        let q = p;
        while (q + 1 < le && charClass(v[q + 1]) === charClass(v[p])) q++;
        for (let i = 1; i < n; i++) q = wordEnd(v, q);
        return [p, q + 1];
      }
      // dw stops at the end of the line
      return [p, Math.min(repeat(wordForwardRaw), le)];
    }
    case 'e': return [p, Math.min(repeat(wordEnd) + 1, v.length)];
    case 'b': return [repeat(wordBack), p];
    case 'h': return [Math.max(ls, p - n), p];
    case 'l': return [p, Math.min(le, p + n)];
    case '0': return [ls, p];
    case '^': { const q = firstNonBlank(v, p); return [Math.min(p, q), Math.max(p, q)]; }
    case '$': return [p, le];
    case 'iw': {
      // the run of word, punctuation or space characters under the cursor
      if (p >= le) return null;
      const c = charClass(v[p]);
      let from = p, to = p + 1;
      while (from > ls && charClass(v[from - 1]) === c) from--;
      while (to < le && charClass(v[to]) === c) to++;
      return [from, to];
    }
  }
  return null;
}

// typing a ":" command; enter runs it
function commandKey(s, key) {
  if (key === 'Enter') {
    const c = s.cmd.trim();
    s.cmd = null;
    return runCommand(s, c);
  }
  if (key === 'Escape' || (key === 'Backspace' && !s.cmd)) s.cmd = null;
  else if (key === 'Backspace') s.cmd = s.cmd.slice(0, -1);
  else if (key.length === 1) s.cmd += key;
  return s;
}

// :w saves and stays, :wq / :x save and close, :q closes if nothing changed, :q! discards
const COMMANDS = { w: 'write', wq: 'save', x: 'save', q: 'quit', 'q!': 'discard' };
function runCommand(s, c) {
  s.effect = COMMANDS[c] || null;
  if (!s.effect) s.msg = `E492: not an editor command: ${c}`;
  return s;
}
