// unit tests for the pure modules

import { test, eq, ok } from './harness.js';
import { toggleToken, isWaiting, timeOf, resolveRelative, displayTitle } from '../src/model/markers.js';
import { openTasks, nextOf, isNext, loopStatus, timedTasks, dueReminders, attention } from '../src/model/queries.js';
import { migrate, stampWaiting, SCHEMA_VERSION } from '../src/model/store.js';
import { parseImport } from '../src/model/import.js';
import { initialVim, vimKey } from '../src/editor/vim.js';
import { age } from '../src/util.js';
import { fromTodoist, pickerOrder, daysOver, dueOf } from '../src/model/todoist.js';

const task = (title, extra = {}) => ({ id: title, title, loopId: null, done: false, ...extra });

// ── Markers ───────────────────────────────────────────────────────────────────

test('markers: toggling @w / @i', () => {
  eq(toggleToken('Call Anna', '@w'), 'Call Anna @w');
  eq(toggleToken('Call @w Anna', '@w'), 'Call Anna');
  ok(isWaiting(task('x @w')));
  ok(!isWaiting(task('mail@work.com')), 'only a separate token counts');
});

test('markers: times and display title', () => {
  eq(timeOf(task('Standup 9:30')), 570);
  eq(timeOf(task('Review 24:00')), null);
  eq(displayTitle(task('Standup 09:30 @i @w')), 'Standup');
});

test('markers: relative times', () => {
  eq(resolveRelative('Ping +20m', 600), 'Ping 10:20');
  eq(resolveRelative('Ping +1h', 600), 'Ping 11:00');
  eq(resolveRelative('Ping +1h30', 600), 'Ping 11:30');
  eq(resolveRelative('Ping 09:00 +15m', 600), 'Ping 10:15', 'replaces an existing time');
  eq(resolveRelative('Late +3h', 23 * 60), 'Late 23:59', 'capped at midnight');
  eq(resolveRelative('+1 for the idea', 600), '+1 for the idea', 'needs a unit');
});

// ── Queries ───────────────────────────────────────────────────────────────────

test('queries: next action skips waiting and done tasks', () => {
  const d = {
    loops: [{ id: 'L', title: 'L' }],
    tasks: [task('a', { loopId: 'L', done: true }), task('b @w', { loopId: 'L' }), task('c', { loopId: 'L' }), task('d', { loopId: 'L' })],
  };
  eq(nextOf(d, 'L').title, 'c');
  ok(isNext(d, d.tasks[2]));
  ok(!isNext(d, d.tasks[3]));
  eq(openTasks(d, 'L').length, 3);
  ok(isNext(d, task('loose')), 'tasks without a loop are each next');
});

test('queries: loop status', () => {
  const d = { loops: [], tasks: [task('w @w', { loopId: 'W' })] };
  eq(loopStatus(d, { id: 'W' }), 'waiting');
  eq(loopStatus(d, { id: 'E' }), 'stale');
  eq(loopStatus(d, { id: null }), 'ok');
});

test('queries: timed tasks are sorted by time', () => {
  eq(timedTasks([task('b 14:00'), task('a 9:00'), task('none')]).map(t => t.title), ['a 9:00', 'b 14:00']);
});

test('queries: attention groups by urgency, each task once', () => {
  const d = {
    loops: [{ id: 'L', title: 'empty loop' }],
    tasks: [
      task('overdue 9:00 @i'),
      task('soon 10:20'),
      task('check back 10:25 @w'),
      task('important @i'),
      task('later 14:00'),
      task('waiting long @w', { waitingSince: 1 }),
      task('waiting short @w', { waitingSince: 5 }),
      task('done 9:30', { done: true }),
    ],
  };
  const g = attention(d, 600);
  const titles = list => list.map(t => t.title);
  eq(titles(g.now), ['overdue 9:00 @i']);
  eq(titles(g.soon), ['soon 10:20', 'check back 10:25 @w']);
  eq(titles(g.important), ['important @i']);
  eq(titles(g.later), ['later 14:00', 'waiting long @w', 'waiting short @w']);
});

