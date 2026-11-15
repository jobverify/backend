import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createIqviaScraper, JOBS_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'

const fixture = () => JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-flight-20261115.json.gz', import.meta.url))))
const frame = value => `<script>self.__next_f.push(${JSON.stringify([1, value])})</script>`
const shell = (url, body) => `<html><head><title>Working at IQVIA | Jobs and Careers at IQVIA</title><link rel="canonical" href="${url}"></head><body>${body}<script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script></body></html>`
const listing = data => shell(JOBS_URL, `<script src="${new URL(data.client.url).pathname}" async></script>` + frame(`1:${JSON.stringify(['$', '$L2', null, { jobs: data.jobs, children: null }])}\n`))
const detail = data => shell(data.schema.url, `<h1>${data.own.job_title}</h1><script id="job-posting-schema" type="application/ld+json">${JSON.stringify(data.schema)}</script>` + frame(`17:${JSON.stringify(['$', '$L3', null, { job: data.own }])}\n20:T${Buffer.byteLength(data.description).toString(16)},${data.description}`))
function replay(t, data, transform = (_url, value) => value) {
  const reads = new Map()
  t.mock.method(globalThis, 'fetch', async input => {
    const url = String(input?.url || input)
    reads.set(url, (reads.get(url) || 0) + 1)
    const body = url === JOBS_URL ? listing(data) : url === data.client.url ? data.client.body
      : url === data.schema.url ? detail(data) : assert.fail('Unexpected public URL: ' + url)
    const response = new Response(transform(url, body, reads.get(url)), { status: 200 })
    Object.defineProperty(response, 'url', { value: url })
    return response
  })
  return reads
}

test('current IQVIA Flight model keeps independently typed India details and fresh closing proof', async t => {
  const data = fixture(), reads = replay(t, data)
  const jobs = await createIqviaScraper().run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, data.own.instance_id)
  assert.equal(jobs[0].requisitionId, data.own.job_req_id)
  assert.equal(jobs[0].country, 'India')
  assert.match(jobs[0].jobDescription, /Qualifications/)
  assert.match(jobs[0].jobDescription, /Bachelor/)
  assert.equal(jobs[0].applyUrl, data.own.application_url)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(jobs.nativeCollectionEvidence.nativeListingInstances, 2)
  assert.equal(jobs.nativeCollectionEvidence.completeCompanyInventory, false)
  assert.equal(reads.get(data.schema.url), 2)
  assert.equal(reads.get(JOBS_URL), 2)
  assert.equal(reads.get(data.client.url), 2)
  const assessment = assessSoftFailureAcquisition({ source: 'iqvia', zeroResultPolicy: 'evidence-required' }, jobs)
  assert.equal(assessment.runnerOutcome.success, true)
  assert.deepEqual(assessment.cleanupOptions, { replaceExisting: false })
})

test('passive security scripts do not waive a visible IQVIA access challenge', async t => {
  const data = fixture()
  replay(t, data, (url, value) => url === JOBS_URL ? value.replace('Working at IQVIA | Jobs and Careers at IQVIA', 'Just a moment...') : value)
  await assert.rejects(createIqviaScraper().run(), /access challenge/i)
})

test('IQVIA native title identity permits only the whitespace collapsed by its rendered heading', async t => {
  const data = fixture()
  data.jobs[0].job_title = data.jobs[0].job_title.replace('Medical Data', 'Medical  Data')
  data.own.job_title = data.jobs[0].job_title
  data.schema.title = data.jobs[0].job_title
  replay(t, data)
  const jobs = await createIqviaScraper().run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, data.own.job_title)
})

test('IQVIA preserves a declared Workday posting URL with its native numeric requisition suffix', async t => {
  const data = fixture()
  // Current R1575153 India instances declare a Workday posting ending R1575153-1.
  data.own.application_url += '-1'
  replay(t, data)
  const jobs = await createIqviaScraper().run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].applyUrl, data.own.application_url)
})

test('inert IQVIA Flight models cannot qualify the passive security exception', async t => {
  const data = fixture()
  replay(t, data, (url, value) => url === JOBS_URL ? `<template>${value}</template>` : value)
  await assert.rejects(createIqviaScraper().run(), /access challenge|native.*model/i)
})

for (const mutation of ['country', 'employer', 'description', 'instance']) {
  test('current IQVIA own native ' + mutation + ' must agree independently', async t => {
    const data = fixture()
    if (mutation === 'country') data.schema.jobLocation.address.addressCountry = 'United States'
    if (mutation === 'employer') data.schema.hiringOrganization.name = 'Unrelated company'
    if (mutation === 'description') data.description = 'See attachment'
    if (mutation === 'instance') data.own.instance_id = 'R1574742-99'
    replay(t, data)
    await assert.rejects(createIqviaScraper().run(), /country|employer|description|identity|instance/i)
  })
}

