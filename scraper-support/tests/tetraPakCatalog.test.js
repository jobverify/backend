import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Tetra Pak as an official SuccessFactors script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tetrapak')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Tetra Pak')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.companyCareerPage, 'https://jobs.tetrapak.com/search/?locationsearch=India&q=&searchResultView=LIST&locale=en_GB')
  assert.equal(provider.companyDomain, 'jobs.tetrapak.com')
  assert.match(provider.modulePath, /tetrapak[\\/]script\.js$/)
})

test('buildScrapers exposes a runnable Tetra Pak scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tetrapak')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /tetrapak[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'tetrapak')
  assert.equal(scraper.provider.atsPlatform, 'successfactors')
})
