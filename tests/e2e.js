// end-to-end tests: the real app in an iframe, driven by key events, checked through
// the DOM and what it saved to localStorage. Each test starts from the seed data.

import { test, eq, ok } from './harness.js';

const STORAGE_KEY = 'loops-v1';
let w, doc;

async function fresh({ width = 1400, stored = null } = {}) {
  localStorage.removeItem(STORAGE_KEY);
  if (stored) localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  localStorage.removeItem('loopy-notified');
  document.getElementById('app')?.remove();
  const frame = document.createElement('iframe');
  frame.id = 'app';
  frame.style.cssText = `width:${width}px;height:700px;border:0`;
  const loaded = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
  frame.src = '../index.html';
  document.body.append(frame);
  await loaded;
  w = frame.contentWindow;
  doc = w.document;
}

const event = (key, opts) => new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
const keys = (...ks) => ks.forEach(k => doc.body.dispatchEvent(event(k)));
const $ = sel => doc.querySelector(sel);
const $$ = sel => [...doc.querySelectorAll(sel)];
const text = sel => $(sel).textContent.trim();
const data = () => JSON.parse(w.localStorage.getItem(STORAGE_KEY));
const task = title => data().tasks.find(t => t.title.startsWith(title));
const loop = title => data().loops.find(l => l.title === title);
const selected = pane => $(`#${pane} .row.sel`)?.textContent.replace(/\s+/g, ' ').trim();

// inline input (o, O, r)
function typeInline(value, key = 'Enter') {
  const input = $('.edit');
  ok(input, 'inline input is open');
  input.value = value;
  input.dispatchEvent(event(key));
}

// the modal editor (m, R)
const note = () => $('#noteInput');
const modalOpen = () => !$('#noteBox').hidden;
const vim = (...ks) => ks.forEach(k => note().dispatchEvent(event(k)));
const insert = s => doc.execCommand('insertText', false, s);
const modalText = () => note().value;
const modalCursor = () => note().selectionStart;
// the note box content with the cursor marked as "|"
const withCursor = () => modalText().slice(0, modalCursor()) + '|' + modalText().slice(modalCursor());
function modalWith(value, cursor = 0) {
  note().value = value;
  note().setSelectionRange(cursor, cursor + 1);
}

const hhmm = min => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

// ── Layout and navigation ─────────────────────────────────────────────────────

test('seed data shows All and four loops', async () => {
  await fresh();
  eq($$('#loops .row').length, 5);
  eq(selected('loops').startsWith('All'), true);
  eq(text('#tasksMeta'), '11 open');
});

test('j selects a loop, l moves into its tasks', async () => {
  await fresh();
  keys('j');
  ok(selected('loops').startsWith('Website redesign'));
  eq(text('#tasksTitle'), 'Website redesign');
  keys('l');
  eq(text('#mode'), 'TASKS');
  ok(selected('tasks').includes('Sketch new landing page'));
  ok(text('#crumb').endsWith('Sketch new landing page'));
  keys('h');
  eq(text('#mode'), 'LOOPS');
});

test('g / G jump to first and last', async () => {
  await fresh();
  keys('G');
  ok(selected('loops').startsWith('Team offsite'));
  keys('g');
  ok(selected('loops').startsWith('All'));
});

test('stale loop is yellow, waiting-only loop is teal', async () => {
  await fresh();
  ok($$('#loops .row.stale').some(r => r.textContent.includes('Team offsite')));
  ok($$('#loops .row.waiting-loop').some(r => r.textContent.includes('Quarterly report')));
});

// ── Editing tasks ─────────────────────────────────────────────────────────────

test('o adds a task below the selected one', async () => {
  await fresh();
  keys('j', 'l', 'o');
  eq(text('#mode'), 'INSERT');
  typeInline('New thing');
  const web = loop('Website redesign').id;
  const titles = data().tasks.filter(t => t.loopId === web).map(t => t.title);
  eq(titles.indexOf('New thing'), titles.indexOf('Sketch new landing page @i') + 1);
  ok(selected('tasks').includes('New thing'));
});

