import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes flydocs as an official vacancies script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'flydocs')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyName, 'flydocs')
  assert.equal(provider.companyCareerPage, 'https://flydocs.aero/vacancies/')
  assert.equal(provider.companyDomain, 'flydocs.aero')
  assert.match(provider.modulePath, /flydocs[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable flydocs scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'flydocs')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /flydocs[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'flydocs')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
})
