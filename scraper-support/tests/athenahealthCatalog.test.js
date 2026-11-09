import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the athenahealth Phenom script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const athenahealth = catalog.find((provider) => provider.source === 'athenahealth')

  assert.ok(athenahealth)
  assert.equal(athenahealth.adapter, 'script')
  assert.equal(athenahealth.atsPlatform, 'phenom')
  assert.match(athenahealth.companyCareerPage, /careers\.athenahealth\.com\/us\/en\/search-results/i)
  assert.equal(athenahealth.companyDomain, 'careers.athenahealth.com')
  assert.match(athenahealth.modulePath, /athenahealth[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable athenahealth scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const athenahealth = scrapers.find((scraper) => scraper.name === 'athenahealth')

  assert.ok(athenahealth)
  assert.equal(typeof athenahealth.run, 'function')
  assert.match(athenahealth.dryRunFile, /athenahealth[\\/]jobs\.json$/)
  assert.equal(athenahealth.provider.source, 'athenahealth')
  assert.equal(athenahealth.provider.atsPlatform, 'phenom')
})
