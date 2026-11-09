import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Acsia scraper with official careers metadata', () => {
  const catalog = getScraperCatalog()
  const acsia = catalog.find((provider) => provider.source === 'acsia')

  assert.ok(acsia)
  assert.equal(acsia.adapter, 'script')
  assert.equal(acsia.atsPlatform, 'official-company-careers')
  assert.match(acsia.companyCareerPage, /acsiatech\.com\/careers/i)
  assert.equal(acsia.companyDomain, 'acsiatech.com')
})

test('buildScrapers exposes a runnable Acsia scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const acsia = scrapers.find((scraper) => scraper.name === 'acsia')

  assert.ok(acsia)
  assert.equal(typeof acsia.run, 'function')
  assert.match(acsia.dryRunFile, /acsia[\\/]jobs\.json$/)
  assert.equal(acsia.provider.source, 'acsia')
  assert.equal(acsia.provider.adapter, 'script')
})
