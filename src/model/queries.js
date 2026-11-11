// Questions about a data set `d` ({ loops, tasks }: your loops, or the templates).
// Pure: callers pass the data in.

import { isWaiting, isImportant, timeOf } from './markers.js';

// id null means every loop (and tasks without one)
export const openTasks = (d, id) => d.tasks.filter(t => !t.done && (id === null || t.loopId === id));
// tasks that aren't part of a loop
export const standaloneTasks = d => d.tasks.filter(t => !t.done && t.loopId === null);

// a loop's next action is its first open, non-waiting task; reorder with J/K to change it.
// tasks without a loop stand on their own, so each of them counts as a next action.
export const doable = (d, id) => openTasks(d, id).filter(t => !isWaiting(t));
export const nextOf = (d, id) => doable(d, id)[0];
export function isNext(d, t) {
  if (t.done || isWaiting(t)) return false;
  return t.loopId ? nextOf(d, t.loopId) === t : true;
}

// a real loop without a next action is "waiting" if something is waiting, else "stale"
export function loopStatus(d, l) {
  if (l.id === null || nextOf(d, l.id)) return 'ok';
  return openTasks(d, l.id).some(isWaiting) ? 'waiting' : 'stale';
}

export const timedTasks = tasks => tasks.filter(t => !t.done && timeOf(t) !== null)
  .sort((a, b) => timeOf(a) - timeOf(b));

// ── Attention ──
// What needs you, most urgent first, for the Today panel. Each open task shows once,
// in its most urgent group:
//   now        its time has come (overdue tasks and check-backs of waiting ones)
//   soon       its time is within SOON minutes
//   important  marked @i
//   later      timed later today, or waiting without a check-back time (longest first)
// Times have no date: everything is today.

export const SOON = 30;

export function attention(d, now) {
  const open = d.tasks.filter(t => !t.done);
  const timed = timedTasks(open);
  const groups = {
    now: timed.filter(t => timeOf(t) <= now),
    soon: timed.filter(t => timeOf(t) > now && timeOf(t) <= now + SOON),
  };
  const taken = new Set([...groups.now, ...groups.soon]);
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