test('O adds above; esc cancels an inline edit', async () => {
  await fresh();
  keys('j', 'l', 'O');
  typeInline('Above', 'Escape');
  eq(task('Above'), undefined);
  keys('O');
  typeInline('Above');
  const web = loop('Website redesign').id;
  eq(data().tasks.filter(t => t.loopId === web)[0].title, 'Above');
});

test('r renames inline', async () => {
  await fresh();
  keys('j', 'l', 'r');
  typeInline('Sketch the landing page @i');
  ok(task('Sketch the landing page'));
});

test('w marks waiting with a timestamp and a note hint, w again clears it', async () => {
  await fresh();
  keys('j', 'l', 'j', 'w');
  ok(task('Collect feedback').title.endsWith('@w'));
  ok(task('Collect feedback').waitingSince > 0, 'waitingSince set');
  eq(text('#flash'), 'm to note where you left off');
  ok($$('#waiting .row').some(r => r.textContent.includes('Collect feedback')));
  keys('w');
  eq(task('Collect feedback').title, 'Collect feedback on current site');
  eq(task('Collect feedback').waitingSince, undefined);
});

test('i marks important and shows it on the right', async () => {
  await fresh();
  keys('j', 'l', 'j', 'i');
  ok($$('#important .row').some(r => r.textContent.includes('Collect feedback')));
});

test('space marks done and hides the task; u brings it back', async () => {
  await fresh();
  keys('j', 'l', ' ');
  eq(task('Sketch new').done, true);
  ok(!selected('tasks').includes('Sketch new'));
  keys('u');
  eq(task('Sketch new').done, false);
});

test('J/K reorder and change the next action', async () => {
  await fresh();
  keys('j', 'l', 'j', 'K');
  ok($('#loops .row.sel .loop-next').textContent.includes('Collect feedback'));
  keys('J');
  ok($('#loops .row.sel .loop-next').textContent.includes('Sketch new landing page'));
});

test('d deletes a task; u undoes', async () => {
  await fresh();
  keys('j', 'l', 'd');
  eq(task('Sketch new'), undefined);
  keys('u');
  ok(task('Sketch new'));
});

test('x / p move a task to another loop', async () => {
  await fresh();
  keys('j', 'l', 'x');
  ok(text('#clip').includes('Sketch new landing page'));
  keys('h', 'j', 'p');
  eq(task('Sketch new').loopId, loop('Quarterly report').id);
  eq(text('#clip'), '');
});

test('a waiting task with a time shows under Waiting, not Timed', async () => {
  await fresh();
  keys('j', 'l', 'o');
  typeInline('Check agent 15:00 @w');
  ok($$('#waiting .row').some(r => r.textContent.includes('Check agent')));
  ok(!$$('#timed .row').some(r => r.textContent.includes('Check agent')));
  keys('w');
  ok($$('#timed .row').some(r => r.textContent.includes('Check agent')), 'back in Timed once not waiting');
});

test('+20m becomes a clock time', async () => {
  await fresh();
  keys('j', 'l', 'o');
  typeInline('Ping colleague +20m');
  eq(task('Ping colleague').title, `Ping colleague ${hhmm(Math.min(nowMin() + 20, 1439))}`);
  keys('r');
  typeInline('+1 for the idea');
  ok(task('+1 for the idea'), 'a unitless +1 stays text');
});

// ── Loops ─────────────────────────────────────────────────────────────────────

test('o in the loops pane adds a loop; d deletes it but keeps its tasks', async () => {
  await fresh();
  keys('j', 'o');
  typeInline('Hiring');
  eq(data().loops.map(l => l.title)[1], 'Hiring');
  keys('k', 'd');
  eq(loop('Website redesign'), undefined);
  eq(task('Sketch new').loopId, null);
});

// ── Search ────────────────────────────────────────────────────────────────────

