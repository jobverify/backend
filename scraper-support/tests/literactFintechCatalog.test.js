import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Literact Fintech is registered as an unresolved-domain fail-closed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'literactfintech')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Literact Fintech')
  assert.equal(provider.companyCareerPage, 'https://literactfintech.com/')
  assert.equal(provider.companyDomain, 'literactfintech.com')
  assert.match(provider.modulePath, /literactfintech[\\/]script\.js$/i)
})

test('Literact Fintech resolves to a runnable scraper with the expected dry-run file', () => {
  const scraper = buildScrapers().find((item) => item.name === 'literactfintech')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /literactfintech[\\/]jobs\.json$/i)
})
