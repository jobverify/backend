import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Annalect India as a LinkedIn guest-search script provider', () => {
  const catalog = getScraperCatalog()
  const annalect = catalog.find((provider) => provider.source === 'annalect')

  assert.ok(annalect)
  assert.equal(annalect.adapter, 'script')
  assert.equal(annalect.atsPlatform, 'linkedin-guest-search')
  assert.match(annalect.companyCareerPage, /linkedin\.com\/company\/omnicomglobalsolutions/i)
  assert.equal(annalect.companyDomain, 'linkedin.com')
  assert.match(annalect.modulePath, /annalect[\\/]script\.js$/)
})

test('buildScrapers exposes a runnable Annalect scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const annalect = scrapers.find((scraper) => scraper.name === 'annalect')

  assert.ok(annalect)
  assert.equal(typeof annalect.run, 'function')
  assert.match(annalect.dryRunFile, /annalect[\\/]jobs\.json$/)
  assert.equal(annalect.provider.source, 'annalect')
  assert.equal(annalect.provider.atsPlatform, 'linkedin-guest-search')
})
