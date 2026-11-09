import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Juspay official careers script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const juspay = catalog.find((provider) => provider.source === 'juspay')

  assert.ok(juspay)
  assert.equal(juspay.adapter, 'script')
  assert.equal(juspay.atsPlatform, 'official-company-careers')
  assert.match(juspay.companyCareerPage, /juspay\.io\/careers/i)
  assert.equal(juspay.companyDomain, 'juspay.io')
})

test('buildScrapers exposes a runnable Juspay scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const juspay = scrapers.find((scraper) => scraper.name === 'juspay')

  assert.ok(juspay)
  assert.equal(typeof juspay.run, 'function')
  assert.match(juspay.dryRunFile, /juspay[\\/]jobs\.json$/)
  assert.equal(juspay.provider.source, 'juspay')
  assert.equal(juspay.provider.atsPlatform, 'official-company-careers')
})
