import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Tenstorrent as a Greenhouse apiPortal provider linked from the official careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tenstorrent')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.companyCareerPage, 'https://tenstorrent.com/careers')
  assert.equal(provider.companyDomain, 'tenstorrent.com')
  assert.match(provider.config.discovery.listingApiUrl, /boards-api\.greenhouse\.io\/v1\/boards\/tenstorrent\/jobs/i)
})

test('buildScrapers exposes a runnable Tenstorrent apiPortal scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tenstorrent')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /tenstorrent[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'tenstorrent')
  assert.equal(scraper.provider.atsPlatform, 'greenhouse')
})
