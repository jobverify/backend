import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Mercedes-Benz as a Taleo-backed script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mercedesbenz')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'oracle-taleo')
  assert.equal(provider.companyName, 'Mercedes-Benz')
  assert.equal(provider.companyCareerPage, 'https://jobs.mercedes-benz.com/en')
  assert.equal(provider.companyDomain, 'jobs.mercedes-benz.com')
  assert.match(provider.modulePath, /mercedesbenz[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Mercedes-Benz scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mercedesbenz')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /mercedesbenz[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'mercedesbenz')
  assert.equal(scraper.provider.atsPlatform, 'oracle-taleo')
})
