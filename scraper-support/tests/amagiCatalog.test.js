import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Amagi apiPortal provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const amagi = catalog.find((provider) => provider.source === 'amagi')

  assert.ok(amagi)
  assert.equal(amagi.adapter, 'apiPortal')
  assert.equal(amagi.atsPlatform, 'mynexthire')
  assert.match(amagi.companyCareerPage, /amagi\.com\/careers\/open-roles/i)
  assert.equal(amagi.companyDomain, 'amagi.com')
  assert.match(
    amagi.config.discovery.listingApiUrl,
    /amagi\.mynexthire\.com\/employer\/careers\/reqlist\/get/i,
  )
})

test('buildScrapers exposes a runnable Amagi apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const amagi = scrapers.find((scraper) => scraper.name === 'amagi')

  assert.ok(amagi)
  assert.equal(typeof amagi.run, 'function')
  assert.match(amagi.dryRunFile, /amagi[\\/]jobs\.json$/)
  assert.equal(amagi.provider.source, 'amagi')
  assert.equal(amagi.provider.atsPlatform, 'mynexthire')
})
