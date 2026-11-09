import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { buildIndiaSearchUrl, createSchaefflerScraper } from '../../scraper/schaeffler/script.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/schaeffler/fixtures/actual-http-20261031.json.gz', import.meta.url))))
globalThis.fetch = async () => { throw Error('Schaeffler tests prohibit live HTTP') }
const replay = () => {
  const queues = new Map(), calls = []
  for (const row of fixture.responses) {
    if (!queues.has(row.url)) queues.set(row.url, [])
    queues.get(row.url).push(row)
  }
  const get = async url => {
    calls.push(url)
    const row = queues.get(url)?.shift()
    assert.ok(row, 'Expected retained original HTTP response')
    return { url: row.finalURL, status: row.status, headers: row.responseHeaders, bodyBase64: row.bodyBase64 }
  }
  return { get, calls }
}

test('Schaeffler retains its established official search URL utility', () => {
  assert.equal(buildIndiaSearchUrl(), 'https://jobs.schaeffler.com/search/?createNewAlert=false&q=&locationsearch=India&locale=en_US')
  assert.equal(new URL(buildIndiaSearchUrl(100)).searchParams.get('startrow'), '100')
})

test('Schaeffler factory reads genuine native tiles and full fields with a limited returned array', async () => {
  const { get, calls } = replay()
  let audit
  const jobs = await createSchaefflerScraper().run({ fetchPage: get, maxJobs: 1,
    now: () => '2026-10-31T03:30:00.000Z', onAudit: value => { audit = value } })
  assert.equal(jobs.length, 1)
  assert.equal(calls.length, 12)
  assert.equal(audit.observations.length, 10)
  const job = audit.observations.find(job => job.jobId === '1430629133')
  assert.equal(job.title, 'SAP S/4HANA ABAP Techno-Functional Consultant')
  assert.equal(job.requisitionId, '46510')
  assert.equal(job.company, 'Schaeffler')
  assert.equal(job.country, null);assert.equal(job.city, null);assert.equal(job.location, null)
  assert.equal(job.sourceCountryScopeUnresolved, true)
  assert.equal(job.employmentType, null)
  assert.deepEqual(job.requiredSkills, [])
  assert.equal(job.postingDate, '2026-10-31T02:00:00.000Z')
  assert.equal(job.closingDate, '2026-11-07T18:30:00.000Z')
  assert.ok(job.jobDescription.length > 3000)
  assert.equal(job.sourceNativeRoleDetail.bound, true)
  assert.equal(job.sourceDetailComplete, false);assert.equal(job.lifecycleCleanupAllowed, false)
})

test('legacy bare-text injection remains diagnostic and cannot manufacture qualified HTTP or role authority', async () => {
  const { get } = replay()
  let audit
  const jobs = await createSchaefflerScraper().run({ fetchText: async url => Buffer.from((await get(url)).bodyBase64, 'base64').toString('utf8'),
    onAudit: value => { audit = value } })
  assert.equal(jobs.length, 0)
  assert.equal(audit.observations.length, 10)
  assert.ok(audit.observations.every(job => !job.sourceNativeRoleDetail.bound && job.country === null && job.sourceNativeRole.originalDescriptionHTML))
  assert.equal(audit.sourceScopeComplete, false)
})
