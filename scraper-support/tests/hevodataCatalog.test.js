import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Hevo Data as an official Lever script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hevodata')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'lever')
  assert.equal(provider.companyName, 'Hevo Data')
  assert.equal(provider.companyCareerPage, 'https://jobs.lever.co/hevodata/')
  assert.equal(provider.companyDomain, 'jobs.lever.co')
  assert.match(provider.modulePath, /hevodata[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Hevo Data scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hevodata')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hevodata')
  assert.equal(scraper.provider.atsPlatform, 'lever')
  assert.match(scraper.dryRunFile, /hevodata[\\/]jobs\.json$/)
})
