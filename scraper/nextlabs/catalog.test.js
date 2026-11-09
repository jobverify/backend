import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('NextLabs is registered against its official careers page and same-domain detail surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nextlabs')

  assert.ok(provider)
  assert.equal(provider.companyName, 'NextLabs')
  assert.equal(provider.companyCareerPage, 'https://www.nextlabs.com/team/career/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-careers-page+detail-fetch')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+same-domain-job-description-detail-pages+india-location-filter',
  )
  assert.equal(provider.companyDomain, 'nextlabs.com')
  assert.match(provider.modulePath, /nextlabs[\\/]script\.js$/i)
})

test('NextLabs is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'nextlabs')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /nextlabs[\\/]jobs\.json$/)
})
