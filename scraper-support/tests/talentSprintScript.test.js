import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createTalentSprintScraper, extractDarwinboxHandoffUrl, hasOfficialCareersHandoffSignal } from '../../scraper/talentsprint/script.js'
import { readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../utils/inventoryEvidence.js'

const fixture = name => readFileSync(new URL(`./fixtures/talentSprintNative20261026/${name}`, import.meta.url), 'utf8')
const OFFICIAL = 'https://talentsprint.com/careers/'
const HANDOFF = 'https://talentsprint.darwinbox.in/ms/candidate/careers'
const BOARD = 'https://talentsprint.darwinbox.in/ms/candidatev2/main/careers/allJobs'
const API = 'https://talentsprint.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main'
const NOW = '2026-10-26T19:40:02.054Z'
const publicPages = new Map([
  [OFFICIAL, { status: 200, html: fixture('careers.html') }],
  [HANDOFF, { status: 200, html: fixture('handoff.html') }],
  [BOARD, { status: 200, html: fixture('all-jobs.html') }],
  [API, { status: 500, html: fixture('listing-error.json') }],
])
// Prevent the old implementation, which has no fetchPage seam, from reaching the network during RED.
test.beforeEach(t => t.mock.method(globalThis, 'fetch', async url => {
  const page = publicPages.get(url)
  assert.ok(page, `unexpected public route ${url}`)
  const response = new Response(page.html, { status: page.status })
  Object.defineProperty(response, 'url', { value: url })
  return response
}))
const scraper = () => createTalentSprintScraper({ now: () => NOW, sleep: async () => {} })
const fetchPages = (requests, replacements = new Map()) => async (url, options) => {
  requests.push({ url, options })
  const page = replacements.get(url) || publicPages.get(url)
  assert.ok(page, `unexpected public route ${url}`)
  return { ...page, url: page.url || url }
}

// An unconditional [] or skipping the current native surface must fail this test.
test('TalentSprint checks current public native routes and retains unavailable inventory as a coverage gap', async () => {
  const requests = []
  const jobs = await scraper().run({ maxJobs: 1, maxPages: 1, fetchPage: fetchPages(requests) })
  assert.deepEqual(requests.map(r => r.url), [OFFICIAL, HANDOFF, BOARD, API])
  assert.deepEqual(jobs, [])
  assert.deepEqual(readInventoryEvidence(jobs), {
    status: 'coverage-gap', surface: API, firstParty: true, listingComplete: false,
    pagesFetched: 0, reportedTotal: null, indiaFacetCount: null,
    verifiedAt: NOW, reason: 'talentsprint-native-public-listing-http-500;native-tenant-unavailable;native-closing-state-unverified',
  })
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs), { now: NOW }), false)
})

test('TalentSprint uses only the current active exact employer handoff', () => {
  assert.equal(hasOfficialCareersHandoffSignal(fixture('careers.html')), true)
  assert.equal(extractDarwinboxHandoffUrl(fixture('careers.html')), HANDOFF)
  const shell = '<title>TalentSprint Careers and Job Opportunities</title><h1>Go Beyond the Ordinary</h1><p>Build a future-proof, modern-day workforce</p>'
  const link = `<a href="${HANDOFF}">View Job Openings</a>`
  for (const html of [
    shell + `<template>${link}</template>`, shell + `<noscript>${link}</noscript>`,
    shell + `<div hidden>${link}</div>`, shell + `<div style="opacity:0">${link}</div>`,
    shell + link.replace('talentsprint.darwinbox.in', 'talentsprint.darwinbox.in.attacker.example'),
    shell + link.replace('/ms/candidate/careers', '/ms/candidate/careers?company=other'),
  ]) assert.equal(hasOfficialCareersHandoffSignal(html), false)
})

test('TalentSprint stops immediately at a public access denial without fetching later native routes', async () => {
  for (const status of [401, 403, 429]) {
    const requests = []
    const jobs = await scraper().run({ fetchPage: fetchPages(requests, new Map([[HANDOFF, { status, html: 'denied' }]])) })
    assert.deepEqual(requests.map(r => r.url), [OFFICIAL, HANDOFF])
    assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
    assert.match(readInventoryEvidence(jobs).reason, new RegExp(`native-public-access-denied-${status}`))
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  }
})

test('TalentSprint cannot promote a changed or apparently empty native client into absence proof', async () => {
  for (const html of [
    '<h1>No jobs found</h1>', '<script type="application/ld+json">{"@type":"JobPosting","title":"India Engineer"}</script>',
    '<h1>TalentSprint Careers</h1><script src="/current-client.js"></script>',
  ]) {
    const requests = []
    const jobs = await scraper().run({ fetchPage: fetchPages(requests, new Map([[BOARD, { status: 200, html }], [API, { status: 200, html: '{"status":"success","data":[],"job_counts":0}' }]])) })
    const evidence = readInventoryEvidence(jobs)
    assert.equal(evidence.status, 'coverage-gap')
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.reportedTotal, null)
    assert.match(evidence.reason, /native-inventory-extraction-unresolved/)
  }
})

test('TalentSprint rejects a foreign native redirect and does not follow it with further source requests', async () => {
  const requests = []
  const jobs = await scraper().run({ fetchPage: fetchPages(requests, new Map([[HANDOFF, { status: 200, url: 'https://example.com/careers', html: fixture('handoff.html') }]])) })
  assert.deepEqual(requests.map(r => r.url), [OFFICIAL, HANDOFF])
  assert.match(readInventoryEvidence(jobs).reason, /native-route-identity-unverified/)
})

test('TalentSprint requires visible employer identity before any native inventory checks', async () => {
  const requests = []
  await assert.rejects(scraper().run({ fetchPage: fetchPages(requests, new Map([[OFFICIAL, { status: 200, html: '<h1>Unexpected</h1>' }]])) }), /verified talentsprint careers page/i)
  assert.deepEqual(requests.map(r => r.url), [OFFICIAL])
  await assert.rejects(scraper().run({ fetchText: async () => fixture('careers.html').replaceAll(HANDOFF, 'https://example.com/jobs') }), /darwinbox handoff/i)
})

test('TalentSprint defaults to paced GET requests, strict HTTP handling and no retries', async t => {
  const calls = [], delays = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, method: options.method || 'GET' })
    const page = publicPages.get(url)
    const response = new Response(page.html, { status: page.status })
    Object.defineProperty(response, 'url', { value: url })
    return response
  })
  const jobs = await createTalentSprintScraper({ now: () => NOW, sleep: async delay => delays.push(delay) }).run()
  assert.deepEqual(calls, [OFFICIAL, HANDOFF, BOARD, API].map(url => ({ url, method: 'GET' })))
  assert.ok(delays.length >= 2)
  assert.ok(delays.every(delay => delay >= 1000))
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})
