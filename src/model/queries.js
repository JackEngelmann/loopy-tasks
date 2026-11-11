// Questions about a data set `d` ({ loops, tasks }: your loops, or the templates).
// Pure: callers pass the data in.

import { isWaiting, isImportant, timeOf } from './markers.js';

// id null means every loop (and tasks without one)
export const openTasks = (d, id) => d.tasks.filter(t => !t.done && (id === null || t.loopId === id));

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

// the right column: open tasks wherever they live
export const waitingTasks = tasks => tasks.filter(t => !t.done && isWaiting(t));
export const importantTasks = tasks => tasks.filter(t => !t.done && isImportant(t));
export const timedTasks = tasks => tasks.filter(t => !t.done && timeOf(t) !== null)
  .sort((a, b) => timeOf(a) - timeOf(b));

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
