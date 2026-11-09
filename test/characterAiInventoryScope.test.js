import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'
import { readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const provider = getScraperCatalog().find(row => row.source === 'characterai')
const record = { id: 'native-role', title: 'Research Engineer', isListed: true,
  location: 'Redwood City or New York City', address: { postalAddress: { addressCountry: 'United States' } },
  secondaryLocations: [], jobUrl: 'https://jobs.ashbyhq.com/character/native-role',
  applyUrl: 'https://jobs.ashbyhq.com/character/native-role/application', descriptionPlain: 'Build and evaluate production research systems.' }
const run = (overrides = {}) => createCatalogScraper(provider).run({
  fetchPage: async () => ({ status: 200, url: provider.companyCareerPage,
    html: '<a href="https://jobs.ashbyhq.com/character/">View Open Roles</a>' }),
  fetchJson: async () => ({ apiVersion: '1', jobs: [record] }), ...overrides,
})

test('Character.AI verifies its current employer handoff and multi-city US inventory', async () => {
  assert.equal(provider.runtimeInventoryVerification?.mode, 'board-handoff')
  const jobs = await run(), evidence = readInventoryEvidence(jobs)
  assert.equal(jobs.length, 0)
  assert.equal(evidence.reportedTotal, 1)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(isFreshCompleteInventoryEvidence(evidence), true)
})

test('Character.AI cannot use historical source metadata when the current handoff disappears', async () => {
  await assert.rejects(run({ fetchPage: async () => ({ status: 200, url: provider.companyCareerPage,
    html: '<h1>Careers</h1>' }), fetchJson: async () => assert.fail('native API must wait for current binding') }), /handoff/)
})

test('Character.AI retains unknown remote scope even alongside a published US country', async () => {
  const jobs = await run({ fetchJson: async () => ({ apiVersion: '1', jobs: [{ ...record, location: 'New York City or Worldwide' }] }) })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})
