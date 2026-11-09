import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { createAyeFinanceScraper, run } from './script.js'

const fixtures = () => ['official-home.json', 'native-employer.json', 'native-jobs.json', 'native-direct-details.json'].flatMap(name => JSON.parse(readFileSync(new URL('./fixtures/' + name, import.meta.url))))
const replay = (transform = value => value) => async url => {
  const row = fixtures().find(row => row.url === url)
  assert.ok(row, `uncaptured request ${url}`)
  return { status: row.status, url: row.finalUrl, text: async () => transform(row).body }
}

test('Aye Finance exported run preserves injected fetch and capture response identity', async () => {
  const requested = []
  const capturedAt = '2026-10-23T07:25:00.000Z'
  const jobs = await run({ timeoutMs: 1000, now: () => capturedAt, fetchImpl: async url => {
    requested.push(url)
    const row = fixtures().find(item => item.url === url)
    assert.ok(row, `uncaptured request ${url}`)
    const response = new Response(row.body, { status: row.status, headers: { 'Content-Type': 'text/html' } })
    Object.defineProperty(response, 'url', { value: row.finalUrl })
    return response
  } })
  assert.equal(requested.length, 5)
  assert.equal(jobs.nativeCollectionEvidence.observations.details.length, 2)
  assert.equal(readInventoryEvidence(jobs).verifiedAt, capturedAt)
})

test('Aye Finance replays real captures and recovers two native role observations while excluding unverified applications', async () => {
  const jobs = await createAyeFinanceScraper({ fetchImpl: replay() }).run()
  assert.equal(jobs.length, 0)
  const details = jobs.nativeCollectionEvidence.observations.details
  assert.deepEqual(details.map(row => row.jobId), ['4474071845', '4471197446'])
  assert.ok(details.every(row => row.country === 'India' && row.sourceDescription.length > 1000 && row.activeApplyVerified === false))
  assert.ok(details.every(row => row.postingDate === null && row.closingDate === null && row.exclusion === 'no-active-native-application-control'))
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.firstParty, false)
  assert.equal(inventory.reportedTotal, null)
})

test('Aye Finance rejects changed native employer identity and primary role canonical', async () => {
  for (const transform of [
    row => row.url.includes('/company/') ? { ...row, body: row.body.replaceAll('urn:li:organization:9381588', 'urn:li:organization:123') } : row,
    row => row.url.includes('/jobs/view/') ? { ...row, body: row.body.replace(/(<link[^>]*rel="canonical"[^>]*href=")[^"]+/, '$1https://www.linkedin.com/jobs/view/wrong-123') } : row,
  ]) await assert.rejects(createAyeFinanceScraper({ fetchImpl: replay(transform) }).run(), { code: 'AYEFINANCE_COVERAGE_GAP' })
})

test('Aye Finance missing visible JD remains null after independent application verification (mutated fixture)', async () => {
  const jobs = await createAyeFinanceScraper({ fetchImpl: replay(row => {
    if (!row.url.includes('/relationship-manager-at-')) return row
    return { ...row, body: row.body.replace('</body>', '<button data-modal="job-details-topcard-apply-modal">Apply</button></body>')
      .replace(/class="show-more-less-html__markup/g, 'hidden class="show-more-less-html__markup') }
  }) }).run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '4474071845')
  assert.equal(jobs[0].sourceDescription, null)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].activeApplyVerified, true)
})

test('Aye Finance heading-only and commented JD cannot become content (mutated fixture)', async () => {
  const { document } = await import('../../scraper-support/shared/rmkNativePairHtml.js')
  for (const replacement of ['<h2>Job Description</h2>', '<!-- A long historical description with many words and responsibilities that is not currently displayed. -->', '<template><p>A historical responsibility with many words and details that is currently inert.</p></template>']) {
    const jobs = await createAyeFinanceScraper({ fetchImpl: replay(row => {
      if (!row.url.includes('/relationship-manager-at-')) return row
      const doc = document(row.body), markup = doc.nodes(n => doc.hasClass(n, 'show-more-less-html__markup'))[0]
      const body = row.body.slice(0, markup.openEnd) + replacement + row.body.slice(markup.closeStart)
      return { ...row, body: body.replace('</body>', '<button data-modal="job-details-topcard-apply-modal">Apply</button></body>') }
    }) }).run()
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].sourceDescription, null)
  }
})

