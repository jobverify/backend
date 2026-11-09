import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Cognida.ai with its public Keka careers metadata', () => {
  const catalog = getScraperCatalog()
  const cognida = catalog.find((provider) => provider.source === 'cognida')

  assert.ok(cognida)
  assert.equal(cognida.adapter, 'script')
  assert.equal(cognida.atsPlatform, 'keka-embed-api')
  assert.equal(cognida.companyCareerPage, 'https://www.cognida.ai/careers/')
  assert.equal(cognida.companyDomain, 'cognida.ai')
})

test('buildScrapers exposes a runnable Cognida.ai scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const cognida = scrapers.find((scraper) => scraper.name === 'cognida')

  assert.ok(cognida)
  assert.equal(typeof cognida.run, 'function')
  assert.match(cognida.dryRunFile, /cognida[\\/]jobs\.json$/)
  assert.equal(cognida.provider.source, 'cognida')
  assert.equal(cognida.provider.adapter, 'script')
})
