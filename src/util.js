export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function swap(arr, i, j) { [arr[i], arr[j]] = [arr[j], arr[i]]; }

// "3h" since a moment (note written, task started waiting)
export function age(ms, now = Date.now()) {
  const min = Math.floor((now - ms) / 60_000);
  return min < 1 ? 'now' : min < 60 ? `${min}m` : min < 1440 ? `${Math.floor(min / 60)}h` : `${Math.floor(min / 1440)}d`;
}
