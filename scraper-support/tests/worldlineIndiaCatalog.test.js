import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Worldline India as an official SuccessFactors script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'worldlineindia')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Worldline India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.companyCareerPage, 'https://jobs.worldline.com/search/?locationsearch=India&q=&searchResultView=LIST')
  assert.equal(provider.companyDomain, 'jobs.worldline.com')
  assert.match(provider.modulePath, /worldlineindia[\\/]script\.js$/)
})

test('buildScrapers exposes a runnable Worldline India scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'worldlineindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /worldlineindia[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'worldlineindia')
  assert.equal(scraper.provider.atsPlatform, 'successfactors')
})
