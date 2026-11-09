import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Tectonics Labs as a parked-domain scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'tectonicslabs')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.companyCareerPage, 'https://tectonics.ai/')
  assert.equal(provider.companyDomain, 'tectonics.ai')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /tectonicslabs[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Tectonics Labs scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'tectonicslabs')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://tectonics.ai/')
})
