// end-to-end tests: the real app in an iframe, driven by key events, checked through
// the DOM and what it saved to localStorage. Each test starts from the seed data.

import { test, eq, ok } from './harness.js';
import { CHECK_EVERY } from '../src/model/queries.js';

const STORAGE_KEY = 'loops-v1';
let w, doc;

async function fresh({ width = 1400, stored = null } = {}) {
  localStorage.removeItem(STORAGE_KEY);
  if (stored) localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  localStorage.removeItem('loopy-notified');
  localStorage.removeItem('loopy-layout');
  localStorage.removeItem('loopy-check-every');
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
const focused = pane => $(`#${pane}Pane`).classList.contains('focused');
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

// the rows of one group at the top of the loops pane (Now, Check), as text
function group(name) {
  const rows = [];
  let inside = false;
  for (const li of $$('#loops li')) {
    if (li.classList.contains('divider')) break;
    if (li.classList.contains('tier')) inside = li.classList.contains(name);
    else if (inside) rows.push(li.textContent.replace(/\s+/g, ' '));
  }
  return rows.join(' | ');
}

const checkRows = () => $$('#loops .check-row').map(r => r.textContent.replace(/\s+/g, ' ').trim());
const hhmm = min => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

// ── Layout and navigation ─────────────────────────────────────────────────────

test('seed data: four loops, two one-step loops, then All and the Inbox at the bottom', async () => {
  await fresh();
  const rows = $$('#loops .row[data-i]');
  eq(rows.length, 8);
  eq(rows.slice(-2).map(r => r.querySelector('.name').textContent), ['All', 'Inbox']);
  ok($('#loops .filler'), 'a filler pushes them down');
  const pane = $('#loops').getBoundingClientRect(), inbox = rows.at(-1).getBoundingClientRect();
  ok(pane.bottom - inbox.bottom < 12, 'the Inbox sits at the bottom edge');
  ok(selected('loops').startsWith('Website redesign'), 'the cursor starts on the first loop');
  eq($$('#tasks .row').length, 5);
});

test('j selects a loop, l moves into its tasks', async () => {
  await fresh();
  ok(selected('loops').startsWith('Website redesign'));
  eq(text('#tasksTitle'), 'Website redesign');
  keys('l');
  ok(focused('tasks'));
  ok(selected('tasks').includes('Sketch new landing page'));
  keys('h');
  ok(focused('loops'));
  ok($('#mode').hidden, 'no mode label in normal mode');
});

test('g / G jump to first and last', async () => {
  await fresh();
  keys('G');
  ok(selected('loops').startsWith('Inbox'), selected('loops'));
  keys('g');
  ok(selected('loops').startsWith('Website redesign'));
});

test('stale loop is yellow, waiting-only loop is teal', async () => {
  await fresh();
  ok($$('#loops .row.stale').some(r => r.textContent.includes('Team offsite')));
  ok($$('#loops .row.waiting-loop').some(r => r.textContent.includes('Quarterly report')));
});

// ── Editing tasks ─────────────────────────────────────────────────────────────

test('o adds a task below the selected one', async () => {
  await fresh();
  keys('l', 'o');
  eq(text('#mode'), 'INSERT');
  typeInline('New thing');
  const web = loop('Website redesign').id;
  const titles = data().tasks.filter(t => t.loopId === web).map(t => t.title);
  eq(titles.indexOf('New thing'), titles.indexOf('Sketch new landing page @i') + 1);
  ok(selected('tasks').includes('New thing'));
});

test('O adds above; esc cancels an inline edit', async () => {
  await fresh();
  keys('l', 'O');
  typeInline('Above', 'Escape');
  eq(task('Above'), undefined);
  keys('O');
  typeInline('Above');
  const web = loop('Website redesign').id;
  eq(data().tasks.filter(t => t.loopId === web)[0].title, 'Above');
});

test('r renames inline', async () => {
  await fresh();
  keys('l', 'r');
  typeInline('Sketch the landing page @i');
  ok(task('Sketch the landing page'));
});

test('w marks waiting with a timestamp and a note hint, w again clears it', async () => {
  await fresh();
  keys('l', 'j', 'w');
  ok(task('Collect feedback').title.endsWith('@w'));
  ok(task('Collect feedback').waitingSince > 0, 'waitingSince set');
  eq(text('#flash'), '+20m in the title (r) sets a check-back · m to note where you left off');
  keys('w');
  eq(task('Collect feedback').title, 'Collect feedback on current site');
  eq(task('Collect feedback').waitingSince, undefined);
  keys('r');
  typeInline('Collect feedback 15:00 @w');
  keys('w');
  eq(task('Collect feedback').title, 'Collect feedback', 'w on a waiting task drops its check-back time too');
});

test('i marks important: a star on the task and on its loop', async () => {
  await fresh();
  keys('j', 'l', 'i');   // Quarterly report
  ok(task('Draft sent').title.endsWith('@i'));
  ok($('#tasks .row.sel .star'));
  ok(selected('loops').includes('★'));
});

test('space marks done and hides the task; u brings it back', async () => {
  await fresh();
  keys('l', ' ');
  eq(task('Sketch new').done, true);
  ok(!selected('tasks').includes('Sketch new'));
  keys('u');
  eq(task('Sketch new').done, false);
});

test('J/K reorder and change the next action', async () => {
  await fresh();
  keys('l', 'j', 'K');
  ok($('#loops .row.sel .loop-next').textContent.includes('Collect feedback'));
  keys('J');
  ok($('#loops .row.sel .loop-next').textContent.includes('Sketch new landing page'));
});

test('d deletes a task; u undoes', async () => {
  await fresh();
  keys('l', 'd');
  eq(task('Sketch new'), undefined);
  keys('u');
  ok(task('Sketch new'));
});

test('x / p move a task to another loop', async () => {
  await fresh();
  keys('l', 'x');
  ok(text('#clip').includes('Sketch new landing page'));
  keys('h', 'j', 'p');
  eq(task('Sketch new').loopId, loop('Quarterly report').id);
  eq(text('#clip'), '');
});

test('top of the loops pane: times still ahead in one line, Now once their time has come, with a badge', async () => {
  await fresh();
  keys('l', 'o');
  typeInline('Check agent @w +10m');
  ok(text('#loops .timeline').includes('◷ Check agent'), text('#loops .timeline'));   // unless it's just before midnight
  keys('o');
  typeInline(`Overdue thing ${hhmm(Math.max(nowMin() - 5, 0))}`);
  ok(group('now').includes('Overdue thing'), group('now'));
  ok(group('now').includes('Website redesign · 5m late'), group('now'));
  ok(!$('#nowBadge').hidden);
  ok(doc.title.startsWith('('), 'tab title has the count');
  ok($$('#tasks .row.due').some(r => r.textContent.includes('Overdue thing')), 'overdue in the middle pane too');
  keys(' ');
  ok(!group('now').includes('Overdue thing'));
});

test('nothing on top when nothing is due', async () => {
  // an empty store would get the seed data, which has overdue tasks
  await fresh({ stored: { version: 2, loops: [{ id: 'L', title: 'Calm loop' }], tasks: [], templates: { loops: [], tasks: [] } } });
  keys('l', 'o');
  typeInline('Something @i');
  ok(!$('#loops .tier') && !$('#loops .divider'), 'no Now, no Check');
  ok($('#nowBadge').hidden, 'badge hidden');
  ok($('#loops .row.first').textContent.includes('Calm loop'), 'green: the thing to do');
});

test('+20m becomes a clock time', async () => {
  await fresh();
  keys('l', 'o');
  typeInline('Ping colleague +20m');
  eq(task('Ping colleague').title, `Ping colleague ${hhmm(Math.min(nowMin() + 20, 1439))}`);
  keys('r');
  typeInline('+1 for the idea');
  ok(task('+1 for the idea'), 'a unitless +1 stays text');
});

// ── Loops ─────────────────────────────────────────────────────────────────────

test('o in the loops pane adds a loop; d deletes it but keeps its tasks', async () => {
  await fresh();
  keys('o');
  typeInline('Hiring');
  eq(data().loops.map(l => l.title)[1], 'Hiring');
  keys('k', 'd');
  eq(loop('Website redesign'), undefined);
  eq(task('Sketch new').loopId, 'inbox', 'its tasks go to the Inbox');
});

test('S adds a one-step loop: one line, keys act on its task, done takes it away', async () => {
  await fresh();
  keys('S');   // below Website redesign
  typeInline('Answer Anna @i');
  const l = data().loops[1];
  eq([l.title, l.single], ['Answer Anna', true]);
  eq(task('Answer Anna').loopId, l.id);
  ok($('#loops .row.sel').classList.contains('single'));
  ok(selected('loops').includes('★'), 'its markers show on the row');
  keys('w');
  ok(task('Answer Anna').title.includes('@w'), 'w on the row marks its task');
  keys('w', 'r');
  typeInline('Answer Anna and Ben');
  eq(loop('Answer Anna and Ben').single, true, 'renamed together with its task');
  keys(' ');
  eq(loop('Answer Anna and Ben'), undefined, 'done: the loop goes away');
  keys('u');
  ok(loop('Answer Anna and Ben'));
  keys('l', 'o');
  typeInline('Ask Ben first');
  eq(loop('Answer Anna and Ben').single, undefined, 'a second step makes it a normal loop');
});

test('space on a loop row finishes it once nothing is open; d sends its tasks to the Inbox', async () => {
  await fresh();
  keys(' ');
  ok(loop('Website redesign'));
  ok(text('#flash').includes('open tasks left'));
  keys('d');
  eq(loop('Website redesign'), undefined);
  eq(task('Sketch new').loopId, 'inbox');
  eq(task('Design review').loopId, null, 'a timed task needs no loop');
  keys('o');
  typeInline('Tiny');
  keys(' ');
  eq(loop('Tiny'), undefined);
  ok(text('#flash').includes('finished'));
});

test('. checks waits: a task, or a whole loop at once; the Check row says how many', async () => {
  const ago = min => Date.now() - min * 60_000;
  await fresh({ stored: { version: 3, templates: { loops: [], tasks: [] }, loops: [{ id: 'L', title: 'Agents' }, { id: 'M', title: 'Quiet' }], tasks: [
    { id: 'a', title: 'Agent A @w', loopId: 'L', done: false, waitingSince: ago(20) },
    { id: 'b', title: 'Agent B @w', loopId: 'L', done: false, waitingSince: ago(30), checkedAt: ago(12) },
    { id: 'c', title: 'Agent C @w', loopId: 'L', done: false, waitingSince: ago(CHECK_EVERY - 1) },
    { id: 'd', title: 'Write', loopId: 'M', done: false },
  ] } });
  eq(checkRows(), ['◷Agents2 of 3 · oldest 20m'], 'C is not due yet');
  keys('l', '.');
  ok(task('Agent A').checkedAt > ago(1));
  eq(checkRows(), ['◷Agents1 of 3 · 12m']);
  ok(text('#flash').includes(`again in ${CHECK_EVERY}m`));
  keys('h', '.');
  eq(checkRows(), [], 'the loop row checks all its waits');
  ok(text('#flash').includes('checked 3'));
  keys('j', '.');
  ok(text('#flash').includes('nothing waiting'));
});

// ── The top of the loops pane: Now, Check, the green loop ──────────────────────

// two agents due for a look in the top loop, something to do in the second, a folded third
function agentDay() {
  const ago = min => Date.now() - min * 60_000;
  const t = (id, title, loopId, extra = {}) => ({ id, title, loopId, done: false, createdAt: 1, ...extra });
  return { version: 3, templates: { loops: [{ id: 'T', title: 'Tpl' }], tasks: [] },
    loops: [{ id: 'W', title: 'Web' }, { id: 'L', title: 'Loopy' }, { id: 'A', title: 'Answer Anna', single: true }, { id: 'Q', title: 'Report' }],
    tasks: [
      t('w1', 'Agent one @w', 'W', { waitingSince: ago(30) }),
      t('w2', 'Agent two @w', 'W', { waitingSince: ago(20) }),
      t('w3', 'Agent three @w', 'W', { waitingSince: ago(CHECK_EVERY - 1) }),
      t('l1', 'Review the diff', 'L'),
      t('l2', 'Update the README', 'L'),
      t('a1', 'Answer Anna', 'A'),
      t('q1', 'Write the summary', 'Q'),
      t('q2', 'Waiting on finance @w', 'Q', { waitingSince: ago(40) }),
    ] };
}

test('top of the loops pane: Check rows per loop, and the first loop you can do something in is green', async () => {
  await fresh({ stored: agentDay() });
  ok(!$('.side') && !$('#today'), 'no Today panel');
  eq(checkRows(), ['◷Web2 of 3 · oldest 30m', '◷Report1 · 40m']);
  ok($('#loops .row.first').textContent.includes('Loopy'), 'Web is all waiting, so Loopy is green');
  ok($('#loops .row.first').textContent.includes('Review the diff'));
  keys(']');
  ok($('#loops .check-row.sel').textContent.includes('Web'));
  keys(']', ']');
  ok(selected('loops').startsWith('Loopy'), '] ends at the green loop');
  keys('[');
  ok($('#loops .check-row.sel').textContent.includes('Report'));
  $('#loops .check-row').click();
  ok($('#loops .check-row.sel').textContent.includes('Web'), 'a click puts the cursor there');
  $$('#loops .row[data-i]').find(r => r.textContent.includes('Report')).click();
  ok(selected('loops').startsWith('Report'));
  ok(!$('#loops .check-row.sel'));
});

test('Check rows: the cursor stops on them above the loops; . checks the loop and moves on, l opens it', async () => {
  await fresh({ stored: agentDay() });
  keys('k');
  ok($('#loops .check-row.sel').textContent.includes('Report'), 'k from the top goes up into the Check rows');
  eq(text('#tasksTitle'), 'Report', 'the middle pane shows its loop');
  ok(!$('#loops .row[data-i].sel'), 'one cursor');
  keys('k');
  ok($('#loops .check-row.sel').textContent.includes('Web'));
  keys('j', 'j');
  ok(selected('loops').startsWith('Web'), 'j past the last one goes on to the loops');
  keys('g');
  ok($('#loops .check-row.sel').textContent.includes('Web'), 'g: the first Check row');
  keys('l');
  ok(focused('tasks'));
  ok(selected('tasks').includes('Agent one'), 'l opens the loop on its first wait due');
  keys('h', 'g', '.');
  ok(task('Agent one').checkedAt && task('Agent three').checkedAt, '. checks the whole loop');
  ok($('#loops .check-row.sel').textContent.includes('Report'), 'and moves on to the next Check row');
  keys('.');
  eq(checkRows(), []);
  ok(selected('loops').startsWith('Loopy'), 'after the last one: the green loop');
});

test(':check sets how long a wait goes without a look', async () => {
  await fresh({ stored: agentDay() });
  eq(checkRows().length, 2);
  command('check 45');
  eq(checkRows(), [], 'none has gone 45 minutes');
  ok(text('#flash').includes('every 45 min'));
  eq(w.localStorage.getItem('loopy-check-every'), '45');
  command('check');
  ok(text('#flash').includes('every 45 min'));
  command('check 0');
  ok(text('#flash').includes('1 to 240'));
});

test('] and [ work when typed with Option or AltGr (German keyboards); real shortcuts stay with the browser', async () => {
  await fresh({ stored: agentDay() });
  doc.body.dispatchEvent(event(']', { altKey: true }));   // macOS German: Option+6
  const onWeb = () => $('#loops .check-row.sel')?.textContent.includes('Web');
  ok(onWeb());
  doc.body.dispatchEvent(event('j', { metaKey: true }));
  ok(onWeb(), 'Cmd+j is not j');
  doc.body.dispatchEvent(event('j', { ctrlKey: true }));
  ok(onWeb(), 'Ctrl+j is not j');
});

// ── Search ────────────────────────────────────────────────────────────────────

// typing into the c input
function capture(value, key = 'Enter') {
  keys('c');
  ok(!$('#captureBox').hidden, 'capture input is open');
  $('#captureInput').value = value;
  $('#captureInput').dispatchEvent(event(key));
}

test('c captures into the Inbox from anywhere; the Inbox is yellow while not empty', async () => {
  await fresh();
  keys('G');
  ok(selected('loops').startsWith('Inbox'), selected('loops'));
  ok(selected('loops').includes('Nothing to sort'));
  ok(!$('#loops .row.sel').classList.contains('inbox-full'));
  keys('g', 'l', 'j');   // the second task of Website redesign
  const before = selected('tasks');
  capture('Call the bank +20m');
  eq(task('Call the bank').loopId, 'inbox');
  ok(/Call the bank \d\d:\d\d/.test(task('Call the bank').title), 'markers work as when typing a task');
  eq(selected('tasks'), before, 'the cursor stays where it was');
  ok(focused('tasks'));
  capture('never mind', 'Escape');
  ok(!task('never mind'));
  const inbox = $$('#loops .row[data-i]').at(-1);
  ok(inbox.classList.contains('inbox-full'));
  eq(inbox.querySelector('.count').textContent, '1');
  ok(inbox.textContent.includes('▸ Call the bank'));
});

test('the Inbox keeps its tasks apart from your loops', async () => {
  await fresh();
  keys('G', 'l', 'o');
  typeInline('Idea for the offsite');
  eq(task('Idea for the offsite').loopId, 'inbox');
  ok(text('#tasks .row').startsWith('▸'), 'each Inbox task stands on its own');
  keys('h', 'g');
  ok(!text('#tasks').includes('Idea for the offsite'), 'not in a loop');
  keys('G', 'r', 'm', 'd');
  ok(selected('loops').startsWith('Inbox'), 'r, m and d leave the Inbox alone');
  ok(!modalOpen());
  keys('k');
  ok(text('#tasks').includes('[Inbox]'), 'All tags them');
  // sorting: x in the Inbox, p on a loop
  keys('j', 'l', 'x', 'h', 'g', 'p');
  eq(task('Idea for the offsite').loopId, loop('Website redesign').id);
  ok(!$$('#loops .row[data-i]').at(-1).classList.contains('inbox-full'), 'empty again');
});

test('c is off in template mode', async () => {
  await fresh();
  keys('T', 'c');
  ok($('#captureBox').hidden);
});

test('z: not now moves a task to the end of its loop and out of the work', async () => {
  await fresh();
  keys('l');   // Website redesign: Sketch new landing page @i is the next action
  const count = () => text('#loops .row.sel .count');
  eq(count(), '5');
  keys('z');
  eq(task('Sketch new').title, 'Sketch new landing page @i @n');
  ok(text('#tasks .tier.not-now').startsWith('Not now'));
  ok(text('#tasks .row:last-child').includes('Sketch new landing page'), 'last, under the heading');
  ok($('#tasks .row:last-child').classList.contains('not-now'));
  ok(selected('loops').includes('▸ Collect feedback'), 'the next action moves on');
  eq(count(), '4', 'not counted');
  ok(!group('now').includes('Sketch new'));
  ok(selected('tasks').includes('Collect feedback'), 'the cursor stays in place');
  // o on a not-now task adds another one
  keys('G', 'o');
  typeInline('Try a serif headline');
  eq(task('Try a serif').title, 'Try a serif headline @n');
  // K can't lift it above the heading; z again brings it back
  keys('g', 'G', 'k');
  ok(selected('tasks').includes('Sketch new'));
  keys('K');
  ok(text('#tasks .row:last-child').includes('Try a serif'), 'K stays within Not now');
  keys('z');
  eq(task('Sketch new').title, 'Sketch new landing page @i');
});

test('z ends a wait (and the other way round); a loop with only not-now tasks is yellow', async () => {
  await fresh();
  keys('j', 'l');   // Quarterly report: one waiting task
  keys('z');
  eq(task('Draft sent').title, 'Draft sent to finance for review @n');
  ok($('#loops .row.sel').classList.contains('stale'));
  ok(selected('loops').includes('Only not-now tasks'));
  keys('w');
  eq(task('Draft sent').title, 'Draft sent to finance for review @w');
});

test('z is for loops only', async () => {
  await fresh();
  capture('Inbox idea');
  keys('G', 'l', 'z');
  eq(task('Inbox idea').title, 'Inbox idea');
  ok(text('#flash').includes(':park'));
});

test('/ jumps to matches, n cycles, esc clears', async () => {
  await fresh();
  keys('G', 'k', 'l', '/');   // All
  eq(text('#mode'), 'SEARCH');
  const input = $('#searchInput');
  input.value = 'review';
  input.dispatchEvent(new w.Event('input'));
  ok(selected('tasks').includes('review'));
  const first = selected('tasks');
  input.dispatchEvent(event('Enter'));
  ok($('#mode').hidden);
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
  keys('t');
  ok(!$('#picker').hidden);
  eq(text('#mode'), 'TEMPLATE');
  keys('Enter');
  ok($('#picker').hidden);
  eq(data().loops[1].title, 'Daily planning');
  eq(data().tasks.filter(t => t.loopId === data().loops[1].id).length, 4);
  ok(focused('tasks'));
});

// ── Todoist ───────────────────────────────────────────────────────────────────

// a fake serve.py: answers the list requests and records what is sent
function fakeTodoist(tasks) {
  const sent = [];
  w.fetch = async (url, opts = {}) => {
    sent.push({ url, method: opts.method, body: opts.body && JSON.parse(opts.body), headers: opts.headers });
    const results = url.includes('/projects') ? [{ id: 'P', name: 'Home' }] : url.includes('/tasks/filter') ? tasks : null;
    return { ok: true, status: 200, json: async () => results ? { results, next_cursor: null } : { id: 'new' } };
  };
  return sent;
}
const settle = () => new Promise(r => setTimeout(r, 0));
const today = () => new Date().toLocaleDateString('sv');   // YYYY-MM-DD

function command(line) {
  keys(':');
  $('#cmdInput').value = line;
  $('#cmdInput').dispatchEvent(event('Enter'));
}

test('without serve.py, a says how to start it', async () => {
  await fresh();
  // a plain file server answers the Todoist route with an HTML 404
  w.fetch = async () => ({ ok: false, status: 404, json: async () => { throw new SyntaxError('not JSON'); } });
  keys('a');
  await settle();
  ok(text('#todoist').includes('python3 serve.py'));
});

test('serve.py\'s errors show in the list', async () => {
  await fresh();
  w.fetch = async () => ({ ok: false, status: 503, json: async () => ({ error: 'no TODOIST_TOKEN in .env' }) });
  keys('a');
  await settle();
  ok(text('#todoist').includes('Todoist: no TODOIST_TOKEN in .env'));
});

test('a lists Todoist tasks; enter adds the selected one to the loop', async () => {
  await fresh();
  const sent = fakeTodoist([
    { id: '1', content: 'Water plants', project_id: 'P', priority: 1, due: { date: today() } },
    { id: '2', content: 'Call Anna', project_id: 'P', priority: 4, due: { date: `${today()}T14:30:00` }, description: 'about the trip' },
  ]);
  keys('a');
  ok(!$('#todoist').hidden);
  eq(text('#mode'), 'TODOIST');
  await settle();
  eq($$('#todoist .row').length, 2);
  ok(text('#todoist .row.sel').includes('14:30'), 'timed tasks first');
  ok(text('#todoist .row.sel').includes('Home'), 'with the project');
  ok(sent.every(r => r.url.startsWith('todoist/') && !r.headers.Authorization), 'through serve.py, without a token');
  keys('Enter');
  ok($('#todoist').hidden);
  const t = task('Call Anna');
  eq([t.title, t.loopId, t.todoistId, t.note], ['Call Anna 14:30 @i', loop('Website redesign').id, '2', 'about the trip']);
  ok(sent.every(r => !r.method || r.method === 'GET'), 'Todoist is left as it is');
});

test('space marks several; picked ones are not offered again', async () => {
  await fresh();
  fakeTodoist(['A', 'B', 'C'].map(c => ({ id: c, content: `Todo ${c}`, project_id: 'P', priority: 1, due: { date: today() } })));
  keys('G', 'a');
  await settle();
  keys(' ', ' ', 'Enter');
  eq(data().tasks.filter(t => t.todoistId).map(t => [t.title, t.loopId]), [['Todo A', 'inbox'], ['Todo B', 'inbox']]);
  command('pick');
  await settle();
  eq($$('#todoist .row.picked').length, 2);
  keys('Enter');
  eq(data().tasks.filter(t => t.todoistId).length, 2, 'enter on a picked task adds nothing');
});

test(':pick @label asks Todoist for that filter', async () => {
  await fresh();
  const sent = fakeTodoist([{ id: '1', content: 'Write report', project_id: 'P', priority: 1, labels: ['arbeit'] }]);
  command('pick @arbeit');
  await settle();
  ok(decodeURIComponent(sent[0].url).includes('query=@arbeit'));
  eq(text('#todoistTitle'), 'Todoist · @arbeit');
  eq($$('#todoist .row').length, 1);
});

test(':park sends the task to Todoist and removes it here', async () => {
  await fresh();
  const sent = fakeTodoist([]);
  keys('l');   // Sketch new landing page @i
  command('park tomorrow');
  await settle();
  const req = sent.at(-1);
  eq([req.method, req.body], ['POST', { content: 'Sketch new landing page', priority: 4, due_string: 'tomorrow' }]);
  ok(!task('Sketch new landing page'));
  ok(text('#flash').includes('parked'));
});

test(':park on a picked task only removes it, or moves its date', async () => {
  await fresh({ stored: { version: 3, loops: [], templates: { loops: [], tasks: [] }, tasks: [
    { id: 'a', title: 'From Todoist', todoistId: '7', loopId: 'inbox', done: false },
    { id: 'b', title: 'Also from Todoist', todoistId: '8', loopId: 'inbox', done: false },
  ] } });
  const sent = fakeTodoist([]);
  keys('G', 'l');
  command('park');
  await settle();
  eq(sent.length, 0);
  ok(!task('From Todoist'));
  command('park fri');
  await settle();
  eq([sent[0].url.endsWith('/tasks/8'), sent[0].body], [true, { due_string: 'fri' }]);
  eq(data().tasks.length, 0);
});

// ── Modal editor ──────────────────────────────────────────────────────────────

test('m opens the note editor in normal mode; :wq saves', async () => {
  await fresh();
  keys('m');
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
  keys('M');
  ok(modalOpen());
  eq(text('#mode'), 'NOTE NORMAL');
});

test('normal mode shows a block cursor on an empty line too', async () => {
  await fresh();
  keys('m');
  const block = $('#noteCursor');
  ok(!block.hidden, 'empty note: the drawn block');
  const area = note().getBoundingClientRect(), b = block.getBoundingClientRect();
  ok(b.top >= area.top && b.left >= area.left && b.bottom <= area.bottom, 'inside the text box');
  vim('i'); insert('text\n\nmore'); vim('Escape');
  ok(block.hidden, 'on a character: the selection is the block');
  vim('k');
  ok(!block.hidden, 'empty line');
  ok(block.getBoundingClientRect().top > b.top, 'on the second line');
  vim('i');
  ok(block.hidden, 'insert mode: the normal caret');
  vim('Escape', ':', 'q', '!', 'Enter');
  ok(block.hidden);
});

test(':w keeps editing, :q refuses with changes, :q! discards', async () => {
  await fresh();
  keys('m');
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
  keys('m');
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
  keys('m');
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
  keys('m');
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
  keys('m');
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

test('dd then p moves a line; the register survives reopening the editor', async () => {
  await fresh();
  keys('m');
  vim('i'); insert('first\nsecond'); vim('Escape', 'g', 'g', 'd', 'd', 'p');
  eq(modalText(), 'second\nfirst');
  vim(':', 'w', 'q', 'Enter');
  keys('j', 'm');
  vim('p');
  eq(modalText(), '\nfirst', 'pasted into the next note');
  vim(':', 'q', '!', 'Enter');
});

test('editor: short hint line, ? shows all keys over it', async () => {
  await fresh();
  keys('m');
  eq(text('#hints'), 'i insert  :wq/ZZ save  :q! discard  ? all keys');
  vim('?');
  ok(!$('#help').hidden);
  ok(modalOpen(), 'the editor stays open');
  ok(text('#helpBody').includes('yank, paste after/before'));
  vim('j');
  ok($('#help').hidden, 'any key closes it');
  eq(modalCursor(), 0, 'and does nothing else');
  vim(':', 'q', 'Enter');
});

test('R renames in the modal; enter does not add a line', async () => {
  await fresh();
  keys('R');
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

test('hint line shows the essentials for the pane', async () => {
  await fresh();
  ok(text('#hints').includes('t new from template'));
  ok(text('#hints').endsWith('? all keys'));
  ok(!text('#hints').includes('undo'), 'the rest is in ?');
  keys('l');
  ok(text('#hints').includes('space done'));
  ok(!text('#hints').includes('t new from template'));
  keys('T');
  ok(text('#hints').startsWith('T back to loops'));
  eq(text('#crumb'), 'editing templates');
});

test('? lists every key; esc closes it', async () => {
  await fresh();
  keys('?');
  ok(!$('#help').hidden);
  eq(text('#mode'), 'HELP');
  for (const label of ['undo', 'rename in the editor', 'first/last', 'download all data as a file', 'save, stay']) {
    ok(text('#helpBody').includes(label), label);
  }
  keys('j');
  ok(!$('#help').hidden, 'other keys do nothing while it is open');
  ok(selected('loops').startsWith('Website redesign'));
  keys('Escape');
  ok($('#help').hidden);
});

test(': opens the command line; unknown commands say so', async () => {
  await fresh();
  keys(':');
  ok(!$('#cmdBox').hidden);
  eq(text('#mode'), 'COMMAND');
  ok(text('#hints').includes(':export'));
  const input = $('#cmdInput');
  input.value = 'nope';
  input.dispatchEvent(event('Enter'));
  ok($('#cmdBox').hidden);
  ok(text('#flash').startsWith('not a command: nope'));
  keys(':');
  $('#cmdInput').dispatchEvent(event('Escape'));
  ok($('#cmdBox').hidden);
  eq(text('#flash'), '');
});

test('dragging the edge resizes the loops pane; double-click resets', async () => {
  await fresh();
  const handle = $('#loopsSplitter');
  const pane = $('#loopsPane');
  const before = pane.offsetWidth;
  const left = $('main').getBoundingClientRect().left;
  const pointer = (type, x) => handle.dispatchEvent(new w.PointerEvent(type, { clientX: x, bubbles: true, pointerId: 1 }));
  pointer('pointerdown', left + 8 + before);
  pointer('pointermove', left + 8 + 500);
  pointer('pointerup', left + 8 + 500);
  eq(pane.offsetWidth, 500);
  eq(JSON.parse(w.localStorage.getItem('loopy-layout')), { 'loops-wide': 500 });
  pointer('pointerdown', 0);
  pointer('pointermove', 0);
  pointer('pointerup', 0);
  eq(pane.offsetWidth, 180, 'not narrower than the minimum');
  handle.dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true }));
  eq(pane.offsetWidth, before);
  eq(JSON.parse(w.localStorage.getItem('loopy-layout')), {});
});

test('data saved before versioning still loads', async () => {
  await fresh({ stored: {
    loops: [{ id: 'L', title: 'Old loop' }],
    tasks: [{ id: 'a', title: 'Old task @w', loopId: 'L', done: false }],
  } });
  ok(text('#loops').includes('Old loop'));
  keys('l', 'o');
  typeInline('New');
  eq(data().version, 3);
  ok(task('Old task').waitingSince > 0);
  eq(data().templates, { loops: [], tasks: [] });
});

test('data survives a reload', async () => {
  await fresh();
  keys('l', 'o');
  typeInline('Persisted');
  w.location.reload();
  await new Promise(r => document.getElementById('app').addEventListener('load', r, { once: true }));
  w = document.getElementById('app').contentWindow;
  doc = w.document;
  ok(task('Persisted'));
  ok($$('#tasks .row').length > 0);
});
