// tiny test harness: test() registers, run() executes in order and reports into the page.
// tests/run.py reads the report from the headless browser; opening tests/index.html shows it too.

const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function eq(actual, expected, what = '') {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what ? what + ': ' : ''}expected ${e}, got ${a}`);
}

export function ok(value, what = '') {
  if (!value) throw new Error(`${what || 'expected a truthy value'}: got ${JSON.stringify(value)}`);
}

export async function run() {
  const lines = [];
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      lines.push(`ok    ${t.name}`);
    } catch (err) {
      failed++;
      lines.push(`FAIL  ${t.name}\n      ${err.message}`);
    }
  }
  lines.push('', failed ? `${failed} of ${tests.length} failed` : `all ${tests.length} passed`);
  document.getElementById('report').textContent = lines.join('\n');
  document.title = failed ? 'FAIL' : 'PASS';
}
