import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { WORKDAY_COUNTRY_INVENTORY_PROOF } from '../scraper-support/myworkday/countryInventoryProof.js'

const root = new URL('../scraper/entegris.workday/fixtures/current-20261029/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', root), 'utf8'))
const records = [...manifest.requests, ...(manifest.researchSamples || [])].map(receipt => {
  const body = gunzipSync(fs.readFileSync(new URL(receipt.filename, root)))
  assert.equal(createHash('sha256').update(body).digest('hex'), receipt.bodySHA256)
  return { ...receipt, body: body.toString('utf8') }
})
const CAREERS = 'https://www.entegris.com/careers'
const HANDOFF = 'https://www.entegris.com/en/home/about-us/careers/job-opportunities.html'
const API = 'https://entegris.wd1.myworkdayjobs.com/wday/cxs/entegris/EntegrisCareers/jobs'
const INDIA = 'c4f78be1a8f14da0ab49ce1162348a5e'
const globalSample = JSON.parse(records.find(row => row.url === API && !Object.keys(JSON.parse(row.requestBody).appliedFacets).length).body)
const detail = records.find(row => row.url.includes('/job/'))
const native = JSON.parse(detail.body)
const run = options => createCatalogScraper(getScraperCatalog().find(row => row.source === 'entegris')).run(options)
const jsonBody = (row, edit) => {
  const payload = JSON.parse(row.body)
  edit(payload)
  return { ...row, body: JSON.stringify(payload) }
}
// This changes only native geography in a real source-specific record, to test
// future India extraction. It is not represented as a current live India role.
const withIndia = row => row.url === API ? jsonBody(row, payload => {
  payload.total = 1
  payload.jobPostings = [{ ...globalSample.jobPostings[0], locationsText: 'Bengaluru, India' }]
}) : row.url === detail.url ? jsonBody(row, payload => {
  const country = { descriptor: 'India', id: INDIA, alpha2Code: 'IN' }
  Object.assign(payload.jobPostingInfo, { location: 'Bengaluru, India', country,
    jobRequisitionLocation: { descriptor: 'Bengaluru, India', country }, additionalLocations: [] })
}) : row
const replay = (t, mutate) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.href || input.url
    const method = init.method || 'GET'
    calls.push({ url, method, body: init.body })
    assert.ok(['GET', 'POST'].includes(method))
    const row = records.find(row => row.url === url && row.method === method
      && (method !== 'POST' || Object.keys(JSON.parse(row.requestBody).appliedFacets).length > 0))
    assert.ok(row, 'Uncaptured native HTTP request: ' + url)
    const current = mutate ? mutate({ ...row }, calls) : row
    const headers = Object.fromEntries(Object.entries(current.headers).filter(([, value]) => value != null))
    const response = new Response(current.body, { status: current.status, headers })
    Object.defineProperty(response, 'url', { value: current.finalURL })
    return response
  })
  return calls
}

test('registered Entegris verifies the current corporate redirect and real native India facet without a company-wide zero claim', async t => {
  const calls = replay(t)
  const jobs = await run()
  assert.deepEqual(jobs, [])
  assert.equal(calls[0].url, CAREERS)
  assert.equal(calls[1].url, HANDOFF)
  assert.ok(calls.filter(call => call.url === API).length >= 3)
  assert.ok(calls.filter(call => call.method === 'POST').every(call => call.url === API
    && JSON.parse(call.body).appliedFacets.locationCountry[0] === INDIA))
  assert.equal(readInventoryEvidence(jobs).firstParty, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(jobs[WORKDAY_COUNTRY_INVENTORY_PROOF].boards[0].reportedTotal, 0)
  assert.equal(jobs[WORKDAY_COUNTRY_INVENTORY_PROOF].boards[0].scope, 'india-country-facet')
  assert.equal(getScraperCatalog().find(row => row.source === 'entegris').verifiedIndiaJobCount, null)
})

test('Entegris extracts a source-specific future India role with original full content and native publication date', async t => {
  replay(t, withIndia)
  const jobs = await run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, native.jobPostingInfo.jobReqId)
  assert.equal(jobs[0].title, native.jobPostingInfo.title)
  assert.equal(jobs[0].sourceDescription, native.jobPostingInfo.jobDescription)
  assert.equal(jobs[0].sourceUrl, native.jobPostingInfo.externalUrl)
  assert.equal(jobs[0].nativeEmployer, 'Entegris, Inc.')
  assert.equal(jobs[0].company, 'Entegris')
  assert.equal(jobs[0].country, 'India')
  assert.equal(new Date(jobs[0].postingDate).toISOString().slice(0, 10), native.jobPostingInfo.startDate)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

for (const changed of ['corporate anchor', 'redirect target', 'native India country', 'native error envelope', 'role country', 'role employer', 'role application status']) {
  test('Entegris rejects a contradictory ' + changed, async t => {
    const calls = replay(t, row => {
      row = withIndia(row)
      if (changed === 'corporate anchor' && row.url === CAREERS) return { ...row, body: '<html><body>Entegris careers. No current Job Opportunities link.</body></html>' }
      if (changed === 'redirect target' && row.url === HANDOFF) return { ...row, headers: { ...row.headers, location: 'https://unrelated.wd1.myworkdayjobs.com/Other' } }
      if (changed === 'native India country' && row.url === API) return jsonBody(row, payload => {
        const walk = node => { if (node && typeof node === 'object') { if (node.descriptor === 'India') node.id = 'unrelated-country'; Object.values(node).forEach(walk) } }
        walk(payload.facets)
      })
      if (changed === 'native error envelope' && row.url === API) return jsonBody(row, payload => { payload.success = false; payload.error = 'Unavailable' })
      if (row.url === detail.url) return jsonBody(row, payload => {
        if (changed === 'role country') payload.jobPostingInfo.country = native.jobPostingInfo.country
        if (changed === 'role employer') payload.hiringOrganization.name = 'Unrelated Employer'
        if (changed === 'role application status') payload.jobPostingInfo.canApply = false
      })
      return row
    })
    await assert.rejects(run())
    if (['corporate anchor', 'redirect target'].includes(changed)) assert.ok(!calls.some(call => call.url === API))
  })
}

test('Entegris never treats a blocked corporate page as an empty native inventory', async t => {
  replay(t, row => row.url === CAREERS ? { ...row, status: 403, body: 'Denied' } : row)
  await assert.rejects(run(), /HTTP 403|handoff|careers/i)
})

test('Entegris honors caller cancellation before public HTTP', async t => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Cancelled source must not fetch'))
  const controller = new AbortController()
  controller.abort(Error('cancel Entegris source'))
  await assert.rejects(run({ signal: controller.signal }), /cancel Entegris source/)
})
