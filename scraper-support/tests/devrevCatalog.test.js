import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes DevRev as an official Greenhouse provider', () => {
  const catalog = getScraperCatalog()
  const devrev = catalog.find((provider) => provider.source === 'devrev')

  assert.ok(devrev)
  assert.equal(devrev.adapter, 'apiPortal')
  assert.equal(devrev.atsPlatform, 'greenhouse')
  assert.equal(devrev.companyCareerPage, 'https://devrev.ai/careers')
  assert.equal(devrev.companyDomain, 'devrev.ai')
  assert.match(
    devrev.config.discovery.listingApiUrl,
    /boards-api\.greenhouse\.io\/v1\/boards\/devrev\/jobs/i,
  )
})

test('buildScrapers exposes a runnable DevRev apiPortal scraper', () => {
  const devrev = buildScrapers().find((scraper) => scraper.name === 'devrev')

  assert.ok(devrev)
  assert.equal(typeof devrev.run, 'function')
  assert.match(devrev.dryRunFile, /devrev[\\/]jobs\.json$/)
  assert.equal(devrev.provider.atsPlatform, 'greenhouse')
})
