import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes GE HealthCare as an official careers shell scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'gehealthcare')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://careers.gehealthcare.com/global/en')
  assert.equal(provider.companyDomain, 'careers.gehealthcare.com')
  assert.match(provider.modulePath, /gehealthcare[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable GE HealthCare scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'gehealthcare')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'official-company-careers')
  assert.match(provider.dryRunFile, /gehealthcare[\\/]jobs\.json$/)
})
