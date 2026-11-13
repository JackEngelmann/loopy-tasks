// Row markup shared by the panes.

import { isNext, checkDue } from '../../model/queries.js';
import { isWaiting, isInProgress, isNotNow, timeOf, fmtTime, nowMinutes, displayTitle } from '../../model/markers.js';
import { ui, db, isTemplate, loopById } from '../view.js';
import { highlight } from '../../features/search.js';
import { editInput } from '../inline-edit.js';
import { esc, age, duration } from '../../util.js';

// the note of a loop or task as a dim line: the first line and "+N" more, or all of it
export function noteLine(item, cls, full) {
  if (!item.note) return '';
  const [first, ...rest] = item.note.split('\n');
  const text = full ? esc(item.note) : esc(first) + (rest.length ? ` <span class="note-age">+${rest.length}</span>` : '');
  return `<div class="${cls}${full ? ' full' : ''}">✎ ${text} <span class="note-age">· ${age(item.noteAt)}</span></div>`;
}

// marks: show next-action markers and search hits (the middle pane);
// notes: show the note below the task (else just ✎);
// label: text at the end of the row instead of the default ("40m late", or the waiting age);
// below: a second line instead (Now on top: loop and how late)
export function taskRow(t, i, { selected, showTag, marks, notes, label, below, cls: extra }) {
  const ed = ui.editing;
  const time = timeOf(t);
  const now = nowMinutes();
  // template times aren't appointments, so they're never due; a wait's time is a check instead
  const due = !t.done && !isNotNow(t) && !isWaiting(t) && time !== null && time <= now && !isTemplate(t);
  const check = !isTemplate(t) && checkDue(t);
  const next = marks && isNext(db(), t);
  const cls = ['row',
    selected && 'sel',
    next && 'next',
    marks && !next && !t.done && 'backlog',
    isNotNow(t) && 'not-now',
    isInProgress(t) && 'doing',
    t.done && 'done',
    due && 'due',
    check && 'check-due',
    t.id === ui.cutId && 'cut',
    notes && t.note && 'has-note',
    below && 'two-line',
    extra].filter(Boolean).join(' ');
  const hl = s => marks ? highlight(s, 'tasks') : esc(s);
  const l = loopById(t.loopId);
  const tag = showTag ? `<span class="tag${l ? '' : ' none'}">[${l ? hl(l.title) : '–'}]</span>` : '';
  const name = ui.mode === 'insert' && ed.kind === 'rename' && ed.id === t.id
    ? editInput(t.title)
    : `<span class="name">${hl(displayTitle(t))}</span>`;
  // only meaningful markers; plain tasks leave the column empty
  const mark = t.done ? '✓' : isInProgress(t) ? '▶' : isWaiting(t) ? '◷' : due ? '!' : next ? '▸' : '';
  const timeEl = time !== null ? `<span class="time">${hl(fmtTime(time))}</span>` : '';
  // how late it is, else how long it's been waiting
  const when = label ?? (due ? `${duration(now - time)} late` : check ? 'check' : isInProgress(t) ? age(t.progressSince) : null);
  // (a waiting task with a time shows that time instead)
  const tail = below !== undefined ? (below ? `<div class="row-below">${below}</div>` : '')
    : when ? `<span class="when">${when}</span>`
    : !t.done && t.waitingSince && time === null ? `<span class="wait-age">${age(t.waitingSince)}</span>` : '';
  // in full while the task is selected
  const note = notes ? noteLine(t, 'task-note', selected) : t.note ? '<span class="note-mark">✎</span>' : '';
  return `<li class="${cls}" data-i="${i}"><span class="check">${mark}</span>${timeEl}${tag}${name}${tail}${note}</li>`;
}
