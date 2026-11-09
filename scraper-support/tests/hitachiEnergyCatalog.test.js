import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Hitachi Energy as a custom feed script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hitachienergy')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Hitachi Energy')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.hitachienergy.com/careers/open-jobs')
  assert.equal(provider.companyDomain, 'hitachienergy.com')
  assert.match(provider.modulePath, /hitachienergy[\\/]script\.js$/)
})

test('buildScrapers exposes a runnable Hitachi Energy scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hitachienergy')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /hitachienergy[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'hitachienergy')
})
