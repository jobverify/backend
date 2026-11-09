import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Rocket India as a Phenom provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'rocketindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'phenom')
  assert.equal(provider.companyCareerPage, 'https://careers.rocket.com/in/en/search-results')
  assert.equal(provider.companyDomain, 'rocket.com')
  assert.equal(provider.parser, 'validated-phenom-full-native-details')
  assert.match(provider.modulePath, /rocketindia[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Rocket India scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'rocketindia')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'validated-phenom-full-native-details')
  assert.equal(provider.provider.companyCareerPage, 'https://careers.rocket.com/in/en/search-results')
})
