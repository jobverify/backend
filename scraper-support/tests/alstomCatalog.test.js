import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Alstom SuccessFactors script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const alstom = catalog.find((provider) => provider.source === 'alstom')

  assert.ok(alstom)
  assert.equal(alstom.adapter, 'script')
  assert.equal(alstom.atsPlatform, 'successfactors')
  assert.match(alstom.companyCareerPage, /jobsearch\.alstom\.com/i)
  assert.equal(alstom.companyDomain, 'jobsearch.alstom.com')
  assert.match(alstom.modulePath, /alstom[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Alstom scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const alstom = scrapers.find((scraper) => scraper.name === 'alstom')

  assert.ok(alstom)
  assert.equal(typeof alstom.run, 'function')
  assert.match(alstom.dryRunFile, /alstom[\\/]jobs\.json$/)
  assert.equal(alstom.provider.source, 'alstom')
  assert.equal(alstom.provider.atsPlatform, 'successfactors')
})
