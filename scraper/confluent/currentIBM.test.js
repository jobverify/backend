import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createConfluentScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const career = 'https://careers.confluent.io/'
const landing = 'https://www.ibm.com/careers/search?q=confluent'
const api = 'https://www-api.ibm.com/search/api/v2'
const payload = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/ibm-search-20261115.json.gz', import.meta.url))))
const html = gunzipSync(readFileSync(new URL('./fixtures/ibm-careers-20261115.html.gz', import.meta.url))).toString()
const makeOptions = ({ result = payload, location = landing } = {}) => ({
  fetchPage: async url => url === career
    ? { status: 301, url, headers: { location }, html: '' }
    : (assert.equal(url, landing), { status: 200, url, headers: { 'content-type': 'text/html' }, html }),
  fetchJson: async (url, options) => {
    assert.equal(url, api)
    assert.equal(options.method, 'POST')
    const request = JSON.parse(options.body)
    assert.equal(request.sm.query, 'confluent')
    assert.equal(request.post_filter.term.field_keyword_05, 'India')
    return structuredClone(result)
  },
})

test('current employer IBM redirect recovers only explicitly Confluent-branded native India roles', async () => {
  const jobs = await createConfluentScraper().run(makeOptions())
  assert.equal(jobs.length, 12)
  assert.ok(jobs.every(job => /\bConfluent\b/i.test(job.title) && job.country === 'India'))
  assert.equal(jobs[0].jobId, '139000')
  assert.equal(jobs[0].location, 'Bangalore, India')
  assert.match(jobs[0].jobDescription, /React and TypeScript/)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('the migration requires the exact current employer handoff before reading IBM results', async () => {
  let queried = false
  const options = makeOptions({ location: 'https://www.ibm.com/careers/search?q=unrelated' })
  options.fetchJson = async () => { queried = true; return payload }
  await assert.rejects(createConfluentScraper().run(options), /handoff/i)
  assert.equal(queried, false)
})

test('a missing native country cannot be supplied by the India search filter', async () => {
  const result = structuredClone(payload)
  result.hits.hits[0]._source.field_keyword_05 = null
  const jobs = await createConfluentScraper().run(makeOptions({ result }))
  assert.equal(jobs.length, 11)
  assert.ok(!jobs.some(job => job.jobId === '139000'))
})

test('a foreign native location cannot borrow the India search country', async () => {
  const result = structuredClone(payload)
  result.hits.hits[0]._source.field_keyword_19 = 'London, GB'
  const jobs = await createConfluentScraper().run(makeOptions({ result }))
  assert.equal(jobs.length, 11)
  assert.ok(!jobs.some(job => job.jobId === '139000'))
})

test('an empty IBM search remains incomplete source scope', async () => {
  const result = { hits: { total: { value: 0, relation: 'eq' }, hits: [] } }
  const jobs = await createConfluentScraper().run(makeOptions({ result }))
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('foreign native application authorities cannot be published under Confluent', async () => {
  const result = structuredClone(payload)
  result.hits.hits[0]._source.url = 'https://example.org/careers/JobDetail?jobId=139000'
  await assert.rejects(createConfluentScraper().run(makeOptions({ result })), /native.*URL|authority/i)
})
