import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes RV Systems as an official-site no-public-openings scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'rvsystems')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.companyCareerPage, 'https://rvsystems.co.in/')
  assert.equal(provider.companyDomain, 'rvsystems.co.in')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /rvsystems[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable RV Systems scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'rvsystems')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://rvsystems.co.in/')
})