test('/ jumps to matches, n cycles, esc clears', async () => {
  await fresh();
  keys('l', '/');
  eq(text('#mode'), 'SEARCH');
  const input = $('#searchInput');
  input.value = 'review';
  input.dispatchEvent(new w.Event('input'));
  ok(selected('tasks').includes('review'));
  const first = selected('tasks');
  input.dispatchEvent(event('Enter'));
  eq(text('#mode'), 'TASKS');
  ok(text('#searchInfo').startsWith('/review'));
  keys('n');
  ok(selected('tasks') !== first, 'n moves to the next match');
  ok($$('#tasks mark').length > 0, 'matches highlighted');
  keys('Escape');
  eq($$('#tasks mark').length, 0);
});

// ── Templates ─────────────────────────────────────────────────────────────────

test('T switches to templates and back', async () => {
  await fresh();
  keys('T');
  ok(!$('#tplBadge').hidden);
  eq(text('#loopsTitle'), 'Templates');
  ok(selected('loops').startsWith('Daily planning'));
  keys('T');
  ok($('#tplBadge').hidden);
});

test('t creates a loop from a template', async () => {
  await fresh();
  keys('j', 't');
  ok(!$('#picker').hidden);
  eq(text('#mode'), 'TEMPLATE');
  keys('Enter');
  ok($('#picker').hidden);
  eq(data().loops[1].title, 'Daily planning');
  eq(data().tasks.filter(t => t.loopId === data().loops[1].id).length, 4);
  eq(text('#mode'), 'TASKS');
});

// ── Modal editor ──────────────────────────────────────────────────────────────

test('m opens the note editor in normal mode; :wq saves', async () => {
  await fresh();
  keys('j', 'm');
  ok(modalOpen());
  eq(text('#mode'), 'NOTE NORMAL');
  vim('i');
  eq(text('#mode'), 'NOTE INSERT');
  insert('agent is on it\nnext: check');
  vim('Escape', ':', 'w', 'q', 'Enter');
  ok(!modalOpen());
  eq(loop('Website redesign').note, 'agent is on it\nnext: check');
  ok(text('#loops .row.sel .loop-note').startsWith('✎ agent is on it +1'));
  ok(text('#tasks .note-block').includes('next: check'));
});

test('M opens the note editor too', async () => {
  await fresh();
  keys('j', 'M');
  ok(modalOpen());
  eq(text('#mode'), 'NOTE NORMAL');
});

test(':w keeps editing, :q refuses with changes, :q! discards', async () => {
  await fresh();
  keys('j', 'm');
  vim('i'); insert('one');
  vim('Escape', ':', 'w', 'Enter');
  ok(modalOpen());
  eq(text('#noteMode'), 'written');
  eq(loop('Website redesign').note, 'one');
  vim('x', ':', 'q', 'Enter');
  ok(modalOpen());
  ok(text('#noteMode').startsWith('E37'));
  vim(':', 'q', '!', 'Enter');
  ok(!modalOpen());
  eq(loop('Website redesign').note, 'one');
});

test('esc closes the editor when nothing changed', async () => {
  await fresh();
  keys('j', 'm');
  vim('d', 'Escape');
  ok(modalOpen(), 'the first esc only cancels the pending d');
  vim('Escape');
  ok(!modalOpen());
  keys('R');
  vim('i'); insert('x'); vim('Escape');
  vim('x', 'Escape');
  ok(!modalOpen(), 'changed back to the original counts as unchanged');
});

test('esc with changes does not close; ZZ saves; empty note removes it', async () => {
  await fresh();
  keys('j', 'm');
  vim('i'); insert('x');
  vim('Escape', 'Escape');
  ok(modalOpen());
  vim('Z', 'Z');
  eq(loop('Website redesign').note, 'x');
  keys('m');
  vim('d', 'd', ':', 'w', 'q', 'Enter');
  eq(loop('Website redesign').note, undefined);
});

test('vim motions', async () => {
  await fresh();
  keys('j', 'm');
  modalWith('hello world foo\nsecond line\n  third');
  const at = (ks, expected) => { vim(...ks); eq(modalCursor(), expected, ks.join('')); };
  at(['w'], 6);
  at(['e'], 10);
  at(['$'], 14);
  at(['j'], 26);
  at(['j'], 34);
  at(['^'], 30);
  at(['k', '0'], 16);
  at(['g', 'g'], 0);
  at(['G'], 28);
  at(['2', 'b'], 16);
});