test('Aye Finance gzip fixtures and raw envelopes match the SHA256 manifest', () => {
  const sha = value => createHash('sha256').update(value).digest('hex')
  const manifest = JSON.parse(readFileSync(new URL('./fixtures/manifest.json', import.meta.url)))
  for (const entry of manifest) {
    const raw = readFileSync(new URL('./fixtures/' + entry.file, import.meta.url))
    const gzip = readFileSync(new URL('./fixtures/' + entry.gzipFile, import.meta.url))
    assert.equal(sha(raw), entry.sha256)
    assert.equal(sha(gzip), entry.gzipSHA256)
    assert.deepEqual(gunzipSync(gzip), raw)
    const parsed = JSON.parse(raw)
    if (entry.envelopes) for (const row of [parsed].flat()) {
      const expected = entry.envelopes.find(item => item.url === row.url)
      assert.ok(expected)
      assert.equal(sha(row.body), expected.bodySHA256)
      assert.equal(row.finalUrl, expected.finalUrl)
      assert.ok(row.capturedAt)
    }
  }
})

test('Aye Finance performs live source inspection and never certifies a blocked homepage as empty', async () => {
  let calls = 0
  await assert.rejects(createAyeFinanceScraper({ fetchImpl: async url => {
    calls++
    return { status: 403, url, text: async () => 'Forbidden' }
  } }).run(), { code: 'AYEFINANCE_COVERAGE_GAP' })
  assert.equal(calls, 1)
})

test('Aye Finance aggregate deadline bounds uncooperative fetch and body', async () => {
  for (const fetchImpl of [async () => new Promise(() => {}), async url => ({ status: 200, url, text: async () => new Promise(() => {}) })]) {
    await assert.rejects(createAyeFinanceScraper({ fetchImpl, timeoutMs: 15 }).run(), { code: 'AYEFINANCE_COVERAGE_GAP' })
  }
})

test('Aye Finance preserves exact caller abort reason', async () => {
  const controller = new AbortController(), reason = Error('caller stopped Aye inspection')
  const task = createAyeFinanceScraper({ fetchImpl: async () => { controller.abort(reason); return new Promise(() => {}) } }).run({ signal: controller.signal })
  await assert.rejects(task, error => error === reason)
})

test('Aye Finance checks response identity before parsing the body', async () => {
  let read = false
  await assert.rejects(createAyeFinanceScraper({ fetchImpl: async () => ({ status: 200, url: 'https://unrelated.example/', text: async () => { read = true; return '<html>Aye</html>' } }) }).run(), { code: 'AYEFINANCE_COVERAGE_GAP' })
  assert.equal(read, false)
})

test('Aye Finance cancels streamed bodies as soon as the byte limit is crossed', async () => {
  let canceled = false, reads = 0
  const reader = { read: async () => { reads++; return { done: false, value: new Uint8Array(1024 * 1024) } }, cancel: async () => { canceled = true }, releaseLock() {} }
  await assert.rejects(createAyeFinanceScraper({ fetchImpl: async url => ({ status: 200, url, body: { getReader: () => reader } }) }).run(), { code: 'AYEFINANCE_COVERAGE_GAP' })
  assert.equal(canceled, true)
  assert.ok(reads <= 6)
})

test('Aye Finance cancels a stalled stream on deadline', async () => {
  let canceled = false
  const reader = { read: async () => new Promise(() => {}), cancel: async () => { canceled = true }, releaseLock() {} }
  await assert.rejects(createAyeFinanceScraper({ timeoutMs: 15, fetchImpl: async url => ({ status: 200, url, body: { getReader: () => reader } }) }).run(), { code: 'AYEFINANCE_COVERAGE_GAP' })
  assert.equal(canceled, true)
})
