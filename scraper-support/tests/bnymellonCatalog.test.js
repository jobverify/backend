import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the BNY Oracle Cloud scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'bnymellon')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.match(provider.companyCareerPage, /oraclecloud\.com\/hcmUI\/CandidateExperience\/en\/sites\/BNY-Careers/i)
})

test('buildScrapers exposes a runnable BNY scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'bnymellon')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /bnymellon[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'bnymellon')
})
