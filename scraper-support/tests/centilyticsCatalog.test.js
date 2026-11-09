import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Centilytics as a Zoho Recruit script provider', () => {
  const catalog = getScraperCatalog()
  const centilytics = catalog.find((provider) => provider.source === 'centilytics')

  assert.ok(centilytics)
  assert.equal(centilytics.adapter, 'script')
  assert.equal(centilytics.atsPlatform, 'zoho-recruit')
  assert.match(centilytics.companyCareerPage, /jobs\.centilytics\.com\/jobs\/Careers/i)
  assert.equal(centilytics.companyDomain, 'centilytics.com')
  assert.match(centilytics.modulePath, /centilytics[\\/]script\.js$/)
})

test('buildScrapers exposes a runnable Centilytics scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const centilytics = scrapers.find((scraper) => scraper.name === 'centilytics')

  assert.ok(centilytics)
  assert.equal(typeof centilytics.run, 'function')
  assert.match(centilytics.dryRunFile, /centilytics[\\/]jobs\.json$/)
  assert.equal(centilytics.provider.source, 'centilytics')
  assert.equal(centilytics.provider.atsPlatform, 'zoho-recruit')
})
