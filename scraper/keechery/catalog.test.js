import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Keechery is registered as an official first-party careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'keechery')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Keechery')
  assert.equal(provider.companyCareerPage, 'https://www.keechery.com/career/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyDomain, 'keechery.com')
})

test('Keechery is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'keechery')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /keechery[\\/]jobs\.json$/)
})
