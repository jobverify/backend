import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createRblBankScraper, extractSearchResults, extractPeopleStrongHandoffUrl, hasOfficialCareersPageSignal,
  hasPublicPortalShell, CAREERS_PAGE_URL, JOB_LISTINGS_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-public-20261031.json.gz', import.meta.url))))
const nativeEmpty = JSON.parse(capture.packets[2].body)
const pages = new Map(capture.packets.slice(0, 2).map(page => [page.url, { status: page.status, url: page.finalUrl, html: page.body }]))
const run = (payload = nativeEmpty, options = {}) => createRblBankScraper().run({
  fetchPage: async url => structuredClone(pages.get(url)), fetchJson: async () => structuredClone(payload),
  now: () => capture.packets[2].capturedAt, ...options,
})

test('RBL current explicit zero is retained as a checked portal observation without whole-company empty proof', async () => {
  assert.equal(nativeEmpty.totalRecords, 0)
  assert.equal(nativeEmpty.response, null)
  assert.equal(nativeEmpty.messageCode.code, 200)
  const jobs = await run()
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.reportedTotal, 0)
  assert.equal(evidence?.indiaFacetCount, null)
  assert.equal(evidence?.listingComplete, false)
})

for (const [label, payload] of [
  ['error envelope', { ...nativeEmpty, messageCode: { code: 500, messages: 'Failure' } }],
  ['missing native response', { totalRecords: 0, messageCode: nativeEmpty.messageCode }],
  ['missing reported count', { response: [], messageCode: nativeEmpty.messageCode }],
  ['malformed reported count', { ...nativeEmpty, totalRecords: '0oops' }],
  ['null records contradicting a positive count', { ...nativeEmpty, totalRecords: 4 }],
  ['empty records contradicting a positive count', { ...nativeEmpty, response: [], totalRecords: 4 }],
  ['malformed record array', { ...nativeEmpty, response: [null], totalRecords: 1 }],
]) test(`RBL ${label} cannot become a successful zero`, async () => {
  await assert.rejects(run(payload), error => error.softFailure === true
    && error.failureKind === 'upstream_inventory_unavailable' && error.abortRetries === true)
})

test('RBL cancellation is checked before native reads and forwarded during reads', async () => {
  const reason = Error('caller cancelled RBL')
  await assert.rejects(run(nativeEmpty, { signal: AbortSignal.abort(reason),
    fetchPage: async () => assert.fail('cancelled source must not fetch') }), error => error === reason)
  const controller = new AbortController()
  await assert.rejects(run(nativeEmpty, { signal: controller.signal, fetchPage: async (url, options = {}) => {
    assert.equal(options.signal, controller.signal)
    controller.abort(reason)
    throw reason
  } }), error => error === reason)
})

test('commented, hidden or foreign redirect text cannot establish the RBL native handoff', () => {
  const link = '<a href="https://rblcareers.peoplestrong.com/">Job Opportunities</a>'
  assert.equal(extractPeopleStrongHandoffUrl(link), 'https://rblcareers.peoplestrong.com/')
  for (const html of [`<!--${link}-->`, `<div hidden>${link}</div>`, `<script>${JSON.stringify(link)}</script>`,
    '<a href="https://unrelated.invalid/?next=https://rblcareers.peoplestrong.com/">Job Opportunities</a>']) {
    assert.equal(extractPeopleStrongHandoffUrl(html), null)
  }
})

// Controlled mutations of the existing legacy RBL row shape test geography;
// these are not observations of additional current public vacancies.
const legacyRow = { jobTitle: 'Branch Manager', jobCode: 'RBL/BM/1477475', requisitionId: 1477475,
  jobDetailUrl: 'https://rblcareers.peoplestrong.com/job/detail/RBL_BM_1477475',
  locationHierarchy: 'Bangalore', locationHierarchyComplete: 'India>Karnataka>Bangalore>Office' }
test('RBL foreign country ancestry is preserved instead of appending an India country', () => {
  const jobs = extractSearchResults({ response: [{ ...legacyRow, locationHierarchy: 'Dallas',
    locationHierarchyComplete: 'United States>Texas>Dallas>Office' }] })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'United States')
  assert.equal(jobs[0].location, 'Dallas, Texas, United States')
})
test('RBL contradictory explicit and hierarchy countries cannot be mapped as a valid role', () => {
  assert.throws(() => extractSearchResults({ response: [{ ...legacyRow, country: 'United States' }] }), /country.*conflict|conflict.*country/i)
})

for (const address of [CAREERS_PAGE_URL, JOB_LISTINGS_URL]) test(`RBL foreign final URL cannot inherit first-party evidence from copied markup (${address})`, async () => {
  await assert.rejects(run(nativeEmpty, { fetchPage: async url => ({ ...structuredClone(pages.get(url)),
    ...(url === address ? { url: 'https://unrelated.invalid/copied-careers' } : {}) }) }),
  error => error.softFailure === true && error.abortRetries === true)
})

test('commented RBL page title is not active employer identity', () => {
  const native = pages.get(CAREERS_PAGE_URL).html
  const changed = native.replace('<title>Careers | RBL Bank</title>', '<!--<title>Careers | RBL Bank</title>--><title>Other page</title>')
  assert.notEqual(changed, native)
  assert.equal(hasOfficialCareersPageSignal(changed), false)
})

test('inert portal root and commented native entry point cannot establish an active RBL portal shell', () => {
  const title = '<head><title>Candidate Portal</title></head>'
  const root = '<app-root data-testid="src-index-app-root-page-1"></app-root>'
  const script = '<script src="main-ABCD1234.js" type="module"></script>'
  for (const content of [`<template>${root}</template>${script}`, `${root}<!--${script}-->`]) {
    assert.equal(hasPublicPortalShell(`<html>${title}<body class="candidate-portal">${content}</body></html>`), false)
  }
})

for (const type of ['application/json', 'application/ld+json', 'text/plain']) {
  const body = `<html><head><title>Candidate Portal</title></head><body class="candidate-portal">
    <app-root data-testid="src-index-app-root-page-1"></app-root><script src="main-ABCD1234.js" type="${type}"></script></body></html>`
  test(`RBL ${type} script data cannot establish the native executable entry point`, () => {
    assert.equal(hasPublicPortalShell(body), false)
  })
  test(`RBL ${type} script data cannot proceed to a successful zero API observation`, async () => {
    let apiReads = 0
    await assert.rejects(run(nativeEmpty, {
      fetchPage: async url => url === JOB_LISTINGS_URL ? { status: 200, url, html: body } : structuredClone(pages.get(url)),
      fetchJson: async () => { apiReads += 1;return nativeEmpty },
    }), error => error.softFailure === true && error.failureKind === 'upstream_inventory_unavailable')
    assert.equal(apiReads, 0)
  })
}
