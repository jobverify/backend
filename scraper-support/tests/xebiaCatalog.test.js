import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Xebia APAC as a Greenhouse apiPortal provider linked from the official careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'xebia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.companyCareerPage, 'https://xebia.com/careers/')
  assert.equal(provider.companyDomain, 'xebia.com')
  assert.match(provider.config.discovery.listingApiUrl, /boards-api\.greenhouse\.io\/v1\/boards\/xebiaapac\/jobs/i)
})

test('buildScrapers exposes a runnable Xebia apiPortal scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'xebia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /xebia[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'xebia')
  assert.equal(scraper.provider.atsPlatform, 'greenhouse')
})
