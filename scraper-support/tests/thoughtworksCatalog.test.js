import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Thoughtworks apiPortal provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const thoughtworks = catalog.find((provider) => provider.source === 'thoughtworks')

  assert.ok(thoughtworks)
  assert.equal(thoughtworks.adapter, 'apiPortal')
  assert.equal(thoughtworks.atsPlatform, 'greenhouse')
  assert.match(thoughtworks.companyCareerPage, /thoughtworks\.com\/careers\/jobs/i)
  assert.equal(thoughtworks.companyDomain, 'thoughtworks.com')
  assert.match(
    thoughtworks.config.discovery.listingApiUrl,
    /boards-api\.greenhouse\.io\/v1\/boards\/thoughtworks\/jobs/i,
  )
})

test('buildScrapers exposes a runnable Thoughtworks apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const thoughtworks = scrapers.find((scraper) => scraper.name === 'thoughtworks')

  assert.ok(thoughtworks)
  assert.equal(typeof thoughtworks.run, 'function')
  assert.match(thoughtworks.dryRunFile, /thoughtworks[\\/]jobs\.json$/)
  assert.equal(thoughtworks.provider.source, 'thoughtworks')
  assert.equal(thoughtworks.provider.atsPlatform, 'greenhouse')
})
