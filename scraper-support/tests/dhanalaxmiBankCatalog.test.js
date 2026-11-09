import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes the Dhanalaxmi Bank official careers API scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'dhanalaxmibank')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Dhanalaxmi Bank')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers-api')
  assert.equal(provider.companyCareerPage, 'https://www.dhan.bank.in/careers/')
  assert.equal(provider.companyDomain, 'dhan.bank.in')
})

test('buildScrapers exposes a runnable Dhanalaxmi Bank scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'dhanalaxmibank')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /dhanalaxmibank[\\/]jobs\.json$/)
})
