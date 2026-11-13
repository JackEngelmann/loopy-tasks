// Todoist tasks as Loopy sees them: what a picked task becomes, and the picker's order.
// Pure; the requests are in features/todoist.js.

import { fmtTime } from './markers.js';

// "2026-11-13" in local time
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// due.date is "2026-11-13", or with a time "2026-11-13T14:30:00" (floating) or "…Z" (fixed zone);
// older responses have the time in due.datetime instead
export function dueOf(tt) {
  if (!tt.due) return { date: null, time: null };
  const at = tt.due.datetime || tt.due.date;
  if (at.length <= 10) return { date: at, time: null };
  const d = new Date(at);   // without a zone this is local time, with one it's converted to local
  return { date: localDate(d), time: d.getHours() * 60 + d.getMinutes() };
}

// days a task is overdue; 0 when it's due today or later
export function daysOver(tt, today = localDate()) {
  const { date } = dueOf(tt);
  if (!date || date >= today) return 0;
  return Math.round((new Date(today) - new Date(date)) / 86_400_000);
}

// the Loopy task a Todoist task becomes: today's time as a marker, p1 as important,
// the description as the note. The id keeps it from being picked twice.
export function fromTodoist(tt, today = localDate()) {
  const { date, time } = dueOf(tt);
  let title = tt.content.trim();
  if (date === today && time !== null) title += ` ${fmtTime(time)}`;
  if (tt.priority === 4) title += ' @i';
  const task = { title, todoistId: tt.id };
  if (tt.description && tt.description.trim()) Object.assign(task, { note: tt.description.trim(), noteAt: Date.now() });
  return task;
}

// overdue first (oldest first), then today's timed tasks by time, the rest of today,
// later days by date, and tasks without a date; otherwise in Todoist's order
export function pickerOrder(tasks, today = localDate()) {
  const key = tt => {
    const { date, time } = dueOf(tt);
    if (!date) return [4, '', 0];
    if (date < today) return [0, date, 0];
    if (date > today) return [3, date, time ?? 0];
    return time !== null ? [1, '', time] : [2, '', 0];
  };
  return tasks
    .map((tt, i) => ({ tt, k: key(tt), i }))
    .sort((a, b) => a.k[0] - b.k[0] || a.k[1].localeCompare(b.k[1]) || a.k[2] - b.k[2] || a.i - b.i)
    .map(x => x.tt);
}
