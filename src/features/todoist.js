// Todoist, without syncing. a lists today's and overdue Todoist tasks (:pick <filter> any
// Todoist filter, like @arbeit); the ones you pick are copied into the selected loop and
// Todoist is left as it is. :park sends a task the other way.
// Requests go through serve.py, which adds the token from .env; the browser never sees it.

import { state, mutate } from '../model/store.js';
import { displayTitle, isImportant, fmtTime } from '../model/markers.js';
import { fromTodoist, pickerOrder, dueOf, daysOver, localDate } from '../model/todoist.js';
import { ui, enter, leave, isEditing, currentLoop, selTask } from '../ui/view.js';
import { render } from '../ui/render/index.js';
import { esc, uid } from '../util.js';

// earlier versions kept the token in the browser
try { localStorage.removeItem('loopy-todoist-token'); } catch {}

const SERVER = 'python3 serve.py';

async function api(path, body) {
  let res;
  try {
    res = await fetch(`todoist/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body && JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`couldn't reach Loopy's server (${err.message}); is ${SERVER} running?`);
  }
  if (res.ok) return res.json();
  let why;
  try { why = (await res.json()).error; } catch {
    // not JSON: a plain file server, without serve.py's Todoist route
    throw new Error(`Todoist needs Loopy's own server: ${SERVER}`);
  }
  if (res.status === 401) throw new Error('Todoist rejected the token (TODOIST_TOKEN in .env)');
  throw new Error(`Todoist: ${why || res.status}`);
}

// list endpoints come in pages
async function all(path) {
  const out = [];
  let cursor = null;
  do {
    const sep = path.includes('?') ? '&' : '?';
    const page = await api(path + (cursor ? `${sep}cursor=${encodeURIComponent(cursor)}` : ''));
    out.push(...page.results);
    cursor = page.next_cursor;
  } while (cursor);
  return out;
}

// ── The list (a, :pick [filter]) ──────────────────────────────────────────────

export const DEFAULT_FILTER = 'today | overdue';

export function openTodoist(filter) {
  const query = (filter || '').trim() || DEFAULT_FILTER;
  if (ui.templates) return;
  const picker = { query, idx: 0, items: null, marked: new Set(), error: null };
  enter('todoist', { todoist: picker });
  Promise.all([all(`tasks/filter?query=${encodeURIComponent(query)}`), all('projects')])
    .then(([tasks, projects]) => {
      const names = Object.fromEntries(projects.map(p => [p.id, p.name]));
      picker.items = pickerOrder(tasks).map(tt => ({ ...tt, projectName: names[tt.project_id] || '' }));
    })
    .catch(err => { picker.error = err.message; })
    .finally(() => { if (ui.todoist === picker) render(); });
}

const isPicked = tt => state.tasks.some(t => t.todoistId === tt.id);

export function todoistMove(delta) {
  const n = (ui.todoist.items || []).length;
  ui.todoist.idx = Math.max(0, Math.min(n - 1, ui.todoist.idx + delta));
}

// space marks several; enter takes the marked ones, or the selected one if none are marked
export function todoistMark() {
  const tt = (ui.todoist.items || [])[ui.todoist.idx];
  if (!tt || isPicked(tt)) return;
  const { marked } = ui.todoist;
  if (marked.has(tt.id)) marked.delete(tt.id); else marked.add(tt.id);
  todoistMove(1);
}

export function todoistChoose() {
  const { items, marked, idx } = ui.todoist;
  if (!items) return;
  const chosen = (marked.size ? items.filter(tt => marked.has(tt.id)) : [items[idx]])
    .filter(tt => tt && !isPicked(tt));
  leave();
  if (!chosen.length) return;
  const loop = currentLoop();
  mutate(() => chosen.forEach(tt =>
    state.tasks.push({ id: uid(), loopId: loop.id, done: false, createdAt: Date.now(), ...fromTodoist(tt) })));
  ui.flash = { text: `added ${chosen.length === 1 ? `"${chosen[0].content}"` : `${chosen.length} tasks`} to ${loop.id ? loop.title : 'Standalone'}` };
}

// "Mon 16 Nov"
const laterDay = date => new Date(`${date}T00:00`)
  .toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export function renderTodoist() {
  const box = document.getElementById('todoist');
  box.hidden = ui.mode !== 'todoist';
  if (box.hidden) return;
  const { query, items, marked, idx, error } = ui.todoist;
  document.getElementById('todoistTitle').textContent =
    `Todoist · ${query === DEFAULT_FILTER ? 'today and overdue' : query}`;
  document.getElementById('todoistInfo').textContent = marked.size ? `${marked.size} marked` : '';
  const list = document.getElementById('todoistList');
  if (error) { list.innerHTML = `<li class="empty error">${esc(error)}</li>`; return; }
  if (!items) { list.innerHTML = '<li class="empty">loading…</li>'; return; }
  if (!items.length) { list.innerHTML = `<li class="empty">nothing in Todoist for ${esc(query)}</li>`; return; }
  list.innerHTML = items.map((tt, i) => {
    const picked = isPicked(tt), over = daysOver(tt), { date, time } = dueOf(tt);
    const cls = ['row', i === idx && 'sel', picked && 'picked', marked.has(tt.id) && 'marked'].filter(Boolean).join(' ');
    const check = picked ? '✓' : marked.has(tt.id) ? '●' : '';
    // overdue, a later day (filters can reach past today), or today's time
    const when = over ? `<span class="when">${over}d over</span>`
      : date && date > localDate() ? `<span class="later">${laterDay(date)}</span>`
      : time !== null ? `<span class="time">${fmtTime(time)}</span>` : '';
    const star = tt.priority === 4 ? '<span class="star">★</span>' : '';
    return `<li class="${cls}"><span class="check">${check}</span>${star}${when}<span class="name">${esc(tt.content)}</span><span class="tag">${esc(tt.projectName)}</span></li>`;
  }).join('');
}

// ── :park [when] ──────────────────────────────────────────────────────────────
// the selected task leaves Loopy for Todoist: a new task in the Inbox, due when you say
// ("tomorrow", "fri", "next week"; Todoist reads it). A task that came from Todoist is
// still there, so it is only removed here, and given the new date if there is one.

export function park(when) {
  const task = ui.templates ? null : selTask();
  if (!task) { ui.flash = { text: 'select a task to park' }; return; }
  const due = when ? { due_string: when } : {};
  const sent = task.todoistId
    ? (when ? api(`tasks/${task.todoistId}`, due) : Promise.resolve())
    : api('tasks', {
      content: displayTitle(task),
      ...(task.note && { description: task.note }),
      priority: isImportant(task) ? 4 : 1,
      ...due,
    });
  ui.flash = { text: 'parking…' };
  sent.then(() => {
    mutate(() => { state.tasks = state.tasks.filter(t => t.id !== task.id); });
    ui.flash = { text: task.todoistId && !when
      ? `removed "${displayTitle(task)}"; it's still in Todoist`
      : `parked "${displayTitle(task)}" in Todoist${when ? `, ${when}` : ''}` };
  }).catch(err => {
    ui.flash = { text: `not parked: ${err.message}`, error: true };
  }).finally(() => { if (!isEditing()) render(); });
}
