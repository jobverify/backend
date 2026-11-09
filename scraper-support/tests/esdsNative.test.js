import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { createEsdsScraper, extractJobCards, CAREERS_URL } from '../../scraper/esds/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const careers = await fs.readFile(new URL('../../scraper/esds/fixtures/careers-20261026.html', import.meta.url), 'utf8')
const metadata = await fs.readFile(new URL('../../scraper/esds/fixtures/redirected-detail-20261026.html', import.meta.url), 'utf8')
const detailUrl = 'https://www.esds.co.in/career-details/a688b3b568300f'
const malformedUrl = 'https://esds.darwinbox.in/ms/candidatev2/main/careers/allJobsa688b3b568300f/'
const canonicalUrl = 'https://www.esds.co.in/esds-peoples/careers'
const cachedListing = async () => ({ job_counts: 1, data: [{ id: 'a688b3b568300f', title: 'Data Center Project Manager', locations: 'Kolkata, Delhi, India', country: 'India', jd: 'Cached native listing content cannot prove current role ownership or geography.' }] })
const runSurface = async ({ root = careers, detailStatus = 200, detailBody = metadata, rootClosing = root, maxJobs = null, maxPages = 10 } = {}) => {
  const calls = []
  let rootReads = 0, evidence
  const fetchPage = async url => {
    calls.push(url)
    if (url === CAREERS_URL) return { status: 200, url, text: rootReads++ ? rootClosing : root }
    if (url === canonicalUrl) return { status: 200, url: `${url}/`, text: root }
    if (url === detailUrl) return { status: detailStatus, url: malformedUrl, text: detailBody }
    throw new Error(`Unexpected request ${url}`)
  }
  const jobs = await createEsdsScraper({ maxJobs, now: () => '2026-10-26T19:45:00.000Z' }).run({
    maxPages, fetchPage, fetchText: async url => (await fetchPage(url)).text,
    fetchListingPage: cachedListing,
    onSourceEvidence: value => { evidence = value },
  })
  return { jobs, calls, evidence }
}

test('ESDS advertised card does not turn an opaque job ID or an unlabeled card date into publication metadata', () => {
  const [card] = extractJobCards(careers)
  assert.equal(card.jobId, 'a688b3b568300f')
  assert.equal(card.title, 'Data Center Project Manager')
  assert.equal(card.location, 'Kolkata, Delhi')
  assert.equal(card.requisitionId, null)
  assert.equal(card.postingDate, null)
  assert.equal(card.country, null)
})

test('ESDS metadata-only redirected detail cannot publish the corporate candidate using a stale native listing', async () => {
  const { jobs, calls, evidence } = await runSurface()
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.deepEqual(calls, [CAREERS_URL, canonicalUrl, detailUrl, CAREERS_URL, canonicalUrl])
  assert.equal(evidence.advertisedCandidates.length, 1)
  assert.equal(evidence.advertisedCandidates[0].country, null)
  assert.equal(evidence.details[0].outcome, 'metadata-only-public-detail')
  assert.equal(evidence.codeRepaired, false)
})

test('ESDS rejects hidden and inert card identities before discovery', () => {
  for (const markup of [
    `<div hidden>${careers}</div>`, `<div inert>${careers}</div>`,
    `<template>${careers}</template>`, `<div style="opacity:0">${careers}</div>`,
    `<style>.concealed { display:none }</style><div class="concealed">${careers}</div>`,
  ]) assert.deepEqual(extractJobCards(markup), [])
})

test('ESDS stops at the first denied detail and does not close or revisit a denied host', async () => {
  const { jobs, calls, evidence } = await runSurface({ detailStatus: 403 })
  assert.equal(jobs.length, 0)
  assert.deepEqual(calls, [CAREERS_URL, canonicalUrl, detailUrl])
  assert.equal(evidence.details[0].outcome, 'access-denied')
  assert.match(readInventoryEvidence(jobs).reason, /access-denied/)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('ESDS changed closing corporate candidates remain partial', async () => {
  const { jobs, evidence } = await runSurface({ rootClosing: careers.replaceAll('a688b3b568300f', 'a688b3b568300e') })
  assert.equal(jobs.length, 0)
  assert.ok(evidence.issues.includes('closing-corporate-inventory-changed'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('ESDS output cap does not skip current advertised detail verification', async () => {
  const { calls, jobs } = await runSurface({ maxJobs: 0 })
  assert.equal(jobs.length, 0)
  assert.ok(calls.includes(detailUrl))
})

test('ESDS unexpected detail content remains an unverified contract instead of publishing a guessed parser result', async () => {
  const { jobs, evidence } = await runSurface({ detailBody: '<h1>Data Center Project Manager</h1><p>India</p><p>Apply now</p>' })
  assert.equal(jobs.length, 0)
  assert.equal(evidence.details[0].outcome, 'unverified-public-detail-contract')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
