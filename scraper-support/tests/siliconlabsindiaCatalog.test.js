import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Silicon Labs India script provider with official Silicon Labs metadata', () => {
  const catalog = getScraperCatalog()
  const siliconLabsIndia = catalog.find((provider) => provider.source === 'siliconlabsindia')

  assert.ok(siliconLabsIndia)
  assert.equal(siliconLabsIndia.adapter, 'script')
  assert.equal(siliconLabsIndia.atsPlatform, 'workday')
  assert.equal(siliconLabsIndia.companyName, 'Silicon Labs India')
  assert.equal(siliconLabsIndia.companyCareerPage, 'https://www.silabs.com/about-us/careers')
  assert.equal(siliconLabsIndia.companyDomain, 'silabs.com')
  assert.match(siliconLabsIndia.modulePath, /siliconlabsindia\.workday[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Silicon Labs India scraper', () => {
  const scrapers = buildScrapers()
  const siliconLabsIndia = scrapers.find((scraper) => scraper.name === 'siliconlabsindia')

  assert.ok(siliconLabsIndia)
  assert.equal(typeof siliconLabsIndia.run, 'function')
  assert.match(siliconLabsIndia.dryRunFile, /siliconlabsindia.workday[\\/]jobs\.json$/i)
  assert.equal(siliconLabsIndia.provider.source, 'siliconlabsindia')
  assert.equal(siliconLabsIndia.provider.atsPlatform, 'workday')
})
