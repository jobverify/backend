import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Ingersoll Rand as a SuccessFactors script provider with official MEIA board metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ingersollrand')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.companyName, 'Ingersoll Rand')
  assert.equal(provider.companyCareerPage, 'https://careers.irco.com/go/Middle-East%2C-India-and-Africa/9515600/')
  assert.equal(provider.companyDomain, 'careers.irco.com')
  assert.match(provider.modulePath, /ingersollrand[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Ingersoll Rand scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ingersollrand')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /ingersollrand[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'ingersollrand')
  assert.equal(scraper.provider.atsPlatform, 'successfactors')
})
