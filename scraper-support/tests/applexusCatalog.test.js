import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Applexus script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'applexus')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.modulePath, fileURLToPath(new URL('../../scraper/applexus/script.js', import.meta.url)))
  assert.match(provider.companyCareerPage, /applexus\.com\/careers/i)
  assert.equal(provider.paginationStrategy, 'published-native-limit-offset-pagination+closing-reconciliation')
  assert.equal(provider.extractionStrategy, 'current-first-party-client+full-public-SSR-criteria+closing-models')
})

test('buildScrapers exposes a runnable Applexus scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'applexus')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /applexus[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'applexus')
})
