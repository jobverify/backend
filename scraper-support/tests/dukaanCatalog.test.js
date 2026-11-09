import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Dukaan is registered as a fail-closed custom script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'dukaan')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Dukaan')
  assert.equal(provider.companyCareerPage, 'https://wellfound.com/company/dukaan-app/jobs')
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.match(provider.verifiedSurfaceSummary, /HTTP 403/i)
  assert.match(provider.modulePath, /dukaan[\\/]script\.js$/i)
})

test('Dukaan resolves to a runnable scraper with the expected dry-run file', () => {
  const scraper = buildScrapers().find((item) => item.name === 'dukaan')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /dukaan[\\/]jobs\.json$/i)
})
