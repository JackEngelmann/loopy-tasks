// Questions about a data set `d` ({ loops, tasks }: your loops, or the templates).
// Pure: callers pass the data in.

import { isWaiting, isImportant, isNotNow, timeOf } from './markers.js';

// the Inbox is a fixed loop id: things captured but not sorted yet. It isn't a loop of
// your own (no next action, never stale); each of its tasks stands on its own.
export const INBOX_ID = 'inbox';

// id null means every loop (and the timed tasks without one)
export const openTasks = (d, id) => d.tasks.filter(t => !t.done && (id === null || t.loopId === id));
// tasks that aren't part of a loop
// open tasks that are work: not-now ones are kept, but don't count anywhere
export const activeTasks = tasks => tasks.filter(t => !isNotNow(t));
// a list as the middle pane shows it: the work first, then what's not for now
export const notNowLast = tasks => [...activeTasks(tasks), ...tasks.filter(isNotNow)];

// a loop's next action is its first open, non-waiting task; reorder with J/K to change it.
// timed tasks without a loop, and Inbox tasks, stand on their own: each counts as a next action.
export const doable = (d, id) => openTasks(d, id).filter(t => !isWaiting(t) && !isNotNow(t));
export const nextOf = (d, id) => doable(d, id)[0];
export function isNext(d, t) {
  if (t.done || isWaiting(t) || isNotNow(t)) return false;
  return t.loopId && t.loopId !== INBOX_ID ? nextOf(d, t.loopId) === t : true;
}

// a real loop without a next action is "waiting" if something is waiting, else "stale"
// (also when only not-now tasks are left: it still needs a next action)
export function loopStatus(d, l) {
  if (l.id === null || nextOf(d, l.id)) return 'ok';
  return openTasks(d, l.id).some(isWaiting) ? 'waiting' : 'stale';
}

// not-now tasks have no appointment: no Today, no reminder
// a wait without a check-back time wants a look every CHECK_EVERY minutes; . resets it
export const CHECK_EVERY = 10;
export const checkDue = (t, nowMs = Date.now()) => !t.done && isWaiting(t) && !isNotNow(t) && timeOf(t) === null
  && nowMs - (t.checkedAt ?? t.waitingSince ?? nowMs) >= CHECK_EVERY * 60_000;

export const timedTasks = tasks => tasks.filter(t => !t.done && !isNotNow(t) && timeOf(t) !== null)
  .sort((a, b) => timeOf(a) - timeOf(b));

// ── Attention ──
// What needs you, most urgent first, for the Today panel. Each open task shows once,
// in its most urgent group:
//   now        its time has come (overdue tasks and check-backs of waiting ones)
//   soon       its time is within SOON minutes
//   check      waiting without a check-back time, not looked at for CHECK_EVERY minutes
//   important  marked @i
//   later      timed later today, or waiting and checked recently (longest first)
// Times have no date: everything is today.

export const SOON = 30;

export function attention(d, now, nowMs = Date.now()) {
  const open = d.tasks.filter(t => !t.done && !isNotNow(t));
  const timed = timedTasks(open);
  const groups = {
    now: timed.filter(t => timeOf(t) <= now),
    soon: timed.filter(t => timeOf(t) > now && timeOf(t) <= now + SOON),
  };
  groups.check = open.filter(t => checkDue(t, nowMs));
  const taken = new Set([...groups.now, ...groups.soon, ...groups.check]);
  groups.important = open.filter(t => isImportant(t) && !taken.has(t));
  groups.important.forEach(t => taken.add(t));
  groups.later = [
    ...timed.filter(t => !taken.has(t)),
    ...open.filter(t => isWaiting(t) && timeOf(t) === null && !taken.has(t))
      .sort((a, b) => (a.waitingSince || 0) - (b.waitingSince || 0)),
  ];
  return groups;
}

// ── Reminders ──

const LATE_WINDOW = 15;   // still remind up to 15 min late, e.g. after the laptop wakes up

// sent reminders are keyed on the time as well, so changing a task's time reminds again
export const reminderKey = t => `${t.id}@${timeOf(t)}`;

// the timed tasks to remind about at minute `now`: not ones created after their minute,
// nor ones more than LATE_WINDOW late, nor ones already in `sent`
export function dueReminders(tasks, { now, todayStart, sent }) {
  return timedTasks(tasks).filter(t => {
    const time = timeOf(t);
    return time <= now && now - time <= LATE_WINDOW
      && (t.createdAt || 0) < todayStart + (time + 1) * 60_000
      && !sent.includes(reminderKey(t));
  });
}
