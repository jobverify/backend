import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Tesco as an Avature-backed script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tesco')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'avature')
  assert.equal(provider.companyName, 'Tesco')
  assert.equal(provider.companyCareerPage, 'https://careers.tesco.com/en_GB/careers/SearchJobs/')
  assert.equal(provider.companyDomain, 'careers.tesco.com')
  assert.match(provider.modulePath, /tesco[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Tesco scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tesco')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /tesco[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'tesco')
  assert.equal(scraper.provider.atsPlatform, 'avature')
})
