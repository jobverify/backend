import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes SEW-Eurodrive India Pvt Ltd as an official first-party careers scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'seweurodriveindiapvtltd')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.seweurodriveindia.com/career/your_career/your_career.html')
  assert.equal(provider.companyDomain, 'seweurodriveindia.com')
  assert.match(provider.modulePath, /seweurodriveindiapvtltd[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable SEW-Eurodrive India Pvt Ltd scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'seweurodriveindiapvtltd')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.adapter, 'script')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
  assert.match(scraper.dryRunFile, /seweurodriveindiapvtltd[\\/]jobs\.json$/i)
})
