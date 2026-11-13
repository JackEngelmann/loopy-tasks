// Example data for a first start (empty storage).

import { state, persist, stampWaiting } from '../model/store.js';
import { uid } from '../util.js';

export function seed() {
  const loops = ['Website redesign', 'Quarterly report', 'Onboarding guide', 'Team offsite']
    .map(title => ({ id: uid(), title, createdAt: Date.now() }));
  state.loops = loops;
  const [web, report, guide] = loops;
  [
    ['Sketch new landing page @i', web.id],
    ['Collect feedback on current site', web.id],
    ['Agent: audit page load times @w', web.id],
    ['Draft sent to finance for review @w', report.id],
    ['Outline setup chapter', guide.id],
    ['Standup 09:30', null],
    ['Design review 14:00', web.id],
    ['Try a dark mode variant?', web.id],
    ['Add a glossary to the guide', guide.id],
  ].forEach(([title, loopId]) => state.tasks.push({ id: uid(), title, loopId, done: false, createdAt: Date.now() }));
  // single things to do: one-step loops at the end
  ['Reply to invoice email', 'Book dentist appointment'].forEach(title => {
    const loop = { id: uid(), title, single: true, createdAt: Date.now() };
    state.loops.push(loop);
    state.tasks.push({ id: uid(), title, loopId: loop.id, done: false, createdAt: Date.now() });
  });

  const daily = { id: uid(), title: 'Daily planning', createdAt: Date.now() };
  state.templates = {
    loops: [daily],
    tasks: ['Look at calendar', 'Look at messages', 'Pick 1–2 outcomes for today', 'Standup 09:30']
      .map(title => ({ id: uid(), title, loopId: daily.id, done: false, createdAt: Date.now() })),
  };
  stampWaiting(state);
  persist();
}
