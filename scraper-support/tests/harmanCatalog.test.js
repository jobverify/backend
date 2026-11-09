import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes HARMAN as an Avature-backed script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'harman')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'avature')
  assert.equal(provider.companyName, 'HARMAN')
  assert.equal(provider.companyCareerPage, 'https://jobsearch.harman.com/en_US/careers/SearchJobs')
  assert.equal(provider.companyDomain, 'jobsearch.harman.com')
  assert.match(provider.modulePath, /harman[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable HARMAN scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'harman')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /harman[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'harman')
  assert.equal(scraper.provider.atsPlatform, 'avature')
})
