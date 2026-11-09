import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'

import { run } from '../../scraper/boat/script.js'
const fixture = name => JSON.parse(gunzipSync(fs.readFileSync(new URL(`../../scraper/boat/fixtures/${name}.json.gz`, import.meta.url))))
const captures = () => [fixture('official-careers'), fixture('native-company'), ...fixture('native-jobs')]
const replay = (changes = {}) => async url => {
  const row = captures().find(item => item.url === url)
  if (!row) throw Error('Uncaptured detail')
  return { status: row.status, url: row.finalUrl, text: async () => changes[url] ?? row.body }
}
const fullReplay = (mutate = body => body) => async url => {
  const row = [...captures(), ...fixture('native-details')].find(item => item.url === url)
  if (!row) throw Error('Uncaptured URL')
  return { status: row.status, url: row.finalUrl, text: async () => mutate(row.body, url) }
}

test('Boat reports unavailable transport as a typed coverage gap rather than successful empty inventory', async () => {
  await assert.rejects(run({ fetchImpl: async () => { throw Error('offline') } }), error => {
    assert.equal(error.code, 'BOAT_COVERAGE_GAP')
    assert.equal(error.sourceScopeComplete, false)
    assert.equal(error.lifecycleCleanupAllowed, false)
    assert.equal(error.inventoryEvidence.status, 'coverage-gap')
    assert.equal(error.inventoryEvidence.reportedTotal, null)
    return true
  })
})

test('Boat preserves the exact caller cancellation reason', async () => {
  const controller = new AbortController()
  const reason = { caller: 'cancelled' }
  controller.abort(reason)
  await assert.rejects(run({ signal: controller.signal }), error => error === reason)
})

test('Boat propagates caller cancellation while a transport ignores its signal', async () => {
  const controller = new AbortController()
  const reason = { caller: 'cancelled in flight' }
  const pending = run({ signal: controller.signal, fetchImpl: async () => {
    queueMicrotask(() => controller.abort(reason))
    return new Promise(() => {})
  } })
  await assert.rejects(pending, error => error === reason)
})

test('Boat aggregate deadline bounds stalled fetch and stalled response body', async () => {
  for (const fetchImpl of [
    async () => new Promise(() => {}),
    async url => ({ status: 200, url, text: async () => new Promise(() => {}) }),
  ]) {
    await assert.rejects(run({ fetchImpl, timeoutMs: 15 }), error => error.code === 'BOAT_COVERAGE_GAP')
  }
})

test('Boat recovers all four native employer cards while keeping unavailable details and whole-company scope partial', async () => {
  const jobs = await run({ fetchImpl: replay() })
  assert.deepEqual(jobs.map(job => job.jobId), ['4477625835', '4470905951', '4480339068', '4477103602'])
  assert.equal(jobs[0].title, 'Visual Designer')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].city, 'Gurugram')
  assert.equal(jobs[0].postingDate, '2026-10-09')
  assert.ok(jobs.every(job => job.sourceListingComplete === false && job.sourceDetailComplete === false && job.jobDescription === null))
})

test('Boat refuses a keyword search if the selected native employer filter disappears', async () => {
  const row = fixture('native-jobs')[0]
  await assert.rejects(run({ fetchImpl: replay({ [row.url]: row.body.replace('value="13356517"', 'value="1"') }) }), error => error.code === 'BOAT_COVERAGE_GAP')
})

test('Boat enriches native role prose, employment and precise expiry without replacing earlier card publication', async () => {
  const jobs = await run({ fetchImpl: fullReplay(), now: () => '2026-10-23T06:40:00.000Z' })
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].closingDate, '2026-11-08T05:41:08.000Z')
  assert.equal(jobs[0].postingDate, '2026-10-09')
  assert.equal(jobs[0].nativeDetailPublicationDate, '2026-10-09T05:41:08.000Z')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.match(jobs[0].jobDescription, /Create high-quality visual designs/)
  assert.ok(jobs.every(job => job.sourceDetailComplete && !job.sourceListingComplete))
})

