import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Rakuten as a Zwayam-backed script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'rakuten')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zwayam-openings')
  assert.equal(provider.companyName, 'Rakuten')
  assert.equal(provider.companyCareerPage, 'https://corp.rakuten.co.in/careers/')
  assert.equal(provider.companyDomain, 'rakuten.openings.co')
  assert.match(provider.modulePath, /rakuten[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Rakuten scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'rakuten')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /rakuten[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'rakuten')
  assert.equal(scraper.provider.atsPlatform, 'zwayam-openings')
})
