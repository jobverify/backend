import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { hasOfficialCareersPageSignal, extractIndiaJobsFromGreenhousePayload, run } from '../../scraper/calendly/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const careers = await fs.readFile(new URL('./fixtures/calendly/current-careers.html', import.meta.url), 'utf8')
const payload = JSON.parse(await fs.readFile(new URL('./fixtures/calendly/current-feed.json', import.meta.url), 'utf8'))
const options = () => ({ fetchText: async () => careers, fetchJson: async () => structuredClone(payload) })

test('official department lists remain valid with no featured jobs heading', () => {
  assert.equal(hasOfficialCareersPageSignal(careers), true)
})
test('nine current public US roles reconcile with careers cards and inventory evidence', async () => {
  const jobs = await run(options())
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.reportedTotal, 9)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.status, 'complete-inventory')
})
test('encoded complete Greenhouse description maps to plain text for a future India job', () => {
  const job = structuredClone(payload.jobs[0])
  job.location.name = 'Bengaluru, India'
  job.offices = [{ name: 'Bengaluru', location: 'Bengaluru, Karnataka, India' }]
  const [mapped] = extractIndiaJobsFromGreenhousePayload({ jobs: [job], meta: { total: 1 } })
  assert.equal(mapped.country, 'India')
  assert.ok(mapped.jobDescription.includes('What’s in it for you?'))
  assert.ok(mapped.jobDescription.includes('About the team & opportunity'))
  assert.doesNotMatch(mapped.jobDescription, /&lt;|&gt;|&amp;|<p>/)
})
test('truncated and duplicate feed cannot return a false empty India inventory', () => {
  assert.throws(() => extractIndiaJobsFromGreenhousePayload({ jobs: [], meta: { total: 9 } }), /incomplete.*inventory|count/i)
  assert.throws(() => extractIndiaJobsFromGreenhousePayload({ jobs: [payload.jobs[0], payload.jobs[0]], meta: { total: 2 } }), /duplicate|repeated/i)
})
test('unknown public location country fails before excluding a role', () => {
  const job = { ...structuredClone(payload.jobs[0]), location: { name: 'Remote' }, offices: [] }
  assert.throws(() => extractIndiaJobsFromGreenhousePayload({ jobs: [job], meta: { total: 1 } }), /unresolved.*country/i)
})
test('arbitrary metadata containing India cannot reclassify a US role', () => {
  const job = { ...structuredClone(payload.jobs[0]), metadata: [{ name: 'Featured Job Post', value: 'India' }] }
  assert.deepEqual(extractIndiaJobsFromGreenhousePayload({ jobs: [job], meta: { total: 1 } }), [])
})
test('current first-party role IDs must match the complete API inventory', async () => {
  const mock = options()
  mock.fetchJson = async () => ({ jobs: payload.jobs.slice(1), meta: { total: 8 } })
  await assert.rejects(run(mock), /careers.*inventory|inventory.*careers/i)
})
test('complete full feed must remain stable across reconciliation', async () => {
  let calls = 0
  const mock = options()
  mock.fetchJson = async () => {
    const value = structuredClone(payload)
    if (++calls > 1) value.jobs[0].updated_at = '2026-10-09T12:00:00Z'
    return value
  }
  await assert.rejects(run(mock), /inventory changed/i)
})
test('wrong Greenhouse tenant and absent handoff never establish official jobs', () => {
  assert.equal(hasOfficialCareersPageSignal(careers.replaceAll('/calendly/jobs/', '/other/jobs/')), false)
  assert.equal(hasOfficialCareersPageSignal(careers.replace(/<a\b[^>]*href="https:\/\/boards\.greenhouse\.io\/calendly\/jobs\/\d+"[^>]*>[\s\S]*?<\/a>/gi, '')), false)
})

test('malformed full descriptions and missing employer identity cannot validate foreign inventory', () => {
  for (const change of [{ content: { error: 'not a description' } }, { company_name: null }, { title: null }]) {
    const job = { ...structuredClone(payload.jobs[0]), ...change }
    assert.throws(() => extractIndiaJobsFromGreenhousePayload({ jobs: [job], meta: { total: 1 } }), /description|company identity|detail route|malformed/i)
  }
})
