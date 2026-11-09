import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Vestas as a SuccessFactors-backed script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'vestas')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.companyName, 'Vestas')
  assert.equal(provider.companyCareerPage, 'https://careers.vestas.com/viewalljobs/?locale=en_US')
  assert.equal(provider.companyDomain, 'careers.vestas.com')
  assert.match(provider.modulePath, /vestas[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Vestas scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'vestas')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /vestas[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'vestas')
  assert.equal(scraper.provider.atsPlatform, 'successfactors')
})
