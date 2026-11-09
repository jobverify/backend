import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

test('Arka Fincap validates only title text without backtracking across repeated page content', () => {
  const moduleUrl = new URL('../../scraper/arkafincap/script.js', import.meta.url).href
  const child = spawnSync(process.execPath, ['--input-type=module'], {
    input: `
      import { hasOfficialHomepageSignal, hasOfficialCareersPageSignal } from ${JSON.stringify(moduleUrl)};
      const links = '<a href="/life-at-arka">Careers</a><a href="https://arkafincap.zohorecruit.in/jobs/Careers">Job Openings</a>';
      const repeated = '<p>Arka Fincap - Expert Financial Solutions Services Life at Arka - Work Culture, Careers &amp; Growth</p>'.repeat(4000);
      const body = links + 'Our Culture Why Join Us? Join Us' + repeated;
      const home = '<title>Arka Fincap &#8211; Expert Financial Solutions &amp; Services</title>';
      const careers = '<title>Life at Arka &#8211; Work Culture, Careers &amp; Growth</title>';
      const started = performance.now();
      const signals = [
        hasOfficialHomepageSignal(home + body),
        hasOfficialCareersPageSignal(careers + body),
        hasOfficialHomepageSignal('<title>Unrelated</title>' + body),
        hasOfficialCareersPageSignal('<title>Unrelated</title>' + body),
      ];
      console.log(JSON.stringify({ signals, elapsedMs: performance.now() - started }));
    `,
    encoding: 'utf8',
    // Allow dependency loading on a busy test worker; bound the checks separately.
    timeout: 30000,
    windowsHide: true,
  })
  assert.equal(child.error, undefined, `Title checks must finish promptly: ${child.error?.message}`)
  assert.equal(child.status, 0, child.stderr)
  const { signals, elapsedMs } = JSON.parse(child.stdout.trim())
  assert.deepEqual(signals, [true, true, false, false])
  assert.ok(elapsedMs < 5000, `Title checks took ${elapsedMs}ms`)
})
