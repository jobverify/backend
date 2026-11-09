import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Nike as an Avature-backed script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nike')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'avature')
  assert.equal(provider.companyName, 'Nike')
  assert.equal(provider.companyCareerPage, 'https://careers.nike.com/jobs')
  assert.equal(provider.companyDomain, 'careers.nike.com')
  assert.match(provider.modulePath, /nike[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Nike scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'nike')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /nike[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'nike')
  assert.equal(scraper.provider.atsPlatform, 'avature')
})
