import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { setImmediate } from 'node:timers/promises'
import test from 'node:test'
import { run } from './script.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./nativeEvidence/detail-budget-subset-20261031.json.gz', import.meta.url))))
for (const sample of fixture.samples) assert.equal(createHash('sha256').update(sample.body).digest('hex'), sample.sha256)

test('Quest bounded workers inspect every captured detail within the existing budget without accepting native mismatches', async t => {
  // This is a 24-role subset of the real October 31 packets with controlled
  // slow responses. Its synthetic subset count is never whole-company proof.
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.parse(fixture.capturedAt) })
  const listing = '<script>phApp.ddo = ' + JSON.stringify({ eagerLoadRefineSearch: {
    status: 200, totalHits: fixture.samples.length, hits: fixture.samples.length,
    data: { jobs: fixture.samples.map(sample => sample.listing), aggregations: [{ field: 'country', value: { India: fixture.samples.length } }] },
  } }) + '</script>'
  const samples = new Map(fixture.samples.map(sample => [sample.url, sample]))
  let active = 0, maximum = 0, detailReads = 0, completed = false, jobs, failure
  const operation = run({ nativeDetailRecovery: false, fetchText: async (url, { signal } = {}) => {
    if (url.endsWith('/search-results')) return listing
    const sample = samples.get(url)
    assert.ok(sample, 'Uncaptured native detail must not be requested: ' + url)
    detailReads++
    active++
    maximum = Math.max(maximum, active)
    try {
      await new Promise((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(signal.reason) }
        const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, 3500)
        signal?.addEventListener('abort', abort, { once: true })
      })
      return sample.body
    } finally { active-- }
  } }).then(value => { jobs = value; completed = true }, error => { failure = error; completed = true })
  for (let step = 0; !completed && step < 240; step++) {
    await setImmediate()
    t.mock.timers.tick(500)
  }
  await operation
  if (failure) throw failure
  assert.equal(jobs.length, fixture.samples.length)
  assert.equal(jobs.filter(job => job.sourceDetailFailureKind === 'budget-exhausted').length, 0,
    'A sequential detail tail must not consume the existing budget before captured roles are inspected')
  assert.equal(detailReads, fixture.samples.length)
  assert.equal(jobs.filter(job => job.sourceDetailComplete).length, 22)
  assert.deepEqual(jobs.filter(job => job.sourceDetailFailureKind).map(job => [job.jobId, job.sourceDetailFailureKind]),
    fixture.samples.filter(sample => sample.expectedFailureKind).map(sample => [sample.listing.reqId, sample.expectedFailureKind]))
  assert.ok(maximum > 1 && maximum <= 4)
  assert.equal(active, 0)
})
