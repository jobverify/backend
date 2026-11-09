import assert from 'node:assert/strict'
import test from 'node:test'
import { createRainInstantPayScraper, CAREERS_PAGE_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const board = 'https://jobs.ashbyhq.com/rain-technologies'
const page = (links = `<a href="${board}">See open roles</a>`) =>
  `<title>Rain - Careers</title><h1>Our mission</h1><h2>Welcome to Rain</h2>See open roles${links}`
const role = (id = 'us-role') => ({ id, title: 'Backend Engineer', isListed: true, location: 'United States',
  address: { postalAddress: { addressCountry: 'United States' } }, secondaryLocations: [],
  jobUrl: `${board}/${id}`, applyUrl: `${board}/${id}/application`,
  descriptionPlain: 'A short introduction.',
  descriptionHtml: '<p>Build production services and maintain customer integrations.</p><h2>Requirements</h2><p>Five years of experience with distributed systems is required.</p>',
})
const execute = async ({ records = [role()], html = page(), maxJobs = null, payload } = {}) => {
  const original = { apiVersion: '1', jobs: records }, requests = []
  const jobs = await createRainInstantPayScraper({ maxJobs }).run({
    fetchPage: async url => { requests.push(url); return { status: 200, url, html } },
    fetchJson: async url => { requests.push(url); return payload || original },
  })
  assert.deepEqual(original, { apiVersion: '1', jobs: records })
  return { jobs, evidence: readInventoryEvidence(jobs), requests }
}

test('Rain preserves its global extraction while attaching a complete verified zero-India inventory', async () => {
  const { jobs, evidence, requests } = await execute()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'United States')
  assert.equal(jobs[0].sourceListingComplete, true)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.match(jobs[0].jobDescription, /Five years of experience/)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 1)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.deepEqual(requests, [CAREERS_PAGE_URL, 'https://api.ashbyhq.com/posting-api/job-board/rain-technologies'])
})

test('an explicit native secondary India address survives the global mapper and publication filter', async () => {
  const india = { ...role(), secondaryLocations: [{ location: 'Bengaluru, India',
    address: { postalAddress: { addressCountry: 'India', addressLocality: 'Bengaluru' } } }] }
  const { jobs, evidence } = await execute({ records: [india] })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(evidence.indiaFacetCount, 1)
  assert.equal(evidence.listingComplete, true)
})

test('unknown native geography stays partial even when all currently mapped roles are foreign', async () => {
  const unknown = { ...role('unknown-role'), location: 'Remote', address: null }
  const { jobs, evidence } = await execute({ records: [role(), unknown] })
  assert.equal(jobs.length, 2)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.ok(jobs.every(job => job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
})

test('native inventory failures and truncation cannot become a verified empty India slice', async () => {
  for (const payload of [{ error: 'upstream unavailable', apiVersion: '1', jobs: [] },
    { apiVersion: '1', jobs: [role()], hasMore: true }]) {
    await assert.rejects(execute({ payload }), /inventory/)
  }
  const { jobs, evidence } = await execute({ records: [role(), role('second-role')], maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, 2)
  assert.equal(evidence.indiaFacetCount, null)
})

test('a hidden or detached board link cannot establish the current employer handoff', async () => {
  for (const link of [`<template><a href="${board}">See open roles</a></template>`,
    `<script>const oldBoard = "${board}"</script>`, `<a hidden href="${board}">See open roles</a>`]) {
    await assert.rejects(execute({ html: page(link) }), /handoff not established/)
  }
})

test('an additional active employer board preserves unknown overall source scope', async () => {
  const { evidence } = await execute({ html: page(`<a href="${board}">See open roles</a><a href="https://jobs.ashbyhq.com/other-board">Other roles</a>`) })
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
})

test('Rain propagates caller cancellation at the first-party response boundary', async () => {
  const controller = new AbortController(), reason = new Error('stop Rain source')
  await assert.rejects(createRainInstantPayScraper().run({ signal: controller.signal,
    fetchPage: async url => { controller.abort(reason); return { status: 200, url, html: page() } },
    fetchJson: async () => assert.fail('cancellation must stop the native request'),
  }), error => error === reason)
})
