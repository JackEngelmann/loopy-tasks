// Reading an export file back in (pure).

import { migrate } from './store.js';
import { INBOX_ID } from './queries.js';

// keep only well-formed entries, brought up to the current schema;
// throws if the file isn't an export at all
export function parseImport(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.loops) || !Array.isArray(data.tasks)) {
    throw new Error('expected { loops: [...], tasks: [...] }');
  }
  const t = data.templates;
  return migrate({
    version: data.version,
    ...cleanLoops(data.loops, data.tasks),
    // templates are optional, for exports made before they existed
    templates: t && Array.isArray(t.loops) && Array.isArray(t.tasks)
      ? cleanLoops(t.loops, t.tasks)
      : { loops: [], tasks: [] },
  });
}

function cleanLoops(rawLoops, rawTasks) {
  const str = v => typeof v === 'string' && v.length > 0;
  const loops = rawLoops.filter(l => l && str(l.id) && str(l.title));
  const ids = new Set(loops.map(l => l.id));
  const tasks = rawTasks
    .filter(t => t && str(t.id) && str(t.title))
    .map(t => ({ ...t, done: !!t.done, loopId: ids.has(t.loopId) || t.loopId === INBOX_ID ? t.loopId : null }));
  return { loops, tasks };
}