test('queries: due reminders', () => {
  const todayStart = 0;
  const old = { createdAt: -1 };
  const tasks = [
    task('due 10:00', old),
    task('too late 9:00', old),
    task('future 11:00', old),
    task('created after 10:05', { createdAt: 10 * 3600e3 + 6 * 60e3 }),
    task('sent 10:00', old),
  ];
  const due = dueReminders(tasks, { now: 600 + 5, todayStart, sent: ['sent 10:00@600'] });
  eq(due.map(t => t.title), ['due 10:00']);
});

// ── Store ─────────────────────────────────────────────────────────────────────

test('store: migrations bring old data to the current version', () => {
  const d = migrate({ loops: [], tasks: [task('x @w')] });
  eq(d.version, SCHEMA_VERSION);
  eq(d.templates, { loops: [], tasks: [] });
  ok(d.tasks[0].waitingSince > 0);
  const current = migrate({ version: SCHEMA_VERSION, loops: [], tasks: [task('y @w')], templates: { loops: [], tasks: [] } });
  eq(current.tasks[0].waitingSince, undefined, 'current data is left alone');
});

test('store: waiting timestamps follow @w', () => {
  const d = { tasks: [task('a @w', { waitingSince: 5 }), task('b @w'), task('c', { waitingSince: 5 }), task('d @w', { done: true, waitingSince: 5 })] };
  stampWaiting(d, 99);
  eq(d.tasks.map(t => t.waitingSince), [5, 99, undefined, undefined]);
});

// ── Import ────────────────────────────────────────────────────────────────────

test('import: keeps well-formed entries, unassigns tasks of unknown loops', () => {
  const d = parseImport(JSON.stringify({
    version: 1,
    loops: [{ id: 'L', title: 'Loop' }, { id: '', title: 'bad' }],
    tasks: [task('a', { loopId: 'L' }), task('b', { loopId: 'gone' }), { id: 'c' }],
  }));
  eq(d.loops.map(l => l.id), ['L']);
  eq(d.tasks.map(t => [t.title, t.loopId]), [['a', 'L'], ['b', null]]);
  eq(d.templates, { loops: [], tasks: [] });
  eq(d.version, SCHEMA_VERSION);
});

test('import: rejects files that are not exports', () => {
  let msg = '';
  try { parseImport('{"foo": 1}'); } catch (err) { msg = err.message; }
  ok(msg.includes('expected'));
});

// ── Vim ───────────────────────────────────────────────────────────────────────

// "|" marks the cursor in both input and expected output
function vim(text, keys) {
  let s = { ...initialVim(text.replace('|', '')), cursor: text.indexOf('|') };
  for (const k of keys) s = vimKey(s, k);
  return s;
}
const show = s => s.text.slice(0, s.cursor) + '|' + s.text.slice(s.cursor);

test('vim: motions', () => {
  eq(show(vim('|one two', ['w'])), 'one |two');
  eq(show(vim('one tw|o', ['b'])), 'one |two');
  eq(show(vim('a|b\ncdef', ['j'])), 'ab\nc|def', 'j keeps the column');
  eq(show(vim('abc|d\nef', ['j', 'k'])), 'abc|d\nef', 'and returns to it');
  eq(show(vim('|a b c d', ['3', 'w'])), 'a b c |d', 'counts');
});

test('vim: operators', () => {
  eq(show(vim('one |two three', ['d', 'w'])), 'one |three');
  eq(show(vim('one |two three', ['c', 'w'])), 'one | three');
  eq(vim('one |two three', ['c', 'w']).mode, 'insert');
  eq(show(vim('|a\nb\nc', ['2', 'd', 'd'])), '|c');
});

