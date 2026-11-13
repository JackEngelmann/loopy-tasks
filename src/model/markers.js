// Markers live in the task title text: "@w" waiting, "@p" in progress, "@n" not now, "14:30" timed,
// and "+20m" (resolved to a clock time on save). Everything here is pure.

// "@w" / "@p" / "@n" anywhere in the title mark a task as waiting / in progress / not now
const tokenRe = tok => new RegExp(`(^|\\s)${tok}(?=\\s|$)`, 'g');
export const hasToken = (s, tok) => tokenRe(tok).test(s);
export const stripToken = (s, tok) => s.replace(tokenRe(tok), '$1').replace(/\s+/g, ' ').trim();
export const toggleToken = (s, tok) => hasToken(s, tok) ? stripToken(s, tok) : `${s} ${tok}`;
export const isWaiting = t => hasToken(t.title, '@w');
// in progress: what you're working on right now (usually one, sometimes a few)
export const isInProgress = t => !t.done && hasToken(t.title, '@p');
// not now: kept with its loop (an idea, something you decided to hold back), but not work yet
export const isNotNow = t => hasToken(t.title, '@n');

// a time like "14:30" or "0:10" anywhere in the title makes a task timed
export const TIME_RE = /(^|\s)([01]?\d|2[0-3]):([0-5]\d)(?=\s|$)/;
export function timeOf(t) {
  const m = t.title.match(TIME_RE);
  return m ? +m[2] * 60 + +m[3] : null;
}
export const stripTime = title => title.replace(new RegExp(TIME_RE.source, 'g'), '$1').replace(/\s+/g, ' ').trim();
export const fmtTime = min => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

// "+20m", "+1h", "+1h30" become a clock time when the task is saved, so it stays put;
// they replace any time already in the title. Times have no date, so cap at 23:59.
const REL_RE = /(^|\s)\+(?:(\d+)h(?:(\d+)m?)?|(\d+)m)(?=\s|$)/;
export function resolveRelative(title, now = nowMinutes()) {
  const m = title.match(REL_RE);
  if (!m) return title;
  const mins = m[4] !== undefined ? +m[4] : +m[2] * 60 + +(m[3] || 0);
  const at = fmtTime(Math.min(now + mins, 23 * 60 + 59));
  return stripTime(title).replace(REL_RE, `$1${at}`);
}

// a time typed for "when": "14:30", or from now: "1h", "20m", "1h30", "+20m", "20" (minutes);
// capped at 23:59 like +20m in titles. null if it isn't one
export function parseWhen(s, now = nowMinutes()) {
  s = s.trim();
  let m = s.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (m) return +m[1] * 60 + +m[2];
  m = s.match(/^\+?(?:(\d+)h(?:(\d+)m?)?|(\d+)m?)$/);
  if (!m) return null;
  const mins = m[3] !== undefined ? +m[3] : +m[1] * 60 + +(m[2] || 0);
  return Math.min(now + mins, 23 * 60 + 59);
}

// the title as shown: markers and the time are displayed separately
export const displayTitle = t => ['@w', '@p', '@n'].reduce(stripToken, t.title.replace(TIME_RE, '$1'));
