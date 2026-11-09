import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Zerodha is registered with its verified first-party jobs API metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'zerodha')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-first-party-jobs-api')
  assert.equal(provider.companyName, 'Zerodha')
  assert.equal(provider.companyCareerPage, 'https://careers.zerodha.com/')
  assert.equal(provider.companyDomain, 'zerodha.com')
  assert.equal(provider.paginationStrategy, 'single-first-party-jobs-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+official-jobs-api+public-json-listing',
  )
  assert.equal(provider.verifiedPublicPostingCount, 0)
  assert.match(provider.modulePath, /zerodha[\\/]script\.js$/i)
})

test('Zerodha resolves through the scraper catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'zerodha')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /zerodha[\\/]jobs\.json$/i)
})
