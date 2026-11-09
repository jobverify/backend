import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Digiledge as a verified empty-board script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'digiledge')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.companyName, 'Digiledge')
  assert.equal(provider.companyCareerPage, 'https://digiledge.in/')
  assert.equal(provider.companyDomain, 'digiledge.in')
  assert.match(provider.modulePath, /digiledge[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Digiledge scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'digiledge')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'digiledge')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site')
  assert.match(scraper.dryRunFile, /digiledge[\\/]jobs\.json$/i)
})
