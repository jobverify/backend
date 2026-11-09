import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createCeiScraper, extractJobs } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const native = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261102.json.gz', import.meta.url))))
const clone = value => structuredClone(value)
const options = ({ closing = native.jobs } = {}) => {
  let reads = 0
  return {
    fetchText: async url => {
      if (url.includes('main-es2015.js')) return native.client
      if (url.includes('/about-us/')) return native.careers
      if (url.startsWith('https://cei.ai/jobs/')) return native.portal
      assert.fail(`Unexpected first-party page ${url}`)
    },
    fetchJson: async url => {
      if (url.endsWith('/app.json')) return clone(native.app)
      assert.match(new URL(url).searchParams.get('fields'), /address\([^)]*countryID/)
      reads += 1
      return clone(reads === 1 ? native.jobs : closing)
    },
  }
}

test('CEI reconciles all 66 native public rows and uses its published country IDs for a complete India-zero board', async () => {
  const jobs = await createCeiScraper().run(options())
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.reportedTotal, 66)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.listingComplete, true)
  assert.match(evidence.reason, /closing/)
})

test('CEI never treats descriptions mentioning India as role workplace evidence', () => {
  const record = clone(native.jobs.data[0])
  record.publicDescription += '<p>Collaborate with our India and Chennai delivery teams.</p>'
  record.address.countryName = 'United States'
  assert.equal(extractJobs({ data: [record] }, native.app).length, 0)
})

test('CEI retains a precise country gap for an unmapped native ID', async () => {
  const payload = clone(native.jobs)
  payload.data[0].address.countryID = 999999
  const jobs = await createCeiScraper().run({ ...options(), fetchJson: async url => url.endsWith('/app.json') ? clone(native.app) : clone(payload) })
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.match(readInventoryEvidence(jobs).reason, /country/)
})

test('CEI rejects closing role or criteria drift instead of certifying zero', async () => {
  const closing = clone(native.jobs)
  closing.data[0].id += 1
  await assert.rejects(createCeiScraper().run(options({ closing })), /closing|inventory|changed/i)
})
