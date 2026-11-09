import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Drives and Motions as a verified empty-board script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'drivesandmotions')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.companyName, 'Drives and Motions')
  assert.equal(provider.companyCareerPage, 'https://drivesandmotions.com/')
  assert.equal(provider.companyDomain, 'drivesandmotions.com')
  assert.match(provider.modulePath, /drivesandmotions[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Drives and Motions scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'drivesandmotions')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'drivesandmotions')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site')
  assert.match(scraper.dryRunFile, /drivesandmotions[\\/]jobs\.json$/i)
})
