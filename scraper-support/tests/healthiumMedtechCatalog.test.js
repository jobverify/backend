import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Healthium Medtech as an official first-party careers script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'healthiummedtech')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'wordpress-company-careers')
  assert.equal(provider.companyName, 'Healthium Medtech')
  assert.equal(provider.companyCareerPage, 'https://healthiummedtech.com/careers/')
  assert.equal(provider.companyDomain, 'healthiummedtech.com')
  assert.match(provider.modulePath, /healthiummedtech[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Healthium Medtech scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'healthiummedtech')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'healthiummedtech')
  assert.equal(scraper.provider.atsPlatform, 'wordpress-company-careers')
  assert.match(scraper.dryRunFile, /healthiummedtech[\\/]jobs\.json$/)
})
