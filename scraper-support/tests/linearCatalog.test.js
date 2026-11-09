import assert from 'node:assert/strict'
import test from 'node:test'
import { buildScrapers, createCatalogScraper, getScraperCatalog } from '../providers/index.js'

const provider = getScraperCatalog().find(row => row.source === 'linear')

test('the registered Linear source preserves unknown company scope and requires live extraction evidence', async () => {
  assert.ok(provider)
  assert.equal(provider.companyName, 'Linear')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.configuredBoardProofRequiresLiveEvidence,true)
  assert.equal(provider.sourceCompanyWideScopeComplete,false)
  assert.equal(provider.lifecycleCleanupAllowed,false)
  assert.match(provider.modulePath,/linear[\\/]script\.js$/)
  const scraper = createCatalogScraper(provider)
  await assert.rejects(scraper.run({ transport: async url => ({ url, status: 200,
    headers: { 'content-type': 'text/html' }, body: Buffer.from('<h1>Careers unavailable</h1>'), bodyComplete: true }) }), /careers runtime handoff/i)
})

test('buildScrapers exposes the same cancellable Linear extraction through the runner contract', async () => {
  const scraper = buildScrapers().find(row => row.name === 'linear')
  assert.ok(scraper)
  assert.match(scraper.dryRunFile, /linear[\\/]jobs\.json$/i)
  const controller = new AbortController(); controller.abort(new Error('cancel-registered-linear'))
  await assert.rejects(scraper.run({ signal: controller.signal,
    transport: async () => assert.fail('cancelled source must not fetch') }), /cancel-registered-linear/)
})
