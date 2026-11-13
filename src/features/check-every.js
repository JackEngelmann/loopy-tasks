// :check [minutes]: how long a wait goes without a look before its loop shows in Check.
// 10 unless you set it; remembered in this browser.

import { CHECK_EVERY, setCheckEvery } from '../model/queries.js';
import { ui } from '../ui/view.js';

const KEY = 'loopy-check-every';
const valid = m => Number.isInteger(m) && m >= 1 && m <= 240;

export function loadCheckEvery() {
  try {
    const m = Number(localStorage.getItem(KEY));
    if (valid(m)) setCheckEvery(m);
  } catch {}
}

export function checkCommand(arg) {
  if (!arg) {
    ui.flash = { text: `waits want a look every ${CHECK_EVERY} min · :check <minutes> changes it` };
    return;
  }
  const m = Number(arg);
  if (!valid(m)) {
    ui.flash = { text: 'minutes from 1 to 240, like :check 10', error: true };
    return;
  }
  setCheckEvery(m);
  try { localStorage.setItem(KEY, String(m)); } catch {}
  ui.flash = { text: `waits want a look every ${m} min` };
}
