import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes First Citizens India as an API-backed iCIMS/Jibe script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'firstcitizensindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'icims-jibe')
  assert.equal(provider.companyName, 'First Citizens India')
  assert.equal(provider.companyCareerPage, 'https://jobs.firstcitizens.com/')
  assert.equal(provider.companyDomain, 'jobs.firstcitizens.com')
  assert.match(provider.modulePath, /firstcitizensindia[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable First Citizens India scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'firstcitizensindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'firstcitizensindia')
  assert.equal(scraper.provider.atsPlatform, 'icims-jibe')
  assert.match(scraper.dryRunFile, /firstcitizensindia[\\/]jobs\.json$/)
})
