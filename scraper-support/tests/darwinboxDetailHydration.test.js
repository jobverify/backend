import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createDarwinboxScraper } from '../../scraper/darwinbox/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const listing = (id, jd = '') => ({ id, title: 'Accounting Associate', locations: 'Chennai, Tamil Nadu, India', country: 'India', jd })
const detail = (id, jd = '<p>Process and reconcile employer accounting records.</p>', overrides = {}) => ({ status: 'success', message: { job: [{ id, title: 'Accounting Associate', officelocation_show_arr: 'Chennai, Tamil Nadu, India', jd, ...overrides }] } })
const run = (records, fetchJobDetail, options = {}) => createDarwinboxScraper({ source: 'mindsprint', origin: 'https://mindsprint.darwinbox.in', companyId: 'a671608963ef6d' }).run({
  fetchListingPage: async () => ({ status: 'success', data: records, job_counts: records.length }), fetchJobDetail, ...options,
})

test('Darwinbox hydrates only missing/markup-only India descriptions from native role details', async () => {
  const calls = []
  const jobs = await run([listing('blank'), listing('markup', '<p>&nbsp;</p>'), listing('complete', '<p>Existing employer description.</p>'), { ...listing('foreign'), country: 'United States', locations: 'Boston, United States' }], async (request) => {
    calls.push(request)
    return detail(request.jobId)
  })
  assert.deepEqual(calls.map(x => x.jobId), ['blank', 'markup'])
  assert.equal(calls[0].companyId, 'a671608963ef6d')
  assert.equal(jobs.length, 3)
  assert.ok(jobs.every(hasSourceDescription))
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 4)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('Darwinbox distinguishes confirmed native empty content from upstream detail failure', async () => {
  const jobs = await run([listing('empty'), listing('blocked')], async ({ jobId }) => {
    if (jobId === 'blocked') throw Object.assign(new Error('HTTP 403'), { status: 403 })
    return detail(jobId, '<p><br></p>')
  })
  assert.deepEqual(jobs.map(j => j.sourceDetailFailureKind), ['missing-content', 'upstream'])
  assert.ok(jobs.every(j => j.sourceDetailComplete === false && !hasSourceDescription(j)))
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

for (const [label, payload] of [
  ['wrong ID', detail('another-role')],
  ['missing ID', detail('')],
  ['wrong title', detail('expected', 'Description', { title: 'Unrelated role' })],
  ['foreign country', detail('expected', 'Description', { country: 'United States' })],
  ['malformed native country', detail('expected', 'Description', { country: ['India'] })],
  ['foreign native location', detail('expected', 'Description', { officelocation_show_arr: 'Boston, United States' })],
  ['unknown native location', detail('expected', 'Description', { officelocation_show_arr: '' })],
  ['foreign additional native location', detail('expected', 'Description', { officelocation_show_arr_list: ['Chennai, India', 'Boston, United States'] })],
  ['unknown additional native location', detail('expected', 'Description', { officelocation_show_arr_list: ['Chennai, India', 'Unspecified office'] })],
  ['missing message', { status: 'success', data: [] }],
  ['multiple details', { status: 'success', message: { job: [detail('expected').message.job[0], detail('expected').message.job[0]] } }],
  ['invalid content type', detail('expected', { html: 'unexpected' })],
]) test('Darwinbox rejects ' + label + ' detail before retaining hydrated content', async () => {
  await assert.rejects(run([listing('expected')], async () => payload), e => e.name === 'DarwinboxDetailContractError' && e.abortRetries === true)
})

test('current first-party Mindsprint role is explicitly real empty, preserving the India listing', async () => {
  const payload = JSON.parse(readFileSync(new URL('./fixtures/darwinbox/mindsprint-empty-native-detail.json', import.meta.url), 'utf8'))
  const native = payload.message.job[0]
  const jobs = await run([{ ...listing(native.id), title: native.title, locations: native.locations }], async () => payload)
  assert.equal(native.jd, '')
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'missing-content')
  assert.equal(hasSourceDescription(jobs[0]), false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('current first-party BigBasket grouped location requires complete native India address labels', async () => {
  const payload = JSON.parse(readFileSync(new URL('./fixtures/darwinbox/bigbasket-grouped-empty-native-detail.json', import.meta.url), 'utf8'))
  const native = payload.message.job[0]
  const record = { ...listing(native.id), title: native.title, locations: native.locations }
  const jobs = await run([record], async () => payload)
  assert.equal(jobs[0].sourceDetailFailureKind, 'missing-content')
  assert.equal(jobs[0].location, 'Multiple Locations')
  assert.equal(hasSourceDescription(jobs[0]), false)
  for (const tool_tip_locations of [undefined, [], ['Hyderabad, India', 'Boston, United States'], ['Unknown office']]) {
    const changed = structuredClone(payload)
    changed.message.job[0].tool_tip_locations = tool_tip_locations
    await assert.rejects(run([record], async () => changed), e => e.name === 'DarwinboxDetailContractError')
  }
})

test('Darwinbox grouped native India addresses permit hydration without invented text or geography', async () => {
  const payload = detail('grouped', '<p>Employer supplied grouped role responsibilities.</p>', {
    officelocation_show_arr: 'Multiple locations', officelocation_show_arr_list: ['Multiple locations'],
    tool_tip_locations: ['Chennai, India', 'Mumbai, India'], officelocation_arr: ['office-one', 'office-two'],
  })
  const jobs = await run([listing('grouped')], async () => payload)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].jobDescription, payload.message.job[0].jd)
  assert.equal(jobs[0].location, 'Chennai, Tamil Nadu, India')
})

test('Darwinbox total detail request budget includes session seeding', async () => {
  const originalNow = Date.now
  let now = 1000, detailsRequested = false
  Date.now = () => now
  try {
    const scraper = createDarwinboxScraper({ fetchImpl: async (url) => {
      if (url.includes('/careers/allJobs')) {
        now += 101
        return new Response('<html>Public careers</html>')
      }
      detailsRequested = true
      return Response.json(detail('expected'))
    } })
    await assert.rejects(scraper.fetchJobDetailFromApi({ jobId: 'expected', timeoutMs: 100 }), /budget/i)
    assert.equal(detailsRequested, false)
  } finally { Date.now = originalNow }
})

test('Darwinbox preserves a caller abort during native detail hydration', async () => {
  const controller = new AbortController(), reason = new Error('cancel details')
  await assert.rejects(run([listing('first'), listing('second')], async ({ signal }) => {
    assert.equal(signal, controller.signal)
    controller.abort(reason)
    return detail('first')
  }, { signal: controller.signal }), e => e === reason)
})

test('Darwinbox explicit zero detail budget makes no request and preserves incomplete detail health', async () => {
  let calls = 0
  const jobs = await run([listing('deferred')], async () => { calls++; return detail('deferred') }, { detailEnrichmentBudgetMs: 0 })
  assert.equal(calls, 0)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'budget-exhausted')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('Darwinbox keeps an explicit upstream HTTP failure when it arrives at the detail deadline', async () => {
  const originalNow = Date.now
  let now = 1000
  Date.now = () => now
  try {
    const jobs = await run([listing('blocked')], async () => {
      now += 10
      throw Object.assign(new Error('HTTP 403'), { status: 403 })
    }, { detailEnrichmentBudgetMs: 10 })
    assert.equal(jobs[0].sourceDetailFailureKind, 'upstream')
  } finally { Date.now = originalNow }
})

test('Darwinbox invalid infinite detail budget retains the bounded default', async () => {
  const originalNow = Date.now
  let now = 1000, calls = 0
  Date.now = () => now
  try {
    const jobs = await run([listing('first'), listing('deferred')], async ({ jobId }) => {
      calls++
      now += 30001
      return detail(jobId)
    }, { detailEnrichmentBudgetMs: Infinity })
    assert.equal(calls, 1)
    assert.equal(jobs[1].sourceDetailFailureKind, 'budget-exhausted')
  } finally { Date.now = originalNow }
})

test('Darwinbox actual detail transport uses the public native ID/company query and seeded cookie', async () => {
  const calls = []
  const scraper = createDarwinboxScraper({ source: 'mindsprint', origin: 'https://mindsprint.darwinbox.in', companyId: 'a671608963ef6d', fetchImpl: async (url, init = {}) => {
    calls.push({ url, init })
    if (url.includes('/careers/allJobs')) return new Response('<html>Public careers</html>', { headers: { 'set-cookie': '__cf_bm=current; Path=/' } })
    if (init.method === 'POST') return Response.json({ status: 'success', data: [listing('native-id')], job_counts: 1 })
    return Response.json(detail('native-id'))
  } })
  const jobs = await scraper.run()
  const request = calls.find(x => x.url.includes('/candidateapi/job/native-id?'))
  assert.ok(request)
  assert.equal(request.url, 'https://mindsprint.darwinbox.in/ms/candidateapi/job/native-id?companyId=a671608963ef6d')
  assert.equal(request.init.method, 'GET')
  assert.equal(request.init.headers.cookie, '__cf_bm=current')
  assert.ok(hasSourceDescription(jobs[0]))
})

test('Darwinbox accepts native title dash typography while preserving role words and ID', async () => {
  const payload = JSON.parse(readFileSync(new URL('./fixtures/darwinbox/seclore-ai-labs-native-detail.json', import.meta.url), 'utf8'))
  const scraper = createDarwinboxScraper({ source: 'seclore', origin: 'https://seclore.darwinbox.in' })
  const job = { jobId: 'a6a70a470f077f', title: 'Software Engineer \u2013 AI Labs' }
  const description = scraper.validateJobDetail(payload, job)
  assert.match(description, /Data Security Posture Management/)
  for (const title of ['Software Engineer \u2014 AI Labs', 'Software Engineer-AI Labs']) {
    assert.equal(scraper.validateJobDetail(payload, { ...job, title }), description)
  }
  for (const changed of [{ ...job, title: 'Software Engineer \u2013 IT Labs' }, { ...job, jobId: 'another-role' }]) {
    assert.throws(() => scraper.validateJobDetail(payload, changed), error => error.name === 'DarwinboxDetailContractError')
  }
  const untitled = structuredClone(payload)
  untitled.message.job[0].title = ''
  assert.throws(() => scraper.validateJobDetail(untitled, { ...job, title: '' }), error => error.name === 'DarwinboxDetailContractError')
})

test('Darwinbox keeps verified native publication epochs independently of old or empty descriptions', async () => {
  for (const [fixture, expectedDate, hasBody] of [
    ['seclore-ai-labs-native-detail.json', '2026-08-02T18:30:00.000Z', true],
    ['scripbox-empty-native-detail.json', '2026-09-10T18:30:00.000Z', false],
  ]) {
    const payload = JSON.parse(readFileSync(new URL('./fixtures/darwinbox/' + fixture, import.meta.url), 'utf8'))
    const record = payload.message.job[0]
    const scraper = createDarwinboxScraper({ source: 'native-date-fixture' })
    const jobs = await scraper.run({
      fetchListingPage: async () => ({ status: 'success', data: [{ id: record.id, title: record.title, locations: record.officelocation_show_arr, country: 'India', jd: '' }], job_counts: 1 }),
      fetchJobDetail: async () => payload,
    })
    assert.equal(jobs[0].sourcePostingDate, expectedDate)
    assert.equal(jobs[0].postingDate, expectedDate)
    assert.equal(jobs[0].sourceDateEvidence, 'darwinbox-native-posted-on-v1')
    assert.equal(jobs[0].sourceDetailComplete, hasBody)
    assert.equal(hasSourceDescription(jobs[0]), hasBody)
    const mismatched = structuredClone(payload)
    mismatched.message.job[0].job_posting.careers.from += 86400
    assert.throws(() => scraper.extractJobDetailFacts(mismatched, { jobId: record.id, title: record.title }), error => error.name === 'DarwinboxDetailContractError')
    const createdOnly = structuredClone(payload)
    delete createdOnly.message.job[0].posted_on
    delete createdOnly.message.job[0].job_posting.careers.from
    assert.deepEqual(scraper.extractJobDetailFacts(createdOnly, { jobId: record.id, title: record.title }), {})
  }
})