test('current IQVIA requires the declared route client bytes rather than guessing a changed URL template', async t => {
  const data = fixture()
  data.client.body = data.client.body.replace('href:"/jobs/".concat(a.instance_id)', 'href:"/other/".concat(a.instance_id)')
  replay(t, data)
  await assert.rejects(createIqviaScraper().run(), /route|client|program/i)
})

test('current IQVIA reconciles its own full description on the closing read', async t => {
  const data = fixture()
  const changed = structuredClone(data)
  changed.description = changed.description.replace('Qualifications', 'Altered qualifications')
  changed.schema.description = changed.schema.description.replace('Qualifications', 'Altered qualifications')
  replay(t, data, (url, value, count) => url === data.schema.url && count === 2 ? detail(changed) : value)
  await assert.rejects(createIqviaScraper().run(), /closing|changed/i)
})

test('a current native model without India instances remains partial unknown inventory', async t => {
  const data = fixture()
  data.jobs = data.jobs.filter(job => job.job_location.address.country !== 'India')
  replay(t, data)
  const jobs = await createIqviaScraper().run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(assessSoftFailureAcquisition({ source: 'iqvia', zeroResultPolicy: 'evidence-required' }, jobs).runnerOutcome.success, false)
})

test('a denied current IQVIA detail stops queued native reads and drains current readers', async t => {
  const data = fixture(), reads = []
  data.jobs = Array.from({ length: 6 }, (_, index) => ({ ...structuredClone(data.jobs[0]), instance_id: `R1574742-${index}` }))
  t.mock.method(globalThis, 'fetch', async input => {
    const url = String(input)
    if (url === JOBS_URL) return new Response(listing(data))
    if (url === data.client.url) return new Response(data.client.body)
    reads.push(url)
    if (url === data.schema.url) return new Response('Forbidden', { status: 403 })
    await new Promise(resolve => setTimeout(resolve, 30))
    return new Response('Forbidden', { status: 403 })
  })
  await assert.rejects(createIqviaScraper().run(), error => error.status === 403 && error.abortRetries === true)
  await new Promise(resolve => setTimeout(resolve, 120))
  assert.equal(reads.length, 4, 'Only requests already active at the denial may complete')
})

test('IQVIA can retain an independently closed native role while explicitly holding denied and unread instances', async t => {
  const data = fixture(), reads = new Map()
  data.jobs = Array.from({ length: 6 }, (_, index) => ({ ...structuredClone(data.jobs[0]), instance_id: `R1574742-${index}` }))
  t.mock.method(globalThis, 'fetch', async input => {
    const url = String(input)
    reads.set(url, (reads.get(url) || 0) + 1)
    if (url === JOBS_URL) return new Response(listing(data))
    if (url === data.client.url) return new Response(data.client.body)
    if (url === data.schema.url) {
      await new Promise(resolve => setTimeout(resolve, 30))
      return new Response(detail(data))
    }
    return new Response('Forbidden', { status: 403 })
  })
  const jobs = await createIqviaScraper().run()
  assert.equal(jobs.length, 1)
  assert.equal(reads.get(data.schema.url), 2)
  const evidence = jobs.nativeCollectionEvidence
  assert.equal(evidence.heldNativeIndiaInstances.length, 5)
  assert.equal(evidence.nativeDetailDenials.length, 3)
  assert.ok(evidence.nativeDetailDenials.every(item => item.status === 403))
  assert.equal(evidence.heldNativeIndiaInstances.filter(item => item.detailStatus === 'not-read').length, 2)
  assert.ok(evidence.heldNativeIndiaInstances.every(item => item.row.job_location.address.country === 'India'))
  assert.equal(evidence.completeWorksiteCountryInventory, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  const assessment = assessSoftFailureAcquisition({ source: 'iqvia', zeroResultPolicy: 'evidence-required' }, jobs)
  assert.equal(assessment.runnerOutcome.success, true)
  assert.deepEqual(assessment.cleanupOptions, { replaceExisting: false })
})

test('an IQVIA partial positive still fails when its retained own closing detail is denied', async t => {
  const data = fixture()
  data.jobs.push({ ...structuredClone(data.jobs[0]), instance_id: 'R1574742-1' })
  let ownReads = 0
  t.mock.method(globalThis, 'fetch', async input => {
    const url = String(input)
    if (url === JOBS_URL) return new Response(listing(data))
    if (url === data.client.url) return new Response(data.client.body)
    if (url === data.schema.url && ++ownReads === 1) {
      await new Promise(resolve => setTimeout(resolve, 30))
      return new Response(detail(data))
    }
    return new Response('Forbidden', { status: 403 })
  })
  await assert.rejects(createIqviaScraper().run(), error => error.status === 403)
  assert.equal(ownReads, 2)
})
