import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the H&R Block script provider backed by the official public Jibe careers API', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hrblock')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'icims-jibe')
  assert.equal(provider.companyName, 'H&R Block')
  assert.equal(provider.companyCareerPage, 'https://careers.hrblock.com/jobs')
  assert.equal(provider.companyDomain, 'careers.hrblock.com')
  assert.match(provider.modulePath, /hrblock[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable H&R Block scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hrblock')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hrblock')
  assert.equal(scraper.provider.atsPlatform, 'icims-jibe')
  assert.match(scraper.dryRunFile, /hrblock[\\/]jobs\.json$/)
})
