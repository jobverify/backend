import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes the EY script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const ey = catalog.find((provider) => provider.source === 'ey')

  assert.ok(ey)
  assert.equal(ey.adapter, 'script')
  assert.equal(ey.atsPlatform, 'successfactors')
  assert.match(ey.companyCareerPage, /careers\.ey\.com/i)
  assert.equal(ey.companyDomain, 'careers.ey.com')
  assert.equal(ey.parser, 'custom-script')
  assert.match(ey.modulePath, /ey[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable EY script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const ey = scrapers.find((scraper) => scraper.name === 'ey')

  assert.ok(ey)
  assert.equal(typeof ey.run, 'function')
  assert.equal(ey.provider.adapter, 'script')
  assert.equal(ey.provider.parser, 'custom-script')
  assert.match(ey.provider.companyCareerPage, /careers\.ey\.com/i)
})
