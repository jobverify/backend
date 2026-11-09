import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Allegis Global Solutions apiPortal provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const allegis = catalog.find((provider) => provider.source === 'allegis')

  assert.ok(allegis)
  assert.equal(allegis.adapter, 'apiPortal')
  assert.equal(allegis.atsPlatform, 'smartrecruiters')
  assert.match(allegis.companyCareerPage, /allegisglobalsolutions\.com\/en\/about-us\/jobs/i)
  assert.equal(allegis.companyDomain, 'allegisglobalsolutions.com')
  assert.match(
    allegis.config.discovery.listingApiUrl,
    /api\.smartrecruiters\.com\/v1\/companies\/AllegisGlobalSolutions\/postings/i,
  )
  assert.match(
    allegis.config.detail.urlTemplate,
    /api\.smartrecruiters\.com\/v1\/companies\/AllegisGlobalSolutions\/postings\/\{\{jobId\}\}/i,
  )
})

test('buildScrapers exposes a runnable Allegis Global Solutions apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const allegis = scrapers.find((scraper) => scraper.name === 'allegis')

  assert.ok(allegis)
  assert.equal(typeof allegis.run, 'function')
  assert.match(allegis.dryRunFile, /allegis[\\/]jobs\.json$/)
  assert.equal(allegis.provider.source, 'allegis')
  assert.equal(allegis.provider.atsPlatform, 'smartrecruiters')
})
