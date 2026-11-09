import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('KoinX is registered as a fail-closed custom script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'koinx')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'KoinX')
  assert.equal(provider.companyCareerPage, 'https://wellfound.com/company/koinx/jobs')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Security Check \| Wellfound/i)
  assert.match(provider.modulePath, /koinx[\\/]script\.js$/i)
})

test('KoinX resolves to a runnable scraper with the expected dry-run file', () => {
  const scraper = buildScrapers().find((item) => item.name === 'koinx')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /koinx[\\/]jobs\.json$/i)
})
