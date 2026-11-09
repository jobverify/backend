import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Danfoss as an official SuccessFactors script provider', () => {
  const catalog = getScraperCatalog()
  const danfoss = catalog.find((provider) => provider.source === 'danfoss')

  assert.ok(danfoss)
  assert.equal(danfoss.companyName, 'Danfoss')
  assert.equal(danfoss.adapter, 'script')
  assert.equal(danfoss.atsPlatform, 'successfactors')
  assert.equal(danfoss.companyCareerPage, 'https://jobs.danfoss.com/search/')
  assert.equal(danfoss.companyDomain, 'jobs.danfoss.com')
  assert.match(danfoss.modulePath, /danfoss[\\/]script\.js$/)
})

test('buildScrapers exposes a runnable Danfoss scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const danfoss = scrapers.find((scraper) => scraper.name === 'danfoss')

  assert.ok(danfoss)
  assert.equal(typeof danfoss.run, 'function')
  assert.match(danfoss.dryRunFile, /danfoss[\\/]jobs\.json$/)
  assert.equal(danfoss.provider.source, 'danfoss')
  assert.equal(danfoss.provider.atsPlatform, 'successfactors')
})
