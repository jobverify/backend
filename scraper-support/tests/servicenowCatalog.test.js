import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the ServiceNow SmartRecruiters apiPortal provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const servicenow = catalog.find((provider) => provider.source === 'servicenow')

  assert.ok(servicenow)
  assert.equal(servicenow.adapter, 'apiPortal')
  assert.equal(servicenow.atsPlatform, 'smartrecruiters')
  assert.match(servicenow.companyCareerPage, /careers\.servicenow\.com\/jobs/i)
  assert.equal(servicenow.companyDomain, 'careers.servicenow.com')
  assert.match(servicenow.config.discovery.listingApiUrl, /api\.smartrecruiters\.com\/v1\/companies\/ServiceNow\/postings/i)
  assert.equal(servicenow.config.request.query.limit, '10')
  assert.equal(servicenow.config.request.query.country, 'in')
  assert.match(servicenow.config.detail.urlTemplate, /api\.smartrecruiters\.com\/v1\/companies\/ServiceNow\/postings\/\{\{jobId\}\}/i)
})

test('buildScrapers exposes a runnable ServiceNow apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const servicenow = scrapers.find((scraper) => scraper.name === 'servicenow')

  assert.ok(servicenow)
  assert.equal(typeof servicenow.run, 'function')
  assert.match(servicenow.dryRunFile, /servicenow[\\/]jobs\.json$/)
  assert.equal(servicenow.provider.source, 'servicenow')
  assert.equal(servicenow.provider.atsPlatform, 'smartrecruiters')
})