test('Boat keeps hidden description content null and partial even when JSON-LD has full prose', async () => {
  const jobs = await run({ fetchImpl: fullReplay(body => body.replace(/class="show-more-less-html__markup /g, 'hidden class="show-more-less-html__markup ')), now: () => '2026-10-23T06:40:00.000Z' })
  assert.ok(jobs.every(job => job.jobDescription === null && job.sourceDetailComplete === false))
})

test('Boat excludes roles past exact native expiry rather than refreshing the source date', async () => {
  await assert.rejects(run({ fetchImpl: fullReplay(), now: () => '2027-01-01T00:00:00.000Z' }), error => error.code === 'BOAT_COVERAGE_GAP')
})

test('Boat rejects a changed employer in a native detail instead of attributing it to the brand', async () => {
  await assert.rejects(run({ fetchImpl: fullReplay((body, url) => url.includes('/jobs/view/')
    ? body.replace('"name":"boAt Lifestyle"', '"name":"Another Employer"') : body) }), error => error.code === 'BOAT_COVERAGE_GAP')
})

test('Boat fails closed when native total exceeds recovered cards and pagination needs review', async () => {
  const row = fixture('native-jobs')[0]
  await assert.rejects(run({ fetchImpl: replay({ [row.url]: row.body.replace('class="results-context-header__job-count">4', 'class="results-context-header__job-count">5') }) }), error => error.code === 'BOAT_COVERAGE_GAP')
})

test('Boat heading-only native description remains partial', async () => {
  const jobs = await run({ fetchImpl: fullReplay(body => body.replace(/(<div class="show-more-less-html__markup[\s\S]*?>)[\s\S]*?(<\/div>)/g, '$1<h2>Key Responsibilities</h2><p><strong>Requirements</strong></p>$2')), now: () => '2026-10-23T06:40:00.000Z' })
  assert.ok(jobs.every(job => job.jobDescription === null && !job.sourceDetailComplete))
})

test('Boat rejects contradictory native locality and region even with India country code', async () => {
  await assert.rejects(run({ fetchImpl: fullReplay(body => body.replace(/"addressLocality":"Gurugram","addressRegion":null/g,
    '"addressLocality":"Toronto","addressRegion":"Ontario"')) }), error => error.code === 'BOAT_COVERAGE_GAP')
})

test('Boat rejects future native publication even when listing has an earlier valid date', async () => {
  await assert.rejects(run({ fetchImpl: fullReplay(body => body.replace(/"datePosted":"[^"]+"/g,
    '"datePosted":"2030-01-01T00:00:00.000Z"')), now: () => '2026-10-23T06:40:00.000Z' }), error => error.code === 'BOAT_COVERAGE_GAP')
})

test('Boat retains known listing publication when native detail publication is absent', async () => {
  const jobs = await run({ fetchImpl: fullReplay(body => body.replace(/"datePosted":"[^"]+",/g, '')), now: () => '2026-10-23T06:40:00.000Z' })
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].postingDate, '2026-10-09')
  assert.equal(jobs[0].nativeDetailPublicationDate, null)
})

test('Boat leaves publication null when neither native listing nor detail supplies it', async () => {
  const jobs = await run({ fetchImpl: fullReplay(body => body.replace(/"datePosted":"[^"]+",/g, '')
    .replace(/(<time\b[^>]*?)\sdatetime="[^"]+"/g, '$1')), now: () => '2026-10-23T06:40:00.000Z' })
  assert.equal(jobs.length, 4)
  assert.ok(jobs.every(job => job.postingDate === null && job.nativeDetailPublicationDate === null))
})

test('Boat rejects readable detail without positive native application controls', async () => {
  await assert.rejects(run({ fetchImpl: fullReplay((body, url) => url.includes('/jobs/view/')
    ? body.replace(/<(a|button)\b[^>]*>[\s\S]*?<\/\1>/gi, markup => /apply|sign.?in|login/i.test(markup) ? '' : markup) : body) }), error => error.code === 'BOAT_COVERAGE_GAP')
})
