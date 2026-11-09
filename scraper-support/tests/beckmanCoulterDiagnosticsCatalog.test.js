import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Beckman Coulter Diagnostics as a Phenom script provider', () => {
  const catalog = getScraperCatalog()
  const beckman = catalog.find((provider) => provider.source === 'beckmancoulterdiagnostics')

  assert.ok(beckman)
  assert.equal(beckman.adapter, 'script')
  assert.equal(beckman.atsPlatform, 'phenom')
  assert.match(beckman.companyCareerPage, /jobs\.danaher\.com\/global\/en\/search-results\?keywords=Beckman/i)
  assert.equal(beckman.companyDomain, 'jobs.danaher.com')
  assert.match(beckman.modulePath, /beckmancoulterdiagnostics[\\/]script\.js$/)
})

test('buildScrapers exposes a runnable Beckman Coulter Diagnostics scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const beckman = scrapers.find((scraper) => scraper.name === 'beckmancoulterdiagnostics')

  assert.ok(beckman)
  assert.equal(typeof beckman.run, 'function')
  assert.match(beckman.dryRunFile, /beckmancoulterdiagnostics[\\/]jobs\.json$/)
  assert.equal(beckman.provider.source, 'beckmancoulterdiagnostics')
  assert.equal(beckman.provider.atsPlatform, 'phenom')
})
