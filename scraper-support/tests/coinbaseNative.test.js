import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { decodeHTML } from 'entities'

import { createCoinbaseScraper } from '../../scraper/coinbase/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../utils/sourceObservationEvidence.js'

const API = 'https://boards-api.greenhouse.io/v1/boards/coinbase/jobs?content=true'
const capturedBody = await readFile(new URL('../../scraper/coinbase/native-captures/greenhouse-coinbase-jobs-20261101.json', import.meta.url), 'utf8')
const capture = JSON.parse(capturedBody)
const challenge = await readFile(new URL('../../scraper/coinbase/native-captures/first-party-listing-denied-20261101.html', import.meta.url), 'utf8')
const payload = () => structuredClone(capture)
const noLegacyRequests = {
  fetchText: async () => { throw new Error('legacy employer transport must not run') },
  fetchPage: async () => { throw new Error('legacy employer transport must not run') },
}
const runPayload = (data, options = {}) => createCoinbaseScraper().run({
  ...noLegacyRequests,
  fetchJson: async url => { assert.equal(url, API); return data },
  now: () => '2026-11-01T00:30:00.000Z',
  ...options,
})

test('Coinbase native capture recovers all 18 explicit India roles across the 254-row response', async () => {
  const jobs = await runPayload(payload())
  assert.equal(jobs.length, 18)
  assert.deepEqual(jobs.map(job => job.jobId).sort((a, b) => a - b), [
    7606826, 7739592, 7985187, 8054055, 8054153, 8122777, 8165441, 8167571,
    8265918, 8325213, 8333273, 8333981, 8334152, 8334157, 8334161, 8334164, 8334764, 8334767,
  ])
  const remote = jobs.find(job => job.jobId === 7739592)
  assert.equal(remote.location, 'Remote - India')
  assert.equal(remote.country, 'India')
  assert.equal(remote.city, null)
  assert.equal(remote.remoteStatus, 'Remote')
  const office = jobs.find(job => job.jobId === 8333273)
  assert.equal(office.location, 'Hyderabad, India')
  assert.equal(office.city, 'Hyderabad')
  assert.equal(office.country, 'India')
})

test('Coinbase retains complete original native content, publication, identity and actual role URLs', async () => {
  const jobs = await runPayload(payload())
  const job = jobs.find(job => job.jobId === 7739592)
  const original = capture.jobs.find(row => row.id === 7739592)
  assert.equal(job.title, 'Senior Machine Learning Engineer')
  assert.equal(job.company, 'Coinbase')
  assert.equal(job.source, 'coinbase')
  assert.equal(job.requisitionId, 'P76476')
  assert.equal(job.nativeDescriptionRaw, original.content)
  assert.equal(job.sourceDescription, decodeHTML(original.content))
  assert.equal(job.jobDescription, job.sourceDescription)
  assert.match(job.sourceDescription, /Pay Transparency Notice/)
  assert.match(job.sourceDescription, /Arbitration of Disputes/)
  assert.deepEqual(job.nativeSourceRecord, original)
  assert.equal(job.postingDate, '2026-06-10T10:56:02-04:00')
  assert.equal(job.nativePublicationEvidence.field, 'Greenhouse.first_published')
  assert.equal(job.nativeUpdatedAt, original.updated_at)
  assert.equal(job.link, 'https://www.coinbase.com/careers/positions/7739592?gh_jid=7739592')
  assert.equal(job.applyUrl, job.link)
  assert.equal(job.sourceUrl, job.link)
  assert.equal(job.scrapedAt, '2026-11-01T00:30:00.000Z')
})

test('Coinbase observes native rows without claiming company totals, verified zero or cleanup permission', async () => {
  const jobs = await runPayload(payload())
  assert.deepEqual(readSourceObservationEvidence(jobs, 'coinbase'), {
    source: 'coinbase', recordKind: 'vacancy-rows', observedRecordCount: 254, observedVacancyCount: 254,
    sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null,
  })
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /observed-native-rows:254/)
  assert.match(evidence.reason, /observed-explicit-india-rows:18/)
  for (const job of jobs) {
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
  const empty = await runPayload({ jobs: [], meta: { total: 0 } })
  assert.equal(empty.length, 0)
  assert.equal(readInventoryEvidence(empty).status, 'discovery-only')
  assert.equal(readInventoryEvidence(empty).listingComplete, false)
  assert.equal(readInventoryEvidence(empty).indiaFacetCount, null)
})

test('Coinbase never promotes bare city names, broad remote regions or role titles to India', async () => {
  const row = capture.jobs.find(record => record.id === 7739592)
  for (const location of ['Bangalore', 'Hyderabad', 'Remote', 'Remote - APAC', 'London, UK', 'India, USA', 'London, UK / Bangalore, India']) {
    const jobs = await runPayload({ jobs: [{ ...row, title: 'Engineer, India', location: { name: location } }], meta: { total: 1 } })
    assert.equal(jobs.length, 0, location)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  }
})

test('Coinbase never substitutes edits or observation time for an absent original publication', async () => {
  const row = structuredClone(capture.jobs.find(record => record.id === 7739592))
  delete row.first_published
  const [job] = await runPayload({ jobs: [row], meta: { total: 1 } })
  assert.equal(job.postingDate, null)
  assert.equal(job.nativePublicationEvidence.status, 'unknown')
  assert.equal(job.nativeUpdatedAt, row.updated_at)
})

