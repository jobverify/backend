import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = () => JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261024.json.gz', import.meta.url))))
const options = f => {
  let listingReads = 0
  return {
    now: () => f.capturedAt, fetchPage: async () => f.official,
    fetchJson: async (url, init = {}) => {
      if (url === 'https://workable-proxy-lyart.vercel.app/api/gem-jobs') return f.proxy
      assert.equal(url, 'https://jobs.gem.com/api/public/graphql/batch')
      const [request] = JSON.parse(init.body)
      assert.equal(request.variables.boardId, 'accellor')
      return request.variables.extId ? f.details[request.variables.extId] : (++listingReads === 1 ? f.first : f.last)
    },
  }
}

test('Accellor captures all eleven explicit India descriptions from the verified eighteen-role Gem inventory', async () => {
  const f = fixture()
  const jobs = await run(options(f))
  assert.equal(jobs.length, 11)
  assert.ok(jobs.every(j => j.company === 'Accellor' && j.source === 'accellor' && j.country === 'India'))
  assert.ok(jobs.every(j => j.sourceDetailComplete && j.sourceDescription.length > 1000))
  assert.ok(jobs.every(j => j.applyUrl.startsWith('https://jobs.gem.com/accellor/') && j.applyUrl === j.sourceUrl))
  assert.equal(new Set(jobs.map(j => j.jobId)).size, 11)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 18)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 11)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  const native = f.details[jobs[0].jobId][0].data.oatsExternalJobPosting
  assert.equal(jobs[0].postingDate, new Date(native.firstPublishedTsSec * 1000).toISOString())
})

test('Accellor requires a current exact employer-controlled proxy binding before querying its ATS', async () => {
  let calls = 0
  await assert.rejects(run({ fetchPage: async () => ({ status: 200, finalUrl: 'https://www.accellor.com/who-we-are/careers', html: '<h1>Accellor Careers</h1>' }), fetchJson: async () => { calls++; return {} } }), /binding|handoff/i)
  assert.equal(calls, 0)
})

for (const [name, change] of [
  ['foreign proxy tenant', f => { f.proxy.jobs[0].url = f.proxy.jobs[0].url.replace('/accellor/', '/other/') }],
  ['failed native envelope', f => { f.first[0].errors = [{ message: 'unavailable' }] }],
  ['malformed native error envelope', f => { f.first[0].errors = { message: 'unavailable' } }],
  ['incomplete native total', f => { f.first[0].data.oatsExternalJobPostingsFilters.find(x => x.type === 'DEPARTMENT' && x.count > 0).count++ }],
  ['repeated native identity', f => { const jobs = f.first[0].data.oatsExternalJobPostings.jobPostings; jobs[1].extId = jobs[0].extId }],
  ['unknown native country', f => { f.first[0].data.oatsExternalJobPostings.jobPostings[0].locations[0].isoCountry = 'ZZZ' }],
  ['changed final listing', f => { f.last[0].data.oatsExternalJobPostings.jobPostings[0].title += ' changed' }],
]) test('Accellor refuses ' + name + ' without certifying an empty or complete inventory', async () => {
  const f = fixture(); change(f)
  await assert.rejects(run(options(f)))
})

for (const [name, change] of [
  ['posting identity', j => { j.extId = 'unrelated-role' }],
  ['title', j => { j.title += ' changed' }],
  ['employer', j => { j.job.teamDisplayName = 'Other Employer' }],
  ['country', j => { j.locations[0].isoCountry = 'USA' }],
  ['hidden application', j => { j.isApplicationFormHidden = true }],
  ['unlisted posting', j => { j.isUnlistedExternally = true }],
  ['missing full description', j => { j.descriptionHtml = '' }],
]) test('Accellor rejects conflicting native detail ' + name, async () => {
  const f = fixture(); change(Object.values(f.details)[0][0].data.oatsExternalJobPosting)
  await assert.rejects(run(options(f)))
})

test('Accellor honors cancellation and refuses caller caps that could conceal the native tail', async () => {
  await assert.rejects(run({ signal: AbortSignal.abort(new Error('cancelled Accellor')), fetchPage: async () => assert.fail('must not fetch') }), /cancelled Accellor/)
  await assert.rejects(run({ ...options(fixture()), maxJobs: 1 }), /cap|complete|limit/i)
})

test('Accellor stops at an aborted official-page response before querying the proxy', async () => {
  const f = fixture(), controller = new AbortController(), reason = new Error('cancel Accellor after official page')
  let calls = 0
  await assert.rejects(run({ signal: controller.signal, fetchPage: async () => { controller.abort(reason); return f.official }, fetchJson: async () => { calls++; return f.proxy } }), error => error === reason)
  assert.equal(calls, 0)
})

test('Accellor cannot bind its native board from a quoted proxy example inside textarea markup', async () => {
  const f = fixture()
  f.official.html = '<textarea><script>fetch("https://workable-proxy-lyart.vercel.app/api/gem-jobs")</script></textarea>'
  await assert.rejects(run(options(f)), /binding|handoff/i)
})

test('Accellor requires a direct fetch of the exact proxy instead of an unrelated call beside a quoted example', async () => {
  const f = fixture()
  f.official.html = '<script>const example = "https://workable-proxy-lyart.vercel.app/api/gem-jobs"; fetch("https://example.com/jobs")</script>'
  await assert.rejects(run(options(f)), /binding|handoff/i)
})

test('Accellor cannot certify a binding using code inside conditional object fallback', async () => {
  const f = fixture()
  f.official.html = '<object data="/existing.pdf"><script>fetch("https://workable-proxy-lyart.vercel.app/api/gem-jobs")</script></object>'
  await assert.rejects(run(options(f)), /binding|handoff/i)
})
