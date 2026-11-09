import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Groww Greenhouse apiPortal provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const groww = catalog.find((provider) => provider.source === 'groww')

  assert.ok(groww)
  assert.equal(groww.adapter, 'apiPortal')
  assert.equal(groww.atsPlatform, 'greenhouse')
  assert.match(groww.companyCareerPage, /job-boards\.eu\.greenhouse\.io\/groww/i)
  assert.equal(groww.companyDomain, 'job-boards.eu.greenhouse.io')
  assert.match(groww.config.discovery.listingApiUrl, /boards-api\.greenhouse\.io\/v1\/boards\/groww\/jobs/i)
})

test('buildScrapers exposes a runnable Groww apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const groww = scrapers.find((scraper) => scraper.name === 'groww')

  assert.ok(groww)
  assert.equal(typeof groww.run, 'function')
  assert.match(groww.dryRunFile, /groww[\\/]jobs\.json$/)
  assert.equal(groww.provider.source, 'groww')
  assert.equal(groww.provider.atsPlatform, 'greenhouse')
})
