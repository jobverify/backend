import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Zenoti as a Greenhouse apiPortal provider linked from the official careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'zenoti')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.companyCareerPage, 'https://www.zenoti.com/company/careers')
  assert.equal(provider.companyDomain, 'zenoti.com')
  assert.match(provider.config.discovery.listingApiUrl, /boards-api\.greenhouse\.io\/v1\/boards\/zenoti\/jobs/i)
})

test('buildScrapers exposes a runnable Zenoti apiPortal scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'zenoti')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /zenoti[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'zenoti')
  assert.equal(scraper.provider.atsPlatform, 'greenhouse')
})
