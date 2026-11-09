import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Molex Avature-backed script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'molex')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'avature')
  assert.equal(provider.companyName, 'Molex')
  assert.equal(provider.companyCareerPage, 'https://www.molex.com/en-us/about/careers')
  assert.equal(provider.companyDomain, 'koch.avature.net')
  assert.match(provider.modulePath, /molex[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Molex scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'molex')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /molex[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'molex')
  assert.equal(scraper.provider.atsPlatform, 'avature')
})
