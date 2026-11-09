import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Radware as an Oracle Taleo script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'radware')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'oracle-taleo')
  assert.equal(provider.companyName, 'Radware')
  assert.equal(provider.companyCareerPage, 'https://www.radware.com/careers/')
  assert.equal(provider.companyDomain, 'radware.com')
  assert.match(provider.modulePath, /radware[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Radware scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'radware')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'radware')
  assert.equal(scraper.provider.atsPlatform, 'oracle-taleo')
  assert.match(scraper.dryRunFile, /radware[\\/]jobs\.json$/)
})
