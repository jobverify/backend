import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes AETHRONE AEROSPACE as a public careers bundle scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'aethroneaerospace')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.companyCareerPage, 'https://aethroneaerospace.com/career')
  assert.equal(provider.companyDomain, 'aethroneaerospace.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /aethroneaerospace[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable AETHRONE AEROSPACE scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'aethroneaerospace')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://aethroneaerospace.com/career')
})
