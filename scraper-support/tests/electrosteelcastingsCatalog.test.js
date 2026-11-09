import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Electrosteel Castings scraper with official metadata', () => {
  const catalog = getScraperCatalog()
  const electrosteel = catalog.find((provider) => provider.source === 'electrosteelcastings')

  assert.ok(electrosteel)
  assert.equal(electrosteel.adapter, 'script')
  assert.equal(electrosteel.atsPlatform, 'official-company-careers')
  assert.match(electrosteel.companyCareerPage, /electrosteel\.com\/career\/?$/i)
  assert.equal(electrosteel.companyDomain, 'electrosteel.com')
})

test('buildScrapers exposes a runnable Electrosteel Castings scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const electrosteel = scrapers.find((scraper) => scraper.name === 'electrosteelcastings')

  assert.ok(electrosteel)
  assert.equal(typeof electrosteel.run, 'function')
  assert.match(electrosteel.dryRunFile, /electrosteelcastings[\\/]jobs\.json$/)
  assert.equal(electrosteel.provider.source, 'electrosteelcastings')
  assert.equal(electrosteel.provider.atsPlatform, 'official-company-careers')
})
