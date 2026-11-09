import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Electronic Arts as an Avature script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const ea = catalog.find((provider) => provider.source === 'electronicarts')

  assert.ok(ea)
  assert.equal(ea.adapter, 'script')
  assert.equal(ea.atsPlatform, 'avature')
  assert.match(ea.companyCareerPage, /jobs\.ea\.com\/en_US\/careers\/?$/i)
  assert.equal(ea.companyDomain, 'jobs.ea.com')
  assert.match(ea.modulePath, /electronicarts[\\/]script\.js$/)
})

test('buildScrapers exposes a runnable Electronic Arts scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const ea = scrapers.find((scraper) => scraper.name === 'electronicarts')

  assert.ok(ea)
  assert.equal(typeof ea.run, 'function')
  assert.match(ea.dryRunFile, /electronicarts[\\/]jobs\.json$/)
  assert.equal(ea.provider.source, 'electronicarts')
  assert.equal(ea.provider.atsPlatform, 'avature')
})
