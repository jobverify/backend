import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes LIXIL as an official careers to LinkedIn script provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'lixil')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'linkedin-company-jobs-handoff')
  assert.equal(provider.companyCareerPage, 'https://www.lixil.com/en/careers/')
  assert.equal(provider.companyDomain, 'lixil.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /lixil[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable LIXIL scraper', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'lixil')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'lixil')
  assert.equal(scraper.provider.adapter, 'script')
})