test('vim edits', async () => {
  await fresh();
  keys('j', 'm');
  const cases = [
    ['one two three', 4, ['d', 'w'], 'one |three'],
    ['one two\nnext', 4, ['d', 'w'], 'one| \nnext'],
    ['one two three four', 0, ['2', 'd', 'w'], '|three four'],
    ['one two three four', 0, ['d', '2', 'w'], '|three four'],
    ['one two three', 4, ['c', 'w'], 'one | three'],
    ['one two three', 6, ['c', 'w'], 'one tw| three'],
    ['one   two', 3, ['c', 'w'], 'one|two'],
    ['one two three', 0, ['d', 'e'], '| two three'],
    ['one two three', 8, ['d', 'b'], 'one |three'],
    ['one two three', 4, ['d', '$'], 'one| '],
    ['one two three', 4, ['C'], 'one |'],
    ['first\n  two words\nthird', 8, ['c', 'c'], 'first\n|\nthird'],
    ['one two-three', 5, ['c', 'i', 'w'], 'one |-three'],
    ['one two three', 5, ['d', 'i', 'w'], 'one | three'],
    ['a\nb\nc', 2, ['d', 'd'], 'a\n|c'],
    ['a\nb\nc', 4, ['d', 'd'], 'a\n|b'],
    ['abc', 0, ['x'], '|bc'],
    ['abc', 0, ['A'], 'abc|'],
    ['abc', 1, ['o'], 'abc\n|'],
    ['one two', 0, ['d', 'Escape', 'w'], 'one |two'],
  ];
  for (const [value, cursor, ks, expected] of cases) {
    if (text('#mode').endsWith('INSERT')) vim('Escape');   // back to normal mode after c, o, A
    modalWith(value, cursor);
    vim(...ks);
    eq(withCursor(), expected, `${JSON.stringify(value)} + ${ks.join('')}`);
  }
});

test('R renames in the modal; enter does not add a line', async () => {
  await fresh();
  keys('j', 'R');
  eq(text('#mode'), 'RENAME NORMAL');
  eq(modalText(), 'Website redesign');
  vim('c', 'w');
  insert('Site');
  vim('Enter');
  eq(modalText(), 'Site redesign');
  vim('Escape', ':', 'w', 'q', 'Enter');
  ok(loop('Site redesign'));
  keys('u');
  ok(loop('Website redesign'));
});

// ── Chrome ────────────────────────────────────────────────────────────────────

test('hint line follows the pane', async () => {
  await fresh();
  ok(text('#hints').includes('t new from template'));
  keys('l');
  ok(text('#hints').includes('space done'));
  ok(!text('#hints').includes('t new from template'));
  keys('T');
  ok(text('#hints').startsWith('T back to loops'));
});

test('narrow window: summary line, s toggles the side overlay', async () => {
  await fresh({ width: 900 });
  ok($('#summary').offsetHeight > 0, 'summary visible');
  keys('s');
  ok(doc.body.classList.contains('side-open'));
  keys('Escape');
  ok(!doc.body.classList.contains('side-open'));
});

test('data saved before versioning still loads', async () => {
  await fresh({ stored: {
    loops: [{ id: 'L', title: 'Old loop' }],
    tasks: [{ id: 'a', title: 'Old task @w', loopId: 'L', done: false }],
  } });
  ok(text('#loops').includes('Old loop'));
  keys('j', 'l', 'o');
  typeInline('New');
  eq(data().version, 2);
  ok(task('Old task').waitingSince > 0);
  eq(data().templates, { loops: [], tasks: [] });
});

test('data survives a reload', async () => {
  await fresh();
  keys('j', 'l', 'o');
  typeInline('Persisted');
  w.location.reload();
  await new Promise(r => document.getElementById('app').addEventListener('load', r, { once: true }));
  w = document.getElementById('app').contentWindow;
  doc = w.document;
  ok(task('Persisted'));
  ok($$('#tasks .row').length > 0);
});
