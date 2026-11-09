import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Lennox as an iCIMS script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'lennox')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'icims')
  assert.equal(provider.companyName, 'Lennox')
  assert.equal(provider.companyCareerPage, 'https://globalcareers-lennox.icims.com/jobs/search?ss=1&in_iframe=1')
  assert.equal(provider.companyDomain, 'globalcareers-lennox.icims.com')
  assert.match(provider.modulePath, /lennox[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Lennox scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'lennox')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'lennox')
  assert.equal(scraper.provider.atsPlatform, 'icims')
  assert.match(scraper.dryRunFile, /lennox[\\/]jobs\.json$/i)
})
