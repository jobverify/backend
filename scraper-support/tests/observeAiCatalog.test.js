import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Observe.AI as a Greenhouse apiPortal provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'observeai')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.match(provider.companyCareerPage, /observe\.ai\/careers/i)
  assert.equal(provider.companyDomain, 'observe.ai')
  assert.match(provider.config.discovery.listingApiUrl, /boards-api\.greenhouse\.io\/v1\/boards\/observeai\/jobs/i)
})

test('buildScrapers exposes a runnable Observe.AI apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'observeai')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.match(provider.dryRunFile, /observeai[\\/]jobs\.json$/)
  assert.equal(provider.provider.source, 'observeai')
  assert.equal(provider.provider.atsPlatform, 'greenhouse')
})