test('vim: deletes and yanks go to the register; p / P paste', () => {
  eq(show(vim('|one\ntwo\nthree', ['d', 'd', 'p'])), 'two\n|one\nthree', 'dd p swaps lines');
  eq(show(vim('one\n|two', ['d', 'd', 'P'])), '|two\none', 'last line, P above');
  eq(show(vim('|one\ntwo', ['y', 'y', 'j', 'p'])), 'one\ntwo\n|one', 'yy p below the last line');
  eq(show(vim('|one\ntwo', ['y', 'y', '2', 'P'])), '|one\none\none\ntwo', 'counts');
  eq(show(vim('|abc', ['x', 'p'])), 'b|ac', 'x p swaps characters');
  eq(show(vim('|one two', ['d', 'w', '$', 'p'])), 'twoone| ', 'dw takes the space too; cursor on the last pasted character');
  eq(show(vim('one |two', ['y', 'i', 'w', '0', 'P'])), 'tw|oone two', 'yiw P');
  const s = vim('|keep', ['y', 'y']);
  eq([s.text, s.reg], ['keep', { text: 'keep\n', linewise: true }], 'yank leaves the text');
});

test('vim: insert mode passes typing through, esc goes back', () => {
  const s = vim('ab|c', ['i']);
  eq(vimKey(s, 'x').handled, false);
  const back = vimKey({ ...s, text: 'abxc', cursor: 3 }, 'Escape');
  eq([back.mode, back.cursor], ['normal', 2]);
  eq(vimKey(s, 'Enter', { singleLine: true }).handled, true, 'enter is swallowed in titles');
});

test('vim: : commands report an effect', () => {
  eq(vim('|x', [':', 'w', 'q', 'Enter']).effect, 'save');
  eq(vim('|x', [':', 'w', 'Enter']).effect, 'write');
  eq(vim('|x', [':', 'q', '!', 'Enter']).effect, 'discard');
  eq(vim('|x', ['Z', 'Z']).effect, 'save');
  ok(vim('|x', [':', 'f', 'o', 'Enter']).msg.startsWith('E492'));
  eq(vim('|x', [':', 'w', 'Escape']).cmd, null);
  eq(vim('|x', ['Escape']).effect, 'escape');
  eq(vim('|x', ['d', 'Escape']).effect, null, 'esc first cancels a pending command');
});

// ── Util ──────────────────────────────────────────────────────────────────────

test('util: ages', () => {
  eq(age(0, 30e3), 'now');
  eq(age(0, 5 * 60e3), '5m');
  eq(age(0, 3 * 3600e3), '3h');
  eq(age(0, 50 * 3600e3), '2d');
});

// ── Todoist ───────────────────────────────────────────────────────────────────

const tt = (content, due, extra = {}) => ({ id: content, content, priority: 1, ...(due && { due: { date: due } }), ...extra });

test('todoist: a picked task keeps today\'s time, p1 and the description', () => {
  const today = '2026-11-13';
  eq(fromTodoist(tt('Call Anna', '2026-11-13T14:30:00'), today).title, 'Call Anna 14:30');
  eq(fromTodoist(tt('Call Anna', '2026-11-11T14:30:00'), today).title, 'Call Anna', 'an overdue time is no appointment today');
  eq(fromTodoist(tt('Pay rent', '2026-11-13', { priority: 4 }), today).title, 'Pay rent @i');
  const t = fromTodoist(tt('Plan', '2026-11-13', { description: ' details ' }), today);
  eq([t.todoistId, t.note], ['Plan', 'details']);
  ok(!('note' in fromTodoist(tt('Plan', null), today)));
});

test('todoist: due dates', () => {
  eq(dueOf(tt('x', '2026-11-13')), { date: '2026-11-13', time: null });
  eq(dueOf(tt('x', '2026-11-13T09:05:00')), { date: '2026-11-13', time: 545 });
  eq(daysOver(tt('x', '2026-11-10'), '2026-11-13'), 3);
  eq(daysOver(tt('x', '2026-11-13T08:00:00'), '2026-11-13'), 0);
});

test('todoist: overdue first, then timed, then the rest', () => {
  const list = [tt('undated', null), tt('plain', '2026-11-13'), tt('next week', '2026-11-20'), tt('at 15', '2026-11-13T15:00:00'),
    tt('old', '2026-11-01'), tt('tomorrow 8', '2026-11-14T08:00:00'), tt('at 9', '2026-11-13T09:00:00'), tt('older', '2026-10-01')];
  eq(pickerOrder(list, '2026-11-13').map(t => t.content),
    ['older', 'old', 'at 9', 'at 15', 'plain', 'tomorrow 8', 'next week', 'undated']);
});
