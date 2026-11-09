import assert from 'node:assert/strict'
import test from 'node:test'
import { getScraperCatalog } from '../providers/index.js'
import { runApiPortalScraper } from '../apiPortal/engine.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const id = '1000000000001173'
const applyUrl = `https://jobs.smartrecruiters.com/PHONEPELIMITED/${id}-ccm-tirupati`
const listing = () => ({ status: 'PUBLIC', title: 'CCM - Tirupati', location: 'Tirupati',
  applyUrl, department: 'Lending Business', type: 'Full-time' })
const detail = () => ({ id, company: { identifier: 'PHONEPELIMITED' }, postingUrl: applyUrl,
  location: { country: 'in', city: 'Tirupati' },
  jobAd: { sections: {
    companyDescription: { text: '<p>PhonePe company introduction.</p>' },
    jobDescription: { text: '<p>Lead collections teams and monitor portfolio performance.</p>' },
    qualifications: { text: '<p>Five years of collections experience.</p>' },
    additionalInformation: { text: '<p>Equal opportunity employer.</p>' },
  } } })
const provider = () => structuredClone(getScraperCatalog().find(p => p.source === 'phonepe'))
const run = (options = {}) => {
  const config = options.provider || provider()
  if (options.required !== undefined) config.config.detail.required = options.required
  const records = options.records || [listing()]
  const calls = []
  return runApiPortalScraper({ provider: config, fetchJson: async url => {
    calls.push(url)
    if (url === config.config.discovery.listingApiUrl) return {
      results: records, totalCount: options.totalCount ?? records.length,
    }
    assert.equal(url, `https://api.smartrecruiters.com/v1/companies/PHONEPELIMITED/postings/${id}`)
    if (options.error) throw options.error
    return options.detail || detail()
  } }).then(jobs => ({ jobs, calls, evidence: readInventoryEvidence(jobs) }))
}

test('PhonePe hydrates full employer content from the exact public SmartRecruiters posting', async () => {
  const { jobs, evidence, calls } = await run({ records: [
    { status: 'NOT_PUBLISHED', title: 'Internal draft', applyUrl: null },
    { status: 'PRIVATE', title: 'Private role', applyUrl: null },
    { status: 'INTERNAL', title: 'Internal role', applyUrl: null },
    { status: null, title: 'Historical record', applyUrl: null },
    listing(),
  ] })
  assert.equal(jobs.length, 1)
  assert.match(jobs[0].jobDescription, /Lead collections teams/)
  assert.match(jobs[0].jobDescription, /Five years/)
  assert.match(jobs[0].jobDescription, /Equal opportunity/)
  assert.equal(jobs[0].minimumQualification, detail().jobAd.sections.qualifications.text)
  assert.equal(jobs[0].location, 'Tirupati')
  assert.equal(jobs[0].sourceUrl, applyUrl)
  assert.equal(calls.length, 2)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 5)
  assert.equal(evidence.indiaFacetCount, 1)
})

for (const [label, change] of [
  ['wrong company', p => { p.company.identifier = 'ANOTHERCOMPANY' }],
  ['wrong job ID', p => { p.id = '1000000000009999' }],
  ['wrong posting URL', p => { p.postingUrl = applyUrl.replace(id, '1000000000009999') }],
  ['missing role content', p => { p.jobAd.sections.jobDescription.text = '<p>&nbsp;</p>' }],
  ['upstream error', p => { p.error = 'unavailable' }],
]) test(`PhonePe rejects ${label} detail without authorizing deletion`, async () => {
  const payload = detail()
  change(payload)
  await assert.rejects(run({ detail: payload, required: true }), /SmartRecruiters|detail|description/i)
})

test('PhonePe rejects an unexpected public company before requesting its details', async () => {
  await assert.rejects(run({ required: true, records: [{ ...listing(), applyUrl: applyUrl.replace('PHONEPELIMITED', 'OTHER') }] }),
    /SmartRecruiters.*(?:company|URL)/i)
})

test('PhonePe required detail HTTP failures propagate', async () => {
  await assert.rejects(run({ required: true, error: new Error('HTTP 503 detail unavailable') }), /HTTP 503/)
})

test('PhonePe reconciles totals across public and excluded non-public records', async () => {
  const { jobs, evidence } = await run({ totalCount: 2 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(evidence.listingComplete, false)
})

test('optional SmartRecruiters detail failure preserves a partial listing', async () => {
  const config = provider()
  config.config.detail = { ...(config.config.detail || {}), required: false }
  const { jobs, evidence } = await run({ provider: config, error: new Error('HTTP 503 detail unavailable') })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(evidence.listingComplete, false)
  assert.match(evidence.reason, /optional-role-details-unavailable/)
})

test('PhonePe preserves prior jobs when an actual public role has no employer content', async () => {
  const payload = detail()
  for (const section of Object.values(payload.jobAd.sections)) section.text = ''
  const { jobs, evidence } = await run({ detail: payload })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(evidence.listingComplete, false)
  assert.match(evidence.reason, /employer-description-unavailable/)
})

for (const [label, location] of [
  ['foreign native country', { country: 'us', city: 'Tirupati' }],
  ['mismatched native city', { country: 'in', city: 'New York' }],
  ['unknown native country', { city: 'Tirupati' }],
  ['blank native city', { country: 'in', city: ' ' }],
]) test(`PhonePe fails closed for ${label} even when details are optional`, async () => {
  const payload = detail()
  payload.location = location
  await assert.rejects(run({ detail: payload }), /SmartRecruiters.*(?:country|location|scope)/i)
})

test('PhonePe requires native geography even when the employer description is empty', async () => {
  const payload = detail()
  payload.location.country = 'us'
  payload.jobAd.sections.jobDescription.text = ''
  await assert.rejects(run({ detail: payload }), /SmartRecruiters.*(?:country|location|scope)/i)
})

test('PhonePe accepts native country and city case/whitespace differences without changing the listing label', async () => {
  const payload = detail()
  payload.location = { country: ' IN ', city: ' tiruPATI ' }
  const { jobs } = await run({ detail: payload })
  assert.equal(jobs[0].location, 'Tirupati')
  assert.equal(jobs[0].country, 'India')
  assert.match(jobs[0].jobDescription, /Lead collections/)
})
