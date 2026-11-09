import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Viasat apiPortal provider with India query filtering', () => {
  const catalog = getScraperCatalog()
  const viasat = catalog.find((provider) => provider.source === 'viasat')

  assert.ok(viasat)
  assert.equal(viasat.adapter, 'apiPortal')
  assert.equal(viasat.atsPlatform, 'jibe')
  assert.equal(viasat.companyName, 'Viasat')
  assert.equal(viasat.companyCareerPage, 'https://careers.viasat.com/us/en/search-results')
  assert.equal(viasat.companyDomain, 'careers.viasat.com')
  assert.equal(viasat.config.discovery.listingApiUrl, 'https://careers.viasat.com/api/jobs')
  assert.deepEqual(viasat.config.request.query, {
    country: 'India',
  })
  assert.deepEqual(viasat.config.pagination, {
    strategy: 'page-number',
    pageParam: 'page',
    pageSize: 10,
    resultsPath: 'jobs',
    totalCountPath: 'totalCount',
  })
  assert.deepEqual(viasat.config.mapping.location, [
    'data.full_location',
    'data.location_name',
  ])
})

test('buildScrapers exposes a runnable Viasat apiPortal scraper', () => {
  const scrapers = buildScrapers()
  const viasat = scrapers.find((scraper) => scraper.name === 'viasat')

  assert.ok(viasat)
  assert.equal(typeof viasat.run, 'function')
  assert.match(viasat.dryRunFile, /viasat[\\/]jobs\.json$/)
  assert.equal(viasat.provider.source, 'viasat')
  assert.equal(viasat.provider.atsPlatform, 'jibe')
})
