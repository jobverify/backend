import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes IBS Software as an Oracle Cloud script provider on the official careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ibssoftware')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.source, 'ibssoftware')
  assert.equal(provider.companyName, 'IBS Software')
  assert.match(provider.modulePath, /ibssoftware[\\/]script\.js$/i)
  assert.equal(provider.companyCareerPage, 'https://careers.ibsplc.com/')
  assert.equal(provider.companyDomain, 'ibsplc.com')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.extractionStrategy, 'Oracle recruitingCE listings + detail API')
})

test('buildScrapers exposes a runnable IBS Software scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ibssoftware')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /ibssoftware[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'ibssoftware')
  assert.match(scraper.provider.modulePath, /ibssoftware[\\/]script\.js$/i)
  assert.equal(scraper.provider.atsPlatform, 'oracle-cloud')
  assert.equal(scraper.provider.countryFilter, 'India')
  assert.equal(scraper.provider.extractionStrategy, 'Oracle recruitingCE listings + detail API')
})
