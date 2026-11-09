import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes AVIN Systems as an official-site job-page scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'avinsystems')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.avinsystems.com/careers/')
  assert.equal(provider.companyDomain, 'avinsystems.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /avinsystems[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable AVIN Systems scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'avinsystems')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://www.avinsystems.com/careers/')
})
