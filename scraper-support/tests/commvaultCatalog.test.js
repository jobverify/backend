import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Commvault as a Greenhouse apiPortal provider', () => {
  const catalog = getScraperCatalog()
  const commvault = catalog.find((provider) => provider.source === 'commvault')

  assert.ok(commvault)
  assert.equal(commvault.adapter, 'apiPortal')
  assert.equal(commvault.atsPlatform, 'greenhouse')
  assert.equal(commvault.companyCareerPage, 'https://www.commvault.com/careers/jobs')
  assert.equal(commvault.companyDomain, 'commvault.com')
  assert.match(
    commvault.config.discovery.listingApiUrl,
    /boards-api\.greenhouse\.io\/v1\/boards\/commvault\/jobs/i,
  )
})

test('buildScrapers exposes a runnable Commvault scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const commvault = scrapers.find((scraper) => scraper.name === 'commvault')

  assert.ok(commvault)
  assert.equal(typeof commvault.run, 'function')
  assert.match(commvault.dryRunFile, /commvault[\\/]jobs\.json$/)
  assert.equal(commvault.provider.source, 'commvault')
  assert.equal(commvault.provider.atsPlatform, 'greenhouse')
})
