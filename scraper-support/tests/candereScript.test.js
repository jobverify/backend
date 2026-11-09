import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { run, CAREERS_URL } from '../../scraper/candere/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

// Synthetic HTML reflecting the headings observed on the official board.
// This is a contract test, not a captured source response.
const emptyBoard = '<html><head><title>Careers @ candere</title><link rel="canonical" href="https://candere.jobsoid.com"></head><body><h1>candere - Careers</h1><section id="list"><section id="sectionContainer" class="section current-openings"><h2>Current Openings</h2><h3>No Current Openings</h3></section></section><footer><a href="http://www.candere.com">Website</a></footer></body></html>'
const page = html => ({ status: 200, url: CAREERS_URL, html })

test('Candere recognizes the captured official native empty board', async () => {
  const capture = JSON.parse(readFileSync(new URL('../../scraper/candere/evidence/careers-response.json', import.meta.url), 'utf8'))
  const jobs = await run({ fetchPage: async () => ({ status: capture.status, url: capture.finalUrl, html: capture.body }) })
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('Candere checks the official board on each run and attaches current empty evidence', async () => {
  let requests = 0
  const jobs = await run({ fetchPage: async url => {
    assert.equal(url, 'https://candere.jobsoid.com/')
    requests++
    return page(emptyBoard)
  }, now: () => '2026-10-23T04:00:00.000Z' })
  assert.equal(requests, 1)
  assert.equal(jobs.length, 0)
  assert.deepEqual(readInventoryEvidence(jobs), {
    status: 'verified-empty', surface: 'https://candere.jobsoid.com/', firstParty: true,
    listingComplete: true, pagesFetched: 1, reportedTotal: 0, indiaFacetCount: 0,
    verifiedAt: '2026-10-23T04:00:00.000Z', reason: 'official-jobsoid-board-explicit-no-current-openings',
  })
})

test('Candere rejects HTTP errors, foreign redirects and changed identities', async () => {
  for (const response of [
    { ...page(emptyBoard), status: 503 },
    { ...page(emptyBoard), url: 'https://other.jobsoid.com/' },
    page(emptyBoard.replaceAll('candere', 'other')),
    page('<h1>candere - Careers</h1><h2>Current Openings</h2>'),
    page(emptyBoard.replace('<h3>No Current Openings</h3>', '<script>No Current Openings</script>')),
    page(emptyBoard.replace('<h3>', '<h3 hidden>')),
    page(emptyBoard.replace('<section id="list">', '<section id="other">')),
    page(emptyBoard.replace('class="section current-openings"', 'class="new-board"')),
    page(emptyBoard.replace('http://www.candere.com', 'https://other.example')),
    page(emptyBoard.replace('</h3>', '</h3><h4>Engineer</h4>')),
    page(emptyBoard.replaceAll('</section>', '')),
  ]) await assert.rejects(run({ fetchPage: async () => response }))
})

test('Candere does not report zero when an opening appears beside the empty heading', async () => {
  for (const extra of [
    '<a href="/j/12345/engineer">Engineer</a>',
    '<script type="application/ld+json">{"@type":"JobPosting","title":"Engineer"}</script>',
    '<a href="/jobs/engineer">Engineer</a>',
  ]) await assert.rejects(run({ fetchPage: async () => page(emptyBoard.replace('</body>', extra + '</body>')) }))
})

test('Candere refuses truncated boards even when identity and empty text precede truncation', async () => {
  const truncated = '<a href="https://candere.com">Website</a><h1>candere - Careers</h1><section id="list"><section id="sectionContainer" class="current-openings"><h2>Current Openings</h2><h3>No Current Openings</h3>'
  await assert.rejects(run({ fetchPage: async () => page(truncated) }))
  for (const html of [
    emptyBoard.replace('</html>', ''),
    emptyBoard.replace('</body>', ''),
    emptyBoard.replace('</section></section>', '</section>'),
  ]) await assert.rejects(run({ fetchPage: async () => page(html) }))
})

test('Candere propagates fetch failures and honours cancellation', async () => {
  await assert.rejects(run({ fetchPage: async () => { throw new Error('upstream unavailable') } }), /upstream unavailable/)
  const controller = new AbortController()
  controller.abort(new Error('cancelled'))
  await assert.rejects(run({ signal: controller.signal, fetchPage: async () => page(emptyBoard) }), /cancelled/)
})

test('Candere default transport uses a bounded request and validates the response', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, CAREERS_URL)
    assert.ok(options.signal instanceof AbortSignal)
    return { ok: true, status: 200, url, text: async () => emptyBoard }
  })
  assert.equal((await run({ requestTimeoutMs: 50 })).length, 0)
  assert.equal(readInventoryEvidence(await run()).status, 'verified-empty')
})

test('importing Candere with --dry-run does not fetch or write files', () => {
  const url = new URL('../../scraper/candere/script.js', import.meta.url).href
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import fs from 'node:fs';
    fs.writeFileSync = () => { throw new Error('Unexpected file write during import'); };
    process.argv.push('--dry-run');
    globalThis.fetch = () => { throw new Error('Unexpected network during import'); };
    await import(${JSON.stringify(url)});
    console.log('imported');
  `], { encoding: 'utf8', timeout: 5000 })
  assert.equal(output.trim(), 'imported')
})
