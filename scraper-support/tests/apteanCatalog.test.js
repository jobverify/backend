import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Aptean Jibe apiPortal provider with India filters', () => {
  const catalog = getScraperCatalog()
  const aptean = catalog.find((provider) => provider.source === 'aptean')

  assert.ok(aptean)
  assert.equal(aptean.adapter, 'apiPortal')
  assert.equal(aptean.atsPlatform, 'jibe')
  assert.match(aptean.companyCareerPage, /careers\.aptean\.com\/jobs\?country=India/i)
  assert.equal(aptean.companyDomain, 'careers.aptean.com')
  assert.equal(aptean.config.discovery.listingApiUrl, 'https://careers.aptean.com/api/jobs')
  assert.deepEqual(aptean.config.request.query, {
    country: 'India',
    internal: 'false',
    separator: '%7C',
    facetField: 'country%7Ctags3%7Ctags4',
  })
  assert.equal(aptean.paginationStrategy, 'page-number')
  assert.deepEqual(aptean.config.pagination, {
    strategy: 'page-number',
    pageParam: 'page',
    pageSize: 10,
    resultsPath: 'jobs',
    totalCountPath: 'totalCount',
  })
})

test('buildScrapers exposes a runnable Aptean apiPortal scraper', () => {
  const scrapers = buildScrapers()
  const aptean = scrapers.find((scraper) => scraper.name === 'aptean')

  assert.ok(aptean)
  assert.equal(typeof aptean.run, 'function')
  assert.match(aptean.dryRunFile, /aptean[\\/]jobs\.json$/)
  assert.equal(aptean.provider.source, 'aptean')
  assert.equal(aptean.provider.atsPlatform, 'jibe')
})
