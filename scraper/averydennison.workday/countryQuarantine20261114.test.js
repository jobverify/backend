import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const client = JSON.parse(fs.readFileSync(new URL('./corporateClient20261114.fixture.json', import.meta.url)))
const corporate = '<html><script>' + gunzipSync(Buffer.from(client.gzipBase64, 'base64')).toString() + '</script></html>'
const API = 'https://api.smartrecruiters.com/v1/companies/AveryDennison/postings'
const now = '2026-11-14T12:53:05.671Z'
const row = (id, country = 'in') => ({ id, name: 'Manufacturing Software Engineer ' + id,
  refNumber: 'REQ-' + id, uuid: 'posting-' + id, jobAdId: 'ad-' + id, ref: API + '/' + id,
  releasedDate: '2026-11-13T00:00:00.000Z', visibility: 'PUBLIC',
  company: { identifier: 'AveryDennison', name: 'Avery Dennison' },
  location: { city: country === 'in' ? 'Bengaluru' : 'Boston', country,
    fullLocation: country === 'in' ? 'Bengaluru, India' : 'Boston, United States' },
  customField: [{ fieldId: 'COUNTRY', fieldLabel: 'Country/Region', valueId: country,
    valueLabel: country === 'in' ? 'India' : 'United States' },
  { fieldId: 'VACANCY', fieldLabel: 'Country of vacancy', valueLabel: country === 'in' ? 'India' : 'United States' }] })
const nativeDetail = record => ({ ...record, active: true, jobId: 'native-' + record.id,
  postingUrl: 'https://jobs.smartrecruiters.com/AveryDennison/' + record.id + '-software-engineer',
  applyUrl: 'https://jobs.smartrecruiters.com/AveryDennison/' + record.id + '-software-engineer?oga=true',
  jobAd: { sections: { companyDescription: { text: '<p>Avery Dennison manufactures labeling materials.</p>' },
    jobDescription: { text: '<p>Design and build dependable manufacturing information systems. Maintain production software, investigate incidents, collaborate with product teams, and document reliable operating procedures. Develop automated services and improve the performance and accuracy of supply chain reporting across engineering systems.</p>' },
    qualifications: { text: '<p>A degree in software engineering and experience maintaining production systems are required.</p>' } } } })

async function collect({ onlyConflict = false, change = () => {} } = {}) {
  const records = [row('1001'), ...(onlyConflict ? [] : [row('1002')]), row('1003', 'us')]
  records[0].customField[0].valueId = 'my'
  records[0].customField[0].valueLabel = 'Malaysia'
  records[0].customField[1].valueLabel = 'Malaysia'
  const calls = [], counts = new Map()
  const fetchImpl = async (url, init) => {
    assert.equal(init.method, 'GET')
    calls.push(url)
    const count = (counts.get(url) || 0) + 1
    counts.set(url, count)
    assert.notEqual(url, API + '/1001', 'Contradictory geography cannot start a publishable detail request')
    let body
    if (url === client.sourceURL) body = corporate
    else if (url.startsWith(API + '?')) {
      const offset = Number(new URL(url).searchParams.get('offset'))
      const payload = { offset, limit: 100, totalFound: records.length, content: structuredClone(records.slice(offset, offset + 100)) }
      change(payload, url, count)
      body = JSON.stringify(payload)
    } else {
      const record = records.find(record => record.ref === url)
      assert.ok(record, 'Unadvertised role URL ' + url)
      const payload = nativeDetail(structuredClone(record))
      change(payload, url, count)
      body = JSON.stringify(payload)
    }
    const response = new Response(body, { headers: {
      'content-type': url === client.sourceURL ? 'text/html' : 'application/json' } })
    Object.defineProperty(response, 'url', { value: url })
    return response
  }
  const provider = getScraperCatalog().find(record => record.source === 'averydennison')
  return { jobs: await createCatalogScraper(provider).run({ fetchImpl, now }), calls }
}

test('Avery quarantines an India/Malaysia contradiction and recovers only proven India roles', async () => {
  const { jobs, calls } = await collect()
  assert.deepEqual(jobs.map(job => job.jobId), ['1002'])
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete === true))
  assert.ok(jobs.every(job => job.sourceScopeComplete === false && job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
  assert.equal(jobs.nativeCollectionEvidence.observedNativeRecords, 3)
  assert.equal(jobs.nativeCollectionEvidence.observedTypedIndiaRecords, 2)
  assert.equal(jobs.nativeCollectionEvidence.verifiedIndiaRecords, 1)
  assert.equal(jobs.nativeCollectionEvidence.quarantinedCountryRoles.length, 1)
  const excluded = jobs.nativeCollectionEvidence.quarantinedCountryRoles[0]
  assert.equal(excluded.id, '1001')
  assert.equal(excluded.location.country, 'in')
  assert.equal(excluded.customField.find(field => field.fieldId === 'COUNTRY').valueId, 'my')
  assert.match(excluded.reason, /country|fullLocation/i)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.ok(calls.some(url => url.endsWith('offset=3')), 'The terminal page must still reconcile every native row')
})

test('Avery keeps the unresolved country audit and cleanup hold when no proven India roles remain', async () => {
  const { jobs } = await collect({ onlyConflict: true })
  assert.equal(jobs.length, 0)
  assert.equal(jobs.nativeCollectionEvidence.quarantinedCountryRoles.length, 1)
  assert.equal(jobs.nativeCollectionEvidence.verifiedIndiaRecords, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('Avery still rejects listing drift in a quarantined row', async () => {
  await assert.rejects(collect({ change(payload, url, count) {
    if (url === API + '?limit=100&offset=0' && count === 2) payload.content[0].name += ' changed'
  } }), /listing fields changed/i)
})

test('Avery still rejects malformed native geography and listing/detail country disagreement', async () => {
  await assert.rejects(collect({ change(payload) {
    if (payload.content?.[0]) payload.content[0].location.country = null
  } }), /typed native geography/i)
  await assert.rejects(collect({ change(payload, url) {
    if (url === API + '/1002') payload.customField[0].valueId = 'my'
  } }), /geography|custom-field/i)
})
