import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Thermo Fisher Scientific Phenom script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'thermofisherscientific')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'phenom')
  assert.equal(provider.companyName, 'Thermo Fisher Scientific')
  assert.equal(provider.companyCareerPage, 'https://jobs.thermofisher.com/global/en/india')
  assert.equal(provider.companyDomain, 'jobs.thermofisher.com')
  assert.match(provider.modulePath, /thermofisherscientific[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Thermo Fisher Scientific scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'thermofisherscientific')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /thermofisherscientific[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'thermofisherscientific')
  assert.equal(scraper.provider.atsPlatform, 'phenom')
})
