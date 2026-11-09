import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog routes Bazaarvoice through its current public inventory verifier', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'bazaarvoice')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'lever')
  assert.match(provider.companyCareerPage, /bazaarvoice\.com\/company\/careers/i)
  assert.equal(provider.config.discovery.listingApiUrl, 'https://api.lever.co/v0/postings/bazaarvoice')
  assert.match(provider.modulePath, /bazaarvoice[\\/]script\.js$/)
})

test('buildScrapers exposes a runnable Bazaarvoice native scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'bazaarvoice')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /bazaarvoice[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'bazaarvoice')
})
