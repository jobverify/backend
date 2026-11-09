import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { createEsdsScraper, createPublicGetTransport, CAREERS_URL } from '../../scraper/esds/script.js'
import { getScraperCatalog, createCatalogScraper } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const careers = await fs.readFile(new URL('../../scraper/esds/fixtures/careers-20261026.html', import.meta.url), 'utf8')
const metadata = await fs.readFile(new URL('../../scraper/esds/fixtures/redirected-detail-20261026.html', import.meta.url), 'utf8')

test('registered ESDS catalog factory preserves incomplete live-attempt evidence without an India absence claim', async () => {
  const provider = getScraperCatalog().find(entry => entry.source === 'esds')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.nativeExtractionVerified, false)
  const jobs = await createCatalogScraper(provider).run({
    fetchPage: async url => ({ status: 200, url, text: url.includes('career-details') ? metadata : careers }),
  })
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('ESDS changed corporate contract has no native fallback and cannot become verified empty', async () => {
  const calls = []
  const jobs = await createEsdsScraper().run({
    fetchPage: async url => { calls.push(url); return { status: 200, url, text: careers.replace('Jobs of the day', 'Career highlights') } },
    fetchListingPage: () => assert.fail('Retired native listing fallback executed'),
  })
  assert.deepEqual(calls, [CAREERS_URL])
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).firstParty, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /unverified-corporate-listing/)
})

for (const status of [401, 403, 429]) test(`ESDS anonymous GET transport stops at HTTP ${status} across redirect hops without retry or credential changes`, async () => {
  const calls = []
  const transport = createPublicGetTransport({
    fetchImpl: async (url, options) => {
      calls.push({ url, method: options.method, redirect: options.redirect, headers: options.headers, body: options.body })
      if (calls.length === 1) return new Response(null, { status: 301, headers: { location: 'https://esds.darwinbox.in/ms/candidatev2/main/careers/allJobsa688b3b568300f/' } })
      return new Response('Access denied', { status })
    },
  })
  const page = await transport('https://www.esds.co.in/career-details/a688b3b568300f')
  assert.equal(page.status, status)
  await assert.rejects(transport('https://esds.darwinbox.in/ms/candidatev2/main/careers/home'), /stopped/)
  assert.equal(calls.length, 2)
  for (const call of calls) {
    assert.equal(call.method, 'GET')
    assert.equal(call.redirect, 'manual')
    assert.equal(call.headers, undefined)
    assert.equal(call.body, undefined)
  }
})

test('ESDS anonymous transport rejects unverified redirect hosts before any follow-up request', async () => {
  const calls = []
  const transport = createPublicGetTransport({ fetchImpl: async url => {
    calls.push(url)
    return new Response(null, { status: 302, headers: { location: 'https://unverified.example/jobs' } })
  } })
  await assert.rejects(transport(CAREERS_URL), /left the verified employer hosts/)
  assert.deepEqual(calls, [CAREERS_URL])
})
