// When a timed task's time comes, show a system notification (if allowed) plus a
// flash and a tab title marker. Only works while the page is open.

import { state } from '../model/store.js';
import { timeOf, fmtTime, nowMinutes, displayTitle } from '../model/markers.js';
import { dueReminders, reminderKey } from '../model/queries.js';
import { ui, isEditing } from '../ui/view.js';
import { render } from '../ui/render/index.js';

const NOTIFIED_KEY = 'loopy-notified';
const PAGE_TITLE = document.title;
const canNotify = 'Notification' in window;

const todayKey = () => new Date().toLocaleDateString('sv');   // local YYYY-MM-DD

// { date, sent: ["taskId@minutes", ...] }, reset every day
function loadNotified() {
  try {
    const n = JSON.parse(localStorage.getItem(NOTIFIED_KEY));
    if (n && n.date === todayKey()) return n;
  } catch {}
  return { date: todayKey(), sent: [] };
}

export function checkReminders() {
  const notified = loadNotified();
  const due = dueReminders(state.tasks, {
    now: nowMinutes(), todayStart: new Date().setHours(0, 0, 0, 0), sent: notified.sent,
  });
  if (!due.length) return;

  due.forEach(t => {
    notified.sent.push(reminderKey(t));
    remind(t);
  });
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified));
  const last = due[due.length - 1];
  document.title = `● ${fmtTime(timeOf(last))} ${displayTitle(last)}`;
  ui.flash = { text: `⏰ ${due.map(t => `${fmtTime(timeOf(t))} ${displayTitle(t)}`).join(', ')}` };
  if (!isEditing()) render();
}

function remind(t) {
  if (!canNotify || Notification.permission !== 'granted') return;
  const n = new Notification(`${fmtTime(timeOf(t))} ${displayTitle(t)}`, {
    body: state.loops.find(l => l.id === t.loopId)?.title || 'loopy-tasks',
    tag: t.id,
  });
  n.onclick = () => { window.focus(); n.close(); };
}

// the title marker stays until you come back to the page
const clearTitle = () => { document.title = PAGE_TITLE; };
window.addEventListener('focus', clearTitle);
document.addEventListener('keydown', clearTitle);

export function renderNotifyBtn() {
  const btn = document.getElementById('notifyBtn');
  const perm = canNotify ? Notification.permission : 'unsupported';
  btn.textContent = { denied: 'reminders blocked', unsupported: 'reminders n/a' }[perm] || 'enable reminders';
  btn.hidden = perm === 'granted';
  btn.title = {
    denied: 'Notifications are blocked: allow them in the browser\'s site settings (and macOS System Settings → Notifications)',
    unsupported: 'This browser has no notifications; timed tasks still flash in the status bar',
  }[perm] || 'Get a system notification when a timed task is due';
}

document.getElementById('notifyBtn').addEventListener('click', async e => {
  e.currentTarget.blur();
  if (canNotify && Notification.permission === 'default') await Notification.requestPermission();
  if (canNotify && Notification.permission === 'granted') {
    new Notification('loopy-tasks', { body: 'Reminders are on for timed tasks.' });
  }
  render();
});
