export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function swap(arr, i, j) { [arr[i], arr[j]] = [arr[j], arr[i]]; }

// minutes as "40m", "1h50", "3h"
export function duration(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m}m`;
}

// "3h" since a moment (note written, task started waiting)
export function age(ms, now = Date.now()) {
  const min = Math.floor((now - ms) / 60_000);
  return min < 1 ? 'now' : min < 60 ? `${min}m` : min < 1440 ? `${Math.floor(min / 60)}h` : `${Math.floor(min / 1440)}d`;
}

// a key with Cmd / Ctrl / Alt is a browser shortcut (copy, reload, ...), unless it typed a
// character: Option on macOS and AltGr elsewhere type [ ] { } @ | on many layouts (German: Option+5 is [)
export function isShortcut(e) {
  const typed = e.key.length === 1 && !e.metaKey && (!e.ctrlKey || e.getModifierState('AltGraph'));
  return (e.metaKey || e.ctrlKey || e.altKey) && !typed;
}
