import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Acceleration Robotics scraper with verified runtime-unreachable metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'accelerationrobotics')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.match(provider.companyCareerPage, /recruit\.accelerationrobotics\.in/i)
  assert.match(provider.verifiedSurfaceSummary, /publicly advertises 12 live roles/i)
  assert.match(provider.verifiedSurfaceSummary, /UND_ERR_CONNECT_TIMEOUT/i)
})

test('buildScrapers exposes a runnable Acceleration Robotics scraper', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'accelerationrobotics')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /accelerationrobotics[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'accelerationrobotics')
  assert.equal(scraper.provider.adapter, 'script')
})
