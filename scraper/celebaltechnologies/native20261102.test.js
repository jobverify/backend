import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run, parseJobsBundle, normalizeRole } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const native = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261102.json.gz', import.meta.url))))
const bundle = native.find(row => row.url.includes('9835-')).body
const officesURL = 'https://celebaltech.com/about-us/office-locations'

test('Celebal binds the explicit all-CT-offices role to its currently published India office section and reconciles both snapshots', async () => {
  let reads = 0
  const jobs = await run({ fetchText: async url => { reads += 1; return native.find(row => row.url === url)?.body || assert.fail(url) } })
  assert.equal(jobs.length, 16)
  const allOffices = jobs.find(job => job.jobId === 'databricks-solutions-architect')
  assert.equal(allOffices.country, 'India')
  assert.equal(allOffices.city, null)
  assert.equal(allOffices.sourceNativeLocation, 'All CT office / Onsite ( CT office )')
  assert.match(allOffices.sourceCountryEvidence.nativeRoleLocation, /^All CT office/)
  assert.equal(allOffices.sourceCountryEvidence.officePageURL, officesURL)
  assert.ok(allOffices.sourceCountryEvidence.indiaOfficeAddresses.some(text => /Jaipur/.test(text)))
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 16)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 16)
  assert.equal(reads, 8)
})

test('Celebal preserves every published desired and good-to-have criterion and never invents employment from office mode', () => {
  const role = parseJobsBundle(bundle)[0]
  const job = normalizeRole(role)
  assert.match(job.jobDescription, /SAP Data Integration/)
  assert.match(job.jobDescription, /Databricks Certified Data Engineer Professional/)
  assert.equal(normalizeRole({ ...role, workMode: 'Work from Office' }).employmentType, null)
})

test('Celebal includes the explicit India Jaipur role and preserves mixed native worksites, retaining the one all-offices country gap', async () => {
  let count = 0
  const jobs = await run({ fetchText: async url => { count += 1; if (url === officesURL) throw new Error('native office page HTTP503'); return native.find(row => row.url === url)?.body || assert.fail(url) } })
  assert.equal(jobs.length, 15)
  assert.ok(jobs.some(job => job.jobId === 'senior-solution-sales-specialist'))
  assert.match(jobs.find(job => job.jobId === 'data-scientist-fresher').location, /Houston/)
  assert.match(jobs.find(job => job.jobId === 'data-scientist-fresher').location, /Jaipur/)
  assert.equal(count, 7)
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.reportedTotal, 16)
  assert.equal(inventory.status, 'coverage-gap')
  assert.match(inventory.reason, /databricks-solutions-architect/)
  assert.match(inventory.reason, /closing/)
})

test('Celebal rejects closing criteria drift in the public native bundle', async () => {
  let bundleReads = 0
  await assert.rejects(run({ fetchText: async url => {
    const body = native.find(row => row.url === url)?.body || assert.fail(url)
    if (url.includes('9835-') && ++bundleReads > 1) return body.replace('SAP Datasphere', 'unpublished changed criterion')
    return body
  } }), /closing|changed/i)
})

test('Celebal does not infer an all-offices India option from office text outside a native India country section', async () => {
  const jobs = await run({ fetchText: async url => {
    const body = native.find(row => row.url === url)?.body || assert.fail(url)
    return url === officesURL ? body.replace('>India</h2>', '>Unqualified locations</h2>') : body
  } })
  assert.equal(jobs.length, 15)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Celebal preserves its country gap if the native India office addresses change at closing', async () => {
  let officeReads = 0
  const jobs = await run({ fetchText: async url => {
    const body = native.find(row => row.url === url)?.body || assert.fail(url)
    return url === officesURL && ++officeReads > 1 ? body.replace('Shipra Path', 'changed street') : body
  } })
  assert.equal(jobs.length, 15)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