test('Coinbase leaves contradictory country lists unresolved per role while preserving explicit India positives', async () => {
  const positive = capture.jobs.find(record => record.id === 8333273)
  const candidate = capture.jobs.find(record => record.id === 7739592)
  for (const location of [
    'London, UK, India', 'Remote - USA, India', 'London, United Kingdom, India',
    'Remote - US, India', 'Remote - United States, India', 'Remote - United States of America, India',
    'London, GB, India', 'Paris, France, India', 'Paris, FR, India', 'Remote - Canada, India',
  ]) {
    const jobs = await runPayload({ jobs: [positive, { ...candidate, location: { name: location } }], meta: { total: 2 } })
    assert.deepEqual(jobs.map(job => job.jobId), [8333273], location)
    assert.deepEqual(jobs[0].nativeSourceRecord, positive)
    assert.equal(jobs[0].city, 'Hyderabad')
    assert.equal(jobs[0].country, 'India')
    assert.equal(readSourceObservationEvidence(jobs, 'coinbase').observedRecordCount, 2)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  }
  for (const [location, city] of [
    ['Hyderabad, India', 'Hyderabad'], ['Hyderabad, Telangana, India', 'Hyderabad'],
    ['Bengaluru, Karnataka, India', 'Bangalore'], ['Remote - India', null],
  ]) {
    const jobs = await runPayload({ jobs: [positive, { ...candidate, location: { name: location } }], meta: { total: 2 } })
    assert.deepEqual(jobs.map(job => job.jobId), [8333273, 7739592], location)
    assert.equal(jobs[1].country, 'India')
    assert.equal(jobs[1].city, city)
    assert.deepEqual(jobs[0].nativeSourceRecord, positive)
  }
})

test('Coinbase rejects truncated or errored native envelopes before publishing any role', async () => {
  for (const data of [
    { ...payload(), jobs: capture.jobs.slice(0, 253) },
    { ...payload(), hasMore: true },
    { ...payload(), next: '/page/2' },
    { ...payload(), errors: ['unavailable'] },
    { jobs: [], error: 'unavailable', meta: { total: 0 } },
  ]) await assert.rejects(runPayload(data), /native inventory/i)
})

test('Coinbase rejects foreign employers, duplicate IDs and mismatched public role URLs', async () => {
  const row = capture.jobs.find(record => record.id === 7739592)
  for (const bad of [
    { ...row, company_name: 'Another Company' },
    { ...row, absolute_url: 'https://www.coinbase.com.evil.test/careers/positions/7739592?gh_jid=7739592' },
    { ...row, absolute_url: 'https://www.coinbase.com/careers/positions/7739592?gh_jid=1' },
    { ...row, absolute_url: 'https://www.coinbase.com/careers/positions/1?gh_jid=7739592' },
  ]) await assert.rejects(runPayload({ jobs: [bad], meta: { total: 1 } }), /native (?:role|employer|identity)/i)
  await assert.rejects(runPayload({ jobs: [row, row], meta: { total: 2 } }), /duplicate native/i)
})

test('Coinbase rejects an empty or inert native description instead of treating it as a complete role', async () => {
  const row = capture.jobs.find(record => record.id === 7739592)
  for (const content of ['', '&lt;script&gt;fake description&lt;/script&gt;', '&lt;template&gt;fake description&lt;/template&gt;']) {
    await assert.rejects(runPayload({ jobs: [{ ...row, content }], meta: { total: 1 } }), /native description/i)
  }
})

test('Coinbase bounds the actual 2.79 MB native response without truncating it', async () => {
  assert.ok(Buffer.byteLength(capturedBody) > 2 * 1024 * 1024)
  const jobs = await createCoinbaseScraper().run({ ...noLegacyRequests,
    fetchImpl: async (url, options) => {
      assert.equal(url, API)
      assert.equal(options.method, 'GET')
      assert.equal(options.redirect, 'manual')
      return new Response(capturedBody, { status: 200, headers: { 'Content-Type': 'application/json' } })
    },
  })
  assert.equal(jobs.length, 18)
  await assert.rejects(createCoinbaseScraper().run({ ...noLegacyRequests,
    fetchImpl: async () => new Response(' '.repeat(8 * 1024 * 1024 + 1), { status: 200 }),
  }), /response exceeds/i)
})

test('Coinbase stops after native denial and never retries through employer, browser or another client', async () => {
  let calls = 0
  await assert.rejects(createCoinbaseScraper().run({ ...noLegacyRequests,
    fetchImpl: async () => { calls++; return new Response(challenge, { status: 403, headers: {
      server: 'cloudflare', 'cf-ray': 'captured-test-ray', 'cf-mitigated': 'challenge',
    } }) },
    fetchBrowserText: async () => assert.fail('must not retry denial with a browser'),
  }), error => {
    assert.equal(error.status, 403)
    assert.equal(error.denialMetadata.headers['cf-mitigated'], 'challenge')
    assert.equal(error.denialMetadata.headers['cf-ray'], 'captured-test-ray')
    assert.match(error.denialMetadata.bodySHA256, /^[a-f0-9]{64}$/)
    return /access denied/i.test(error.message)
  })
  assert.equal(calls, 1)
})

test('Coinbase preserves cancellation and retains full native observations when output is limited', async () => {
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(createCoinbaseScraper().run({ ...noLegacyRequests, signal: controller.signal,
    fetchJson: async () => assert.fail('already aborted source must not request'),
  }), { name: 'AbortError' })
  const limited = await runPayload(payload(), { maxJobs: 1 })
  assert.equal(limited.length, 1)
  assert.equal(readSourceObservationEvidence(limited, 'coinbase').observedRecordCount, 254)
  assert.equal(readInventoryEvidence(limited).listingComplete, false)
})
