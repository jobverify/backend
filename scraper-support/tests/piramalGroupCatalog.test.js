import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Piramal Group as an official no-public-careers sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'piramalgroup')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.companyName, 'Piramal Group')
  assert.equal(provider.companyCareerPage, 'https://www.piramal.com/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-anchor-plus-subsidiary-careers-handoff-plus-checked-no-group-careers-routes',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-subsidiary-careers-handoff+verified-missing-group-careers-routes-return-empty',
  )
  assert.equal(provider.companyDomain, 'piramal.com')
  assert.match(provider.modulePath, /piramalgroup[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Piramal Group scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'piramalgroup')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'piramalgroup')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /piramalgroup[\\/]jobs\.json$/)
})
