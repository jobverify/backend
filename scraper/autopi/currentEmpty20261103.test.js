import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createAutoPiScraper, CAREERS_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = () => gunzipSync(readFileSync(new URL('./test-data/careers-empty-20261103.html.gz', import.meta.url))).toString('utf8')
const execute = (html = fixture(), options = {}) => createAutoPiScraper().run({ fetchText: async () => html, ...options })
const qualified = jobs => readInventoryEvidence(jobs)?.status === 'verified-empty'

test('the actual explicit AutoPi zero is reconciled and carries fresh first-party empty-inventory evidence', async () => {
  const requests = [], audits = []
  const jobs = await execute(fixture(), { fetchText: async url => { requests.push(url); return fixture() }, onAudit: audit => audits.push(audit) })
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'verified-empty')
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 0)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.pagesFetched, 2)
  assert.deepEqual(requests, [CAREERS_URL, CAREERS_URL])
  assert.equal(audits.length, 1)
  assert.equal(audits[0].closingInventoryMatches, true)
})

test('a changed count or a newly advertised role cannot be certified as an empty board', async () => {
  for (const html of [fixture().replace('>0 open<', '>1 open<'), fixture().replace('// no openings', '// future openings'),
    fixture().replace('>0 open<', '>00 open<'), fixture().replace('>0 open<', '>0 open</span><span>1 open<'),
    fixture().replace('No open positions right now', 'Current openings are loading')]) {
    try { assert.equal(qualified(await execute(html)), false) } catch (error) { if (error.code === 'ERR_ASSERTION') throw error }
  }
})

test('commented, hidden, duplicated and CSS-hidden zero markers do not establish inventory', async () => {
  const marker = '<span class="tw-font-mono tw-text-xs tw-text-slate-400">0 open</span>'
  for (const replacement of ['<!--' + marker + '-->', marker.replace('<span ', '<span hidden '), marker + marker,
    marker.replace('<span ', '<span style="opacity:0" '), marker.replace('<span ', '<span class="native-zero-hidden" ')]) {
    const html = fixture().replace(marker, replacement).replace('</head>', '<style>.native-zero-hidden{display:none}</style></head>')
    try { assert.equal(qualified(await execute(html)), false) } catch (error) { if (error.code === 'ERR_ASSERTION') throw error }
  }
})

test('native jobs, pagination and an active careers iframe contradict a zero label', async () => {
  const marker = '// no openings'
  for (const addition of ['<article class="job-card"><h3>Engineer</h3></article>', '<a href="/careers/engineer/">Engineer</a>',
    '<button>Load more</button>', '<iframe src="https://example.org/jobs"></iframe>', '<script>loadJobs()</script>']) {
    const html = fixture().replace(marker, marker + addition)
    try { assert.equal(qualified(await execute(html)), false) } catch (error) { if (error.code === 'ERR_ASSERTION') throw error }
  }
})

test('a changed closing snapshot withholds empty inventory', async () => {
  let calls = 0
  const jobs = await execute(fixture(), { fetchText: async () => ++calls === 1 ? fixture() : fixture().replace('>0 open<', '>1 open<') })
    .catch(() => null)
  assert.equal(qualified(jobs), false)
  assert.equal(calls, 2)
})

test('default transport checks the actual final response origin before certifying first-party emptiness', async () => {
  await assert.rejects(createAutoPiScraper().run({ fetchImpl: async () => ({ status: 200, url: 'https://example.org/careers/', text: async () => fixture() }) }), /AutoPi.*(?:identity|redirect|response)/i)
  await assert.rejects(createAutoPiScraper().run({ fetchImpl: async () => ({ status: 403, url: CAREERS_URL, text: async () => fixture() }) }), /AutoPi.*(?:403|unavailable|response)/i)
})

test('caller pre-cancellation performs no reads', async () => {
  const controller = new AbortController(), reason = new Error('caller stopped AutoPi')
  controller.abort(reason)
  let calls = 0
  await assert.rejects(execute(fixture(), { signal: controller.signal, fetchText: async () => { calls++; return fixture() } }), reason)
  assert.equal(calls, 0)
})

test('cancellation bounds a read or audit observer that ignores its signal', async () => {
  for (const kind of ['read', 'observer']) {
    const controller = new AbortController(), reason = new Error('caller stopped ' + kind)
    const timer = setTimeout(() => controller.abort(reason), 25)
    try {
      await assert.rejects(execute(fixture(), { signal: controller.signal,
        ...(kind === 'read' ? { fetchText: () => new Promise(() => {}) } : { onAudit: () => new Promise(() => {}) }) }), reason)
    } finally { clearTimeout(timer) }
  }
})
