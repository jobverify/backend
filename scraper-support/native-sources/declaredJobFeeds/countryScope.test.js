import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, replay, mutateHTML } from './fixtureReplay.js'
import { createCatalogScraper, getScraperCatalog } from '../../providers/index.js'
import { createDeclaredJobFeedScraper, DECLARED_JOB_FEED_PROFILES as profiles } from './nativeCareers.js'

globalThis.fetch = async () => { throw Error('Original entity replay prohibits network') }
const provider = source => getScraperCatalog().find(row => row.source === source)

test('registered SandboxAQ retains its configured Global return scope, including foreign posts', async () => {
  assert.equal(provider('sandboxaq').countryFilter, 'Global')
  const r = replay(), jobs = await createCatalogScraper(provider('sandboxaq')).run(r.options)
  const expected = fixture.oracle.sandboxaq.records
  assert.equal(expected.length, 37)
  assert.deepEqual(jobs.map(job => job.jobId), expected.map(row => row.id))
  assert.ok(jobs.some(job => job.country === 'United States'))
  assert.ok(jobs.every(job => job.sourceCurrentNativePostingIdentityQualified === true))
  assert.equal(r.audits[0].countryFilter, 'Global')
})

test('registered Plivo declares its Global scope even when the observed feed is empty', async () => {
  assert.equal(provider('plivo').countryFilter, 'Global')
  const r = replay(), jobs = await createCatalogScraper(provider('plivo')).run(r.options)
  assert.equal(jobs.length, 0)
  assert.equal(r.audits[0].countryFilter, 'Global')
})

test('Global scope returns identity qualified posts with conflicting country evidence without inventing a country', async () => {
  const id = fixture.oracle.sandboxaq.records[0].id
  const r = replay((url, page) => url === profiles.sandboxaq.boardURL + '/' + id
    ? mutateHTML(page, (_data, schemas) => {
      schemas[0].applicantLocationRequirements = { '@type': 'Country', name: 'India' }
    }) : page)
  const jobs = await createDeclaredJobFeedScraper({ ...profiles.sandboxaq, countryFilter: 'Global' }).run(r.options)
  const job = jobs.find(row => row.jobId === id)
  assert.ok(job, 'A geography conflict must not discard an otherwise valid Global posting')
  assert.equal(job.sourceCurrentNativePostingIdentityQualified, true)
  assert.equal(job.sourceCurrentNativeRoleQualified, false)
  assert.equal(job.sourceNativeCountryConflict, true)
  assert.equal(job.country, null)
  assert.equal(job.location, null)
  assert.deepEqual(job.locations, [])
})

test('India scope still filters known foreign posts and invalid scope fails before GET', async () => {
  const r = replay(), jobs = await createDeclaredJobFeedScraper({ ...profiles.sandboxaq, countryFilter: 'India' }).run(r.options)
  assert.equal(jobs.length, 0)
  const invalid = replay()
  await assert.rejects(createDeclaredJobFeedScraper({ ...profiles.sandboxaq, countryFilter: 'IN' }).run(invalid.options), /countryFilter/)
  assert.equal(invalid.requests.length, 0)
})

test('Global scope does not return a posting after a closing identity or own response failure', async () => {
  const id = fixture.oracle.sandboxaq.records[0].id
  const r = replay((url, page, visit) => url === profiles.sandboxaq.boardURL + '/' + id && visit === 2 ? { ...page, status: 502 } : page)
  const jobs = await createDeclaredJobFeedScraper({ ...profiles.sandboxaq, countryFilter: 'Global' }).run(r.options)
  assert.equal(jobs.some(job => job.jobId === id), false)
  const retained = r.audits[0].observations.find(job => job.jobId === id)
  assert.ok(retained.jobDescription)
  assert.equal(retained.sourceCurrentNativePostingIdentityQualified, false)
})

test('Global paired identity requires a successful opening own detail as well as a closing detail', async () => {
  const id = fixture.oracle.sandboxaq.records[0].id
  const r = replay((url, page, visit) => url === profiles.sandboxaq.boardURL + '/' + id && visit === 1 ? { ...page, status: 502 } : page)
  const jobs = await createDeclaredJobFeedScraper({ ...profiles.sandboxaq, countryFilter: 'Global' }).run(r.options)
  assert.equal(jobs.some(job => job.jobId === id), false)
  assert.equal(r.audits[0].observations.find(job => job.jobId === id).sourceCurrentNativePostingIdentityQualified, false)
})

test('Global scope is also honored by the delegated Greenhouse reader', async () => {
  const r = replay(), jobs = await createDeclaredJobFeedScraper({ ...profiles.cymulate, countryFilter: 'Global' }).run(r.options)
  const expected = fixture.oracle.cymulate.records.filter(row => row.originalOwnRecord.internal_job_id !== null)
  assert.ok(expected.some(row => row.expectedGeography.country !== 'India'))
  assert.deepEqual(jobs.map(job => job.jobId), expected.map(row => row.id))
  assert.ok(jobs.every(job => job.sourceCurrentNativePostingIdentityQualified === true))
  assert.equal(r.audits[0].countryFilter, 'Global')
})
